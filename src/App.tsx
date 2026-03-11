
import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useRef, useMemo } from 'react';
import Dexie from 'dexie';
import jsQR from 'jsqr';
import { useNavigate } from 'react-router-dom';
import { useUrlState } from './hooks/useUrlState';
import AttendanceFeaturePage from './components/AttendancePage';

// Global Error Boundary for debugging
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: 'red', background: '#fff' }}>
          <h1>Something went wrong.</h1>
          <pre>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

  // Global JS error handlers for debugging
  if (typeof window !== 'undefined') {
    window.onerror = function (msg, url, line, col, error) {
      console.error('Global error:', msg, url, line, col, error);
      alert('JS Error: ' + msg + '\n' + url + ':' + line + ':' + col);
    };
    window.onunhandledrejection = function (event) {
      console.error('Unhandled promise rejection:', event.reason);
      alert('Unhandled promise rejection: ' + event.reason);
    };
  }
  
// Resource Request Modal State
// (should be inside a component, not at the top level)




// --- Resource Request Types ---
type ResourceRequest = {
  requestId: string;
  userId: string;
  userName: string;
  subject: string;
  description: string;
  status: 'open' | 'fulfilled' | string;
  fulfilledBy?: string;
  fulfilledByName?: string;
  resourceUrl?: string;
  createdAt?: string;
  fulfilledAt?: string;
};

type DropdownOption = {
  value: string;
  label: string;
  description?: string;
};

function CustomDropdown({
  name,
  options,
  value,
  defaultValue = '',
  placeholder = 'Select an option',
  required = false,
  onChange,
  theme = 'light',
  size = 'default',
  renderSelected,
  renderOption
}: {
  name: string;
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
  theme?: 'light' | 'dark';
  size?: 'default' | 'compact';
  renderSelected?: (option: DropdownOption) => React.ReactNode;
  renderOption?: (option: DropdownOption, selected: boolean) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedValue(value ?? defaultValue);
  }, [value, defaultValue]);

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

  const selectedOption = options.find(option => option.value === selectedValue);
  const isDark = theme === 'dark';
  const isCompact = size === 'compact';
  const triggerClassName = isDark
    ? `flex w-full items-center gap-3 rounded-xl border border-gray-600 bg-gray-700 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} text-left text-white shadow-sm transition ${isOpen ? 'ring-2 ring-gray-400' : 'hover:border-gray-500'}`
    : `flex w-full items-center gap-3 rounded-xl border border-stone-300 bg-white ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} text-left shadow-sm transition ${isOpen ? 'ring-2 ring-stone-500' : 'hover:border-stone-400'}`;
  const menuClassName = isDark
    ? 'absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-gray-600 bg-gray-800 shadow-2xl'
    : 'absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl';

  return (
    <div className="relative" ref={containerRef}>
      <select
        name={name}
        value={selectedValue}
        onChange={(e) => {
          setSelectedValue(e.target.value);
          onChange?.(e.target.value);
        }}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {options.map(option => (
          <option key={`${name}-${option.value || 'empty'}`} value={option.value}>
            {option.description ? `${option.label} - ${option.description}` : option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className={triggerClassName}
      >
        <div className="min-w-0 flex-1">
          {selectedOption ? (
            renderSelected ? (
              renderSelected(selectedOption)
            ) : (
              <span className={`block truncate ${isDark ? 'text-white' : 'text-stone-900'} ${isCompact ? 'text-sm' : ''}`}>
                {selectedOption.label}
              </span>
            )
          ) : (
            <span className={`block truncate ${isDark ? 'text-gray-400' : 'text-stone-500'} ${isCompact ? 'text-sm' : ''}`}>
              {placeholder}
            </span>
          )}
        </div>
        <Icon name="expand_more" className={`shrink-0 transition-transform ${isDark ? 'text-gray-300' : 'text-stone-500'} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={menuClassName}>
          <div className="max-h-[min(18rem,40vh)] overflow-y-auto py-2">
            {options.map(option => {
              const isSelected = selectedValue === option.value;
              return (
                <button
                  key={`${name}-option-${option.value || 'empty'}`}
                  type="button"
                  onClick={() => {
                    setSelectedValue(option.value);
                    onChange?.(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-4 ${isCompact ? 'py-2.5' : 'py-3'} text-left transition ${
                    isDark
                      ? isSelected
                        ? 'bg-gray-700'
                        : 'hover:bg-gray-700/70'
                      : isSelected
                        ? 'bg-stone-100'
                        : 'hover:bg-stone-50'
                  }`}
                  title={option.description ? `${option.label} - ${option.description}` : option.label}
                >
                  <div className="min-w-0 flex-1">
                    {renderOption ? (
                      renderOption(option, isSelected)
                    ) : (
                      <>
                        <div className={`truncate ${isDark ? 'text-white' : 'text-stone-900'} ${isCompact ? 'text-sm' : ''}`}>
                          {option.label}
                        </div>
                        {option.description ? (
                          <div className={`truncate text-sm ${isDark ? 'text-gray-400' : 'text-stone-500'}`}>
                            {option.description}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                  {isSelected ? (
                    <Icon name="check" className={`shrink-0 ${isDark ? 'text-gray-200' : 'text-stone-700'}`} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RefreshIconButton({
  onClick,
  disabled = false,
  spinning = false,
  darkMode = false,
  title = 'Refresh'
}: {
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
  darkMode?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors disabled:cursor-wait disabled:opacity-70 ${
        darkMode
          ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
      }`}
      title={title}
      aria-label={title}
    >
      <Icon
        name="refresh"
        className={spinning ? 'animate-spin text-base' : 'text-base'}
      />
    </button>
  );
}

type CourseDropdownOption = {
  code: string;
  name?: string;
};

function CourseDropdown({
  name,
  options,
  value,
  defaultValue = '',
  placeholder = 'Select a course',
  required = false,
  onChange
}: {
  name: string;
  options: CourseDropdownOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <CustomDropdown
      name={name}
      options={[
        { value: '', label: placeholder },
        ...options.map(option => ({
          value: option.code,
          label: option.code,
          description: option.name
        }))
      ]}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      required={required}
      onChange={onChange}
      renderSelected={(option) => option.value ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-semibold text-stone-900">{option.label}</span>
          {option.description ? (
            <>
              <span className="shrink-0 text-stone-400">-</span>
              <span className="truncate text-sm text-stone-600" title={option.description}>
                {option.description}
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <span className="block truncate text-stone-500">{placeholder}</span>
      )}
      renderOption={(option) => option.value ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-semibold text-stone-900">{option.label}</span>
          {option.description ? (
            <>
              <span className="shrink-0 text-stone-400">-</span>
              <span className="truncate text-sm text-stone-600">{option.description}</span>
            </>
          ) : null}
        </div>
      ) : (
        <span className="truncate text-stone-500">{placeholder}</span>
      )}
    />
  );
}

const EXAM_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'Activity', label: 'Activity' },
  { value: 'Special Event', label: 'Special Event' },
  { value: 'Meeting', label: 'Meeting' },
  { value: 'Workshop', label: 'Workshop' },
  { value: 'LE Deadline', label: 'LE Deadline' },
  { value: 'Quiz', label: 'Quiz' },
  { value: 'Midterm Exam', label: 'Midterm Exam' },
  { value: 'Final Exam', label: 'Final Exam' },
  { value: 'Reporting', label: 'Reporting' },
  { value: 'Performance', label: 'Performance' },
  { value: 'Presentation', label: 'Presentation' },
  { value: 'Submission', label: 'Submission' }
];

const DAY_OF_WEEK_OPTIONS: DropdownOption[] = [
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
  { value: 'Sunday', label: 'Sunday' }
];
// --- Resource Request Modal ---
const ResourceRequestModal = ({ isOpen, onClose, subject, user, onRequestComplete, addToast, updateToast, removeToast, darkMode }: {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  user: User | null;
  onRequestComplete: () => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
  darkMode: boolean;
}) => {
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (!user) {
      setError('Please login first');
      return;
    }
    setSubmitting(true);
    setError('');
    const toastId = addToast('Submitting request...', 'loading', 20);
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'createResourceRequest',
          userId: user.idNumber,
          userName: user.name,
          subject,
          description
        })
      });
      const result = await response.json();
      if (result.success) {
        updateToast(toastId, 'Request submitted!', 'success', 100);
        setTimeout(() => removeToast(toastId), 2000);
        setDescription('');
        onRequestComplete();
        onClose();
      } else {
        updateToast(toastId, `Error: ${result.error || 'Unknown error'}`, 'error');
        setTimeout(() => removeToast(toastId), 4000);
      }
    } catch (err: any) {
      updateToast(toastId, `Network error: ${err.message || 'Failed to connect'}`, 'error');
      setTimeout(() => removeToast(toastId), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-stone-800 dark:text-white">Request Resource</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" disabled={submitting}>
            <Icon name="close" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Subject</label>
            <input type="text" value={subject} readOnly className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50 text-stone-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What resource do you need?" rows={3} disabled={submitting}
              className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Requested by</label>
            <input type="text" value={user ? `${user.name} (${user.idNumber})` : 'Login required'} readOnly 
              className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50 text-stone-500" />
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <button onClick={handleSubmit} disabled={submitting} className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold mt-2">
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
};
// --- Resource Request List ---
const ResourceRequestList = ({ subject, user, onFulfill, onMarkFulfilled, addToast, updateToast, removeToast, darkMode }: {
  subject: string;
  user: User | null;
  onFulfill: (request: ResourceRequest, resourceUrl: string) => void;
  onMarkFulfilled: (requestId: string) => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
  darkMode: boolean;
}) => {
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [fulfillModal, setFulfillModal] = useState<{ open: boolean; request: ResourceRequest | null }>({ open: false, request: null });
  const [fulfillUrl, setFulfillUrl] = useState('');
  const [fulfilling, setFulfilling] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${GAS_URL}?action=listResourceRequests&subject=${encodeURIComponent(subject)}&status=open`);
      const result = await response.json();
      if (result.success) {
        setRequests(result.requests || []);
      } else {
        setError(result.error || 'Failed to load requests');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [subject]);

  const handleFulfill = async () => {
    if (!fulfillModal.request || !fulfillUrl.trim()) return;
    setFulfilling(true);
    const toastId = addToast('Fulfilling request...', 'loading', 30);
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'fulfillResourceRequest',
          requestId: fulfillModal.request.requestId,
          fulfilledBy: user?.idNumber,
          fulfilledByName: user?.name,
          resourceUrl: fulfillUrl
        })
      });
      const result = await response.json();
      if (result.success) {
        updateToast(toastId, '✓ Request fulfilled!', 'success', 100);
        setTimeout(() => removeToast(toastId), 2000);
        setFulfillModal({ open: false, request: null });
        setFulfillUrl('');
        fetchRequests();
      } else {
        updateToast(toastId, `Error: ${result.error || 'Unknown error'}`, 'error');
        setTimeout(() => removeToast(toastId), 4000);
      }
    } catch (err: any) {
      updateToast(toastId, `Network error: ${err.message || 'Failed to connect'}`, 'error');
      setTimeout(() => removeToast(toastId), 4000);
    } finally {
      setFulfilling(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-8 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" darkMode={darkMode} />
          <Skeleton className="h-5 w-40" darkMode={darkMode} />
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className={`p-4 rounded-xl border flex flex-col gap-3 ${darkMode ? 'border-stone-700 bg-stone-900' : 'border-amber-200 bg-amber-50'}`}
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" darkMode={darkMode} />
              <Skeleton className="h-3 w-20" darkMode={darkMode} />
            </div>
            <Skeleton className="h-4 w-full" darkMode={darkMode} />
            <Skeleton className="h-4 w-5/6" darkMode={darkMode} />
            <Skeleton className="h-8 w-24 rounded-lg" darkMode={darkMode} />
          </div>
        ))}
      </div>
    );
  }
  if (error) return <div className="text-center text-red-500 py-4">{error}</div>;
  if (requests.length === 0) return <div className="text-center text-stone-400 py-4">No open resource requests.</div>;

  return (
    <div className="mt-8">
      <h3 className={`font-semibold mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-stone-800'}`}> 
        <Icon name="help" className="text-amber-500" /> Resource Requests
      </h3>
      <div className="space-y-3">
        {requests.map(req => (
          <div key={req.requestId} className={`p-4 rounded-xl border flex flex-col gap-2 ${darkMode ? 'border-stone-700 bg-stone-900' : 'border-amber-200 bg-amber-50'}`}> 
            <div className="flex items-center gap-2">
              <Icon name="person" className="text-stone-400" />
              <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>{req.userName}</span>
              <span className="text-xs text-stone-400">({req.userId})</span>
              <span className="ml-auto text-xs text-stone-400">{req.createdAt ? new Date(req.createdAt).toLocaleString() : ''}</span>
            </div>
            <div className={darkMode ? 'text-stone-100' : 'text-stone-700'}>{req.description}</div>
            <div className="flex gap-2 mt-2">
              {user && user.idNumber !== req.userId && (
                <button onClick={() => setFulfillModal({ open: true, request: req })} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Fulfill</button>
              )}
              {user && user.idNumber === req.userId && (
                <button onClick={() => onMarkFulfilled(req.requestId)} className="px-3 py-1 bg-stone-600 text-white rounded-lg text-sm font-medium hover:bg-stone-700">Mark as Fulfilled</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fulfill Modal */}
      {fulfillModal.open && fulfillModal.request && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md shadow-xl`}>
            <h2 className={`text-lg font-bold mb-2 ${darkMode ? 'text-white' : 'text-stone-800'}`}>Fulfill Resource Request</h2>
            <p className={`mb-2 ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>{fulfillModal.request.description}</p>
            <input type="text" value={fulfillUrl} onChange={e => setFulfillUrl(e.target.value)}
              placeholder="Paste resource link here" className={`w-full p-3 border rounded-xl mb-3 ${darkMode ? 'border-stone-700 bg-stone-900 text-white' : 'border-stone-200'}`} disabled={fulfilling} />
            <div className="flex gap-2">
              <button onClick={handleFulfill} disabled={fulfilling || !fulfillUrl.trim()} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-semibold">
                {fulfilling ? 'Submitting...' : 'Submit'}
              </button>
              <button onClick={() => setFulfillModal({ open: false, request: null })} className={`flex-1 py-2 rounded-xl font-semibold ${darkMode ? 'bg-stone-700 text-white' : 'bg-stone-200 text-stone-700'}`}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// --- Types ---

type Card = {
  id: string;
  q: string;
  a: string;
};

type Deck = {
  name: string;        // Display name from C1
  fileId?: string;
  sheetName?: string;  // Original sheet name (F-xxx)
  subject?: string;    // Subject category from D1 (FL111, FL112, etc.)
  url?: string;
  submittedBy?: string;
  submittedByName?: string;
  timestamp?: string;
  cards: Card[];
};

type Resource = {
  id?: string;
  name: string;
  title?: string;
  description?: string;
  category: 'Video' | 'Image' | 'Files' | 'Lesson PPT' | 'Lesson PDF' | 'Reviewer' | string;
  url: string;
  submittedBy?: string;
  submittedByName?: string;
  timestamp?: string;
  subject?: string;
  linkedObligations?: Array<{
    obligationId: string;
    obligationType?: string;
    obligationLabel?: string;
    courseCode?: string;
  }>;
};

type ResourceLink = {
  resourceUrl: string;
  resourceTitle?: string;
  resourceCategory?: string;
  obligationId: string;
  obligationType?: string;
  obligationLabel?: string;
  courseCode?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
};

type CategoryItem = {
  name: string;
  category: string;
};

type User = {
  idNumber: string; // Primary key (Student/Employee ID)
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  qrCodeValue?: string;
  profilePictureURL?: string;
  profilePictureFileId?: string;
  digitalSignatureURL?: string;
  birthday?: string;
  email: string;
  emailVerified: boolean;
  schoolEmail?: string;
  schoolEmailVerified: boolean;
  school?: string;
  college?: string;
  program?: string;
  major?: string;
  year?: number;
  section?: string;
  createdDate: string;
  lastLogin: string;
  record?: Record<string, any>; // For backward compatibility
  // Class/Organization fields
  role?: UserRole;
  position?: ClassPosition | string;
  // Legacy compatibility
  name?: string; // Will map to fullName
  profilePicture?: string; // Will map to profilePictureURL
  createdAt?: string; // Will map to createdDate
  sessionToken?: string;
};

type Toast = {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'loading';
  progress?: number;
};

type AppView = 'HOME' | 'SUBJECT' | 'DECK_OVERVIEW' | 'PLAY' | 'SUMMARY' | 'RESOURCE_VIEW' | 'ANALYTICS' | 'EXAMS' | 'ALL_RESOURCES' | 'CALENDAR' | 'CLASS' | 'FINANCE' | 'ATTENDANCE' | 'SCHEDULE';

export const ALLOWED_ROUTE_ROLES = ['visitor', 'member', 'admin'] as const;
export type RouteRole = (typeof ALLOWED_ROUTE_ROLES)[number];

type RouteOverlay = 'login' | 'profile' | 'upload' | 'request-resource';

type PageConfig = {
  view: AppView;
  overlay?: RouteOverlay;
};

const PAGE_REGISTRY: Record<string, PageConfig> = {
  home: { view: 'HOME' },
  subject: { view: 'SUBJECT' },
  deck: { view: 'DECK_OVERVIEW' },
  play: { view: 'PLAY' },
  summary: { view: 'SUMMARY' },
  resource: { view: 'RESOURCE_VIEW' },
  analytics: { view: 'ANALYTICS' },
  exams: { view: 'EXAMS' },
  resources: { view: 'ALL_RESOURCES' },
  calendar: { view: 'CALENDAR' },
  class: { view: 'CLASS' },
  finance: { view: 'FINANCE' },
  attendance: { view: 'ATTENDANCE' },
  schedule: { view: 'SCHEDULE' },
  login: { view: 'HOME', overlay: 'login' },
  profile: { view: 'HOME', overlay: 'profile' },
  upload: { view: 'SUBJECT', overlay: 'upload' },
  'request-resource': { view: 'SUBJECT', overlay: 'request-resource' }
};

const VIEW_TO_PAGE: Record<AppView, string> = {
  HOME: 'home',
  SUBJECT: 'subject',
  DECK_OVERVIEW: 'deck',
  PLAY: 'play',
  SUMMARY: 'summary',
  RESOURCE_VIEW: 'resource',
  ANALYTICS: 'analytics',
  EXAMS: 'exams',
  ALL_RESOURCES: 'resources',
  CALENDAR: 'calendar',
  CLASS: 'class',
  FINANCE: 'finance',
  ATTENDANCE: 'attendance',
  SCHEDULE: 'schedule'
};

const AUTH_REQUIRED_PAGES = new Set<string>([
  'subject',
  'deck',
  'play',
  'summary',
  'resource',
  'analytics',
  'exams',
  'resources',
  'calendar',
  'class',
  'finance',
  'attendance',
  'schedule',
  'profile',
  'upload',
  'request-resource'
]);

function deriveRouteRoleForUser(user: User | null): RouteRole {
  if (!user) return 'visitor';
  if (user.role === 'admin' || user.role === 'superadmin') return 'admin';
  return 'member';
}

function normalizePageKey(page: string | null | undefined) {
  return (page || 'home').trim().toLowerCase();
}

function getPageConfig(page: string | null | undefined): PageConfig {
  return PAGE_REGISTRY[normalizePageKey(page)] || PAGE_REGISTRY.home;
}

function getInitialUrlParam(key: string) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

function buildPageScopedParams(args: {
  page: string;
  isAuthPhase: boolean;
  routeRole: RouteRole;
  user: User | null;
  activeSubject: string | null;
  activeTab: 'Classroom' | 'Schedule' | 'Resources' | 'Exams';
  activeDeck: Deck | null;
  activeResource: Resource | null;
}) {
  const {
    page,
    isAuthPhase,
    routeRole,
    user,
    activeSubject,
    activeTab,
    activeDeck,
    activeResource
  } = args;

  const params: Record<string, string | null> = {
    studentId: isAuthPhase ? null : user?.idNumber || null,
    role: user?.role || routeRole,
    subject: null,
    course: null,
    tab: null,
    deck: null,
    resource: null
  };

  if (isAuthPhase) {
    return params;
  }

  switch (page) {
    case 'subject':
      params.subject = activeSubject || null;
      params.course = activeSubject || null;
      params.tab = activeTab.toLowerCase();
      break;
    case 'deck':
    case 'play':
    case 'summary':
      params.subject = activeSubject || null;
      params.course = activeSubject || null;
      params.tab = activeTab.toLowerCase();
      params.deck = activeDeck?.name || null;
      break;
    case 'analytics':
      break;
    case 'resource':
      params.subject = activeSubject || null;
      params.course = activeSubject || null;
      params.tab = 'resources';
      params.resource = activeResource?.name || null;
      break;
    case 'upload':
    case 'request-resource':
      params.subject = activeSubject || null;
      params.course = activeSubject || null;
      params.tab = 'resources';
      break;
    default:
      break;
  }

  return params;
}

type DeckProgress = {
  deckName: string;
  cardStatuses: Record<string, 'correct' | 'incorrect' | 'unanswered'>;
  currentIndex: number;
  mode: 'shuffle' | 'chronological';
  shuffledOrder?: string[]; // Card IDs in shuffled order
  lastUpdated: number | string;
};

type CardSessionSummary = {
  cardId: string;
  question: string;
  answer: string;
  finalStatus: 'correct' | 'incorrect';
  attemptCount: number;
  timeSpentMs: number;
};

type Subject = {
  code: string;
  name: string;
};

type Exam = {
  examId: string;
  courseCode: string;
  courseName: string;
  examType: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  proctor: string;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  status: 'upcoming' | 'ongoing' | 'done';
};

type Announcement = {
  id: string;
  type: 'custom' | 'congratulations' | 'post-final' | 'good-luck' | 'exam-ongoing';
  title: string;
  message: string;
  emoji?: string;
  exam?: Exam;
  dismissedAt?: number;
};

type ClassSchedule = {
  scheduleId: string;
  type: 'semestral' | 'makeup' | 'activity' | 'special' | string;
  semester: '1st' | '2nd' | string;
  courseCode: string;
  courseName: string;
  teacher: string;
  classroom: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  specificDate: string;
  details: string;
  isActive: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  startTime12h?: string;
  endTime12h?: string;
  status: 'today' | 'upcoming' | 'completed' | 'scheduled';
};

type AttendanceRecordStatus = 'present' | 'absent' | 'late' | 'excused' | string;

type AttendanceSchedule = {
  scheduleId: string;
  type: 'semestral' | 'makeup' | 'activity' | 'special' | string;
  semester: string;
  courseCode: string;
  courseName: string;
  teacher: string;
  classroom: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  specificDate: string;
  details: string;
  status: string;
  occurrenceDate: string;
  occurrenceLabel: string;
  section?: string;
};

type AttendanceSession = {
  sessionId: string;
  scheduleId: string;
  courseCode: string;
  courseName: string;
  scheduleType: string;
  semester: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  section: string;
  recordMode: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
};

type AttendanceRecord = {
  sessionId: string;
  studentId: string;
  studentName: string;
  section: string;
  status: AttendanceRecordStatus;
  recordedVia: string;
  qrCodeValue: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  session?: AttendanceSession | null;
};

type AttendanceRosterMember = {
  idNumber: string;
  name: string;
  section?: string;
  role?: string;
  position?: string;
  profilePicture?: string;
};

type AttendanceAnalyticsFilters = {
  filterType: 'all' | 'specific-date' | 'class' | 'date-range' | 'activity';
  specificDate?: string;
  dateFrom?: string;
  dateTo?: string;
  courseCode?: string;
  scheduleType?: string;
};

type AttendanceAnalyticsSummary = {
  totalRecords: number;
  uniqueStudents: number;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendanceRate: number;
  byStatus: Array<{ label: string; value: number }>;
  byDate: Array<{ label: string; value: number }>;
  byCourse: Array<{ label: string; value: number }>;
};

type AttendancePageContext = {
  success: boolean;
  userProfile?: User;
  currentSemester?: string;
  academicYear?: string;
  schedules?: AttendanceSchedule[];
  myRecords?: AttendanceRecord[];
  memberOptions?: AttendanceRosterMember[];
  canViewSchedules?: boolean;
  canViewAnalytics?: boolean;
  canLookupMembers?: boolean;
  error?: string;
};

type AdditionalSemestralMeeting = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
};

type SubjectInfo = {
  code: string;
  name: string;
};

type UserRole = 'student' | 'admin' | 'superadmin' | 'faculty' | 'guest';

type ClassPosition =
  | ''
  | 'Mayor'
  | 'Vice Mayor'
  | 'Secretary'
  | 'Assistant Secretary'
  | 'Treasurer'
  | 'Auditor'
  | 'Business Manager'
  | 'Internal Public Information Officer'
  | 'External Public Information Officer'
  | 'Marshal 1'
  | 'Marshal 2'
  | 'Marshal 3';

// --- Constants ---

const GAS_URL = 'https://script.google.com/macros/s/AKfycbx7gVOloTlgAZ5NJalR5QRrEo8iRdc-rJWZiaiStu2KMU7hAXvicAJXUm2Jm5iCLZZn/exec';
const RESOURCE_GAS_URL = 'https://script.google.com/macros/s/AKfycbxIeozV9nVhvOY0WfayX1L7AyFZFhKKT3Rptr2x8ThOrLtl3ev7xyOHXlSeKw6HanDu/exec';
const CLASS_SCHEDULE_GAS_URL = 'https://script.google.com/macros/s/AKfycbxJoCpVWKo1cWku1ErvwGRuVhvPaqoT2hL51mJMS_8KyjSfmCCTngZt7nZ9T6Yq7Q8oNw/exec';
const ATTENDANCE_GAS_URL = 'https://script.google.com/macros/s/AKfycbzOTNqxLJYNneKIP6iAHqYleARxcySuNntdygZWq1eXM1EYB-HqkplUz053VSA3iK_-eg/exec';
const STORAGE_KEY_USER = 'cumlaude_user';
const STORAGE_KEY_STATE = 'flashcard_session_state';
const STORAGE_KEY_CACHE_VERSION = 'cumlaude_cache_version';
const getHomeSemesterSubjectsCacheKey = (semester: '1st' | '2nd') => `home_semesterSubjects_${semester}`;
const getHomeSemesterSchedulesCacheKey = (semester: '1st' | '2nd') => `home_semesterSchedules_${semester}`;
const getAnalyticsCacheKey = (userId: string) => `analytics_${userId}`;
const SECURE_SESSION_KEY = 'cumlaude_secure_session_key';
const SECURE_SESSION_PREFIX = 'cumlaude_secure_';

type SecureSessionEnvelope = {
  v: 1;
  iv: string;
  data: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSecureSessionCryptoKey() {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;

  let encodedKey = sessionStorage.getItem(SECURE_SESSION_KEY);
  if (!encodedKey) {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    encodedKey = bytesToBase64(rawKey);
    sessionStorage.setItem(SECURE_SESSION_KEY, encodedKey);
  }

  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(encodedKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function setSecureSessionItem(key: string, value: unknown) {
  if (typeof window === 'undefined') return;

  try {
    const cryptoKey = await getSecureSessionCryptoKey();
    if (!cryptoKey) {
      sessionStorage.setItem(`${SECURE_SESSION_PREFIX}${key}`, JSON.stringify(value));
      return;
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = new TextEncoder().encode(JSON.stringify(value));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, payload);
    const envelope: SecureSessionEnvelope = {
      v: 1,
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted))
    };

    sessionStorage.setItem(`${SECURE_SESSION_PREFIX}${key}`, JSON.stringify(envelope));
  } catch (error) {
    console.warn('Failed to write secure session cache:', error);
  }
}

async function getSecureSessionItem<T>(key: string): Promise<T | null> {
  if (typeof window === 'undefined') return null;

  const raw = sessionStorage.getItem(`${SECURE_SESSION_PREFIX}${key}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.iv || !parsed?.data) {
      return parsed as T;
    }

    const cryptoKey = await getSecureSessionCryptoKey();
    if (!cryptoKey) return null;

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) },
      cryptoKey,
      base64ToBytes(parsed.data)
    );

    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch (error) {
    console.warn('Failed to read secure session cache:', error);
    sessionStorage.removeItem(`${SECURE_SESSION_PREFIX}${key}`);
    return null;
  }
}

async function postToAppsScript(payload: unknown) {
  return fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
}

async function postJson(url: string, payload: unknown) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
}

async function getJson(url: string, params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    searchParams.set(key, String(value));
  });

  const requestUrl = searchParams.toString() ? `${url}?${searchParams.toString()}` : url;
  return fetch(requestUrl, { method: 'GET' });
}

function clearSecureSessionCache() {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key) continue;
    if (key === SECURE_SESSION_KEY || key.startsWith(SECURE_SESSION_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

function clearLegacyMetadataCache() {
  if (typeof window === 'undefined') return;

  [
    'cumlaude_subjects',
    'cumlaude_subjectInfo',
    'cumlaude_currentSemester',
    'cumlaude_academicYear',
    'cumlaude_semesterConfig',
    'cumlaude_semesterSubjects',
    'cumlaude_exams'
  ].forEach(key => localStorage.removeItem(key));
}

async function ensureAppServiceWorker() {
  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (existingRegistration) {
    return existingRegistration;
  }

  return navigator.serviceWorker.register('/sw.js');
}

function toDateInputValue(value?: string) {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
}

function splitFullName(name?: string) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ')
  };
}

// --- Database ---

const db = new Dexie('CumLaudeDB') as Dexie & {
  decks: Dexie.Table<Deck, string>;
  categories: Dexie.Table<{ subject: string; items: CategoryItem[] }, string>;
  resources: Dexie.Table<{ subject: string; items: Resource[] }, string>;
};

db.version(2).stores({
  decks: 'name',
  categories: 'subject',
  resources: 'subject'
});

// Progress storage key prefix
const PROGRESS_KEY_PREFIX = 'cumlaude_deck_progress_';

const hashDeckCardContent = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const buildDeckCards = (deckKey: string, cards: Array<{ q?: string; a?: string }>): Card[] => {
  const occurrenceCounts: Record<string, number> = {};

  return cards.map((card) => {
    const question = card.q || '';
    const answer = card.a || '';
    const fingerprint = `${question}\u0000${answer}`;
    occurrenceCounts[fingerprint] = (occurrenceCounts[fingerprint] || 0) + 1;

    return {
      id: `${deckKey}-${hashDeckCardContent(fingerprint)}-${occurrenceCounts[fingerprint]}`,
      q: question,
      a: answer
    };
  });
};

// --- Components ---

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-rounded select-none ${className}`}>{name}</span>
);

const Skeleton = ({ className = '', darkMode = false }: { className?: string; darkMode?: boolean }) => (
  <div
    className={`rounded-lg skeleton-shimmer ${darkMode ? 'brightness-75' : ''} ${className}`}
  />
);

const ThemeToggleButton = ({
  darkMode,
  setDarkMode,
  className = '',
  compact = false
}: {
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
  className?: string;
  compact?: boolean;
}) => (
  <button
    onClick={() => {
      const newMode = !darkMode;
      setDarkMode(newMode);
      localStorage.setItem('cumlaude_darkMode', String(newMode));
    }}
    className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 ${className} ${
      compact
        ? darkMode
          ? 'h-10 px-3 bg-white/10 text-amber-200 hover:bg-white/20'
          : 'h-10 px-3 bg-black/10 text-amber-100 hover:bg-black/20'
        : darkMode
          ? 'px-4 py-3 bg-gray-700 text-white hover:bg-gray-600'
          : 'px-4 py-3 bg-stone-100 text-stone-800 hover:bg-stone-200'
    }`}
    title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
  >
    <Icon name={darkMode ? 'light_mode' : 'dark_mode'} className="text-lg" />
    <span className={compact ? 'text-sm font-medium' : 'text-sm font-semibold'}>
      {darkMode ? 'Light Mode' : 'Dark Mode'}
    </span>
  </button>
);

// Toast Container Component
const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className={`p-4 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' :
            toast.type === 'loading' ? 'bg-stone-800 text-white' :
            'bg-white text-stone-800 border border-stone-200'
          }`}
        >
          {toast.type === 'loading' && (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {toast.type === 'success' && <Icon name="check_circle" />}
          {toast.type === 'error' && <Icon name="error" />}
          {toast.type === 'info' && <Icon name="info" />}
          <div className="flex-1">
            <p className="text-sm font-medium">{toast.message}</p>
            {toast.progress !== undefined && (
              <div className="mt-2 h-1 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${toast.progress}%` }}
                />
              </div>
            )}
          </div>
          {toast.type !== 'loading' && (
            <button onClick={() => removeToast(toast.id)} className="p-1 hover:opacity-70">
              <Icon name="close" className="text-sm" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// Upload Modal Component
const UploadModal = ({
  isOpen,
  onClose,
  subject,
  user,
  onUploadComplete,
  addToast,
  updateToast,
  removeToast,
  darkMode,
  obligations,
  formatExamDate,
  formatExamTime
}: {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  user: User | null;
  onUploadComplete: () => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
  darkMode: boolean;
  obligations: Exam[];
  formatExamDate: (dateStr: string) => string;
  formatExamTime: (timeStr: string | number) => string;
}) => {
  type ResourceUploadCategory = 'PDF' | 'PPT' | 'Video' | 'Flipcard';
  type UploadMode = 'upload' | 'link' | 'csv' | 'sheet-link';

  const [category, setCategory] = useState<ResourceUploadCategory>('PDF');
  const [mode, setMode] = useState<UploadMode>('upload');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [driveLink, setDriveLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [selectedObligationId, setSelectedObligationId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 35 * 1024 * 1024;
  const currentModes = category === 'Flipcard'
    ? [
        { key: 'sheet-link' as const, label: 'Sheets Link', icon: 'link' },
        { key: 'csv' as const, label: 'CSV Upload', icon: 'upload_file' }
      ]
    : [
        { key: 'upload' as const, label: 'Upload File', icon: 'cloud_upload' },
        { key: 'link' as const, label: 'Paste Link', icon: 'link' }
      ];
  const subjectObligations = obligations.filter(obligation => obligation.courseCode === subject);
  const selectedObligation = subjectObligations.find(obligation => obligation.examId === selectedObligationId) || null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const nextFiles = category === 'Flipcard' ? selectedFiles.slice(0, 1) : selectedFiles;
    const oversizedFiles = nextFiles.filter(f => f.size > MAX_FILE_SIZE);
    
    if (oversizedFiles.length > 0) {
      setError(`File "${oversizedFiles[0].name}" exceeds 35MB limit.`);
      return;
    }

    if (category === 'Flipcard' && nextFiles[0] && !nextFiles[0].name.toLowerCase().endsWith('.csv')) {
      setError('Flipcard upload requires a .csv file.');
      return;
    }
    
    setFiles(nextFiles);
    if (!title.trim() && nextFiles[0]) {
      setTitle(nextFiles[0].name.replace(/\.[^.]+$/, ''));
    }
    setError('');
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const validateDriveLink = (url: string): boolean => {
    if (category === 'Flipcard') {
      return /docs\.google\.com\/spreadsheets|drive\.google\.com/i.test(url);
    }
    if (category === 'Video') {
      return /drive\.google\.com|docs\.google\.com|youtube\.com|youtu\.be/i.test(url);
    }
    return /drive\.google\.com|docs\.google\.com/i.test(url);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setFiles([]);
    setDriveLink('');
    setSelectedObligationId('');
    setError('');
  };

  const parseCsvLine = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    cells.push(current.trim());
    return cells.map(cell => cell.replace(/^"(.*)"$/, '$1').trim());
  };

  const parseFlipcardCsv = async (file: File) => {
    const rows = (await file.text())
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(parseCsvLine);

    if (rows.length === 0) {
      throw new Error('The CSV file is empty.');
    }

    const header = rows[0].map(cell => cell.toLowerCase());
    const questionIndex = header.findIndex(cell => ['question', 'q', 'front', 'term', 'prompt'].includes(cell));
    const answerIndex = header.findIndex(cell => ['answer', 'a', 'back', 'definition', 'meaning'].includes(cell));
    const titleIndex = header.findIndex(cell => ['title', 'deck', 'deck title', 'name', 'set'].includes(cell));
    const hasHeader = questionIndex !== -1 && answerIndex !== -1;
    const qIndex = hasHeader ? questionIndex : 0;
    const aIndex = hasHeader ? answerIndex : 1;
    const cards = rows
      .slice(hasHeader ? 1 : 0)
      .map(row => ({ q: (row[qIndex] || '').trim(), a: (row[aIndex] || '').trim() }))
      .filter(card => card.q && card.a);

    if (cards.length === 0) {
      throw new Error('No valid question and answer rows were detected in the CSV.');
    }

    return {
      cards,
      suggestedTitle: (hasHeader && titleIndex !== -1 ? rows[1]?.[titleIndex] : '')?.trim() || file.name.replace(/\.[^.]+$/, '')
    };
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('Please login first');
      return;
    }
    if (!subject) {
      setError('Open a course page first before adding resources');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (mode === 'upload' && files.length === 0) {
      setError(category === 'Flipcard' ? 'Please select a CSV file' : 'Please select at least one file');
      return;
    }
    if (mode === 'link' && !driveLink.trim()) {
      setError('Please enter a link');
      return;
    }
    if (mode === 'link' && !validateDriveLink(driveLink)) {
      setError('Please enter a valid link for this resource type');
      return;
    }

    setUploading(true);
    setError('');
    let toastId: number;

    if (mode === 'link') {
      toastId = addToast('Preparing request...', 'loading', 10);
      try {
        updateToast(toastId, 'Step 2/4: Connecting to server...', 'loading', 30);
        
        const response = await fetch(RESOURCE_GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: category === 'Flipcard' ? 'createDeckFromSheetLink' : 'addResourceByLink',
            title: title,
            description: description,
            subject: subject,
            category: category,
            link: driveLink,
            sheetUrl: driveLink,
            obligationId: selectedObligation?.examId || '',
            obligationType: selectedObligation?.examType || '',
            obligationLabel: selectedObligation ? `${selectedObligation.examType} • ${selectedObligation.courseCode} • ${formatExamDate(selectedObligation.date)}` : '',
            userId: user.idNumber,
            userName: user.name
          })
        });
        
        updateToast(toastId, 'Step 3/4: Processing response...', 'loading', 60);
        
        const result = await response.json();
        
        updateToast(toastId, 'Step 4/4: Finalizing...', 'loading', 90);
        
        if (result.success) {
          updateToast(toastId, '✓ Resource added successfully!', 'success', 100);
          setTimeout(() => removeToast(toastId), 3000);
          onUploadComplete();
          onClose();
          resetForm();
        } else {
          updateToast(toastId, `Error: ${result.error || 'Unknown error'}`, 'error');
          setTimeout(() => removeToast(toastId), 5000);
        }
      } catch (err: any) {
        updateToast(toastId, `Network error: ${err.message || 'Failed to connect'}`, 'error');
        setTimeout(() => removeToast(toastId), 5000);
      } finally {
        setUploading(false);
      }
    } else {
      // File upload
      toastId = addToast('Step 1/6: Preparing upload...', 'loading', 5);
      
      try {
        let successCount = 0;
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileTitle = files.length > 1 ? `${title} (${i + 1})` : title;
          const fileNum = files.length > 1 ? ` [${i + 1}/${files.length}]` : '';
          
          updateToast(toastId, `Step 2/6: Reading file${fileNum}...`, 'loading', 15);
          
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 20) + 15;
                updateToast(toastId, `Step 2/6: Reading... ${formatFileSize(e.loaded)}/${formatFileSize(e.total)}`, 'loading', pct);
              }
            };
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
          
          updateToast(toastId, `Step 3/6: Connecting to server${fileNum}...`, 'loading', 40);
          
          const response = await fetch(RESOURCE_GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
              action: category === 'Flipcard' ? 'createDeckFromCards' : 'uploadResource',
              title: fileTitle,
              description: description,
              subject: subject,
              category: category,
              fileData: base64,
              fileName: file.name,
              mimeType: file.type,
              obligationId: selectedObligation?.examId || '',
              obligationType: selectedObligation?.examType || '',
              obligationLabel: selectedObligation ? `${selectedObligation.examType} • ${selectedObligation.courseCode} • ${formatExamDate(selectedObligation.date)}` : '',
              userId: user.idNumber,
              userName: user.name
            })
          });
          
          updateToast(toastId, `Step 4/6: Uploading to Google Drive${fileNum}...`, 'loading', 60);
          
          const result = await response.json();
          
          updateToast(toastId, `Step 5/6: Saving to database${fileNum}...`, 'loading', 80);
          
          if (result.success) {
            successCount++;
            updateToast(toastId, `Step 6/6: Verifying${fileNum}...`, 'loading', 95);
          } else {
            updateToast(toastId, `✗ Failed: ${result.error || 'Unknown error'}`, 'error');
            setTimeout(() => removeToast(toastId), 5000);
            setUploading(false);
            return;
          }
        }
        
        if (successCount === files.length) {
          updateToast(toastId, `✓ ${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully!`, 'success', 100);
          setTimeout(() => removeToast(toastId), 3000);
          onUploadComplete();
          onClose();
          resetForm();
        } else {
          updateToast(toastId, `Partial: ${successCount}/${files.length} uploaded`, 'info');
          setTimeout(() => removeToast(toastId), 5000);
        }
      } catch (err: any) {
        updateToast(toastId, `✗ Upload failed: ${err.message || 'Network error'}`, 'error');
        setTimeout(() => removeToast(toastId), 5000);
      } finally {
        setUploading(false);
      }
    }
  };

  if (!isOpen) return null;

  // Instructions Modal
  if (showInstructions) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-stone-800">How to Get a Link</h2>
            <button onClick={() => setShowInstructions(false)} className="text-stone-400 hover:text-stone-600">
              <Icon name="close" />
            </button>
          </div>
          
          <div className="space-y-4 text-sm">
            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="font-semibold text-blue-800 mb-2">📁 Google Drive Files</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Go to <a href="https://drive.google.com" target="_blank" className="underline">drive.google.com</a></li>
                <li>Upload your file</li>
                <li>Right-click → Share</li>
                <li>Set to "Anyone with the link"</li>
                <li>Copy link and paste here</li>
              </ol>
            </div>
            
            <div className="bg-green-50 p-4 rounded-xl">
              <p className="font-semibold text-green-800 mb-2">🎥 YouTube Videos</p>
              <ol className="list-decimal list-inside space-y-1 text-green-700">
                <li>Go to the YouTube video</li>
                <li>Click Share → Copy link</li>
                <li>Paste here</li>
              </ol>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-xl">
              <p className="font-semibold text-amber-800 mb-2">⚠️ Important</p>
              <p className="text-amber-700">Make sure the file is set to "Anyone with the link can view"</p>
            </div>
          </div>
          
          <button onClick={() => setShowInstructions(false)} className="w-full mt-4 py-3 bg-stone-800 text-white rounded-xl font-semibold">
            Got it!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Add Resource</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" disabled={uploading}>
            <Icon name="close" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-4 p-1 bg-stone-100 rounded-xl">
          <button
            onClick={() => { setMode('upload'); setError(''); }}
            disabled={uploading}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              mode === 'upload' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
            }`}
          >
            <Icon name={category === 'Flipcard' ? 'upload_file' : 'cloud_upload'} className="text-base" /> {category === 'Flipcard' ? 'CSV Upload' : 'Upload'}
          </button>
          <button
            onClick={() => { setMode('link'); setError(''); }}
            disabled={uploading}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              mode === 'link' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
            }`}
          >
            <Icon name="link" className="text-base" /> {category === 'Flipcard' ? 'Sheets Link' : 'Paste Link'}
          </button>
        </div>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Title *</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Resource title" disabled={uploading}
              className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional" rows={2} disabled={uploading}
              className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none resize-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Subject</label>
            <input type="text" value={subject} readOnly className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50 text-stone-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Link to Obligation</label>
            <CustomDropdown
              name="linkedObligation"
              value={selectedObligationId}
              onChange={setSelectedObligationId}
              options={[
                { value: '', label: 'None' },
                ...subjectObligations.map(obligation => ({
                  value: obligation.examId,
                  label: obligation.examType,
                  description: `${formatExamDate(obligation.date)} - ${formatExamTime(obligation.startTime)}`
                }))
              ]}
            />
            <p className="text-xs text-stone-400 mt-1">Optional. Link this resource to a specific quiz, exam, deadline, or other obligation.</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Category *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['PDF', 'PPT', 'Video', 'Flipcard'] as const).map(cat => (
                <button key={cat} onClick={() => { setCategory(cat); setMode('upload'); setFiles([]); setDriveLink(''); setError(''); }} disabled={uploading}
                  className={`p-2.5 rounded-xl border text-sm font-medium transition-all ${
                    category === cat ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                  }`}
                >{cat}</button>
              ))}
            </div>
          </div>

          {/* Submitted By */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Submitted by</label>
            <input type="text" value={user ? `${user.name} (${user.idNumber})` : 'Login required'} readOnly 
              className="w-full p-3 border border-stone-200 rounded-xl bg-stone-50 text-stone-500" />
          </div>

          {/* Upload Mode */}
          {mode === 'upload' && (
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{category === 'Flipcard' ? 'CSV File *' : 'File *'} <span className="text-stone-400">(Max 35MB)</span></label>
              <input ref={fileInputRef} type="file" accept={category === 'Flipcard' ? '.csv,text/csv' : undefined} multiple={category !== 'Flipcard'} onChange={handleFileChange} className="hidden" disabled={uploading} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="w-full p-4 border-2 border-dashed border-stone-300 rounded-xl text-stone-500 hover:border-stone-400 flex items-center justify-center gap-2"
              >
                <Icon name={category === 'Flipcard' ? 'upload_file' : 'cloud_upload'} /> {category === 'Flipcard' ? 'Select CSV file' : 'Select files'}
              </button>
              <p className="text-xs text-stone-400 mt-1">
                {category === 'Flipcard'
                  ? 'Upload a CSV file. The app will auto-detect common question and answer headers.'
                  : <>For larger files, use <button onClick={() => setMode('link')} className="text-blue-500 underline">Paste Link</button></>}
              </p>
              
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg text-sm">
                      <Icon name="description" className="text-stone-400" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-stone-400">{formatFileSize(f.size)}</span>
                      <button onClick={() => removeFile(i)} disabled={uploading} className="text-stone-400 hover:text-red-500">
                        <Icon name="close" className="text-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Link Mode */}
          {mode === 'link' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-stone-600">{category === 'Flipcard' ? 'Google Sheets Link *' : 'Link *'}</label>
                <button onClick={() => setShowInstructions(true)} className="text-xs text-blue-500 flex items-center gap-1">
                  <Icon name="help" className="text-sm" /> How?
                </button>
              </div>
              <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)}
                placeholder={category === 'Flipcard' ? 'https://docs.google.com/spreadsheets/...' : 'https://drive.google.com/...'} disabled={uploading}
                className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
              />
              <p className="text-xs text-stone-400 mt-1">{category === 'Flipcard' ? 'Paste the Google Sheets link for the flipcard set.' : category === 'Video' ? 'Google Drive or YouTube links are supported.' : 'Google Drive, Google Docs, and Google Slides links are supported.'}</p>
            </div>
          )}

          {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

          <button onClick={handleSubmit} disabled={uploading || !user}
            className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {category === 'Flipcard' ? 'Adding Flipcard...' : mode === 'link' ? 'Saving...' : 'Uploading...'}</>
            ) : (
              <><Icon name={category === 'Flipcard' ? 'style' : mode === 'link' ? 'add_link' : 'cloud_upload'} /> {category === 'Flipcard' ? 'Add Flipcard' : mode === 'link' ? 'Add Resource' : 'Upload'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Alert Modal Component (single button, info/warning/error display)
const AlertModal = (props: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  darkMode: boolean;
}) => {
  const { isOpen, onClose, title, message, buttonText = 'OK', type = 'info', darkMode } = props;
  if (!isOpen) return null;

  const iconConfig = {
    info: { icon: 'info', bg: 'bg-blue-100', color: 'text-blue-500' },
    warning: { icon: 'warning', bg: 'bg-amber-100', color: 'text-amber-500' },
    error: { icon: 'error', bg: 'bg-red-100', color: 'text-red-500' },
    success: { icon: 'check_circle', bg: 'bg-emerald-100', color: 'text-emerald-500' }
  };

  const { icon, bg, color } = iconConfig[type];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200`}>
        <div className="p-6">
          <div className={`w-12 h-12 ${bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon name={icon} className={`text-2xl ${color}`} />
          </div>
          <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'} text-center mb-2`}>{title}</h3>
          <p className={`${darkMode ? 'text-gray-300' : 'text-stone-600'} text-center text-sm whitespace-pre-line`}>{message}</p>
        </div>
        <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-stone-200'}`}>
          <button
            onClick={onClose}
            className={`w-full py-3 ${darkMode ? 'text-white hover:bg-gray-700' : 'text-stone-800 hover:bg-stone-50'} font-medium transition-colors`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
const ConfirmModal = (props: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: 'red' | 'green' | 'stone';
  darkMode: boolean;
}) => {
  const { isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', confirmColor = 'red', darkMode } = props;
  if (!isOpen) return null;

  const colorClasses = {
    red: 'bg-red-500 hover:bg-red-600',
    green: 'bg-green-500 hover:bg-green-600',
    stone: 'bg-stone-800 hover:bg-stone-900'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200`}>
        <div className="p-6">
          <div className={`w-12 h-12 ${darkMode ? 'bg-red-900/30' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon name="warning" className="text-2xl text-red-500" />
          </div>
          <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'} text-center mb-2`}>{title}</h3>
          <p className={`${darkMode ? 'text-gray-300' : 'text-stone-600'} text-center text-sm`}>{message}</p>
        </div>
        <div className={`flex border-t ${darkMode ? 'border-gray-700' : 'border-stone-200'}`}>
          <button
            onClick={onClose}
            className={`flex-1 py-3 ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-stone-600 hover:bg-stone-50'} font-medium transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 text-white font-medium transition-colors ${colorClasses[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Exam Detail Modal Component
const ExamDetailModal = ({
  exam,
  onClose,
  onEdit,
  user,
  getExamStatus,
  getTimeUntilExam,
  formatCountdown,
  formatExamDate,
  formatExamTime,
  darkMode,
  linkedResources = [],
  onOpenResource
}: {
  exam: Exam | null;
  onClose: () => void;
  onEdit: (exam: Exam) => void;
  user: User | null;
  getExamStatus: (exam: Exam) => 'upcoming' | 'ongoing' | 'completed';
  getTimeUntilExam: (exam: Exam) => { days: number; hours: number; minutes: number; seconds: number } | null;
  formatCountdown: (exam: Exam) => string;
  formatExamDate: (dateStr: string) => string;
  formatExamTime: (timeStr: string) => string;
  darkMode: boolean;
  linkedResources?: Resource[];
  onOpenResource?: (resource: Resource) => void;
}) => {
  if (!exam) return null;

  const status = getExamStatus(exam);
  const timeUntil = getTimeUntilExam(exam);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up`} onClick={e => e.stopPropagation()}>
        {/* Header with status color */}
        <div className={`p-6 ${
          status === 'ongoing' ? 'bg-green-500' :
          status === 'upcoming' ? 'bg-amber-500' : 'bg-stone-500'
        } text-white rounded-t-2xl`}>
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-1 bg-white/20 text-xs rounded-full font-medium">
                {exam.examType}
              </span>
              <h2 className="text-2xl font-bold mt-2">{exam.courseCode}</h2>
              {exam.courseName && <p className="text-white/80">{exam.courseName}</p>}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <Icon name="close" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm flex-wrap">
            <span className="px-3 py-1 bg-white/20 rounded-full font-medium capitalize">
              {status === 'ongoing' ? '🟢 In Progress' :
               status === 'upcoming' ? '🟡 Upcoming' : '✓ Completed'}
            </span>
            {status === 'upcoming' && timeUntil && (
              <span className="px-3 py-1 bg-white/30 rounded-full font-medium">⏱️ {formatCountdown(exam)}</span>
            )}
          </div>
        </div>

        {/* Countdown Banner for upcoming exams */}
        {status === 'upcoming' && timeUntil && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <span className="text-2xl font-bold text-amber-700">{timeUntil.days}</span>
                <p className="text-xs text-amber-600">days</p>
              </div>
              <span className="text-amber-400">:</span>
              <div className="text-center">
                <span className="text-2xl font-bold text-amber-700">{timeUntil.hours.toString().padStart(2, '0')}</span>
                <p className="text-xs text-amber-600">hours</p>
              </div>
              <span className="text-amber-400">:</span>
              <div className="text-center">
                <span className="text-2xl font-bold text-amber-700">{timeUntil.minutes.toString().padStart(2, '0')}</span>
                <p className="text-xs text-amber-600">mins</p>
              </div>
              <span className="text-amber-400">:</span>
              <div className="text-center">
                <span className="text-2xl font-bold text-amber-700">{timeUntil.seconds.toString().padStart(2, '0')}</span>
                <p className="text-xs text-amber-600">secs</p>
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="p-6 space-y-4">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600">
              <Icon name="event" />
            </div>
            <div>
              <p className="text-sm text-stone-500">Date & Time</p>
              <p className="font-semibold text-stone-800">{formatExamDate(exam.date)}</p>
              <p className="text-stone-600">{formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)}</p>
            </div>
          </div>

          {/* Room */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600">
              <Icon name="meeting_room" />
            </div>
            <div>
              <p className="text-sm text-stone-500">Room</p>
              <p className="font-semibold text-stone-800">{exam.room}</p>
            </div>
          </div>

          {/* Proctor */}
          {exam.proctor && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600">
                <Icon name="person" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Proctor</p>
                <p className="font-semibold text-stone-800">{exam.proctor}</p>
              </div>
            </div>
          )}

          {/* Notes - with preserved line breaks */}
          {exam.notes && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <Icon name="notes" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-stone-500">Notes</p>
                <p className="text-stone-700 whitespace-pre-wrap bg-amber-50 p-3 rounded-xl mt-1 text-sm">{exam.notes}</p>
              </div>
            </div>
          )}

          {linkedResources.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <Icon name="folder_special" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">Linked Resources</p>
                  <p className="font-semibold text-stone-800">{linkedResources.length} item{linkedResources.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {linkedResources.map(resource => (
                  <button
                    key={`${resource.url}-${resource.name}`}
                    onClick={() => onOpenResource?.(resource)}
                    className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-stone-400 hover:shadow-sm transition-all bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-800 truncate">{resource.name || resource.title}</p>
                        <p className="text-xs text-stone-500 mt-1">{resource.category}</p>
                      </div>
                      <span className="text-xs text-blue-600 font-medium">Open</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Added by */}
          {exam.createdByName && (
            <div className="pt-4 border-t border-stone-200">
              <p className="text-xs text-stone-400">Added by {exam.createdByName}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-stone-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
          >
            Close
          </button>
          {user && user.idNumber === exam.createdBy && status !== 'completed' && (
            <button
              onClick={() => { onEdit(exam); onClose(); }}
              className="flex-1 py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-900 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="edit" /> Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Add Exam Modal Component
const AddExamModal = ({ 
  isOpen, 
  onClose, 
  subject,
  subjectName,
  user,
  onAddExam,
  addToast,
  updateToast,
  removeToast,
  darkMode
}: { 
  isOpen: boolean; 
  onClose: () => void;
  subject: string;
  subjectName: string;
  user: User | null;
  onAddExam: (exam: { courseCode: string; courseName: string; examType: string; date: string; startTime: string; endTime: string; room: string; proctor: string; notes: string }) => Promise<boolean>;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
  darkMode: boolean;
}) => {
  const [examType, setExamType] = useState('Activity');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');
  const [proctor, setProctor] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      addToast('Please login first', 'error');
      return;
    }
    
    if (!examType || !date || !startTime || !endTime || !room) {
      addToast('Please fill all required fields', 'error');
      return;
    }
    
    setSubmitting(true);
    
    const success = await onAddExam({
      courseCode: subject,
      courseName: subjectName || subject,
      examType,
      date,
      startTime,
      endTime,
      room,
      proctor,
      notes
    });
    
    setSubmitting(false);
    
    if (success) {
      // Reset form
      setExamType('Midterm');
      setDate('');
      setStartTime('');
      setEndTime('');
      setRoom('');
      setProctor('');
      setNotes('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Add Obligation</h2>
            <button onClick={onClose} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full`}>
              <Icon name="close" className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
            </button>
          </div>
          
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'} mb-4`}>Schedule for {subjectName || subject}</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
              <CustomDropdown
                name="examType"
                value={examType}
                onChange={setExamType}
                options={EXAM_TYPE_OPTIONS}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                <input 
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                <input 
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
              <input 
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g., Room 101, Lab A"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
              <input 
                type="text"
                value={proctor}
                onChange={(e) => setProctor(e.target.value)}
                placeholder="e.g., Prof. Santos"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none"
              />
            </div>
          </div>
          
          <button 
            onClick={handleSubmit} 
            disabled={submitting || !user}
            className="w-full mt-6 py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Adding...</>
            ) : (
              <><Icon name="event" /> Add</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Login Modal Component
// School data constants
const SCHOOL_DATA = {
  schools: ['University of Southeastern Philippines Tagum Unit'],
  colleges: ['College of Teacher Education and Technology'],
  programs: ['Bachelor of Secondary Education'],
  majors: ['Mathematics', 'Filipino', 'English'],
  years: [1, 2, 3, 4, 5, 6]
};

// QR Scanner Component for Registration (inline, no backend save)
const QRScanner = ({ 
  onScan, 
  onError 
}: { 
  onScan: (text: string) => void; 
  onError: (err: string) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [scanMode, setScanMode] = useState<'instructions' | 'camera' | 'upload' | null>('instructions');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // jsQR is now imported statically at the top of the file

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const startCamera = async () => {
    try {
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      onError('Unable to access camera. Please check permissions.');
      setIsScanning(false);
    }
  };

  // Scan QR from camera continuously
  useEffect(() => {
    if (!isScanning || scanMode !== 'camera') return;

    const detectQR = () => {
      if (!videoRef.current || !canvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(detectQR);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (qrCode && qrCode.data) {
          setScannedText(qrCode.data);
          onScan(qrCode.data);
          stopCamera();
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectQR);
    };

    animationFrameRef.current = requestAnimationFrame(detectQR);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScanning, scanMode, onScan]);

  const handleImageUpload = (file: File) => {
    setUploadPreview(null);
    setScannedText('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadPreview(dataUrl);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onError('Canvas not supported');
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (qrCode && qrCode.data) {
          setScannedText(qrCode.data);
          onScan(qrCode.data);
        } else {
          onError('No QR code found in image. Try another image or use camera.');
        }
      };
      img.onerror = () => onError('Failed to load image');
      img.src = dataUrl;
    };
    reader.onerror = () => onError('Failed to read file');
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {scanMode === 'instructions' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <div className="flex gap-2">
              <div className="flex-shrink-0 text-blue-600 font-bold">1</div>
              <div>
                <p className="text-sm font-medium text-blue-900">Visit USEP Attendance System</p>
                <a
                  href="https://usep-qrattendance.site/public/login?page=StudentProfile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded mt-1 hover:bg-blue-700"
                >
                  <Icon name="open_in_new" className="text-sm" />
                  Open Attendance System
                </a>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex gap-2">
              <div className="flex-shrink-0 text-amber-600 font-bold">2</div>
              <p className="text-sm text-amber-900">Screenshot or scan your QR code from your student profile</p>
            </div>
          </div>
          <button
            onClick={() => setScanMode(null)}
            className="w-full bg-stone-800 text-white py-2.5 rounded-xl hover:bg-stone-900 font-medium"
          >
            Continue to Scanner
          </button>
        </div>
      )}

      {scanMode === null && (
        <div className="flex gap-2">
          <button
            onClick={() => { setScanMode('camera'); startCamera(); }}
            className="flex-1 bg-stone-800 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-900 font-medium"
          >
            <Icon name="photo_camera" /> Camera
          </button>
          <button
            onClick={() => { setScanMode('upload'); fileInputRef.current?.click(); }}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 font-medium"
          >
            <Icon name="upload" /> Upload
          </button>
        </div>
      )}

      {scanMode === 'camera' && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-stone-900">
            <video ref={videoRef} autoPlay playsInline muted className="w-full" style={{ aspectRatio: '4/3' }} />
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 border-2 border-white/50 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {isScanning && !scannedText && (
            <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg text-sm text-amber-700 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              Scanning... Point camera at QR code
            </div>
          )}
          <button
            onClick={() => { stopCamera(); setScanMode(null); }}
            className="w-full bg-stone-200 text-stone-700 py-2.5 rounded-xl hover:bg-stone-300 font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      {scanMode === 'upload' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            className="hidden"
          />
          {!uploadPreview && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center cursor-pointer hover:border-stone-400"
            >
              <Icon name="upload" className="text-3xl text-stone-400 mb-1" />
              <p className="text-sm text-stone-600">Click to select QR code image</p>
            </div>
          )}
          {uploadPreview && (
            <img src={uploadPreview} alt="QR Preview" className="w-full rounded-xl border border-stone-200" />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-stone-200 text-stone-700 py-2.5 rounded-xl hover:bg-stone-300 font-medium"
            >
              Choose Another
            </button>
            <button
              onClick={() => { setScanMode(null); setUploadPreview(null); setScannedText(''); }}
              className="flex-1 bg-stone-200 text-stone-700 py-2.5 rounded-xl hover:bg-stone-300 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Password strength checker
const checkPasswordStrength = (password: string): { strength: 'weak' | 'fair' | 'good' | 'strong'; message: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  
  if (score <= 1) return { strength: 'weak', message: 'Weak - Add uppercase, numbers, symbols', color: 'bg-red-500' };
  if (score === 2) return { strength: 'fair', message: 'Fair - Consider adding more variety', color: 'bg-orange-500' };
  if (score === 3) return { strength: 'good', message: 'Good - Almost there!', color: 'bg-yellow-500' };
  return { strength: 'strong', message: 'Strong - Excellent password!', color: 'bg-emerald-500' };
};

// Digital Signature Upload Component (with canvas drawing)
const DigitalSignatureUpload = ({ 
  value, 
  onChange,
  idNumber,
  simpleMode = false // In simple mode, just returns dataURL without uploading
}: { 
  value: string; 
  onChange: (url: string, fileId?: string) => void;
  idNumber?: string;
  simpleMode?: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange('', '');
  };

  const saveSignature = async () => {
    if (!canvasRef.current || !hasDrawn) return;
    
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    
    // Simple mode: just return the dataURL
    if (simpleMode) {
      onChange(dataUrl);
      return;
    }
    
    // Upload mode: upload to backend
    if (!idNumber) {
      alert('ID Number required for upload');
      return;
    }
    
    setUploading(true);
    try {
      const base64 = dataUrl.split(',')[1];
      
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'uploadDigitalSignature',
          idNumber: idNumber,
          data: base64,
          fileName: `signature_${Date.now()}.png`,
          mimeType: 'image/png'
        })
      });

      const result = await response.json();
      if (result.success) {
        onChange(result.url, result.fileId);
      } else {
        alert('Failed to upload signature: ' + result.error);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Simple mode: just return the dataURL
    if (simpleMode) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        onChange(dataUrl);
      };
      reader.readAsDataURL(file);
      return;
    }
    
    // Upload mode
    if (!idNumber) {
      alert('ID Number required for upload');
      return;
    }
    
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'uploadDigitalSignature',
            idNumber: idNumber,
            data: base64,
            fileName: file.name,
            mimeType: file.type
          })
        });

        const result = await response.json();
        if (result.success) {
          onChange(result.url, result.fileId);
        } else {
          alert('Failed to upload signature: ' + result.error);
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-full max-w-sm border-2 border-stone-200 rounded-xl p-2 bg-white">
            <img src={value} alt="Digital Signature" className="w-full h-auto" />
          </div>
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
          >
            Remove Signature
          </button>
        </div>
      ) : (
        <>
          <div className="border-2 border-dashed border-stone-300 rounded-xl bg-stone-50 p-4">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="w-full border border-stone-200 bg-white rounded-lg cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={clearCanvas}
                className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg hover:bg-stone-100"
                disabled={!hasDrawn}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={saveSignature}
                disabled={!hasDrawn || uploading}
                className="flex-1 px-3 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-900 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Save Signature'}
              </button>
            </div>
          </div>
          <div className="text-center">
            <span className="text-sm text-stone-500">or</span>
          </div>
          <div className="text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-sm border border-stone-300 rounded-lg hover:bg-stone-50"
            >
              Upload Signature Image
            </button>
          </div>
        </>
      )}
      <p className="text-xs text-stone-500 text-center">
        {value ? '✓ Signature saved' : 'Draw your signature or upload an image'}
      </p>
    </div>
  );
};

// Email OTP Verification Component
const EmailOTPVerification = ({
  idNumber,
  email,
  emailType,
  onVerified,
  onCancel,
  addToast,
  updateToast,
  removeToast
}: {
  idNumber: string;
  email: string;
  emailType: 'personal' | 'school';
  onVerified: () => void;
  onCancel: () => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
}) => {
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [expiryLeft, setExpiryLeft] = useState(0);
  const [locked, setLocked] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const resendSchedule = [30, 60, 300, 43200];
  const [resendStep, setResendStep] = useState(0);
  const [resendLeft, setResendLeft] = useState(resendSchedule[0]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Send initial OTP
    sendOTP();
  }, []);

  useEffect(() => {
    // Reset state when switching email/type
    setOtpCode(['', '', '', '', '', '']);
    setLocked(false);
    setError('');
    setCanResend(false);
    setResendStep(0);
    setResendLeft(resendSchedule[0]);
    setExpiryLeft(0);
  }, [email, emailType]);

  useEffect(() => {
    if (resendLeft <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => setResendLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendLeft]);

  useEffect(() => {
    if (expiryLeft <= 0) return;
    const timer = setInterval(() => setExpiryLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [expiryLeft]);

  const sendOTP = async () => {
    setError('');
    setCanResend(false);
    setResendLeft(resendSchedule[resendStep]);
    const toastId = addToast('Sending verification code...', 'loading');
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'sendEmailOTP',
          idNumber,
          email,
          emailType
        })
      });

      const result = await response.json();
      
      if (result.success) {
        updateToast(toastId, `Code sent to ${email}`, 'success');
        setTimeout(() => removeToast(toastId), 3000);
        const cooldownSeconds = result.remainingSeconds || result.cooldownSeconds || resendSchedule[resendStep];
        setResendLeft(cooldownSeconds);
        setResendStep(prev => Math.min(prev + 1, resendSchedule.length - 1));

        if (result.expiresAt) {
          const expiry = new Date(result.expiresAt).getTime();
          const now = Date.now();
          const seconds = Math.floor((expiry - now) / 1000);
          setExpiryLeft(Math.max(0, seconds));
        }
        
        if (result.locked) {
          setLocked(true);
          setResendLeft(result.remainingSeconds || cooldownSeconds);
        }
      } else {
        updateToast(toastId, result.error || 'Failed to send code', 'error');
        setTimeout(() => removeToast(toastId), 3000);
        setError(result.error || 'Failed to send code');
        
        if (result.locked) {
          setLocked(true);
          setResendLeft(result.remainingSeconds || resendSchedule[resendStep]);
        }
      }
    } catch (err: any) {
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
      setError('Network error. Please try again.');
    }
  };

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1); // Take last character only
    setOtpCode(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits entered
    if (index === 5 && value && newOtp.every(d => d)) {
      verifyOTP(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
    setOtpCode(newOtp as string[]);
    
    if (pastedData.length === 6) {
      verifyOTP(pastedData);
    }
  };

  const verifyOTP = async (code: string) => {
    setVerifying(true);
    setError('');

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'verifyEmailOTP',
          idNumber,
          email,
          emailType,
          otpCode: code
        })
      });

      const result = await response.json();
      
      if (result.success && result.verified) {
        const toastId = addToast('Email verified successfully!', 'success');
        setTimeout(() => removeToast(toastId), 2000);
        onVerified();
      } else {
        setError(result.error || 'Invalid verification code');
        setOtpCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        
        if (result.locked) {
          setLocked(true);
          setResendLeft(result.remainingSeconds || resendSchedule[resendStep]);
        }
        
        if (result.attempts) {
          setError(`${result.error} (${result.remainingAttempts || 0} attempts remaining)`);
        }
      }
    } catch (err: any) {
      setError('Network error. Please try again.');
      setOtpCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-stone-700 mb-2">Verify {emailType === 'school' ? 'School' : 'Personal'} Email</h3>
        <p className="text-sm text-stone-600">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>
      </div>

      <div className="flex justify-center gap-2" onPaste={handlePaste}>
        {otpCode.map((digit, index) => (
          <input
            key={index}
            ref={el => inputRefs.current[index] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={verifying || locked}
            className="w-12 h-14 text-center text-2xl font-bold border-2 border-stone-300 rounded-xl focus:border-stone-600 focus:ring-2 focus:ring-stone-200 outline-none disabled:bg-stone-100"
          />
        ))}
      </div>

      {error && (
        <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg text-center">
          {error}
        </div>
      )}

      {locked ? (
        <div className="text-amber-600 text-sm bg-amber-50 p-3 rounded-lg text-center">
          <Icon name="lock" className="inline mr-1" />
          Too many attempts. Try again in {formatTime(resendLeft)}
        </div>
      ) : (
        <div className="text-center text-sm text-stone-500">
          {canResend ? 'You can resend a new code now.' : `You can resend in ${formatTime(Math.max(resendLeft, 0))}`}
          {expiryLeft > 0 && <div>Code expires in {formatTime(expiryLeft)}</div>}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 border border-stone-300 text-stone-700 rounded-xl font-semibold hover:bg-stone-50"
          disabled={verifying}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={sendOTP}
          disabled={!canResend || verifying || locked}
          className="flex-1 py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 disabled:opacity-50"
        >
          {locked ? 'Locked' : verifying ? 'Verifying...' : canResend ? 'Resend Code' : 'Sending...'}
        </button>
      </div>
    </div>
  );
};

// =====================================================
// IMAGE UPLOAD UTILITIES (CORS-RESILIENT)
// =====================================================

/**
 * Validate an image file before upload
 */
const validateImageFile = (file: File, maxSizeMB: number = 5): { valid: boolean; error?: string } => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return { valid: false, error: 'Invalid file type. Allowed: PNG, JPG, WebP, GIF' };
  }
  
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }
  
  return { valid: true };
};

/**
 * Convert File to base64 (stripped of data URL prefix)
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Strip data URL prefix
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Extract Google Drive file ID from various URL formats
 */
const extractDriveFileId = (url: string): string | null => {
  if (!url) return null;
  
  // Pattern 1: googleusercontent.com/d/{fileId}
  const googleUserContentMatch = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (googleUserContentMatch) return googleUserContentMatch[1];
  
  // Pattern 2: drive.google.com/thumbnail?id={fileId} or uc?...&id={fileId}
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  
  // Pattern 3: drive.google.com/file/d/{fileId}/
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) return fileDMatch[1];
  
  return null;
};

/**
 * Add cache-busting timestamp to URL
 */
const addCacheBuster = (url: string): string => {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

// =====================================================
// RESILIENT DRIVE IMAGE COMPONENT
// =====================================================

/**
 * DriveImage - Resilient Google Drive Image Component
 * Implements automatic fallback logic when primary URLs fail
 */
const DriveImage = ({ 
  src, 
  alt, 
  className = '', 
  style,
  fallbackIcon,
  cacheBust = true,
  onLoad,
  onError
}: { 
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackIcon?: React.ReactNode;
  cacheBust?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}) => {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Generate fallback URLs
  const fallbackUrls = React.useMemo(() => {
    if (!src) return [];
    
    const fileId = extractDriveFileId(src);
    
    if (!fileId) {
      // If src is base64 or non-Drive URL, use as-is
      return [src];
    }
    
    // Order: primary googleusercontent -> thumbnail -> direct
    return [
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`,
      `https://drive.google.com/uc?export=view&id=${fileId}`
    ];
  }, [src]);
  
  // Get current URL with optional cache busting
  const currentUrl = React.useMemo(() => {
    const url = fallbackUrls[currentUrlIndex];
    if (!url) return '';
    return cacheBust ? addCacheBuster(url) : url;
  }, [fallbackUrls, currentUrlIndex, cacheBust]);
  
  // Reset state when src changes
  useEffect(() => {
    setCurrentUrlIndex(0);
    setIsLoading(true);
    setHasError(false);
  }, [src]);
  
  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };
  
  const handleError = () => {
    const nextIndex = currentUrlIndex + 1;
    
    if (nextIndex < fallbackUrls.length) {
      setCurrentUrlIndex(nextIndex);
    } else {
      setIsLoading(false);
      setHasError(true);
      onError?.();
    }
  };
  
  // Show fallback if no src or all fallbacks failed
  if (!src || hasError) {
    return (
      <div className={`flex items-center justify-center bg-stone-100 text-stone-400 ${className}`} style={style}>
        {fallbackIcon || <Icon name="person" className="text-3xl" />}
      </div>
    );
  }
  
  // For blob URLs (local previews), render directly without fallback logic
  if (src.startsWith('blob:') || src.startsWith('data:')) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, objectFit: 'cover' }}
        onLoad={onLoad}
        onError={onError}
      />
    );
  }
  
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-stone-200 rounded-full" />
      )}
      <img
        src={currentUrl}
        alt={alt}
        className="w-full h-full"
        style={{ objectFit: 'cover', opacity: isLoading ? 0 : 1, transition: 'opacity 0.2s', borderRadius: 'inherit' }}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

// =====================================================
// PROFILE PICTURE UPLOAD COMPONENT (CORS-RESILIENT)
// =====================================================

const ProfilePictureUpload = ({ 
  value, 
  onChange,
  onUploadComplete,
  idNumber,
  firstName,
  lastName
}: { 
  value: string; 
  onChange: (url: string) => void;
  onUploadComplete?: (upload: { url: string; fileId?: string }) => void;
  idNumber?: string;
  firstName?: string;
  lastName?: string;
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // PHASE 1: Validation
    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }
    
    setError(null);
    
    // PHASE 1: Instant preview using URL.createObjectURL
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    
    setUploading(true);
    try {
      // PHASE 1: Convert to Base64 (stripped of prefix)
      const base64Data = await fileToBase64(file);
      
      // PHASE 2: CORS-safe upload with text/plain Content-Type
      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          // CRITICAL: Use text/plain to bypass CORS preflight
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: 'uploadProfilePicture',
          data: base64Data,
          fileName: file.name,
          mimeType: file.type,
          idNumber: idNumber,
          firstName: firstName,
          lastName: lastName
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.url) {
        // PHASE 3: Use the googleusercontent URL from backend
        onChange(result.url);
        onUploadComplete?.({ url: result.url, fileId: result.fileId });
        // Clean up preview
        URL.revokeObjectURL(preview);
        setPreviewUrl(null);
      } else {
        setError(result.error || 'Upload failed');
        // Keep preview as visual feedback but don't set as value
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Display URL: use preview during upload, otherwise use saved value
  const displayUrl = previewUrl || value;

  return (
    <div className="flex flex-col items-center gap-3">
      <div 
        className="w-24 h-24 rounded-full bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-stone-400 transition-all"
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
        ) : displayUrl ? (
          // PHASE 4: Use DriveImage for resilient rendering with fallbacks
          <DriveImage 
            src={displayUrl} 
            alt="Profile" 
            className="w-full h-full rounded-full"
            fallbackIcon={<Icon name="add_a_photo" className="text-3xl text-stone-400" />}
            cacheBust={!previewUrl} // Don't cache-bust local preview URLs
          />
        ) : (
          <Icon name="add_a_photo" className="text-3xl text-stone-400" />
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : (
        <p className="text-xs text-stone-500">Click to upload profile picture</p>
      )}
    </div>
  );
};

// Registration Form Component
const RegistrationForm = ({
  onRegister,
  onBack,
  addToast,
  updateToast,
  removeToast
}: {
  onRegister: (user: User) => void;
  onBack: () => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
}) => {
  // No longer need UUID - idNumber is the primary key
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [personalVerified, setPersonalVerified] = useState(false);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmailType, setOtpEmailType] = useState<'personal' | 'school'>('personal');
  const [otpEmail, setOtpEmail] = useState('');
  
  // Validation states
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available: boolean | null; error?: string }>({ checking: false, available: null });
  const [idNumberStatus, setIdNumberStatus] = useState<{ checking: boolean; available: boolean | null; valid: boolean | null; error?: string }>({ checking: false, available: null, valid: null });
  const [emailStatus, setEmailStatus] = useState<{ checking: boolean; available: boolean | null; valid: boolean | null; error?: string }>({ checking: false, available: null, valid: null });
  const [schoolEmailStatus, setSchoolEmailStatus] = useState<{ checking: boolean; available: boolean | null; valid: boolean | null; error?: string }>({ checking: false, available: null, valid: null });
  
  // Form fields
  const [formData, setFormData] = useState({
    profilePicture: '',
    profilePictureFileId: '',
    firstName: '',
    lastName: '',
    idNumber: '',
    birthday: '',
    email: '',
    schoolEmail: '',
    school: SCHOOL_DATA.schools[0],
    college: SCHOOL_DATA.colleges[0],
    program: SCHOOL_DATA.programs[0],
    major: '',
    year: 1,
    section: '',
    digitalSignature: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  const passwordStrength = checkPasswordStrength(formData.password);

  const validateIdFormat = (id: string) => /^\d{4}-\d{5}$/.test(id);
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Check username availability with debounce
  useEffect(() => {
    if (formData.username.length < 4) {
      setUsernameStatus({ checking: false, available: null });
      return;
    }
    
    setUsernameStatus(prev => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'checkUsername', username: formData.username })
        });
        const result = await response.json();
        setUsernameStatus({ checking: false, available: result.available === true, error: result.error });
      } catch (err) {
        setUsernameStatus({ checking: false, available: null, error: 'Could not verify' });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.username]);

  // Check ID number availability with debounce
  useEffect(() => {
    if (!formData.idNumber) {
      setIdNumberStatus({ checking: false, available: null, valid: null });
      return;
    }
    
    if (!validateIdFormat(formData.idNumber)) {
      setIdNumberStatus({ checking: false, available: null, valid: false, error: 'Invalid format. Use: YYYY-NNNNN' });
      return;
    }
    
    setIdNumberStatus(prev => ({ ...prev, checking: true, valid: true }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'checkIdNumber', idNumber: formData.idNumber })
        });
        const result = await response.json();
        setIdNumberStatus({ checking: false, available: result.available === true, valid: result.valid !== false, error: result.error });
      } catch (err) {
        setIdNumberStatus({ checking: false, available: null, valid: true, error: 'Could not verify' });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.idNumber]);

  // Check email availability with debounce
  useEffect(() => {
    if (!formData.email) {
      setEmailStatus({ checking: false, available: null, valid: null });
      return;
    }
    
    if (!validateEmail(formData.email)) {
      setEmailStatus({ checking: false, available: null, valid: false, error: 'Invalid email format' });
      return;
    }
    
    setEmailStatus(prev => ({ ...prev, checking: true, valid: true }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'checkEmail', email: formData.email, type: 'personal' })
        });
        const result = await response.json();
        setEmailStatus({ checking: false, available: result.available === true, valid: result.valid !== false, error: result.error });
      } catch (err) {
        setEmailStatus({ checking: false, available: null, valid: true, error: 'Could not verify' });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.email]);

  // Check school email availability with debounce
  useEffect(() => {
    if (!formData.schoolEmail) {
      setSchoolEmailStatus({ checking: false, available: null, valid: null });
      return;
    }
    
    if (!validateEmail(formData.schoolEmail)) {
      setSchoolEmailStatus({ checking: false, available: null, valid: false, error: 'Invalid email format' });
      return;
    }
    
    // Check if school email is same as personal email
    if (formData.schoolEmail.toLowerCase() === formData.email.toLowerCase()) {
      setSchoolEmailStatus({ checking: false, available: false, valid: true, error: 'Must be different from personal email' });
      return;
    }
    
    setSchoolEmailStatus(prev => ({ ...prev, checking: true, valid: true }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'checkEmail', email: formData.schoolEmail, type: 'school' })
        });
        const result = await response.json();
        setSchoolEmailStatus({ checking: false, available: result.available === true, valid: result.valid !== false, error: result.error });
      } catch (err) {
        setSchoolEmailStatus({ checking: false, available: null, valid: true, error: 'Could not verify' });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.schoolEmail, formData.email]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    if (field === 'email') {
      setPersonalVerified(false);
      setSchoolVerified(false);
    }
    if (field === 'schoolEmail') {
      setSchoolVerified(false);
    }
  };

  const openOtpForEmail = (type: 'personal' | 'school') => {
    if (type === 'personal') {
      if (!formData.email || !validateEmail(formData.email) || emailStatus.available === false) {
        setError('Please enter an available personal email first');
        return;
      }
      setOtpEmail(formData.email);
    } else {
      if (!formData.schoolEmail || !validateEmail(formData.schoolEmail) || schoolEmailStatus.available === false) {
        setError('Please enter an available school email first');
        return;
      }
      setOtpEmail(formData.schoolEmail);
    }
    setOtpEmailType(type);
    setShowOtpModal(true);
  };

  const validateStep = (stepNum: number): boolean => {
    switch (stepNum) {
      case 1:
        if (!formData.profilePicture) {
          setError('Please upload a profile picture');
          return false;
        }
        if (!formData.firstName.trim() || !formData.lastName.trim()) {
          setError('Please enter your first and last name');
          return false;
        }
        if (!formData.idNumber) {
          setError('Please enter your ID number');
          return false;
        }
        if (!validateIdFormat(formData.idNumber)) {
          setError('Invalid ID format. Use: YYYY-NNNNN (e.g., 2025-00000)');
          return false;
        }
        if (idNumberStatus.checking) {
          setError('Please wait while we verify your ID number');
          return false;
        }
        if (idNumberStatus.available === false) {
          setError('This ID number is already registered');
          return false;
        }
        if (!formData.birthday) {
          setError('Please enter your birthday');
          return false;
        }
        return true;
      case 2:
        if (!formData.email) {
          setError('Please enter your personal email');
          return false;
        }
        if (!validateEmail(formData.email)) {
          setError('Please enter a valid email');
          return false;
        }
        if (emailStatus.checking) {
          setError('Please wait while we verify your email');
          return false;
        }
        if (emailStatus.available === false) {
          setError(emailStatus.error || 'This email is already registered');
          return false;
        }
        if (!personalVerified) {
          setError('Please verify your personal email to continue');
          return false;
        }
        if (!formData.schoolEmail) {
          setError('Please enter your school email');
          return false;
        }
        if (!validateEmail(formData.schoolEmail)) {
          setError('Please enter a valid school email');
          return false;
        }
        if (schoolEmailStatus.checking) {
          setError('Please wait while we verify your school email');
          return false;
        }
        if (schoolEmailStatus.available === false) {
          setError(schoolEmailStatus.error || 'This school email is already registered');
          return false;
        }
        if (!schoolVerified) {
          setError('Please verify your school email');
          return false;
        }
        return true;
      case 3:
        if (!formData.major) {
          setError('Please select your major');
          return false;
        }
        if (!formData.section.trim()) {
          setError('Please enter your section');
          return false;
        }
        return true;
      case 4:
        if (!formData.digitalSignature) {
          setError('Please provide your digital signature');
          return false;
        }
        return true;
      case 5:
        if (!formData.username || formData.username.length < 4) {
          setError('Username must be at least 4 characters');
          return false;
        }
        if (usernameStatus.checking) {
          setError('Please wait while we verify username availability');
          return false;
        }
        if (usernameStatus.available !== true) {
          setError(usernameStatus.error || 'Username is not available');
          return false;
        }
        if (!formData.password || formData.password.length < 8) {
          setError('Password must be at least 8 characters');
          return false;
        }
        if (passwordStrength.strength === 'weak') {
          setError('Password is too weak. Add uppercase, numbers, or symbols.');
          return false;
        }
        if (!formData.confirmPassword) {
          setError('Please confirm your password');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setError('');
      setStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    setLoading(true);
    const toastId = addToast('Creating your account...', 'loading');

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'registerUser',
          idNumber: formData.idNumber,  // Primary key
          username: formData.username,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          schoolEmail: formData.schoolEmail,
          birthday: formData.birthday,
          school: formData.school,
          college: formData.college,
          program: formData.program,
          major: formData.major,
          year: formData.year,
          section: formData.section,
          digitalSignatureURL: formData.digitalSignature,
          profilePictureURL: formData.profilePicture,
          profilePictureFileId: formData.profilePictureFileId,
          emailVerified: personalVerified,
          schoolEmailVerified: schoolVerified
        })
      });

      const result = await response.json();

      if (result.success) {
        // Map fullName to name for backward compatibility
        const user: User = {
          ...result.user,
          name: result.user.fullName || `${result.user.firstName} ${result.user.lastName}`,
          profilePicture: result.user.profilePictureURL
        };
        if (personalVerified && (!user.schoolEmail || schoolVerified)) {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
          updateToast(toastId, 'Account created successfully!', 'success');
          setTimeout(() => removeToast(toastId), 3000);
          onRegister(user);
        } else {
          setPendingUser(user);
          setOtpEmailType('personal');
          setOtpEmail(user.email);
          setShowOtpModal(true);
          updateToast(toastId, 'Account created. Please verify your email.', 'success');
          setTimeout(() => removeToast(toastId), 3000);
        }
      } else {
        setError(result.error || 'Registration failed. Please try again.');
        updateToast(toastId, result.error || 'Registration failed', 'error');
        setTimeout(() => removeToast(toastId), 3000);
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-stone-700 mb-4">Personal Information</h3>
            
            <div className="flex flex-col items-center">
              <ProfilePictureUpload 
                value={formData.profilePicture} 
                onChange={(url) => updateField('profilePicture', url)}
                onUploadComplete={({ fileId }) => {
                  if (fileId) {
                    updateField('profilePictureFileId' as any, fileId);
                  }
                }}
                idNumber={formData.idNumber}
                firstName={formData.firstName}
                lastName={formData.lastName}
              />
              {!formData.profilePicture && (
                <p className="text-xs text-amber-600 mt-1">* Profile picture is required</p>
              )}
              {formData.profilePicture && (
                <p className="text-xs text-emerald-600 mt-1">✓ Profile picture uploaded</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">First Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    placeholder="Juan"
                    className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${
                      formData.firstName.trim() ? 'border-emerald-500' : 'border-stone-200'
                    }`}
                  />
                  {formData.firstName.trim() && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon name="check_circle" className="text-emerald-500" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">Last Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder="Dela Cruz"
                    className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${
                      formData.lastName.trim() ? 'border-emerald-500' : 'border-stone-200'
                    }`}
                  />
                  {formData.lastName.trim() && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon name="check_circle" className="text-emerald-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">ID Number *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.idNumber}
                  onChange={(e) => updateField('idNumber', e.target.value)}
                  placeholder="2025-00000"
                  className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${
                    idNumberStatus.available === true && idNumberStatus.valid === true ? 'border-emerald-500' : 
                    idNumberStatus.available === false || idNumberStatus.valid === false ? 'border-red-500' : 
                    'border-stone-200'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {idNumberStatus.checking ? (
                    <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  ) : idNumberStatus.available === true && idNumberStatus.valid === true ? (
                    <Icon name="check_circle" className="text-emerald-500" />
                  ) : (idNumberStatus.available === false || idNumberStatus.valid === false) ? (
                    <Icon name="cancel" className="text-red-500" />
                  ) : null}
                </div>
              </div>
              <p className={`text-xs mt-1 ${
                idNumberStatus.available === true && idNumberStatus.valid === true ? 'text-emerald-500' :
                idNumberStatus.available === false || idNumberStatus.valid === false ? 'text-red-500' :
                'text-stone-400'
              }`}>
                {idNumberStatus.checking ? 'Verifying...' :
                 idNumberStatus.available === true && idNumberStatus.valid === true ? '✓ ID number is available' :
                 idNumberStatus.error ? `✗ ${idNumberStatus.error}` :
                 'Format: YYYY-NNNNN (e.g., 2025-12345)'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Birthday *</label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => updateField('birthday', e.target.value)}
                  className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${
                    formData.birthday ? 'border-emerald-500' : 'border-stone-200'
                  }`}
                />
                {formData.birthday && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Icon name="check_circle" className="text-emerald-500" />
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-stone-700 mb-4">Contact Information</h3>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Personal Email *</label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="juan@email.com"
                  className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${
                    emailStatus.available === true && emailStatus.valid === true ? 'border-emerald-500' : 
                    emailStatus.available === false || emailStatus.valid === false ? 'border-red-500' : 
                    'border-stone-200'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {emailStatus.checking ? (
                    <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  ) : emailStatus.available === true && emailStatus.valid === true ? (
                    <Icon name="check_circle" className="text-emerald-500" />
                  ) : (emailStatus.available === false || emailStatus.valid === false) ? (
                    <Icon name="cancel" className="text-red-500" />
                  ) : null}
                </div>
              </div>
              <p className={`text-xs mt-1 ${
                emailStatus.available === true && emailStatus.valid === true ? 'text-emerald-500' :
                emailStatus.available === false || emailStatus.valid === false ? 'text-red-500' :
                'text-stone-400'
              }`}>
                {emailStatus.checking ? 'Verifying...' :
                 emailStatus.available === true && emailStatus.valid === true ? '✓ Email is available' :
                 emailStatus.error ? `✗ ${emailStatus.error}` :
                 'Enter your personal email address'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => openOtpForEmail('personal')}
                  disabled={personalVerified || emailStatus.checking || emailStatus.available === false || !formData.email || !validateEmail(formData.email)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${personalVerified ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-white hover:bg-stone-900 disabled:opacity-50'}`}
                >
                  {personalVerified ? 'Personal Email Verified' : 'Verify Personal Email'}
                </button>
                {!personalVerified && <span className="text-xs text-stone-500">Required before school email</span>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">School Email *</label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.schoolEmail}
                  onChange={(e) => updateField('schoolEmail', e.target.value)}
                  placeholder="juan@usep.edu.ph"
                  disabled={!personalVerified}
                  className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${
                    formData.schoolEmail && schoolEmailStatus.available === true && schoolEmailStatus.valid === true ? 'border-emerald-500' : 
                    formData.schoolEmail && (schoolEmailStatus.available === false || schoolEmailStatus.valid === false) ? 'border-red-500' : 
                    'border-stone-200'
                  }`}
                />
                {formData.schoolEmail && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {schoolEmailStatus.checking ? (
                      <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                    ) : schoolEmailStatus.available === true && schoolEmailStatus.valid === true ? (
                      <Icon name="check_circle" className="text-emerald-500" />
                    ) : (schoolEmailStatus.available === false || schoolEmailStatus.valid === false) ? (
                      <Icon name="cancel" className="text-red-500" />
                    ) : null}
                  </div>
                )}
              </div>
              {!personalVerified && (
                <p className="text-xs mt-1 text-amber-600">Verify personal email first before adding school email.</p>
              )}
              {personalVerified && formData.schoolEmail && (
                <p className={`text-xs mt-1 ${
                  schoolEmailStatus.available === true && schoolEmailStatus.valid === true ? 'text-emerald-500' :
                  schoolEmailStatus.available === false || schoolEmailStatus.valid === false ? 'text-red-500' :
                  'text-stone-400'
                }`}>
                  {schoolEmailStatus.checking ? 'Verifying...' :
                   schoolEmailStatus.available === true && schoolEmailStatus.valid === true ? '✓ School email is available' :
                   schoolEmailStatus.error ? `✗ ${schoolEmailStatus.error}` :
                   'Enter your school email address'}
                </p>
              )}
              {personalVerified && formData.schoolEmail && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => openOtpForEmail('school')}
                    disabled={schoolVerified || schoolEmailStatus.checking || schoolEmailStatus.available === false}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${schoolVerified ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-white hover:bg-stone-900 disabled:opacity-50'}`}
                  >
                    {schoolVerified ? 'School Email Verified' : 'Verify School Email'}
                  </button>
                  {!schoolVerified && <span className="text-xs text-stone-500">Optional but recommended</span>}
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-stone-700 mb-4">Academic Information</h3>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">School</label>
              <CustomDropdown
                name="school"
                value={formData.school}
                onChange={(nextValue) => updateField('school', nextValue)}
                options={SCHOOL_DATA.schools.map(s => ({ value: s, label: s }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">College</label>
              <CustomDropdown
                name="college"
                value={formData.college}
                onChange={(nextValue) => updateField('college', nextValue)}
                options={SCHOOL_DATA.colleges.map(c => ({ value: c, label: c }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Program</label>
              <CustomDropdown
                name="program"
                value={formData.program}
                onChange={(nextValue) => updateField('program', nextValue)}
                options={SCHOOL_DATA.programs.map(p => ({ value: p, label: p }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Major *</label>
              <CustomDropdown
                name="major"
                value={formData.major}
                onChange={(nextValue) => updateField('major', nextValue)}
                options={[
                  { value: '', label: 'Select your major' },
                  ...SCHOOL_DATA.majors.map(m => ({ value: m, label: m }))
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">Year Level *</label>
                <CustomDropdown
                  name="year"
                  value={String(formData.year)}
                  onChange={(nextValue) => updateField('year', parseInt(nextValue))}
                  options={SCHOOL_DATA.years.map(y => ({ value: String(y), label: `Year ${y}` }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">Section *</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => updateField('section', e.target.value.toUpperCase())}
                  placeholder="A"
                  maxLength={5}
                  className="w-full p-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-stone-700 mb-4">Digital Signature</h3>
            <p className="text-sm text-stone-500 mb-4">
              Draw or upload your digital signature for official documents.
            </p>
            
            <DigitalSignatureUpload
              value={formData.digitalSignature}
              onChange={(url) => updateField('digitalSignature', url)}
              simpleMode={true}
            />
            
            {formData.digitalSignature && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Icon name="check_circle" className="text-xl" />
                  <span className="font-medium">Signature Captured</span>
                </div>
              </div>
            )}
            
            {!formData.digitalSignature && (
              <p className="text-xs text-amber-600">* Digital signature is required to continue</p>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-stone-700 mb-4">Account Credentials</h3>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Username *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => updateField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="juandelacruz"
                  className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none pr-10 ${
                    usernameStatus.available === true ? 'border-emerald-500' : 
                    usernameStatus.available === false ? 'border-red-500' : 'border-stone-200'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus.checking ? (
                    <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  ) : usernameStatus.available === true ? (
                    <Icon name="check_circle" className="text-emerald-500" />
                  ) : usernameStatus.available === false ? (
                    <Icon name="cancel" className="text-red-500" />
                  ) : null}
                </div>
              </div>
              <p className={`text-xs mt-1 ${
                usernameStatus.available === true ? 'text-emerald-500' :
                usernameStatus.available === false ? 'text-red-500' :
                'text-stone-400'
              }`}>
                {usernameStatus.checking ? 'Checking availability...' :
                 usernameStatus.available === true ? '✓ Username is available' : 
                 usernameStatus.available === false ? '✗ Username is already taken' : 
                 'Only lowercase letters, numbers, and underscores (min 4 chars)'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 pr-10 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 outline-none"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map(i => (
                      <div 
                        key={i} 
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= (passwordStrength.strength === 'weak' ? 1 : 
                                passwordStrength.strength === 'fair' ? 2 : 
                                passwordStrength.strength === 'good' ? 3 : 4) 
                            ? passwordStrength.color : 'bg-stone-200'
                        }`} 
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.strength === 'weak' ? 'text-red-500' :
                    passwordStrength.strength === 'fair' ? 'text-orange-500' :
                    passwordStrength.strength === 'good' ? 'text-yellow-600' :
                    'text-emerald-500'
                  }`}>{passwordStrength.message}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Confirm Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder="••••••••"
                  className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${
                    formData.confirmPassword && formData.password !== formData.confirmPassword 
                      ? 'border-red-500' 
                      : formData.confirmPassword && formData.password === formData.confirmPassword 
                      ? 'border-emerald-500' 
                      : 'border-stone-200'
                  }`}
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <Icon name={showConfirmPassword ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <p className="text-xs text-emerald-500 mt-1">✓ Passwords match</p>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Fixed Header - Progress indicator */}
      <div className="flex-shrink-0 flex items-center justify-center gap-1 pb-4 border-b border-stone-200">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className="flex items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              s < step ? 'bg-emerald-500 text-white' : 
              s === step ? 'bg-stone-800 text-white' : 
              'bg-stone-200 text-stone-500'
            }`}>
              {s < step ? <Icon name="check" className="text-sm" /> : s}
            </div>
            {s < 5 && <div className={`w-4 h-0.5 ${s < step ? 'bg-emerald-500' : 'bg-stone-200'}`} />}
          </div>
        ))}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 px-0.5 space-y-4">
        {renderStep()}

        {error && (
          <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2">
            <Icon name="error" className="text-lg" />
            {error}
          </div>
        )}
      </div>

      {/* Fixed Footer - Buttons */}
      <div className="flex-shrink-0 flex gap-3 pt-4 mt-4 border-t border-stone-200">
        <button
          onClick={step === 1 ? onBack : () => setStep(prev => prev - 1)}
          className="flex-1 py-3 border border-stone-300 text-stone-700 rounded-xl font-semibold hover:bg-stone-50 transition-all"
        >
          {step === 1 ? 'Back to Login' : 'Previous'}
        </button>
        {step < 5 ? (
          <button
            onClick={handleNext}
            disabled={step === 2 && (!personalVerified || (formData.schoolEmail && !schoolVerified))}
            className="flex-1 py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 transition-all disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        )}
      </div>

      {showOtpModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <EmailOTPVerification
              idNumber={pendingUser?.idNumber || formData.idNumber}
              email={otpEmail}
              emailType={otpEmailType}
              addToast={addToast}
              updateToast={updateToast}
              removeToast={removeToast}
              onCancel={() => {
                setShowOtpModal(false);
                setPendingUser(null);
              }}
              onVerified={() => {
                if (otpEmailType === 'personal') setPersonalVerified(true);
                if (otpEmailType === 'school') setSchoolVerified(true);
                if (!pendingUser) {
                  // Pre-registration verification path
                  setShowOtpModal(false);
                  return;
                }
                const updatedUser: User = {
                  ...pendingUser,
                  emailVerified: otpEmailType === 'personal' ? true : pendingUser.emailVerified,
                  schoolEmailVerified: otpEmailType === 'school' ? true : pendingUser.schoolEmailVerified
                };

                if (otpEmailType === 'personal' && pendingUser.schoolEmail) {
                  setPendingUser(updatedUser);
                  setOtpEmailType('school');
                  setOtpEmail(pendingUser.schoolEmail);
                  setShowOtpModal(true);
                  return;
                }

                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
                onRegister(updatedUser);
                setShowOtpModal(false);
                setPendingUser(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Profile Page Component
const ProfilePage = ({
  user,
  onClose,
  onLogout,
  onUpdate,
  addToast,
  updateToast,
  removeToast,
  darkMode = false,
  setDarkMode
}: {
  user: User;
  onClose: () => void;
  onLogout: () => void;
  onUpdate: (user: User) => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
  darkMode?: boolean;
  setDarkMode: (mode: boolean) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    ...user,
    birthday: toDateInputValue(user.birthday),
    newUsername: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpEmailType, setOtpEmailType] = useState<'personal' | 'school'>('personal');
  const [pendingProfileUser, setPendingProfileUser] = useState<User | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available: boolean | null; error?: string }>({ checking: false, available: null });
  const [emailStatus, setEmailStatus] = useState<{ checking: boolean; available: boolean | null; error?: string }>({ checking: false, available: null });
  const [schoolEmailStatus, setSchoolEmailStatus] = useState<{ checking: boolean; available: boolean | null; error?: string }>({ checking: false, available: null });

  // Validate email format
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const personalEmailChanged = !!editData.email && editData.email !== user.email;
  const schoolEmailChanged = !!editData.schoolEmail && editData.schoolEmail !== user.schoolEmail;

  const getVerificationBadge = (verified?: boolean) => verified ? {
    label: 'Verified',
    className: darkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700',
    icon: 'verified'
  } : {
    label: 'Unverified',
    className: darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700',
    icon: 'error'
  };

  // Check username availability
  useEffect(() => {
    if (!editData.newUsername || editData.newUsername.length < 4 || editData.newUsername === user.username) {
      setUsernameStatus({ checking: false, available: null });
      return;
    }
    
    setUsernameStatus(prev => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'checkUsername', username: editData.newUsername })
        });
        const result = await response.json();
        setUsernameStatus({ checking: false, available: result.available === true, error: result.error });
      } catch {
        setUsernameStatus({ checking: false, available: null, error: 'Could not verify' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [editData.newUsername, user.username]);

  // Check email availability
  useEffect(() => {
    if (!editData.email || !validateEmail(editData.email) || editData.email === user.email) {
      setEmailStatus({ checking: false, available: null });
      return;
    }
    
    setEmailStatus(prev => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'checkEmail', email: editData.email, type: 'personal' })
        });
        const result = await response.json();
        setEmailStatus({ checking: false, available: result.available === true, error: result.error });
      } catch {
        setEmailStatus({ checking: false, available: null, error: 'Could not verify' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [editData.email, user.email]);

  // Check school email availability
  useEffect(() => {
    if (!editData.schoolEmail || !validateEmail(editData.schoolEmail) || editData.schoolEmail === user.schoolEmail) {
      setSchoolEmailStatus({ checking: false, available: null });
      return;
    }
    
    setSchoolEmailStatus(prev => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'checkEmail', email: editData.schoolEmail, type: 'school' })
        });
        const result = await response.json();
        setSchoolEmailStatus({ checking: false, available: result.available === true, error: result.error });
      } catch {
        setSchoolEmailStatus({ checking: false, available: null, error: 'Could not verify' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [editData.schoolEmail, user.schoolEmail]);

  const handleSave = async () => {
    setEditError('');
    
    // Validations
    if (!editData.name?.trim()) {
      setEditError('Name is required');
      return;
    }
    
    if (editData.email && !validateEmail(editData.email)) {
      setEditError('Invalid email format');
      return;
    }
    
    if (editData.email && editData.email !== user.email && emailStatus.available === false) {
      setEditError('Email is already taken');
      return;
    }
    
    if (editData.schoolEmail && !validateEmail(editData.schoolEmail)) {
      setEditError('Invalid school email format');
      return;
    }
    
    if (editData.schoolEmail && editData.schoolEmail !== user.schoolEmail && schoolEmailStatus.available === false) {
      setEditError('School email is already taken');
      return;
    }
    
    if (editData.newUsername && editData.newUsername.length < 4) {
      setEditError('Username must be at least 4 characters');
      return;
    }
    
    if (editData.newUsername && editData.newUsername !== user.username && usernameStatus.available === false) {
      setEditError('Username is already taken');
      return;
    }
    
    if (editData.newPassword) {
      if (editData.newPassword.length < 8) {
        setEditError('Password must be at least 8 characters');
        return;
      }
      if (editData.newPassword !== editData.confirmPassword) {
        setEditError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      const { firstName, lastName } = splitFullName(editData.name);

      const updatePayload: any = {
        action: 'updateUserProfile',
        idNumber: user.idNumber,
        firstName,
        lastName,
        profilePictureFileId: editData.profilePictureFileId,
        birthday: toDateInputValue(editData.birthday),
        email: editData.email,
        schoolEmail: editData.schoolEmail,
      };
      
      if (editData.newUsername && editData.newUsername !== user.username) {
        updatePayload.newUsername = editData.newUsername;
      }
      
      if (editData.newPassword) {
        updatePayload.newPassword = editData.newPassword;
      }

      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();
      if (result.success) {
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const updatedUser = { 
          ...user, 
          firstName,
          lastName,
          fullName,
          name: fullName,
          profilePictureURL: editData.profilePicture,
          profilePicture: editData.profilePicture,
          profilePictureFileId: editData.profilePictureFileId,
          birthday: toDateInputValue(editData.birthday),
          email: editData.email,
          schoolEmail: editData.schoolEmail,
          emailVerified: result.emailVerified ?? (personalEmailChanged ? false : user.emailVerified),
          schoolEmailVerified: result.schoolEmailVerified ?? (schoolEmailChanged ? false : user.schoolEmailVerified),
          username: editData.newUsername && editData.newUsername !== user.username ? editData.newUsername : user.username
        };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
        onUpdate(updatedUser);
        setEditing(false);
        setEditData({ ...updatedUser, birthday: toDateInputValue(updatedUser.birthday), newUsername: '', newPassword: '', confirmPassword: '' });

        if (personalEmailChanged || schoolEmailChanged) {
          setPendingProfileUser(updatedUser);
          setOtpEmailType(personalEmailChanged ? 'personal' : 'school');
          setOtpEmail(personalEmailChanged ? (editData.email || '') : (editData.schoolEmail || ''));
          setShowOtpModal(true);
        } else {
          const toastId = addToast('Profile updated successfully', 'success');
          setTimeout(() => removeToast(toastId), 3000);
        }
      } else {
        setEditError(result.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Update failed:', err);
      setEditError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Group fields by editability
  const editableFields = [
    { label: 'Profile Picture', key: 'profilePicture', type: 'image' },
    { label: 'Full Name', key: 'name', icon: 'person', type: 'text' },
    { label: 'Birthday', key: 'birthday', icon: 'cake', type: 'date' },
    { label: 'Personal Email', key: 'email', icon: 'mail', type: 'email' },
    { label: 'School Email', key: 'schoolEmail', icon: 'school', type: 'email' },
  ];
  
  const credentialFields = [
    { label: 'New Username', key: 'newUsername', icon: 'alternate_email', type: 'text', placeholder: user.username || '' },
    { label: 'New Password', key: 'newPassword', icon: 'lock', type: 'password' },
    { label: 'Confirm New Password', key: 'confirmPassword', icon: 'lock_reset', type: 'password' },
  ];
  
  const readOnlyFields = [
    { label: 'ID Number', value: user.idNumber, icon: 'badge' },
    { label: 'Username', value: user.username ? `@${user.username}` : '-', icon: 'alternate_email' },
  ];
  
  const adminOnlyFields = [
    { label: 'School', value: user.school || '-', icon: 'location_city' },
    { label: 'College', value: user.college || '-', icon: 'domain' },
    { label: 'Program', value: user.program || '-', icon: 'menu_book' },
    { label: 'Major', value: user.major || '-', icon: 'psychology' },
    { label: 'Year Level', value: user.year ? `Year ${user.year}` : '-', icon: 'calendar_month' },
    { label: 'Section', value: user.section || '-', icon: 'groups' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-lg shadow-xl my-4 max-h-[90vh] overflow-y-auto modal-content`}>
        {/* Header */}
        <div className={`sticky top-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-100'} border-b p-4 flex items-center justify-between z-10`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{editing ? 'Edit Profile' : 'Profile'}</h2>
          <div className="flex items-center gap-2">
            {!editing && (
              <button 
                onClick={() => setEditing(true)} 
                className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-lg transition-colors`}
                title="Edit Profile"
              >
                <Icon name="edit" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
              </button>
            )}
            <button onClick={onClose} className={darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-400 hover:text-stone-600'}>
              <Icon name="close" />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="p-4 space-y-6">
            {/* Profile Picture */}
            <div className="flex justify-center">
              <ProfilePictureUpload 
                value={editData.profilePicture || ''} 
                onChange={(url) => setEditData(prev => ({ ...prev, profilePicture: url, profilePictureURL: url }))}
                onUploadComplete={({ fileId }) => setEditData(prev => ({ ...prev, profilePictureFileId: fileId || prev.profilePictureFileId }))}
                idNumber={user?.idNumber}
                firstName={splitFullName(editData.name).firstName}
                lastName={splitFullName(editData.name).lastName}
              />
            </div>

            {/* Basic Info Section */}
            <div className="space-y-4">
              <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-stone-500'} uppercase tracking-wider`}>Basic Information</h3>
              
              {/* Name */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>Full Name *</label>
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                  className={`w-full p-3 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-stone-200'} rounded-xl focus:ring-2 focus:ring-stone-400 outline-none`}
                />
              </div>

              {/* Birthday */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>Birthday</label>
                  <input
                    type="date"
                    value={toDateInputValue(editData.birthday)}
                    onChange={(e) => setEditData(prev => ({ ...prev, birthday: e.target.value }))}
                    className={`w-full p-3 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-stone-200'} rounded-xl focus:ring-2 focus:ring-stone-400 outline-none`}
                  />
              </div>

              {/* Personal Email */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>Personal Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${darkMode ? 'bg-gray-700 text-white' : ''} ${
                      editData.email !== user.email && emailStatus.available === true ? 'border-emerald-500' :
                      editData.email !== user.email && emailStatus.available === false ? 'border-red-500' :
                      darkMode ? 'border-gray-600' : 'border-stone-200'
                    }`}
                  />
                  {editData.email !== user.email && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {emailStatus.checking ? (
                        <div className={`w-5 h-5 border-2 ${darkMode ? 'border-gray-500 border-t-gray-300' : 'border-stone-300 border-t-stone-600'} rounded-full animate-spin`} />
                      ) : emailStatus.available === true ? (
                        <Icon name="check_circle" className="text-emerald-500" />
                      ) : emailStatus.available === false ? (
                        <Icon name="cancel" className="text-red-500" />
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>
                    {personalEmailChanged ? 'Changing this email will require verification.' : 'Current verification status shown below.'}
                  </p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getVerificationBadge(personalEmailChanged ? false : user.emailVerified).className}`}>
                    <Icon name={getVerificationBadge(personalEmailChanged ? false : user.emailVerified).icon} className="text-sm" />
                    {getVerificationBadge(personalEmailChanged ? false : user.emailVerified).label}
                  </span>
                </div>
              </div>

              {/* School Email */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>School Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={editData.schoolEmail || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, schoolEmail: e.target.value }))}
                    className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${darkMode ? 'bg-gray-700 text-white' : ''} ${
                      editData.schoolEmail !== user.schoolEmail && schoolEmailStatus.available === true ? 'border-emerald-500' :
                      editData.schoolEmail !== user.schoolEmail && schoolEmailStatus.available === false ? 'border-red-500' :
                      darkMode ? 'border-gray-600' : 'border-stone-200'
                    }`}
                  />
                  {editData.schoolEmail !== user.schoolEmail && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {schoolEmailStatus.checking ? (
                        <div className={`w-5 h-5 border-2 ${darkMode ? 'border-gray-500 border-t-gray-300' : 'border-stone-300 border-t-stone-600'} rounded-full animate-spin`} />
                      ) : schoolEmailStatus.available === true ? (
                        <Icon name="check_circle" className="text-emerald-500" />
                      ) : schoolEmailStatus.available === false ? (
                        <Icon name="cancel" className="text-red-500" />
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>
                    {schoolEmailChanged ? 'Changing this email will require verification.' : 'Current verification status shown below.'}
                  </p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getVerificationBadge(schoolEmailChanged ? false : user.schoolEmailVerified).className}`}>
                    <Icon name={getVerificationBadge(schoolEmailChanged ? false : user.schoolEmailVerified).icon} className="text-sm" />
                    {getVerificationBadge(schoolEmailChanged ? false : user.schoolEmailVerified).label}
                  </span>
                </div>
              </div>
            </div>

            <div className={`rounded-xl border p-4 ${darkMode ? 'bg-gray-700/60 border-gray-600' : 'bg-stone-50 border-stone-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Appearance</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'} mt-1`}>
                    Switch between light and dark mode.
                  </p>
                </div>
                <ThemeToggleButton darkMode={darkMode} setDarkMode={setDarkMode} />
              </div>
            </div>

            {/* Credentials Section */}
            <div className="space-y-4">
              <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-stone-500'} uppercase tracking-wider`}>Change Credentials (Optional)</h3>
              
              {/* New Username */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>New Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editData.newUsername || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, newUsername: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    placeholder={user.username || 'Leave blank to keep current'}
                    className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${darkMode ? 'bg-gray-700 text-white placeholder-gray-500' : ''} ${
                      editData.newUsername && editData.newUsername !== user.username && usernameStatus.available === true ? 'border-emerald-500' :
                      editData.newUsername && editData.newUsername !== user.username && usernameStatus.available === false ? 'border-red-500' :
                      darkMode ? 'border-gray-600' : 'border-stone-200'
                    }`}
                  />
                  {editData.newUsername && editData.newUsername !== user.username && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameStatus.checking ? (
                        <div className={`w-5 h-5 border-2 ${darkMode ? 'border-gray-500 border-t-gray-300' : 'border-stone-300 border-t-stone-600'} rounded-full animate-spin`} />
                      ) : usernameStatus.available === true ? (
                        <Icon name="check_circle" className="text-emerald-500" />
                      ) : usernameStatus.available === false ? (
                        <Icon name="cancel" className="text-red-500" />
                      ) : null}
                    </div>
                  )}
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'} mt-1`}>Current: @{user.username || 'none'}</p>
              </div>

              {/* New Password */}
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editData.newPassword || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Leave blank to keep current"
                    className={`w-full p-3 pr-10 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'border-stone-200'} rounded-xl focus:ring-2 focus:ring-stone-400 outline-none`}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                  </button>
                </div>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'} mt-1`}>Minimum 8 characters</p>
              </div>

              {/* Confirm Password */}
              {editData.newPassword && (
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={editData.confirmPassword || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Re-enter new password"
                      className={`w-full p-3 pr-10 border rounded-xl focus:ring-2 focus:ring-stone-400 outline-none ${darkMode ? 'bg-gray-700 text-white placeholder-gray-500' : ''} ${
                        editData.confirmPassword && editData.newPassword === editData.confirmPassword ? 'border-emerald-500' :
                        editData.confirmPassword && editData.newPassword !== editData.confirmPassword ? 'border-red-500' :
                        darkMode ? 'border-gray-600' : 'border-stone-200'
                      }`}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      <Icon name={showConfirmPassword ? 'visibility_off' : 'visibility'} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin-only Fields Notice */}
            <div className={`${darkMode ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200'} border rounded-xl p-4`}>
              <div className="flex items-start gap-3">
                <Icon name="info" className={darkMode ? 'text-amber-400 mt-0.5' : 'text-amber-600 mt-0.5'} />
                <div>
                  <p className={`text-sm font-medium ${darkMode ? 'text-amber-300' : 'text-amber-800'}`}>Academic Information</p>
                  <p className={`text-xs ${darkMode ? 'text-amber-400' : 'text-amber-700'} mt-1`}>
                    To change your School, College, Program, Major, Year Level, or Section, please contact your class admin or system administrator.
                  </p>
                </div>
              </div>
            </div>
            
            {editError && (
              <div className={`text-red-500 text-sm ${darkMode ? 'bg-red-900/30' : 'bg-red-50'} p-3 rounded-lg flex items-center gap-2`}>
                <Icon name="error" className="text-lg" />
                {editError}
              </div>
            )}
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditData({
                    ...user,
                    birthday: toDateInputValue(user.birthday),
                    newUsername: '',
                    newPassword: '',
                    confirmPassword: ''
                  });
                  setEditError('');
                }}
                className={`flex-1 py-3 border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-stone-300 text-stone-700 hover:bg-stone-50'} rounded-xl font-semibold transition-all`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || usernameStatus.checking || emailStatus.checking || schoolEmailStatus.checking}
                className={`flex-1 py-3 ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-stone-800 hover:bg-stone-900'} text-white rounded-xl font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon name="save" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <div className={`p-6 ${darkMode ? 'bg-gradient-to-b from-gray-700 to-gray-800' : 'bg-gradient-to-b from-stone-100 to-white'}`}>
              <div className="flex flex-col items-center">
                <div className={`w-24 h-24 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-stone-200'} overflow-hidden border-4 ${darkMode ? 'border-gray-800' : 'border-white'} shadow-lg mb-3`}>
                  {user.profilePicture ? (
                    <DriveImage 
                      src={user.profilePicture} 
                      alt={user.name} 
                      className="w-full h-full rounded-full"
                      fallbackIcon={<Icon name="person" className={`text-4xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-gray-600' : 'bg-stone-300'}`}>
                      <Icon name="person" className={`text-4xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />
                    </div>
                  )}
                </div>
                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{user.name}</h3>
                {user.username && (
                  <p className={darkMode ? 'text-gray-400' : 'text-stone-500'}>@{user.username}</p>
                )}
                {user.role && user.role !== 'student' && (
                  <span className={`mt-2 px-3 py-1 ${darkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'} text-xs font-medium rounded-full capitalize`}>
                    {user.role.replace('class-', '').replace(/-/g, ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="p-4 space-y-1">
              {/* Read-only fields */}
              {readOnlyFields.map((row, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-50'} transition-all`}>
                  <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} flex items-center justify-center`}>
                    <Icon name={row.icon} className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>{row.label}</p>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'} truncate`}>{row.value}</p>
                  </div>
                </div>
              ))}
              
              {/* Contact Info */}
              <div className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-50'} transition-all`}>
                <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} flex items-center justify-center`}>
                  <Icon name="mail" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>Email</p>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'} truncate`}>{user.email || '-'}</p>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getVerificationBadge(user.emailVerified).className}`}>
                      <Icon name={getVerificationBadge(user.emailVerified).icon} className="text-sm" />
                      {getVerificationBadge(user.emailVerified).label}
                    </span>
                  </div>
                </div>
                <Icon name="edit" className={`text-sm ${darkMode ? 'text-gray-600' : 'text-stone-300'}`} />
              </div>
              
              <div className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-50'} transition-all`}>
                <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} flex items-center justify-center`}>
                  <Icon name="school" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>School Email</p>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'} truncate`}>{user.schoolEmail || '-'}</p>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getVerificationBadge(user.schoolEmailVerified).className}`}>
                      <Icon name={getVerificationBadge(user.schoolEmailVerified).icon} className="text-sm" />
                      {getVerificationBadge(user.schoolEmailVerified).label}
                    </span>
                  </div>
                </div>
                <Icon name="edit" className={`text-sm ${darkMode ? 'text-gray-600' : 'text-stone-300'}`} />
              </div>
              
              <div className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-50'} transition-all`}>
                <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} flex items-center justify-center`}>
                  <Icon name="cake" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>Birthday</p>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'} truncate`}>
                    {user.birthday ? new Date(user.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <Icon name="edit" className={`text-sm ${darkMode ? 'text-gray-600' : 'text-stone-300'}`} />
              </div>
              
              {/* Academic Info - read only */}
              <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-stone-100'}`}>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'} mb-2 px-3`}>Academic Information</p>
                {adminOnlyFields.map((row, idx) => (
                  <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-50'} transition-all`}>
                    <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} flex items-center justify-center`}>
                      <Icon name={row.icon} className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>{row.label}</p>
                      <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'} truncate`}>{row.value}</p>
                    </div>
                    <Icon name="lock" className={`text-sm ${darkMode ? 'text-gray-600' : 'text-stone-300'}`} />
                  </div>
                ))}
              </div>
              
              {/* Member Since */}
              <div className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-50'} transition-all mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-stone-100'}`}>
                <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} flex items-center justify-center`}>
                  <Icon name="event" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>Member Since</p>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-800'} truncate`}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-stone-100'} space-y-3`}>
              <div className={`rounded-xl border p-4 ${darkMode ? 'bg-gray-700/60 border-gray-600' : 'bg-stone-50 border-stone-200'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Appearance</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'} mt-1`}>
                      Theme preference for this device.
                    </p>
                  </div>
                  <ThemeToggleButton darkMode={darkMode} setDarkMode={setDarkMode} />
                </div>
              </div>
              <button
                onClick={onLogout}
                className={`w-full py-3 ${darkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-50 text-red-600 hover:bg-red-100'} rounded-xl font-semibold transition-all flex items-center justify-center gap-2`}
              >
                <Icon name="logout" />
                Sign Out
              </button>
            </div>
          </>
        )}

        {showOtpModal && (
          <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md shadow-2xl`}>
              <EmailOTPVerification
                idNumber={user.idNumber}
                email={otpEmail}
                emailType={otpEmailType}
                addToast={addToast}
                updateToast={updateToast}
                removeToast={removeToast}
                onCancel={() => {
                  setShowOtpModal(false);
                  setPendingProfileUser(null);
                }}
                onVerified={() => {
                  const baseUser = pendingProfileUser || user;
                  const updatedUser: User = {
                    ...baseUser,
                    emailVerified: otpEmailType === 'personal' ? true : baseUser.emailVerified,
                    schoolEmailVerified: otpEmailType === 'school' ? true : baseUser.schoolEmailVerified
                  };

                  if (otpEmailType === 'personal' && schoolEmailChanged) {
                    setPendingProfileUser(updatedUser);
                    setOtpEmailType('school');
                    setOtpEmail(updatedUser.schoolEmail || '');
                    return;
                  }

                  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
                  onUpdate(updatedUser);
                  setShowOtpModal(false);
                  setPendingProfileUser(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Classmate type for Class Page
type Classmate = {
  idNumber: string;
  username: string;
  name: string;
  profilePicture: string;
  birthday: string;
  email: string;
  schoolEmail: string;
  school: string;
  college: string;
  program: string;
  major: string;
  year: number;
  section: string;
  role: string;
  position: string;
  createdAt: string;
};

type SemesterConfigItem = {
  semester: string;
  startDate: string;
  endDate: string;
  academicYear: string;
  isActive: boolean;
};

type SessionBootstrapData = {
  subjects?: string[];
  subjectInfo?: Record<string, SubjectInfo>;
  currentSemester?: '1st' | '2nd';
  academicYear?: string;
  semesterConfig?: SemesterConfigItem[];
  semesterSubjects?: string[];
  semesterSchedules?: ClassSchedule[];
  courseCatalog?: Subject[];
  classmates?: Classmate[];
};

function normalizeSubjectsPayload(subjectsPayload: any[]) {
  const subjects = subjectsPayload
    .map((subject: any) => typeof subject === 'string' ? subject : subject?.code)
    .filter(Boolean);

  const info = subjectsPayload.reduce((acc: Record<string, SubjectInfo>, subject: any) => {
    if (typeof subject === 'string') {
      acc[subject] = { code: subject, name: '' };
      return acc;
    }

    if (subject?.code) {
      acc[subject.code] = {
        code: subject.code,
        name: subject.name || ''
      };
    }

    return acc;
  }, {});

  return { subjects, info };
}

function normalizeCourseCatalogPayload(coursesPayload: any[]) {
  return coursesPayload.map((course: any) => ({
    code: String(course?.code || '').trim(),
    name: String(course?.name || '').trim()
  }));
}

function getClassmatesCacheKey(idNumber: string) {
  return `classmates_${idNumber}`;
}

async function prefetchSessionBootstrapData(user: User): Promise<SessionBootstrapData> {
  const bootstrap: SessionBootstrapData = {};

  try {
    const [
      currentSemesterResult,
      semesterConfigResult,
      allSubjectsResult,
      courseCatalogResult,
      classmatesResult
    ] = await Promise.all([
      postJson(CLASS_SCHEDULE_GAS_URL, { action: 'getCurrentSemester' })
        .then(response => response.json())
        .catch(() => null),
      postJson(CLASS_SCHEDULE_GAS_URL, { action: 'getSemesterConfig' })
        .then(response => response.json())
        .catch(() => null),
      postJson(CLASS_SCHEDULE_GAS_URL, { action: 'getSubjectsBySemester' })
        .then(response => response.json())
        .catch(() => null),
      postJson(CLASS_SCHEDULE_GAS_URL, { action: 'getCourses' })
        .then(response => response.json())
        .catch(() => null),
      user.section
        ? postToAppsScript({
            action: 'getClassmates',
            idNumber: user.idNumber,
            section: user.section
          })
            .then(response => response.json())
            .catch(() => null)
        : Promise.resolve(null)
    ]);

    const writeTasks: Array<Promise<void>> = [];

    if (currentSemesterResult?.success && currentSemesterResult.currentSemester) {
      bootstrap.currentSemester = currentSemesterResult.currentSemester;
      writeTasks.push(setSecureSessionItem('currentSemester', currentSemesterResult.currentSemester));
    }

    if (currentSemesterResult?.success && currentSemesterResult.academicYear !== undefined) {
      bootstrap.academicYear = currentSemesterResult.academicYear || '';
      writeTasks.push(setSecureSessionItem('academicYear', bootstrap.academicYear));
    }

    if (semesterConfigResult?.success && Array.isArray(semesterConfigResult.semesters)) {
      bootstrap.semesterConfig = semesterConfigResult.semesters;
      writeTasks.push(setSecureSessionItem('semesterConfig', semesterConfigResult.semesters));
    }

    if (allSubjectsResult?.success && Array.isArray(allSubjectsResult.subjects)) {
      const { subjects, info } = normalizeSubjectsPayload(allSubjectsResult.subjects);
      bootstrap.subjects = subjects;
      bootstrap.subjectInfo = info;
      writeTasks.push(setSecureSessionItem('subjects', subjects));
      writeTasks.push(setSecureSessionItem('subjectInfo', info));
      writeTasks.push(setSecureSessionItem('schedulePage_subjects_all', subjects));
      writeTasks.push(setSecureSessionItem('schedulePage_subjectInfo_all', info));
    }

    if (courseCatalogResult?.success && Array.isArray(courseCatalogResult.courses)) {
      const courseCatalog = normalizeCourseCatalogPayload(courseCatalogResult.courses);
      bootstrap.courseCatalog = courseCatalog;
      writeTasks.push(setSecureSessionItem('schedulePage_courseCatalog', courseCatalog));
    }

    if (classmatesResult?.success && Array.isArray(classmatesResult.classmates)) {
      bootstrap.classmates = classmatesResult.classmates;
      writeTasks.push(setSecureSessionItem(getClassmatesCacheKey(user.idNumber), classmatesResult.classmates));
    } else if (user.section) {
      writeTasks.push(setSecureSessionItem(getClassmatesCacheKey(user.idNumber), []));
    }

    await Promise.all(writeTasks);

    const semesterToLoad = bootstrap.currentSemester;
    if (!semesterToLoad) {
      return bootstrap;
    }

    const [semesterSubjectsResult, semesterSchedulesResult] = await Promise.all([
      postJson(CLASS_SCHEDULE_GAS_URL, {
        action: 'getSubjectsBySemester',
        semester: semesterToLoad
      })
        .then(response => response.json())
        .catch(() => null),
      postJson(CLASS_SCHEDULE_GAS_URL, {
        action: 'getClassSchedules',
        semester: semesterToLoad
      })
        .then(response => response.json())
        .catch(() => null)
    ]);

    const semesterWriteTasks: Array<Promise<void>> = [];

    if (semesterSubjectsResult?.success && Array.isArray(semesterSubjectsResult.subjects)) {
      const { subjects, info } = normalizeSubjectsPayload(semesterSubjectsResult.subjects);
      bootstrap.semesterSubjects = subjects;
      semesterWriteTasks.push(setSecureSessionItem('semesterSubjects', subjects));
      semesterWriteTasks.push(setSecureSessionItem(`schedulePage_subjects_${semesterToLoad}`, subjects));
      semesterWriteTasks.push(setSecureSessionItem(`schedulePage_subjectInfo_${semesterToLoad}`, info));
    }

    if (semesterSchedulesResult?.success && Array.isArray(semesterSchedulesResult.schedules)) {
      bootstrap.semesterSchedules = semesterSchedulesResult.schedules;
      semesterWriteTasks.push(setSecureSessionItem('semesterSchedules', semesterSchedulesResult.schedules));
      semesterWriteTasks.push(setSecureSessionItem(`schedulePage_schedules_${semesterToLoad}`, semesterSchedulesResult.schedules));
    }

    await Promise.all(semesterWriteTasks);
  } catch (error) {
    console.warn('Failed to prefetch session bootstrap data:', error);
  }

  return bootstrap;
}

// Role options for admin assignment
const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'guest', label: 'Guest' },
];

// Position options for class officers
const POSITION_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'Mayor', label: 'Mayor' },
  { value: 'Vice Mayor', label: 'Vice Mayor' },
  { value: 'Secretary', label: 'Secretary' },
  { value: 'Assistant Secretary', label: 'Assistant Secretary' },
  { value: 'Treasurer', label: 'Treasurer' },
  { value: 'Auditor', label: 'Auditor' },
  { value: 'Business Manager', label: 'Business Manager' },
  { value: 'Internal Public Information Officer', label: 'Internal PIO' },
  { value: 'External Public Information Officer', label: 'External PIO' },
  { value: 'Marshal 1', label: 'Marshal 1' },
  { value: 'Marshal 2', label: 'Marshal 2' },
  { value: 'Marshal 3', label: 'Marshal 3' },
];

// Class Page Component
const ClassPage = ({ 
  user,
  onBack,
  addToast,
  updateToast,
  removeToast,
  darkMode = false
}: {
  user: User;
  onBack: () => void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
  darkMode?: boolean;
}) => {
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [selectedClassmate, setSelectedClassmate] = useState<Classmate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<{ classmate: Classmate; role: string; position: string } | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  useEffect(() => {
    loadClassmates();
  }, [user.section]);

  const loadClassmates = async () => {
    const cacheKey = getClassmatesCacheKey(user.idNumber);

    if (!user.section) {
      setClassmates([]);
      void setSecureSessionItem(cacheKey, []);
      setLoading(false);
      return;
    }

    const cachedClassmates = await getSecureSessionItem<Classmate[]>(cacheKey);
    const hasCachedClassmates = Array.isArray(cachedClassmates);

    if (cachedClassmates) {
      setClassmates(cachedClassmates);
    }

    setLoading(!hasCachedClassmates);
    setRefreshing(hasCachedClassmates);

    try {
      const response = await postToAppsScript({ action: 'getClassmates', idNumber: user.idNumber, section: user.section });
      const result = await response.json();
      if (result.success) {
        setClassmates(result.classmates || []);
        void setSecureSessionItem(cacheKey, result.classmates || []);
      }
    } catch (err) {
      console.error('Failed to load classmates:', err);
      addToast('Failed to load classmates', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshClassmates = () => {
    if (refreshing) return;
    void loadClassmates();
  };

  const handleAssignRole = (classmate: Classmate) => {
    setEditingRole({ 
      classmate, 
      role: classmate.role || 'student', 
      position: classmate.position || '' 
    });
    setShowRoleModal(true);
  };

  const saveRole = async () => {
    if (!editingRole) return;
    
    setSavingRole(true);
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateUserRole',
          adminIdNumber: user.idNumber,
          sessionToken: user.sessionToken,
          targetIdNumber: editingRole.classmate.idNumber,
          role: editingRole.role,
          position: editingRole.position
        })
      });
      
      const result = await response.json();
      if (result.success) {
        // Update local state
        setClassmates(prev => prev.map(c => 
          c.idNumber === editingRole.classmate.idNumber 
            ? { ...c, role: editingRole.role, position: editingRole.position }
            : c
        ));
        addToast('Role assigned successfully', 'success');
        setShowRoleModal(false);
        setEditingRole(null);
      } else {
        addToast(result.error || 'Failed to assign role', 'error');
      }
    } catch (err) {
      addToast('Network error', 'error');
    } finally {
      setSavingRole(false);
    }
  };

  const filteredClassmates = classmates.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.idNumber.includes(searchQuery)
  );

  // Sort by position priority then role then name
  const sortedClassmates = [...filteredClassmates].sort((a, b) => {
    const positionOrder: Record<string, number> = {
      'Mayor': 1,
      'Vice Mayor': 2,
      'Secretary': 3,
      'Assistant Secretary': 4,
      'Treasurer': 5,
      'Auditor': 6,
      'Business Manager': 7,
      'Internal Public Information Officer': 8,
      'External Public Information Officer': 9,
      'Marshal 1': 10,
      'Marshal 2': 11,
      'Marshal 3': 12,
    };
    const roleOrder: Record<string, number> = {
      'superadmin': 1,
      'admin': 2,
      'faculty': 3,
      'student': 4,
      'guest': 5,
    };
    // First sort by position (if they have one)
    const posA = positionOrder[a.position] || 99;
    const posB = positionOrder[b.position] || 99;
    if (posA !== posB) return posA - posB;
    // Then by role
    const orderA = roleOrder[a.role] || 4;
    const orderB = roleOrder[b.role] || 4;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = darkMode ? {
      'superadmin': 'bg-red-900/30 text-red-400',
      'admin': 'bg-amber-900/30 text-amber-400',
      'faculty': 'bg-blue-900/30 text-blue-400',
      'student': 'bg-gray-700 text-gray-300',
      'guest': 'bg-gray-700 text-gray-400',
    } : {
      'superadmin': 'bg-red-100 text-red-800',
      'admin': 'bg-amber-100 text-amber-800',
      'faculty': 'bg-blue-100 text-blue-800',
      'student': 'bg-stone-100 text-stone-600',
      'guest': 'bg-gray-100 text-gray-600',
    };
    return colors[role] || (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-stone-100 text-stone-600');
  };

  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = darkMode ? {
      'Mayor': 'bg-amber-900/30 text-amber-400',
      'Vice Mayor': 'bg-blue-900/30 text-blue-400',
      'Secretary': 'bg-purple-900/30 text-purple-400',
      'Assistant Secretary': 'bg-violet-900/30 text-violet-400',
      'Treasurer': 'bg-emerald-900/30 text-emerald-400',
      'Auditor': 'bg-cyan-900/30 text-cyan-400',
      'Business Manager': 'bg-orange-900/30 text-orange-400',
      'Internal Public Information Officer': 'bg-pink-900/30 text-pink-400',
      'External Public Information Officer': 'bg-rose-900/30 text-rose-400',
      'Marshal 1': 'bg-indigo-900/30 text-indigo-400',
      'Marshal 2': 'bg-indigo-900/30 text-indigo-400',
      'Marshal 3': 'bg-indigo-900/30 text-indigo-400',
    } : {
      'Mayor': 'bg-amber-100 text-amber-800',
      'Vice Mayor': 'bg-blue-100 text-blue-800',
      'Secretary': 'bg-purple-100 text-purple-800',
      'Assistant Secretary': 'bg-violet-100 text-violet-800',
      'Treasurer': 'bg-emerald-100 text-emerald-800',
      'Auditor': 'bg-cyan-100 text-cyan-800',
      'Business Manager': 'bg-orange-100 text-orange-800',
      'Internal Public Information Officer': 'bg-pink-100 text-pink-800',
      'External Public Information Officer': 'bg-rose-100 text-rose-800',
      'Marshal 1': 'bg-indigo-100 text-indigo-800',
      'Marshal 2': 'bg-indigo-100 text-indigo-800',
      'Marshal 3': 'bg-indigo-100 text-indigo-800',
    };
    return colors[position] || (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-stone-100 text-stone-600');
  };

  const formatRole = (role: string) => {
    if (!role || role === 'student') return 'Student';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const formatPosition = (position: string) => {
    if (!position) return '';
    // Shorten long position names for display
    if (position === 'Internal Public Information Officer') return 'Internal PIO';
    if (position === 'External Public Information Officer') return 'External PIO';
    return position;
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-stone-50'} pb-8`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-40`}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}>
                <Icon name="arrow_back" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
              </button>
              <div>
                <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>My Class</h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                  {refreshing
                    ? `Section ${user.section} • ${classmates.length} classmates • syncing...`
                    : `Section ${user.section} • ${classmates.length} classmates`}
                </p>
              </div>
              <RefreshIconButton
                onClick={handleRefreshClassmates}
                disabled={refreshing}
                spinning={refreshing}
                darkMode={darkMode}
                title="Refresh classmates"
              />
            </div>
            
            {/* View Toggle */}
            <div className={`flex items-center gap-2 ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} rounded-xl p-1`}>
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? (darkMode ? 'bg-gray-600 shadow-sm' : 'bg-white shadow-sm') : (darkMode ? 'hover:bg-gray-600' : 'hover:bg-stone-200')}`}
                title="Card View"
              >
                <Icon name="grid_view" className={viewMode === 'card' ? (darkMode ? 'text-white' : 'text-stone-800') : (darkMode ? 'text-gray-400' : 'text-stone-500')} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? (darkMode ? 'bg-gray-600 shadow-sm' : 'bg-white shadow-sm') : (darkMode ? 'hover:bg-gray-600' : 'hover:bg-stone-200')}`}
                title="List View"
              >
                <Icon name="view_list" className={viewMode === 'list' ? (darkMode ? 'text-white' : 'text-stone-800') : (darkMode ? 'text-gray-400' : 'text-stone-500')} />
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mt-4 relative">
            <Icon name="search" className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-stone-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search classmates..."
              className={`w-full pl-10 pr-4 py-3 ${darkMode ? 'bg-gray-700 text-white placeholder-gray-500' : 'bg-stone-100'} rounded-xl focus:ring-2 focus:ring-stone-400 outline-none`}
            />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {!user.section ? (
          <div className="text-center py-16">
            <div className={`w-20 h-20 ${darkMode ? 'bg-gray-800' : 'bg-stone-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Icon name="group_off" className={`text-4xl ${darkMode ? 'text-gray-600' : 'text-stone-400'}`} />
            </div>
            <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'} mb-2`}>No Section Assigned</h3>
            <p className={darkMode ? 'text-gray-400' : 'text-stone-500'}>You need to have a section assigned to view your classmates.</p>
          </div>
        ) : loading ? (
          <div className="py-8 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-2xl border p-4`}
                >
                  <Skeleton className="w-16 h-16 rounded-2xl mx-auto" darkMode={darkMode} />
                  <Skeleton className="h-4 w-20 mx-auto mt-4" darkMode={darkMode} />
                  <Skeleton className="h-3 w-24 mx-auto mt-2" darkMode={darkMode} />
                </div>
              ))}
            </div>
          </div>
        ) : sortedClassmates.length === 0 ? (
          <div className="text-center py-16">
            <div className={`w-20 h-20 ${darkMode ? 'bg-gray-800' : 'bg-stone-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Icon name="person_search" className={`text-4xl ${darkMode ? 'text-gray-600' : 'text-stone-400'}`} />
            </div>
            <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'} mb-2`}>
              {searchQuery ? 'No Results Found' : 'No Classmates Yet'}
            </h3>
            <p className={darkMode ? 'text-gray-400' : 'text-stone-500'}>
              {searchQuery ? 'Try a different search term.' : 'Be the first in your section!'}
            </p>
          </div>
        ) : viewMode === 'card' ? (
          /* Card View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {sortedClassmates.map(classmate => (
              <div
                key={classmate.idNumber}
                onClick={() => setSelectedClassmate(classmate)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedClassmate(classmate);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`${darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-stone-200 hover:border-stone-300'} rounded-2xl p-4 border hover:shadow-md transition-all text-left group`}
              >
                <div className="relative">
                  <div className={`w-16 h-16 mx-auto rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-200'} overflow-hidden mb-3`}>
                    {classmate.profilePicture ? (
                      <DriveImage 
                        src={classmate.profilePicture} 
                        alt={classmate.name} 
                        className="w-full h-full rounded-full"
                        fallbackIcon={<Icon name="person" className={`text-2xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />}
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-gray-600' : 'bg-stone-300'}`}>
                        <Icon name="person" className={`text-2xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />
                      </div>
                    )}
                  </div>
                  {(classmate.position || (classmate.role && classmate.role !== 'student')) && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                      <Icon name="star" className="text-white text-sm" />
                    </div>
                  )}
                </div>
                <h3 className={`mobile-safe-heading font-semibold ${darkMode ? 'text-white' : 'text-stone-800'} text-sm text-center sm:text-base`}>{classmate.name}</h3>
                {classmate.username && (
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'} text-center truncate`}>@{classmate.username}</p>
                )}
                {/* Show position badge first, then role badge */}
                {classmate.position && (
                  <p className={`text-xs text-center mt-2 px-2 py-1 rounded-full ${getPositionColor(classmate.position)}`}>
                    {formatPosition(classmate.position)}
                  </p>
                )}
                {classmate.role && classmate.role !== 'student' && (
                  <p className={`text-xs text-center mt-1 px-2 py-0.5 rounded-full ${getRoleColor(classmate.role)}`}>
                    {formatRole(classmate.role)}
                  </p>
                )}
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAssignRole(classmate); }}
                    className={`mt-3 w-full py-1.5 text-xs ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-stone-100 hover:bg-stone-200'} rounded-lg transition-colors opacity-0 group-hover:opacity-100`}
                  >
                    <Icon name="admin_panel_settings" className="text-sm" /> Assign
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700 divide-gray-700' : 'bg-white border-stone-200 divide-stone-100'} rounded-2xl border divide-y overflow-hidden`}>
            {sortedClassmates.map(classmate => (
              <div
                key={classmate.idNumber}
                onClick={() => setSelectedClassmate(classmate)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedClassmate(classmate);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`w-full p-3 sm:p-4 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-50'} transition-all flex items-center gap-3 sm:gap-4 text-left group`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-200'} overflow-hidden`}>
                    {classmate.profilePicture ? (
                      <DriveImage 
                        src={classmate.profilePicture} 
                        alt={classmate.name} 
                        className="w-full h-full rounded-full"
                        fallbackIcon={<Icon name="person" className={`text-lg sm:text-xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />}
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-gray-600' : 'bg-stone-300'}`}>
                        <Icon name="person" className={`text-lg sm:text-xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />
                      </div>
                    )}
                  </div>
                  {(classmate.position || (classmate.role && classmate.role !== 'student')) && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-amber-500 rounded-full flex items-center justify-center">
                      <Icon name="star" className="text-white text-[10px] sm:text-xs" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className={`mobile-safe-heading font-semibold ${darkMode ? 'text-white' : 'text-stone-800'} text-sm sm:text-base`}>{classmate.name}</h3>
                    {classmate.position && (
                      <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${getPositionColor(classmate.position)}`}>
                        {formatPosition(classmate.position)}
                      </span>
                    )}
                    {classmate.role && classmate.role !== 'student' && (
                      <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full ${getRoleColor(classmate.role)}`}>
                        {formatRole(classmate.role)}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'} truncate`}>
                    {classmate.username ? `@${classmate.username}` : classmate.idNumber}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAssignRole(classmate); }}
                    className={`p-1.5 sm:p-2 ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-stone-200'} rounded-lg transition-colors opacity-0 group-hover:opacity-100`}
                    title="Assign Role"
                  >
                    <Icon name="admin_panel_settings" className={`${darkMode ? 'text-gray-300' : 'text-stone-600'} text-lg sm:text-xl`} />
                  </button>
                )}
                <Icon name="chevron_right" className={`${darkMode ? 'text-gray-600' : 'text-stone-300'} text-lg sm:text-xl`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Classmate Detail Modal */}
      {selectedClassmate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-sm shadow-xl modal-content max-h-[90vh] overflow-y-auto relative`}>
            {/* Close button */}
            <button 
              onClick={() => setSelectedClassmate(null)}
              className={`absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full transition-colors z-10`}
            >
              <Icon name="close" className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
            </button>
            
            <div className={`p-4 sm:p-6 text-center border-b ${darkMode ? 'border-gray-700' : 'border-stone-100'}`}>
              <div className="relative inline-block">
                <div className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full ${darkMode ? 'bg-gray-700' : 'bg-stone-200'} overflow-hidden mb-3 border-4 ${darkMode ? 'border-gray-800' : 'border-white'} shadow-lg`}>
                  {selectedClassmate.profilePicture ? (
                    <DriveImage 
                      src={selectedClassmate.profilePicture} 
                      alt={selectedClassmate.name} 
                      className="w-full h-full rounded-full"
                      fallbackIcon={<Icon name="person" className={`text-3xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-gray-600' : 'bg-stone-300'}`}>
                      <Icon name="person" className={`text-3xl sm:text-4xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />
                    </div>
                  )}
                </div>
                {(selectedClassmate.position || (selectedClassmate.role && selectedClassmate.role !== 'student')) && (
                  <div className="absolute bottom-2 right-0 w-7 h-7 sm:w-8 sm:h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
                    <Icon name="star" className="text-white text-sm" />
                  </div>
                )}
              </div>
              <h2 className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{selectedClassmate.name}</h2>
              {selectedClassmate.username && (
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>@{selectedClassmate.username}</p>
              )}
              
              {/* Position Badge */}
              {selectedClassmate.position && (
                <div className="mt-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getPositionColor(selectedClassmate.position)}`}>
                    {formatPosition(selectedClassmate.position)}
                  </span>
                </div>
              )}
              
              {/* Role Badge */}
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(selectedClassmate.role || 'student')}`}>
                  {formatRole(selectedClassmate.role || 'student')}
                </span>
              </div>
            </div>
            
            <div className="p-3 sm:p-4 space-y-2">
              <div className={`flex items-center gap-3 p-2.5 sm:p-3 ${darkMode ? 'bg-gray-700' : 'bg-stone-50'} rounded-xl`}>
                <Icon name="badge" className={`${darkMode ? 'text-gray-400' : 'text-stone-500'} text-lg sm:text-xl`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>ID Number</p>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-700'}`}>{selectedClassmate.idNumber}</p>
                </div>
              </div>
              
              <div className={`flex items-center gap-3 p-2.5 sm:p-3 ${darkMode ? 'bg-gray-700' : 'bg-stone-50'} rounded-xl`}>
                <Icon name="psychology" className={`${darkMode ? 'text-gray-400' : 'text-stone-500'} text-lg sm:text-xl`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Major</p>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-700'}`}>{selectedClassmate.major || '-'}</p>
                </div>
              </div>
              
              {selectedClassmate.email && (
                <div className={`flex items-center gap-3 p-2.5 sm:p-3 ${darkMode ? 'bg-gray-700' : 'bg-stone-50'} rounded-xl`}>
                  <Icon name="mail" className={`${darkMode ? 'text-gray-400' : 'text-stone-500'} text-lg sm:text-xl`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Email</p>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-700'} truncate`}>{selectedClassmate.email}</p>
                  </div>
                </div>
              )}
              
              {selectedClassmate.birthday && (
                <div className={`flex items-center gap-3 p-2.5 sm:p-3 ${darkMode ? 'bg-gray-700' : 'bg-stone-50'} rounded-xl`}>
                  <Icon name="cake" className={`${darkMode ? 'text-gray-400' : 'text-stone-500'} text-lg sm:text-xl`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Birthday</p>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-stone-700'}`}>
                      {new Date(selectedClassmate.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className={`p-3 sm:p-4 border-t ${darkMode ? 'border-gray-700' : 'border-stone-100'} flex gap-2 sm:gap-3`}>
              {isAdmin && (
                <button
                  onClick={() => { setSelectedClassmate(null); handleAssignRole(selectedClassmate); }}
                  className={`flex-1 py-2.5 sm:py-3 ${darkMode ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'} rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base`}
                >
                  <Icon name="admin_panel_settings" className="text-lg sm:text-xl" />
                  <span className="hidden sm:inline">Assign Role</span>
                  <span className="sm:hidden">Assign</span>
                </button>
              )}
              <button
                onClick={() => setSelectedClassmate(null)}
                className={`${isAdmin ? 'flex-1' : 'w-full'} py-2.5 sm:py-3 ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-stone-800 hover:bg-stone-900'} text-white rounded-xl font-semibold transition-all text-sm sm:text-base`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {showRoleModal && editingRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-sm shadow-xl modal-content max-h-[90vh] overflow-y-auto`}>
            <div className={`p-3 sm:p-4 border-b ${darkMode ? 'border-gray-700' : 'border-stone-100'} flex items-center justify-between`}>
              <h2 className={`text-base sm:text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Assign Role & Position</h2>
              <button onClick={() => { setShowRoleModal(false); setEditingRole(null); }} className={`${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-400 hover:text-stone-600'} p-1`}>
                <Icon name="close" />
              </button>
            </div>
            
            <div className="p-3 sm:p-4">
              <div className={`flex items-center gap-3 mb-4 sm:mb-6 p-2.5 sm:p-3 ${darkMode ? 'bg-gray-700' : 'bg-stone-50'} rounded-xl`}>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-stone-200'} overflow-hidden flex-shrink-0`}>
                  {editingRole.classmate.profilePicture ? (
                    <DriveImage 
                      src={editingRole.classmate.profilePicture} 
                      alt="" 
                      className="w-full h-full rounded-full"
                      fallbackIcon={<Icon name="person" className={`text-lg sm:text-xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-gray-600' : 'bg-stone-300'}`}>
                      <Icon name="person" className={`text-lg sm:text-xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className={`mobile-safe-heading font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{editingRole.classmate.name}</h3>
                  <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{editingRole.classmate.idNumber}</p>
                </div>
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1.5 sm:mb-2`}>Role</label>
                  <CustomDropdown
                    name="role"
                    value={editingRole.role}
                    onChange={(nextValue) => setEditingRole(prev => prev ? { ...prev, role: nextValue } : null)}
                    options={ROLE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                    theme={darkMode ? 'dark' : 'light'}
                  />
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'} mt-1`}>User's access level in the system</p>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1.5 sm:mb-2`}>Class Position</label>
                  <CustomDropdown
                    name="position"
                    value={editingRole.position}
                    onChange={(nextValue) => setEditingRole(prev => prev ? { ...prev, position: nextValue } : null)}
                    options={POSITION_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                    theme={darkMode ? 'dark' : 'light'}
                  />
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'} mt-1`}>Class officer position (if applicable)</p>
                </div>
              </div>
            </div>
            
            <div className={`p-3 sm:p-4 border-t ${darkMode ? 'border-gray-700' : 'border-stone-100'} flex gap-2 sm:gap-3`}>
              <button
                onClick={() => { setShowRoleModal(false); setEditingRole(null); }}
                className={`flex-1 py-2.5 sm:py-3 border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-stone-300 text-stone-700 hover:bg-stone-50'} rounded-xl font-semibold transition-all text-sm sm:text-base`}
              >
                Cancel
              </button>
              <button
                onClick={saveRole}
                disabled={savingRole}
                className={`flex-1 py-2.5 sm:py-3 ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-stone-800 hover:bg-stone-900'} text-white rounded-xl font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base`}
              >
                {savingRole ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="hidden sm:inline">Saving...</span>
                    <span className="sm:hidden">Save</span>
                  </>
                ) : (
                  <>
                    <Icon name="save" className="text-lg" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Finance Page Component (Under Development)
const FinancePage = ({ onBack, darkMode }: { onBack: () => void; darkMode: boolean }) => {
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-stone-50'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-40`}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}>
            <Icon name="arrow_back" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Finance</h1>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Track payments & dues</p>
          </div>
        </div>
      </header>

      {/* Under Development Notice */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className={`${darkMode ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-300'} border-2 border-dashed rounded-2xl p-8 text-center`}>
          <div className={`w-20 h-20 ${darkMode ? 'bg-amber-900/30' : 'bg-amber-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon name="engineering" className={`text-4xl ${darkMode ? 'text-amber-400' : 'text-amber-600'}`} />
          </div>
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-amber-300' : 'text-amber-800'} mb-2`}>Under Development</h2>
          <p className={`${darkMode ? 'text-amber-400' : 'text-amber-700'} mb-4`}>The Finance module is currently being built. Check back soon!</p>
          <div className={`flex flex-wrap gap-3 justify-center text-sm ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
            <span className={`px-3 py-1.5 ${darkMode ? 'bg-amber-900/30' : 'bg-amber-100'} rounded-full flex items-center gap-1.5`}>
              <Icon name="payments" className="text-base" /> Payment Tracking
            </span>
            <span className={`px-3 py-1.5 ${darkMode ? 'bg-amber-900/30' : 'bg-amber-100'} rounded-full flex items-center gap-1.5`}>
              <Icon name="receipt_long" className="text-base" /> Dues Management
            </span>
            <span className={`px-3 py-1.5 ${darkMode ? 'bg-amber-900/30' : 'bg-amber-100'} rounded-full flex items-center gap-1.5`}>
              <Icon name="account_balance" className="text-base" /> Balance History
            </span>
          </div>
          <p className={`text-xs ${darkMode ? 'text-amber-500' : 'text-amber-500'} mt-6`}>Expected features coming in future updates</p>
        </div>
      </div>
    </div>
  );
};

// Attendance Page Component (Under Development)
const AttendancePage = ({ onBack, darkMode }: { onBack: () => void; darkMode: boolean }) => {
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-stone-50'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-40`}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}>
            <Icon name="arrow_back" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Attendance</h1>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Track your attendance records</p>
          </div>
        </div>
      </header>

      {/* Under Development Notice */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className={`${darkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-300'} border-2 border-dashed rounded-2xl p-8 text-center`}>
          <div className={`w-20 h-20 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon name="engineering" className={`text-4xl ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-blue-300' : 'text-blue-800'} mb-2`}>Under Development</h2>
          <p className={`${darkMode ? 'text-blue-400' : 'text-blue-700'} mb-4`}>The Attendance module is currently being built. Check back soon!</p>
          <div className={`flex flex-wrap gap-3 justify-center text-sm ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            <span className={`px-3 py-1.5 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-full flex items-center gap-1.5`}>
              <Icon name="fact_check" className="text-base" /> Attendance Records
            </span>
            <span className={`px-3 py-1.5 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-full flex items-center gap-1.5`}>
              <Icon name="insert_chart" className="text-base" /> Statistics
            </span>
            <span className={`px-3 py-1.5 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-100'} rounded-full flex items-center gap-1.5`}>
              <Icon name="notifications_active" className="text-base" /> Absence Alerts
            </span>
          </div>
          <p className={`text-xs ${darkMode ? 'text-blue-500' : 'text-blue-500'} mt-6`}>Expected features coming in future updates</p>
        </div>
      </div>
    </div>
  );
};

// Schedule Page Component - Full Implementation
const SchedulePage = ({ 
  onBack,
  user,
  addToast,
  updateToast,
  removeToast,
  semesterConfig,
  setSemesterConfig,
  academicYear,
  darkMode,
  setDarkMode
}: { 
  onBack: () => void;
  user: User | null;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
  semesterConfig: Array<{ semester: string; startDate: string; endDate: string; academicYear: string; isActive: boolean }>;
  setSemesterConfig: React.Dispatch<React.SetStateAction<Array<{ semester: string; startDate: string; endDate: string; academicYear: string; isActive: boolean }>>>;
  academicYear: string;
  darkMode: boolean;
  setDarkMode: (mode: boolean) => void;
}) => {
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'table'>('list');
  const [selectedSemester, setSelectedSemester] = useState<'1st' | '2nd' | ''>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ClassSchedule | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(() => new Date());
  const [calendarDetailDate, setCalendarDetailDate] = useState<Date | null>(null);
  const [showSemesterConfig, setShowSemesterConfig] = useState(false);
  const [isCreatingNewCourse, setIsCreatingNewCourse] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scheduleFormType, setScheduleFormType] = useState<string>('activity');
  const [includeAdditionalMeetings, setIncludeAdditionalMeetings] = useState(false);
  const [additionalMeetings, setAdditionalMeetings] = useState<AdditionalSemestralMeeting[]>([]);
  const [scheduleSubjects, setScheduleSubjects] = useState<string[]>([]);
  const [scheduleSubjectInfo, setScheduleSubjectInfo] = useState<Record<string, SubjectInfo>>({});
  const [courseCatalog, setCourseCatalog] = useState<Subject[]>([]);
  const [editingSemesterConfig, setEditingSemesterConfig] = useState<{
    firstStart: string;
    firstEnd: string;
    secondStart: string;
    secondEnd: string;
    academicYear: string;
  }>({
    firstStart: '',
    firstEnd: '',
    secondStart: '',
    secondEnd: '',
    academicYear: ''
  });

  // Admin ID for super admin access
  const ADMIN_USER_ID = '2025-00046';
  const normalizedPosition = (user?.position || '').trim().toLowerCase();
  const isAdmin = user?.idNumber === ADMIN_USER_ID || user?.role === 'admin' || user?.role === 'superadmin';
  
  // Check if user can manage schedules based on Directory role + position values.
  const canManage = user && (
    isAdmin ||
    [
      'mayor',
      'vice mayor',
      'secretary',
      'internal public information officer',
      'external public information officer'
    ].includes(normalizedPosition)
  );
  
  // PIOs can only add non-semestral schedules (Admin can do everything)
  const canManageSemestral = user && (
    isAdmin ||
    ['mayor', 'vice mayor', 'secretary'].includes(normalizedPosition)
  );

  const resetScheduleModalState = () => {
    setShowAddModal(false);
    setEditingSchedule(null);
    setIsCreatingNewCourse(false);
    setNewCourseCode('');
    setNewCourseName('');
    setScheduleFormType(canManageSemestral ? 'semestral' : 'activity');
    setIncludeAdditionalMeetings(false);
    setAdditionalMeetings([]);
  };

  const createAdditionalMeeting = (): AdditionalSemestralMeeting => ({
    id: `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dayOfWeek: '',
    startTime: '',
    endTime: ''
  });

  // Initialize semester config editing state from props
  useEffect(() => {
    if (semesterConfig.length > 0) {
      const first = semesterConfig.find(s => s.semester === '1st');
      const second = semesterConfig.find(s => s.semester === '2nd');
      setEditingSemesterConfig({
        firstStart: first?.startDate || '',
        firstEnd: first?.endDate || '',
        secondStart: second?.startDate || '',
        secondEnd: second?.endDate || '',
        academicYear: first?.academicYear || academicYear || ''
      });
    }
  }, [semesterConfig, academicYear]);

  useEffect(() => {
    if (editingSchedule) {
      setScheduleFormType(editingSchedule.type || 'semestral');
      setIncludeAdditionalMeetings(false);
      setAdditionalMeetings([]);
      setIsCreatingNewCourse(false);
      return;
    }

    if (showAddModal) {
      setScheduleFormType(canManageSemestral ? 'semestral' : 'activity');
      setIncludeAdditionalMeetings(false);
      setAdditionalMeetings([]);
      setIsCreatingNewCourse(false);
    }
  }, [editingSchedule, showAddModal, canManageSemestral]);

  // Save semester configuration
  const handleSaveSemesterConfig = async () => {
    if (!user || !canManage) return;
    
    const toastId = addToast('Saving semester configuration...', 'loading');
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateSemesterConfig',
          config: {
            firstSemesterStart: editingSemesterConfig.firstStart,
            firstSemesterEnd: editingSemesterConfig.firstEnd,
            secondSemesterStart: editingSemesterConfig.secondStart,
            secondSemesterEnd: editingSemesterConfig.secondEnd,
            academicYear: editingSemesterConfig.academicYear
          },
          userId: user.idNumber
        })
      });
      const result = await response.json();
      if (result.success) {
        updateToast(toastId, 'Semester configuration saved!', 'success');
        setTimeout(() => removeToast(toastId), 3000);
        // Update parent state
        const newConfig = [
          { 
            semester: '1st', 
            startDate: editingSemesterConfig.firstStart, 
            endDate: editingSemesterConfig.firstEnd, 
            academicYear: editingSemesterConfig.academicYear,
            isActive: result.currentSemester === '1st'
          },
          { 
            semester: '2nd', 
            startDate: editingSemesterConfig.secondStart, 
            endDate: editingSemesterConfig.secondEnd, 
            academicYear: editingSemesterConfig.academicYear,
            isActive: result.currentSemester === '2nd'
          }
        ];
        setSemesterConfig(newConfig);
        void setSecureSessionItem('semesterConfig', newConfig);
        void setSecureSessionItem('academicYear', editingSemesterConfig.academicYear);
        if (result.currentSemester) {
          void setSecureSessionItem('currentSemester', result.currentSemester);
        }
        setShowSemesterConfig(false);
      } else {
        updateToast(toastId, result.error || 'Failed to save', 'error');
        setTimeout(() => removeToast(toastId), 3000);
      }
    } catch (error) {
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
    }
  };

  // Fetch schedules from backend
  const fetchSchedules = async () => {
    const cacheKey = `schedulePage_schedules_${selectedSemester || 'all'}`;

    const cachedSchedules = await getSecureSessionItem<ClassSchedule[]>(cacheKey);
    const hasCachedSchedules = Array.isArray(cachedSchedules);

    if (cachedSchedules) {
      setSchedules(cachedSchedules);
    }

    setLoading(!hasCachedSchedules);
    setRefreshing(hasCachedSchedules);

    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getClassSchedules', semester: selectedSemester || undefined })
      });
      const result = await response.json();
      if (result.success) {
        setSchedules(result.schedules || []);
        void setSecureSessionItem(cacheKey, result.schedules || []);
      } else {
        console.error('Failed to fetch schedules:', result.error);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshSchedules = () => {
    if (refreshing) return;
    setRefreshing(true);
    void Promise.all([
      fetchSchedules(),
      fetchScheduleSubjects(),
      fetchCourseCatalog()
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  const fetchScheduleSubjects = async (semester: '1st' | '2nd' | '' = selectedSemester) => {
    const cacheKey = `schedulePage_subjects_${semester || 'all'}`;
    const cacheInfoKey = `schedulePage_subjectInfo_${semester || 'all'}`;

    const [cachedSubjects, cachedInfo] = await Promise.all([
      getSecureSessionItem<string[]>(cacheKey),
      getSecureSessionItem<Record<string, SubjectInfo>>(cacheInfoKey)
    ]);

    if (cachedSubjects) {
      setScheduleSubjects(cachedSubjects);
    }
    if (cachedInfo) {
      setScheduleSubjectInfo(cachedInfo);
    }

    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getSubjectsBySemester',
          semester: semester || undefined
        })
      });
      const result = await response.json();

      if (!result.success || !Array.isArray(result.subjects)) {
        setScheduleSubjects([]);
        setScheduleSubjectInfo({});
        void setSecureSessionItem(cacheKey, []);
        void setSecureSessionItem(cacheInfoKey, {});
        return;
      }

      const subjects = result.subjects
        .map((subject: any) => typeof subject === 'string' ? subject : subject?.code)
        .filter(Boolean);

      const info = result.subjects.reduce((acc: Record<string, SubjectInfo>, subject: any) => {
        if (typeof subject === 'string') {
          acc[subject] = { code: subject, name: '' };
          return acc;
        }

        if (subject?.code) {
          acc[subject.code] = {
            code: subject.code,
            name: subject.name || ''
          };
        }

        return acc;
      }, {});

      setScheduleSubjects(subjects);
      setScheduleSubjectInfo(info);
      void setSecureSessionItem(cacheKey, subjects);
      void setSecureSessionItem(cacheInfoKey, info);
    } catch (error) {
      console.error('Failed to fetch schedule subjects:', error);
      setScheduleSubjects([]);
      setScheduleSubjectInfo({});
    }
  };

  const fetchCourseCatalog = async () => {
    const cacheKey = 'schedulePage_courseCatalog';
    const cachedCourseCatalog = await getSecureSessionItem<Subject[]>(cacheKey);
    if (cachedCourseCatalog) {
      setCourseCatalog(cachedCourseCatalog);
    }

    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getCourses'
        })
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.courses)) {
        const nextCourseCatalog = result.courses.map((course: any) => ({
          code: String(course.code || '').trim(),
          name: String(course.name || '').trim()
        }));
        setCourseCatalog(nextCourseCatalog);
        void setSecureSessionItem(cacheKey, nextCourseCatalog);
      } else {
        setCourseCatalog([]);
        void setSecureSessionItem(cacheKey, []);
      }
    } catch (error) {
      console.error('Failed to fetch course catalog:', error);
      setCourseCatalog([]);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchScheduleSubjects();
    fetchCourseCatalog();
  }, [selectedSemester]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Add schedule handler
  const handleAddSchedule = async (scheduleData: Partial<ClassSchedule>) => {
    if (!user) return false;
    
    const toastId = addToast('Adding schedule...', 'loading');
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addClassSchedule',
          ...scheduleData,
          userId: user.idNumber,
          userName: user.name
        })
      });
      const result = await response.json();
      if (result.success) {
        updateToast(toastId, 'Schedule added successfully!', 'success');
        setTimeout(() => removeToast(toastId), 3000);
        await Promise.all([fetchSchedules(), fetchScheduleSubjects(), fetchCourseCatalog()]);
        return true;
      } else {
        updateToast(toastId, result.error || 'Failed to add schedule', 'error');
        setTimeout(() => removeToast(toastId), 3000);
        return false;
      }
    } catch (error) {
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
      return false;
    }
  };

  const handleAddSchedules = async (scheduleDataList: Partial<ClassSchedule>[]) => {
    if (!user || scheduleDataList.length === 0) return false;
    if (scheduleDataList.length === 1) {
      return handleAddSchedule(scheduleDataList[0]);
    }

    const toastId = addToast(`Adding ${scheduleDataList.length} schedules...`, 'loading');
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'batchAddSchedules',
          schedules: scheduleDataList,
          userId: user.idNumber,
          userName: user.name
        })
      });
      const result = await response.json();
      if (result.success && !result.failed) {
        updateToast(toastId, `${result.added || scheduleDataList.length} schedules added successfully!`, 'success');
        setTimeout(() => removeToast(toastId), 3000);
        await Promise.all([fetchSchedules(), fetchScheduleSubjects(), fetchCourseCatalog()]);
        return true;
      }

      const failureMessage = result.errors?.[0]?.error || result.error || 'Failed to add schedules';
      updateToast(toastId, failureMessage, 'error');
      setTimeout(() => removeToast(toastId), 4000);
      return false;
    } catch (error) {
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
      return false;
    }
  };

  // Update schedule handler
  const handleUpdateSchedule = async (scheduleData: Partial<ClassSchedule>) => {
    if (!user || !editingSchedule) return false;
    
    const toastId = addToast('Updating schedule...', 'loading');
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateClassSchedule',
          scheduleId: editingSchedule.scheduleId,
          ...scheduleData,
          userId: user.idNumber
        })
      });
      const result = await response.json();
      if (result.success) {
        updateToast(toastId, 'Schedule updated successfully!', 'success');
        setTimeout(() => removeToast(toastId), 3000);
        await Promise.all([fetchSchedules(), fetchScheduleSubjects(), fetchCourseCatalog()]);
        return true;
      } else {
        updateToast(toastId, result.error || 'Failed to update schedule', 'error');
        setTimeout(() => removeToast(toastId), 3000);
        return false;
      }
    } catch (error) {
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
      return false;
    }
  };

  // Delete schedule handler
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!user) return;
    
    const toastId = addToast('Deleting schedule...', 'loading');
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteClassSchedule',
          scheduleId,
          userId: user.idNumber
        })
      });
      const result = await response.json();
      if (result.success) {
        updateToast(toastId, 'Schedule deleted', 'success');
        setTimeout(() => removeToast(toastId), 3000);
        await Promise.all([fetchSchedules(), fetchScheduleSubjects(), fetchCourseCatalog()]);
      } else {
        updateToast(toastId, result.error || 'Failed to delete', 'error');
        setTimeout(() => removeToast(toastId), 3000);
      }
    } catch (error) {
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
    }
    setScheduleToDelete(null);
  };

  const handleDeleteCourse = async (courseCode: string) => {
    if (!user) return;

    const toastId = addToast('Removing course...', 'loading');
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteCourse',
          courseCode,
          userId: user.idNumber
        })
      });
      const result = await response.json();

      if (result.success) {
        updateToast(toastId, 'Course removed', 'success');
        setTimeout(() => removeToast(toastId), 3000);
        await Promise.all([fetchScheduleSubjects(), fetchCourseCatalog()]);
      } else {
        updateToast(toastId, result.error || 'Failed to remove course', 'error');
        setTimeout(() => removeToast(toastId), 4000);
      }
    } catch (error) {
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
    }
  };

  // Helper functions
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getScheduleTypeColor = (type: string) => {
    switch (type) {
      case 'semestral': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'makeup': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'activity': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'special': return 'bg-pink-100 text-pink-700 border-pink-200';
      default: return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const getScheduleTypeIcon = (type: string) => {
    switch (type) {
      case 'semestral': return 'school';
      case 'makeup': return 'update';
      case 'activity': return 'celebration';
      case 'special': return 'star';
      default: return 'event';
    }
  };

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayShortMap: Record<string, string> = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun'
  };

  const parseScheduleTime = (timeStr: string) => {
    const [hour, minute] = String(timeStr || '00:00').split(':').map(Number);
    return {
      hour: Number.isFinite(hour) ? hour : 0,
      minute: Number.isFinite(minute) ? minute : 0
    };
  };

  const formatCountdown = (targetTime: Date, mode: 'untilStart' | 'untilEnd') => {
    const diffMs = targetTime.getTime() - currentTime.getTime();
    if (diffMs <= 0) {
      return mode === 'untilStart' ? 'Starting now' : 'Ending now';
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [
      days > 0 ? `${days}d` : '',
      hours > 0 || days > 0 ? `${hours}h` : '',
      minutes > 0 || hours > 0 || days > 0 ? `${minutes}m` : '',
      `${seconds}s`
    ].filter(Boolean);

    return `${mode === 'untilStart' ? 'Starts in' : 'Ends in'} ${parts.join(' ')}`;
  };

  const buildScheduleOccurrence = (schedule: ClassSchedule) => {
    if (schedule.type === 'semestral') {
      const targetDayIndex = dayOrder.indexOf(schedule.dayOfWeek);
      if (targetDayIndex === -1) return null;

      const now = currentTime;
      const currentDayIndex = (now.getDay() + 6) % 7;
      const { hour: startHour, minute: startMinute } = parseScheduleTime(schedule.startTime);
      const { hour: endHour, minute: endMinute } = parseScheduleTime(schedule.endTime || schedule.startTime);
      const start = new Date(now);
      const dayOffset = targetDayIndex - currentDayIndex;
      start.setDate(now.getDate() + dayOffset);
      start.setHours(startHour, startMinute, 0, 0);

      if (start.getTime() < now.getTime() && !(targetDayIndex === currentDayIndex && currentTime < new Date(start.getFullYear(), start.getMonth(), start.getDate(), endHour, endMinute, 0, 0))) {
        start.setDate(start.getDate() + 7);
      }

      const end = new Date(start);
      end.setHours(endHour, endMinute, 0, 0);
      if (end.getTime() <= start.getTime()) {
        end.setDate(end.getDate() + 1);
      }

      return { schedule, start, end };
    }

    if (!schedule.specificDate) return null;
    const [year, month, day] = schedule.specificDate.split('-').map(Number);
    if (!year || !month || !day) return null;
    const { hour: startHour, minute: startMinute } = parseScheduleTime(schedule.startTime);
    const { hour: endHour, minute: endMinute } = parseScheduleTime(schedule.endTime || schedule.startTime);
    const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
    const end = new Date(year, month - 1, day, endHour, endMinute, 0, 0);
    if (end.getTime() <= start.getTime()) {
      end.setDate(end.getDate() + 1);
    }
    if (end.getTime() < currentTime.getTime()) {
      return null;
    }

    return { schedule, start, end };
  };

  const upcomingScheduleOccurrence = schedules
    .map(buildScheduleOccurrence)
    .filter((item): item is NonNullable<ReturnType<typeof buildScheduleOccurrence>> => Boolean(item))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .find(item => item.end.getTime() >= currentTime.getTime()) || null;

  const currentScheduleOccurrence = upcomingScheduleOccurrence &&
    upcomingScheduleOccurrence.start.getTime() <= currentTime.getTime() &&
    upcomingScheduleOccurrence.end.getTime() >= currentTime.getTime()
      ? upcomingScheduleOccurrence
      : null;

  const featuredScheduleOccurrence = currentScheduleOccurrence || upcomingScheduleOccurrence;

  const renderCurrentSchedulePanel = (mode: 'list' | 'table') => {
    if (!featuredScheduleOccurrence) return null;

    const { schedule, start, end } = featuredScheduleOccurrence;
    const isOngoing = currentScheduleOccurrence?.schedule.scheduleId === schedule.scheduleId;
    const countdown = formatCountdown(isOngoing ? end : start, isOngoing ? 'untilEnd' : 'untilStart');
    const containerClassName = mode === 'table'
      ? 'mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4'
      : 'rounded-2xl border border-emerald-200 bg-emerald-50 p-4';

    return (
      <div className={containerClassName}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isOngoing ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isOngoing ? 'Current Scheduled Class' : 'Next Scheduled Class'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-stone-800">{schedule.courseCode}</h2>
              <span className={`px-2 py-1 text-xs rounded-full font-semibold capitalize ${getScheduleTypeColor(schedule.type)}`}>
                {schedule.type}
              </span>
            </div>
            {schedule.courseName && <p className="text-sm text-stone-600 mt-1">{schedule.courseName}</p>}
          </div>
          <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${isOngoing ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
            {countdown}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-stone-700">
          <span className="flex items-center gap-1">
            <Icon name="schedule" className="text-base" />
            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="event" className="text-base" />
            {schedule.type === 'semestral'
              ? schedule.dayOfWeek
              : start.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
          {schedule.classroom && (
            <span className="flex items-center gap-1">
              <Icon name="room" className="text-base" />
              {schedule.classroom}
            </span>
          )}
          {schedule.teacher && (
            <span className="flex items-center gap-1">
              <Icon name="person" className="text-base" />
              {schedule.teacher}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Separate semestral and special schedules
  const semestralSchedules = schedules.filter(s => s.type === 'semestral');
  const specialSchedules = schedules.filter(s => s.type !== 'semestral');

  // Group semestral schedules by day
  const schedulesByDay: Record<string, ClassSchedule[]> = {};
  dayOrder.forEach(day => {
    schedulesByDay[day] = semestralSchedules.filter(s => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  const groupedSemestralSchedules = Array.from(
    semestralSchedules.reduce((map, schedule) => {
      const groupKey = [
        schedule.semester || '',
        schedule.courseCode || '',
        schedule.courseName || '',
        schedule.teacher || '',
        schedule.classroom || '',
        schedule.details || ''
      ].join('||');
      const existing = map.get(groupKey);
      if (existing) {
        existing.push(schedule);
      } else {
        map.set(groupKey, [schedule]);
      }
      return map;
    }, new Map<string, ClassSchedule[]>())
  )
    .map(([groupKey, groupedSchedules]) => {
      const sortedSchedules = [...groupedSchedules].sort((a, b) => {
        const dayDelta = dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek);
        if (dayDelta !== 0) return dayDelta;
        const startDelta = a.startTime.localeCompare(b.startTime);
        if (startDelta !== 0) return startDelta;
        return a.endTime.localeCompare(b.endTime);
      });

      return {
        key: groupKey,
        primarySchedule: sortedSchedules[0],
        schedules: sortedSchedules,
        daySummary: sortedSchedules.map(schedule => dayShortMap[schedule.dayOfWeek] || schedule.dayOfWeek?.slice(0, 3) || '-').join(', '),
        timeSlots: sortedSchedules.map(schedule => ({
          scheduleId: schedule.scheduleId,
          dayLabel: dayShortMap[schedule.dayOfWeek] || schedule.dayOfWeek?.slice(0, 3) || '-',
          timeLabel: `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`,
          schedule
        }))
      };
    })
    .sort((a, b) => {
      const dayDelta = dayOrder.indexOf(a.primarySchedule.dayOfWeek) - dayOrder.indexOf(b.primarySchedule.dayOfWeek);
      if (dayDelta !== 0) return dayDelta;
      const timeDelta = a.primarySchedule.startTime.localeCompare(b.primarySchedule.startTime);
      if (timeDelta !== 0) return timeDelta;
      const semesterDelta = (a.primarySchedule.semester || '').localeCompare(b.primarySchedule.semester || '');
      if (semesterDelta !== 0) return semesterDelta;
      return (a.primarySchedule.courseCode || '').localeCompare(b.primarySchedule.courseCode || '');
    });

  const currentDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const todaysSemestralGroups = groupedSemestralSchedules.filter(group =>
    group.schedules.some(schedule => schedule.dayOfWeek === currentDayName)
  );
  const todaysSpecialSchedules = specialSchedules.filter(schedule => schedule.status === 'today');

  const renderSemestralGroupCard = (group: typeof groupedSemestralSchedules[number], options?: { emphasizeTodayOnly?: boolean }) => {
    const schedule = group.primarySchedule;
    const hasTodaySlot = group.schedules.some(item => item.dayOfWeek === currentDayName);

    return (
      <div
        key={group.key}
        onClick={() => setSelectedSchedule(hasTodaySlot ? (group.schedules.find(item => item.dayOfWeek === currentDayName) || schedule) : schedule)}
        className={`bg-white rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
          hasTodaySlot ? 'border-purple-300 ring-2 ring-purple-100' : 'border-stone-200 hover:border-purple-200'
        }`}
      >
        <div className={`px-4 py-3 border-b ${hasTodaySlot ? 'bg-purple-50 border-purple-100' : 'bg-stone-50 border-stone-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-stone-800">{schedule.courseCode}</span>
                {schedule.semester && (
                  <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">{schedule.semester}</span>
                )}
                {hasTodaySlot && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-600 text-white">Today</span>
                )}
              </div>
              {schedule.courseName && (
                <p className="text-sm text-stone-500 mt-1">{schedule.courseName}</p>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
                {group.schedules.map(item => (
                  <div key={item.scheduleId} className="flex items-center gap-1 rounded-full bg-white/80 border border-stone-200 px-2 py-1">
                    <span className={`text-[11px] font-medium ${item.dayOfWeek === currentDayName ? 'text-purple-700' : 'text-stone-600'}`}>
                      {dayShortMap[item.dayOfWeek] || item.dayOfWeek?.slice(0, 3) || '-'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingSchedule(item); }}
                      className="p-1 text-stone-400 hover:text-blue-500"
                      title={`Edit ${item.dayOfWeek} schedule`}
                    >
                      <Icon name="edit" className="text-sm" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setScheduleToDelete(item.scheduleId); }}
                      className="p-1 text-stone-400 hover:text-red-500"
                      title={`Delete ${item.dayOfWeek} schedule`}
                    >
                      <Icon name="delete" className="text-sm" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="space-y-2">
            {group.timeSlots.map(slot => {
              const isTodaySlot = slot.schedule.dayOfWeek === currentDayName;
              if (options?.emphasizeTodayOnly && !isTodaySlot) return null;

              return (
                <div
                  key={slot.scheduleId}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                    isTodaySlot ? 'border-purple-200 bg-purple-50' : 'border-stone-200 bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isTodaySlot ? 'bg-purple-600 text-white' : 'bg-white text-stone-600 border border-stone-200'
                    }`}>
                      {slot.dayLabel}
                    </span>
                    <span className="text-sm text-stone-700">{slot.timeLabel}</span>
                  </div>
                  {isTodaySlot && <span className="text-xs font-medium text-purple-700">Current day</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
            {schedule.classroom && (
              <span className="flex items-center gap-1">
                <Icon name="room" className="text-base" />
                {schedule.classroom}
              </span>
            )}
            {schedule.teacher && (
              <span className="flex items-center gap-1">
                <Icon name="person" className="text-base" />
                {schedule.teacher}
              </span>
            )}
          </div>
          {schedule.details && (
            <p className="text-xs text-stone-500 italic">"{schedule.details}"</p>
          )}
        </div>
      </div>
    );
  };

  // Calendar view helpers
  const toDateKey = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toISOString().split('T')[0];
  };

  const monthStart = new Date(calendarMonth);
  monthStart.setDate(1);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const startDay = monthStart.getDay();
  const todayKey = toDateKey(new Date());
  const selectedKey = calendarSelectedDate ? toDateKey(calendarSelectedDate) : null;

  const gridDays = Array.from({ length: 42 }, (_, idx) => {
    const date = new Date(year, month, idx - startDay + 1);
    return { date, inMonth: date.getMonth() === month };
  });

  // Build calendar events map
  const calendarEvents: Record<string, ClassSchedule[]> = {};
  
  // Add special schedules by their specific dates
  specialSchedules.forEach(s => {
    if (s.specificDate) {
      const key = s.specificDate;
      if (!calendarEvents[key]) calendarEvents[key] = [];
      calendarEvents[key].push(s);
    }
  });

  // Add semestral schedules for each day of week in the displayed month
  gridDays.forEach(({ date, inMonth }) => {
    if (!inMonth) return;
    const dayName = dayOrder[date.getDay() === 0 ? 6 : date.getDay() - 1];
    const actualDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    const key = toDateKey(date);
    
    semestralSchedules.forEach(s => {
      if (s.dayOfWeek === actualDayName) {
        if (!calendarEvents[key]) calendarEvents[key] = [];
        calendarEvents[key].push(s);
      }
    });
  });

  const selectedDaySchedules = selectedKey ? [...(calendarEvents[selectedKey] || [])].sort((a, b) => {
    const startDelta = a.startTime.localeCompare(b.startTime);
    if (startDelta !== 0) return startDelta;
    const endDelta = a.endTime.localeCompare(b.endTime);
    if (endDelta !== 0) return endDelta;
    return a.courseCode.localeCompare(b.courseCode);
  }) : [];

  const detailSchedules = calendarDetailDate ? [...(calendarEvents[toDateKey(calendarDetailDate)] || [])].sort((a, b) => {
    const startDelta = a.startTime.localeCompare(b.startTime);
    if (startDelta !== 0) return startDelta;
    const endDelta = a.endTime.localeCompare(b.endTime);
    if (endDelta !== 0) return endDelta;
    return a.courseCode.localeCompare(b.courseCode);
  }) : [];

  const detailLabel = calendarDetailDate
    ? calendarDetailDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const selectedLabel = selectedKey
    ? new Date(selectedKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Selected day';

  const handleScheduleDaySelect = (date: Date) => {
    setCalendarSelectedDate(date);
    setCalendarDetailDate(date);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-stone-900' : 'bg-stone-50'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-40`}>
        <div className="max-w-6xl mx-auto px-4 py-3">
          {/* Mobile Header */}
          <div className="flex items-center justify-between gap-2 sm:hidden">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button onClick={onBack} className={`p-1.5 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-full flex-shrink-0`}>
                <Icon name="arrow_back" className={`${darkMode ? 'text-stone-300' : 'text-stone-600'} text-xl`} />
              </button>
              <div className="min-w-0">
                <h1 className={`mobile-safe-heading font-bold ${darkMode ? 'text-stone-100' : 'text-stone-800'} text-base sm:text-lg`}>Class Schedule</h1>
                <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                  {refreshing ? `${schedules.length} schedules • syncing...` : `${schedules.length} schedules`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <RefreshIconButton
                onClick={handleRefreshSchedules}
                disabled={refreshing}
                spinning={refreshing}
                darkMode={darkMode}
                title="Refresh schedules"
              />
              {canManage && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Icon name="add" className="text-lg" />
                </button>
              )}
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden sm:flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full">
                <Icon name="arrow_back" className="text-stone-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-stone-800">Class Schedule</h1>
                <p className="text-xs text-stone-500">
                  {refreshing ? `${schedules.length} total schedules • syncing...` : `${schedules.length} total schedules`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RefreshIconButton
                onClick={handleRefreshSchedules}
                disabled={refreshing}
                spinning={refreshing}
                title="Refresh schedules"
              />
              {/* Semester Filter */}
              <div className="min-w-[11rem]">
                <CustomDropdown
                  name="selectedSemester"
                  value={selectedSemester}
                  onChange={(nextValue) => setSelectedSemester(nextValue as '1st' | '2nd' | '')}
                  options={[
                    { value: '', label: 'All Semesters' },
                    { value: '1st', label: '1st Semester' },
                    { value: '2nd', label: '2nd Semester' }
                  ]}
                  size="compact"
                />
              </div>
              {canManageSemestral && (
                <button
                  onClick={() => setShowSemesterConfig(true)}
                  className="p-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
                  title="Semester Settings"
                >
                  <Icon name="settings" className="text-lg" />
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  <Icon name="add" className="text-sm" />
                  Add Schedule
                </button>
              )}
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 mt-3 bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Icon name="view_list" className="text-base" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'calendar' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Icon name="calendar_month" className="text-base" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'table' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <Icon name="table_chart" className="text-base" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        {loading ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border rounded-2xl p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24" darkMode={darkMode} />
                      <Skeleton className="h-3 w-40 mt-2" darkMode={darkMode} />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" darkMode={darkMode} />
                  </div>
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-3 w-full" darkMode={darkMode} />
                    <Skeleton className="h-3 w-5/6" darkMode={darkMode} />
                    <Skeleton className="h-3 w-3/4" darkMode={darkMode} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="calendar_month" className="text-4xl text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-stone-600 mb-2">No Schedules Yet</h3>
            <p className="text-stone-400 mb-4">
              {canManage ? 'Add your first class schedule to get started' : 'No class schedules have been added yet'}
            </p>
            {canManage && (
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
              >
                Add Schedule
              </button>
            )}
          </div>
        ) : (
          <>
            {/* LIST VIEW */}
            {viewMode === 'list' && (
              <div className="space-y-6">
                {renderCurrentSchedulePanel('list')}

                {/* Today's Classes */}
                {(todaysSemestralGroups.length > 0 || todaysSpecialSchedules.length > 0) && (
                  <div>
                    <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                      <Icon name="today" className="text-green-600" />
                      Today's Classes
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {todaysSemestralGroups.map(group => renderSemestralGroupCard(group, { emphasizeTodayOnly: true }))}
                      {todaysSpecialSchedules.map(schedule => (
                        <div
                          key={schedule.scheduleId}
                          onClick={() => setSelectedSchedule(schedule)}
                          className="bg-green-50 border border-green-200 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-stone-800">{schedule.courseCode}</span>
                                <span className="px-2 py-0.5 text-xs rounded-full bg-green-600 text-white font-medium">Today</span>
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${getScheduleTypeColor(schedule.type)}`}>
                                  {schedule.type}
                                </span>
                              </div>
                              {schedule.courseName && (
                                <p className="text-sm text-stone-500 mt-1">{schedule.courseName}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-sm text-stone-600 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Icon name="schedule" className="text-base" />
                                  {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                                </span>
                                {schedule.classroom && (
                                  <span className="flex items-center gap-1">
                                    <Icon name="room" className="text-base" />
                                    {schedule.classroom}
                                  </span>
                                )}
                              </div>
                              {schedule.teacher && (
                                <p className="text-xs text-stone-400 mt-1">Teacher: {schedule.teacher}</p>
                              )}
                            </div>
                            {canManage && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingSchedule(schedule); }}
                                  className="p-1.5 text-stone-400 hover:text-blue-500 hover:bg-white rounded-lg"
                                >
                                  <Icon name="edit" className="text-sm" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setScheduleToDelete(schedule.scheduleId); }}
                                  className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-white rounded-lg"
                                >
                                  <Icon name="delete" className="text-sm" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grouped Semestral Schedules */}
                {groupedSemestralSchedules.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                      <Icon name="school" className="text-purple-600" />
                      Semestral Schedule
                      {selectedSemester && <span className="text-sm font-normal text-purple-600">({selectedSemester} Sem)</span>}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupedSemestralSchedules.map(group => renderSemestralGroupCard(group))}
                    </div>
                  </div>
                )}

                {/* Special Schedules */}
                {specialSchedules.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                      <Icon name="event" className="text-orange-500" />
                      Special Schedules
                    </h2>
                    <div className="space-y-3">
                      {specialSchedules.map(schedule => (
                        <div
                          key={schedule.scheduleId}
                          onClick={() => setSelectedSchedule(schedule)}
                          className={`bg-white border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer ${
                            schedule.status === 'today' ? 'border-green-300 bg-green-50' :
                            schedule.status === 'completed' ? 'border-stone-200 opacity-60' :
                            'border-stone-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getScheduleTypeColor(schedule.type)}`}>
                                <Icon name={getScheduleTypeIcon(schedule.type)} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-stone-800">{schedule.courseCode}</span>
                                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${getScheduleTypeColor(schedule.type)}`}>
                                    {schedule.type}
                                  </span>
                                  {schedule.status === 'today' && (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-500 text-white font-medium">
                                      Today
                                    </span>
                                  )}
                                </div>
                                {schedule.courseName && (
                                  <p className="text-sm text-stone-500">{schedule.courseName}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-sm text-stone-600 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Icon name="event" className="text-base" />
                                    {formatDate(schedule.specificDate)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Icon name="schedule" className="text-base" />
                                    {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                                  </span>
                                  {schedule.classroom && (
                                    <span className="flex items-center gap-1">
                                      <Icon name="room" className="text-base" />
                                      {schedule.classroom}
                                    </span>
                                  )}
                                </div>
                                {schedule.teacher && (
                                  <p className="text-xs text-stone-400 mt-1">Teacher: {schedule.teacher}</p>
                                )}
                                {schedule.details && (
                                  <p className="text-xs text-stone-500 mt-1 line-clamp-2 italic">"{schedule.details}"</p>
                                )}
                              </div>
                            </div>
                            {canManage && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingSchedule(schedule); }}
                                  className="p-1.5 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                                >
                                  <Icon name="edit" className="text-sm" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setScheduleToDelete(schedule.scheduleId); }}
                                  className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                  <Icon name="delete" className="text-sm" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CALENDAR VIEW */}
            {viewMode === 'calendar' && (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {/* Calendar Header */}
                <div className="flex items-center justify-between p-4 border-b border-stone-200 bg-stone-50">
                  <button
                    onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                    className="p-2 hover:bg-stone-200 rounded-lg"
                  >
                    <Icon name="chevron_left" className="text-stone-600" />
                  </button>
                  <h3 className="text-lg font-semibold text-stone-800">
                    {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                    className="p-2 hover:bg-stone-200 rounded-lg"
                  >
                    <Icon name="chevron_right" className="text-stone-600" />
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 text-center text-xs font-medium text-stone-500 border-b border-stone-200">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="py-2 bg-stone-50">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {gridDays.map(({ date, inMonth }, idx) => {
                    const key = toDateKey(date);
                    const events = calendarEvents[key] || [];
                    const isToday = key === todayKey;
                    const isSelected = key === selectedKey;
                    
                    return (
                        <div
                          key={idx}
                          onClick={() => handleScheduleDaySelect(date)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleScheduleDaySelect(date);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={`min-h-[80px] sm:min-h-[100px] p-1 border-b border-r border-stone-100 text-left transition-colors ${
                            !inMonth ? 'bg-stone-50' : 'bg-white hover:bg-stone-50'
                          } ${isSelected ? 'ring-2 ring-purple-300 ring-inset' : ''}`}
                        >
                          <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-purple-600 text-white' : !inMonth ? 'text-stone-300' : 'text-stone-600'
                          }`}>
                            {date.getDate()}
                          </div>
                          <div className="space-y-0.5 overflow-y-auto max-h-[110px] sm:max-h-[140px] pr-0.5">
                            {events.map((event, i) => (
                              <button
                                key={event.scheduleId + '-' + i}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSchedule(event);
                                }}
                                className={`w-full text-left px-1 py-0.5 text-xs rounded truncate ${
                                event.type === 'semestral' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' :
                                event.type === 'makeup' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                                event.type === 'activity' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                'bg-pink-100 text-pink-700 hover:bg-pink-200'
                              }`}
                              >
                                {event.courseCode}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="p-4 border-t border-stone-200 bg-white">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs text-stone-400">Schedules</p>
                      <h4 className="mobile-safe-heading font-semibold text-stone-800">{selectedLabel}</h4>
                    </div>
                    <span className="text-xs text-stone-500">{selectedDaySchedules.length} items</span>
                  </div>
                  {selectedDaySchedules.length === 0 ? (
                    <p className="text-sm text-stone-500">No schedules for this day.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedDaySchedules.map(schedule => (
                        <button
                          key={schedule.scheduleId}
                          type="button"
                          onClick={() => setSelectedSchedule(schedule)}
                          className="w-full text-left p-3 border border-stone-200 rounded-xl hover:border-purple-300 hover:shadow-sm transition-all bg-white"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-stone-800">{schedule.courseCode}</span>
                                <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium capitalize ${getScheduleTypeColor(schedule.type)}`}>
                                  {schedule.type}
                                </span>
                              </div>
                              {schedule.courseName && <p className="text-sm text-stone-500">{schedule.courseName}</p>}
                              <p className="text-xs text-stone-500 mt-1">
                                {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                                {schedule.classroom ? ` • ${schedule.classroom}` : ''}
                              </p>
                            </div>
                            <Icon name="chevron_right" className="text-stone-400" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="p-3 bg-stone-50 border-t border-stone-200 flex flex-wrap gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-200 rounded"></span> Semestral</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-200 rounded"></span> Makeup</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded"></span> Activity</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-pink-200 rounded"></span> Special</span>
                </div>
              </div>
            )}

            {/* TABLE VIEW - Semestral Only */}
            {viewMode === 'table' && (
              <div>
                {renderCurrentSchedulePanel('table')}

                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="p-4 bg-purple-50 border-b border-purple-100">
                    <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                      <Icon name="table_chart" />
                      Semestral Schedule Table
                      {selectedSemester && <span className="text-sm font-normal">({selectedSemester} Semester)</span>}
                    </h3>
                    <p className="text-xs text-purple-600 mt-1">Regular class schedules for the semester</p>
                  </div>
                  
                  {groupedSemestralSchedules.length === 0 ? (
                    <div className="p-8 text-center">
                      <Icon name="event_busy" className="text-4xl text-stone-300 mb-2" />
                      <p className="text-stone-500">No semestral schedules found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-50 border-b border-stone-200">
                          <tr>
                            <th className="text-left py-3 px-4 font-semibold text-stone-700">Day</th>
                            <th className="text-left py-3 px-4 font-semibold text-stone-700">Time</th>
                            <th className="text-left py-3 px-4 font-semibold text-stone-700">Course</th>
                            <th className="text-left py-3 px-4 font-semibold text-stone-700 hidden md:table-cell">Course Title</th>
                            <th className="text-left py-3 px-4 font-semibold text-stone-700">Teacher</th>
                            <th className="text-left py-3 px-4 font-semibold text-stone-700">Room</th>
                            <th className="text-left py-3 px-4 font-semibold text-stone-700 hidden lg:table-cell">Sem</th>
                            {canManage && <th className="text-center py-3 px-4 font-semibold text-stone-700 w-20">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {groupedSemestralSchedules.map(group => {
                            const schedule = group.primarySchedule;
                            const isToday = group.schedules.some(item => item.dayOfWeek === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]);

                            return (
                              <tr 
                                key={group.key}
                                className="hover:bg-stone-50 cursor-pointer"
                                onClick={() => setSelectedSchedule(schedule)}
                              >
                                <td className="py-3 px-4 font-medium text-stone-700">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex flex-wrap items-center gap-1">
                                      {group.schedules.map((item, index) => {
                                        const isCurrentDay = item.dayOfWeek === currentDayName;
                                        const label = dayShortMap[item.dayOfWeek] || item.dayOfWeek?.slice(0, 3) || '-';

                                        return (
                                          <React.Fragment key={item.scheduleId}>
                                            <span className={isCurrentDay ? 'text-purple-700 font-semibold' : ''}>{label}</span>
                                            {index < group.schedules.length - 1 && <span className="text-stone-400">,</span>}
                                          </React.Fragment>
                                        );
                                      })}
                                    </div>
                                    {isToday && <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded">Today</span>}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-stone-600">
                                  <div className="flex flex-col gap-1">
                                    {group.timeSlots.map(slot => (
                                      <span key={slot.scheduleId} className="whitespace-nowrap">
                                        {slot.dayLabel} • {slot.timeLabel}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-semibold text-stone-800">{schedule.courseCode}</td>
                                <td className="py-3 px-4 text-stone-600 hidden md:table-cell max-w-[200px] truncate">{schedule.courseName || '-'}</td>
                                <td className="py-3 px-4 text-stone-600">{schedule.teacher || '-'}</td>
                                <td className="py-3 px-4 text-stone-600">{schedule.classroom || '-'}</td>
                                <td className="py-3 px-4 text-stone-500 hidden lg:table-cell">
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                    {schedule.semester || '-'}
                                  </span>
                                </td>
                                {canManage && (
                                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex flex-wrap items-center justify-center gap-2">
                                      {group.schedules.map(item => (
                                        <div key={item.scheduleId} className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1">
                                          <span className="text-[11px] font-medium text-stone-600">{dayShortMap[item.dayOfWeek] || item.dayOfWeek?.slice(0, 3) || '-'}</span>
                                          <button
                                            onClick={() => setEditingSchedule(item)}
                                            className="p-1 text-stone-400 hover:text-blue-500"
                                            title={`Edit ${item.dayOfWeek} schedule`}
                                          >
                                            <Icon name="edit" className="text-sm" />
                                          </button>
                                          <button
                                            onClick={() => setScheduleToDelete(item.scheduleId)}
                                            className="p-1 text-stone-400 hover:text-red-500"
                                            title={`Delete ${item.dayOfWeek} schedule`}
                                          >
                                            <Icon name="delete" className="text-sm" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Special Schedules Below Table */}
                {specialSchedules.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                      <Icon name="event" className="text-orange-500" />
                      Special Schedules
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {specialSchedules.map(schedule => (
                        <div
                          key={schedule.scheduleId}
                          onClick={() => setSelectedSchedule(schedule)}
                          className={`bg-white border rounded-xl p-3 hover:shadow-md transition-all cursor-pointer ${getScheduleTypeColor(schedule.type)}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Icon name={getScheduleTypeIcon(schedule.type)} className="text-lg" />
                            <span className="font-bold">{schedule.courseCode}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded capitalize opacity-80">{schedule.type}</span>
                          </div>
                          <p className="text-xs opacity-80">{formatDate(schedule.specificDate)} • {formatTime(schedule.startTime)}</p>
                          {schedule.classroom && <p className="text-xs opacity-70">Room: {schedule.classroom}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Semester Configuration Modal */}
      {showSemesterConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSemesterConfig(false)}>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Semester Settings</h2>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Configure academic year and semester dates</p>
                </div>
                <button
                  onClick={() => setShowSemesterConfig(false)}
                  className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-lg`}
                >
                  <Icon name="close" className={darkMode ? 'text-gray-400' : 'text-stone-600'} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Academic Year */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Academic Year</label>
                  <input
                    type="text"
                    value={editingSemesterConfig.academicYear}
                    onChange={(e) => setEditingSemesterConfig(prev => ({ ...prev, academicYear: e.target.value }))}
                    placeholder="2024-2025"
                    className="w-full p-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* 1st Semester */}
                <div className="bg-purple-50 rounded-xl p-4">
                  <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <Icon name="looks_one" className="text-purple-600" />
                    1st Semester
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-purple-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={editingSemesterConfig.firstStart}
                        onChange={(e) => setEditingSemesterConfig(prev => ({ ...prev, firstStart: e.target.value }))}
                        className="w-full p-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={editingSemesterConfig.firstEnd}
                        onChange={(e) => setEditingSemesterConfig(prev => ({ ...prev, firstEnd: e.target.value }))}
                        className="w-full p-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2nd Semester */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <Icon name="looks_two" className="text-blue-600" />
                    2nd Semester
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={editingSemesterConfig.secondStart}
                        onChange={(e) => setEditingSemesterConfig(prev => ({ ...prev, secondStart: e.target.value }))}
                        className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={editingSemesterConfig.secondEnd}
                        onChange={(e) => setEditingSemesterConfig(prev => ({ ...prev, secondEnd: e.target.value }))}
                        className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Current Status Info */}
                <div className="bg-stone-100 rounded-xl p-3">
                  <p className="text-xs text-stone-600">
                    <Icon name="info" className="text-sm inline mr-1" />
                    The current semester is automatically determined based on today's date and these settings.
                  </p>
                </div>

                {canManage && (
                  <div className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-stone-50 border-stone-200'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Course Catalog</h3>
                        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                          Courses are now saved in the backend `CourseCatalog` sheet.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchCourseCatalog}
                        className={`px-3 py-1.5 text-xs rounded-lg ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-white text-stone-700 hover:bg-stone-100'} border ${darkMode ? 'border-gray-700' : 'border-stone-200'}`}
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {courseCatalog.length === 0 ? (
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>No saved courses yet.</p>
                      ) : (
                        courseCatalog.map(course => (
                          <div
                            key={course.code}
                            className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${darkMode ? 'bg-gray-800' : 'bg-white border border-stone-200'}`}
                          >
                            <div className="min-w-0">
                              <p className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{course.code}</p>
                              <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{course.name || course.code}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCourse(course.code)}
                              className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSemesterConfig(false)}
                    className="flex-1 py-3 border border-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSemesterConfig}
                    className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Schedule Modal */}
      {(showAddModal || editingSchedule) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={resetScheduleModalState}>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>
                  {editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
                </h2>
                <button onClick={resetScheduleModalState} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full`}>
                  <Icon name="close" className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                
                const scheduleData = {
                  type: formData.get('type') as string,
                  semester: formData.get('semester') as string,
                  courseCode: formData.get('courseCode') as string,
                  courseName: formData.get('courseName') as string || scheduleSubjectInfo[formData.get('courseCode') as string]?.name || '',
                  teacher: formData.get('teacher') as string,
                  classroom: formData.get('classroom') as string,
                  dayOfWeek: formData.get('dayOfWeek') as string,
                  startTime: formData.get('startTime') as string,
                  endTime: formData.get('endTime') as string,
                  specificDate: formData.get('specificDate') as string,
                  details: formData.get('details') as string
                };

                const schedulesToSubmit: Partial<ClassSchedule>[] = [scheduleData];
                if (!editingSchedule && scheduleData.type === 'semestral' && includeAdditionalMeetings) {
                  const invalidMeeting = additionalMeetings.find(meeting => !meeting.dayOfWeek || !meeting.startTime || !meeting.endTime);
                  if (invalidMeeting) {
                    addToast('Complete all extra meeting day and time fields first.', 'error');
                    return;
                  }

                  schedulesToSubmit.push(
                    ...additionalMeetings.map(meeting => ({
                      ...scheduleData,
                      dayOfWeek: meeting.dayOfWeek,
                      startTime: meeting.startTime,
                      endTime: meeting.endTime
                    }))
                  );
                }

                let success;
                if (editingSchedule) {
                  success = await handleUpdateSchedule(scheduleData);
                } else {
                  success = await handleAddSchedules(schedulesToSubmit);
                }

                if (success) {
                  resetScheduleModalState();
                  form.reset();
                }
              }} className="space-y-4">
                {/* Schedule Type */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Schedule Type *</label>
                  <CustomDropdown
                    name="type"
                    required
                    value={scheduleFormType}
                    onChange={(nextType) => {
                      setScheduleFormType(nextType);
                      if (nextType !== 'semestral') {
                        setIncludeAdditionalMeetings(false);
                        setAdditionalMeetings([]);
                      }
                    }}
                    options={[
                      ...(canManageSemestral ? [{ value: 'semestral', label: 'Semestral (Permanent)' }] : []),
                      { value: 'makeup', label: 'Make-up Class' },
                      { value: 'activity', label: 'Activity' },
                      { value: 'special', label: 'Special Event' }
                    ]}
                  />
                  <p className="text-xs text-stone-400 mt-1">
                    {canManageSemestral 
                      ? 'Semestral schedules are recurring weekly classes' 
                      : 'PIOs can only add activities and special events'}
                  </p>
                </div>

                {/* Semester (for semestral type) - only show for those with semestral access */}
                {canManageSemestral && (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Semester</label>
                    <CustomDropdown
                      name="semester"
                      defaultValue={editingSchedule?.semester || '1st'}
                      options={[
                        { value: '1st', label: '1st Semester' },
                        { value: '2nd', label: '2nd Semester' }
                      ]}
                    />
                  </div>
                )}

                {/* Course Code */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Course Code *</label>
                  {!isCreatingNewCourse ? (
                    <>
                      <CustomDropdown
                        name="courseCode"
                        required={!isCreatingNewCourse}
                        defaultValue={editingSchedule?.courseCode || ''}
                        onChange={(nextValue) => {
                          if (nextValue === '__CREATE_NEW__') {
                            setIsCreatingNewCourse(true);
                          }
                        }}
                        options={[
                          { value: '', label: 'Select a course' },
                          { value: '__CREATE_NEW__', label: 'Create New Course...' },
                          ...scheduleSubjects.map(s => ({
                            value: s,
                            label: s,
                            description: scheduleSubjectInfo[s]?.name || undefined
                          }))
                        ]}
                      />
                      <select 
                        disabled
                        name="legacyCourseCode" 
                        required={!isCreatingNewCourse}
                        defaultValue={editingSchedule?.courseCode || ''}
                        onChange={(e) => {
                          if (e.target.value === '__CREATE_NEW__') {
                            setIsCreatingNewCourse(true);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                      >
                        <option value="">Select a course</option>
                        <option value="__CREATE_NEW__" className="text-purple-600 font-medium">➕ Create New Course...</option>
                        {scheduleSubjects.map(s => (
                          <option key={s} value={s}>{s} {scheduleSubjectInfo[s]?.name ? `- ${scheduleSubjectInfo[s].name}` : ''}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          name="courseCode"
                          required
                          value={newCourseCode}
                          onChange={(e) => setNewCourseCode(e.target.value.toUpperCase())}
                          placeholder="e.g., MATH101"
                          className="flex-1 px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingNewCourse(false);
                            setNewCourseCode('');
                            setNewCourseName('');
                          }}
                          className="px-3 py-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg"
                          title="Cancel and select existing"
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                      <p className="text-xs text-purple-600">
                        <Icon name="info" className="text-xs mr-1" />
                        Creating a new course code
                      </p>
                    </div>
                  )}
                </div>

                {/* Course Name (optional override) */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Course Title {isCreatingNewCourse && <span className="text-red-500">*</span>}
                  </label>
                  {isCreatingNewCourse ? (
                    <input 
                      key="new-course-name"
                      type="text" 
                      name="courseName" 
                      required
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      placeholder="e.g., Introduction to Mathematics"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  ) : (
                    <input 
                      key="existing-course-name"
                      type="text" 
                      name="courseName" 
                      defaultValue={editingSchedule?.courseName || ''}
                      placeholder="Auto-filled from course code"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  )}
                </div>

                {/* Teacher */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Teacher/Instructor</label>
                  <input 
                    type="text" 
                    name="teacher"
                    defaultValue={editingSchedule?.teacher || ''}
                    placeholder="e.g., Prof. Santos"
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Classroom */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Classroom/Venue *</label>
                  <input 
                    type="text" 
                    name="classroom"
                    required
                    defaultValue={editingSchedule?.classroom || ''}
                    placeholder="e.g., Room 101, Auditorium"
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Day of Week (for semestral) */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Day of Week (for Semestral)</label>
                  <CustomDropdown
                    name="dayOfWeek"
                    defaultValue={editingSchedule?.dayOfWeek || ''}
                    options={[
                      { value: '', label: 'Select day (required for semestral)' },
                      ...DAY_OF_WEEK_OPTIONS
                    ]}
                  />
                </div>

                {!editingSchedule && scheduleFormType === 'semestral' && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeAdditionalMeetings}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeAdditionalMeetings(checked);
                          setAdditionalMeetings(checked ? [createAdditionalMeeting()] : []);
                        }}
                        className="mt-1 h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-purple-900">Add another meeting for the same subject</div>
                        <p className="text-xs text-purple-700">
                          Use this for pairs like Monday and Wednesday or Tuesday and Thursday without re-entering the whole course.
                        </p>
                      </div>
                    </label>

                    {includeAdditionalMeetings && (
                      <div className="space-y-3">
                        {additionalMeetings.map((meeting, index) => (
                          <div key={meeting.id} className="rounded-lg border border-purple-100 bg-white p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                                Extra meeting {index + 1}
                              </div>
                              <button
                                type="button"
                                onClick={() => setAdditionalMeetings(current => current.filter(item => item.id !== meeting.id))}
                                className="text-xs text-stone-500 hover:text-red-500"
                              >
                                Remove
                              </button>
                            </div>
                            <CustomDropdown
                              name={`additionalMeetingDay-${meeting.id}`}
                              value={meeting.dayOfWeek}
                              onChange={(nextValue) => setAdditionalMeetings(current => current.map(item => item.id === meeting.id ? { ...item, dayOfWeek: nextValue } : item))}
                              options={[
                                { value: '', label: 'Select day' },
                                ...DAY_OF_WEEK_OPTIONS
                              ]}
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="time"
                                value={meeting.startTime}
                                onChange={(e) => setAdditionalMeetings(current => current.map(item => item.id === meeting.id ? { ...item, startTime: e.target.value } : item))}
                                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                              <input
                                type="time"
                                value={meeting.endTime}
                                onChange={(e) => setAdditionalMeetings(current => current.map(item => item.id === meeting.id ? { ...item, endTime: e.target.value } : item))}
                                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAdditionalMeetings(current => [...current, createAdditionalMeeting()])}
                          className="w-full rounded-xl border border-dashed border-purple-300 px-4 py-3 text-sm font-medium text-purple-700 hover:bg-purple-100"
                        >
                          Add another meeting slot
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Specific Date (for non-semestral) */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Specific Date (for Special schedules)</label>
                  <input 
                    type="date" 
                    name="specificDate"
                    defaultValue={editingSchedule?.specificDate || ''}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                    <input 
                      type="time" 
                      name="startTime" 
                      required
                      defaultValue={editingSchedule?.startTime || ''}
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                    <input 
                      type="time" 
                      name="endTime" 
                      required
                      defaultValue={editingSchedule?.endTime || ''}
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Details */}
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Details/Notes</label>
                  <textarea 
                    name="details" 
                    rows={2}
                    defaultValue={editingSchedule?.details || ''}
                    placeholder="Additional information..."
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <Icon name={editingSchedule ? 'save' : 'add'} />
                  {editingSchedule ? 'Save Changes' : 'Add Schedule'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Detail Modal */}
      {selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSchedule(null)}>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up`} onClick={e => e.stopPropagation()}>
            {/* Header with type color */}
            <div className={`p-6 ${
              selectedSchedule.type === 'semestral' ? 'bg-purple-500' :
              selectedSchedule.type === 'makeup' ? 'bg-orange-500' :
              selectedSchedule.type === 'activity' ? 'bg-blue-500' : 'bg-pink-500'
            } text-white rounded-t-2xl`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-1 bg-white/20 text-xs rounded-full font-medium capitalize">
                    {selectedSchedule.type}
                  </span>
                  <h2 className="text-2xl font-bold mt-2">{selectedSchedule.courseCode}</h2>
                  {selectedSchedule.courseName && <p className="text-white/80">{selectedSchedule.courseName}</p>}
                </div>
                <button onClick={() => setSelectedSchedule(null)} className="p-2 hover:bg-white/20 rounded-full">
                  <Icon name="close" />
                </button>
              </div>
              {selectedSchedule.semester && (
                <span className="mt-3 inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                  {selectedSchedule.semester} Semester
                </span>
              )}
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              {/* Time */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600">
                  <Icon name="schedule" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">Time</p>
                  <p className="font-semibold text-stone-800">
                    {formatTime(selectedSchedule.startTime)} - {formatTime(selectedSchedule.endTime)}
                  </p>
                </div>
              </div>

              {/* Day/Date */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600">
                  <Icon name="event" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">
                    {selectedSchedule.type === 'semestral' ? 'Day' : 'Date'}
                  </p>
                  <p className="font-semibold text-stone-800">
                    {selectedSchedule.type === 'semestral' 
                      ? selectedSchedule.dayOfWeek 
                      : formatDate(selectedSchedule.specificDate)}
                  </p>
                </div>
              </div>

              {/* Classroom */}
              {selectedSchedule.classroom && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600">
                    <Icon name="room" />
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Classroom</p>
                    <p className="font-semibold text-stone-800">{selectedSchedule.classroom}</p>
                  </div>
                </div>
              )}

              {/* Teacher */}
              {selectedSchedule.teacher && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-600">
                    <Icon name="person" />
                  </div>
                  <div>
                    <p className="text-sm text-stone-500">Teacher</p>
                    <p className="font-semibold text-stone-800">{selectedSchedule.teacher}</p>
                  </div>
                </div>
              )}

              {/* Details */}
              {selectedSchedule.details && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                    <Icon name="notes" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-stone-500">Details</p>
                    <p className="text-stone-700 whitespace-pre-wrap bg-amber-50 p-3 rounded-xl mt-1 text-sm">
                      {selectedSchedule.details}
                    </p>
                  </div>
                </div>
              )}

              {/* Added by */}
              {selectedSchedule.createdByName && (
                <div className="pt-4 border-t border-stone-200">
                  <p className="text-xs text-stone-400">Added by {selectedSchedule.createdByName}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-stone-200 flex gap-2">
              <button
                onClick={() => setSelectedSchedule(null)}
                className="flex-1 py-3 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
              >
                Close
              </button>
              {canManage && (
                <button
                  onClick={() => { setEditingSchedule(selectedSchedule); setSelectedSchedule(null); }}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="edit" /> Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {calendarDetailDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCalendarDetailDate(null)}>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl`} onClick={e => e.stopPropagation()}>
            <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-stone-200'} flex items-start justify-between gap-3`}>
              <div>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Selected date</p>
                <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{detailLabel}</h3>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{detailSchedules.length} scheduled</p>
              </div>
              <button onClick={() => setCalendarDetailDate(null)} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full`}>
                <Icon name="close" className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {detailSchedules.length === 0 && (
                <div className={`text-center ${darkMode ? 'text-gray-400' : 'text-stone-500'} py-8`}>
                  <Icon name="event" className={`text-3xl ${darkMode ? 'text-gray-600' : 'text-stone-300'} mb-2`} />
                  <p>No schedules for this date.</p>
                </div>
              )}

              {detailSchedules.map((schedule) => (
                <button
                  key={schedule.scheduleId}
                  onClick={() => { setSelectedSchedule(schedule); setCalendarDetailDate(null); }}
                  className={`w-full text-left p-3 rounded-xl border ${darkMode ? 'border-gray-700 bg-gray-800 hover:border-gray-500' : 'border-stone-200 bg-white hover:border-stone-400'} hover:shadow-sm transition-all flex items-start gap-3`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${getScheduleTypeColor(schedule.type)}`}>
                    <Icon name={getScheduleTypeIcon(schedule.type)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold line-clamp-1 ${darkMode ? 'text-white' : 'text-stone-800'}`}>{schedule.courseCode}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${getScheduleTypeColor(schedule.type)}`}>
                        {schedule.type}
                      </span>
                    </div>
                    {schedule.courseName && <p className={`text-xs line-clamp-1 ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{schedule.courseName}</p>}
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}</p>
                    {schedule.classroom && <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Room: {schedule.classroom}</p>}
                  </div>
                </button>
              ))}
            </div>

            <div className={`p-4 border-t flex justify-end ${darkMode ? 'border-gray-700' : 'border-stone-200'}`}>
              <button
                onClick={() => setCalendarDetailDate(null)}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {scheduleToDelete && (
        <ConfirmModal
          isOpen={!!scheduleToDelete}
          title="Delete Schedule"
          message="Are you sure you want to delete this schedule? This action cannot be undone."
          onConfirm={() => handleDeleteSchedule(scheduleToDelete)}
          onClose={() => setScheduleToDelete(null)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
};

// Login Modal Component
const LoginModal = ({ 
  isOpen, 
  onClose, 
  onLogin,
  addToast,
  updateToast,
  removeToast,
  darkMode
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onLogin: (user: User) => Promise<void> | void;
  addToast: (message: string, type: Toast['type'], progress?: number) => number;
  updateToast: (id: number, message: string, type: Toast['type'], progress?: number) => void;
  removeToast: (id: number) => void;
  darkMode: boolean;
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    const toastId = addToast('Logging in...', 'loading');
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'loginWithPassword', username: username.trim(), password })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Map fullName to name for backward compatibility
        const user: User = {
          ...result.user,
          name: result.user.fullName || `${result.user.firstName} ${result.user.lastName}`,
          profilePicture: result.user.profilePictureURL
        };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        updateToast(toastId, 'Preparing your data...', 'loading');
        await onLogin(user);
        updateToast(toastId, `Welcome back, ${user.name}!`, 'success');
        setTimeout(() => removeToast(toastId), 3000);
        onClose();
      } else {
        setError(result.error || 'Invalid username or password');
        updateToast(toastId, result.error || 'Login failed', 'error');
        setTimeout(() => removeToast(toastId), 3000);
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
      updateToast(toastId, 'Network error', 'error');
      setTimeout(() => removeToast(toastId), 3000);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-md shadow-xl my-4 max-h-[90vh] flex flex-col modal-content`}>
        <div className="flex-1 min-h-0 flex flex-col p-6">
          {mode === 'register' ? (
            <RegistrationForm 
              onRegister={(user) => {
                onLogin(user);
                onClose();
              }}
              onBack={() => setMode('login')}
              addToast={addToast}
              updateToast={updateToast}
              removeToast={removeToast}
          />
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Welcome to the Classroom Virtual Environment</h2>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'} mt-1`}>Sign in to your account</p>
              </div>
              <button onClick={onClose} className={darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-400 hover:text-stone-600'}>
                <Icon name="close" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>Username</label>
                <div className="relative">
                  <Icon name="person" className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-stone-400'}`} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="Enter your username"
                    className={`w-full p-3 pl-10 border ${darkMode ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-500' : 'border-stone-200 bg-white'} rounded-xl focus:ring-2 focus:ring-stone-400 outline-none`}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-1`}>Password</label>
                <div className="relative">
                  <Icon name="lock" className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-stone-400'}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`w-full p-3 pl-10 pr-10 border ${darkMode ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-500' : 'border-stone-200 bg-white'} rounded-xl focus:ring-2 focus:ring-stone-400 outline-none`}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-stone-400 hover:text-stone-600'}`}
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2">
                  <Icon name="error" className="text-lg" />
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Icon name="login" />
                    Sign In
                  </>
                )}
              </button>

              <div className="text-center pt-4">
                <p className="text-sm text-stone-500">
                  Don't have an account?{' '}
                  <button 
                    onClick={() => setMode('register')} 
                    className="text-stone-800 font-semibold hover:underline"
                  >
                    Register here
                  </button>
                </p>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

// Resource Viewer Component
const ResourceViewer = ({ 
  resource, 
  onClose 
}: { 
  resource: Resource; 
  onClose: () => void;
}) => {
  const [iframeError, setIframeError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getFileId = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || 
                  url.match(/id=([a-zA-Z0-9_-]+)/)?.[1];
    return match || null;
  };

  const getEmbedUrl = (url: string, useGoogleViewer = false) => {
    // Google Drive file
    if (url.includes('drive.google.com')) {
      const fileId = getFileId(url);
      if (fileId) {
        if (useGoogleViewer) {
          // Use Google Docs viewer as fallback (works better for PDFs)
          return `https://docs.google.com/viewer?srcid=${fileId}&pid=explorer&efh=false&a=v&chrome=false&embedded=true`;
        }
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    return url;
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setIframeError(true);
  };

  const renderContent = () => {
    const isPDF = resource.category === 'Lesson PDF' || resource.name.toLowerCase().endsWith('.pdf');
    const embedUrl = getEmbedUrl(resource.url, iframeError && isPDF);
    
    if (resource.category === 'Video') {
      return (
        <iframe
          src={embedUrl}
          className="w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={handleIframeLoad}
        />
      );
    }
    
    if (resource.category === 'Image') {
      return (
        <img 
          src={embedUrl} 
          alt={resource.name} 
          className="max-w-full max-h-full object-contain rounded-lg"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      );
    }
    
    // Files (PDF, PPT, etc.)
    return (
      <div className="w-full h-full relative">
        {isLoading && (
          <div className="absolute inset-0 rounded-lg bg-stone-800 p-6 flex flex-col justify-center">
            <Skeleton className="h-8 w-2/3" darkMode />
            <Skeleton className="h-4 w-full mt-4" darkMode />
            <Skeleton className="h-4 w-5/6 mt-2" darkMode />
            <Skeleton className="h-40 w-full mt-6 rounded-xl" darkMode />
            <p className="text-stone-400 text-xs mt-4 text-center">Loading document...</p>
          </div>
        )}
        <iframe
          key={iframeError ? 'fallback' : 'primary'}
          src={embedUrl}
          className="w-full h-full rounded-lg bg-white"
          title={resource.name}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      <div className="flex justify-between items-center p-4 bg-stone-900">
        <h2 className="mobile-safe-heading text-white font-semibold flex-1 mr-4">{resource.name}</h2>
        <div className="flex items-center gap-2">
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            title="Open in Google Drive"
          >
            <Icon name="open_in_new" className="text-lg" />
            <span className="text-sm hidden sm:inline">Open Externally</span>
          </a>
          <button onClick={onClose} className="text-white hover:text-stone-300 p-2">
            <Icon name="close" className="text-2xl" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        {renderContent()}
      </div>
    </div>
  );
};

// --- Main App ---

type AppProps = {
  routeRole: RouteRole;
};

export const App = ({ routeRole }: AppProps) => {
  const navigate = useNavigate();
  const initialUrlPage = normalizePageKey(getInitialUrlParam('page'));
  // User State
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showRequestResource, setShowRequestResource] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallToast, setShowInstallToast] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Update Notification State
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [newVersionAvailable, setNewVersionAvailable] = useState<string | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const sessionBootstrapRequestRef = useRef(0);
  const cacheResetInProgressRef = useRef(false);

  // ... (The rest of your App code follows normally from here)

  const addToast = (message: string, type: Toast['type'], progress?: number): number => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type, progress }]);
    return id;
  };

  const updateToast = (id: number, message: string, type: Toast['type'], progress?: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, message, type, progress } : t));
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshResourceRequests = () => {
    // Placeholder hook for future list refreshes after a request is created.
  };

  // Data State
  const [view, setView] = useState<AppView>(() => {
    const initialPage = getPageConfig(initialUrlPage).view;
    if (initialPage) return initialPage;
    const saved = localStorage.getItem('cumlaude_lastView');
    return (saved as AppView) || 'HOME';
  });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Content State
  const [decks, setDecks] = useState<Deck[]>([]);
  const [categories, setCategories] = useState<Record<string, CategoryItem[]>>({});
  const [resources, setResources] = useState<Record<string, Resource[]>>({});
  const [isResourcesRefreshing, setIsResourcesRefreshing] = useState(false);
  const [apiSubjects, setApiSubjects] = useState<string[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [isObligationsLoading, setIsObligationsLoading] = useState(false);
  const [subjectInfo, setSubjectInfo] = useState<Record<string, SubjectInfo>>({});
  const [showAddExam, setShowAddExam] = useState(false);
  const [selectedExamCourseCode, setSelectedExamCourseCode] = useState('');
  const [selectedExamCourseName, setSelectedExamCourseName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date()); // For real-time exam status
  const [examToDelete, setExamToDelete] = useState<string | null>(null); // For delete confirmation
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null); // For editing exam
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null); // For exam detail view
  
  // Semester State
  const [currentSemester, setCurrentSemester] = useState<'1st' | '2nd'>('1st');
  const [selectedSemesterView, setSelectedSemesterView] = useState<'1st' | '2nd' | null>(null); // Manual override
  const [academicYear, setAcademicYear] = useState<string>('');
  const [semesterConfig, setSemesterConfig] = useState<SemesterConfigItem[]>([]);
  const [semesterSubjects, setSemesterSubjects] = useState<string[]>([]); // Subjects filtered by semester
  const [semesterSchedules, setSemesterSchedules] = useState<ClassSchedule[]>([]);
  const [isSemesterSubjectsLoading, setIsSemesterSubjectsLoading] = useState(false);
  const [isSemesterSubjectsRefreshing, setIsSemesterSubjectsRefreshing] = useState(false);
  const [homeResourceTab, setHomeResourceTab] = useState<'subjects' | 'resources'>('subjects'); // Tab for home resources card
  const [resourcePageTab, setResourcePageTab] = useState<'subjects' | 'resources'>('subjects'); // Tab for ALL_RESOURCES page
  
  // Theme State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('cumlaude_darkMode');
    return saved === 'true';
  });
  
  // Admin Announcement State
  const [showAnnouncementPanel, setShowAnnouncementPanel] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);
  const [customAnnouncementTitle, setCustomAnnouncementTitle] = useState('');
  const [customAnnouncementMessage, setCustomAnnouncementMessage] = useState('');
  const [customAnnouncementEmoji, setCustomAnnouncementEmoji] = useState('🎉');
  
  // Ongoing Exam Alert State
  const [ongoingExamAlert, setOngoingExamAlert] = useState<Exam | null>(null);
  const [previousExamStatuses, setPreviousExamStatuses] = useState<Record<string, string>>({});
  
  // Post-Exam Celebration State
  const [completedExamAlert, setCompletedExamAlert] = useState<Exam | null>(null);
  const semesterLoadRequestRef = useRef(0);
  
  // Generic Modal States
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'info' | 'warning' | 'error' | 'success' }>({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; confirmText: string; confirmColor: 'red' | 'green' | 'stone'; onConfirm: () => void }>({ isOpen: false, title: '', message: '', confirmText: 'Confirm', confirmColor: 'red', onConfirm: () => {} });
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null); // For resource delete confirmation
  const [showClearProgressConfirm, setShowClearProgressConfirm] = useState(false); // For clear deck progress confirmation
  const [showAdminCacheConfirm, setShowAdminCacheConfirm] = useState(false); // For admin cache clear confirmation
  
  // Navigation State
  const [activeSubject, setActiveSubject] = useState<string | null>(() => {
    return getInitialUrlParam('subject') || getInitialUrlParam('course') || localStorage.getItem('cumlaude_lastSubject');
  });
  const [activeTab, setActiveTab] = useState<'Classroom' | 'Schedule' | 'Resources' | 'Exams'>(() => {
    const tabFromUrl = getInitialUrlParam('tab');
    if (tabFromUrl === 'classroom' || tabFromUrl === 'flashcards') return 'Classroom';
    if (tabFromUrl === 'schedule') return 'Schedule';
    if (tabFromUrl === 'resources') return 'Resources';
    if (tabFromUrl === 'exams') return 'Exams';
    const saved = localStorage.getItem('cumlaude_lastTab');
    return (saved as 'Classroom' | 'Schedule' | 'Resources' | 'Exams') || 'Classroom';
  });
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [deckLoading, setDeckLoading] = useState<string | null>(null); // Track which deck is loading
  const [activeResource, setActiveResource] = useState<Resource | null>(null);
  const [previousView, setPreviousView] = useState<AppView>('HOME'); // Track where we came from
  const [viewHistory, setViewHistory] = useState<AppView[]>(['HOME']); // Navigation history stack

  // Calendar View State
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(() => new Date());
  const [calendarDetailDate, setCalendarDetailDate] = useState<Date | null>(null);
  const [prefillExamDate, setPrefillExamDate] = useState<string | null>(null);
  const [showDateJump, setShowDateJump] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const resetAddExamModal = () => {
    setShowAddExam(false);
    setPrefillExamDate(null);
    setSelectedExamCourseCode('');
    setSelectedExamCourseName('');
  };

  const handleExamCourseChange = (courseCode: string) => {
    setSelectedExamCourseCode(courseCode);
    setSelectedExamCourseName(subjectInfo[courseCode]?.name || '');
  };
  const isAuthPhase = showLogin || !user;
  const syncedPage =
    showLogin ? 'login' :
    showProfile ? 'profile' :
    showUpload ? 'upload' :
    showRequestResource ? 'request-resource' :
    VIEW_TO_PAGE[view];
  const syncedParams = buildPageScopedParams({
    page: syncedPage,
    isAuthPhase,
    routeRole,
    user,
    activeSubject,
    activeTab,
    activeDeck,
    activeResource
  });
  const stateSyncSignature = JSON.stringify([syncedPage, syncedParams]);

  const applyUrlState = (nextPage: string, nextParams: URLSearchParams) => {
    const requestedConfig = getPageConfig(nextPage);
    if (requestedConfig.view !== view) {
      setView(requestedConfig.view);
    }

    const requestedOverlay = requestedConfig.overlay;
    const nextShowLogin = requestedOverlay === 'login';
    const nextShowProfile = requestedOverlay === 'profile' && !!user;
    const nextShowUpload = requestedOverlay === 'upload';
    const nextShowRequestResource = requestedOverlay === 'request-resource';

    if (showLogin !== nextShowLogin) setShowLogin(nextShowLogin);
    if (showProfile !== nextShowProfile) setShowProfile(nextShowProfile);
    if (showUpload !== nextShowUpload) setShowUpload(nextShowUpload);
    if (showRequestResource !== nextShowRequestResource) setShowRequestResource(nextShowRequestResource);

    const subjectFromUrl = nextParams.get('subject') || nextParams.get('course');
    if (subjectFromUrl && subjectFromUrl !== activeSubject) {
      setActiveSubject(subjectFromUrl);
    }

    const deckFromUrl = nextParams.get('deck');
    if (deckFromUrl && deckFromUrl !== activeDeck?.name && decks.length > 0) {
      const matchedDeck = decks.find(deck => deck.name === deckFromUrl || deck.sheetName === deckFromUrl) || null;
      if (matchedDeck) {
        setActiveDeck(matchedDeck);
      }
    }

    const resourceFromUrl = nextParams.get('resource');
    if (resourceFromUrl && resourceFromUrl !== activeResource?.name) {
      const flattenedResources = Object.values(resources).flat();
      const matchedResource = flattenedResources.find(resource => resource.name === resourceFromUrl || resource.title === resourceFromUrl) || null;
      if (matchedResource) {
        setActiveResource(matchedResource);
      }
    }
  };

  const liveUrlState = useUrlState({
    defaultPage: 'home',
    currentPage: syncedPage,
    stateParams: syncedParams,
    stateSignature: stateSyncSignature,
    onUrlStateChange: applyUrlState
  });
  const { page: syncedUrlPage, params: syncedUrlParams, mapToPage } = liveUrlState;
  const urlParamSignature = syncedUrlParams.toString();

  // Save navigation state to localStorage
  useEffect(() => {
    localStorage.setItem('cumlaude_lastView', view);
  }, [view]);

  useEffect(() => {
    if (activeSubject) {
      localStorage.setItem('cumlaude_lastSubject', activeSubject);
    }
  }, [activeSubject]);

  useEffect(() => {
    localStorage.setItem('cumlaude_lastTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const currentPage = normalizePageKey(syncedUrlPage);

    if (!user && AUTH_REQUIRED_PAGES.has(currentPage)) {
      mapToPage('login', () => {
        setShowProfile(false);
        setShowUpload(false);
        setShowRequestResource(false);
        setShowLogin(true);
        setView('HOME');
      }, {
        role: 'visitor'
      }, { replace: true });
      return;
    }

    if (!user && routeRole !== 'visitor') {
      navigate(
        {
          pathname: '/visitor',
          search: '?page=login'
        },
        { replace: true }
      );
    }
  }, [loading, mapToPage, navigate, routeRole, syncedUrlPage, user]);

  useEffect(() => {
    const expectedRole = deriveRouteRoleForUser(user);
    if (routeRole !== expectedRole) {
      navigate(
        {
          pathname: `/${expectedRole}`,
          search: `?${syncedUrlParams.toString()}`
        },
        { replace: true }
      );
    }
  }, [navigate, routeRole, syncedUrlParams, urlParamSignature, user]);

  useEffect(() => {
    const needsSubject = view === 'SUBJECT' || view === 'RESOURCE_VIEW';
    const needsDeck = view === 'DECK_OVERVIEW' || view === 'PLAY' || view === 'SUMMARY';

    if (needsSubject && !activeSubject) {
      setView('HOME');
      return;
    }

    if (needsDeck && !activeDeck) {
      setView(activeSubject ? 'SUBJECT' : 'HOME');
      return;
    }

    if (view === 'RESOURCE_VIEW' && !activeResource) {
      setView(activeSubject ? 'SUBJECT' : 'HOME');
    }
  }, [activeDeck, activeResource, activeSubject, view]);

  // Real-time exam countdown - refresh every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second for countdown
    return () => clearInterval(interval);
  }, []);

  // Dark mode effect
  useEffect(() => {
    localStorage.setItem('cumlaude_darkMode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Session State
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scores, setScores] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const [sessionStartedAtIso, setSessionStartedAtIso] = useState('');
  const [currentCardStartedAt, setCurrentCardStartedAt] = useState<number>(0);
  const [cardSessionSummaries, setCardSessionSummaries] = useState<Record<string, CardSessionSummary>>({});
  const [sessionActionBusy, setSessionActionBusy] = useState(false);
  const [clearProgressBusy, setClearProgressBusy] = useState(false);
  const [playMode, setPlayMode] = useState<'shuffle' | 'chronological'>('shuffle');
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [savedProgress, setSavedProgress] = useState<DeckProgress | null>(null);
  const [progressVersion, setProgressVersion] = useState(0);
  const lastSavedStudySessionIdRef = useRef('');

  // Analytics State
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);

  // ALL_RESOURCES View Filter States (must be at top level for hooks rules)
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [selectedObligationFilter, setSelectedObligationFilter] = useState<string>('');
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);

  // --- Initialization ---

  const canUserDeleteResource = (submittedBy?: string) => {
    if (!user) return false;
    if (submittedBy && submittedBy === user.idNumber) return true;

    const normalizedRole = String(user.role || '').trim().toLowerCase();
    const normalizedPosition = String(user.position || '').trim().toLowerCase();

    return normalizedRole === 'admin' ||
      normalizedRole === 'superadmin' ||
      normalizedPosition === 'mayor' ||
      normalizedPosition === 'vice mayor' ||
      normalizedPosition === 'internal public information officer';
  };

  const canUserBumpGlobalCache = () => {
    if (!user) return false;

    const normalizedRole = String(user.role || '').trim().toLowerCase();
    return normalizedRole === 'admin' || normalizedRole === 'superadmin';
  };

  useEffect(() => {
    const initApp = async () => {
      clearLegacyMetadataCache();

      // Load user from storage
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      let parsedUser: User | null = null;
      if (savedUser) {
        try {
          parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          
          // Refresh user profile from backend if online (to get updated section, role, etc.)
          if (navigator.onLine) {
            try {
              const response = await postToAppsScript({
                action: 'getUserProfile',
                idNumber: parsedUser.idNumber
              });
              const data = await response.json();
              if (data.success && data.user) {
                // Merge with existing user data to preserve any local-only fields
                // Map fullName to name for backward compatibility
                const refreshedUser = {
                  ...parsedUser,
                  ...data.user,
                  name: data.user.fullName || `${data.user.firstName} ${data.user.lastName}`,
                  profilePicture: data.user.profilePictureURL
                };
                setUser(refreshedUser);
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(refreshedUser));
                console.log('User profile refreshed from backend');
              }
            } catch (err) {
              console.log('Could not refresh user profile, using cached data');
            }
          }
        } catch (e) {
          localStorage.removeItem(STORAGE_KEY_USER);
        }
      }

      // Load cached data
      const cachedDecks = await db.decks.toArray();
      setDecks(cachedDecks);

      // Legacy category cache duplicates derived deck metadata and is no longer used.
      void db.categories.clear().catch((error) => {
        console.warn('Failed to clear legacy category cache:', error);
      });
      
      // Load cached subjects
      const cachedSubjects = await getSecureSessionItem<string[]>('subjects');
      if (cachedSubjects) {
        setApiSubjects(cachedSubjects);
      }
      
      // Load cached subject info (code to name mapping)
      const cachedSubjectInfo = await getSecureSessionItem<Record<string, SubjectInfo>>('subjectInfo');
      if (cachedSubjectInfo) {
        setSubjectInfo(cachedSubjectInfo);
      }
      
      // Load cached exams
      const cachedExams = localStorage.getItem('cumlaude_obligations');
      if (cachedExams) {
        try {
          setExams(JSON.parse(cachedExams));
        } catch (e) {
          // ignore
        }
      }
      
      // Load cached semester configuration
      const cachedCurrentSemester = await getSecureSessionItem<'1st' | '2nd'>('currentSemester');
      if (cachedCurrentSemester) {
        setCurrentSemester(cachedCurrentSemester);
      }
      const cachedAcademicYear = await getSecureSessionItem<string>('academicYear');
      if (cachedAcademicYear) {
        setAcademicYear(cachedAcademicYear);
      }
      const cachedSemesterConfig = await getSecureSessionItem<SemesterConfigItem[]>('semesterConfig');
      if (cachedSemesterConfig) {
        setSemesterConfig(cachedSemesterConfig);
      }
      // Load cached semester view selection (manual override)
      const cachedSelectedSemesterView = localStorage.getItem('cumlaude_selectedSemesterView');
      if (cachedSelectedSemesterView) {
        setSelectedSemesterView(cachedSelectedSemesterView as '1st' | '2nd');
      }
      const initialSemesterView = (cachedSelectedSemesterView as '1st' | '2nd' | null) || cachedCurrentSemester || '1st';
      const [cachedSemesterSubjects, cachedSemesterSchedules] = await Promise.all([
        getSecureSessionItem<string[]>(getHomeSemesterSubjectsCacheKey(initialSemesterView)),
        getSecureSessionItem<ClassSchedule[]>(getHomeSemesterSchedulesCacheKey(initialSemesterView))
      ]);
      if (cachedSemesterSubjects) {
        setSemesterSubjects(cachedSemesterSubjects);
      } else {
        const legacySemesterSubjects = await getSecureSessionItem<string[]>('semesterSubjects');
        if (legacySemesterSubjects) {
          setSemesterSubjects(legacySemesterSubjects);
        }
      }
      if (cachedSemesterSchedules) {
        setSemesterSchedules(cachedSemesterSchedules);
      } else {
        const legacySemesterSchedules = await getSecureSessionItem<ClassSchedule[]>('semesterSchedules');
        if (legacySemesterSchedules) {
          setSemesterSchedules(legacySemesterSchedules);
        }
      }
      
      // Load cached resources
      const cachedResources = await db.resources.toArray();
      if (cachedResources.length > 0) {
        const resourceMap: Record<string, Resource[]> = {};
        cachedResources.forEach(r => {
          resourceMap[r.subject] = r.items;
        });
        setResources(resourceMap);
      }
      
      // Validate restored view - if SUBJECT view but no subject, go HOME
      const savedView = localStorage.getItem('cumlaude_lastView') as AppView;
      const savedSubject = localStorage.getItem('cumlaude_lastSubject');
      if (savedView === 'SUBJECT' && !savedSubject) {
        setView('HOME');
      }
      
      setLoading(false);

      if (navigator.onLine) {
        void syncData(false);
      }
    };

    initApp();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const applyBackendSubjects = (subjectsPayload: any[]) => {
    const subjects = subjectsPayload
      .map((subject: any) => typeof subject === 'string' ? subject : subject?.code)
      .filter(Boolean);

    const info = subjectsPayload.reduce((acc: Record<string, SubjectInfo>, subject: any) => {
      if (typeof subject === 'string') {
        acc[subject] = { code: subject, name: '' };
        return acc;
      }

      if (subject?.code) {
        acc[subject.code] = {
          code: subject.code,
          name: subject.name || ''
        };
      }

      return acc;
    }, {});

    setApiSubjects(subjects);
    setSubjectInfo(info);
    void setSecureSessionItem('subjects', subjects);
    void setSecureSessionItem('subjectInfo', info);
  };

  const fetchAllBackendSubjects = async () => {
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getSubjectsBySemester'
        })
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.subjects)) {
        applyBackendSubjects(data.subjects);
      } else {
        setApiSubjects([]);
        setSubjectInfo({});
        void setSecureSessionItem('subjects', []);
        void setSecureSessionItem('subjectInfo', {});
      }
    } catch (error) {
      console.warn('Failed to load backend subjects:', error);
    }
  };

  const fetchBackendSemesterSubjects = async (semester: '1st' | '2nd', requestId?: number) => {
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getSubjectsBySemester',
          semester
        })
      });
      const data = await response.json();
      const isCurrentRequest = requestId === undefined || semesterLoadRequestRef.current === requestId;

      if (data.success && Array.isArray(data.subjects)) {
        const subjectCodes = data.subjects.map((s: any) => typeof s === 'string' ? s : s.code);
        if (isCurrentRequest) {
          setSemesterSubjects(subjectCodes);
        }
        void setSecureSessionItem(getHomeSemesterSubjectsCacheKey(semester), subjectCodes);
        void setSecureSessionItem('semesterSubjects', subjectCodes);
      } else {
        if (isCurrentRequest) {
          setSemesterSubjects([]);
        }
        void setSecureSessionItem(getHomeSemesterSubjectsCacheKey(semester), []);
        void setSecureSessionItem('semesterSubjects', []);
      }
    } catch (error) {
      console.warn('Failed to load backend semester subjects:', error);
    }
  };

  const fetchBackendSemesterSchedules = async (semester: '1st' | '2nd', requestId?: number) => {
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getClassSchedules',
          semester
        })
      });
      const data = await response.json();
      const isCurrentRequest = requestId === undefined || semesterLoadRequestRef.current === requestId;

      if (data.success && Array.isArray(data.schedules)) {
        if (isCurrentRequest) {
          setSemesterSchedules(data.schedules);
        }
        void setSecureSessionItem(getHomeSemesterSchedulesCacheKey(semester), data.schedules);
        void setSecureSessionItem('semesterSchedules', data.schedules);
      } else {
        if (isCurrentRequest) {
          setSemesterSchedules([]);
        }
        void setSecureSessionItem(getHomeSemesterSchedulesCacheKey(semester), []);
        void setSecureSessionItem('semesterSchedules', []);
      }
    } catch (error) {
      console.warn('Failed to load backend semester schedules:', error);
    }
  };

  const fetchScheduleContext = async () => {
    try {
      const [currentSemesterResponse, semesterConfigResponse] = await Promise.all([
        fetch(CLASS_SCHEDULE_GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'getCurrentSemester' })
        }),
        fetch(CLASS_SCHEDULE_GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'getSemesterConfig' })
        })
      ]);

      const [currentSemesterData, semesterConfigData] = await Promise.all([
        currentSemesterResponse.json(),
        semesterConfigResponse.json()
      ]);

      if (currentSemesterData.success && currentSemesterData.currentSemester) {
        setCurrentSemester(currentSemesterData.currentSemester);
        void setSecureSessionItem('currentSemester', currentSemesterData.currentSemester);
      }

      if (currentSemesterData.success && currentSemesterData.academicYear !== undefined) {
        setAcademicYear(currentSemesterData.academicYear || '');
        void setSecureSessionItem('academicYear', currentSemesterData.academicYear || '');
      }

      if (semesterConfigData.success && Array.isArray(semesterConfigData.semesters)) {
        setSemesterConfig(semesterConfigData.semesters);
        void setSecureSessionItem('semesterConfig', semesterConfigData.semesters);
      }
    } catch (error) {
      console.warn('Failed to load schedule context:', error);
    }
  };

  const loadSemesterSubjectsView = async (semester: '1st' | '2nd') => {
    const requestId = ++semesterLoadRequestRef.current;
    const [cachedSubjects, cachedSchedules] = await Promise.all([
      getSecureSessionItem<string[]>(getHomeSemesterSubjectsCacheKey(semester)),
      getSecureSessionItem<ClassSchedule[]>(getHomeSemesterSchedulesCacheKey(semester))
    ]);
    const hasCachedSemesterData = Array.isArray(cachedSubjects) || Array.isArray(cachedSchedules);

    if (requestId !== semesterLoadRequestRef.current) {
      return;
    }

    if (Array.isArray(cachedSubjects)) {
      setSemesterSubjects(cachedSubjects);
    }
    if (Array.isArray(cachedSchedules)) {
      setSemesterSchedules(cachedSchedules);
    }

    const startedAt = Date.now();
    setIsSemesterSubjectsLoading(!hasCachedSemesterData);
    setIsSemesterSubjectsRefreshing(true);

    try {
      await Promise.all([
        fetchBackendSemesterSubjects(semester, requestId),
        fetchBackendSemesterSchedules(semester, requestId)
      ]);
    } finally {
      if (!hasCachedSemesterData) {
        const elapsed = Date.now() - startedAt;
        const minSkeletonTime = 180;
        if (elapsed < minSkeletonTime) {
          await new Promise(resolve => setTimeout(resolve, minSkeletonTime - elapsed));
        }
      }

      if (semesterLoadRequestRef.current === requestId) {
        setIsSemesterSubjectsLoading(false);
        setIsSemesterSubjectsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    fetchScheduleContext();
    fetchAllBackendSubjects();
    void fetchObligationsFromBackend();
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const semesterToLoad = selectedSemesterView || currentSemester;
    void loadSemesterSubjectsView(semesterToLoad);
  }, [selectedSemesterView, currentSemester, isOnline]);

  // --- PWA Install Prompt & Cache Management ---
  
  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    const dismissedInstall = localStorage.getItem('cumlaude_install_dismissed');
    
    if (isStandalone) {
      setIsAppInstalled(true);
      localStorage.setItem('cumlaude_installed', 'true');
    } else if (!dismissedInstall && !localStorage.getItem('cumlaude_installed')) {
      // Show install prompt after 3 seconds
      const timer = setTimeout(() => {
        setShowInstallToast(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Listen for install prompt - store it globally so it persists
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Also store in window for persistence
      (window as any).__pwaInstallPrompt = e;
      console.log('PWA: Install prompt captured and ready');
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setShowInstallToast(false);
      setDeferredPrompt(null);
      (window as any).__pwaInstallPrompt = null;
      localStorage.setItem('cumlaude_installed', 'true');
      addToast('App installed successfully! 🎉', 'success');
    };

    // Check if prompt was already captured before this component mounted
    if ((window as any).__pwaInstallPrompt) {
      setDeferredPrompt((window as any).__pwaInstallPrompt);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // --- Cache Management - Notify on new version ---
  const APP_VERSION = '1.3.5'; // Increment this to trigger update notification
  
  useEffect(() => {
    const storedVersion = localStorage.getItem('cumlaude_version');
    
    if (!storedVersion) {
      // First time user - just set the version
      localStorage.setItem('cumlaude_version', APP_VERSION);
    } else if (storedVersion !== APP_VERSION) {
      // New version detected - show update toast
      setNewVersionAvailable(APP_VERSION);
      setShowUpdateToast(true);
    }
  }, []);

  const handleUpdateApp = async () => {
    const loadingToast = addToast('Updating app...', 'loading');
    
    try {
      // Clear IndexedDB cache
      await db.decks.clear();
      await db.categories.clear();
      await db.resources.clear();
      
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // Clear service worker caches if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Update stored version
      localStorage.setItem('cumlaude_version', APP_VERSION);
      
      removeToast(loadingToast);
      addToast('Update complete! Refreshing...', 'success');
      
      // Force reload bypassing cache
      setTimeout(() => {
        window.location.href = window.location.origin + '?v=' + Date.now();
      }, 1000);
    } catch (e) {
      console.error('Error updating app:', e);
      removeToast(loadingToast);
      addToast('Update failed. Please try again.', 'error');
    }
  };

  useEffect(() => {
    const checkCacheVersion = async () => {
      if (cacheResetInProgressRef.current || !navigator.onLine) return;

      try {
        const response = await postToAppsScript({
          action: 'getCacheVersion'
        });
        const result = await response.json();

        if (!response.ok || result.error) {
          return;
        }

        const serverVersion = Number(result.version);
        if (!Number.isFinite(serverVersion) || serverVersion < 1) {
          return;
        }

        const storedVersionRaw = localStorage.getItem(STORAGE_KEY_CACHE_VERSION);
        if (!storedVersionRaw) {
          localStorage.setItem(STORAGE_KEY_CACHE_VERSION, String(serverVersion));
          return;
        }

        const storedVersion = Number(storedVersionRaw);
        if (!Number.isFinite(storedVersion)) {
          localStorage.setItem(STORAGE_KEY_CACHE_VERSION, String(serverVersion));
          return;
        }

        if (serverVersion > storedVersion) {
          await forceHardReset('App cache was reset by an administrator. Reloading fresh data...');
          return;
        }

        if (serverVersion !== storedVersion) {
          localStorage.setItem(STORAGE_KEY_CACHE_VERSION, String(serverVersion));
        }
      } catch (error) {
        console.warn('Cache version check failed:', error);
      }
    };

    void checkCacheVersion();

    const intervalId = window.setInterval(checkCacheVersion, 5 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkCacheVersion();
      }
    };
    const handleOnline = () => {
      void checkCacheVersion();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // --- Periodic Data Refresh (every hour) ---
  
  useEffect(() => {
    const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
    const LAST_REFRESH_KEY = 'cumlaude_last_refresh';
    
    const checkAndRefresh = () => {
      const lastRefresh = localStorage.getItem(LAST_REFRESH_KEY);
      const now = Date.now();
      
      if (!lastRefresh || (now - parseInt(lastRefresh)) > REFRESH_INTERVAL) {
        console.log('Hourly refresh triggered');
        localStorage.setItem(LAST_REFRESH_KEY, now.toString());
        
        if (navigator.onLine) {
          syncData(false); // Silent refresh (no toast)
        }
      }
    };
    
    // Check on mount
    checkAndRefresh();
    
    // Set up interval for periodic checks (check every 5 minutes if tab is active)
    const intervalId = setInterval(checkAndRefresh, 5 * 60 * 1000);
    
    // Also refresh when tab becomes visible after being hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // PWA Install handlers
  const handleInstallClick = async () => {
    // Try to get the deferred prompt from state or window
    const prompt = deferredPrompt || (window as any).__pwaInstallPrompt;
    
    if (prompt) {
      // Chrome/Edge/Samsung - use the native install prompt
      try {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        console.log('PWA: Install outcome:', outcome);
        
        if (outcome === 'accepted') {
          setShowInstallToast(false);
          addToast('Installing Classroom Virtual Environment... 📲', 'success');
          localStorage.setItem('cumlaude_installed', 'true');
        } else {
          addToast('Installation cancelled', 'info');
        }
        
        setDeferredPrompt(null);
        (window as any).__pwaInstallPrompt = null;
      } catch (e) {
        console.error('Install prompt failed:', e);
        // Show fallback instructions
        showInstallInstructions();
      }
    } else {
      // No prompt available - show manual instructions
      showInstallInstructions();
    }
  };
  
  const showInstallInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge|Edg/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS Safari
      addToast('Tap the Share button (□↑) at the bottom, then "Add to Home Screen"', 'info', 10);
    } else if (isAndroid && isChrome) {
      // Android Chrome - should have had prompt, but just in case
      addToast('Tap the menu (⋮) then "Add to Home screen" or "Install app"', 'info', 8);
    } else if (isAndroid && isFirefox) {
      addToast('Tap the menu (⋮) then "Install"', 'info', 6);
    } else if (isSafari) {
      addToast('In Safari: File menu → "Add to Dock"', 'info', 6);
    } else {
      addToast('Look for "Install" or "Add to Home Screen" in your browser menu', 'info', 6);
    }
    
    setShowInstallToast(false);
  };

  const handleDismissInstall = () => {
    setShowInstallToast(false);
    localStorage.setItem('cumlaude_install_dismissed', Date.now().toString());
  };

  // --- Data Sync ---

  // Function to clear all local cache
  const clearAllLocalCache = async (preserveUser = false) => {
    // Clear localStorage
    const savedUser = preserveUser ? localStorage.getItem(STORAGE_KEY_USER) : null;
    localStorage.clear();
    if (savedUser) {
      localStorage.setItem(STORAGE_KEY_USER, savedUser);
    }
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear IndexedDB
    await db.decks.clear();
    await db.categories.clear();
    await db.resources.clear();
    try {
      await db.delete();
    } catch (error) {
      console.warn('Failed to delete IndexedDB database:', error);
    }
    
    // Unregister service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    
    // Clear Cache API
    if ('caches' in window) {
      const names = await caches.keys();
      for (const name of names) {
        await caches.delete(name);
      }
    }
  };

  const forceHardReset = async (reason: string) => {
    if (cacheResetInProgressRef.current) return;
    cacheResetInProgressRef.current = true;

    const toastId = addToast(reason, 'loading');

    try {
      setUser(null);
      await clearAllLocalCache(false);
    } catch (error) {
      console.error('Failed to fully clear local cache before reload:', error);
    } finally {
      removeToast(toastId);
      const resetUrl = new URL(window.location.href);
      resetUrl.searchParams.set('cacheReset', Date.now().toString());
      window.location.replace(resetUrl.toString());
    }
  };

  const syncData = async (showToast = true, userIdOverride?: string) => {
    let toastId: number | null = null;
    
    if (showToast) {
      toastId = addToast('Loading data...', 'loading', 10);
    }
    
    try {
      if (toastId) updateToast(toastId, 'Connecting to server...', 'loading', 20);
      
      // Include userId to check server-side announcement dismissals
      // Use override if provided (for initial load when state isn't set yet)
      const userId = userIdOverride || user?.idNumber;
      const response = await getJson(RESOURCE_GAS_URL, {
        action: 'getAll',
        userId
      });
      
      if (toastId) updateToast(toastId, 'Fetching flashcards...', 'loading', 40);
      
      if (!response.ok) {
        throw new Error(`Resource sync request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error('Sync error:', data.error, '| Resource URL:', RESOURCE_GAS_URL);
        if (toastId) {
          updateToast(toastId, `Sync error: ${data.error}`, 'error');
          setTimeout(() => removeToast(toastId!), 4000);
        }
        return;
      }

      if (toastId) updateToast(toastId, 'Processing flashcards...', 'loading', 50);

      // Process decks - format: { displayName: { sheetName, subject, cards } }
      if (data.decks) {
        await db.decks.clear();
        const parsedDecks: Deck[] = Object.entries(data.decks).map(([displayName, deckData]: [string, any]) => ({
          name: displayName,
          fileId: deckData.fileId || displayName,
          sheetName: deckData.sheetName || displayName,
          subject: deckData.subject || 'Uncategorized',
          url: deckData.url || '',
          submittedBy: deckData.submittedBy || '',
          submittedByName: deckData.submittedByName || '',
          timestamp: deckData.timestamp || '',
          cards: buildDeckCards(deckData.fileId || displayName, deckData.cards || [])
        }));
        await db.decks.bulkPut(parsedDecks);
        setDecks(parsedDecks);
      }

      if (toastId) updateToast(toastId, 'Loading categories...', 'loading', 65);

      // Process categories (auto-generated from deck subjects)
      if (data.categories) {
        await db.categories.clear();
        setCategories(data.categories);
        for (const [subject, items] of Object.entries(data.categories)) {
          await db.categories.put({ subject, items: items as CategoryItem[] });
        }
      }

      if (toastId) updateToast(toastId, 'Loading resources...', 'loading', 80);

      // Process resources
      if (data.resources) {
        await db.resources.clear();
        setResources(data.resources);
        for (const [subject, items] of Object.entries(data.resources)) {
          await db.resources.put({ subject, items: items as Resource[] });
        }
      }

      if (Array.isArray(data.resourceLinks)) {
        setResourceLinks(data.resourceLinks as ResourceLink[]);
      } else {
        setResourceLinks([]);
      }

      if (toastId) updateToast(toastId, 'Loading exam schedule...', 'loading', 90);

      // Process subjects from Category sheet (now with code and name)
      if (data.subjects && Array.isArray(data.subjects)) {
        const subjects = data.subjects.map((s: any) => typeof s === 'string' ? s : s.code);
        setApiSubjects(subjects);
        void setSecureSessionItem('subjects', subjects);
      }
      
      // Process subject info (code to name mapping)
      if (data.subjectInfo && typeof data.subjectInfo === 'object') {
        setSubjectInfo(data.subjectInfo);
        void setSecureSessionItem('subjectInfo', data.subjectInfo);
      }

      if (toastId) updateToast(toastId, 'Finalizing...', 'loading', 95);
      
      if (toastId) {
        updateToast(toastId, '✓ Data loaded successfully!', 'success', 100);
        setTimeout(() => removeToast(toastId!), 2000);
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      if (toastId) {
        updateToast(toastId, `Sync failed: ${error.message || 'Network error'}`, 'error');
        setTimeout(() => removeToast(toastId!), 4000);
      }
    }
  };

  const handleResourcesRefresh = async () => {
    if (isResourcesRefreshing) return;

    setIsResourcesRefreshing(true);
    try {
      await syncData(true);
    } finally {
      setIsResourcesRefreshing(false);
    }
  };

  const handleClassroomRefresh = async () => {
    if (isResourcesRefreshing) return;

    setIsResourcesRefreshing(true);
    try {
      await syncData(true);
    } finally {
      setIsResourcesRefreshing(false);
    }
  };

  const handleSubjectScheduleRefresh = async () => {
    if (isSemesterSubjectsRefreshing) return;

    setIsSemesterSubjectsRefreshing(true);
    try {
      await loadSemesterSubjectsView(activeSemester);
    } finally {
      setIsSemesterSubjectsRefreshing(false);
    }
  };

  const handleObligationsRefresh = async () => {
    if (isObligationsLoading) return;
    await fetchObligationsFromBackend();
  };

  const handleAllResourcesRefresh = async () => {
    if (isResourcesRefreshing || isSemesterSubjectsRefreshing) return;

    setIsResourcesRefreshing(true);
    setIsSemesterSubjectsRefreshing(true);
    try {
      await Promise.all([
        syncData(true),
        loadSemesterSubjectsView(activeSemester)
      ]);
    } finally {
      setIsResourcesRefreshing(false);
      setIsSemesterSubjectsRefreshing(false);
    }
  };

  // --- Analytics Functions ---

  const saveSessionAnalytics = async (
    correct: number,
    incorrect: number,
    sessionEndedAt: number,
    sessionCardSummaries: Record<string, CardSessionSummary>
  ) => {
    if (!user || !activeDeck || !activeSubject) return;
    
    const timeSpent = Math.round((sessionEndedAt - sessionStartTime) / 1000);
    const cardsAnswered = correct + incorrect;
    const sessionId = `${user.idNumber}-${activeDeck.fileId || activeDeck.name}-${sessionEndedAt}`;
    if (lastSavedStudySessionIdRef.current === sessionId) {
      return;
    }
    lastSavedStudySessionIdRef.current = sessionId;

    const sessionPayload = {
      action: 'saveStudySession',
      sessionId,
      userId: user.idNumber,
      userName: user.name,
      subject: activeSubject,
      deckName: activeDeck.name,
      deckFileId: activeDeck.fileId || '',
      mode: playMode,
      startedAt: sessionStartedAtIso || new Date(sessionStartTime).toISOString(),
      endedAt: new Date(sessionEndedAt).toISOString(),
      timeSpentSeconds: timeSpent,
      cardsInSession: queue.length,
      correct,
      incorrect,
      cardsAnswered,
      cardSummaries: Object.values(sessionCardSummaries)
    };
    
    try {
      await fetch(RESOURCE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify(sessionPayload)
      });
    } catch (error) {
      console.error('Failed to save session summary:', error);
    }

    try {
      await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'saveAnalytics',
          idNumber: user.idNumber,
          subject: activeSubject,
          deck: activeDeck.name,
          correct,
          incorrect,
          timeSpent
        })
      });
    } catch (error) {
      console.error('Failed to save analytics:', error);
    }
  };

  const fetchUserAnalytics = async () => {
    if (!user) return;
    const hasSnapshot = startedStudyProgressRows.length > 0;
    setLoadingAnalytics(!hasSnapshot);
    setRefreshingAnalytics(hasSnapshot);

    try {
      await syncProgressFromBackend();
      setUserAnalytics({
        success: true,
        studyProgress: true,
        refreshedAt: Date.now()
      });
    } catch (error) {
      console.error('Failed to sync study progress:', error);
    } finally {
      setLoadingAnalytics(false);
      setRefreshingAnalytics(false);
    }
  };

  const handleAnalyticsRefresh = () => {
    if (!user || refreshingAnalytics) return;
    void fetchUserAnalytics();
  };

  useEffect(() => {
    setUserAnalytics(null);
    setLoadingAnalytics(false);
    setRefreshingAnalytics(false);
  }, [user?.idNumber]);

  useEffect(() => {
    if (view === 'ANALYTICS' && user && !userAnalytics && !loadingAnalytics) {
      void fetchUserAnalytics();
    }
  }, [view, user, userAnalytics, loadingAnalytics]);

  // --- Actions ---

  const ANNOUNCEMENT_ADMIN_USER_ID = '2025-00046';

  // Semester Switch Function
  const handleSemesterSwitch = async (semester: '1st' | '2nd') => {
    if (activeSemester === semester) return;
    setSelectedSemesterView(semester);
    localStorage.setItem('cumlaude_selectedSemesterView', semester);
  };
  
  // Reset to current semester (auto-detect)
  const handleResetToCurrentSemester = async () => {
    if (!selectedSemesterView) return;
    setSelectedSemesterView(null);
    localStorage.removeItem('cumlaude_selectedSemesterView');
  };

  const handleLogout = () => {
    sessionBootstrapRequestRef.current += 1;
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    clearSecureSessionCache();
  };

  const handleLoginSuccess = async (authenticatedUser: User) => {
    const bootstrapRequestId = ++sessionBootstrapRequestRef.current;

    mapToPage('home', () => {
      setUser(authenticatedUser);
      setShowLogin(false);
      setShowProfile(false);
      setShowUpload(false);
      setShowRequestResource(false);
      setActiveSubject(null);
      setActiveDeck(null);
      setActiveResource(null);
      setActiveTab('Classroom');
      setViewHistory(['HOME']);
      setView('HOME');
    }, {
      studentId: authenticatedUser.idNumber,
      role: authenticatedUser.role || 'student',
      subject: null,
      course: null,
      deck: null,
      resource: null,
      tab: null
    }, { replace: true });

    void prefetchSessionBootstrapData(authenticatedUser).then(prefetchedData => {
      const activeUserRaw = localStorage.getItem(STORAGE_KEY_USER);
      let activeUserId: string | null = null;
      if (activeUserRaw) {
        try {
          activeUserId = JSON.parse(activeUserRaw)?.idNumber || null;
        } catch (error) {
          console.warn('Failed to parse cached user during session bootstrap:', error);
        }
      }
      const isStaleRequest =
        sessionBootstrapRequestRef.current !== bootstrapRequestId ||
        activeUserId !== authenticatedUser.idNumber;

      if (isStaleRequest) {
        return;
      }

      if (prefetchedData.subjects) {
        setApiSubjects(prefetchedData.subjects);
      }
      if (prefetchedData.subjectInfo) {
        setSubjectInfo(prefetchedData.subjectInfo);
      }
      if (prefetchedData.currentSemester) {
        setCurrentSemester(prefetchedData.currentSemester);
      }
      if (prefetchedData.academicYear !== undefined) {
        setAcademicYear(prefetchedData.academicYear);
      }
      if (prefetchedData.semesterConfig) {
        setSemesterConfig(prefetchedData.semesterConfig);
      }
      if (prefetchedData.semesterSubjects) {
        setSemesterSubjects(prefetchedData.semesterSubjects);
      }
      if (prefetchedData.semesterSchedules) {
        setSemesterSchedules(prefetchedData.semesterSchedules);
      }
    }).catch(error => {
      console.warn('Failed to hydrate post-login session data:', error);
    });
  };

  // Navigation helpers
  const navigateTo = (newView: AppView) => {
    mapToPage(VIEW_TO_PAGE[newView], () => {
      setViewHistory(prev => [...prev, view]);
      setShowLogin(false);
      setShowProfile(false);
      setShowUpload(false);
      setShowRequestResource(false);
      setView(newView);
    });
  };
  
  const goBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      const previousView = newHistory.pop()!;
      setViewHistory(newHistory);
      setView(previousView);
    } else {
      setView('HOME');
    }
  };
  
  const resetHome = () => {
    setViewHistory(['HOME']);
    setView('HOME');
    setActiveSubject(null);
    setActiveDeck(null);
    setActiveResource(null);
    setQueue([]);
    setCurrentIndex(0);
    setScores({});
  };

  const handleAdminClearAllCache = async () => {
    if (!user || !canUserBumpGlobalCache()) return;
    
    const toastId = addToast('Admin: Bumping cache version...', 'loading');
    
    try {
      // Call backend to bump cache version
      const response = await postToAppsScript({
        action: 'bumpCacheVersion',
        userId: user.idNumber,
        sessionToken: user.sessionToken
      });
      
      const result = await response.json();
      
      if (result.error) {
        updateToast(toastId, `Error: ${result.error}`, 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return;
      }
      
      updateToast(toastId, `Cache version bumped to v${result.newVersion}. All users will be forced to reset on their next check.`, 'success');
      setTimeout(() => removeToast(toastId), 2500);

      setTimeout(() => {
        void forceHardReset('Global cache reset triggered. Reloading this device...');
      }, 600);
    } catch (error: any) {
      updateToast(toastId, `Failed: ${error.message}`, 'error');
      setTimeout(() => removeToast(toastId), 4000);
    }
  };

  // Admin Announcement Functions
  const showPresetAnnouncement = async (type: 'congratulations' | 'post-final' | 'good-luck') => {
    const presets: Record<string, { title: string; message: string; emoji: string }> = {
      'congratulations': {
        title: 'Congratulations! 🎉',
        message: 'You did great! Keep up the excellent work and continue striving for success!',
        emoji: '🎉'
      },
      'post-final': {
        title: 'Post-Final Congratulations! 🎓',
        message: 'You made it through finals! Take a well-deserved break and celebrate your hard work. You\'ve earned it!',
        emoji: '🎓'
      },
      'good-luck': {
        title: 'Good Luck! 🍀',
        message: 'Wishing you all the best on your upcoming exam! Stay calm, trust your preparation, and give it your best shot. You\'ve got this!',
        emoji: '🍀'
      }
    };
    
    const preset = presets[type];
    const toastId = addToast('Publishing announcement...', 'loading');
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'createAnnouncement',
          userId: user?.idNumber,
          userName: user?.name,
          type,
          title: preset.title,
          message: preset.message,
          emoji: preset.emoji
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        updateToast(toastId, `Error: ${result.error}`, 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return;
      }
      
      // Show locally
      setActiveAnnouncement({
        id: result.announcement?.id || `preset-${type}-${Date.now()}`,
        type,
        title: preset.title,
        message: preset.message,
        emoji: preset.emoji
      });
      
      updateToast(toastId, '✓ Announcement published to all users!', 'success');
      setTimeout(() => removeToast(toastId), 3000);
    } catch (error: any) {
      updateToast(toastId, `Failed: ${error.message}`, 'error');
      setTimeout(() => removeToast(toastId), 4000);
    }
    
    setShowAnnouncementPanel(false);
  };

  const showCustomAnnouncement = async () => {
    if (!customAnnouncementTitle.trim() || !customAnnouncementMessage.trim()) {
      addToast('Please fill in title and message', 'error');
      return;
    }
    
    const toastId = addToast('Publishing announcement...', 'loading');
    
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'createAnnouncement',
          userId: user?.idNumber,
          userName: user?.name,
          type: 'custom',
          title: customAnnouncementTitle,
          message: customAnnouncementMessage,
          emoji: customAnnouncementEmoji
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        updateToast(toastId, `Error: ${result.error}`, 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return;
      }
      
      // Show locally
      setActiveAnnouncement({
        id: result.announcement?.id || `custom-${Date.now()}`,
        type: 'custom',
        title: customAnnouncementTitle,
        message: customAnnouncementMessage,
        emoji: customAnnouncementEmoji
      });
      
      updateToast(toastId, '✓ Announcement published to all users!', 'success');
      setTimeout(() => removeToast(toastId), 3000);
      
      // Clear form
      setCustomAnnouncementTitle('');
      setCustomAnnouncementMessage('');
      setCustomAnnouncementEmoji('🎉');
    } catch (error: any) {
      updateToast(toastId, `Failed: ${error.message}`, 'error');
      setTimeout(() => removeToast(toastId), 4000);
    }
    
    setShowAnnouncementPanel(false);
  };

  const dismissOngoingExamAlert = () => {
    if (ongoingExamAlert) {
      // Store dismissal time
      localStorage.setItem(`exam_alert_dismissed_${ongoingExamAlert.examId}`, String(Date.now()));
    }
    setOngoingExamAlert(null);
  };

  const openSubject = (subject: string) => {
    mapToPage('subject', () => {
      setViewHistory(prev => [...prev, view]);
      setShowLogin(false);
      setShowProfile(false);
      setShowUpload(false);
      setShowRequestResource(false);
      setActiveSubject(subject);
      setActiveTab('Classroom');
      setActiveDeck(null);
      setActiveResource(null);
      setView('SUBJECT');
    }, {
      subject,
      course: subject,
      tab: 'classroom',
      deck: null,
      resource: null
    });
  };

  const openDeck = async (deck: Deck) => {
    // Show loading state
    setDeckLoading(deck.name);
    const loadingToast = addToast(`Loading ${deck.name}...`, 'loading');
    
    // Small delay to show loading state (prevents flash)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setActiveDeck(deck);
    await syncDeckProgressForDeck(deck);
    
    removeToast(loadingToast);
    setDeckLoading(null);
    const subjectForDeck = deck.subject || activeSubject;
    mapToPage('deck', () => {
      setViewHistory(prev => [...prev, view]);
      setShowLogin(false);
      setShowProfile(false);
      setShowUpload(false);
      setShowRequestResource(false);
      if (subjectForDeck) {
        setActiveSubject(subjectForDeck);
      }
      setActiveTab('Classroom');
      setActiveResource(null);
      setActiveDeck(deck);
      setView('DECK_OVERVIEW');
    }, {
      subject: subjectForDeck || null,
      course: subjectForDeck || null,
      tab: 'classroom',
      deck: deck.name,
      resource: null
    });
  };

  const getDeckProgressStorageKey = (deckName: string, userId?: string | null): string => {
    const normalizedDeckName = String(deckName || '').trim();
    const normalizedUserId = String(userId || '').trim();
    return normalizedUserId
      ? `${PROGRESS_KEY_PREFIX}${normalizedUserId}_${normalizedDeckName}`
      : `${PROGRESS_KEY_PREFIX}guest_${normalizedDeckName}`;
  };

  const getLegacyDeckProgressStorageKey = (deckName: string): string => `${PROGRESS_KEY_PREFIX}${deckName}`;

  const parseDeckProgress = (savedProgressStr: string | null): DeckProgress | null => {
    if (savedProgressStr) {
      try {
        return JSON.parse(savedProgressStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const readDeckProgressLocal = (deckName: string, userId?: string | null): DeckProgress | null => {
    const primaryKey = getDeckProgressStorageKey(deckName, userId);
    const primaryProgress = parseDeckProgress(localStorage.getItem(primaryKey));
    if (primaryProgress) {
      return primaryProgress;
    }

    if (userId) {
      return null;
    }

    return parseDeckProgress(localStorage.getItem(getLegacyDeckProgressStorageKey(deckName)));
  };

  const getLocalDeckProgressEntries = (userId: string): Record<string, DeckProgress> => {
    const result: Record<string, DeckProgress> = {};
    const prefix = `${PROGRESS_KEY_PREFIX}${userId}_`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      const deckName = key.slice(prefix.length);
      const progress = parseDeckProgress(localStorage.getItem(key));
      if (deckName && progress) {
        result[deckName] = progress;
      }
    }

    return result;
  };

  const getProgressTimestamp = (progress: DeckProgress | null | undefined): number => {
    if (!progress?.lastUpdated) return 0;
    if (typeof progress.lastUpdated === 'number') return progress.lastUpdated;
    const parsed = Date.parse(progress.lastUpdated);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeProgressMode = (mode: DeckProgress['mode'] | string | undefined): DeckProgress['mode'] => {
    return mode === 'chronological' ? 'chronological' : 'shuffle';
  };

  const normalizeDeckProgressForDeck = (
    deck: Deck | null | undefined,
    progress: DeckProgress | null
  ): { progress: DeckProgress | null; changed: boolean } => {
    if (!deck || !progress) {
      return { progress, changed: false };
    }

    const validCardIds = new Set(deck.cards.map(card => card.id));
    const normalizedStatuses: DeckProgress['cardStatuses'] = {};
    const sourceStatuses = progress.cardStatuses || {};
    let changed = false;

    for (const card of deck.cards) {
      const status = sourceStatuses[card.id];
      if (status === 'correct' || status === 'incorrect' || status === 'unanswered') {
        normalizedStatuses[card.id] = status;
      } else {
        normalizedStatuses[card.id] = 'unanswered';
        if (status !== 'unanswered') changed = true;
      }
    }

    for (const storedId of Object.keys(sourceStatuses)) {
      if (!validCardIds.has(storedId)) {
        changed = true;
        break;
      }
    }

    const sourceOrder = Array.isArray(progress.shuffledOrder) ? progress.shuffledOrder : [];
    const normalizedOrder: string[] = [];
    for (const cardId of sourceOrder) {
      if (validCardIds.has(cardId) && !normalizedOrder.includes(cardId)) {
        normalizedOrder.push(cardId);
      } else if (cardId) {
        changed = true;
      }
    }
    for (const card of deck.cards) {
      if (!normalizedOrder.includes(card.id)) {
        normalizedOrder.push(card.id);
        if (sourceOrder.length > 0) changed = true;
      }
    }

    const answeredCount = Object.values(normalizedStatuses).filter(status => status !== 'unanswered').length;
    const normalizedCurrentIndex = Math.max(0, Math.min(
      Number.isFinite(Number(progress.currentIndex)) ? Math.floor(Number(progress.currentIndex)) : answeredCount,
      deck.cards.length
    ));
    if (normalizedCurrentIndex !== progress.currentIndex) {
      changed = true;
    }

    const normalizedMode = normalizeProgressMode(progress.mode);
    if (normalizedMode !== progress.mode) {
      changed = true;
    }

    return {
      progress: {
        deckName: deck.name,
        cardStatuses: normalizedStatuses,
        currentIndex: normalizedCurrentIndex,
        mode: normalizedMode,
        shuffledOrder: normalizedOrder,
        lastUpdated: progress.lastUpdated || Date.now()
      },
      changed
    };
  };

  const getDeckProgressForDeck = (deck: Deck | null | undefined): DeckProgress | null => {
    if (!deck) return null;
    const rawProgress = readDeckProgressLocal(deck.name, user?.idNumber);
    return normalizeDeckProgressForDeck(deck, rawProgress).progress;
  };

  const studyProgressRows = useMemo(() => {
    return decks
      .map(deck => {
        const progress = getDeckProgressForDeck(deck);
        const statuses = progress?.cardStatuses || {};
        const totalCards = deck.cards.length;
        const answeredCount = Object.values(statuses).filter(status => status !== 'unanswered').length;
        const correctCount = Object.values(statuses).filter(status => status === 'correct').length;
        const incorrectCount = Object.values(statuses).filter(status => status === 'incorrect').length;
        const progressPercent = totalCards > 0 ? Math.round((answeredCount / totalCards) * 100) : 0;
        const accuracyPercent = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
        const masteryPercent = totalCards > 0 ? Math.round((correctCount / totalCards) * 100) : 0;
        const lastUpdated = getProgressTimestamp(progress);
        const subjectCode = deck.subject || 'Uncategorized';

        return {
          deck,
          subjectCode,
          subjectName: subjectInfo[subjectCode]?.name || subjectCode,
          totalCards,
          answeredCount,
          correctCount,
          incorrectCount,
          progressPercent,
          accuracyPercent,
          masteryPercent,
          isCompleted: totalCards > 0 && answeredCount === totalCards,
          lastUpdated,
          hasProgress: answeredCount > 0
        };
      })
      .sort((left, right) => {
        if (right.lastUpdated !== left.lastUpdated) {
          return right.lastUpdated - left.lastUpdated;
        }
        return left.deck.name.localeCompare(right.deck.name);
      });
  }, [decks, progressVersion, subjectInfo, user?.idNumber]);

  const startedStudyProgressRows = useMemo(
    () => studyProgressRows.filter(row => row.hasProgress),
    [studyProgressRows]
  );

  const studyProgressSummary = useMemo(() => {
    const totalDecks = studyProgressRows.length;
    const startedDecks = startedStudyProgressRows.length;
    const completedDecks = startedStudyProgressRows.filter(row => row.isCompleted).length;
    const totalCards = studyProgressRows.reduce((sum, row) => sum + row.totalCards, 0);
    const answeredCards = studyProgressRows.reduce((sum, row) => sum + row.answeredCount, 0);
    const correctCards = studyProgressRows.reduce((sum, row) => sum + row.correctCount, 0);
    const incorrectCards = studyProgressRows.reduce((sum, row) => sum + row.incorrectCount, 0);
    const coveragePercent = totalCards > 0 ? Math.round((answeredCards / totalCards) * 100) : 0;
    const accuracyPercent = answeredCards > 0 ? Math.round((correctCards / answeredCards) * 100) : 0;
    const masteryPercent = totalCards > 0 ? Math.round((correctCards / totalCards) * 100) : 0;

    const bySubjectMap = new Map<string, {
      subjectCode: string;
      subjectName: string;
      deckCount: number;
      startedDeckCount: number;
      totalCards: number;
      answeredCount: number;
      correctCount: number;
      incorrectCount: number;
      lastUpdated: number;
    }>();

    studyProgressRows.forEach(row => {
      const existing = bySubjectMap.get(row.subjectCode) || {
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        deckCount: 0,
        startedDeckCount: 0,
        totalCards: 0,
        answeredCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        lastUpdated: 0
      };

      existing.deckCount += 1;
      existing.startedDeckCount += row.hasProgress ? 1 : 0;
      existing.totalCards += row.totalCards;
      existing.answeredCount += row.answeredCount;
      existing.correctCount += row.correctCount;
      existing.incorrectCount += row.incorrectCount;
      existing.lastUpdated = Math.max(existing.lastUpdated, row.lastUpdated);
      bySubjectMap.set(row.subjectCode, existing);
    });

    const bySubject = Array.from(bySubjectMap.values())
      .filter(subject => subject.startedDeckCount > 0)
      .map(subject => ({
        ...subject,
        coveragePercent: subject.totalCards > 0 ? Math.round((subject.answeredCount / subject.totalCards) * 100) : 0,
        accuracyPercent: subject.answeredCount > 0 ? Math.round((subject.correctCount / subject.answeredCount) * 100) : 0
      }))
      .sort((left, right) => {
        if (right.lastUpdated !== left.lastUpdated) {
          return right.lastUpdated - left.lastUpdated;
        }
        return left.subjectName.localeCompare(right.subjectName);
      });

    return {
      totalDecks,
      startedDecks,
      completedDecks,
      totalCards,
      answeredCards,
      correctCards,
      incorrectCards,
      coveragePercent,
      accuracyPercent,
      masteryPercent,
      bySubject
    };
  }, [startedStudyProgressRows, studyProgressRows]);

  const saveDeckProgressLocal = (deckName: string, progress: DeckProgress, userId?: string | null) => {
    const progressKey = getDeckProgressStorageKey(deckName, userId);
    localStorage.setItem(progressKey, JSON.stringify(progress));
    if (!userId) {
      localStorage.setItem(getLegacyDeckProgressStorageKey(deckName), JSON.stringify(progress));
    }
    setProgressVersion(prev => prev + 1);
  };

  const saveDeckProgress = async (deckName: string, progress: DeckProgress) => {
    const deck = decks.find(item => item.name === deckName) || (activeDeck?.name === deckName ? activeDeck : null);
    const normalizedProgress = normalizeDeckProgressForDeck(deck, {
      ...progress,
      deckName,
      mode: normalizeProgressMode(progress.mode),
      lastUpdated: Date.now()
    }).progress;

    if (!normalizedProgress) return;

    saveDeckProgressLocal(deckName, normalizedProgress, user?.idNumber);

    if (!user || !navigator.onLine) return;

    try {
      await fetch(RESOURCE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'saveDeckProgress',
          userId: user.idNumber,
          deckName,
          cardStatuses: normalizedProgress.cardStatuses,
          currentIndex: normalizedProgress.currentIndex,
          mode: normalizedProgress.mode,
          shuffledOrder: normalizedProgress.shuffledOrder,
          lastUpdated: normalizedProgress.lastUpdated
        })
      });
    } catch (error) {
      console.warn('Failed to sync deck progress to backend:', error);
    }
  };

  const clearDeckProgress = async (deckName: string): Promise<boolean> => {
    if (!user) {
      localStorage.removeItem(getDeckProgressStorageKey(deckName, null));
      localStorage.removeItem(getLegacyDeckProgressStorageKey(deckName));
      setProgressVersion(prev => prev + 1);
      return true;
    }

    if (!navigator.onLine) {
      console.warn('Cannot clear deck progress while offline.');
      return false;
    }

    try {
      const response = await fetch(RESOURCE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'clearDeckProgress',
          userId: user.idNumber,
          deckName
        })
      });
      const data = await response.json();
      if (!data.success) {
        console.warn('Failed to clear deck progress from backend:', data.error || data);
        return false;
      }

      localStorage.removeItem(getDeckProgressStorageKey(deckName, user.idNumber));
      localStorage.removeItem(getLegacyDeckProgressStorageKey(deckName));
      setProgressVersion(prev => prev + 1);
      return true;
    } catch (error) {
      console.warn('Failed to clear deck progress from backend:', error);
      return false;
    }
  };

  const fetchDeckProgressFromBackend = async (deckName: string): Promise<DeckProgress | null> => {
    if (!user || !navigator.onLine || !deckName) return null;

    try {
      const response = await fetch(RESOURCE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getDeckProgress',
          userId: user.idNumber,
          deckName
        })
      });
      const data = await response.json();
      return data.success ? data.progress || null : null;
    } catch (error) {
      console.warn('Failed to fetch deck progress from backend:', error);
      return null;
    }
  };

  const syncDeckProgressForDeck = async (deck: Deck): Promise<DeckProgress | null> => {
    const localProgress = normalizeDeckProgressForDeck(deck, readDeckProgressLocal(deck.name, user?.idNumber)).progress;
    const remoteProgress = normalizeDeckProgressForDeck(deck, await fetchDeckProgressFromBackend(deck.name)).progress;

    const winner = getProgressTimestamp(remoteProgress) > getProgressTimestamp(localProgress)
      ? remoteProgress
      : localProgress;

    if (winner) {
      saveDeckProgressLocal(deck.name, winner, user?.idNumber);
    }

    if (user && navigator.onLine && localProgress && getProgressTimestamp(localProgress) > getProgressTimestamp(remoteProgress)) {
      void saveDeckProgress(deck.name, localProgress);
    }

    return winner;
  };

  // Sync all deck progress from backend on login
  const syncProgressFromBackend = async () => {
    if (!user || !navigator.onLine) return;

    try {
      const response = await fetch(RESOURCE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getAllDeckProgress',
          userId: user.idNumber
        })
      });
      const data = await response.json();
      if (!data.success || !data.progress) return;

      const localEntries = getLocalDeckProgressEntries(user.idNumber);
      const remoteEntries = data.progress as Record<string, DeckProgress>;
      const deckMap = new Map(decks.map(deck => [deck.name, deck]));
      const deckNames = new Set([...Object.keys(localEntries), ...Object.keys(remoteEntries)]);

      for (const deckName of deckNames) {
        const deck = deckMap.get(deckName) || null;
        const localProgress = normalizeDeckProgressForDeck(deck, localEntries[deckName] || null).progress;
        const remoteProgress = normalizeDeckProgressForDeck(deck, remoteEntries[deckName] || null).progress;
        const localTime = getProgressTimestamp(localProgress);
        const remoteTime = getProgressTimestamp(remoteProgress);

        if (remoteTime > localTime && remoteProgress) {
          saveDeckProgressLocal(deckName, remoteProgress, user.idNumber);
        } else if (localProgress) {
          saveDeckProgressLocal(deckName, localProgress, user.idNumber);
          if (localTime > remoteTime) {
            void saveDeckProgress(deckName, localProgress);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to sync deck progress from backend:', error);
    }
  };

  // Sync progress from backend when user logs in
  useEffect(() => {
    if (user) {
      void syncProgressFromBackend();
    }
  }, [user, decks]);

  // --- Exam Functions ---
  
  // Helper to parse time from various formats (HH:MM, H:MM, decimal from Google Sheets, etc.)
  const parseTimeString = (timeStr: string | number): { hour: number; min: number } => {
    if (typeof timeStr === 'number') {
      // Google Sheets stores time as decimal fraction of day (e.g., 0.333... for 8:00 AM)
      const totalMinutes = Math.round(timeStr * 24 * 60);
      return { hour: Math.floor(totalMinutes / 60), min: totalMinutes % 60 };
    }
    
    const str = String(timeStr || '').trim();
    if (!str) return { hour: 0, min: 0 };
    
    // Handle "HH:MM" or "H:MM" format
    if (str.includes(':')) {
      const parts = str.split(':');
      return { hour: parseInt(parts[0]) || 0, min: parseInt(parts[1]) || 0 };
    }
    
    // Handle just hour number
    const hourNum = parseInt(str);
    if (!isNaN(hourNum)) {
      return { hour: hourNum, min: 0 };
    }
    
    return { hour: 0, min: 0 };
  };
  
  const getExamStatus = (exam: Exam): 'upcoming' | 'ongoing' | 'completed' => {
    // Use currentTime state for real-time updates
    const now = currentTime;
    
    // Parse date correctly - split to avoid timezone issues
    const dateStr = String(exam.date);
    let examDate: Date;
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-').map(Number);
      examDate = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      examDate = new Date(dateStr);
    }
    
    const { hour: startHour, min: startMin } = parseTimeString(exam.startTime);
    const { hour: endHour, min: endMin } = parseTimeString(exam.endTime || '23:59');
    
    const startDateTime = new Date(examDate);
    startDateTime.setHours(startHour, startMin, 0, 0);
    
    const endDateTime = new Date(examDate);
    // Set end time to the END of the minute (59 seconds, 999 ms) for proper comparison
    endDateTime.setHours(endHour || 23, endMin || 59, 59, 999);
    
    // Handle case where end time equals or is before start time (use end of day instead)
    if (endDateTime.getTime() <= startDateTime.getTime()) {
      endDateTime.setHours(23, 59, 59, 999);
    }
    
    if (now < startDateTime) return 'upcoming';
    if (now <= endDateTime) return 'ongoing';
    return 'completed';
  };

  // Calculate time remaining until exam starts
  const getTimeUntilExam = (exam: Exam): { days: number; hours: number; minutes: number; seconds: number; total: number } | null => {
    const now = currentTime;
    
    // Parse date
    const dateStr = String(exam.date);
    let examDate: Date;
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-').map(Number);
      examDate = new Date(year, month - 1, day);
    } else {
      examDate = new Date(dateStr);
    }
    
    const { hour: startHour, min: startMin } = parseTimeString(exam.startTime);
    const startDateTime = new Date(examDate);
    startDateTime.setHours(startHour, startMin, 0, 0);
    
    const diff = startDateTime.getTime() - now.getTime();
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds, total: diff };
  };

  // Format countdown display
  const formatCountdown = (exam: Exam): string => {
    const time = getTimeUntilExam(exam);
    if (!time) return '';
    
    if (time.days > 0) {
      return `${time.days}d ${time.hours}h left`;
    } else if (time.hours > 0) {
      return `${time.hours}h ${time.minutes}m left`;
    } else if (time.minutes > 0) {
      return `${time.minutes}m ${time.seconds}s left`;
    } else {
      return `${time.seconds}s left`;
    }
  };

  // Detect when exams transition to ongoing or completed status
  useEffect(() => {
    if (exams.length === 0) return;
    
    const currentStatuses: Record<string, string> = {};
    exams.forEach(exam => {
      currentStatuses[exam.examId] = getExamStatus(exam);
    });
    
    // Check for any exam that just became ongoing or completed
    exams.forEach(exam => {
      const prevStatus = previousExamStatuses[exam.examId];
      const currentStatus = currentStatuses[exam.examId];
      
      // If status changed from upcoming to ongoing, show alert
      if (prevStatus === 'upcoming' && currentStatus === 'ongoing') {
        // Check if this alert was already dismissed recently (within 1 hour)
        const dismissKey = `exam_alert_dismissed_${exam.examId}`;
        const dismissedAt = localStorage.getItem(dismissKey);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        if (!dismissedAt || parseInt(dismissedAt) < oneHourAgo) {
          setOngoingExamAlert(exam);
        }
      }
      
      // If status changed from ongoing to completed, show celebration
      if (prevStatus === 'ongoing' && currentStatus === 'completed') {
        // Check if this celebration was already shown recently (within 1 hour)
        const celebrationKey = `exam_celebration_shown_${exam.examId}`;
        const shownAt = localStorage.getItem(celebrationKey);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        if (!shownAt || parseInt(shownAt) < oneHourAgo) {
          setCompletedExamAlert(exam);
        }
      }
    });
    
    setPreviousExamStatuses(currentStatuses);
  }, [currentTime, exams]);
  
  // Dismiss completed exam celebration
  const dismissCompletedExamAlert = () => {
    if (completedExamAlert) {
      localStorage.setItem(`exam_celebration_shown_${completedExamAlert.examId}`, String(Date.now()));
    }
    setCompletedExamAlert(null);
  };
  
  const getSubjectExams = (subjectCode: string): Exam[] => {
    const normalizedSubjectCode = String(subjectCode || '').trim().toUpperCase();
    return exams.filter(e => String(e.courseCode || '').trim().toUpperCase() === normalizedSubjectCode);
  };

  const scheduleDayOrder: Record<string, number> = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7
  };

  const sortClassSchedules = (a: ClassSchedule, b: ClassSchedule) => {
    const statusWeight: Record<string, number> = {
      today: 0,
      upcoming: 1,
      scheduled: 2,
      completed: 3
    };

    const statusDelta = (statusWeight[a.status] ?? 99) - (statusWeight[b.status] ?? 99);
    if (statusDelta !== 0) return statusDelta;

    if (a.type === 'semestral' && b.type === 'semestral') {
      const dayDelta = (scheduleDayOrder[a.dayOfWeek] ?? 99) - (scheduleDayOrder[b.dayOfWeek] ?? 99);
      if (dayDelta !== 0) return dayDelta;
      return a.startTime.localeCompare(b.startTime);
    }

    if (a.type === 'semestral') return -1;
    if (b.type === 'semestral') return 1;

    const dateDelta = (a.specificDate || '').localeCompare(b.specificDate || '');
    if (dateDelta !== 0) return dateDelta;
    return a.startTime.localeCompare(b.startTime);
  };

  const getSubjectSchedules = (subjectCode: string) =>
    semesterSchedules
      .filter(schedule => schedule.courseCode === subjectCode)
      .sort(sortClassSchedules);

  const formatScheduleDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatScheduleTimeRange = (schedule: ClassSchedule) => {
    const start = schedule.startTime12h || formatExamTime(schedule.startTime);
    const end = schedule.endTime12h || formatExamTime(schedule.endTime);
    return `${start} - ${end}`;
  };

  const describeSchedule = (schedule: ClassSchedule) => {
    if (schedule.type === 'semestral') {
      return `${schedule.dayOfWeek} • ${formatScheduleTimeRange(schedule)}`;
    }

    return `${formatScheduleDate(schedule.specificDate)} • ${formatScheduleTimeRange(schedule)}`;
  };
  
  const formatExamDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const formatExamTime = (time: string | number): string => {
    const { hour, min } = parseTimeString(time);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${min.toString().padStart(2, '0')} ${ampm}`;
  };

  useEffect(() => {
    if (!showAddExam || selectedExamCourseCode || !activeSubject) return;
    setSelectedExamCourseCode(activeSubject);
    setSelectedExamCourseName(subjectInfo[activeSubject]?.name || '');
  }, [showAddExam, selectedExamCourseCode, activeSubject, subjectInfo]);

  const getExamTypeColor = (examType: string) => {
    const colors: Record<string, { bg: string; text: string; dot: string }> = {
      'Activity': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
      'Special Event': { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
      'Meeting': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
      'Workshop': { bg: 'bg-lime-50', text: 'text-lime-700', dot: 'bg-lime-500' },
      'Midterm Exam': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
      'Final Exam': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
      'Quiz': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
      'LE Deadline': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
      'Reporting': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
      'Performance': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      'Presentation': { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
      'Submission': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      'Exam': { bg: 'bg-stone-100', text: 'text-stone-700', dot: 'bg-stone-500' }
    };
    return colors[examType] || { bg: 'bg-stone-100', text: 'text-stone-700', dot: 'bg-stone-400' };
  };

  const toDateKey = (dateInput: string | Date) => {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  };

  // --- Push Notifications (Firebase Cloud Messaging) ---
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD9igTpHd8LsXCZhGarVB2PnrO2aszNQGc",
    authDomain: "cumlaude-push.firebaseapp.com",
    projectId: "cumlaude-push",
    storageBucket: "cumlaude-push.firebasestorage.app",
    messagingSenderId: "56596622764",
    appId: "1:56596622764:web:05ec45b90f51e096e09e09"
  };
  
  // VAPID key for Web Push - Get this from Firebase Console:
  // Project Settings > Cloud Messaging > Web Push certificates > Generate key pair
  const VAPID_KEY = "BL7BTB7fXiUHWFXMiWRESw_1MkEFiGBr_OMMVKB0sc5TpOs04r2TcK5UC14odQ8qE3r-DqlbnHiYg8UH8qns1hA";

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      setNotificationPermission('granted');
      return true;
    }
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm as 'granted' | 'denied' | 'default');
    return perm === 'granted';
  };

  const registerPush = async () => {
    try {
      console.log('🔔 Starting notification registration...');
      
      if (!('serviceWorker' in navigator)) {
        console.error('Service Worker not supported');
        addToast('Notifications not supported in this browser.', 'error');
        return;
      }
      
      // Check if Firebase is configured
      if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes('YOUR_')) {
        console.warn('Firebase not configured. See setup instructions.');
        addToast('Notifications require Firebase setup. Check console for instructions.', 'info');
        return;
      }

      console.log('🔑 Requesting notification permission...');
      const permission = await requestNotificationPermission();
      if (!permission) {
        console.warn('Permission denied or blocked');
        addToast('Notifications blocked. Please enable in browser settings.', 'error');
        return;
      }
      console.log('✅ Permission granted!');

      // Ensure service worker is registered and ready
      console.log('⚙️ Ensuring service worker is ready...');
      let registration;
      try {
        registration = await ensureAppServiceWorker();
        console.log('✅ Service worker registered:', registration.scope);
        // Wait for the service worker to be active
        await navigator.serviceWorker.ready;
        console.log('✅ Service worker is active and ready!');
      } catch (swError) {
        console.error('❌ Service worker registration failed:', swError);
        addToast('Service worker registration failed. Please check console.', 'error');
        return;
      }

      // Initialize Firebase (will be loaded from CDN)
      const windowWithFirebase = window as any;
      if (!windowWithFirebase.firebase) {
        console.error('Firebase not loaded from CDN');
        addToast('Firebase not loaded. Please refresh the page.', 'error');
        return;
      }

      const firebase = windowWithFirebase.firebase;
      
      if (!firebase.apps.length) {
        console.log('🔥 Initializing Firebase...');
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      console.log('📱 Getting FCM messaging instance...');
      const messaging = firebase.messaging();
      
      console.log('🎫 Requesting FCM token...');
      // Get FCM token - service worker is now guaranteed to be ready
      // Note: You need to generate a VAPID key from Firebase Console if you haven't already
      const tokenOptions: any = { serviceWorkerRegistration: registration };
      
      // Only add VAPID key if it's configured (not the placeholder)
      if (VAPID_KEY && !VAPID_KEY.includes('XqJxM7LnE9')) {
        tokenOptions.vapidKey = VAPID_KEY;
      }
      
      const token = await messaging.getToken(tokenOptions);
      
      console.log('🎫 Token received:', token ? 'Yes' : 'No');

      if (token) {
        console.log('💾 Saving token locally and to backend...');
        localStorage.setItem('cumlaude_fcm_token', token);
        setNotificationPermission('granted');
        
        // Save to backend
        try {
          console.log('📡 Sending to backend...');
          console.log('User ID:', user?.idNumber);
          console.log('User Name:', user?.name);
          
          const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
              action: 'savePushSubscription',
              userId: user?.idNumber,
              userName: user?.name,
              subscription: { token, type: 'fcm' }
            })
          });
          const result = await response.json();
          console.log('✅ Backend response:', result);
          
          if (result.error) {
            console.error('❌ Backend error:', result.error);
            addToast('Notifications enabled locally, but backend save failed.', 'error');
            setNotificationsEnabled(true); // Still enabled locally
          } else {
            console.log('✅ Successfully saved to backend!');
            addToast('Notifications enabled successfully!', 'success');
            setNotificationsEnabled(true);
          }
        } catch (e) {
          console.error('❌ Failed to save token to backend:', e);
          addToast('Notifications enabled locally, but backend save failed.', 'error');
        }
        
        console.log('👂 Setting up foreground message listener...');
        // Listen for foreground messages
        messaging.onMessage((payload: any) => {
          console.log('📬 Foreground message:', payload);
          const title = payload.notification?.title || 'Classroom Virtual Environment';
          const body = payload.notification?.body || 'New notification';
          addToast(`${title}: ${body}`, 'info');
        });
      } else {
        console.error('❌ No token received');
        addToast('Could not get notification token. Please try again.', 'error');
      }
    } catch (e) {
      console.error('❌ Push registration failed:', e);
      addToast('Could not enable notifications: ' + (e as Error).message, 'error');
    }
  };

  useEffect(() => {
    // Pre-register service worker on app load for faster push notification setup
    if ('serviceWorker' in navigator) {
      ensureAppServiceWorker()
        .then(reg => console.log('✅ Service worker pre-registered:', reg.scope))
        .catch(err => console.warn('⚠️ Service worker pre-registration failed:', err));
    }
  }, []);

  useEffect(() => {
    // Check initial notification permission and enabled state
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission as 'granted' | 'denied' | 'default');
    }
    // Check if FCM token exists (means notifications were enabled)
    const fcmToken = localStorage.getItem('cumlaude_fcm_token');
    if (fcmToken) {
      setNotificationsEnabled(true);
    }
  }, []);
  
  useEffect(() => {
    // Auto-register removed - user must enable via settings
  }, [user]);
  
  const fetchObligationsFromBackend = async (subject?: string | null) => {
    const startedAt = Date.now();
    setIsObligationsLoading(true);
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'getObligations',
          subject: subject || undefined
        })
      });
      const result = await response.json();

      if (result.success && Array.isArray(result.obligations || result.exams)) {
        const items = result.obligations || result.exams;
        setExams(items);
        localStorage.setItem('cumlaude_obligations', JSON.stringify(items));
        return items;
      }

      setExams([]);
      localStorage.setItem('cumlaude_obligations', JSON.stringify([]));
      return [];
    } catch (error) {
      console.warn('Failed to load obligations:', error);
      return null;
    } finally {
      const elapsed = Date.now() - startedAt;
      const minSkeletonTime = 180;
      if (elapsed < minSkeletonTime) {
        await new Promise(resolve => setTimeout(resolve, minSkeletonTime - elapsed));
      }
      setIsObligationsLoading(false);
    }
  };

  const getObligationLabel = (exam: Pick<Exam, 'examType' | 'courseCode' | 'date' | 'startTime'>) => {
    const parts = [exam.examType, exam.courseCode, formatExamDate(exam.date)];
    if (exam.startTime) {
      parts.push(formatExamTime(exam.startTime));
    }
    return parts.filter(Boolean).join(' • ');
  };

  const syncLinkedResourcesForObligation = async (exam: Pick<Exam, 'examId' | 'examType' | 'courseCode' | 'date' | 'startTime'>) => {
    if (!navigator.onLine || !exam.examId) return;
    try {
      await fetch(RESOURCE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'syncObligationLinks',
          obligationId: exam.examId,
          obligationType: exam.examType,
          obligationLabel: getObligationLabel(exam),
          courseCode: exam.courseCode
        })
      });
    } catch (error) {
      console.warn('Failed to sync linked resources for obligation:', error);
    }
  };

  const deleteLinkedResourcesForObligation = async (obligationId: string) => {
    if (!navigator.onLine || !obligationId) return;
    try {
      await fetch(RESOURCE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteObligationLinks',
          obligationId
        })
      });
    } catch (error) {
      console.warn('Failed to delete linked resources for obligation:', error);
    }
  };

  const getLinkedResourcesForObligation = (obligationId: string) => {
    if (!obligationId) return [] as Resource[];
    return Object.entries(resources).flatMap(([subjectCode, items]) =>
      items
        .filter(resource => resource.linkedObligations?.some(link => link.obligationId === obligationId))
        .map(resource => ({ ...resource, subject: resource.subject || subjectCode }))
    );
  };

  const addExamToBackend = async (exam: { courseCode: string; courseName: string; examType: string; date: string; startTime: string; endTime: string; room: string; proctor: string; notes: string }) => {
    if (!user) {
      addToast('Please login to add obligations', 'error');
      return false;
    }
    
    const toastId = addToast('Adding obligation...', 'loading');
    
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'addObligation',
          ...exam,
          userId: user.idNumber,
          userName: user.name
        })
      });
      const result = await response.json();
      
      if (result.success) {
        updateToast(toastId, 'Obligation added!', 'success');
        setTimeout(() => removeToast(toastId), 2000);
        await fetchObligationsFromBackend();
        if (result.obligation?.examId || result.obligation?.obligationId) {
          await syncLinkedResourcesForObligation({
            examId: result.obligation.examId || result.obligation.obligationId,
            examType: result.obligation.examType || exam.examType,
            courseCode: result.obligation.courseCode || exam.courseCode,
            date: result.obligation.date || exam.date,
            startTime: result.obligation.startTime || exam.startTime
          });
        }
        return true;
      } else {
        updateToast(toastId, result.error || 'Failed to add obligation', 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return false;
      }
    } catch (e) {
      updateToast(toastId, 'Failed to add obligation', 'error');
      setTimeout(() => removeToast(toastId), 4000);
      return false;
    }
  };
  
  const deleteExamFromBackend = async (examId: string) => {
    if (!user) {
      addToast('Please login to delete obligations', 'error');
      return false;
    }
    
    const toastId = addToast('Deleting obligation...', 'loading');
    
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'deleteObligation',
          obligationId: examId,
          userId: user.idNumber
        })
      });
      const result = await response.json();
      
      if (result.success) {
        updateToast(toastId, 'Obligation deleted!', 'success');
        setTimeout(() => removeToast(toastId), 2000);
        setExamToDelete(null);
        await deleteLinkedResourcesForObligation(examId);
        await fetchObligationsFromBackend();
        return true;
      } else {
        updateToast(toastId, result.error || 'Failed to delete obligation', 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return false;
      }
    } catch (e) {
      updateToast(toastId, 'Failed to delete obligation', 'error');
      setTimeout(() => removeToast(toastId), 4000);
      return false;
    }
  };

  const updateExamToBackend = async (examId: string, updates: Partial<Exam>) => {
    if (!user) {
      addToast('Please login to edit obligations', 'error');
      return false;
    }
    const currentExam = exams.find(exam => exam.examId === examId);
    
    const toastId = addToast('Updating obligation...', 'loading');
    
    try {
      const response = await fetch(CLASS_SCHEDULE_GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateObligation',
          obligationId: examId,
          ...updates,
          userId: user.idNumber
        })
      });
      const result = await response.json();
      
      if (result.success) {
        updateToast(toastId, 'Obligation updated!', 'success');
        setTimeout(() => removeToast(toastId), 2000);
        await syncLinkedResourcesForObligation({
          examId,
          examType: (updates.examType as string) || currentExam?.examType || '',
          courseCode: (updates.courseCode as string) || currentExam?.courseCode || '',
          date: (updates.date as string) || currentExam?.date || '',
          startTime: (updates.startTime as string) || currentExam?.startTime || ''
        });
        await fetchObligationsFromBackend();
        return true;
      } else {
        updateToast(toastId, result.error || 'Failed to update obligation', 'error');
        setTimeout(() => removeToast(toastId), 4000);
        return false;
      }
    } catch (e) {
      updateToast(toastId, 'Failed to update obligation', 'error');
      setTimeout(() => removeToast(toastId), 4000);
      return false;
    }
  };

  const openResource = (resource: Resource) => {
    mapToPage('resource', () => {
      setViewHistory(prev => [...prev, view]);
      setShowLogin(false);
      setShowProfile(false);
      setShowUpload(false);
      setShowRequestResource(false);
      setActiveTab('Resources');
      setActiveDeck(null);
      setActiveResource(resource);
      setPreviousView('SUBJECT');
      setView('RESOURCE_VIEW');
    }, {
      subject: activeSubject || null,
      course: activeSubject || null,
      tab: 'resources',
      deck: null,
      resource: resource.name
    });
  };

  const startSession = (mode: 'new' | 'retry' | 'smart' | 'continue', selectedPlayMode?: 'shuffle' | 'chronological') => {
    if (!activeDeck || sessionActionBusy) return;
    setSessionActionBusy(true);
    let newQueue: Card[] = [];
    let startIndex = 0;
    let initialScores: Record<string, 'correct' | 'incorrect'> = {};
    let baseCardStatuses: DeckProgress['cardStatuses'] | null = null;
    const currentPlayMode = selectedPlayMode || playMode;
    const existingProgress = getDeckProgressForDeck(activeDeck);

    if (mode === 'continue') {
      // Get progress from storage
      if (!existingProgress) {
        // No progress found, start fresh
        if (currentPlayMode === 'shuffle') {
          newQueue = [...activeDeck.cards].sort(() => Math.random() - 0.5);
        } else {
          newQueue = [...activeDeck.cards];
        }
        setPlayMode(currentPlayMode);
      } else {
        // Continue from saved progress - get cards that haven't been answered
        const unansweredIds = Object.entries(existingProgress.cardStatuses)
          .filter(([_, status]) => status === 'unanswered')
          .map(([id]) => id);
        
        if (existingProgress.shuffledOrder) {
          // Keep the original shuffle order but filter to unanswered
          newQueue = existingProgress.shuffledOrder
            .filter(id => unansweredIds.includes(id))
            .map(id => activeDeck.cards.find(c => c.id === id)!)
            .filter(Boolean);
        } else {
          newQueue = activeDeck.cards.filter(c => unansweredIds.includes(c.id));
        }
        
        // Convert card statuses to scores for already answered cards
        Object.entries(existingProgress.cardStatuses).forEach(([id, status]) => {
          if (status === 'correct') initialScores[id] = 'correct';
          else if (status === 'incorrect') initialScores[id] = 'incorrect';
        });
        baseCardStatuses = { ...existingProgress.cardStatuses };
        setPlayMode(existingProgress.mode);
      }
    } else if (mode === 'new') {
      if (currentPlayMode === 'shuffle') {
        newQueue = [...activeDeck.cards].sort(() => Math.random() - 0.5);
      } else {
        newQueue = [...activeDeck.cards];
      }
      setPlayMode(currentPlayMode);
    } else if (mode === 'retry') {
      baseCardStatuses = existingProgress ? { ...existingProgress.cardStatuses } : null;
      const incorrectIds = existingProgress ? Object.entries(existingProgress.cardStatuses).filter(([_, s]) => s === 'incorrect').map(([id]) => id) : Object.keys(scores).filter(id => scores[id] === 'incorrect');
      newQueue = activeDeck.cards.filter(c => incorrectIds.includes(c.id));
      if (currentPlayMode === 'shuffle') {
        newQueue = newQueue.sort(() => Math.random() - 0.5);
      }
    } else if (mode === 'smart') {
      baseCardStatuses = existingProgress ? { ...existingProgress.cardStatuses } : null;
      const incorrectIds = existingProgress ? Object.entries(existingProgress.cardStatuses).filter(([_, s]) => s === 'incorrect').map(([id]) => id) : Object.keys(scores).filter(id => scores[id] === 'incorrect');
      const incorrect = activeDeck.cards.filter(c => incorrectIds.includes(c.id));
      const others = activeDeck.cards.filter(c => !incorrectIds.includes(c.id));
      if (currentPlayMode === 'shuffle') {
        newQueue = [...incorrect.sort(() => Math.random() - 0.5), ...others.sort(() => Math.random() - 0.5)];
      } else {
        newQueue = [...incorrect, ...others];
      }
    }

    if (newQueue.length === 0) {
      setAlertModal({ isOpen: true, title: 'No Cards', message: 'No cards available to play!', type: 'warning' });
      setSessionActionBusy(false);
      return;
    }

    // For continue mode, preserve the existing progress, just update currentIndex
    if (mode === 'continue') {
      if (existingProgress) {
        // Keep existing progress, just mark we're continuing
        const updatedProgress = { ...existingProgress, lastUpdated: Date.now() };
        saveDeckProgress(activeDeck.name, updatedProgress);
      }
    } else {
      // Initialize progress for this session (new, retry, smart modes)
      const newProgress: DeckProgress = {
        deckName: activeDeck.name,
        cardStatuses: {},
        currentIndex: 0,
        mode: currentPlayMode,
        shuffledOrder: newQueue.map(c => c.id),
        lastUpdated: Date.now()
      };
      // Populate initial card statuses - include all deck cards
      activeDeck.cards.forEach(card => {
        const preservedStatus = baseCardStatuses?.[card.id];
        if (preservedStatus === 'correct' || preservedStatus === 'incorrect' || preservedStatus === 'unanswered') {
          newProgress.cardStatuses[card.id] = preservedStatus;
        } else {
          newProgress.cardStatuses[card.id] = 'unanswered';
        }
      });
      saveDeckProgress(activeDeck.name, newProgress);
    }

    setScores(initialScores);
    setQueue(newQueue);
    setCurrentIndex(startIndex);
    setIsFlipped(false);
    const sessionStart = Date.now();
    setSessionStartTime(sessionStart);
    setSessionStartedAtIso(new Date(sessionStart).toISOString());
    setCurrentCardStartedAt(sessionStart);
    setCardSessionSummaries({});
    lastSavedStudySessionIdRef.current = '';
    setSavedProgress(null);
    setShowContinueModal(false);
    setView('PLAY');
    setSessionActionBusy(false);
  };

  const handleScore = (result: 'correct' | 'incorrect') => {
    if (sessionActionBusy) return;
    setSessionActionBusy(true);
    const card = queue[currentIndex];
    const newScores = { ...scores, [card.id]: result };
    setScores(newScores);
    const scoredAt = Date.now();
    const timeSpentMs = Math.max(0, scoredAt - (currentCardStartedAt || sessionStartTime || scoredAt));
    const updatedCardSessionSummaries: Record<string, CardSessionSummary> = {
      ...cardSessionSummaries,
      [card.id]: {
        cardId: card.id,
        question: card.q,
        answer: card.a,
        finalStatus: result,
        attemptCount: (cardSessionSummaries[card.id]?.attemptCount || 0) + 1,
        timeSpentMs: (cardSessionSummaries[card.id]?.timeSpentMs || 0) + timeSpentMs
      }
    };
    setCardSessionSummaries(updatedCardSessionSummaries);
    
    // Update saved progress
    if (activeDeck) {
      const progress = getDeckProgressForDeck(activeDeck);
      if (progress) {
        progress.cardStatuses[card.id] = result;
        progress.currentIndex = currentIndex + 1;
        progress.lastUpdated = Date.now();
        saveDeckProgress(activeDeck.name, progress);
      }
    }
    
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < queue.length - 1) {
        setCurrentCardStartedAt(Date.now());
        setCurrentIndex(prev => prev + 1);
        setSessionActionBusy(false);
      } else {
        // Session ended - calculate final scores and save analytics
        const correct = Object.values(newScores).filter(s => s === 'correct').length;
        const incorrect = Object.values(newScores).filter(s => s === 'incorrect').length;
        void saveSessionAnalytics(correct, incorrect, scoredAt, updatedCardSessionSummaries);
        setView('SUMMARY');
        setSessionActionBusy(false);
      }
    }, 200);
  };

  const resetHomeState = () => {
    setActiveSubject(null);
    setActiveDeck(null);
    setActiveResource(null);
    setQueue([]);
    setCurrentIndex(0);
    setScores({});
  };

  // Get the active semester (manual override or auto-detected)
  const activeSemester = selectedSemesterView || currentSemester;
  
  // Subjects are sourced only from the class schedule backend.
  const displaySubjects = semesterSubjects;
  const displaySubjectSet = new Set(displaySubjects);
  const semesterUploadedResourcesCount = displaySubjects.reduce(
    (sum, subject) => sum + (resources[subject]?.length || 0),
    0
  );
  const semesterDeckResourcesCount = decks.reduce(
    (sum, deck) => sum + ((deck.subject && displaySubjectSet.has(deck.subject)) ? 1 : 0),
    0
  );
  const semesterResourcesCount = semesterUploadedResourcesCount + semesterDeckResourcesCount;

  // --- Views ---

  // HOME View
  if (view === 'HOME') {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-[#F5F5F4]'}`}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {/* Update Available Toast */}
        {showUpdateToast && newVersionAvailable && (
          <div className="fixed bottom-20 left-4 right-4 z-[95] animate-slide-up">
            <div className="max-w-md mx-auto bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-4 rounded-2xl shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name="system_update" className="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">New Version Available!</p>
                <p className="text-sm text-emerald-100">v{newVersionAvailable} • Tap update to get the latest features</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button 
                  onClick={() => setShowUpdateToast(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Icon name="close" className="text-emerald-100" />
                </button>
                <button 
                  onClick={handleUpdateApp}
                  className="px-4 py-2 bg-white text-emerald-700 rounded-xl font-semibold hover:bg-emerald-50 transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* PWA Install Toast */}
        {showInstallToast && !isAppInstalled && (
          <div className="fixed bottom-20 left-4 right-4 z-[90] animate-slide-up">
            <div className="max-w-md mx-auto bg-gradient-to-r from-stone-800 to-stone-700 text-white p-4 rounded-2xl shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name="download" className="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Install Classroom Virtual Environment</p>
                <p className="text-sm text-stone-300">Get faster access & offline support</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button 
                  onClick={handleDismissInstall}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Icon name="close" className="text-stone-300" />
                </button>
                <button 
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-white text-stone-800 rounded-xl font-semibold hover:bg-stone-100 transition-colors"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        )}
        
        <LoginModal
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
          onLogin={handleLoginSuccess}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />

        {/* Profile Page */}
        {showProfile && user && (
          <ProfilePage
            user={user}
            onClose={() => setShowProfile(false)}
            onLogout={() => {
              handleLogout();
              setShowProfile(false);
            }}
            onUpdate={(updatedUser) => setUser(updatedUser)}
            addToast={addToast}
            updateToast={updateToast}
            removeToast={removeToast}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        )}

        {/* Admin Announcement Panel */}
        {showAnnouncementPanel && user?.idNumber === ANNOUNCEMENT_ADMIN_USER_ID && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-md shadow-xl overflow-hidden`}>
              <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="campaign" className="text-2xl" />
                    <h2 className="text-lg font-bold">Admin Announcements</h2>
                  </div>
                  <button onClick={() => setShowAnnouncementPanel(false)} className="p-1 hover:bg-white/20 rounded-lg">
                    <Icon name="close" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Preset Announcements */}
                <div>
                  <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-stone-600'} mb-2`}>Quick Presets</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => showPresetAnnouncement('congratulations')}
                      className={`p-3 ${darkMode ? 'bg-emerald-900/30 border-emerald-700' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'} border rounded-xl text-left hover:shadow-md transition-all`}
                    >
                      <span className="text-2xl">🎉</span>
                      <p className={`font-semibold ${darkMode ? 'text-emerald-400' : 'text-emerald-800'} text-sm mt-1`}>Congrats!</p>
                      <p className={`text-xs ${darkMode ? 'text-emerald-500' : 'text-emerald-600'}`}>Celebration</p>
                    </button>
                    <button
                      onClick={() => showPresetAnnouncement('post-final')}
                      className={`p-3 ${darkMode ? 'bg-purple-900/30 border-purple-700' : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'} border rounded-xl text-left hover:shadow-md transition-all`}
                    >
                      <span className="text-2xl">🎓</span>
                      <p className={`font-semibold ${darkMode ? 'text-purple-400' : 'text-purple-800'} text-sm mt-1`}>Post-Final!</p>
                      <p className={`text-xs ${darkMode ? 'text-purple-500' : 'text-purple-600'}`}>Finals done</p>
                    </button>
                    <button
                      onClick={() => showPresetAnnouncement('good-luck')}
                      className={`p-3 ${darkMode ? 'bg-green-900/30 border-green-700' : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'} border rounded-xl text-left hover:shadow-md transition-all`}
                    >
                      <span className="text-2xl">🍀</span>
                      <p className={`font-semibold ${darkMode ? 'text-green-400' : 'text-green-800'} text-sm mt-1`}>Good Luck!</p>
                      <p className={`text-xs ${darkMode ? 'text-green-500' : 'text-green-600'}`}>Before exam</p>
                    </button>
                  </div>
                </div>

                {/* Custom Announcement */}
                <div>
                  <h3 className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-stone-600'} mb-2`}>Custom Announcement</h3>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="w-24">
                        <CustomDropdown
                          name="customAnnouncementEmoji"
                          value={customAnnouncementEmoji}
                          onChange={setCustomAnnouncementEmoji}
                          options={[
                            { value: '🎉', label: '🎉' },
                            { value: '🎓', label: '🎓' },
                            { value: '📢', label: '📢' },
                            { value: '⚠️', label: '⚠️' },
                            { value: '💪', label: '💪' },
                            { value: '🌟', label: '🌟' },
                            { value: '📚', label: '📚' },
                            { value: '🔔', label: '🔔' }
                          ]}
                          theme={darkMode ? 'dark' : 'light'}
                          size="compact"
                        />
                      </div>
                      <select
                        disabled
                        value={customAnnouncementEmoji}
                        onChange={(e) => setCustomAnnouncementEmoji(e.target.value)}
                        className="hidden"
                      >
                        <option value="🎉">🎉</option>
                        <option value="🎓">🎓</option>
                        <option value="📢">📢</option>
                        <option value="⚠️">⚠️</option>
                        <option value="💪">💪</option>
                        <option value="🌟">🌟</option>
                        <option value="📚">📚</option>
                        <option value="🔔">🔔</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Title"
                        value={customAnnouncementTitle}
                        onChange={(e) => setCustomAnnouncementTitle(e.target.value)}
                        className={`flex-1 p-2 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'border-stone-200'} rounded-lg text-sm`}
                      />
                    </div>
                    <textarea
                      placeholder="Your announcement message..."
                      value={customAnnouncementMessage}
                      onChange={(e) => setCustomAnnouncementMessage(e.target.value)}
                      className={`w-full p-3 border ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'border-stone-200'} rounded-lg text-sm h-24 resize-none`}
                    />
                    <button
                      onClick={showCustomAnnouncement}
                      className={`w-full py-2 ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-stone-800 hover:bg-stone-900'} text-white rounded-xl font-semibold transition-colors`}
                    >
                      Show Announcement
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Announcement Modal */}
        {activeAnnouncement && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up`}>
              {/* Header */}
              <div className={`relative p-8 text-center overflow-hidden ${
                activeAnnouncement.type === 'congratulations' ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600' :
                activeAnnouncement.type === 'post-final' ? 'bg-gradient-to-br from-violet-400 via-purple-500 to-indigo-600' :
                activeAnnouncement.type === 'good-luck' ? 'bg-gradient-to-br from-green-400 via-emerald-500 to-cyan-600' :
                'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500'
              } text-white`}>
                {/* Floating particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-4 left-6 w-2 h-2 bg-white/40 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute top-8 right-8 w-3 h-3 bg-white/30 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                  <div className="absolute bottom-6 left-10 w-2 h-2 bg-white/35 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
                  <div className="absolute bottom-10 right-12 w-2 h-2 bg-white/40 rounded-full animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.3s' }} />
                </div>
                
                {/* Glow effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white/20 rounded-full blur-2xl" />
                
                {/* Main emoji with bounce */}
                <div className="relative">
                  <span className="text-6xl block mb-3 drop-shadow-lg animate-bounce" style={{ animationDuration: '2s' }}>
                    {activeAnnouncement.emoji}
                  </span>
                  <h2 className="text-xl font-bold drop-shadow">
                    {activeAnnouncement.title}
                  </h2>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 text-center">
                <p className={`${darkMode ? 'text-gray-300' : 'text-stone-600'} leading-relaxed whitespace-pre-line`}>
                  {activeAnnouncement.message}
                </p>
                
                {/* Action button */}
                <button
                  onClick={async () => {
                    if (activeAnnouncement.id && user?.idNumber) {
                      // Save dismissal to server (persists even if browser data cleared)
                      try {
                        await fetch(GAS_URL, {
                          method: 'POST',
                          body: JSON.stringify({
                            action: 'dismissAnnouncement',
                            announcementId: activeAnnouncement.id,
                            userId: user.idNumber
                          })
                        });
                      } catch (e) {
                        console.error('Failed to save dismissal:', e);
                      }
                    }
                    setActiveAnnouncement(null);
                  }}
                  className={`mt-6 w-full py-3.5 rounded-2xl font-semibold transition-all duration-200 active:scale-95 hover:shadow-lg ${
                    activeAnnouncement.type === 'congratulations' 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white' 
                      : activeAnnouncement.type === 'post-final'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white'
                      : activeAnnouncement.type === 'good-luck'
                      ? 'bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                  }`}
                >
                  Got it! 👍
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ongoing Exam Alert Modal */}
        {ongoingExamAlert && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up`}>
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                    <Icon name="notifications_active" className="text-2xl" />
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Exam Starting Now!</p>
                    <h2 className="text-xl font-bold">{ongoingExamAlert.courseCode}</h2>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-stone-50 rounded-xl p-3">
                  <p className="font-semibold text-stone-800">{ongoingExamAlert.courseName}</p>
                  <p className="text-sm text-stone-500">{ongoingExamAlert.examType}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-stone-50 rounded-lg p-2">
                    <p className="text-stone-400 text-xs">Time</p>
                    <p className="font-semibold text-stone-800">{ongoingExamAlert.startTime} - {ongoingExamAlert.endTime}</p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-2">
                    <p className="text-stone-400 text-xs">Room</p>
                    <p className="font-semibold text-stone-800">{ongoingExamAlert.room}</p>
                  </div>
                </div>
                {ongoingExamAlert.proctor && (
                  <div className="bg-stone-50 rounded-lg p-2 text-sm">
                    <p className="text-stone-400 text-xs">Proctor</p>
                    <p className="font-semibold text-stone-800">{ongoingExamAlert.proctor}</p>
                  </div>
                )}
                {ongoingExamAlert.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm">
                    <p className="text-amber-600 italic">"{ongoingExamAlert.notes}"</p>
                  </div>
                )}
                <button
                  onClick={dismissOngoingExamAlert}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="check" /> Got it, good luck!
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Completed Exam Celebration Modal */}
        {completedExamAlert && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up`}>
              <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500 p-8 text-white text-center relative overflow-hidden">
                {/* Confetti effect */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-4 left-8 text-4xl animate-bounce" style={{ animationDelay: '0s' }}>🎊</div>
                  <div className="absolute top-8 right-12 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>✨</div>
                  <div className="absolute bottom-12 left-12 text-3xl animate-bounce" style={{ animationDelay: '0.4s' }}>🌟</div>
                  <div className="absolute bottom-8 right-8 text-4xl animate-bounce" style={{ animationDelay: '0.6s' }}>🎉</div>
                </div>
                <span className="text-6xl block mb-4 animate-bounce">🎉</span>
                <h2 className="text-2xl font-bold mb-2">Exam Complete!</h2>
                <p className="text-white/80">You finished your exam!</p>
              </div>
              <div className="p-6 text-center space-y-4">
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="font-bold text-purple-800 text-lg">{completedExamAlert.courseCode}</p>
                  <p className="text-purple-600 text-sm">{completedExamAlert.courseName}</p>
                  <p className="text-purple-500 text-xs mt-1">{completedExamAlert.examType}</p>
                </div>
                <p className="text-stone-600 text-sm">
                  Great job getting through it! Take a moment to relax and celebrate. 💪
                </p>
                <button
                  onClick={dismissCompletedExamAlert}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  Thanks! 🙌
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <header className={`${darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-10`}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${darkMode ? 'bg-amber-500' : 'bg-stone-800'} rounded-xl flex items-center justify-center`}>
                <Icon name="school" className={darkMode ? 'text-stone-900' : 'text-white'} />
              </div>
              <div>
                <h1 className={`font-bold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>Classroom Virtual Environment</h1>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-stone-400'}`}></span>
                  <span className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center gap-2">
              {user && (
                <button
                  onClick={() => navigateTo('CALENDAR')}
                  className={`p-2 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}
                  title="Schedule"
                >
                  <Icon name="event" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                </button>
              )}
              {user && user.section && (
                <button
                  onClick={() => navigateTo('CLASS')}
                  className={`p-2 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}
                  title="My Class"
                >
                  <Icon name="groups" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                </button>
              )}
              {user && (
                <button
                  onClick={() => { setUserAnalytics(null); navigateTo('ANALYTICS'); }}
                  className={`p-2 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}
                  title="View Analytics"
                >
                  <Icon name="analytics" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                </button>
              )}
              {user && (
                <button
                  onClick={() => setShowNotificationSettings(true)}
                  className={`p-2 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}
                  title="Notification Settings"
                >
                  <Icon name="notifications" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                </button>
              )}
              {user ? (
                <button
                  onClick={() => setShowProfile(true)}
                  className={`flex items-center gap-2 px-4 py-2 ${darkMode ? 'bg-stone-700 hover:bg-stone-600' : 'bg-stone-100 hover:bg-stone-200'} rounded-xl transition-colors`}
                  title="View Profile"
                >
                  {user.profilePicture ? (
                    <DriveImage 
                      src={user.profilePicture} 
                      alt={user.name || 'User'} 
                      className="w-6 h-6 rounded-full"
                      fallbackIcon={<Icon name="person" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />}
                    />
                  ) : (
                    <Icon name="person" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                  )}
                  <span className={`text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>
                    {(user.name || user.fullName || user.firstName || 'User').split(' ')[0]}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className={`flex items-center gap-2 px-4 py-2 ${darkMode ? 'bg-stone-700 hover:bg-stone-600' : 'bg-stone-100 hover:bg-stone-200'} rounded-xl transition-colors`}
                >
                  <Icon name="login" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                  <span className={`text-sm font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Login</span>
                </button>
              )}
            </div>

            {/* Mobile Navigation */}
            <div className="flex sm:hidden items-center gap-2">
              {user ? (
                <button
                  onClick={() => setShowProfile(true)}
                  className={`w-9 h-9 rounded-full ${darkMode ? 'bg-stone-700 hover:bg-stone-600' : 'bg-stone-100 hover:bg-stone-200'} flex items-center justify-center overflow-hidden transition-colors`}
                  title="View Profile"
                >
                  {user.profilePicture ? (
                    <DriveImage 
                      src={user.profilePicture} 
                      alt={user.name} 
                      className="w-full h-full rounded-full"
                      fallbackIcon={<Icon name="person" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />}
                    />
                  ) : (
                    <Icon name="person" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className={`p-2 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}
                >
                  <Icon name="login" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                </button>
              )}
              <button
                onClick={() => setShowMobileMenu(true)}
                className={`p-2 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors`}
              >
                <Icon name="menu" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Menu Drawer */}
        {showMobileMenu && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileMenu(false)} />
            <div className={`absolute right-0 top-0 bottom-0 w-72 ${darkMode ? 'bg-stone-800' : 'bg-white'} shadow-xl animate-slide-left`}>
              <div className={`p-4 border-b ${darkMode ? 'border-stone-700' : 'border-stone-100'} flex items-center justify-between`}>
                <h2 className={`font-bold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>Menu</h2>
                <button onClick={() => setShowMobileMenu(false)} className={`p-2 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-lg`}>
                  <Icon name="close" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                </button>
              </div>
              
              {user && (
                <div className={`p-4 border-b ${darkMode ? 'border-stone-700' : 'border-stone-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${darkMode ? 'bg-stone-700' : 'bg-stone-200'} overflow-hidden`}>
                      {user.profilePicture ? (
                        <DriveImage 
                          src={user.profilePicture} 
                          alt={user.name} 
                          className="w-full h-full rounded-full"
                          fallbackIcon={<Icon name="person" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />}
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center ${darkMode ? 'bg-stone-600' : 'bg-stone-300'}`}>
                          <Icon name="person" className={`text-xl ${darkMode ? 'text-stone-400' : 'text-stone-500'}`} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>{user.name}</p>
                      <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>ID: {user.idNumber}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="p-2">
                {user && (
                  <button
                    onClick={() => { navigateTo('CALENDAR'); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                  >
                    <Icon name="event" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                    <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Schedule</span>
                  </button>
                )}
                
                {user && user.section && (
                  <button
                    onClick={() => { navigateTo('CLASS'); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                  >
                    <Icon name="groups" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                    <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>My Class</span>
                    <span className={`ml-auto text-xs ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>{user.section}</span>
                  </button>
                )}
                
                {user && (
                  <button
                    onClick={() => { setUserAnalytics(null); navigateTo('ANALYTICS'); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                  >
                    <Icon name="analytics" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                    <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Analytics</span>
                  </button>
                )}
                
                {user && (
                  <button
                    onClick={() => { setShowNotificationSettings(true); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                  >
                    <Icon name="notifications" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                    <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Notifications</span>
                  </button>
                )}
                
                {user && (
                  <button
                    onClick={() => { navigateTo('ALL_RESOURCES'); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                  >
                    <Icon name="folder_open" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                    <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>All Resources</span>
                  </button>
                )}

                {/* Coming Soon Items - only show when logged in */}
                {user && (
                  <div className={`mt-2 pt-2 border-t ${darkMode ? 'border-stone-700' : 'border-stone-100'}`}>
                    <p className={`px-3 py-1 text-xs ${darkMode ? 'text-stone-500' : 'text-stone-400'} font-medium`}>Coming Soon</p>
                    
                    <button
                      onClick={() => { navigateTo('FINANCE'); setShowMobileMenu(false); }}
                      className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                    >
                      <Icon name="payments" className="text-amber-500" />
                      <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Finance</span>
                      <span className={`ml-auto px-1.5 py-0.5 ${darkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'} text-[10px] font-bold rounded`}>SOON</span>
                    </button>
                    
                    <button
                      onClick={() => { navigateTo('ATTENDANCE'); setShowMobileMenu(false); }}
                      className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                    >
                      <Icon name="fact_check" className="text-cyan-500" />
                      <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Attendance</span>
                      <span className={`ml-auto px-1.5 py-0.5 ${darkMode ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-100 text-cyan-600'} text-[10px] font-bold rounded`}>SOON</span>
                    </button>
                    
                    <button
                    onClick={() => { navigateTo('SCHEDULE'); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                  >
                    <Icon name="calendar_month" className="text-violet-500" />
                    <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>Class Schedule</span>
                    <span className={`ml-auto px-1.5 py-0.5 ${darkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-100 text-violet-600'} text-[10px] font-bold rounded`}>SOON</span>
                  </button>
                  </div>
                )}
                
                {user && (
                  <button
                    onClick={() => { setShowProfile(true); setShowMobileMenu(false); }}
                    className={`w-full flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-xl transition-colors text-left`}
                  >
                    <Icon name="person" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
                    <span className={`font-medium ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>My Profile</span>
                  </button>
                )}
              </div>
              
              {!user && (
                <div className={`p-4 border-t ${darkMode ? 'border-stone-700' : 'border-stone-100'} mt-auto`}>
                  <button
                    onClick={() => { setShowLogin(true); setShowMobileMenu(false); }}
                    className={`w-full py-3 ${darkMode ? 'bg-amber-500 text-stone-900 hover:bg-amber-400' : 'bg-stone-800 text-white hover:bg-stone-900'} rounded-xl font-semibold transition-colors flex items-center justify-center gap-2`}
                  >
                    <Icon name="login" />
                    Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notification Settings Modal */}
        {showNotificationSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-md shadow-xl`}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Notification Settings</h2>
                  <button onClick={() => setShowNotificationSettings(false)} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full`}>
                    <Icon name="close" className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon name="info" className="text-blue-600" />
                      <h3 className="font-semibold text-blue-800">Push Notifications</h3>
                    </div>
                    <p className="text-sm text-blue-700 mb-3">
                      Get notified about upcoming exams and deadlines even when the app is closed.
                    </p>
                    <p className="text-xs text-blue-600 mb-3">
                      Current status: <strong>{notificationsEnabled ? '✓ Enabled' : notificationPermission === 'denied' ? '✗ Blocked' : '○ Not enabled'}</strong>
                    </p>
                    {notificationsEnabled ? (
                      <div className="space-y-2">
                        <p className="text-sm text-green-700">✓ Notifications are enabled!</p>
                        <button
                          onClick={async () => {
                            try {
                              console.log('🔕 Disabling notifications...');
                              // Remove FCM token from localStorage
                              localStorage.removeItem('cumlaude_fcm_token');
                              localStorage.removeItem('cumlaude_push_subscription');
                              
                              // Update state
                              setNotificationsEnabled(false);
                              
                              // Optional: Delete token from Firebase
                              const windowWithFirebase = window as any;
                              if (windowWithFirebase.firebase && windowWithFirebase.firebase.apps.length > 0) {
                                const messaging = windowWithFirebase.firebase.messaging();
                                await messaging.deleteToken();
                                console.log('✅ FCM token deleted');
                              }
                              
                              addToast('Notifications disabled successfully.', 'success');
                            } catch (e) {
                              console.error('Error disabling notifications:', e);
                              // Still disable locally even if deletion fails
                              localStorage.removeItem('cumlaude_fcm_token');
                              localStorage.removeItem('cumlaude_push_subscription');
                              setNotificationsEnabled(false);
                              addToast('Notifications disabled.', 'info');
                            }
                          }}
                          className="w-full py-2 px-4 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                          Disable Notifications
                        </button>
                      </div>
                    ) : notificationPermission === 'denied' ? (
                      <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-700 mb-2">Notifications are blocked in your browser settings.</p>
                        <p className="text-xs text-red-600">To enable: Go to browser settings → Site settings → Notifications</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (!user) {
                            addToast('Please login first to enable notifications.', 'error');
                            return;
                          }
                          registerPush();
                          // Close modal after a short delay
                          setTimeout(() => {
                            setShowNotificationSettings(false);
                          }, 1500);
                        }}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Icon name="notifications_active" />
                        Enable Notifications
                      </button>
                    )}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="warning" className="text-amber-600 text-sm" />
                      <p className="text-xs font-semibold text-amber-800">Note</p>
                    </div>
                    <p className="text-xs text-amber-700">
                      Notification delivery requires an active internet connection and backend configuration (VAPID keys).
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-stone-200">
                <button
                  onClick={() => setShowNotificationSettings(false)}
                  className="w-full py-2 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="max-w-5xl mx-auto p-4">
          {user && (
            <div className="bg-gradient-to-r from-stone-800 to-stone-700 rounded-2xl p-4 mb-6 text-white">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-sm opacity-80">Welcome back,</p>
                  <p className="text-xl font-bold">{user.name}</p>
                  <p className="text-xs opacity-60 mt-1">ID: {user.idNumber}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {user.idNumber === ANNOUNCEMENT_ADMIN_USER_ID && (
                    <button
                      onClick={() => setShowAnnouncementPanel(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 text-xs rounded-lg transition-colors"
                      title="Admin: Make Announcement"
                    >
                      <Icon name="campaign" className="text-sm" />
                      <span>Announce</span>
                    </button>
                  )}
                  {canUserBumpGlobalCache() && (
                    <button
                      onClick={() => setShowAdminCacheConfirm(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-200 text-xs rounded-lg transition-colors"
                      title="Admin: Clear all users cache"
                    >
                      <Icon name="delete_sweep" className="text-sm" />
                      <span>Clear Cache</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Features Section - Only show when logged in */}
          {user ? (
            <>
              {/* Feature Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Subjects & Resources - Main Feature */}
                <button
                  onClick={() => navigateTo('ALL_RESOURCES')}
                  className="col-span-2 sm:col-span-1 bg-gradient-to-br from-blue-500 to-blue-600 p-4 sm:p-5 rounded-2xl text-left hover:shadow-lg hover:scale-[1.02] transition-all group text-white relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-3 group-hover:bg-white/30 transition-colors">
                    <Icon name="menu_book" className="text-2xl" />
                  </div>
                  <h3 className="font-bold text-lg">Subjects</h3>
                  <p className="text-sm text-blue-100 mt-1">
                    {displaySubjects.length} subjects • {semesterResourcesCount} resources
                  </p>
                </button>

                {/* Exam Schedule */}
                <button
                  onClick={() => navigateTo('CALENDAR')}
                  className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} p-4 rounded-2xl border text-left hover:border-amber-300 hover:shadow-lg hover:scale-[1.02] transition-all group relative overflow-hidden`}
                >
                  {exams.filter(e => getExamStatus(e) === 'ongoing').length > 0 && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500 text-white text-[10px] rounded-full font-bold animate-pulse">
                      LIVE
                    </span>
                  )}
                  <div className={`w-10 h-10 ${darkMode ? 'bg-amber-900/30' : 'bg-amber-100'} rounded-xl flex items-center justify-center mb-3 text-amber-600 group-hover:scale-110 transition-transform`}>
                    <Icon name="event" />
                  </div>
                  <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Deadlines</h3>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-400'} mt-1`}>
                    {exams.filter(e => getExamStatus(e) === 'upcoming').length} upcoming
                  </p>
                </button>

                {/* Class Schedule */}
                <button
                  onClick={() => navigateTo('SCHEDULE')}
                  className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} p-4 rounded-2xl border text-left hover:border-purple-300 hover:shadow-lg hover:scale-[1.02] transition-all group`}
                >
                  <div className={`w-10 h-10 ${darkMode ? 'bg-purple-900/30' : 'bg-purple-100'} rounded-xl flex items-center justify-center mb-3 text-purple-600 group-hover:scale-110 transition-transform`}>
                    <Icon name="calendar_month" />
                  </div>
                  <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Class Schedule</h3>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-400'} mt-1`}>Weekly timetable</p>
                </button>

                {/* My Class - only show if user has section */}
                {user.section && (
                  <button
                    onClick={() => navigateTo('CLASS')}
                    className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} p-4 rounded-2xl border text-left hover:border-indigo-300 hover:shadow-lg hover:scale-[1.02] transition-all group`}
                  >
                    <div className={`w-10 h-10 ${darkMode ? 'bg-indigo-900/30' : 'bg-indigo-100'} rounded-xl flex items-center justify-center mb-3 text-indigo-600 group-hover:scale-110 transition-transform`}>
                      <Icon name="groups" />
                    </div>
                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>My Class</h3>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-400'} mt-1`}>Section {user.section}</p>
                  </button>
                )}

                {/* Finance - Coming Soon */}
                <button
                  onClick={() => navigateTo('FINANCE')}
                  className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} p-4 rounded-2xl border text-left hover:border-amber-300 hover:shadow-lg hover:scale-[1.02] transition-all group relative`}
                >
                  <span className={`absolute top-2 right-2 px-1.5 py-0.5 ${darkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'} text-[10px] font-bold rounded`}>SOON</span>
                  <div className={`w-10 h-10 ${darkMode ? 'bg-amber-900/30' : 'bg-amber-100'} rounded-xl flex items-center justify-center mb-3 text-amber-600 group-hover:scale-110 transition-transform`}>
                    <Icon name="payments" />
                  </div>
                  <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Finance</h3>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-400'} mt-1`}>Track payments</p>
                </button>

                {/* Attendance - Coming Soon */}
                <button
                  onClick={() => navigateTo('ATTENDANCE')}
                  className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} p-4 rounded-2xl border text-left hover:border-cyan-300 hover:shadow-lg hover:scale-[1.02] transition-all group relative`}
                >
                  <span className={`absolute top-2 right-2 px-1.5 py-0.5 ${darkMode ? 'bg-cyan-900/30 text-cyan-400' : 'bg-cyan-100 text-cyan-600'} text-[10px] font-bold rounded`}>SOON</span>
                  <div className={`w-10 h-10 ${darkMode ? 'bg-cyan-900/30' : 'bg-cyan-100'} rounded-xl flex items-center justify-center mb-3 text-cyan-600 group-hover:scale-110 transition-transform`}>
                    <Icon name="fact_check" />
                  </div>
                  <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>Attendance</h3>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-400'} mt-1`}>Track attendance</p>
                </button>
              </div>
            </>
          ) : (
            /* Login Prompt for non-logged in users */
            <div className={`${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-stone-100 border-stone-300'} border-2 border-dashed rounded-2xl p-8 text-center`}>
              <div className={`w-16 h-16 ${darkMode ? 'bg-gray-700' : 'bg-stone-200'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <Icon name="lock" className={`text-3xl ${darkMode ? 'text-gray-400' : 'text-stone-500'}`} />
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'} mb-2`}>Sign in to get started</h3>
              <p className={`${darkMode ? 'text-gray-400' : 'text-stone-500'} mb-4`}>Log in to access all features</p>
              <button
                onClick={() => setShowLogin(true)}
                className={`px-6 py-3 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-stone-800 hover:bg-stone-900'} text-white rounded-xl font-semibold transition-colors inline-flex items-center gap-2`}
              >
                <Icon name="login" />
                Sign In
              </button>
            </div>
          )}

          {/* Upcoming Exam Preview (show only if there are upcoming exams AND logged in) */}
          {user && exams.filter(e => getExamStatus(e) === 'upcoming' || getExamStatus(e) === 'ongoing').length > 0 && (
            <>
              <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'} mb-4 mt-6 flex items-center justify-between`}>
                <span className="flex items-center gap-2">
                  <Icon name="event" className="text-amber-500" /> Next Exams
                </span>
                <button onClick={() => setView('CALENDAR')} className={`text-sm ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-500 hover:text-stone-700'}`}>
                  View all →
                </button>
              </h2>
              <div className="space-y-2">
                {/* Show ongoing first, then up to 3 upcoming */}
                {[...exams.filter(e => getExamStatus(e) === 'ongoing'), ...exams.filter(e => getExamStatus(e) === 'upcoming').slice(0, 3)].slice(0, 4).map(exam => {
                  const isOngoing = getExamStatus(exam) === 'ongoing';
                  return (
                    <div 
                      key={exam.examId} 
                      className={`p-3 rounded-xl border ${isOngoing ? (darkMode ? 'bg-green-900/30 border-green-800' : 'bg-green-50 border-green-200') : (darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200')} flex items-center gap-3 cursor-pointer hover:shadow-md transition-all`}
                      onClick={() => setSelectedExam(exam)}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOngoing ? 'bg-green-500 text-white' : (darkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600')}`}>
                        <Icon name={isOngoing ? 'schedule' : 'event'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isOngoing ? (darkMode ? 'text-green-200' : 'text-green-800') : (darkMode ? 'text-white' : 'text-stone-800')}`}>{exam.courseCode}</span>
                          <span className={`text-xs ${isOngoing ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-gray-400' : 'text-stone-500')}`}>• {exam.examType}</span>
                        </div>
                        <p className={`text-xs ${isOngoing ? (darkMode ? 'text-green-400' : 'text-green-600') : (darkMode ? 'text-gray-400' : 'text-stone-400')}`}>
                          {isOngoing ? `Now until ${formatExamTime(exam.endTime)}` : `${formatExamDate(exam.date)} • ${formatExamTime(exam.startTime)}`} • Room: {exam.room}
                        </p>
                      </div>
                      {isOngoing ? (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium animate-pulse">NOW</span>
                      ) : (
                        <span className={`px-2 py-1 ${darkMode ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'} text-xs rounded-full font-medium whitespace-nowrap`}>
                          {formatCountdown(exam)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>

        {/* Admin Cache Clear Confirmation Modal */}
        <ConfirmModal
          isOpen={showAdminCacheConfirm}
          title="Clear All Users' Cache"
          message={"Are you sure you want to clear ALL cache for ALL users?\n\nThis will force everyone to reload fresh data on their next visit."}
          confirmText="Clear All Cache"
          confirmColor="red"
          onConfirm={async () => {
            setShowAdminCacheConfirm(false);
            await handleAdminClearAllCache();
          }}
          onClose={() => setShowAdminCacheConfirm(false)}
          darkMode={darkMode}
        />

        {/* Generic Alert Modal */}
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
          darkMode={darkMode}
        />

        {/* Exam Detail Modal */}
        <ExamDetailModal
          exam={selectedExam}
          onClose={() => setSelectedExam(null)}
          onEdit={(exam) => setExamToEdit(exam)}
          user={user}
          getExamStatus={getExamStatus}
          getTimeUntilExam={getTimeUntilExam}
          formatCountdown={formatCountdown}
          formatExamDate={formatExamDate}
          formatExamTime={formatExamTime}
          darkMode={darkMode}
          linkedResources={selectedExam ? getLinkedResourcesForObligation(selectedExam.examId) : []}
          onOpenResource={(resource) => openResource(resource)}
        />
      </div>
    );
  }

  // SUBJECT View
  if (view === 'SUBJECT' && activeSubject) {
    const subjectResources = resources[activeSubject] || [];
    const subjectSchedules = getSubjectSchedules(activeSubject);
    const subjectExams = getSubjectExams(activeSubject);
    const ongoingSubjectExams = subjectExams.filter(e => getExamStatus(e) === 'ongoing');
    const upcomingSubjectExams = subjectExams.filter(e => getExamStatus(e) === 'upcoming');
    const completedSubjectExams = subjectExams.filter(e => getExamStatus(e) === 'completed');
    const semestralSubjectSchedules = subjectSchedules.filter(schedule => schedule.type === 'semestral');
    const specialSubjectSchedules = subjectSchedules.filter(schedule => schedule.type !== 'semestral');
    const nextSubjectSchedule = subjectSchedules.find(schedule => schedule.status !== 'completed') || subjectSchedules[0] || null;
    
    // Get decks for this subject using the subject property
    const subjectDecks = decks.filter(d => d.subject === activeSubject);
    const getLinkedObligationsForDeck = (deck: Deck) => {
      const normalizedSubject = String(activeSubject || '').trim();
      const normalizedDeckName = String(deck.name || '').trim();

      return resourceLinks.filter(link =>
        link.resourceCategory === 'Flipcard' &&
        String(link.courseCode || '').trim() === normalizedSubject &&
        (
          String(link.resourceTitle || '').trim() === normalizedDeckName ||
          (!!deck.fileId && String(link.resourceUrl || '').trim().includes(deck.fileId))
        )
      );
    };
    
    // Organize resources by category
    const lessonPPTResources = subjectResources.filter(r => r.category === 'Lesson PPT' || r.category === 'PPT');
    const lessonPDFResources = subjectResources.filter(r => r.category === 'Lesson PDF' || r.category === 'PDF');
    const reviewerResources = subjectResources.filter(r => r.category === 'Reviewer');
    const videoResources = subjectResources.filter(r => r.category === 'Video');
    // Legacy categories
    const imageResources = subjectResources.filter(r => r.category === 'Image');
    const fileResources = subjectResources.filter(r => r.category === 'Files' || !['Lesson PPT', 'Lesson PDF', 'PPT', 'PDF', 'Reviewer', 'Video', 'Image'].includes(r.category));

    const handleDeleteResource = async (resource: Resource) => {
      if (!user) {
        addToast('Please login to delete resources', 'error');
        return;
      }
      
      if (!canUserDeleteResource(resource.submittedBy)) {
        addToast('Only the uploader, Mayor, Vice Mayor, Internal PIO, admin, or superadmin can delete this resource', 'error');
        return;
      }
      
      setResourceToDelete(resource);
    };

    const executeDeleteResource = async (resource: Resource) => {
      const toastId = addToast('Deleting resource...', 'loading');
      
      try {
        const response = await fetch(RESOURCE_GAS_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'deleteResource',
            resourceUrl: resource.url,
            userId: user.idNumber
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          updateToast(toastId, 'Resource deleted!', 'success');
          setTimeout(() => removeToast(toastId), 3000);
          syncData(); // Refresh resources
        } else {
          updateToast(toastId, result.error || 'Delete failed', 'error');
          setTimeout(() => removeToast(toastId), 5000);
        }
      } catch (err) {
        updateToast(toastId, 'Delete failed. Please try again.', 'error');
        setTimeout(() => removeToast(toastId), 5000);
      }
    };

    const renderResourceCard = (r: Resource, i: number, icon: string, iconBg: string, iconColor: string, borderColor: string) => (
      <div
        key={i}
        className={`bg-white p-4 rounded-xl border border-stone-200 hover:${borderColor} hover:shadow-md transition-all cursor-pointer`}
        onClick={() => openResource(r)}
      >
        <div className="flex gap-3">
          <div className={`w-12 h-12 flex-shrink-0 ${iconBg} rounded-xl flex items-center justify-center ${iconColor}`}>
            <Icon name={icon} className="text-xl" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-stone-800 text-base leading-snug">{r.name || r.title}</h4>
            {r.description && (
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">{r.description}</p>
            )}
            {r.submittedByName && (
              <p className="text-xs text-stone-400 mt-2">by {r.submittedByName}</p>
            )}
            {r.linkedObligations && r.linkedObligations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {r.linkedObligations.slice(0, 2).map(link => (
                  <span key={`${r.url}-${link.obligationId}`} className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[11px] font-medium">
                    {link.obligationType || 'Obligation'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-stone-100">
          <button
            onClick={(e) => { e.stopPropagation(); openResource(r); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Icon name="visibility" className="text-sm" />
            <span>View</span>
          </button>
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-stone-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="open_in_new" className="text-sm" />
            <span>Open</span>
          </a>
          {canUserDeleteResource(r.submittedBy) && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteResource(r); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Icon name="delete" className="text-sm" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>
    );

    return (
      <div className={`min-h-screen ${darkMode ? 'bg-stone-900' : 'bg-[#F5F5F4]'}`}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={handleLoginSuccess}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />

        {showAddExam && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Add Obligation</h2>
                  <button onClick={resetAddExamModal} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const success = await addExamToBackend({
                    courseCode: formData.get('courseCode') as string,
                    courseName: formData.get('courseName') as string || subjectInfo[formData.get('courseCode') as string]?.name || '',
                    examType: formData.get('examType') as string,
                    date: formData.get('date') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    room: formData.get('room') as string,
                    proctor: formData.get('proctor') as string,
                    notes: formData.get('notes') as string
                  });
                  
                  if (success) {
                    form.reset();
                    resetAddExamModal();
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course Code *</label>
                    <CourseDropdown
                      name="courseCode"
                      required
                      value={selectedExamCourseCode}
                      onChange={handleExamCourseChange}
                      options={displaySubjects.map(s => ({
                        code: s,
                        name: subjectInfo[s]?.name || ''
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course Name</label>
                    <input
                      type="text"
                      name="courseName"
                      value={selectedExamCourseName}
                      onChange={(e) => setSelectedExamCourseName(e.target.value)}
                      placeholder="e.g., Introduction to Language"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
                    <CustomDropdown
                      name="examType"
                      required
                      defaultValue="Activity"
                      options={EXAM_TYPE_OPTIONS}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                    <input type="date" name="date" required defaultValue={prefillExamDate || ''} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                      <input type="time" name="startTime" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                      <input type="time" name="endTime" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
                    <input type="text" name="room" required placeholder="e.g., Room 101" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
                    <input type="text" name="proctor" placeholder="e.g., Prof. Santos" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                    <textarea name="notes" rows={2} placeholder="Additional notes..." className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none" />
                  </div>
                  
                  <button type="submit" className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 flex items-center justify-center gap-2">
                    <Icon name="event" /> Add
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
        <UploadModal 
          isOpen={showUpload} 
          onClose={() => setShowUpload(false)} 
          subject={activeSubject || ''} 
          user={user} 
          onUploadComplete={syncData}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
          obligations={exams}
          formatExamDate={formatExamDate}
          formatExamTime={formatExamTime}
        />
        <AddExamModal
          isOpen={showAddExam}
          onClose={() => setShowAddExam(false)}
          subject={activeSubject || ''}
          subjectName={subjectInfo[activeSubject || '']?.name || ''}
          user={user}
          onAddExam={addExamToBackend}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />
        
        {/* Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button onClick={goBack} className="p-2 -ml-2 hover:bg-stone-100 rounded-full">
                <Icon name="arrow_back" className="text-stone-600" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-stone-800 text-lg leading-tight">{activeSubject}</h1>
                {subjectInfo[activeSubject || '']?.name && (
                  <p className="text-xs text-stone-500 truncate">{subjectInfo[activeSubject || ''].name}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {activeTab === 'Resources' && (
                <>
                  <RefreshIconButton
                    onClick={() => void handleResourcesRefresh()}
                    disabled={isResourcesRefreshing}
                    spinning={isResourcesRefreshing}
                    title="Refresh resources"
                  />
                  <button
                    onClick={() => user ? setShowUpload(true) : setShowLogin(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 transition-colors"
                  >
                    <Icon name="cloud_upload" className="text-sm" />
                    Upload
                  </button>
                  <button
                    onClick={() => user ? setShowRequestResource(true) : setShowLogin(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
                  >
                    <Icon name="help" className="text-sm" />
                    Request Resource
                  </button>
                </>
              )}
              {activeTab === 'Classroom' && (
                <RefreshIconButton
                  onClick={() => void handleClassroomRefresh()}
                  disabled={isResourcesRefreshing}
                  spinning={isResourcesRefreshing}
                  title="Refresh classroom"
                />
              )}
              {activeTab === 'Schedule' && (
                <RefreshIconButton
                  onClick={() => void handleSubjectScheduleRefresh()}
                  disabled={isSemesterSubjectsRefreshing}
                  spinning={isSemesterSubjectsRefreshing}
                  title="Refresh schedule"
                />
              )}
              {activeTab === 'Exams' && (
                <>
                  <RefreshIconButton
                    onClick={() => void handleObligationsRefresh()}
                    disabled={isObligationsLoading}
                    spinning={isObligationsLoading}
                    title="Refresh obligations"
                  />
                  <button
                    onClick={() => user ? setShowAddExam(true) : setShowLogin(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 transition-colors"
                  >
                    <Icon name="add" className="text-sm" />
                    Add
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <div className="max-w-5xl mx-auto px-4 flex gap-4">
            {['Classroom', 'Schedule', 'Resources', 'Exams'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab 
                    ? 'border-stone-800 text-stone-800' 
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab === 'Exams' ? 'Obligations' : tab}
              </button>
            ))}
          </div>
        </header>


        <main className="max-w-5xl mx-auto p-4">
          {activeTab === 'Classroom' ? (
            <div className="space-y-4">
              {subjectDecks.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  No classroom learning sets available for this subject
                </div>
              ) : (
                subjectDecks.map(deck => {
                  const deckProgress = getDeckProgressForDeck(deck);
                  const totalCards = deck.cards.length;
                  const answeredCount = deckProgress 
                    ? Object.values(deckProgress.cardStatuses).filter(s => s !== 'unanswered').length 
                    : 0;
                  const correctCount = deckProgress
                    ? Object.values(deckProgress.cardStatuses).filter(s => s === 'correct').length
                    : 0;
                  const progressPercent = totalCards > 0 ? Math.round((answeredCount / totalCards) * 100) : 0;
                  const isLoading = deckLoading === deck.name;
                  return (
                    <div
                      key={deck.name}
                      onClick={() => openDeck(deck)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
                          e.preventDefault();
                          openDeck(deck);
                        }
                      }}
                      role="button"
                      tabIndex={isLoading ? -1 : 0}
                      aria-disabled={isLoading}
                      className={`w-full bg-white p-4 rounded-xl border border-stone-200 text-left hover:border-stone-400 transition-all ${isLoading ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 ${isLoading ? 'animate-pulse' : ''}`}>
                          {isLoading ? (
                            <Icon name="hourglass_empty" className="animate-spin" />
                          ) : (
                            <Icon name="style" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-stone-800">{deck.name}</h3>
                           <p className="text-sm text-stone-400">{deck.cards.length} learning cards</p>
                          {deck.submittedByName && (
                            <p className="mt-1 text-xs text-stone-400">by {deck.submittedByName}</p>
                          )}
                          {/* Progress indicator */}
                          {answeredCount > 0 ? (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-stone-500">{answeredCount}/{totalCards} answered</span>
                                <span className="text-green-600 font-medium">{correctCount} correct</span>
                              </div>
                              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-amber-400 to-green-500 rounded-full transition-all"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                              <p className="text-xs text-stone-400 mt-1 italic">No activity yet. Open this learning set to begin.</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {canUserDeleteResource(deck.submittedBy) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setResourceToDelete({
                                  name: deck.name,
                                  title: deck.name,
                                  category: 'Flipcard',
                                  url: deck.url || '',
                                  submittedBy: deck.submittedBy,
                                  submittedByName: deck.submittedByName,
                                  timestamp: deck.timestamp,
                                  subject: deck.subject
                                });
                              }}
                              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Icon name="delete" className="text-sm" />
                              <span>Delete</span>
                            </button>
                          )}
                          <Icon name="chevron_right" className="text-stone-300 flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : activeTab === 'Schedule' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-xl border p-4`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Weekly Classes</p>
                  <p className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{semestralSubjectSchedules.length}</p>
                </div>
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-xl border p-4`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Special Sessions</p>
                  <p className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{specialSubjectSchedules.length}</p>
                </div>
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-xl border p-4`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Next Class</p>
                  <p className={`mt-2 text-sm font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>
                    {nextSubjectSchedule ? describeSchedule(nextSubjectSchedule) : 'No schedule yet'}
                  </p>
                </div>
              </div>

              {subjectSchedules.length === 0 ? (
                <div className={`rounded-2xl border p-8 text-center ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-stone-200 text-stone-500'}`}>
                  No class schedules are set for this course in the {activeSemester} semester.
                </div>
              ) : (
                <div className="space-y-3">
                  {subjectSchedules.map(schedule => (
                    <div
                      key={schedule.scheduleId}
                      className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-2xl border p-4`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              schedule.status === 'today'
                                ? 'bg-emerald-100 text-emerald-700'
                                : schedule.type === 'semestral'
                                  ? darkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700'
                                  : darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {schedule.status === 'today' ? 'Today' : schedule.type === 'semestral' ? 'Semestral' : schedule.type}
                            </span>
                            <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>
                              {describeSchedule(schedule)}
                            </span>
                          </div>
                          <p className={`mt-2 text-sm ${darkMode ? 'text-gray-300' : 'text-stone-600'}`}>
                            {schedule.courseName || activeSubject}
                          </p>
                        </div>
                        {schedule.classroom && (
                          <span className={`text-xs px-2.5 py-1 rounded-lg ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-stone-100 text-stone-700'}`}>
                            {schedule.classroom}
                          </span>
                        )}
                      </div>

                      <div className={`mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                        <div>{schedule.teacher ? `Teacher: ${schedule.teacher}` : 'Teacher not set'}</div>
                        <div>{schedule.details ? `Notes: ${schedule.details}` : 'No notes'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'Resources' ? (
            <>
              <ResourceRequestModal
                isOpen={showRequestResource}
                onClose={() => setShowRequestResource(false)}
                subject={activeSubject || ''}
                user={user}
                onRequestComplete={refreshResourceRequests}
                addToast={addToast}
                updateToast={updateToast}
                removeToast={removeToast}
                darkMode={darkMode}
              />
              <div className="space-y-6">
                {subjectDecks.length === 0 &&
                lessonPDFResources.length === 0 &&
                lessonPPTResources.length === 0 &&
                reviewerResources.length === 0 &&
                videoResources.length === 0 &&
                fileResources.length === 0 ? (
                  <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                      <Icon name="folder_off" className="text-3xl" />
                    </div>
                    <p className="font-medium text-stone-700">No resources yet for {activeSubject}.</p>
                    <p className="mt-1 text-sm text-stone-400">Upload a file or add a flipcard set to make it appear here.</p>
                  </div>
                ) : (
                  <>
                    {subjectDecks.length > 0 && (
                      <section className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-stone-800">Flipcards</h3>
                            <p className="text-sm text-stone-500">{subjectDecks.length} learning set{subjectDecks.length === 1 ? '' : 's'}</p>
                          </div>
                        </div>
                        <div className="grid gap-3">
                          {subjectDecks.map(deck => (
                            <div
                              key={`resource-deck-${deck.name}`}
                              onClick={() => openDeck(deck)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openDeck(deck);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className="w-full rounded-xl border border-stone-200 bg-white p-4 text-left transition-all hover:border-amber-300 hover:shadow-md"
                            >
                              {(() => {
                                const linkedDeckObligations = getLinkedObligationsForDeck(deck);
                                return (
                              <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                  <Icon name="style" className="text-xl" />
                                </div>
                                <div className="min-w-0 flex-1">
                                 <h4 className="mobile-safe-heading font-semibold text-stone-800">{deck.name}</h4>
                                 <p className="mt-1 text-sm text-stone-500">{deck.cards.length} learning cards</p>
                                  {deck.submittedByName && (
                                    <p className="mt-1 text-xs text-stone-400">by {deck.submittedByName}</p>
                                  )}
                                  {linkedDeckObligations.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {linkedDeckObligations.slice(0, 3).map(link => (
                                        <span
                                          key={`${deck.name}-${link.obligationId}`}
                                          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                                        >
                                          {link.obligationType || link.obligationLabel || 'Obligation'}
                                        </span>
                                      ))}
                                      {linkedDeckObligations.length > 3 && (
                                        <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                                          +{linkedDeckObligations.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                 </div>
                                 <div className="flex items-center gap-2">
                                   {canUserDeleteResource(deck.submittedBy) && (
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setResourceToDelete({
                                           name: deck.name,
                                           title: deck.name,
                                           category: 'Flipcard',
                                           url: deck.url || '',
                                           submittedBy: deck.submittedBy,
                                           submittedByName: deck.submittedByName,
                                           timestamp: deck.timestamp,
                                           subject: deck.subject
                                         });
                                       }}
                                       className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-stone-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                     >
                                       <Icon name="delete" className="text-sm" />
                                       <span>Delete</span>
                                     </button>
                                   )}
                                   <Icon name="chevron_right" className="text-stone-300" />
                                 </div>
                               </div>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {lessonPDFResources.length > 0 && (
                      <section className="space-y-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-800">PDFs</h3>
                          <p className="text-sm text-stone-500">{lessonPDFResources.length} file{lessonPDFResources.length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="grid gap-3">
                          {lessonPDFResources.map((resource, index) =>
                            renderResourceCard(resource, index, 'picture_as_pdf', 'bg-red-100', 'text-red-600', 'border-red-300')
                          )}
                        </div>
                      </section>
                    )}

                    {lessonPPTResources.length > 0 && (
                      <section className="space-y-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-800">Presentations</h3>
                          <p className="text-sm text-stone-500">{lessonPPTResources.length} file{lessonPPTResources.length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="grid gap-3">
                          {lessonPPTResources.map((resource, index) =>
                            renderResourceCard(resource, index, 'slideshow', 'bg-orange-100', 'text-orange-600', 'border-orange-300')
                          )}
                        </div>
                      </section>
                    )}

                    {reviewerResources.length > 0 && (
                      <section className="space-y-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-800">Reviewers</h3>
                          <p className="text-sm text-stone-500">{reviewerResources.length} item{reviewerResources.length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="grid gap-3">
                          {reviewerResources.map((resource, index) =>
                            renderResourceCard(resource, index, 'quiz', 'bg-violet-100', 'text-violet-600', 'border-violet-300')
                          )}
                        </div>
                      </section>
                    )}

                    {videoResources.length > 0 && (
                      <section className="space-y-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-800">Videos</h3>
                          <p className="text-sm text-stone-500">{videoResources.length} item{videoResources.length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="grid gap-3">
                          {videoResources.map((resource, index) =>
                            renderResourceCard(resource, index, 'play_circle', 'bg-pink-100', 'text-pink-600', 'border-pink-300')
                          )}
                        </div>
                      </section>
                    )}

                    {fileResources.length > 0 && (
                      <section className="space-y-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-800">Other Files</h3>
                          <p className="text-sm text-stone-500">{fileResources.length} item{fileResources.length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="grid gap-3">
                          {fileResources.map((resource, index) =>
                            renderResourceCard(resource, index, 'description', 'bg-stone-100', 'text-stone-600', 'border-stone-300')
                          )}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            </>
          ) : activeTab === 'Exams' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-xl border p-4`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Total</p>
                  <p className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{subjectExams.length}</p>
                </div>
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-xl border p-4`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Upcoming</p>
                  <p className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{upcomingSubjectExams.length}</p>
                </div>
                <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-xl border p-4`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Ongoing</p>
                  <p className={`mt-2 text-2xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{ongoingSubjectExams.length}</p>
                </div>
              </div>

              {isObligationsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-2xl border p-4`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <Skeleton className="h-5 w-32" darkMode={darkMode} />
                          <Skeleton className="h-4 w-48" darkMode={darkMode} />
                          <Skeleton className="h-4 w-64" darkMode={darkMode} />
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" darkMode={darkMode} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : subjectExams.length === 0 ? (
                <div className={`rounded-2xl border p-8 text-center ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-stone-200 text-stone-500'}`}>
                  <Icon name="event" className={`text-4xl mb-3 mx-auto ${darkMode ? 'text-gray-600' : 'text-stone-300'}`} />
                  <p className="font-medium">No obligations yet for {activeSubject}.</p>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Add an obligation and it will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...ongoingSubjectExams, ...upcomingSubjectExams, ...completedSubjectExams].map(exam => {
                    const status = getExamStatus(exam);
                    return (
                      <div
                        key={exam.examId}
                        className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all`}
                        onClick={() => setSelectedExam(exam)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                status === 'ongoing'
                                  ? 'bg-green-100 text-green-700'
                                  : status === 'upcoming'
                                    ? darkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'
                                    : darkMode ? 'bg-gray-700 text-gray-200' : 'bg-stone-100 text-stone-700'
                              }`}>
                                {status === 'ongoing' ? 'Ongoing' : status === 'upcoming' ? 'Upcoming' : 'Completed'}
                              </span>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                {exam.examType}
                              </span>
                            </div>
                            <p className={`mt-3 text-base font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>
                              {formatExamDate(exam.date)}
                            </p>
                            <p className={`mt-1 text-sm ${darkMode ? 'text-gray-300' : 'text-stone-600'}`}>
                              {formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)} • Room: {exam.room || 'TBA'}
                            </p>
                            {exam.proctor && (
                              <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                                Proctor: {exam.proctor}
                              </p>
                            )}
                            {exam.notes && (
                              <p className={`mt-2 text-sm italic ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                                "{exam.notes}"
                              </p>
                            )}
                          </div>
                          {user && user.idNumber === exam.createdBy && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExamToEdit(exam);
                                }}
                                className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-stone-100 text-stone-500'}`}
                                title="Edit obligation"
                              >
                                <Icon name="edit" className="text-sm" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExamToDelete(exam.examId);
                                }}
                                className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-red-900/30 text-red-300' : 'hover:bg-red-50 text-red-500'}`}
                                title="Delete obligation"
                              >
                                <Icon name="delete" className="text-sm" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </main>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!examToDelete}
          title="Delete Obligation"
          message="Are you sure you want to delete this obligation? This action cannot be undone."
          onConfirm={async () => {
            if (examToDelete) {
              await deleteExamFromBackend(examToDelete);
            }
          }}
          onClose={() => setExamToDelete(null)}
          darkMode={darkMode}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!examToDelete}
          title="Delete Obligation"
          message="Are you sure you want to delete this obligation? This action cannot be undone."
          onConfirm={async () => {
            if (examToDelete) {
              await deleteExamFromBackend(examToDelete);
            }
          }}
          onClose={() => setExamToDelete(null)}
          darkMode={darkMode}
        />

        {/* Edit Obligation Modal */}
        {examToEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Edit Obligation</h2>
                  <button onClick={() => setExamToEdit(null)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const success = await updateExamToBackend(examToEdit.examId, {
                    courseCode: formData.get('courseCode') as string,
                    courseName: subjectInfo[formData.get('courseCode') as string]?.name || '',
                    examType: formData.get('examType') as string,
                    date: formData.get('date') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    room: formData.get('room') as string,
                    proctor: formData.get('proctor') as string,
                    notes: formData.get('notes') as string
                  });
                  
                  if (success) {
                    setExamToEdit(null);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course *</label>
                    <CourseDropdown
                      name="courseCode"
                      required
                      defaultValue={examToEdit.courseCode}
                      options={displaySubjects.map(s => ({
                        code: s,
                        name: subjectInfo[s]?.name || ''
                      }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
                    <CustomDropdown
                      name="examType"
                      required
                      defaultValue={examToEdit.examType}
                      options={EXAM_TYPE_OPTIONS}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                    <input type="date" name="date" required defaultValue={examToEdit.date} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                      <input type="time" name="startTime" required defaultValue={examToEdit.startTime} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                      <input type="time" name="endTime" required defaultValue={examToEdit.endTime} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
                    <input type="text" name="room" required defaultValue={examToEdit.room} placeholder="e.g., Room 101" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
                    <input type="text" name="proctor" defaultValue={examToEdit.proctor || ''} placeholder="e.g., Prof. Santos" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                    <textarea name="notes" rows={2} defaultValue={examToEdit.notes || ''} placeholder="Additional notes..." className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none" />
                  </div>
                  
                  <button type="submit" className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 flex items-center justify-center gap-2">
                    <Icon name="save" /> Save Changes
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Resource Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!resourceToDelete}
          title="Delete Resource"
          message={`Are you sure you want to delete "${resourceToDelete?.name || resourceToDelete?.title}"? This action cannot be undone.`}
          confirmText="Delete"
          confirmColor="red"
          onConfirm={async () => {
            if (resourceToDelete) {
              await executeDeleteResource(resourceToDelete);
              setResourceToDelete(null);
            }
          }}
          onClose={() => setResourceToDelete(null)}
          darkMode={darkMode}
        />

        {/* Admin Cache Clear Confirmation Modal */}
        <ConfirmModal
          isOpen={showAdminCacheConfirm}
          title="Clear All Users' Cache"
          message={"Are you sure you want to clear ALL cache for ALL users?\n\nThis will force everyone to reload fresh data on their next visit."}
          confirmText="Clear All Cache"
          confirmColor="red"
          onConfirm={async () => {
            setShowAdminCacheConfirm(false);
            await handleAdminClearAllCache();
          }}
          onClose={() => setShowAdminCacheConfirm(false)}
          darkMode={darkMode}
        />


        {/* Exam Detail Modal */}
        <ExamDetailModal
          exam={selectedExam}
          onClose={() => setSelectedExam(null)}
          onEdit={(exam) => setExamToEdit(exam)}
          user={user}
          getExamStatus={getExamStatus}
          getTimeUntilExam={getTimeUntilExam}
          formatCountdown={formatCountdown}
          formatExamDate={formatExamDate}
          formatExamTime={formatExamTime}
          darkMode={darkMode}
          linkedResources={selectedExam ? getLinkedResourcesForObligation(selectedExam.examId) : []}
          onOpenResource={(resource) => openResource(resource)}
        />
      </div>
    );
  }

  // RESOURCE_VIEW
  if (view === 'RESOURCE_VIEW' && activeResource) {
    return (
      <>
        <ResourceViewer 
          resource={activeResource} 
          onClose={() => { 
            setActiveResource(null); 
            goBack();
          }} 
        />
      </>
    );
  }

  // DECK_OVERVIEW View
  if (view === 'DECK_OVERVIEW' && activeDeck) {
    const deckProgress = getDeckProgressForDeck(activeDeck);
    const answeredCount = deckProgress ? Object.values(deckProgress.cardStatuses).filter(s => s !== 'unanswered').length : 0;
    const correctCount = deckProgress ? Object.values(deckProgress.cardStatuses).filter(s => s === 'correct').length : 0;
    const incorrectCount = deckProgress ? Object.values(deckProgress.cardStatuses).filter(s => s === 'incorrect').length : 0;
    const progressPercent = activeDeck.cards.length > 0 ? Math.round((answeredCount / activeDeck.cards.length) * 100) : 0;
    const hasProgress = answeredCount > 0;

    return (
      <div className={`min-h-screen ${darkMode ? 'bg-stone-900' : 'bg-[#F5F5F4]'} flex flex-col`}>
        <header className={`${darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-10 px-4 py-3`}>
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={goBack} className={`p-2 -ml-2 ${darkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-100'} rounded-full`}>
                <Icon name="arrow_back" className={darkMode ? 'text-stone-300' : 'text-stone-600'} />
              </button>
              <div>
                <h1 className={`font-bold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>{activeDeck.name}</h1>
                <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>{activeDeck.cards.length} cards</p>
              </div>
            </div>
          </div>
        </header>

        {/* Progress Bar & Stats */}
        {hasProgress && (
          <div className="bg-white border-b border-stone-200 px-4 py-3">
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-stone-600">Your Progress</span>
                <span className="text-sm text-stone-500">{progressPercent}% complete</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-2">
                <div className="h-full flex">
                  <div 
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${(correctCount / activeDeck.cards.length) * 100}%` }}
                  />
                  <div 
                    className="bg-red-400 transition-all"
                    style={{ width: `${(incorrectCount / activeDeck.cards.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-emerald-600 flex items-center gap-1">
                  <Icon name="check_circle" className="text-sm" /> {correctCount} correct
                </span>
                <span className="text-red-500 flex items-center gap-1">
                  <Icon name="cancel" className="text-sm" /> {incorrectCount} missed
                </span>
                <span className="text-stone-400 flex items-center gap-1">
                  <Icon name="radio_button_unchecked" className="text-sm" /> {activeDeck.cards.length - answeredCount} remaining
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Play Options */}
        <div className="bg-white border-b border-stone-200 px-4 py-3">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-stone-100 rounded-xl flex-shrink-0">
                <button
                  onClick={() => !sessionActionBusy && setPlayMode('shuffle')}
                  disabled={sessionActionBusy}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                    playMode === 'shuffle' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
                  } ${sessionActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Icon name="shuffle" className="text-base" /> Shuffle
                </button>
                <button
                  onClick={() => !sessionActionBusy && setPlayMode('chronological')}
                  disabled={sessionActionBusy}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                    playMode === 'chronological' ? 'bg-white shadow text-stone-800' : 'text-stone-500'
                  } ${sessionActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Icon name="format_list_numbered" className="text-base" /> In Order
                </button>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 flex-1 flex-wrap">
                {hasProgress && (activeDeck.cards.length - answeredCount) > 0 && (
                  <button 
                    onClick={() => startSession('continue')}
                    disabled={sessionActionBusy || clearProgressBusy}
                    className={`flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 min-w-[120px] order-1 ${(sessionActionBusy || clearProgressBusy) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <Icon name="play_arrow" /> Continue ({activeDeck.cards.length - answeredCount} left)
                  </button>
                )}
                <button 
                  onClick={() => startSession('new', playMode)}
                  disabled={sessionActionBusy || clearProgressBusy}
                  className={`${hasProgress && (activeDeck.cards.length - answeredCount) > 0 ? 'flex-1 min-w-[100px] order-2' : 'flex-1'} bg-stone-800 hover:bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${(sessionActionBusy || clearProgressBusy) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Icon name={hasProgress ? 'restart_alt' : 'play_arrow'} /> {hasProgress ? 'Start Over' : 'Start'}
                </button>
                {hasProgress && incorrectCount > 0 && (
                  <button 
                    onClick={() => startSession('retry', playMode)}
                    disabled={sessionActionBusy || clearProgressBusy}
                    className={`px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold flex items-center gap-2 order-3 ${(sessionActionBusy || clearProgressBusy) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <Icon name="refresh" /> Retry Missed ({incorrectCount})
                  </button>
                )}
              </div>
            </div>
            {hasProgress && (
              <button
                onClick={() => !clearProgressBusy && setShowClearProgressConfirm(true)}
                disabled={sessionActionBusy || clearProgressBusy}
                className={`mt-2 text-xs text-stone-400 hover:text-red-500 flex items-center gap-1 ${(sessionActionBusy || clearProgressBusy) ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Icon name="delete" className="text-sm" /> Clear Progress
              </button>
            )}
          </div>
        </div>

        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeDeck.cards.map((card, i) => {
              const cardStatus = deckProgress?.cardStatuses[card.id];
              return (
                <div 
                  key={i} 
                  className={`bg-white rounded-xl p-4 border transition-all ${
                    cardStatus === 'correct' ? 'border-emerald-300 bg-emerald-50/50' :
                    cardStatus === 'incorrect' ? 'border-red-300 bg-red-50/50' :
                    'border-stone-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-stone-300">#{i + 1}</span>
                    {cardStatus === 'correct' && (
                      <span className="text-emerald-500 flex items-center gap-1 text-xs">
                        <Icon name="check_circle" className="text-sm" /> Got it
                      </span>
                    )}
                    {cardStatus === 'incorrect' && (
                      <span className="text-red-500 flex items-center gap-1 text-xs">
                        <Icon name="cancel" className="text-sm" /> Missed
                      </span>
                    )}
                  </div>
                  <p className="text-stone-800 font-medium mt-1">{card.q}</p>
                  <div className="h-px bg-stone-100 my-2"></div>
                  <p className="text-stone-500 text-sm">{card.a}</p>
                </div>
              );
            })}
          </div>
        </main>

        {/* Clear Progress Confirmation Modal */}
        <ConfirmModal
          isOpen={showClearProgressConfirm}
          title="Clear Progress"
          message="Are you sure you want to clear all progress for this deck? This will reset your correct/incorrect answers."
          confirmText="Clear Progress"
          confirmColor="red"
          onConfirm={async () => {
            if (activeDeck) {
              setClearProgressBusy(true);
              const cleared = await clearDeckProgress(activeDeck.name);
              if (cleared) {
                setScores({});
              } else {
                addToast('Failed to clear progress. Please try again while online.', 'error');
              }
              setClearProgressBusy(false);
            }
            setShowClearProgressConfirm(false);
          }}
          onClose={() => setShowClearProgressConfirm(false)}
          darkMode={darkMode}
        />
      </div>
    );
  }

  // PLAY View
  if (view === 'PLAY' && queue.length > 0) {
    const card = queue[currentIndex];
    const progress = Math.round(((currentIndex + 1) / queue.length) * 100);
    const correctSoFar = Object.values(scores).filter(s => s === 'correct').length;
    const incorrectSoFar = Object.values(scores).filter(s => s === 'incorrect').length;

    return (
      <div className={`h-[100dvh] ${darkMode ? 'bg-gray-900' : 'bg-[#E7E5E4]'} flex flex-col overflow-hidden`}>
        <header className={`flex-shrink-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-[#F5F5F4] border-stone-200/50'} px-4 py-3 border-b`}>
          <div className="flex justify-between items-center">
            <button onClick={goBack} className="p-2 -ml-2">
              <Icon name="close" className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
            </button>
            <div className="text-center flex-1">
              <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{activeDeck?.name}</p>
              <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>
                {playMode === 'shuffle' ? 'Shuffled' : 'In Order'} • Card {currentIndex + 1} of {queue.length}
              </p>
            </div>
            <div className="w-10" />
          </div>
          {/* Progress Bar */}
          <div className="mt-2">
            <div className={`h-2 ${darkMode ? 'bg-gray-700' : 'bg-stone-200'} rounded-full overflow-hidden`}>
              <div className="h-full flex transition-all">
                <div 
                  className="bg-emerald-500"
                  style={{ width: `${(correctSoFar / queue.length) * 100}%` }}
                />
                <div 
                  className="bg-red-400"
                  style={{ width: `${(incorrectSoFar / queue.length) * 100}%` }}
                />
                <div 
                  className={darkMode ? 'bg-gray-600' : 'bg-stone-400'}
                  style={{ width: `${((currentIndex - correctSoFar - incorrectSoFar) / queue.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <div className="flex gap-3">
                <span className="text-emerald-600 flex items-center gap-1">
                  <Icon name="check" className="text-xs" /> {correctSoFar}
                </span>
                <span className="text-red-500 flex items-center gap-1">
                  <Icon name="close" className="text-xs" /> {incorrectSoFar}
                </span>
              </div>
              <span className={darkMode ? 'text-gray-500' : 'text-stone-500'}>{progress}%</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 perspective-1000 min-h-0">
          <div 
            className="w-full max-w-sm h-full max-h-[60vh] md:max-h-[65vh] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`w-full h-full duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front */}
              <div className={`absolute inset-0 backface-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-3xl shadow-xl p-6 flex flex-col items-center justify-between`}>
                <div className={`w-full flex justify-between text-xs font-bold ${darkMode ? 'text-gray-500' : 'text-stone-300'} uppercase`}>
                  <span>Question</span>
                  <span>{currentIndex + 1}/{queue.length}</span>
                </div>
                <p className={`text-lg md:text-xl font-medium ${darkMode ? 'text-white' : 'text-stone-800'} text-center px-2 overflow-y-auto max-h-[70%]`}>{card.q}</p>
                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-300'} uppercase`}>Tap to flip</p>
              </div>
              {/* Back */}
              <div className={`absolute inset-0 backface-hidden rotate-y-180 ${darkMode ? 'bg-blue-900' : 'bg-stone-800'} rounded-3xl shadow-xl p-6 flex flex-col items-center justify-between text-white`}>
                <div className={`w-full flex justify-between text-xs font-bold ${darkMode ? 'text-blue-300' : 'text-stone-500'} uppercase`}>
                  <span>Answer</span>
                  <span>{currentIndex + 1}/{queue.length}</span>
                </div>
                <p className="text-lg md:text-xl font-medium text-center px-2 overflow-y-auto max-h-[70%]">{card.a}</p>
                <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-stone-500'} uppercase`}>Mark result</p>
              </div>
            </div>
          </div>
        </main>

        <footer className={`flex-shrink-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-[#F5F5F4] border-stone-200'} p-4 border-t`}>
          <div className="max-w-sm mx-auto">
            {!isFlipped ? (
              <div className="flex gap-3">
                <button 
                  onClick={() => currentIndex > 0 && setCurrentIndex(c => c - 1)}
                  disabled={currentIndex === 0 || sessionActionBusy}
                  className={`w-14 h-14 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-stone-200'} flex items-center justify-center disabled:opacity-30 ${sessionActionBusy ? 'cursor-not-allowed' : ''}`}
                >
                  <Icon name="arrow_back" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
                </button>
                <button 
                  onClick={() => setIsFlipped(true)}
                  disabled={sessionActionBusy}
                  className={`flex-1 h-14 ${darkMode ? 'bg-blue-600' : 'bg-stone-800'} text-white rounded-xl font-semibold ${sessionActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  Reveal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleScore('incorrect')}
                  disabled={sessionActionBusy}
                  className={`h-14 ${darkMode ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-red-50 text-red-600 border-red-200'} border rounded-xl font-semibold flex items-center justify-center gap-2 ${sessionActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Icon name="close" /> Missed
                </button>
                <button 
                  onClick={() => handleScore('correct')}
                  disabled={sessionActionBusy}
                  className={`h-14 ${darkMode ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-600 border-emerald-200'} border rounded-xl font-semibold flex items-center justify-center gap-2 ${sessionActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <Icon name="check" /> Got it
                </button>
              </div>
            )}
          </div>
        </footer>
      </div>
    );
  }

  // SUMMARY View
  if (view === 'SUMMARY') {
    const total = queue.length;
    const correct = queue.filter(c => scores[c.id] === 'correct').length;
    const incorrect = queue.filter(c => scores[c.id] === 'incorrect').length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Get full deck progress
    const fullProgress = getDeckProgressForDeck(activeDeck);
    const totalDeckCards = activeDeck?.cards.length || 0;
    const totalAnswered = fullProgress ? Object.values(fullProgress.cardStatuses).filter(s => s !== 'unanswered').length : 0;
    const totalCorrect = fullProgress ? Object.values(fullProgress.cardStatuses).filter(s => s === 'correct').length : 0;

    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-[#F5F5F4]'} p-4 flex items-center justify-center`}>
        <div className={`w-full max-w-sm ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-2xl p-6 shadow-sm border text-center`}>
          <div className="w-20 h-20 mx-auto mb-4 relative">
            <svg className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="35" stroke={darkMode ? '#374151' : '#E7E5E4'} strokeWidth="6" fill="none" />
              <circle cx="40" cy="40" r="35" stroke={percentage >= 70 ? '#10B981' : percentage >= 50 ? '#F59E0B' : '#EF4444'} strokeWidth="6" fill="none" 
                strokeDasharray="220" strokeDashoffset={220 - (220 * percentage / 100)} />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${darkMode ? 'text-white' : ''}`}>{percentage}%</span>
          </div>
          
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-stone-800'} mb-1`}>
            {percentage >= 80 ? 'Excellent!' : percentage >= 60 ? 'Good Job!' : percentage >= 40 ? 'Keep Practicing!' : 'Keep Going!'}
          </h2>
          <p className={`${darkMode ? 'text-gray-400' : 'text-stone-500'} text-sm mb-4`}>Session Complete</p>

          {/* Session Stats */}
          <div className={`flex justify-center gap-6 mb-4 p-4 ${darkMode ? 'bg-gray-700' : 'bg-stone-50'} rounded-xl`}>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{correct}</div>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Correct</div>
            </div>
            <div className={`w-px ${darkMode ? 'bg-gray-600' : 'bg-stone-200'}`}></div>
            <div>
              <div className="text-2xl font-bold text-red-500">{incorrect}</div>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-400'}`}>Missed</div>
            </div>
          </div>

          {/* Overall Deck Progress */}
          {fullProgress && totalDeckCards > total && (
            <div className={`mb-4 p-4 ${darkMode ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-xl text-left`}>
              <p className={`text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'} font-semibold mb-2`}>Overall Deck Progress</p>
              <div className={`h-2 ${darkMode ? 'bg-blue-900/50' : 'bg-blue-100'} rounded-full overflow-hidden mb-2`}>
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(totalAnswered / totalDeckCards) * 100}%` }}
                />
              </div>
              <p className={`text-xs ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                {totalAnswered} of {totalDeckCards} cards completed ({Math.round((totalAnswered / totalDeckCards) * 100)}%)
              </p>
              <p className={`text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'} mt-1`}>
                Accuracy: {totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0}%
              </p>
            </div>
          )}

          <div className="space-y-2">
            {incorrect > 0 && (
              <button disabled={sessionActionBusy} onClick={() => startSession('retry', playMode)} className={`w-full py-3 ${darkMode ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-red-50 text-red-600 border-red-200'} border rounded-xl font-semibold flex items-center justify-center gap-2 ${sessionActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <Icon name="refresh" /> Review Missed ({incorrect})
              </button>
            )}
            <button disabled={sessionActionBusy} onClick={() => startSession('new', playMode)} className={`w-full py-3 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-stone-800'} text-white rounded-xl font-semibold flex items-center justify-center gap-2 ${sessionActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <Icon name="replay" /> Play Again
            </button>
            <button disabled={sessionActionBusy} onClick={() => startSession('smart', playMode)} className={`w-full py-3 ${darkMode ? 'bg-gray-700 text-white' : 'bg-stone-100 text-stone-800'} rounded-xl font-semibold flex items-center justify-center gap-2 ${sessionActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <Icon name="psychology" /> Smart Review
            </button>
            <button onClick={goBack} className={`w-full py-3 ${darkMode ? 'text-gray-400' : 'text-stone-500'} text-sm`}>
              Back to Deck
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ANALYTICS View
  if (view === 'ANALYTICS') {
    const hasStudyProgress = startedStudyProgressRows.length > 0;

    return (
      <div className={`min-h-screen ${darkMode ? 'bg-stone-900' : 'bg-[#F5F5F4]'}`}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={handleLoginSuccess}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />
        
        {/* Header */}
        <header className={`${darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-10`}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={goBack} className={`p-2 -ml-2 ${darkMode ? 'text-stone-300 hover:bg-stone-700' : 'text-stone-600 hover:bg-stone-100'} rounded-lg`}>
              <Icon name="arrow_back" />
            </button>
            <div className="flex-1">
              <h1 className={`text-lg font-bold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>Study Progress</h1>
              <p className={`text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                {refreshingAnalytics ? 'Tracking your flipcard progress • syncing...' : 'Tracking your flipcard progress'}
              </p>
            </div>
            <RefreshIconButton
              onClick={handleAnalyticsRefresh}
              disabled={!user || refreshingAnalytics}
              spinning={refreshingAnalytics}
              darkMode={darkMode}
              title="Refresh progress"
            />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          {!user ? (
            <div className="text-center py-12">
              <Icon name="person" className="text-4xl text-stone-300 mb-2" />
              <p className="text-stone-500 mb-4">Sign in to view your study progress</p>
              <button 
                onClick={() => setShowLogin(true)}
                className="px-6 py-2 bg-stone-800 text-white rounded-xl font-semibold"
              >
                Sign In
              </button>
            </div>
          ) : loadingAnalytics ? (
            <div className="space-y-4 py-4">
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-2xl p-6 border`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-40" darkMode={darkMode} />
                    <Skeleton className="h-4 w-56 mt-3" darkMode={darkMode} />
                  </div>
                  <Skeleton className="w-20 h-20 rounded-full" darkMode={darkMode} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  <Skeleton className="h-16" darkMode={darkMode} />
                  <Skeleton className="h-16" darkMode={darkMode} />
                  <Skeleton className="h-16" darkMode={darkMode} />
                </div>
              </div>
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-2xl p-6 border`}>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" darkMode={darkMode} />
                    <Skeleton className="h-7 w-14 rounded-full" darkMode={darkMode} />
                  </div>
                  <div className="space-y-3 mt-5">
                    <Skeleton className="h-12 w-full rounded-xl" darkMode={darkMode} />
                    <Skeleton className="h-12 w-full rounded-xl" darkMode={darkMode} />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasStudyProgress ? (
            <div className="text-center py-16">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-stone-800' : 'bg-stone-100'}`}>
                <Icon name="analytics" className="text-4xl text-stone-400" />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>No Study Progress Yet</h3>
              <p className={`${darkMode ? 'text-stone-400' : 'text-stone-500'} mb-1`}>You have not answered any flipcards yet.</p>
              <p className={`${darkMode ? 'text-stone-500' : 'text-stone-400'} text-sm mb-6`}>Open a learning set and your progress will appear here.</p>
              <button 
                onClick={() => navigateTo('HOME')}
                className="px-6 py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-700 transition-colors inline-flex items-center gap-2"
              >
                <Icon name="play_arrow" />
                Start Studying
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`${darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'} rounded-2xl p-6 border`}>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                  <div className="relative w-40 h-40 mx-auto lg:mx-0 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="60" fill="none" stroke={darkMode ? '#44403c' : '#e7e5e4'} strokeWidth="18" />
                      <circle
                        cx="80"
                        cy="80"
                        r="60"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="18"
                        strokeDasharray={2 * Math.PI * 60}
                        strokeDashoffset={(2 * Math.PI * 60) - ((2 * Math.PI * 60) * studyProgressSummary.coveragePercent / 100)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-bold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>{studyProgressSummary.coveragePercent}%</span>
                      <span className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>Coverage</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h2 className={`text-xl font-bold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>Overall Flipcard Progress</h2>
                    <p className={`mt-1 text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                      {studyProgressSummary.answeredCards} of {studyProgressSummary.totalCards} cards answered across {studyProgressSummary.startedDecks} active deck{studyProgressSummary.startedDecks === 1 ? '' : 's'}.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <div className={`rounded-xl p-4 border ${darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div className="text-2xl font-bold text-emerald-600">{studyProgressSummary.correctCards}</div>
                        <div className={`text-xs ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>Mastered cards</div>
                      </div>
                      <div className={`rounded-xl p-4 border ${darkMode ? 'bg-rose-950/40 border-rose-900' : 'bg-rose-50 border-rose-100'}`}>
                        <div className="text-2xl font-bold text-rose-500">{studyProgressSummary.incorrectCards}</div>
                        <div className={`text-xs ${darkMode ? 'text-rose-300' : 'text-rose-700'}`}>Need review</div>
                      </div>
                      <div className={`rounded-xl p-4 border ${darkMode ? 'bg-sky-950/40 border-sky-900' : 'bg-sky-50 border-sky-100'}`}>
                        <div className="text-2xl font-bold text-sky-600">{studyProgressSummary.accuracyPercent}%</div>
                        <div className={`text-xs ${darkMode ? 'text-sky-300' : 'text-sky-700'}`}>Answered accuracy</div>
                      </div>
                      <div className={`rounded-xl p-4 border ${darkMode ? 'bg-amber-950/40 border-amber-900' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="text-2xl font-bold text-amber-600">{studyProgressSummary.completedDecks}</div>
                        <div className={`text-xs ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>Completed decks</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {studyProgressSummary.bySubject.length > 0 && (
                <div className={`${darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'} rounded-2xl p-6 border`}>
                  <h2 className={`font-bold mb-4 ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>Progress by Subject</h2>
                  <div className="space-y-4">
                    {studyProgressSummary.bySubject.map(subject => (
                      <div key={subject.subjectCode} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className={`font-medium ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>{subject.subjectName}</div>
                            <div className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                              {subject.startedDeckCount}/{subject.deckCount} decks started • {subject.correctCount} correct • {subject.incorrectCount} incorrect
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-semibold ${darkMode ? 'text-stone-200' : 'text-stone-700'}`}>{subject.coveragePercent}%</div>
                            <div className={`text-xs ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>coverage</div>
                          </div>
                        </div>
                        <div className={`h-3 rounded-full overflow-hidden ${darkMode ? 'bg-stone-700' : 'bg-stone-100'}`}>
                          <div className="h-full bg-gradient-to-r from-amber-400 via-sky-500 to-emerald-500 rounded-full" style={{ width: `${Math.max(subject.coveragePercent, 4)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`${darkMode ? 'bg-stone-800 border-stone-700' : 'bg-white border-stone-200'} rounded-2xl p-6 border`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className={`font-bold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>Deck Progress</h2>
                    <p className={`text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>
                      {studyProgressSummary.totalDecks - studyProgressSummary.startedDecks} deck{studyProgressSummary.totalDecks - studyProgressSummary.startedDecks === 1 ? '' : 's'} not started yet.
                    </p>
                  </div>
                  <div className={`text-sm ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>{studyProgressSummary.masteryPercent}% total mastery</div>
                </div>

                <div className="space-y-3">
                  {studyProgressRows.map(row => (
                    <div key={row.deck.name} className={`rounded-2xl border p-4 ${darkMode ? 'border-stone-700 bg-stone-900/50' : 'border-stone-200 bg-stone-50/80'}`}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className={`font-semibold truncate ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>{row.deck.name}</h3>
                              <p className={`text-xs ${darkMode ? 'text-stone-400' : 'text-stone-500'}`}>{row.subjectName}</p>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                              row.isCompleted
                                ? 'bg-emerald-100 text-emerald-700'
                                : row.hasProgress
                                  ? 'bg-amber-100 text-amber-700'
                                  : darkMode
                                    ? 'bg-stone-700 text-stone-300'
                                    : 'bg-stone-200 text-stone-600'
                            }`}>
                              {row.isCompleted ? 'Completed' : row.hasProgress ? 'In Progress' : 'Not Started'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                            <div>
                              <div className={`font-semibold ${darkMode ? 'text-stone-100' : 'text-stone-800'}`}>{row.answeredCount}/{row.totalCards}</div>
                              <div className={`text-xs ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>answered</div>
                            </div>
                            <div>
                              <div className="font-semibold text-emerald-600">{row.correctCount}</div>
                              <div className={`text-xs ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>correct</div>
                            </div>
                            <div>
                              <div className="font-semibold text-rose-500">{row.incorrectCount}</div>
                              <div className={`text-xs ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>incorrect</div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={darkMode ? 'text-stone-400' : 'text-stone-500'}>{row.progressPercent}% complete</span>
                              <span className={darkMode ? 'text-stone-400' : 'text-stone-500'}>{row.accuracyPercent}% accuracy</span>
                            </div>
                            <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-stone-700' : 'bg-stone-200'}`}>
                              <div className="h-full bg-gradient-to-r from-amber-400 via-sky-500 to-emerald-500 rounded-full" style={{ width: `${Math.max(row.progressPercent, row.hasProgress ? 4 : 0)}%` }} />
                            </div>
                          </div>

                          <div className={`mt-2 text-xs ${darkMode ? 'text-stone-500' : 'text-stone-400'}`}>
                            {row.lastUpdated > 0 ? `Updated ${new Date(row.lastUpdated).toLocaleString()}` : 'No saved progress yet'}
                          </div>
                        </div>

                        <div className="md:w-auto">
                          <button
                            onClick={() => openDeck(row.deck)}
                            className={`w-full md:w-auto px-4 py-2 rounded-xl font-medium transition-colors ${
                              darkMode ? 'bg-stone-700 hover:bg-stone-600 text-stone-100' : 'bg-stone-800 hover:bg-stone-700 text-white'
                            }`}
                          >
                            {row.hasProgress ? 'Continue Deck' : 'Open Deck'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // EXAMS View - All Exams Schedule
  // ALL_RESOURCES View
  if (view === 'ALL_RESOURCES') {
    type AggregatedResource = Resource & {
      subject: string;
      sourceType: 'resource' | 'deck';
      deckRef?: Deck;
    };

    // Get all resources flattened with subject info
    const allUploadedResources: AggregatedResource[] = Object.entries(resources).flatMap(([subject, items]) =>
      displaySubjectSet.has(subject)
        ? items.map(r => ({ ...r, subject, sourceType: 'resource' as const }))
        : []
    );
    const allDeckResources: AggregatedResource[] = decks
      .filter(deck => !!deck.subject && displaySubjectSet.has(deck.subject))
      .map(deck => ({
        id: `deck-${deck.name}`,
        name: deck.name,
        title: deck.name,
        description: `${deck.cards.length} learning cards`,
        category: 'Flipcard',
        url: '',
        subject: deck.subject || 'Uncategorized',
        sourceType: 'deck' as const,
        deckRef: deck
      }));
    const allResourcesList: AggregatedResource[] = [...allUploadedResources, ...allDeckResources];
    
    // Get unique resource categories (types)
    const resourceCategories = Array.from(new Set(allResourcesList.map(r => r.category))).sort();
    const obligationFilterOptions = exams
      .filter(exam => displaySubjectSet.has(exam.courseCode))
      .map(exam => ({
        value: exam.examId,
        label: `${exam.courseCode} • ${exam.examType} • ${formatExamDate(exam.date)}`
      }));
    
    // Filter resources (using state from top level)
    const filteredResources = allResourcesList.filter(r => {
      const matchesSearch = !resourceSearchQuery || 
        r.name.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
        r.subject.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
        (subjectInfo[r.subject]?.name || '').toLowerCase().includes(resourceSearchQuery.toLowerCase());
      const matchesSubject = !selectedSubjectFilter || r.subject === selectedSubjectFilter;
      const matchesCategory = !selectedCategoryFilter || r.category === selectedCategoryFilter;
      const matchesObligation = !selectedObligationFilter || !!r.linkedObligations?.some(link => link.obligationId === selectedObligationFilter);
      return matchesSearch && matchesSubject && matchesCategory && matchesObligation;
    });

    const getResourceIcon = (category: string) => {
        switch (category.toLowerCase()) {
          case 'flipcard':
            return 'style';
          case 'lesson ppt':
          case 'ppt':
            return 'slideshow';
        case 'lesson pdf':
        case 'pdf':
          return 'picture_as_pdf';
        case 'reviewer':
          return 'quiz';
        case 'video':
          return 'play_circle';
        case 'link':
          return 'link';
        default:
          return 'description';
      }
    };

    const getResourceColor = (category: string, isDark: boolean = false) => {
        switch (category.toLowerCase()) {
          case 'flipcard':
            return isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-100 text-amber-700';
          case 'lesson ppt':
          case 'ppt':
            return isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-600';
        case 'lesson pdf':
        case 'pdf':
          return isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600';
        case 'reviewer':
          return isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600';
        case 'video':
          return isDark ? 'bg-pink-900/30 text-pink-400' : 'bg-pink-100 text-pink-600';
        case 'link':
          return isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600';
        default:
          return isDark ? 'bg-stone-700 text-stone-300' : 'bg-stone-100 text-stone-600';
      }
    };
    
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-[#F5F5F4]'}`}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={handleLoginSuccess}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />
        
        {/* Header */}
        <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-10`}>
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={goBack} className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full`}>
                <Icon name="arrow_back" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className={`font-bold ${darkMode ? 'text-white' : 'text-stone-800'} text-lg`}>Subjects & Resources</h1>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                  {isSemesterSubjectsLoading
                    ? 'Loading courses...'
                    : isSemesterSubjectsRefreshing
                      ? `${displaySubjects.length} subjects • ${allResourcesList.length} resources • syncing...`
                      : `${displaySubjects.length} subjects • ${allResourcesList.length} resources`}
                </p>
              </div>
              <RefreshIconButton
                onClick={() => void handleAllResourcesRefresh()}
                disabled={isSemesterSubjectsLoading || isSemesterSubjectsRefreshing || isResourcesRefreshing}
                spinning={isSemesterSubjectsRefreshing || isResourcesRefreshing}
                darkMode={darkMode}
                title="Refresh subjects and resources"
              />
              {/* Semester Toggle */}
              <div className={`hidden sm:flex items-center ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} rounded-lg p-0.5`}>
                <button
                  onClick={() => handleSemesterSwitch('1st')}
                  disabled={isSemesterSubjectsLoading}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                    activeSemester === '1st'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : darkMode ? 'text-gray-300 hover:text-white' : 'text-stone-600 hover:text-stone-800'
                  } ${isSemesterSubjectsLoading ? 'opacity-60 cursor-wait' : ''}`}
                >
                  1st
                </button>
                <button
                  onClick={() => handleSemesterSwitch('2nd')}
                  disabled={isSemesterSubjectsLoading}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                    activeSemester === '2nd'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : darkMode ? 'text-gray-300 hover:text-white' : 'text-stone-600 hover:text-stone-800'
                  } ${isSemesterSubjectsLoading ? 'opacity-60 cursor-wait' : ''}`}
                >
                  2nd
                </button>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <div className={`flex gap-1 mt-3 ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} p-1 rounded-xl`}>
              <button
                onClick={() => setResourcePageTab('subjects')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  resourcePageTab === 'subjects' 
                    ? darkMode ? 'bg-gray-600 text-white shadow-sm' : 'bg-white text-stone-800 shadow-sm'
                    : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <Icon name="book_2" className="text-base" />
                Subjects
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  resourcePageTab === 'subjects' 
                    ? darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600'
                    : darkMode ? 'bg-gray-600 text-gray-300' : 'bg-stone-200 text-stone-600'
                }`}>
                  {displaySubjects.length}
                </span>
              </button>
              <button
                onClick={() => setResourcePageTab('resources')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  resourcePageTab === 'resources' 
                    ? darkMode ? 'bg-gray-600 text-white shadow-sm' : 'bg-white text-stone-800 shadow-sm'
                    : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <Icon name="folder_open" className="text-base" />
                Resources
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  resourcePageTab === 'resources' 
                    ? darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600'
                    : darkMode ? 'bg-gray-600 text-gray-300' : 'bg-stone-200 text-stone-600'
                }`}>
                  {allResourcesList.length}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4">
          {resourcePageTab === 'subjects' ? (
            /* SUBJECTS TAB */
            <>
              {/* Mobile Semester Toggle */}
              <div className="sm:hidden flex items-center justify-center gap-2 mb-4">
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>Semester:</span>
                <div className={`flex items-center ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} rounded-lg p-0.5`}>
                  <button
                    onClick={() => handleSemesterSwitch('1st')}
                    disabled={isSemesterSubjectsLoading}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      activeSemester === '1st'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : darkMode ? 'text-gray-300' : 'text-stone-600'
                    } ${isSemesterSubjectsLoading ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    1st Semester
                  </button>
                  <button
                    onClick={() => handleSemesterSwitch('2nd')}
                    disabled={isSemesterSubjectsLoading}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      activeSemester === '2nd'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : darkMode ? 'text-gray-300' : 'text-stone-600'
                    } ${isSemesterSubjectsLoading ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    2nd Semester
                  </button>
                </div>
              </div>

              {/* Subjects Grid */}
              {isSemesterSubjectsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} p-4 rounded-xl border animate-pulse`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-xl flex-shrink-0 ${darkMode ? 'bg-gray-700' : 'bg-stone-200'}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`h-5 w-24 rounded ${darkMode ? 'bg-gray-700' : 'bg-stone-200'}`} />
                          <div className={`h-4 w-40 rounded mt-2 ${darkMode ? 'bg-gray-700' : 'bg-stone-100'}`} />
                          <div className="flex items-center gap-2 mt-3">
                            <div className={`h-6 w-20 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-stone-100'}`} />
                            <div className={`h-6 w-24 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-stone-100'}`} />
                          </div>
                          <div className={`h-12 rounded-lg mt-3 ${darkMode ? 'bg-gray-700/80' : 'bg-stone-100'}`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : displaySubjects.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`w-20 h-20 ${darkMode ? 'bg-gray-700' : 'bg-stone-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Icon name="school" className="text-4xl text-stone-400" />
                  </div>
                  <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-2`}>No Subjects Found</h3>
                  <p className={darkMode ? 'text-gray-500' : 'text-stone-400'}>No subjects scheduled for {activeSemester} Semester</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displaySubjects.map(subject => {
                    const deckCount = decks.filter(d => d.subject === subject).length;
                    const resourceCount = (resources[subject] || []).length;
                    const info = subjectInfo[subject];
                    const courseName = info?.name || null;
                    const subjectSchedules = getSubjectSchedules(subject);
                    const semestralCount = subjectSchedules.filter(schedule => schedule.type === 'semestral').length;
                    const specialCount = subjectSchedules.filter(schedule => schedule.type !== 'semestral').length;
                    const nextSchedule = subjectSchedules.find(schedule => schedule.status !== 'completed') || subjectSchedules[0] || null;
                    
                    return (
                      <button
                        key={subject}
                        onClick={() => openSubject(subject)}
                        className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} p-4 rounded-xl border text-left hover:border-blue-300 hover:shadow-lg hover:scale-[1.02] transition-all group`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 text-white group-hover:scale-110 transition-transform">
                            <Icon name="book_2" className="text-xl" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-stone-800'} text-lg`}>{subject}</h3>
                            {courseName && (
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'} mt-0.5 line-clamp-2`}>{courseName}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-stone-100 text-stone-600'} rounded-lg text-xs`}>
                                <Icon name="style" className="text-sm" />
                                {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 ${darkMode ? 'bg-emerald-900/30 text-emerald-300' : 'bg-emerald-50 text-emerald-700'} rounded-lg text-xs`}>
                                <Icon name="schedule" className="text-sm" />
                                {subjectSchedules.length} {subjectSchedules.length === 1 ? 'schedule' : 'schedules'}
                              </span>
                              {resourceCount > 0 && (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'} rounded-lg text-xs`}>
                                  <Icon name="folder" className="text-sm" />
                                  {resourceCount}
                                </span>
                              )}
                            </div>
                            {nextSchedule && (
                              <div className={`mt-3 rounded-lg px-3 py-2 ${darkMode ? 'bg-gray-700/70' : 'bg-stone-50'} text-xs`}>
                                <p className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-stone-700'}`}>
                                  Next: {describeSchedule(nextSchedule)}
                                </p>
                                <p className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                                  {semestralCount > 0 ? `${semestralCount} weekly` : 'No weekly classes'}{specialCount > 0 ? ` • ${specialCount} special` : ''}
                                </p>
                              </div>
                            )}
                          </div>
                          <Icon name="chevron_right" className={`${darkMode ? 'text-gray-500 group-hover:text-blue-400' : 'text-stone-400 group-hover:text-blue-500'} transition-colors`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* RESOURCES TAB */
            <>
              {/* Search and Filters */}
              <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} rounded-xl border p-3 sm:p-4 mb-4 space-y-3`}>
                {/* Search Bar */}
                <div className="relative">
                  <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search resources..."
                    value={resourceSearchQuery}
                    onChange={(e) => setResourceSearchQuery(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 sm:py-3 ${darkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-stone-200 bg-white text-stone-800'} border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                  />
                  {resourceSearchQuery && (
                    <button
                      onClick={() => setResourceSearchQuery('')}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-stone-100'} rounded-full`}
                    >
                      <Icon name="close" className="text-stone-400 text-sm" />
                    </button>
                  )}
                </div>
                
                {/* Filter Dropdowns - Stack on mobile */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <CustomDropdown
                    name="selectedSubjectFilter"
                    value={selectedSubjectFilter}
                    onChange={setSelectedSubjectFilter}
                    options={[
                      { value: '', label: 'All Subjects' },
                      ...displaySubjects.map(s => ({ value: s, label: s }))
                    ]}
                    theme={darkMode ? 'dark' : 'light'}
                    size="compact"
                  />
                  
                  <CustomDropdown
                    name="selectedCategoryFilter"
                    value={selectedCategoryFilter}
                    onChange={setSelectedCategoryFilter}
                    options={[
                      { value: '', label: 'All Types' },
                      ...resourceCategories.map(cat => ({ value: cat, label: cat }))
                    ]}
                    theme={darkMode ? 'dark' : 'light'}
                    size="compact"
                  />

                  <CustomDropdown
                    name="selectedObligationFilter"
                    value={selectedObligationFilter}
                    onChange={setSelectedObligationFilter}
                    options={[
                      { value: '', label: 'All Obligations' },
                      ...obligationFilterOptions
                    ]}
                    theme={darkMode ? 'dark' : 'light'}
                    size="compact"
                  />
                </div>
                
                {/* Active Filters */}
                {(selectedSubjectFilter || selectedCategoryFilter || selectedObligationFilter || resourceSearchQuery) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {resourceSearchQuery && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 ${darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'} rounded-full text-xs`}>
                        "{resourceSearchQuery}"
                        <button onClick={() => setResourceSearchQuery('')}><Icon name="close" className="text-xs" /></button>
                      </span>
                    )}
                    {selectedSubjectFilter && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 ${darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'} rounded-full text-xs`}>
                        {selectedSubjectFilter}
                        <button onClick={() => setSelectedSubjectFilter('')}><Icon name="close" className="text-xs" /></button>
                      </span>
                    )}
                    {selectedCategoryFilter && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 ${darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'} rounded-full text-xs`}>
                        {selectedCategoryFilter}
                        <button onClick={() => setSelectedCategoryFilter('')}><Icon name="close" className="text-xs" /></button>
                      </span>
                    )}
                    {selectedObligationFilter && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 ${darkMode ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-100 text-amber-700'} rounded-full text-xs`}>
                        {obligationFilterOptions.find(option => option.value === selectedObligationFilter)?.label || selectedObligationFilter}
                        <button onClick={() => setSelectedObligationFilter('')}><Icon name="close" className="text-xs" /></button>
                      </span>
                    )}
                    <button
                      onClick={() => { setResourceSearchQuery(''); setSelectedSubjectFilter(''); setSelectedCategoryFilter(''); setSelectedObligationFilter(''); }}
                      className={`text-xs ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-stone-500 hover:text-stone-700'} underline`}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Results Count */}
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'} mb-3`}>
                {filteredResources.length} of {allResourcesList.length} resources
              </p>

              {/* Resources Grid */}
              {filteredResources.length === 0 ? (
                <div className="text-center py-12">
                  <Icon name="search_off" className={`text-5xl ${darkMode ? 'text-gray-600' : 'text-stone-300'} mb-4`} />
                  <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-2`}>No Resources Found</h3>
                  <p className={darkMode ? 'text-gray-500' : 'text-stone-400'}>{allResourcesList.length === 0 ? 'No resources added yet' : 'Try different filters'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredResources.map((resource, idx) => (
                    <button
                      key={`${resource.subject}-${resource.name}-${idx}`}
                      onClick={() => {
                        if (resource.sourceType === 'deck' && resource.deckRef) {
                          void openDeck(resource.deckRef);
                          return;
                        }
                        setActiveSubject(resource.subject);
                        setActiveResource(resource);
                        setPreviousView('ALL_RESOURCES');
                        navigateTo('RESOURCE_VIEW');
                      }}
                      className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} p-3 sm:p-4 rounded-xl border text-left hover:border-blue-300 hover:shadow-md transition-all group`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 ${getResourceColor(resource.category, darkMode)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <Icon name={getResourceIcon(resource.category)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`mobile-safe-heading font-semibold ${darkMode ? 'text-white group-hover:text-blue-400' : 'text-stone-800 group-hover:text-blue-600'} transition-colors text-sm sm:text-base`}>
                            {resource.name}
                          </h3>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'} mt-0.5 truncate`}>
                            {resource.subject}
                          </p>
                          <span className={`inline-block mt-1.5 px-2 py-0.5 ${getResourceColor(resource.category, darkMode)} rounded-full text-xs font-medium`}>
                            {resource.category}
                          </span>
                          {resource.linkedObligations && resource.linkedObligations.length > 0 && (
                            <span className={`inline-block mt-1.5 ml-2 px-2 py-0.5 ${darkMode ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-100 text-amber-700'} rounded-full text-xs font-medium`}>
                              {resource.linkedObligations.length === 1 ? (resource.linkedObligations[0].obligationType || 'Linked') : `${resource.linkedObligations.length} linked`}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  // CLASS View
  if (view === 'CLASS') {
    if (!user) {
      return null;
    }
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <ClassPage
          user={user}
          onBack={goBack}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />
      </>
    );
  }

  // FINANCE View
  if (view === 'FINANCE') {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <FinancePage onBack={goBack} darkMode={darkMode} />
      </>
    );
  }

  // ATTENDANCE View
  if (view === 'ATTENDANCE') {
      return (
        <>
          <ToastContainer toasts={toasts} removeToast={removeToast} />
          <AttendanceFeaturePage
            onBack={goBack}
            darkMode={darkMode}
            user={user}
            addToast={addToast}
            removeToast={removeToast}
          />
        </>
      );
    }

  // SCHEDULE View
  if (view === 'SCHEDULE') {
    return (
      <>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={handleLoginSuccess}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />
        <SchedulePage 
          onBack={goBack}
          user={user}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          semesterConfig={semesterConfig}
          setSemesterConfig={setSemesterConfig}
          academicYear={academicYear}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
      </>
    );
  }

  if (view === 'CALENDAR') {
    const monthStart = new Date(calendarMonth);
    monthStart.setDate(1);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const startDay = monthStart.getDay();
    const todayKey = toDateKey(new Date());
    const selectedKey = calendarSelectedDate ? toDateKey(calendarSelectedDate) : null;

    const eventsByDay: Record<string, Exam[]> = {};
    exams.forEach((exam) => {
      const key = toDateKey(exam.date);
      if (!eventsByDay[key]) eventsByDay[key] = [];
      eventsByDay[key].push(exam);
    });

    const gridDays = Array.from({ length: 42 }, (_, idx) => {
      const date = new Date(year, month, idx - startDay + 1);
      return { date, inMonth: date.getMonth() === month };
    });

    const selectedEvents = selectedKey ? (eventsByDay[selectedKey] || []) : [];
    const monthEvents = exams
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const changeMonth = (delta: number) => {
      const next = new Date(year, month + delta, 1);
      setCalendarMonth(next);
      setCalendarSelectedDate(next);
    };

    const formatMonthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const selectedLabel = selectedKey
      ? new Date(selectedKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : 'All events this month';

    const detailEvents = calendarDetailDate ? (eventsByDay[toDateKey(calendarDetailDate)] || []) : [];
    const detailLabel = calendarDetailDate
      ? calendarDetailDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : '';

    const handleDaySelect = (date: Date) => {
      setCalendarSelectedDate(date);
      setCalendarDetailDate(date);
    };

    return (
      <div className={`min-h-screen ${darkMode ? 'bg-stone-900' : 'bg-[#F5F5F4]'}`}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={handleLoginSuccess}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />

        <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-10`}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={goBack} className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full`}>
              <Icon name="arrow_back" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className={`font-bold ${darkMode ? 'text-white' : 'text-stone-800'} text-lg`}>Obligations</h1>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{exams.length} total obligations</p>
            </div>
            <RefreshIconButton
              onClick={() => void handleObligationsRefresh()}
              disabled={isObligationsLoading}
              spinning={isObligationsLoading}
              darkMode={darkMode}
              title="Refresh deadlines"
            />
            <button
              onClick={() => navigateTo('EXAMS')}
              className={`flex items-center gap-2 px-4 py-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:border-gray-500' : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400'} border rounded-xl text-sm font-medium transition-colors`}
            >
              <Icon name="view_list" className="text-sm" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => {
                setPrefillExamDate(null);
                user ? setShowAddExam(true) : setShowLogin(true);
              }}
              className={`flex items-center gap-2 px-4 py-2 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-stone-800 hover:bg-stone-900'} text-white rounded-xl text-sm font-medium transition-colors`}
            >
              <Icon name="add" className="text-sm" />
              Add
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4 space-y-4">
          {/* Month Navigation with controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors"
                aria-label="Previous month"
              >
                <Icon name="chevron_left" className="text-stone-600" />
              </button>
              <div className="min-w-[7.5rem] px-3 py-2 text-center text-sm font-semibold text-stone-700 bg-stone-100 rounded-xl sm:min-w-[10rem] sm:px-4">
                {formatMonthLabel}
              </div>
              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors"
                aria-label="Next month"
              >
                <Icon name="chevron_right" className="text-stone-600" />
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => { const today = new Date(); today.setDate(1); setCalendarMonth(today); setCalendarSelectedDate(new Date()); }}
                className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium hover:border-stone-400"
                title="Today"
              >
                Today
              </button>
              <button
                onClick={() => setShowDateJump(true)}
                className="px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium hover:border-stone-400 flex items-center gap-1"
                title="Jump to date"
              >
                <Icon name="calendar_today" className="text-sm" />
                Jump
              </button>
            </div>
            <div className="sm:hidden flex items-center gap-1">
              <button
                onClick={() => { const today = new Date(); today.setDate(1); setCalendarMonth(today); setCalendarSelectedDate(new Date()); }}
                className="p-1.5 bg-white border border-stone-200 rounded-lg hover:border-stone-400"
                title="Today"
              >
                <Icon name="today" className="text-base" />
              </button>
              <button
                onClick={() => setShowDateJump(true)}
                className="p-1.5 bg-white border border-stone-200 rounded-lg hover:border-stone-400"
                title="Jump to date"
              >
                <Icon name="calendar_month" className="text-base" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-sm overflow-hidden">
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-stone-500 sm:gap-2 sm:text-xs">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="uppercase tracking-wide">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {gridDays.map(({ date, inMonth }) => {
                const key = toDateKey(date);
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;
                const dayEvents = eventsByDay[key] || [];
                const colorsForDots = Array.from(new Set(dayEvents.map(e => getExamTypeColor(e.examType).dot)));
                return (
                  <button
                    key={key + inMonth}
                    onClick={() => handleDaySelect(date)}
                    onDoubleClick={() => handleDaySelect(date)}
                    className={`relative p-1.5 sm:p-3 rounded-lg sm:rounded-xl text-left border transition-all min-h-[48px] sm:min-h-[72px] focus:outline-none focus:ring-2 focus:ring-stone-400 ${
                      inMonth ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-100 text-stone-300'
                    } ${isToday ? 'ring-2 ring-emerald-400 bg-emerald-50' : ''} ${isSelected ? 'border-stone-800 shadow-sm' : ''}`}
                  >
                    <div className={`text-xs sm:text-sm font-semibold ${isToday ? 'text-emerald-700' : inMonth ? 'text-stone-800' : 'text-stone-400'}`}>
                      {date.getDate()}
                    </div>
                    <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-1 sm:mt-2">
                      {colorsForDots.slice(0, 3).map((dot, idx) => (
                        <span key={idx} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dot}`} />
                      ))}
                      {colorsForDots.length > 3 && (
                        <span className="text-[9px] sm:text-[10px] text-stone-400">+{colorsForDots.length - 3}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-1 sm:gap-2 text-[10px] sm:text-xs text-stone-500">
              {['Activity','Special Event','Meeting','Workshop','Midterm Exam','Final Exam','Quiz','LE Deadline','Reporting','Performance','Presentation','Submission'].map(label => {
                const colors = getExamTypeColor(label);
                return (
                  <span key={label} className={`px-2 py-1 rounded-full border ${colors.bg} ${colors.text} border-stone-200 flex items-center gap-1`}>
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-stone-400">Scheduled</p>
                <h3 className="mobile-safe-heading font-bold text-stone-800 text-sm sm:text-base">{selectedLabel}</h3>
              </div>
              <span className="text-xs sm:text-sm text-stone-500 flex-shrink-0">{selectedEvents.length || monthEvents.length} items</span>
            </div>

            {(selectedEvents.length === 0 && monthEvents.length === 0) && (
              <div className="text-center py-8 sm:py-12 text-stone-500">
                <Icon name="event" className="text-3xl sm:text-4xl text-stone-300 mb-2" />
                <p className="text-sm">No scheduled items for this period.</p>
              </div>
            )}

            {(() => {
              const sortedEvents = (selectedEvents.length > 0 ? selectedEvents : monthEvents).sort((a, b) => {
                const statusA = getExamStatus(a);
                const statusB = getExamStatus(b);
                
                // Status priority: upcoming/ongoing first, completed last
                const statusOrder: Record<string, number> = { 'upcoming': 0, 'ongoing': 0, 'completed': 1 };
                const statusPriorityA = statusOrder[statusA] ?? 0;
                const statusPriorityB = statusOrder[statusB] ?? 0;
                
                if (statusPriorityA !== statusPriorityB) {
                  return statusPriorityA - statusPriorityB;
                }
                
                // Within same status, sort by time (nearest first)
                const getStartTime = (exam: Exam) => {
                  const dateStr = String(exam.date);
                  let examDate: Date;
                  if (dateStr.includes('-')) {
                    const [year, month, day] = dateStr.split('-').map(Number);
                    examDate = new Date(year, month - 1, day);
                  } else {
                    examDate = new Date(dateStr);
                  }
                  const { hour, min } = parseTimeString(exam.startTime);
                  examDate.setHours(hour, min, 0, 0);
                  return examDate.getTime();
                };
                
                return getStartTime(a) - getStartTime(b);
              });
              
              // Find index where completed exams start
              const completedStartIndex = sortedEvents.findIndex(exam => getExamStatus(exam) === 'completed');
              
              return (
                <>
                  {sortedEvents.map((exam, index) => {
                    // Show divider before completed items
                    const showDivider = completedStartIndex !== -1 && index === completedStartIndex;
                    
                    const colors = getExamTypeColor(exam.examType);
                    const status = getExamStatus(exam);
                    return (
                      <div key={exam.examId}>
                        {showDivider && (
                          <div className="my-4 flex items-center gap-3">
                            <div className="flex-1 h-px bg-stone-200"></div>
                            <span className="text-xs font-semibold text-stone-400">COMPLETED</span>
                            <div className="flex-1 h-px bg-stone-200"></div>
                          </div>
                        )}
                        <div
                          className="p-2 sm:p-3 mb-2 last:mb-0 rounded-xl border border-stone-200 bg-white hover:shadow-sm transition-all cursor-pointer"
                          onClick={() => setSelectedExam(exam)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text}`}>
                                <Icon name="event" className="text-lg sm:text-xl" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-stone-800 text-sm sm:text-base">{exam.courseCode}</span>
                                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${colors.bg} ${colors.text}`}>
                                    {exam.examType}
                                  </span>
                                </div>
                                {exam.courseName && <p className="text-xs sm:text-sm text-stone-500 line-clamp-1">{exam.courseName}</p>}
                                <p className="text-[11px] sm:text-xs text-stone-500 mt-1">
                                  {formatExamDate(exam.date)} • {formatExamTime(exam.startTime)}{exam.endTime ? ` - ${formatExamTime(exam.endTime)}` : ''}
                                </p>
                                {exam.room && <p className="text-[11px] sm:text-xs text-stone-400">Room: {exam.room}</p>}
                                {exam.notes && <p className="text-[11px] sm:text-xs text-stone-400 italic line-clamp-2">"{exam.notes}"</p>}
                              </div>
                            </div>
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 ${
                              status === 'ongoing' ? 'bg-green-100 text-green-700' :
                              status === 'upcoming' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'
                            }`}>
                              {status === 'ongoing' ? 'Now' : status === 'upcoming' ? 'Soon' : 'Done'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </main>

        {calendarDetailDate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCalendarDetailDate(null)}>
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl`} onClick={e => e.stopPropagation()}>
              <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-stone-200'} flex items-start justify-between gap-3`}>
                <div>
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Selected date</p>
                  <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{detailLabel}</h3>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{detailEvents.length} scheduled</p>
                </div>
                <button onClick={() => setCalendarDetailDate(null)} className={`p-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full`}>
                  <Icon name="close" className={darkMode ? 'text-gray-400' : 'text-stone-500'} />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {detailEvents.length === 0 && (
                  <div className={`text-center ${darkMode ? 'text-gray-400' : 'text-stone-500'} py-8`}>
                    <Icon name="event" className={`text-3xl ${darkMode ? 'text-gray-600' : 'text-stone-300'} mb-2`} />
                    <p>No items for this date.</p>
                  </div>
                )}

                {detailEvents.sort((a, b) => {
                  const statusA = getExamStatus(a);
                  const statusB = getExamStatus(b);
                  // Status priority: upcoming/ongoing first, completed last
                  const statusOrder: Record<string, number> = { 'upcoming': 0, 'ongoing': 0, 'completed': 1 };
                  const statusPriorityA = statusOrder[statusA] ?? 0;
                  const statusPriorityB = statusOrder[statusB] ?? 0;
                  if (statusPriorityA !== statusPriorityB) {
                    return statusPriorityA - statusPriorityB;
                  }
                  // Within same status, sort by time (nearest first)
                  const getStartTime = (exam: Exam) => {
                    const dateStr = String(exam.date);
                    let examDate: Date;
                    if (dateStr.includes('-')) {
                      const [year, month, day] = dateStr.split('-').map(Number);
                      examDate = new Date(year, month - 1, day);
                    } else {
                      examDate = new Date(dateStr);
                    }
                    const { hour, min } = parseTimeString(exam.startTime);
                    examDate.setHours(hour, min, 0, 0);
                    return examDate.getTime();
                  };
                  return getStartTime(a) - getStartTime(b);
                }).map((exam) => {
                  const colors = getExamTypeColor(exam.examType);
                  const status = getExamStatus(exam);
                  return (
                    <button
                      key={exam.examId}
                      onClick={() => { setSelectedExam(exam); setCalendarDetailDate(null); }}
                      className={`w-full text-left p-3 rounded-xl border ${darkMode ? 'border-gray-700 bg-gray-800 hover:border-gray-500' : 'border-stone-200 bg-white hover:border-stone-400'} hover:shadow-sm transition-all flex items-start gap-3`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors.bg} ${colors.text}`}>
                        <Icon name="event" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold line-clamp-1 ${darkMode ? 'text-white' : 'text-stone-800'}`}>{exam.courseCode}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors.bg} ${colors.text}`}>
                            {exam.examType}
                          </span>
                        </div>
                        {exam.courseName && <p className={`text-xs line-clamp-1 ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{exam.courseName}</p>}
                        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{formatExamTime(exam.startTime)}{exam.endTime ? ` - ${formatExamTime(exam.endTime)}` : ''}</p>
                        {exam.room && <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Room: {exam.room}</p>}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                        status === 'ongoing' ? (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-700') :
                        status === 'upcoming' ? (darkMode ? 'bg-amber-900 text-amber-200' : 'bg-amber-100 text-amber-700') : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-stone-100 text-stone-600')
                      }`}>
                        {status === 'ongoing' ? 'Ongoing' : status === 'upcoming' ? 'Upcoming' : 'Done'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={`p-4 border-t flex justify-end gap-2 ${darkMode ? 'border-gray-700' : 'border-stone-200'}`}>
                <button
                  onClick={() => setCalendarDetailDate(null)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setPrefillExamDate(calendarDetailDate ? toDateKey(calendarDetailDate) : null);
                    user ? setShowAddExam(true) : setShowLogin(true);
                  }}
                  className="px-4 py-2 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Date Jump Modal */}
        {showDateJump && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDateJump(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Jump to Date</h2>
                  <button onClick={() => setShowDateJump(false)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const dateStr = formData.get('jumpDate') as string;
                  if (dateStr) {
                    const targetDate = new Date(dateStr);
                    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                    setCalendarMonth(monthStart);
                    setCalendarSelectedDate(targetDate);
                    setShowDateJump(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Select Date</label>
                    <input
                      type="date"
                      name="jumpDate"
                      required
                      defaultValue={toDateKey(calendarSelectedDate || new Date())}
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDateJump(false)}
                      className="flex-1 py-2 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900"
                    >
                      Jump
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Date Jump Modal */}
        {showDateJump && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDateJump(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Jump to Date</h2>
                  <button onClick={() => setShowDateJump(false)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const dateStr = formData.get('jumpDate') as string;
                  if (dateStr) {
                    const targetDate = new Date(dateStr);
                    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                    setCalendarMonth(monthStart);
                    setCalendarSelectedDate(targetDate);
                    setShowDateJump(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Select Date</label>
                    <input
                      type="date"
                      name="jumpDate"
                      required
                      defaultValue={toDateKey(calendarSelectedDate || new Date())}
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDateJump(false)}
                      className="flex-1 py-2 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900"
                    >
                      Jump
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showAddExam && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Add Obligation</h2>
                  <button onClick={resetAddExamModal} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const success = await addExamToBackend({
                    courseCode: formData.get('courseCode') as string,
                    courseName: formData.get('courseName') as string || subjectInfo[formData.get('courseCode') as string]?.name || '',
                    examType: formData.get('examType') as string,
                    date: formData.get('date') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    room: formData.get('room') as string,
                    proctor: formData.get('proctor') as string,
                    notes: formData.get('notes') as string
                  });
                  
                  if (success) {
                    form.reset();
                    resetAddExamModal();
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course Code *</label>
                    <CourseDropdown
                      name="courseCode"
                      required
                      value={selectedExamCourseCode}
                      onChange={handleExamCourseChange}
                      options={displaySubjects.map(s => ({
                        code: s,
                        name: subjectInfo[s]?.name || ''
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course Name</label>
                    <input
                      type="text"
                      name="courseName"
                      value={selectedExamCourseName}
                      onChange={(e) => setSelectedExamCourseName(e.target.value)}
                      placeholder="e.g., Introduction to Language"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
                    <CustomDropdown
                      name="examType"
                      required
                      defaultValue="Activity"
                      options={EXAM_TYPE_OPTIONS}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                    <input type="date" name="date" required defaultValue={prefillExamDate || ''} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                      <input type="time" name="startTime" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                      <input type="time" name="endTime" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
                    <input type="text" name="room" required placeholder="e.g., Room 101" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
                    <input type="text" name="proctor" placeholder="e.g., Prof. Santos" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                    <textarea name="notes" rows={2} placeholder="Additional notes..." className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none" />
                  </div>
                  
                  <button type="submit" className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 flex items-center justify-center gap-2">
                    <Icon name="event" /> Add
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'EXAMS') {
    const ongoingExams = exams.filter(e => getExamStatus(e) === 'ongoing');
    const upcomingExams = exams.filter(e => getExamStatus(e) === 'upcoming');
    const completedExams = exams.filter(e => getExamStatus(e) === 'completed');
    
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-[#F5F5F4]'}`}>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onLogin={handleLoginSuccess}
          addToast={addToast}
          updateToast={updateToast}
          removeToast={removeToast}
          darkMode={darkMode}
        />
        
        {/* Header */}
        <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-stone-200'} border-b sticky top-0 z-10`}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={goBack} className={`p-2 -ml-2 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-stone-100'} rounded-full`}>
              <Icon name="arrow_back" className={darkMode ? 'text-gray-300' : 'text-stone-600'} />
            </button>
            <div className="flex-1">
              <h1 className={`font-bold ${darkMode ? 'text-white' : 'text-stone-800'} text-lg`}>Obligations</h1>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{exams.length} total obligations</p>
            </div>
            <button
              onClick={() => navigateTo('CALENDAR')}
              className={`flex items-center gap-2 px-4 py-2 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:border-gray-500' : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400'} border rounded-xl text-sm font-medium transition-colors`}
            >
              <Icon name="calendar_month" className="text-sm" />
              Calendar
            </button>
            <button
              onClick={() => { setPrefillExamDate(null); user ? setShowAddExam(true) : setShowLogin(true); }}
              className={`flex items-center gap-2 px-4 py-2 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-stone-800 hover:bg-stone-900'} text-white rounded-xl text-sm font-medium transition-colors`}
            >
              <Icon name="add" className="text-sm" />
              Add
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4">
          {exams.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="event" className={`text-5xl ${darkMode ? 'text-gray-600' : 'text-stone-300'} mb-4`} />
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-stone-600'} mb-2`}>No Obligations Scheduled</h3>
              <p className={`${darkMode ? 'text-gray-500' : 'text-stone-400'} mb-4`}>Add your first obligation to get started</p>
              <button
                onClick={() => { setPrefillExamDate(null); user ? setShowAddExam(true) : setShowLogin(true); }}
                className={`px-6 py-3 ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-stone-800 hover:bg-stone-900'} text-white rounded-xl font-medium transition-colors`}
              >
                Add
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ongoing Exams */}
              {ongoingExams.length > 0 && (
                <div>
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'} mb-3 flex items-center gap-2`}>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Ongoing Now ({ongoingExams.length})
                  </h2>
                  <div className="space-y-3">
                    {ongoingExams.map(exam => (
                      <div 
                        key={exam.examId} 
                        className={`${darkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'} border p-4 rounded-xl cursor-pointer hover:shadow-md transition-all`}
                        onClick={() => setSelectedExam(exam)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white">
                              <Icon name="schedule" className="text-xl" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${darkMode ? 'text-green-400' : 'text-green-800'}`}>{exam.courseCode}</span>
                                <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium">
                                  {exam.examType}
                                </span>
                              </div>
                              {exam.courseName && <p className={`text-sm ${darkMode ? 'text-green-300' : 'text-green-700'}`}>{exam.courseName}</p>}
                              <p className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-600'} mt-1`}>
                                {formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)} • Room: {exam.room}
                              </p>
                              {exam.proctor && <p className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-600'}`}>Proctor: {exam.proctor}</p>}
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-500 text-white text-sm rounded-full font-semibold animate-pulse">
                            IN PROGRESS
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Exams */}
              {upcomingExams.length > 0 && (
                <div>
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'} mb-3 flex items-center gap-2`}>
                    <Icon name="schedule" className="text-amber-500" />
                    Upcoming ({upcomingExams.length})
                  </h2>
                  <div className="space-y-3">
                    {upcomingExams.map(exam => (
                      <div 
                        key={exam.examId} 
                        className={`${darkMode ? 'bg-gray-800 border-gray-700 hover:border-amber-600' : 'bg-white border-stone-200 hover:border-amber-300'} border p-4 rounded-xl hover:shadow-md transition-all cursor-pointer`}
                        onClick={() => setSelectedExam(exam)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 ${darkMode ? 'bg-amber-900/50' : 'bg-amber-100'} rounded-xl flex items-center justify-center ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                              <Icon name="event" className="text-xl" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${darkMode ? 'text-white' : 'text-stone-800'}`}>{exam.courseCode}</span>
                                <span className={`px-2 py-0.5 ${darkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-700'} text-xs rounded-full font-medium`}>
                                  {exam.examType}
                                </span>
                              </div>
                              {exam.courseName && <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>{exam.courseName}</p>}
                              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-stone-600'} mt-1`}>
                                <span className="font-medium">{formatExamDate(exam.date)}</span>
                              </p>
                              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-stone-500'}`}>
                                {formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)} • Room: {exam.room}
                              </p>
                              {exam.proctor && <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Proctor: {exam.proctor}</p>}
                              {exam.notes && <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'} italic mt-1 line-clamp-2`}>"{exam.notes}"</p>}
                              {exam.createdByName && <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-stone-400'}`}>Added by: {exam.createdByName}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-2 py-1 ${darkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-700'} text-xs rounded-full font-medium`}>
                              Upcoming
                            </span>
                            {user && user.idNumber === exam.createdBy && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExamToEdit(exam); }}
                                  className={`p-1 ${darkMode ? 'text-gray-500 hover:text-blue-400' : 'text-stone-400 hover:text-blue-500'}`}
                                  title="Edit obligation"
                                >
                                  <Icon name="edit" className="text-sm" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExamToDelete(exam.examId); }}
                                  className={`p-1 ${darkMode ? 'text-gray-500 hover:text-red-400' : 'text-stone-400 hover:text-red-500'}`}
                                  title="Delete obligation"
                                >
                                  <Icon name="delete" className="text-sm" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Exams */}
              {completedExams.length > 0 && (
                <div>
                  <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-stone-800'} mb-3 flex items-center gap-2`}>
                    <Icon name="check_circle" className={darkMode ? 'text-gray-500' : 'text-stone-400'} />
                    Completed ({completedExams.length})
                  </h2>
                  <div className="space-y-3">
                    {completedExams.map(exam => (
                      <div 
                        key={exam.examId} 
                        className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-stone-50 border-stone-200'} border p-4 rounded-xl opacity-60 cursor-pointer hover:opacity-80 hover:shadow-md transition-all`}
                        onClick={() => setSelectedExam(exam)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 ${darkMode ? 'bg-gray-700' : 'bg-stone-200'} rounded-xl flex items-center justify-center ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>
                              <Icon name="check" className="text-xl" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${darkMode ? 'text-gray-400' : 'text-stone-600'}`}>{exam.courseCode}</span>
                                <span className={`px-2 py-0.5 ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-stone-200 text-stone-600'} text-xs rounded-full font-medium`}>
                                  {exam.examType}
                                </span>
                              </div>
                              {exam.courseName && <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-stone-500'}`}>{exam.courseName}</p>}
                              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-stone-500'} mt-1`}>
                                {formatExamDate(exam.date)} • {formatExamTime(exam.startTime)} - {formatExamTime(exam.endTime)}
                              </p>
                              <p className={`text-xs ${darkMode ? 'text-gray-600' : 'text-stone-400'}`}>Room: {exam.room}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-stone-200 text-stone-600'} text-xs rounded-full font-medium`}>
                            Done
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!examToDelete}
          title="Delete Obligation"
          message="Are you sure you want to delete this obligation? This action cannot be undone."
          onConfirm={async () => {
            if (examToDelete) {
              await deleteExamFromBackend(examToDelete);
            }
          }}
          onClose={() => setExamToDelete(null)}
          darkMode={darkMode}
        />

        {/* Edit Obligation Modal */}
        {examToEdit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Edit Obligation</h2>
                  <button onClick={() => setExamToEdit(null)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const success = await updateExamToBackend(examToEdit.examId, {
                    courseCode: formData.get('courseCode') as string,
                    courseName: subjectInfo[formData.get('courseCode') as string]?.name || '',
                    examType: formData.get('examType') as string,
                    date: formData.get('date') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    room: formData.get('room') as string,
                    proctor: formData.get('proctor') as string,
                    notes: formData.get('notes') as string
                  });
                  
                  if (success) {
                    setExamToEdit(null);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course *</label>
                    <CourseDropdown
                      name="courseCode"
                      required
                      defaultValue={examToEdit.courseCode}
                      options={displaySubjects.map(s => ({
                        code: s,
                        name: subjectInfo[s]?.name || ''
                      }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
                    <CustomDropdown
                      name="examType"
                      required
                      defaultValue={examToEdit.examType}
                      options={EXAM_TYPE_OPTIONS}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                    <input type="date" name="date" required defaultValue={examToEdit.date} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                      <input type="time" name="startTime" required defaultValue={examToEdit.startTime} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                      <input type="time" name="endTime" required defaultValue={examToEdit.endTime} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
                    <input type="text" name="room" required defaultValue={examToEdit.room} placeholder="e.g., Room 101" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
                    <input type="text" name="proctor" defaultValue={examToEdit.proctor || ''} placeholder="e.g., Prof. Santos" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                    <textarea name="notes" rows={2} defaultValue={examToEdit.notes || ''} placeholder="Additional notes..." className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none" />
                  </div>
                  
                  <button type="submit" className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 flex items-center justify-center gap-2">
                    <Icon name="save" /> Save Changes
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Add Obligation Modal */}
        {showAddExam && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-stone-800">Add Obligation</h2>
                  <button onClick={resetAddExamModal} className="p-2 hover:bg-stone-100 rounded-full">
                    <Icon name="close" className="text-stone-500" />
                  </button>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  
                  const success = await addExamToBackend({
                    courseCode: formData.get('courseCode') as string,
                    courseName: formData.get('courseName') as string || subjectInfo[formData.get('courseCode') as string]?.name || '',
                    examType: formData.get('examType') as string,
                    date: formData.get('date') as string,
                    startTime: formData.get('startTime') as string,
                    endTime: formData.get('endTime') as string,
                    room: formData.get('room') as string,
                    proctor: formData.get('proctor') as string,
                    notes: formData.get('notes') as string
                  });
                  
                  if (success) {
                    form.reset();
                    resetAddExamModal();
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course Code *</label>
                    <CourseDropdown
                      name="courseCode"
                      required
                      value={selectedExamCourseCode}
                      onChange={handleExamCourseChange}
                      options={displaySubjects.map(s => ({
                        code: s,
                        name: subjectInfo[s]?.name || ''
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Course Name</label>
                    <input
                      type="text"
                      name="courseName"
                      value={selectedExamCourseName}
                      onChange={(e) => setSelectedExamCourseName(e.target.value)}
                      placeholder="e.g., Introduction to Language"
                      className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
                    <CustomDropdown
                      name="examType"
                      required
                      defaultValue="Activity"
                      options={EXAM_TYPE_OPTIONS}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Date *</label>
                    <input type="date" name="date" required defaultValue={prefillExamDate || ''} className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Start Time *</label>
                      <input type="time" name="startTime" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">End Time *</label>
                      <input type="time" name="endTime" required className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Room *</label>
                    <input type="text" name="room" required placeholder="e.g., Room 101" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Proctor</label>
                    <input type="text" name="proctor" placeholder="e.g., Prof. Santos" className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                    <textarea name="notes" rows={2} placeholder="Additional notes..." className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-500 resize-none" />
                  </div>
                  
                  <button type="submit" className="w-full py-3 bg-stone-800 text-white rounded-xl font-semibold hover:bg-stone-900 flex items-center justify-center gap-2">
                    <Icon name="event" /> Add
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Exam Detail Modal */}
        <ExamDetailModal
          exam={selectedExam}
          onClose={() => setSelectedExam(null)}
          onEdit={(exam) => setExamToEdit(exam)}
          user={user}
          getExamStatus={getExamStatus}
          getTimeUntilExam={getTimeUntilExam}
          formatCountdown={formatCountdown}
          formatExamDate={formatExamDate}
          formatExamTime={formatExamTime}
          darkMode={darkMode}
          linkedResources={selectedExam ? getLinkedResourcesForObligation(selectedExam.examId) : []}
          onOpenResource={(resource) => openResource(resource)}
        />
      </div>
    );
  }

  return null;
};
