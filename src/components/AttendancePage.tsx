import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { QRScanner } from './QRScanner';
import { ProfileImage } from './DriveImage';
import { getSecureLocalItem, getSecureSessionItem, setSecureLocalItem, setSecureSessionItem } from '../utils/secureStorage';

const ATTENDANCE_GAS_URL = 'https://script.google.com/macros/s/AKfycbzOTNqxLJYNneKIP6iAHqYleARxcySuNntdygZWq1eXM1EYB-HqkplUz053VSA3iK_-eg/exec';
const ATTENDANCE_DIRECTORY_GAS_URL = 'https://script.google.com/macros/s/AKfycbx7gVOloTlgAZ5NJalR5QRrEo8iRdc-rJWZiaiStu2KMU7hAXvicAJXUm2Jm5iCLZZn/exec';
const ATTENDANCE_DIRECTORY_CACHE_PREFIX = 'attendance_directory_lookup_';
const ATTENDANCE_OFFLINE_QUEUE_PREFIX = 'attendance_offline_queue_';

type ToastType = 'info' | 'success' | 'error' | 'loading';
type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
type AttendanceRecordMode = 'whole_day' | 'session' | 'course';

type AttendanceUser = {
  idNumber: string;
  name?: string;
  fullName?: string;
  position?: string;
  qrCodeValue?: string;
  profilePictureURL?: string;
};

type AttendanceRecord = {
  eventId: string;
  eventLabel: string;
  status: AttendanceStatus;
};

type AttendanceRecordDayGroup = {
  dateKey: string;
  displayDate: string;
  records: AttendanceRecord[];
};

type AttendanceAnalytics = {
  totalMarked: number;
  byStatus: Array<{ label: string; value: number }>;
  byEvent: Array<{ label: string; value: number }>;
};

type AnalyticsFilterType = 'all' | 'specific_date' | 'specific_class' | 'date_range' | 'specific_event';

type AttendanceAnalyticsEventMeta = {
  eventId: string;
  label: string;
  dateKey: string;
  displayDate: string;
  courseCode: string;
  courseName: string;
  startTime: string;
  endTime: string;
  sessionKey: 'morning' | 'afternoon';
  type: string;
};

type AttendanceAnalyticsRecord = {
  memberId: string;
  memberName: string;
  eventId: string;
  eventLabel: string;
  status: AttendanceStatus;
  dateKey: string;
  courseCode: string;
  courseName: string;
  sessionKey: 'morning' | 'afternoon';
};

type AttendanceAnalyticsStudentDetail = {
  memberId: string;
  memberName: string;
  status: AttendanceStatus;
  profilePictureURL?: string;
  records: AttendanceAnalyticsRecord[];
};

type AttendanceSchedule = {
  scheduleId: string;
  courseCode: string;
  courseName: string;
  type: string;
  startTime: string;
  endTime: string;
  startTime12h: string;
  endTime12h: string;
  specificDate: string;
  dayOfWeek: string;
  sessionKey: 'morning' | 'afternoon';
  sessionLabel: string;
  eventId: string;
  label: string;
};

type AttendanceSessionOption = {
  key: 'morning' | 'afternoon';
  label: string;
  count: number;
};

type AttendanceCourseOption = {
  courseCode: string;
  courseName: string;
  count: number;
};

type AttendanceCaptureContext = {
  success: boolean;
  error?: string;
  date: string;
  dayOfWeek: string;
  schedules: AttendanceSchedule[];
  sessionOptions: AttendanceSessionOption[];
  courseOptions: AttendanceCourseOption[];
};

type AttendanceScannedMember = {
  memberId: string;
  name: string;
  fullName?: string;
  course?: string;
  year?: string;
  section?: string;
};

type AttendanceDirectoryCache = Record<string, AttendanceScannedMember>;

type AttendanceMemberSnapshot = {
  memberId: string;
  name: string;
  statuses: Record<string, AttendanceStatus>;
};

type AttendanceOfflineQueueItem = {
  queueId: string;
  queuedAt: string;
  qrText: string;
  member: AttendanceScannedMember;
  recordMode: AttendanceRecordMode;
  sessionKey: string;
  courseCode: string;
  status: AttendanceStatus;
  eventIds: string[];
  eventLabels: string[];
};

type AttendancePendingScan = {
  qrText: string;
  member: AttendanceScannedMember;
  existingStatuses: Array<{ eventId: string; label: string; status: AttendanceStatus }>;
};

type AttendancePageContext = {
  success: boolean;
  userProfile?: AttendanceUser | null;
  canEdit?: boolean;
  canViewAnalytics?: boolean;
  myRecords?: AttendanceRecord[];
  analytics?: AttendanceAnalytics;
  capture?: AttendanceCaptureContext;
  members?: AttendanceMemberSnapshot[];
  error?: string;
};

type AttendancePageProps = {
  onBack: () => void;
  darkMode: boolean;
  user: AttendanceUser | null;
  addToast: (message: string, type: ToastType, progress?: number) => number;
  removeToast: (id: number) => void;
};

const STATUS_OPTIONS: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];
const ANALYTICS_FILTER_OPTIONS: Array<{ key: AnalyticsFilterType; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'specific_date', label: 'Specific Date' },
  { key: 'specific_class', label: 'Specific Class' },
  { key: 'date_range', label: 'Date Range' },
  { key: 'specific_event', label: 'Specific Event' }
];
const RECORD_MODE_OPTIONS: Array<{ key: AttendanceRecordMode; label: string }> = [
  { key: 'whole_day', label: 'Record for the whole day' },
  { key: 'session', label: 'Record for Morning/Afternoon Session' },
  { key: 'course', label: 'Record per Course' }
];

function AttendanceIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-rounded select-none ${className}`}>{name}</span>;
}

type DropdownOption = {
  value: string;
  label: string;
  description?: string;
};

function Skeleton({ className = '', darkMode = false }: { className?: string; darkMode?: boolean }) {
  return <div className={`rounded-lg skeleton-shimmer ${darkMode ? 'brightness-75' : ''} ${className}`} />;
}

function getAttendanceRecordDateKey(record: AttendanceRecord) {
  const directMatch = record.eventId.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (directMatch) return directMatch[0];

  const labelMatch = record.eventLabel.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (labelMatch) return labelMatch[0];

  return 'Undated';
}

function formatAttendanceGroupDate(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;

  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;

  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function getSessionKeyFromTime(startTime: string): 'morning' | 'afternoon' {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = ((Number.isFinite(hours) ? hours : 0) * 60) + (Number.isFinite(minutes) ? minutes : 0);
  return totalMinutes < 12 * 60 ? 'morning' : 'afternoon';
}

function parseAttendanceEventMeta(eventId: string, schedule?: AttendanceSchedule): AttendanceAnalyticsEventMeta {
  if (schedule) {
    return {
      eventId: schedule.eventId,
      label: schedule.label || schedule.eventId,
      dateKey: schedule.specificDate || getAttendanceRecordDateKey({ eventId: schedule.eventId, eventLabel: schedule.label || schedule.eventId, status: 'Present' }),
      displayDate: formatAttendanceGroupDate(schedule.specificDate || getAttendanceRecordDateKey({ eventId: schedule.eventId, eventLabel: schedule.label || schedule.eventId, status: 'Present' })),
      courseCode: schedule.courseCode || 'Unknown',
      courseName: schedule.courseName || schedule.courseCode || 'Unknown',
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      sessionKey: schedule.sessionKey,
      type: schedule.type
    };
  }

  const parts = eventId.split('|').map((part) => part.trim());
  const dateKey = parts[0] || getAttendanceRecordDateKey({ eventId, eventLabel: eventId, status: 'Present' });
  const courseCode = parts[1] || 'Unknown';
  const startTime = parts[2] || '';
  const endTime = parts[3] || '';

  return {
    eventId,
    label: eventId,
    dateKey,
    displayDate: formatAttendanceGroupDate(dateKey),
    courseCode,
    courseName: courseCode,
    startTime,
    endTime,
    sessionKey: getSessionKeyFromTime(startTime),
    type: parts[4] || ''
  };
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function summarizeChartItems(items: Array<{ label: string; value: number }>) {
  return items.slice().sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function buildDonutSegments(items: Array<{ label: string; value: number; color: string }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return 'conic-gradient(#cbd5e1 0deg 360deg)';

  let start = 0;
  const segments: string[] = [];
  items.forEach((item) => {
    const angle = (item.value / total) * 360;
    const end = start + angle;
    segments.push(`${item.color} ${start}deg ${end}deg`);
    start = end;
  });
  return `conic-gradient(${segments.join(', ')})`;
}

function TinyStatCard({
  label,
  value,
  accent,
  darkMode
}: {
  label: string;
  value: string | number;
  accent: string;
  darkMode: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{label}</p>
      <p className={`mt-2 text-2xl font-bold sm:text-3xl ${darkMode ? 'text-white' : 'text-stone-800'}`}>{value}</p>
      <div className={`mt-3 h-1.5 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className={`h-full rounded-full ${accent}`} style={{ width: '100%' }} />
      </div>
    </div>
  );
}

function DonutChartCard({
  title,
  items,
  darkMode,
  onItemClick,
  activeLabel
}: {
  title: string;
  items: Array<{ label: string; value: number; color: string }>;
  darkMode: boolean;
  onItemClick?: (label: string) => void;
  activeLabel?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-4 sm:p-6`}>
      <h2 className={`mobile-safe-heading text-base font-bold sm:text-lg ${darkMode ? 'text-white' : 'text-stone-800'}`}>{title}</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-[220px_1fr] sm:items-center">
        <div className="mx-auto">
          <div
            className="relative h-40 w-40 rounded-full sm:h-48 sm:w-48"
            style={{ background: buildDonutSegments(items) }}
          >
            <div className={`absolute inset-[22%] rounded-full ${darkMode ? 'bg-gray-800' : 'bg-white'} flex items-center justify-center text-center`}>
              <div>
                <p className={`text-xs uppercase tracking-[0.2em] ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Total</p>
                <p className={`text-2xl font-bold sm:text-3xl ${darkMode ? 'text-white' : 'text-stone-800'}`}>{total}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onItemClick?.(item.label)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-2 py-2 text-left transition ${
                onItemClick
                  ? darkMode
                    ? activeLabel === item.label ? 'bg-gray-900' : 'hover:bg-gray-900/70'
                    : activeLabel === item.label ? 'bg-stone-100' : 'hover:bg-stone-50'
                  : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <p className={`mobile-safe-wrap text-sm ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>{item.label}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.value}</p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{total ? formatPercentage((item.value / total) * 100) : '0.0%'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VerticalBarChartCard({
  title,
  items,
  darkMode,
  colorClass
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  darkMode: boolean;
  colorClass: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-4 sm:p-6`}>
      <h2 className={`mobile-safe-heading text-base font-bold sm:text-lg ${darkMode ? 'text-white' : 'text-stone-800'}`}>{title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 pb-2 sm:flex sm:h-72 sm:items-end">
        {items.length === 0 ? (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>No data for this filter.</p>
        ) : items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col items-center justify-end gap-3 sm:min-w-[72px] sm:flex-1">
            <p className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-stone-600'}`}>{item.value}</p>
            <div className={`flex h-32 w-full items-end rounded-t-2xl sm:h-48 ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
              <div
                className={`w-full rounded-t-2xl ${colorClass}`}
                style={{ height: `${Math.max((item.value / max) * 100, item.value ? 8 : 0)}%` }}
              />
            </div>
            <p className={`mobile-safe-wrap w-full text-center text-[11px] leading-tight sm:text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} title={item.label}>{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChartCard({
  title,
  items,
  darkMode
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  darkMode: boolean;
}) {
  const width = 520;
  const height = 220;
  const padding = 24;
  const max = Math.max(...items.map((item) => item.value), 1);
  const labelStep = items.length > 10 ? 3 : items.length > 6 ? 2 : 1;
  const points = items.map((item, index) => {
    const x = items.length === 1 ? width / 2 : padding + (index * (width - (padding * 2))) / (items.length - 1);
    const y = height - padding - ((item.value / max) * (height - (padding * 2)));
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-4 sm:p-6`}>
      <h2 className={`mobile-safe-heading text-base font-bold sm:text-lg ${darkMode ? 'text-white' : 'text-stone-800'}`}>{title}</h2>
      {items.length === 0 ? (
        <p className={`mt-6 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>No data for this filter.</p>
      ) : (
        <>
          <div className="mt-6">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
              {[0, 1, 2, 3, 4].map((step) => {
                const y = padding + (step * (height - (padding * 2))) / 4;
                return (
                  <line
                    key={step}
                    x1={padding}
                    x2={width - padding}
                    y1={y}
                    y2={y}
                    stroke={darkMode ? '#374151' : '#e7e5e4'}
                    strokeDasharray="4 6"
                  />
                );
              })}
              <polyline
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
              {items.map((item, index) => {
                const x = items.length === 1 ? width / 2 : padding + (index * (width - (padding * 2))) / (items.length - 1);
                const y = height - padding - ((item.value / max) * (height - (padding * 2)));
                return (
                  <g key={item.label}>
                    <circle cx={x} cy={y} r="5" fill="#0ea5e9" />
                    {(index % labelStep === 0 || index === items.length - 1) ? (
                      <text x={x} y={height - 6} textAnchor="middle" fontSize="10" fill={darkMode ? '#9ca3af' : '#78716c'}>
                        {item.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.label} className={`rounded-2xl border px-3 py-2 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                <p className={`mobile-safe-wrap text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.label}</p>
                <p className={`mt-1 text-lg font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RankedBreakdownCard({
  title,
  items,
  darkMode,
  colorClass,
  onItemClick,
  activeLabel
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  darkMode: boolean;
  colorClass: string;
  onItemClick?: (label: string) => void;
  activeLabel?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-4 sm:p-6`}>
      <h2 className={`mobile-safe-heading text-base font-bold sm:text-lg ${darkMode ? 'text-white' : 'text-stone-800'}`}>{title}</h2>
      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>No data for this filter.</p>
        ) : items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onItemClick?.(item.label)}
            className={`block w-full rounded-2xl px-2 py-2 text-left transition ${
              onItemClick
                ? darkMode
                  ? activeLabel === item.label ? 'bg-gray-900' : 'hover:bg-gray-900/70'
                  : activeLabel === item.label ? 'bg-stone-100' : 'hover:bg-stone-50'
                : ''
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className={`mobile-safe-wrap text-sm ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>{item.label}</p>
              <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.value}</span>
            </div>
            <div className={`h-2.5 overflow-hidden rounded-full ${darkMode ? 'bg-gray-900' : 'bg-stone-100'}`}>
              <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AnalyticsStatusModal({
  darkMode,
  status,
  students,
  loading,
  onClose,
  onCopy
}: {
  darkMode: boolean;
  status: AttendanceStatus;
  students: AttendanceAnalyticsStudentDetail[];
  loading: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className={`max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl border ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'}`}>
        <div className={`flex items-start justify-between gap-4 border-b p-6 ${darkMode ? 'border-gray-700' : 'border-stone-200'}`}>
          <div>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{status} Students</h2>
            <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{students.length} student{students.length === 1 ? '' : 's'} matched in the current analytics filter.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              disabled={loading}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ${darkMode ? 'bg-gray-900 text-white hover:bg-gray-700 disabled:bg-gray-900/60' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:bg-stone-100'}`}
            >
              Copy
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-2xl p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-stone-600 hover:bg-stone-100'}`}
            >
              <AttendanceIcon name="close" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(85vh-96px)] overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={`flex items-center gap-4 rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                  <Skeleton className="h-14 w-14 rounded-full" darkMode={darkMode} />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40" darkMode={darkMode} />
                    <Skeleton className="mt-2 h-3 w-24" darkMode={darkMode} />
                  </div>
                  <Skeleton className="h-8 w-28 rounded-xl" darkMode={darkMode} />
                </div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>No students found for this status and filter combination.</p>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <div key={student.memberId} className={`flex items-center gap-4 rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                  <ProfileImage
                    src={student.profilePictureURL || ''}
                    alt={student.memberName}
                    size={56}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`mobile-safe-wrap font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{student.memberName}</p>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{student.memberId}</p>
                    <p className={`mobile-safe-wrap mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>
                      {student.records.map((record) => record.eventLabel || record.eventId).join(' • ')}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'Present' ? 'bg-emerald-100 text-emerald-700' : status === 'Late' ? 'bg-amber-100 text-amber-700' : status === 'Excused' ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}`}>
                    {student.records.length} record{student.records.length === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomDropdown({
  name,
  options,
  value,
  placeholder = 'Select an option',
  onChange,
  darkMode = false,
  renderSelected,
  renderOption
}: {
  name: string;
  options: DropdownOption[];
  value: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  darkMode?: boolean;
  renderSelected?: (option: DropdownOption) => React.ReactNode;
  renderOption?: (option: DropdownOption, selected: boolean) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value || 'empty'}`} value={option.value}>
            {option.description ? `${option.label} - ${option.description}` : option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition ${
          darkMode
            ? `border-gray-600 bg-gray-700 text-white ${isOpen ? 'ring-2 ring-gray-400' : 'hover:border-gray-500'}`
            : `border-stone-300 bg-white text-stone-900 ${isOpen ? 'ring-2 ring-stone-500' : 'hover:border-stone-400'}`
        }`}
      >
        <div className="min-w-0 flex-1">
          {selectedOption ? (
            renderSelected ? renderSelected(selectedOption) : <span className="block truncate">{selectedOption.label}</span>
          ) : (
            <span className={`block truncate ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{placeholder}</span>
          )}
        </div>
        <AttendanceIcon
          name="expand_more"
          className={`shrink-0 transition-transform ${darkMode ? 'text-gray-300' : 'text-stone-500'} ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className={`absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border shadow-2xl ${darkMode ? 'border-gray-600 bg-gray-800' : 'border-stone-200 bg-white'}`}>
          <div className="max-h-[min(18rem,40vh)] overflow-y-auto py-2">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={`${name}-option-${option.value || 'empty'}`}
                  type="button"
                  onClick={() => {
                    onChange?.(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-3 text-left transition ${
                    darkMode
                      ? isSelected ? 'bg-gray-700' : 'hover:bg-gray-700/70'
                      : isSelected ? 'bg-stone-100' : 'hover:bg-stone-50'
                  }`}
                  title={option.description ? `${option.label} - ${option.description}` : option.label}
                >
                  <div className="min-w-0 flex-1">
                    {renderOption ? renderOption(option, isSelected) : (
                      <>
                        <div className={`truncate ${darkMode ? 'text-white' : 'text-stone-900'}`}>{option.label}</div>
                        {option.description ? (
                          <div className={`truncate text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{option.description}</div>
                        ) : null}
                      </>
                    )}
                  </div>
                  {isSelected ? <AttendanceIcon name="check" className={darkMode ? 'text-gray-200' : 'text-stone-700'} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function getCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function setCache(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore cache failures.
  }
}

async function getAttendanceConfig(userId: string) {
  const response = await fetch(`${ATTENDANCE_GAS_URL}?action=getAttendanceConfig&userId=${encodeURIComponent(userId)}`);
  return response.json();
}

async function postAttendance(payload: unknown) {
  const response = await fetch(ATTENDANCE_GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function getAttendanceDirectoryProfile(userId: string) {
  const response = await fetch(ATTENDANCE_DIRECTORY_GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({ action: 'getUserProfile', idNumber: userId })
  });
  return response.json();
}

function isLikelyNetworkFailure(error: unknown) {
  return error instanceof TypeError || !navigator.onLine;
}

function createQueueId() {
  return `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildLookupKey(userId: string) {
  return `${ATTENDANCE_DIRECTORY_CACHE_PREFIX}${userId}`;
}

function buildOfflineQueueKey(userId: string) {
  return `${ATTENDANCE_OFFLINE_QUEUE_PREFIX}${userId}`;
}

export default function AttendancePage({ onBack, darkMode, user, addToast, removeToast }: AttendancePageProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingScan, setResolvingScan] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [context, setContext] = useState<AttendancePageContext | null>(null);
  const [activeTab, setActiveTab] = useState<'capture' | 'my_qr' | 'transparency' | 'analytics'>('capture');
  const [recordMode, setRecordMode] = useState<AttendanceRecordMode>('whole_day');
  const [selectedSessionKey, setSelectedSessionKey] = useState<'morning' | 'afternoon' | ''>('');
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('Present');
  const [scannedQrText, setScannedQrText] = useState('');
  const [resolvedMember, setResolvedMember] = useState<AttendanceScannedMember | null>(null);
  const [pendingScan, setPendingScan] = useState<AttendancePendingScan | null>(null);
  const [continuousScanEnabled, setContinuousScanEnabled] = useState(false);
  const [directoryCache, setDirectoryCache] = useState<AttendanceDirectoryCache>({});
  const [offlineQueue, setOfflineQueue] = useState<AttendanceOfflineQueueItem[]>([]);
  const [syncingOfflineQueue, setSyncingOfflineQueue] = useState(false);
  const [scannerBusy, setScannerBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [expandedRecordDates, setExpandedRecordDates] = useState<Record<string, boolean>>({});
  const [analyticsFilterType, setAnalyticsFilterType] = useState<AnalyticsFilterType>('all');
  const [analyticsSelectedDate, setAnalyticsSelectedDate] = useState('');
  const [analyticsSelectedClass, setAnalyticsSelectedClass] = useState('');
  const [analyticsSelectedEventId, setAnalyticsSelectedEventId] = useState('');
  const [analyticsRangeStart, setAnalyticsRangeStart] = useState('');
  const [analyticsRangeEnd, setAnalyticsRangeEnd] = useState('');
  const [analyticsStatusModal, setAnalyticsStatusModal] = useState<AttendanceStatus | null>(null);
  const [analyticsStatusProfiles, setAnalyticsStatusProfiles] = useState<Record<string, AttendanceUser>>({});
  const [analyticsStatusModalLoading, setAnalyticsStatusModalLoading] = useState(false);

  const cacheKey = user ? `manual_attendance_context_${user.idNumber}` : '';
  const lookupCacheKey = user ? buildLookupKey(user.idNumber) : '';
  const offlineQueueKey = user ? buildOfflineQueueKey(user.idNumber) : '';
  const capture = context?.capture;
  const schedules = capture?.schedules || [];
  const myRecords = context?.myRecords || [];
  const canEdit = Boolean(context?.canEdit);
  const canViewAnalytics = Boolean(context?.canViewAnalytics);
  const myQrCodeValue = context?.userProfile?.qrCodeValue || user?.qrCodeValue || '';
  const myDisplayName = context?.userProfile?.fullName || user?.fullName || user?.name || 'Member';
  const initialFetchRef = useRef(false);
  const memberSnapshots = context?.members || [];

  const resolvedTargets = useMemo(() => {
    if (recordMode === 'whole_day') return schedules;
    if (recordMode === 'session') {
      return schedules.filter((schedule) => schedule.sessionKey === selectedSessionKey);
    }
    return schedules.filter((schedule) => schedule.courseCode === selectedCourseCode);
  }, [recordMode, schedules, selectedSessionKey, selectedCourseCode]);

  const existingStatusesForResolvedMember = useMemo(() => {
    if (!resolvedMember) return [];
    const memberSnapshot = (context?.members || []).find((member) => member.memberId === resolvedMember.memberId);
    if (!memberSnapshot) return [];

    return resolvedTargets
      .map((target) => {
        const status = memberSnapshot.statuses?.[target.eventId];
        return status ? { eventId: target.eventId, label: target.label || target.eventId, status } : null;
      })
      .filter(Boolean) as Array<{ eventId: string; label: string; status: AttendanceStatus }>;
  }, [context?.members, resolvedMember, resolvedTargets]);

  const groupedMyRecords = useMemo<AttendanceRecordDayGroup[]>(() => {
    const grouped = new Map<string, AttendanceRecord[]>();

    myRecords.forEach((record) => {
      const dateKey = getAttendanceRecordDateKey(record);
      const current = grouped.get(dateKey) || [];
      current.push(record);
      grouped.set(dateKey, current);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, records]) => ({
        dateKey,
        displayDate: formatAttendanceGroupDate(dateKey),
        records: records.slice().sort((a, b) => a.eventId.localeCompare(b.eventId))
      }));
  }, [myRecords]);

  const analyticsEventMeta = useMemo(() => {
    const scheduleByEvent = new Map(schedules.map((schedule) => [schedule.eventId, schedule]));
    const byEvent = new Map<string, AttendanceAnalyticsEventMeta>();

    memberSnapshots.forEach((member) => {
      Object.keys(member.statuses || {}).forEach((eventId) => {
        if (!eventId || byEvent.has(eventId)) return;
        byEvent.set(eventId, parseAttendanceEventMeta(eventId, scheduleByEvent.get(eventId)));
      });
    });

    return Array.from(byEvent.values()).sort((a, b) =>
      b.dateKey.localeCompare(a.dateKey) ||
      a.courseCode.localeCompare(b.courseCode) ||
      a.startTime.localeCompare(b.startTime)
    );
  }, [memberSnapshots, schedules]);

  const analyticsRecords = useMemo<AttendanceAnalyticsRecord[]>(() => {
    const metaByEvent = new Map(analyticsEventMeta.map((meta) => [meta.eventId, meta]));
    const records: AttendanceAnalyticsRecord[] = [];

    memberSnapshots.forEach((member) => {
      Object.entries(member.statuses || {}).forEach(([eventId, status]) => {
        if (!status) return;
        const meta = metaByEvent.get(eventId) || parseAttendanceEventMeta(eventId);
        records.push({
          memberId: member.memberId,
          memberName: member.name,
          eventId,
          eventLabel: meta.label,
          status,
          dateKey: meta.dateKey,
          courseCode: meta.courseCode,
          courseName: meta.courseName,
          sessionKey: meta.sessionKey
        });
      });
    });

    return records;
  }, [analyticsEventMeta, memberSnapshots]);

  const analyticsDateOptions = useMemo<DropdownOption[]>(() => (
    analyticsEventMeta
      .map((meta) => meta.dateKey)
      .filter((value, index, array) => value && array.indexOf(value) === index)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => ({
        value: dateKey,
        label: formatAttendanceGroupDate(dateKey)
      }))
  ), [analyticsEventMeta]);

  const analyticsClassOptions = useMemo<DropdownOption[]>(() => (
    analyticsEventMeta
      .reduce<Array<{ value: string; label: string; description?: string }>>((accumulator, meta) => {
        if (!meta.courseCode || accumulator.some((item) => item.value === meta.courseCode)) return accumulator;
        accumulator.push({
          value: meta.courseCode,
          label: meta.courseCode,
          description: meta.courseName
        });
        return accumulator;
      }, [])
      .sort((a, b) => a.label.localeCompare(b.label))
  ), [analyticsEventMeta]);

  const analyticsEventOptions = useMemo<DropdownOption[]>(() => (
    analyticsEventMeta.map((meta) => ({
      value: meta.eventId,
      label: meta.courseCode,
      description: `${meta.displayDate} | ${meta.startTime}${meta.endTime ? ` - ${meta.endTime}` : ''}`
    }))
  ), [analyticsEventMeta]);

  const filteredAnalyticsRecords = useMemo(() => {
    return analyticsRecords.filter((record) => {
      if (analyticsFilterType === 'specific_date' && analyticsSelectedDate) {
        return record.dateKey === analyticsSelectedDate;
      }
      if (analyticsFilterType === 'specific_class' && analyticsSelectedClass) {
        return record.courseCode === analyticsSelectedClass;
      }
      if (analyticsFilterType === 'specific_event' && analyticsSelectedEventId) {
        return record.eventId === analyticsSelectedEventId;
      }
      if (analyticsFilterType === 'date_range') {
        if (analyticsRangeStart && record.dateKey < analyticsRangeStart) return false;
        if (analyticsRangeEnd && record.dateKey > analyticsRangeEnd) return false;
      }
      return true;
    });
  }, [
    analyticsFilterType,
    analyticsRangeEnd,
    analyticsRangeStart,
    analyticsRecords,
    analyticsSelectedClass,
    analyticsSelectedDate,
    analyticsSelectedEventId
  ]);

  const analyticsSummary = useMemo(() => {
    const byStatusMap = new Map<string, number>();
    const byCourseMap = new Map<string, number>();
    const byDateMap = new Map<string, number>();
    const bySessionMap = new Map<string, number>();
    const byEventMap = new Map<string, number>();
    const studentIds = new Set<string>();
    const sessionIds = new Set<string>();
    let attendedCount = 0;

    filteredAnalyticsRecords.forEach((record) => {
      studentIds.add(record.memberId);
      sessionIds.add(record.eventId);
      byStatusMap.set(record.status, (byStatusMap.get(record.status) || 0) + 1);
      byCourseMap.set(record.courseCode, (byCourseMap.get(record.courseCode) || 0) + 1);
      byDateMap.set(record.dateKey, (byDateMap.get(record.dateKey) || 0) + 1);
      bySessionMap.set(record.sessionKey === 'morning' ? 'Morning' : 'Afternoon', (bySessionMap.get(record.sessionKey === 'morning' ? 'Morning' : 'Afternoon') || 0) + 1);
      byEventMap.set(record.eventLabel, (byEventMap.get(record.eventLabel) || 0) + 1);
      if (record.status !== 'Absent') attendedCount++;
    });

    const byStatus = STATUS_OPTIONS.map((status) => ({ label: status, value: byStatusMap.get(status) || 0 }));
    const byCourse = summarizeChartItems(Array.from(byCourseMap.entries()).map(([label, value]) => ({ label, value }))).slice(0, 8);
    const byDate = Array.from(byDateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, value]) => ({ label: dateKey.slice(5), value }));
    const bySession = summarizeChartItems(Array.from(bySessionMap.entries()).map(([label, value]) => ({ label, value })));
    const byEvent = summarizeChartItems(Array.from(byEventMap.entries()).map(([label, value]) => ({ label, value }))).slice(0, 8);
    const totalRecords = filteredAnalyticsRecords.length;

    return {
      totalRecords,
      students: studentIds.size,
      sessions: sessionIds.size,
      averagePercentage: totalRecords ? (attendedCount / totalRecords) * 100 : 0,
      byStatus,
      byCourse,
      byDate,
      bySession,
      byEvent
    };
  }, [filteredAnalyticsRecords]);

  const statusChartItems = useMemo(() => ([
    { label: 'Present', value: analyticsSummary.byStatus.find((item) => item.label === 'Present')?.value || 0, color: '#10b981' },
    { label: 'Absent', value: analyticsSummary.byStatus.find((item) => item.label === 'Absent')?.value || 0, color: '#f43f5e' },
    { label: 'Late', value: analyticsSummary.byStatus.find((item) => item.label === 'Late')?.value || 0, color: '#f59e0b' },
    { label: 'Excused', value: analyticsSummary.byStatus.find((item) => item.label === 'Excused')?.value || 0, color: '#0ea5e9' }
  ]), [analyticsSummary.byStatus]);

  const analyticsStudentsForSelectedStatus = useMemo<AttendanceAnalyticsStudentDetail[]>(() => {
    if (!analyticsStatusModal) return [];

    const grouped = new Map<string, AttendanceAnalyticsStudentDetail>();
    filteredAnalyticsRecords
      .filter((record) => record.status === analyticsStatusModal)
      .forEach((record) => {
        const existing = grouped.get(record.memberId);
        if (existing) {
          existing.records.push(record);
          return;
        }

        const profile = analyticsStatusProfiles[record.memberId];
        grouped.set(record.memberId, {
          memberId: record.memberId,
          memberName: profile?.fullName || profile?.name || record.memberName,
          status: analyticsStatusModal,
          profilePictureURL: profile?.profilePictureURL,
          records: [record]
        });
      });

    return Array.from(grouped.values()).sort((a, b) =>
      a.memberName.localeCompare(b.memberName) || a.memberId.localeCompare(b.memberId)
    );
  }, [analyticsStatusModal, analyticsStatusProfiles, filteredAnalyticsRecords]);

  useEffect(() => {
    setExpandedRecordDates((current) => {
      const next: Record<string, boolean> = {};
      groupedMyRecords.forEach((group, index) => {
        next[group.dateKey] = current[group.dateKey] ?? index === 0;
      });
      return next;
    });
  }, [groupedMyRecords]);

  useEffect(() => {
    if (!analyticsDateOptions.length) {
      if (analyticsSelectedDate) setAnalyticsSelectedDate('');
      return;
    }
    if (!analyticsDateOptions.some((option) => option.value === analyticsSelectedDate)) {
      setAnalyticsSelectedDate(analyticsDateOptions[0].value);
    }
  }, [analyticsDateOptions, analyticsSelectedDate]);

  useEffect(() => {
    if (!analyticsClassOptions.length) {
      if (analyticsSelectedClass) setAnalyticsSelectedClass('');
      return;
    }
    if (!analyticsClassOptions.some((option) => option.value === analyticsSelectedClass)) {
      setAnalyticsSelectedClass(analyticsClassOptions[0].value);
    }
  }, [analyticsClassOptions, analyticsSelectedClass]);

  useEffect(() => {
    if (!analyticsEventOptions.length) {
      if (analyticsSelectedEventId) setAnalyticsSelectedEventId('');
      return;
    }
    if (!analyticsEventOptions.some((option) => option.value === analyticsSelectedEventId)) {
      setAnalyticsSelectedEventId(analyticsEventOptions[0].value);
    }
  }, [analyticsEventOptions, analyticsSelectedEventId]);

  useEffect(() => {
    if (analyticsFilterType !== 'date_range') return;
    if (!analyticsRangeStart && analyticsDateOptions[analyticsDateOptions.length - 1]?.value) {
      setAnalyticsRangeStart(analyticsDateOptions[analyticsDateOptions.length - 1].value);
    }
    if (!analyticsRangeEnd && analyticsDateOptions[0]?.value) {
      setAnalyticsRangeEnd(analyticsDateOptions[0].value);
    }
  }, [analyticsDateOptions, analyticsFilterType, analyticsRangeEnd, analyticsRangeStart]);

  useEffect(() => {
    const sessionOptions = capture?.sessionOptions || [];
    if (!sessionOptions.length) {
      if (selectedSessionKey) setSelectedSessionKey('');
      return;
    }
    if (!sessionOptions.some((option) => option.key === selectedSessionKey)) {
      setSelectedSessionKey(sessionOptions[0].key);
    }
  }, [capture?.sessionOptions, selectedSessionKey]);

  useEffect(() => {
    const courseOptions = capture?.courseOptions || [];
    if (!courseOptions.length) {
      if (selectedCourseCode) setSelectedCourseCode('');
      return;
    }
    if (!courseOptions.some((option) => option.courseCode === selectedCourseCode)) {
      setSelectedCourseCode(courseOptions[0].courseCode);
    }
  }, [capture?.courseOptions, selectedCourseCode]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastType, duration = 3000) => {
    const id = addToast(message, type);
    setTimeout(() => removeToast(id), duration);
    return id;
  }, [addToast, removeToast]);

  const handleOpenAnalyticsStatusModal = useCallback(async (label: string) => {
    if (!STATUS_OPTIONS.includes(label as AttendanceStatus)) return;

    const nextStatus = label as AttendanceStatus;
    setAnalyticsStatusModal(nextStatus);

    const memberIds = Array.from(new Set(
      filteredAnalyticsRecords
        .filter((record) => record.status === nextStatus)
        .map((record) => record.memberId)
        .filter(Boolean)
    ));

    const missingIds = memberIds.filter((memberId) => !analyticsStatusProfiles[memberId]);
    if (!missingIds.length || !navigator.onLine) return;

    setAnalyticsStatusModalLoading(true);
    try {
      const results = await Promise.all(
        missingIds.map(async (memberId) => {
          try {
            const result = await getAttendanceDirectoryProfile(memberId);
            return result?.success && result.user ? [memberId, result.user] as const : null;
          } catch {
            return null;
          }
        })
      );

      setAnalyticsStatusProfiles((current) => {
        const next = { ...current };
        results.forEach((entry) => {
          if (!entry) return;
          next[entry[0]] = entry[1];
        });
        return next;
      });
    } finally {
      setAnalyticsStatusModalLoading(false);
    }
  }, [analyticsStatusProfiles, filteredAnalyticsRecords]);

  const handleCopyAnalyticsStatusSummary = useCallback(async () => {
    if (!analyticsStatusModal) return;

    const lines = [
      `Attendance Status Summary: ${analyticsStatusModal}`,
      `Students: ${analyticsStudentsForSelectedStatus.length}`,
      `Records: ${analyticsStudentsForSelectedStatus.reduce((sum, student) => sum + student.records.length, 0)}`,
      ''
    ];

    analyticsStudentsForSelectedStatus.forEach((student, index) => {
      lines.push(
        `${index + 1}. ${student.memberName} (${student.memberId})`,
        `   Records: ${student.records.map((record) => record.eventLabel || record.eventId).join('; ')}`
      );
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast(`Copied ${analyticsStatusModal} summary`, 'success');
    } catch {
      showToast('Failed to copy analytics summary', 'error');
    }
  }, [analyticsStatusModal, analyticsStudentsForSelectedStatus, showToast]);

  const persistDirectoryCache = useCallback(async (nextCache: AttendanceDirectoryCache) => {
    setDirectoryCache(nextCache);
    if (lookupCacheKey) {
      await setSecureSessionItem(lookupCacheKey, nextCache);
    }
  }, [lookupCacheKey]);

  const persistOfflineQueue = useCallback(async (nextQueue: AttendanceOfflineQueueItem[]) => {
    setOfflineQueue(nextQueue);
    if (offlineQueueKey) {
      await setSecureLocalItem(offlineQueueKey, nextQueue);
    }
  }, [offlineQueueKey]);

  const fetchContext = useCallback(async (force = false) => {
    if (!user?.idNumber) {
      setLoading(false);
      return;
    }

    if (!force && cacheKey) {
      const cached = getCache<AttendancePageContext>(cacheKey);
      if (cached?.success) {
        setContext(cached);
        setLoading(false);
      }
    }

    if (!navigator.onLine) {
      if (!cacheKey || !getCache<AttendancePageContext>(cacheKey)?.success) {
        showToast('You are offline. Attendance is using cached data only.', 'info');
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await getAttendanceConfig(user.idNumber);
      if (!result.success) throw new Error(result.error || 'Failed to load attendance data');
      setContext(result);
      if (cacheKey) setCache(cacheKey, result);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load attendance data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, showToast, user?.idNumber]);

  const handleMyQrSaved = useCallback((qrText: string) => {
    const normalizedQrText = qrText.trim();
    if (!normalizedQrText) return;

    setContext((prev) => {
      const next: AttendancePageContext = {
        ...(prev || { success: true }),
        userProfile: {
          idNumber: prev?.userProfile?.idNumber || user?.idNumber || '',
          name: prev?.userProfile?.name || user?.name,
          fullName: prev?.userProfile?.fullName || user?.fullName || user?.name,
          position: prev?.userProfile?.position || user?.position,
          profilePictureURL: prev?.userProfile?.profilePictureURL || user?.profilePictureURL,
          qrCodeValue: normalizedQrText
        }
      };

      if (cacheKey) setCache(cacheKey, next);
      return next;
    });

    showToast('Your QR code has been linked to this account.', 'success');
  }, [cacheKey, showToast, user]);

  useEffect(() => {
    initialFetchRef.current = false;
  }, [user?.idNumber]);

  useEffect(() => {
    if (!user?.idNumber || initialFetchRef.current) return;
    initialFetchRef.current = true;
    void fetchContext();
  }, [user?.idNumber, fetchContext]);

  useEffect(() => {
    let cancelled = false;

    const hydrateCaches = async () => {
      if (!lookupCacheKey || !offlineQueueKey) {
        if (!cancelled) {
          setDirectoryCache({});
          setOfflineQueue([]);
        }
        return;
      }

      const [cachedDirectory, cachedQueue] = await Promise.all([
        getSecureSessionItem<AttendanceDirectoryCache>(lookupCacheKey),
        getSecureLocalItem<AttendanceOfflineQueueItem[]>(offlineQueueKey)
      ]);

      if (cancelled) return;
      setDirectoryCache(cachedDirectory || {});
      setOfflineQueue(cachedQueue || []);
    };

    void hydrateCaches();

    return () => {
      cancelled = true;
    };
  }, [lookupCacheKey, offlineQueueKey]);

  const buildSubmissionPayload = useCallback((qrText: string, eventIds: string[]) => ({
    action: 'recordScannedAttendance',
    userId: user?.idNumber,
    qrText,
    recordMode,
    sessionKey: recordMode === 'session' ? selectedSessionKey : '',
    courseCode: recordMode === 'course' ? selectedCourseCode : '',
    status: selectedStatus,
    eventIds
  }), [recordMode, selectedCourseCode, selectedSessionKey, selectedStatus, user?.idNumber]);

  const enqueueOfflineRecord = useCallback(async (member: AttendanceScannedMember, qrText: string) => {
    const eventIds = resolvedTargets.map((target) => target.eventId);
    if (!eventIds.length) {
      throw new Error('No schedules matched the selected recording mode');
    }

    const nextItem: AttendanceOfflineQueueItem = {
      queueId: createQueueId(),
      queuedAt: new Date().toISOString(),
      qrText,
      member,
      recordMode,
      sessionKey: recordMode === 'session' ? selectedSessionKey : '',
      courseCode: recordMode === 'course' ? selectedCourseCode : '',
      status: selectedStatus,
      eventIds,
      eventLabels: resolvedTargets.map((target) => target.label || target.eventId)
    };

    await persistOfflineQueue([...offlineQueue, nextItem]);
    setResolvedMember(member);
    setScannedQrText(qrText);
    showToast(`Saved offline for ${member.name}. It will sync when internet returns.`, 'info', 4500);
  }, [
    offlineQueue,
    persistOfflineQueue,
    recordMode,
    resolvedTargets,
    selectedCourseCode,
    selectedSessionKey,
    selectedStatus,
    showToast
  ]);

  const syncOfflineQueue = useCallback(async () => {
    if (!user?.idNumber || !isOnline || syncingOfflineQueue || !offlineQueue.length) return;

    setSyncingOfflineQueue(true);
    let remaining = [...offlineQueue];
    let syncedCount = 0;

    try {
      for (const item of offlineQueue) {
        const result = await postAttendance({
          action: 'recordScannedAttendance',
          userId: user.idNumber,
          qrText: item.qrText,
          recordMode: item.recordMode,
          sessionKey: item.sessionKey,
          courseCode: item.courseCode,
          status: item.status,
          eventIds: item.eventIds
        });

        if (!result.success) {
          break;
        }

        remaining = remaining.filter((queued) => queued.queueId !== item.queueId);
        syncedCount++;
      }
    } catch (error) {
      if (!isLikelyNetworkFailure(error)) {
        showToast(error instanceof Error ? error.message : 'Failed to sync queued attendance', 'error');
      }
    } finally {
      await persistOfflineQueue(remaining);
      if (syncedCount > 0) {
        showToast(`Synced ${syncedCount} queued attendance record${syncedCount === 1 ? '' : 's'}.`, 'success', 4500);
        await fetchContext(true);
      }
      setSyncingOfflineQueue(false);
    }
  }, [fetchContext, isOnline, offlineQueue, persistOfflineQueue, showToast, syncingOfflineQueue, user?.idNumber]);

  useEffect(() => {
    if (isOnline && offlineQueue.length) {
      void syncOfflineQueue();
    }
  }, [isOnline, offlineQueue.length, syncOfflineQueue]);

  const resolveMemberFromScan = useCallback(async (qrText: string) => {
    const normalizedQrText = qrText.trim();
    if (!normalizedQrText) {
      throw new Error('QR text is empty');
    }

    const cachedMember = directoryCache[normalizedQrText];
    if (cachedMember) {
      return cachedMember;
    }

    if (!user?.idNumber) {
      throw new Error('Missing officer account');
    }

    if (!navigator.onLine) {
      throw new Error('No cached student was found for this QR while offline');
    }

    const result = await postAttendance({
      action: 'resolveScannedAttendance',
      userId: user.idNumber,
      qrText: normalizedQrText
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to resolve scanned student');
    }

    const nextMember = result.member as AttendanceScannedMember;
    const nextCache = { ...directoryCache, [normalizedQrText]: nextMember };
    await persistDirectoryCache(nextCache);
    return nextMember;
  }, [directoryCache, persistDirectoryCache, user?.idNumber]);

  const submitAttendanceRecord = useCallback(async (member: AttendanceScannedMember, qrText: string) => {
    if (!user?.idNumber) throw new Error('Missing user ID');
    if (!capture?.success) throw new Error(capture?.error || 'Unable to load attendance targets');

    const eventIds = resolvedTargets.map((target) => target.eventId);
    if (!eventIds.length) {
      throw new Error('No schedules matched the selected recording mode');
    }

    setResolvedMember(member);
    setScannedQrText(qrText);

    if (!navigator.onLine) {
      await enqueueOfflineRecord(member, qrText);
      return 'queued';
    }

    const loadingId = addToast('Saving attendance...', 'loading');

    try {
      const result = await postAttendance(buildSubmissionPayload(qrText, eventIds));
      if (!result.success) {
        throw new Error(result.error || 'Failed to save attendance');
      }

      removeToast(loadingId);
      showToast(`Recorded ${selectedStatus} for ${result.member?.name || member.name}`, 'success');
      await fetchContext(true);
      return 'saved';
    } catch (error) {
      removeToast(loadingId);

      if (isLikelyNetworkFailure(error)) {
        await enqueueOfflineRecord(member, qrText);
        return 'queued';
      }

      throw error;
    }
  }, [
    addToast,
    buildSubmissionPayload,
    capture?.error,
    capture?.success,
    enqueueOfflineRecord,
    fetchContext,
    removeToast,
    resolvedTargets,
    selectedStatus,
    showToast,
    user?.idNumber
  ]);

  const handleScanSuccess = useCallback(async (qrText: string) => {
    if (!user?.idNumber) return;

    setShowScanner(false);
    setResolvingScan(true);

    try {
      const member = await resolveMemberFromScan(qrText);
      const existingStatuses = ((context?.members || []).find((item) => item.memberId === member.memberId)?.statuses) || {};
      const pendingOverwriteStatuses = resolvedTargets
        .map((target) => {
          const status = existingStatuses[target.eventId];
          return status ? { eventId: target.eventId, label: target.label || target.eventId, status } : null;
        })
        .filter(Boolean) as Array<{ eventId: string; label: string; status: AttendanceStatus }>;

      setScannedQrText(qrText);
      setResolvedMember(member);

      if (pendingOverwriteStatuses.length) {
        setPendingScan({
          qrText,
          member,
          existingStatuses: pendingOverwriteStatuses
        });
        return;
      }

      setSubmitting(true);
      await submitAttendanceRecord(member, qrText);
    } catch (error) {
      setScannedQrText('');
      setResolvedMember(null);
      showToast(error instanceof Error ? error.message : 'Failed to resolve scanned student', 'error');
    } finally {
      setSubmitting(false);
      setResolvingScan(false);
    }
  }, [context?.members, resolveMemberFromScan, resolvedTargets, showToast, submitAttendanceRecord, user?.idNumber]);

  const handleContinuousDetection = useCallback(async (qrText: string) => {
    if (!user?.idNumber || scannerBusy || submitting) return;

    setScannerBusy(true);

    try {
      const member = await resolveMemberFromScan(qrText);
      await submitAttendanceRecord(member, qrText);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to process attendance scan', 'error');
    } finally {
      setScannerBusy(false);
    }
  }, [resolveMemberFromScan, scannerBusy, showToast, submitAttendanceRecord, submitting, user?.idNumber]);

  const confirmPendingScan = useCallback(async () => {
    if (!pendingScan) return;

    setSubmitting(true);

    try {
      await submitAttendanceRecord(pendingScan.member, pendingScan.qrText);
      setPendingScan(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save attendance', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [pendingScan, showToast, submitAttendanceRecord]);

  const cancelPendingScan = useCallback(() => {
    setPendingScan(null);
    setResolvedMember(null);
    setScannedQrText('');
  }, []);

  const handleManualSubmit = useCallback(async () => {
    if (!resolvedMember || !scannedQrText) {
      showToast('Scan a student QR first', 'error');
      return;
    }

    setSubmitting(true);

    try {
      await submitAttendanceRecord(resolvedMember, scannedQrText);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save attendance', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [resolvedMember, scannedQrText, showToast, submitAttendanceRecord]);

  const tabs = [
    { key: 'capture' as const, label: 'Capture', icon: 'fact_check' },
    { key: 'my_qr' as const, label: 'My QR Code', icon: 'qr_code_2' },
    { key: 'transparency' as const, label: 'Transparency', icon: 'visibility' },
    ...(canViewAnalytics ? [{ key: 'analytics' as const, label: 'Analytics', icon: 'analytics' }] : [])
  ];

  const recordModeOptions: DropdownOption[] = RECORD_MODE_OPTIONS.map((option) => ({
    value: option.key,
    label: option.label
  }));
  const analyticsFilterOptions: DropdownOption[] = ANALYTICS_FILTER_OPTIONS.map((option) => ({
    value: option.key,
    label: option.label
  }));
  const sessionDropdownOptions: DropdownOption[] = (capture?.sessionOptions || []).map((option) => ({
    value: option.key,
    label: option.label,
    description: `${option.count} schedule${option.count === 1 ? '' : 's'}`
  }));
  const courseDropdownOptions: DropdownOption[] = (capture?.courseOptions || []).map((option) => ({
    value: option.courseCode,
    label: option.courseCode,
    description: option.courseName
  }));

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-stone-50'}`}>
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-40`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className={`p-2 rounded-xl ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'}`}>
            <AttendanceIcon name="arrow_back" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
          </button>
          <div className="min-w-0">
            <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Manual Attendance</h1>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Directory-backed attendance logging with overwrite checks, continuous scan, and offline queueing.</p>
          </div>
          <button
            onClick={() => void fetchContext(true)}
            disabled={refreshing}
            className={`ml-auto p-2.5 rounded-xl ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600 disabled:bg-gray-700/70' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:bg-stone-100'}`}
          >
            <AttendanceIcon name="refresh" className={`text-xl ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {!user ? (
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-stone-200 text-stone-600'} border rounded-3xl p-8 text-center`}>
            <AttendanceIcon name="lock" className="text-4xl mb-3" />
            <p className="font-semibold">Sign in to access attendance.</p>
          </div>
        ) : loading ? (
          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} min-w-0 border rounded-3xl p-4 sm:p-6`}>
              <Skeleton className="h-6 w-40 sm:h-7 sm:w-44" darkMode={darkMode} />
              <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
                <div>
                  <Skeleton className="h-4 w-24" darkMode={darkMode} />
                  <Skeleton className="mt-2 h-12 w-full rounded-xl" darkMode={darkMode} />
                </div>
                <div>
                  <Skeleton className="h-4 w-20" darkMode={darkMode} />
                  <Skeleton className="mt-2 h-12 w-full rounded-xl" darkMode={darkMode} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Skeleton className="h-12 rounded-2xl" darkMode={darkMode} />
                  <Skeleton className="h-12 rounded-2xl" darkMode={darkMode} />
                  <Skeleton className="h-12 rounded-2xl" darkMode={darkMode} />
                  <Skeleton className="h-12 rounded-2xl" darkMode={darkMode} />
                </div>
                <Skeleton className="h-16 rounded-2xl sm:h-20" darkMode={darkMode} />
                <Skeleton className="h-12 rounded-2xl" darkMode={darkMode} />
                <Skeleton className="h-28 rounded-2xl sm:h-40" darkMode={darkMode} />
              </div>
            </div>
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} min-w-0 border rounded-3xl p-4 sm:p-6`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-6 w-44 sm:h-7 sm:w-52" darkMode={darkMode} />
                  <Skeleton className="mt-2 h-4 w-full max-w-[18rem]" darkMode={darkMode} />
                </div>
                <Skeleton className="h-10 w-20 rounded-2xl sm:w-28" darkMode={darkMode} />
              </div>
              <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
                <Skeleton className="h-20 rounded-2xl sm:h-24" darkMode={darkMode} />
                <Skeleton className="h-20 rounded-2xl sm:h-24" darkMode={darkMode} />
                <Skeleton className="h-20 rounded-2xl sm:h-24" darkMode={darkMode} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
                    activeTab === tab.key
                      ? darkMode ? 'bg-cyan-600 text-white' : 'bg-stone-800 text-white'
                      : darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <AttendanceIcon name={tab.icon} className="text-[18px]" />
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>

            {activeTab === 'capture' && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-6`}>
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Capture Settings</h2>
                  <div className="space-y-4 mt-5">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Record mode</label>
                      <CustomDropdown
                        name="attendance-record-mode"
                        value={recordMode}
                        options={recordModeOptions}
                        onChange={(value) => setRecordMode(value as AttendanceRecordMode)}
                        darkMode={darkMode}
                      />
                    </div>

                    {recordMode === 'session' && (
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Session</label>
                        <CustomDropdown
                          name="attendance-session"
                          value={selectedSessionKey}
                          options={sessionDropdownOptions}
                          placeholder="Select session"
                          onChange={(value) => setSelectedSessionKey(value as 'morning' | 'afternoon')}
                          darkMode={darkMode}
                        />
                      </div>
                    )}

                    {recordMode === 'course' && (
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Course</label>
                        <CustomDropdown
                          name="attendance-course"
                          value={selectedCourseCode}
                          options={courseDropdownOptions}
                          placeholder="Select course"
                          onChange={setSelectedCourseCode}
                          darkMode={darkMode}
                          renderSelected={(option) => (
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={`shrink-0 font-semibold ${darkMode ? 'text-white' : 'text-stone-900'}`}>{option.label}</span>
                              {option.description ? <span className={`truncate text-sm ${darkMode ? 'text-gray-400' : 'text-stone-600'}`}>{option.description}</span> : null}
                            </div>
                          )}
                          renderOption={(option) => (
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={`shrink-0 font-semibold ${darkMode ? 'text-white' : 'text-stone-900'}`}>{option.label}</span>
                              {option.description ? <span className={`truncate text-sm ${darkMode ? 'text-gray-400' : 'text-stone-600'}`}>{option.description}</span> : null}
                            </div>
                          )}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      {STATUS_OPTIONS.map((status) => (
                        <button
                          key={status}
                          onClick={() => setSelectedStatus(status)}
                          className={`px-4 py-3 rounded-2xl text-sm font-semibold ${
                            selectedStatus === status
                              ? darkMode ? 'bg-cyan-600 text-white' : 'bg-stone-800 text-white'
                              : darkMode ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          Mark {status}
                        </button>
                      ))}
                    </div>

                    <label className={`flex items-center justify-between rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                      <div>
                        <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Continuous scanning</p>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Auto-record each detected QR while the camera stays open.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setContinuousScanEnabled((value) => !value)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${continuousScanEnabled ? 'bg-emerald-500' : darkMode ? 'bg-gray-700' : 'bg-stone-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${continuousScanEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </label>

                    <button
                      onClick={() => setShowScanner(true)}
                      disabled={!canEdit || resolvingScan || !capture?.success}
                      className={`w-full px-4 py-3 rounded-2xl text-sm font-semibold ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600 disabled:bg-gray-700/60' : 'bg-stone-200 text-stone-700 hover:bg-stone-300 disabled:bg-stone-100'}`}
                    >
                      {resolvingScan
                        ? 'Resolving scanned student...'
                        : continuousScanEnabled
                          ? 'Start continuous scan'
                          : resolvedMember
                            ? 'Scan another student'
                            : 'Scan student QR'}
                    </button>

                    <div className={`rounded-2xl p-4 ${darkMode ? 'bg-gray-900 border border-gray-700 text-stone-300' : 'bg-stone-50 border border-stone-200 text-stone-700'}`}>
                      <p className="font-semibold">Summary</p>
                      <p className="text-sm mt-2">Today: {capture?.date || 'None'}{capture?.dayOfWeek ? ` (${capture.dayOfWeek})` : ''}</p>
                      <p className="text-sm mt-1">Schedules matched: {resolvedTargets.length}</p>
                      <p className="text-sm mt-1">Scanned student: {resolvedMember?.name || 'None'}</p>
                      <p className="text-sm mt-1">Existing marks on targets: {existingStatusesForResolvedMember.length}</p>
                      <p className="text-sm mt-1">Cached QR lookups: {Object.keys(directoryCache).length}</p>
                      <p className="text-sm mt-1">Offline queue: {offlineQueue.length}{syncingOfflineQueue ? ' (syncing...)' : ''}</p>
                      <p className={`text-sm mt-1 ${isOnline ? 'text-emerald-500' : 'text-amber-500'}`}>{isOnline ? 'Online' : 'Offline mode active'}</p>
                      {capture && !capture.success && <p className="text-sm mt-2 text-rose-500">{capture.error}</p>}
                    </div>

                    {!canEdit && (
                      <div className={`${darkMode ? 'bg-amber-900/20 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800'} border rounded-2xl p-4 text-sm`}>
                        Only officers can submit attendance updates.
                      </div>
                    )}

                    <button
                      onClick={() => void handleManualSubmit()}
                      disabled={!canEdit || submitting || !resolvedMember || !resolvedTargets.length || Boolean(pendingScan)}
                      className={`w-full px-4 py-3 rounded-2xl text-sm font-semibold transition-colors ${
                        darkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-gray-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-stone-300'
                      }`}
                    >
                      {submitting ? 'Saving...' : continuousScanEnabled ? 'Record latest scanned student' : 'Submit Attendance'}
                    </button>
                  </div>
                </div>

                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-6`}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Capture Preview</h2>
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{resolvedTargets.length} target{resolvedTargets.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="space-y-3 mt-5">
                    {!resolvedMember ? (
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Scan a student QR to preview the member and matched schedules.</p>
                    ) : (
                      <div className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{resolvedMember.name}</p>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{resolvedMember.memberId}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-stone-200 text-stone-600'}`}>
                            {selectedStatus}
                          </span>
                        </div>
                        {(resolvedMember.course || resolvedMember.year || resolvedMember.section) && (
                          <p className={`text-sm mt-3 ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                            {[resolvedMember.course, resolvedMember.year ? `Year ${resolvedMember.year}` : '', resolvedMember.section ? `Section ${resolvedMember.section}` : ''].filter(Boolean).join(' | ')}
                          </p>
                        )}
                        {existingStatusesForResolvedMember.length > 0 && (
                          <div className={`mt-4 rounded-2xl p-3 ${darkMode ? 'bg-amber-900/20 border border-amber-800 text-amber-200' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
                            <p className="text-sm font-semibold">Existing marks will be overwritten</p>
                            <div className="mt-2 space-y-1">
                              {existingStatusesForResolvedMember.map((entry) => (
                                <p key={entry.eventId} className="text-xs">{entry.label}: {entry.status}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {offlineQueue.length > 0 && (
                      <div className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Queued offline records</p>
                          <button
                            onClick={() => void syncOfflineQueue()}
                            disabled={!isOnline || syncingOfflineQueue}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold ${darkMode ? 'bg-gray-700 text-white disabled:bg-gray-700/60' : 'bg-stone-200 text-stone-700 disabled:bg-stone-100'}`}
                          >
                            {syncingOfflineQueue ? 'Syncing...' : 'Sync now'}
                          </button>
                        </div>
                        <div className="space-y-2 mt-3">
                          {offlineQueue.slice(0, 5).map((item) => (
                            <div key={item.queueId} className={`rounded-xl px-3 py-2 ${darkMode ? 'bg-gray-800' : 'bg-white border border-stone-200'}`}>
                              <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'}`}>{item.member.name}</p>
                              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{item.status} • {item.eventLabels.length} target{item.eventLabels.length === 1 ? '' : 's'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {resolvedTargets.length === 0 ? (
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>No schedules matched your selected record mode.</p>
                    ) : resolvedTargets.map((schedule) => (
                      <div key={schedule.eventId} className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{schedule.courseCode}</p>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{schedule.courseName || schedule.courseCode}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-stone-200 text-stone-600'}`}>
                            {schedule.sessionLabel}
                          </span>
                        </div>
                        <div className="mt-4">
                          <p className={`text-sm ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>{schedule.startTime12h} - {schedule.endTime12h}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transparency' && (
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-6`}>
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>My Attendance Records</h2>
                <div className="space-y-3 mt-5">
                  {groupedMyRecords.length === 0 ? (
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>No attendance records recorded yet.</p>
                  ) : groupedMyRecords.map((group) => {
                    const isExpanded = Boolean(expandedRecordDates[group.dateKey]);
                    return (
                      <div key={group.dateKey} className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                        <button
                          type="button"
                          onClick={() => setExpandedRecordDates((current) => ({ ...current, [group.dateKey]: !current[group.dateKey] }))}
                          className="flex w-full items-center justify-between gap-3 p-4 text-left"
                        >
                          <div>
                            <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{group.displayDate}</p>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{group.records.length} record{group.records.length > 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-stone-600'}`}>
                              {isExpanded ? 'Hide details' : 'Show details'}
                            </span>
                            <AttendanceIcon
                              name="expand_more"
                              className={`text-2xl transition-transform ${darkMode ? 'text-gray-300' : 'text-stone-500'} ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className={`border-t px-4 pb-4 ${darkMode ? 'border-gray-700' : 'border-stone-200'}`}>
                            <div className="mt-4 space-y-3">
                              {group.records.map((record) => (
                                <div key={`${group.dateKey}-${record.eventId}-${record.status}`} className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-stone-200 bg-white'}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{record.eventLabel}</p>
                                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{record.eventId}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${record.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : record.status === 'Late' ? 'bg-amber-100 text-amber-700' : record.status === 'Excused' ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {record.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'my_qr' && (
              <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-6`}>
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>My QR Code</h2>
                  <div className="mt-5">
                    {!myQrCodeValue ? (
                      <div className={`${darkMode ? 'bg-amber-900/20 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800'} border rounded-2xl p-4 text-sm`}>
                        No QR code is linked to your account yet. Save your school QR first to make this tab scannable.
                      </div>
                    ) : (
                      <div className={`rounded-[2rem] border p-6 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                        <div className="mx-auto w-full max-w-[320px] rounded-[2rem] bg-white p-5 shadow-sm">
                          <QRCode
                            value={myQrCodeValue}
                            size={280}
                            level="M"
                            className="h-auto w-full"
                          />
                        </div>
                        <div className="mt-5 text-center">
                          <p className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{myDisplayName}</p>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{user?.idNumber}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-6`}>
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Scanner Preview</h2>
                  <div className="mt-5 space-y-4">
                    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                      <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Link your school QR here</p>
                      <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                        Upload or scan the QR from the USeP attendance system on this tab. Once saved, the generated QR on the left becomes the one officers scan for attendance.
                      </p>
                    </div>

                    {user?.idNumber ? (
                      <QRScanner
                        userId={user.idNumber}
                        mode="profile"
                        title="Link School QR"
                        successActionLabel="Save QR Code"
                        onSuccess={handleMyQrSaved}
                        onError={(message) => showToast(message, 'error')}
                      />
                    ) : (
                      <div className={`${darkMode ? 'bg-amber-900/20 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800'} border rounded-2xl p-4 text-sm`}>
                        Sign in again to link a QR code to your account.
                      </div>
                    )}

                    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                      <p className={`text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Linked QR text</p>
                      <p className={`mt-2 break-all text-sm ${darkMode ? 'text-gray-400' : 'text-stone-600'}`}>
                        {myQrCodeValue || 'No linked QR code found.'}
                      </p>
                    </div>

                    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
                      <p className={`text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Tips</p>
                      <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-600'}`}>Raise screen brightness and keep the QR fully visible for faster scanning.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && canViewAnalytics && (
              <div className="space-y-6">
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-3xl p-6`}>
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Analytics Dashboard</h2>
                      <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                        Filter attendance by date, class, range, or event and review summary metrics across multiple chart views.
                      </p>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${darkMode ? 'bg-gray-900 text-gray-300' : 'bg-stone-100 text-stone-600'}`}>
                      <AttendanceIcon name="filter_alt" className="text-sm" />
                      {filteredAnalyticsRecords.length} filtered records
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
                    <div>
                      <p className={`mb-2 text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Filter Type</p>
                      <CustomDropdown
                        name="analytics-filter-type"
                        options={analyticsFilterOptions}
                        value={analyticsFilterType}
                        onChange={(value) => setAnalyticsFilterType(value as AnalyticsFilterType)}
                        darkMode={darkMode}
                      />
                    </div>

                    {analyticsFilterType === 'specific_date' && (
                      <div>
                        <p className={`mb-2 text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Specific Date</p>
                        <CustomDropdown
                          name="analytics-specific-date"
                          options={analyticsDateOptions}
                          value={analyticsSelectedDate}
                          onChange={setAnalyticsSelectedDate}
                          darkMode={darkMode}
                        />
                      </div>
                    )}

                    {analyticsFilterType === 'specific_class' && (
                      <div>
                        <p className={`mb-2 text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Specific Class</p>
                        <CustomDropdown
                          name="analytics-specific-class"
                          options={analyticsClassOptions}
                          value={analyticsSelectedClass}
                          onChange={setAnalyticsSelectedClass}
                          darkMode={darkMode}
                        />
                      </div>
                    )}

                    {analyticsFilterType === 'specific_event' && (
                      <div className="lg:col-span-2">
                        <p className={`mb-2 text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Specific Event</p>
                        <CustomDropdown
                          name="analytics-specific-event"
                          options={analyticsEventOptions}
                          value={analyticsSelectedEventId}
                          onChange={setAnalyticsSelectedEventId}
                          darkMode={darkMode}
                        />
                      </div>
                    )}

                    {analyticsFilterType === 'date_range' && (
                      <>
                        <div>
                          <p className={`mb-2 text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Date Range Start</p>
                          <input
                            type="date"
                            value={analyticsRangeStart}
                            onChange={(event) => setAnalyticsRangeStart(event.target.value)}
                            className={`w-full rounded-xl border px-4 py-3 shadow-sm transition ${
                              darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-stone-300 bg-white text-stone-900'
                            }`}
                          />
                        </div>
                        <div>
                          <p className={`mb-2 text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Date Range End</p>
                          <input
                            type="date"
                            value={analyticsRangeEnd}
                            onChange={(event) => setAnalyticsRangeEnd(event.target.value)}
                            className={`w-full rounded-xl border px-4 py-3 shadow-sm transition ${
                              darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-stone-300 bg-white text-stone-900'
                            }`}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <TinyStatCard label="Average %" value={formatPercentage(analyticsSummary.averagePercentage)} accent="bg-emerald-500" darkMode={darkMode} />
                  <TinyStatCard label="Total Records" value={analyticsSummary.totalRecords} accent="bg-sky-500" darkMode={darkMode} />
                  <TinyStatCard label="Students" value={analyticsSummary.students} accent="bg-amber-500" darkMode={darkMode} />
                  <TinyStatCard label="Sessions" value={analyticsSummary.sessions} accent="bg-rose-500" darkMode={darkMode} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <DonutChartCard
                    title="Status Distribution"
                    items={statusChartItems}
                    darkMode={darkMode}
                    onItemClick={handleOpenAnalyticsStatusModal}
                    activeLabel={analyticsStatusModal || undefined}
                  />
                  <LineChartCard title="Attendance Trend by Date" items={analyticsSummary.byDate} darkMode={darkMode} />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <VerticalBarChartCard title="Records by Class" items={analyticsSummary.byCourse} darkMode={darkMode} colorClass="bg-sky-500" />
                  <VerticalBarChartCard title="Records by Session" items={analyticsSummary.bySession} darkMode={darkMode} colorClass="bg-amber-500" />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <RankedBreakdownCard title="Top Events" items={analyticsSummary.byEvent} darkMode={darkMode} colorClass="bg-emerald-500" />
                  <RankedBreakdownCard
                    title="Status Breakdown"
                    items={analyticsSummary.byStatus}
                    darkMode={darkMode}
                    colorClass="bg-rose-500"
                    onItemClick={handleOpenAnalyticsStatusModal}
                    activeLabel={analyticsStatusModal || undefined}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <QRScanner
              mode="attendance"
              continuousScan={continuousScanEnabled}
              autoSubmitOnDetect={!continuousScanEnabled}
              pauseDetection={scannerBusy || resolvingScan || submitting || Boolean(pendingScan)}
              onSuccess={(qrText) => void handleScanSuccess(qrText)}
              onDetect={(qrText) => void handleContinuousDetection(qrText)}
              onError={(message) => showToast(message, 'error')}
              onClose={() => setShowScanner(false)}
              title={continuousScanEnabled ? 'Continuous Attendance Scan' : 'Scan Attendance QR'}
            />
          </div>
        </div>
      )}

      {pendingScan && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl border p-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>
                  {pendingScan.existingStatuses.length ? 'Overwrite attendance?' : 'Confirm attendance record'}
                </h2>
                <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                  Review the student and record settings before saving.
                </p>
              </div>
              <button onClick={cancelPendingScan} className={`p-2 rounded-xl ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-stone-100 text-stone-600'}`}>
                <AttendanceIcon name="close" />
              </button>
            </div>

            <div className={`mt-5 rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
              <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{pendingScan.member.name}</p>
              <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{pendingScan.member.memberId}</p>
              {(pendingScan.member.course || pendingScan.member.year || pendingScan.member.section) && (
                <p className={`text-sm mt-3 ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>
                  {[pendingScan.member.course, pendingScan.member.year ? `Year ${pendingScan.member.year}` : '', pendingScan.member.section ? `Section ${pendingScan.member.section}` : ''].filter(Boolean).join(' | ')}
                </p>
              )}
            </div>

            <div className={`mt-4 rounded-2xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-stone-200 bg-stone-50'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Target events</p>
              <div className="space-y-2 mt-3">
                {resolvedTargets.map((target) => (
                  <div key={target.eventId} className="flex items-center justify-between gap-3">
                    <p className={`text-sm ${darkMode ? 'text-stone-300' : 'text-stone-700'}`}>{target.label || target.eventId}</p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-stone-200 text-stone-600'}`}>{selectedStatus}</span>
                  </div>
                ))}
              </div>
            </div>

            {pendingScan.existingStatuses.length > 0 && (
              <div className={`mt-4 rounded-2xl border p-4 ${darkMode ? 'border-amber-700 bg-amber-900/20 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <p className="text-sm font-semibold">Existing attendance on these targets will be replaced</p>
                <div className="space-y-1 mt-2">
                  {pendingScan.existingStatuses.map((entry) => (
                    <p key={entry.eventId} className="text-xs">{entry.label}: {entry.status}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={cancelPendingScan}
                disabled={submitting}
                className={`flex-1 px-4 py-3 rounded-2xl text-sm font-semibold ${darkMode ? 'bg-gray-700 text-white hover:bg-gray-600 disabled:bg-gray-700/60' : 'bg-stone-200 text-stone-700 hover:bg-stone-300 disabled:bg-stone-100'}`}
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmPendingScan()}
                disabled={submitting}
                className={`flex-1 px-4 py-3 rounded-2xl text-sm font-semibold text-white ${pendingScan.existingStatuses.length ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} disabled:bg-stone-400`}
              >
                {submitting ? 'Recording...' : pendingScan.existingStatuses.length ? 'Overwrite & Record' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {analyticsStatusModal && (
        <AnalyticsStatusModal
          darkMode={darkMode}
          status={analyticsStatusModal}
          students={analyticsStudentsForSelectedStatus}
          loading={analyticsStatusModalLoading}
          onClose={() => setAnalyticsStatusModal(null)}
          onCopy={() => void handleCopyAnalyticsStatusSummary()}
        />
      )}
    </div>
  );
}
