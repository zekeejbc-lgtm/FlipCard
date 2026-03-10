/**
 * 1SF Attendance Backend
 *
 * Attendance service backed by two sheets:
 * - Roster
 * - Attendance_Logs
 *
 * Attendance_Logs uses one row per member-event record.
 * Existing legacy column-per-event data is migrated automatically.
 */

const ATTENDANCE_DIRECTORY_GAS_URL = 'https://script.google.com/macros/s/AKfycbx7gVOloTlgAZ5NJalR5QRrEo8iRdc-rJWZiaiStu2KMU7hAXvicAJXUm2Jm5iCLZZn/exec';
const ATTENDANCE_CLASS_SCHEDULE_GAS_URL = 'https://script.google.com/macros/s/AKfycbxJoCpVWKo1cWku1ErvwGRuVhvPaqoT2hL51mJMS_8KyjSfmCCTngZt7nZ9T6Yq7Q8oNw/exec';
const ATTENDANCE_TIMEZONE = 'Asia/Manila';
const ATTENDANCE_ANALYTICS_POSITIONS = ['mayor', 'vice mayor', 'secretary', 'assistant secretary'];
const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'];
const ATTENDANCE_RECORD_MODES = ['whole_day', 'session', 'course'];
const ATTENDANCE_MORNING_END_MINUTES = 12 * 60;
const ATTENDANCE_LOG_HEADERS = [
  'RecordId',
  'MemberId',
  'MemberName',
  'EventId',
  'EventLabel',
  'Status',
  'RecordedBy',
  'RecordedAt',
  'UpdatedBy',
  'UpdatedAt',
  'IsDeleted'
];
const ATTENDANCE_LOG_INDEX = {
  RECORD_ID: 0,
  MEMBER_ID: 1,
  MEMBER_NAME: 2,
  EVENT_ID: 3,
  EVENT_LABEL: 4,
  STATUS: 5,
  RECORDED_BY: 6,
  RECORDED_AT: 7,
  UPDATED_BY: 8,
  UPDATED_AT: 9,
  IS_DELETED: 10
};

function doGet(e) {
  try {
    const action = safeString(e && e.parameter && e.parameter.action) || 'getAttendanceConfig';
    switch (action) {
      case 'ping':
        return jsonResponse({ success: true, message: '1SF Attendance API is running', timestamp: getManilaTimestamp() });
      case 'setupAttendanceSheets':
        return jsonResponse(setupAttendanceSheets());
      case 'getAttendanceConfig':
        return jsonResponse(getAttendanceConfig(safeString(e.parameter.userId)));
      case 'getMyAttendanceRecords':
        return jsonResponse(getMyAttendanceRecords(safeString(e.parameter.userId)));
      case 'getAttendanceAnalytics':
        return jsonResponse(getAttendanceAnalytics(safeString(e.parameter.userId)));
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message || String(error) });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (safeString(data.action)) {
      case 'setupAttendanceSheets':
        return jsonResponse(setupAttendanceSheets());
      case 'saveManualAttendance':
      case 'bulkUpdateAttendance':
        return jsonResponse(saveManualAttendance(data));
      case 'resolveScannedAttendance':
        return jsonResponse(resolveScannedAttendance(data));
      case 'recordScannedAttendance':
        return jsonResponse(recordScannedAttendance(data));
      case 'getAttendanceConfig':
        return jsonResponse(getAttendanceConfig(data.userId));
      case 'getMyAttendanceRecords':
        return jsonResponse(getMyAttendanceRecords(data.userId));
      case 'getAttendanceAnalytics':
        return jsonResponse(getAttendanceAnalytics(data.userId));
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message || String(error) });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function setupAttendanceSheets() {
  ensureRosterSheet();
  ensureAttendanceLogsSheet();
  return { success: true };
}

function ensureRosterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Roster');
  if (!sheet) {
    sheet = ss.insertSheet('Roster');
    sheet.appendRow(['MemberId', 'Name']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureAttendanceLogsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Attendance_Logs');
  if (!sheet) {
    sheet = ss.insertSheet('Attendance_Logs');
    sheet.appendRow(ATTENDANCE_LOG_HEADERS);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    sheet.getRange(1, 1, 1, ATTENDANCE_LOG_HEADERS.length).setValues([ATTENDANCE_LOG_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  if (isLegacyAttendanceLogsFormat(values)) {
    migrateLegacyAttendanceLogsSheet(sheet, values);
    return sheet;
  }

  const currentHeaders = values[0];
  var needsHeaderRewrite = false;
  for (var index = 0; index < ATTENDANCE_LOG_HEADERS.length; index++) {
    if (safeString(currentHeaders[index]) !== ATTENDANCE_LOG_HEADERS[index]) {
      needsHeaderRewrite = true;
      break;
    }
  }

  if (needsHeaderRewrite || currentHeaders.length !== ATTENDANCE_LOG_HEADERS.length) {
    const rows = parseAttendanceLogRows(values);
    writeAttendanceLogRows(sheet, rows);
  } else {
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function isLegacyAttendanceLogsFormat(values) {
  const headers = values && values.length ? values[0] : [];
  return safeString(headers[0]) === 'MemberId' && safeString(headers[1]) === 'MemberName';
}

function migrateLegacyAttendanceLogsSheet(sheet, values) {
  const rows = [];

  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex] || [];
    const memberId = safeString(row[0]);
    const memberName = safeString(row[1]);
    if (!memberId) continue;

    for (var columnIndex = 2; columnIndex < values[0].length; columnIndex++) {
      const eventId = safeString(values[0][columnIndex]);
      const status = normalizeAttendanceStatus(row[columnIndex]);
      if (!eventId || !status) continue;

      rows.push({
        recordId: Utilities.getUuid(),
        memberId: memberId,
        memberName: memberName,
        eventId: eventId,
        eventLabel: eventId,
        status: status,
        recordedBy: '',
        recordedAt: '',
        updatedBy: '',
        updatedAt: '',
        isDeleted: false
      });
    }
  }

  writeAttendanceLogRows(sheet, rows);
}

function getAttendanceConfig(userId) {
  syncAttendanceLogsWithRoster();
  const userProfile = getResolvedUserProfile(userId);
  const logsData = getAttendanceLogsData();
  const activeRecords = getActiveAttendanceRecords(logsData.rows);
  const todayContext = getTodayAttendanceContext();

  return {
    success: true,
    userProfile: userProfile.user,
    canEdit: hasOfficerPosition(userProfile.position),
    canViewAnalytics: canAccessAttendanceAnalytics(userProfile.position),
    events: getAttendanceEvents(activeRecords),
    members: buildAttendanceMembers(activeRecords),
    myRecords: buildMyAttendanceRecords(userId, activeRecords),
    analytics: buildAttendanceAnalytics(activeRecords),
    capture: todayContext
  };
}

function saveManualAttendance(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    syncAttendanceLogsWithRoster();
    const userProfile = getResolvedUserProfile(data.userId);
    if (!hasOfficerPosition(userProfile.position)) return { error: 'Unauthorized' };

    const eventId = safeString(data.eventId);
    const eventLabel = safeString(data.eventLabel) || eventId;
    const members = Array.isArray(data.members) ? data.members : [];
    if (!eventId) return { error: 'Missing eventId' };
    if (!members.length) return { error: 'No attendance payload provided' };

    const logsData = getAttendanceLogsData();
    const recordedBy = getAttendanceActorLabel(userProfile.user, data.userId);
    var updatedCount = 0;

    for (var i = 0; i < members.length; i++) {
      const member = members[i] || {};
      const memberId = safeString(member.memberId);
      const memberName = safeString(member.name || member.memberName);
      const status = normalizeAttendanceStatus(member.status);
      if (!memberId || !status) continue;

      syncAttendanceMemberWithRoster({ memberId: memberId, name: memberName, fullName: memberName });
      if (upsertAttendanceLogRecord(logsData.rows, {
        memberId: memberId,
        memberName: memberName,
        eventId: eventId,
        eventLabel: eventLabel,
        status: status,
        recordedBy: recordedBy
      })) {
        updatedCount++;
      }
    }

    writeAttendanceLogRows(logsData.sheet, logsData.rows);
    return {
      success: true,
      eventId: eventId,
      updated: updatedCount,
      analytics: buildAttendanceAnalytics(getActiveAttendanceRecords(logsData.rows))
    };
  } catch (error) {
    return { error: 'Failed to save attendance records: ' + (error.message || String(error)) };
  } finally {
    lock.releaseLock();
  }
}

function resolveScannedAttendance(data) {
  try {
    syncAttendanceLogsWithRoster();
    const userProfile = getResolvedUserProfile(data.userId);
    if (!hasOfficerPosition(userProfile.position)) return { error: 'Unauthorized' };

    const qrText = safeString(data.qrText);
    if (!qrText) return { error: 'Missing qrText' };

    const resolvedMember = resolveAttendanceMemberFromQRCode(qrText);
    if (!resolvedMember.success) return { error: resolvedMember.error || 'Unable to resolve scanned QR' };
    syncAttendanceMemberWithRoster(resolvedMember.member);

    return {
      success: true,
      member: resolvedMember.member
    };
  } catch (error) {
    return { error: error.message || String(error) };
  }
}

function recordScannedAttendance(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    syncAttendanceLogsWithRoster();
    const userProfile = getResolvedUserProfile(data.userId);
    if (!hasOfficerPosition(userProfile.position)) return { error: 'Unauthorized' };

    const qrText = safeString(data.qrText);
    const recordMode = safeString(data.recordMode).toLowerCase();
    const sessionKey = safeString(data.sessionKey).toLowerCase();
    const courseCode = safeString(data.courseCode).toUpperCase();
    const status = normalizeAttendanceStatus(data.status) || 'Present';
    const explicitEventIds = Array.isArray(data.eventIds) ? data.eventIds.map(safeString).filter(Boolean) : [];

    if (!qrText) return { error: 'Missing qrText' };
    if (ATTENDANCE_RECORD_MODES.indexOf(recordMode) === -1) return { error: 'Invalid recordMode' };
    if (!explicitEventIds.length && recordMode === 'session' && sessionKey !== 'morning' && sessionKey !== 'afternoon') {
      return { error: 'Select a valid session' };
    }
    if (!explicitEventIds.length && recordMode === 'course' && !courseCode) {
      return { error: 'Select a course' };
    }

    const resolvedMember = resolveAttendanceMemberFromQRCode(qrText);
    if (!resolvedMember.success) return { error: resolvedMember.error || 'Unable to resolve scanned QR' };
    syncAttendanceMemberWithRoster(resolvedMember.member);

    var targets = [];
    if (explicitEventIds.length) {
      for (var eventIndex = 0; eventIndex < explicitEventIds.length; eventIndex++) {
        const explicitEventId = explicitEventIds[eventIndex];
        targets.push({ eventId: explicitEventId, label: explicitEventId });
      }
    } else {
      const todayContext = getTodayAttendanceContext();
      if (!todayContext.success) return todayContext;
      if (!todayContext.schedules.length) return { error: 'No active schedules found for today' };

      targets = resolveAttendanceTargets(todayContext.schedules, recordMode, sessionKey, courseCode);
      if (!targets.length) {
        return { error: 'No schedule targets matched the selected recording mode' };
      }
    }

    const logsData = getAttendanceLogsData();
    const recordedBy = getAttendanceActorLabel(userProfile.user, data.userId);
    var updatedCount = 0;

    for (var i = 0; i < targets.length; i++) {
      const target = targets[i] || {};
      if (upsertAttendanceLogRecord(logsData.rows, {
        memberId: safeString(resolvedMember.member.memberId),
        memberName: safeString(resolvedMember.member.fullName || resolvedMember.member.name),
        eventId: safeString(target.eventId),
        eventLabel: safeString(target.label) || safeString(target.eventId),
        status: status,
        recordedBy: recordedBy
      })) {
        updatedCount++;
      }
    }

    writeAttendanceLogRows(logsData.sheet, logsData.rows);
    return {
      success: true,
      member: resolvedMember.member,
      status: status,
      recordMode: recordMode,
      updated: updatedCount,
      targets: targets,
      analytics: buildAttendanceAnalytics(getActiveAttendanceRecords(logsData.rows))
    };
  } catch (error) {
    return { error: 'Failed to record attendance: ' + (error.message || String(error)) };
  } finally {
    lock.releaseLock();
  }
}

function getMyAttendanceRecords(userId) {
  syncAttendanceLogsWithRoster();
  const logsData = getAttendanceLogsData();
  return {
    success: true,
    records: buildMyAttendanceRecords(userId, getActiveAttendanceRecords(logsData.rows))
  };
}

function getAttendanceAnalytics(userId) {
  syncAttendanceLogsWithRoster();
  const userProfile = getResolvedUserProfile(userId);
  if (!canAccessAttendanceAnalytics(userProfile.position)) return { error: 'Unauthorized' };

  const logsData = getAttendanceLogsData();
  return {
    success: true,
    analytics: buildAttendanceAnalytics(getActiveAttendanceRecords(logsData.rows))
  };
}

function getAttendanceLogsData() {
  const sheet = ensureAttendanceLogsSheet();
  const values = sheet.getDataRange().getValues();
  return {
    sheet: sheet,
    values: values,
    headers: values.length ? values[0] : ATTENDANCE_LOG_HEADERS.slice(),
    rows: parseAttendanceLogRows(values)
  };
}

function parseAttendanceLogRows(values) {
  const rows = [];
  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex] || [];
    const memberId = safeString(row[ATTENDANCE_LOG_INDEX.MEMBER_ID]);
    const eventId = safeString(row[ATTENDANCE_LOG_INDEX.EVENT_ID]);
    if (!memberId && !eventId) continue;

    rows.push({
      recordId: safeString(row[ATTENDANCE_LOG_INDEX.RECORD_ID]) || Utilities.getUuid(),
      memberId: memberId,
      memberName: safeString(row[ATTENDANCE_LOG_INDEX.MEMBER_NAME]),
      eventId: eventId,
      eventLabel: safeString(row[ATTENDANCE_LOG_INDEX.EVENT_LABEL]) || eventId,
      status: normalizeAttendanceStatus(row[ATTENDANCE_LOG_INDEX.STATUS]),
      recordedBy: safeString(row[ATTENDANCE_LOG_INDEX.RECORDED_BY]),
      recordedAt: safeString(row[ATTENDANCE_LOG_INDEX.RECORDED_AT]),
      updatedBy: safeString(row[ATTENDANCE_LOG_INDEX.UPDATED_BY]),
      updatedAt: safeString(row[ATTENDANCE_LOG_INDEX.UPDATED_AT]),
      isDeleted: normalizeBoolean(row[ATTENDANCE_LOG_INDEX.IS_DELETED])
    });
  }
  return rows;
}

function serializeAttendanceLogRow(row) {
  return [
    safeString(row.recordId),
    safeString(row.memberId),
    safeString(row.memberName),
    safeString(row.eventId),
    safeString(row.eventLabel),
    normalizeAttendanceStatus(row.status),
    safeString(row.recordedBy),
    safeString(row.recordedAt),
    safeString(row.updatedBy),
    safeString(row.updatedAt),
    row.isDeleted ? 'true' : 'false'
  ];
}

function writeAttendanceLogRows(sheet, rows) {
  const values = [ATTENDANCE_LOG_HEADERS];
  for (var i = 0; i < rows.length; i++) {
    values.push(serializeAttendanceLogRow(rows[i]));
  }

  sheet.clearContents();
  sheet.getRange(1, 1, values.length, ATTENDANCE_LOG_HEADERS.length).setValues(values);
  sheet.setFrozenRows(1);
}

function getActiveAttendanceRecords(rows) {
  const activeRows = [];
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    if (row.isDeleted) continue;
    if (!safeString(row.memberId) || !safeString(row.eventId)) continue;
    if (!normalizeAttendanceStatus(row.status)) continue;
    activeRows.push({
      recordId: safeString(row.recordId),
      memberId: safeString(row.memberId),
      memberName: safeString(row.memberName),
      eventId: safeString(row.eventId),
      eventLabel: safeString(row.eventLabel) || safeString(row.eventId),
      status: normalizeAttendanceStatus(row.status),
      recordedBy: safeString(row.recordedBy),
      recordedAt: safeString(row.recordedAt),
      updatedBy: safeString(row.updatedBy),
      updatedAt: safeString(row.updatedAt),
      isDeleted: false
    });
  }
  return activeRows;
}

function upsertAttendanceLogRecord(rows, payload) {
  const memberId = safeString(payload.memberId);
  const eventId = safeString(payload.eventId);
  const status = normalizeAttendanceStatus(payload.status);
  if (!memberId || !eventId || !status) return false;

  const memberName = safeString(payload.memberName);
  const eventLabel = safeString(payload.eventLabel) || eventId;
  const actor = safeString(payload.recordedBy);
  const timestamp = getManilaTimestamp();

  for (var i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    if (safeString(row.memberId) !== memberId || safeString(row.eventId) !== eventId || row.isDeleted) {
      continue;
    }

    row.memberName = memberName || safeString(row.memberName);
    row.eventLabel = eventLabel;
    row.status = status;
    if (!safeString(row.recordedAt)) row.recordedAt = timestamp;
    if (!safeString(row.recordedBy)) row.recordedBy = actor;
    row.updatedBy = actor;
    row.updatedAt = timestamp;
    row.isDeleted = false;
    rows[i] = row;
    return true;
  }

  rows.push({
    recordId: Utilities.getUuid(),
    memberId: memberId,
    memberName: memberName,
    eventId: eventId,
    eventLabel: eventLabel,
    status: status,
    recordedBy: actor,
    recordedAt: timestamp,
    updatedBy: '',
    updatedAt: '',
    isDeleted: false
  });
  return true;
}

function syncAttendanceLogsWithRoster() {
  ensureRosterSheet();
  ensureAttendanceLogsSheet();
}

function syncAttendanceMemberWithRoster(member) {
  const memberId = safeString(member && member.memberId);
  const memberName = safeString(member && (member.fullName || member.name));
  if (!memberId) return;

  const rosterSheet = ensureRosterSheet();
  const rosterValues = rosterSheet.getDataRange().getValues();
  const rosterData = rosterValues.length ? rosterValues : [['MemberId', 'Name']];
  const rosterHeaders = rosterData[0];
  const memberIdIndex = findHeaderIndex(rosterHeaders, ['memberid', 'member id', 'studentid', 'student id', 'idnumber', 'id']);
  const memberNameIndex = findHeaderIndex(rosterHeaders, ['name', 'membername', 'member name', 'studentname', 'student name', 'fullname', 'full name']);
  const resolvedMemberIdIndex = memberIdIndex === -1 ? 0 : memberIdIndex;
  const resolvedMemberNameIndex = memberNameIndex === -1 ? 1 : memberNameIndex;
  var rosterChanged = false;
  var memberFound = false;

  while (rosterHeaders.length < Math.max(resolvedMemberIdIndex, resolvedMemberNameIndex) + 1) {
    rosterHeaders.push('');
    rosterChanged = true;
  }

  if (safeString(rosterHeaders[resolvedMemberIdIndex]) !== 'MemberId') {
    rosterHeaders[resolvedMemberIdIndex] = 'MemberId';
    rosterChanged = true;
  }
  if (safeString(rosterHeaders[resolvedMemberNameIndex]) !== 'Name') {
    rosterHeaders[resolvedMemberNameIndex] = 'Name';
    rosterChanged = true;
  }

  for (var rowIndex = 1; rowIndex < rosterData.length; rowIndex++) {
    const row = Array.isArray(rosterData[rowIndex]) ? rosterData[rowIndex] : [];
    while (row.length < rosterHeaders.length) {
      row.push('');
    }

    if (safeString(row[resolvedMemberIdIndex]) !== memberId) {
      rosterData[rowIndex] = row;
      continue;
    }

    memberFound = true;
    if (memberName && safeString(row[resolvedMemberNameIndex]) !== memberName) {
      row[resolvedMemberNameIndex] = memberName;
      rosterChanged = true;
    }
    rosterData[rowIndex] = row;
    break;
  }

  if (!memberFound) {
    const nextRow = buildEmptyRow(rosterHeaders.length);
    nextRow[resolvedMemberIdIndex] = memberId;
    nextRow[resolvedMemberNameIndex] = memberName;
    rosterData.push(nextRow);
    rosterChanged = true;
  }

  if (rosterChanged || rosterSheet.getLastRow() !== rosterData.length || rosterSheet.getLastColumn() !== rosterHeaders.length) {
    writeSheetValues(rosterSheet, rosterData, rosterHeaders.length);
  }
}

function readRosterMembers() {
  const sheet = ensureRosterSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  const memberIdIndex = findHeaderIndex(headers, ['memberid', 'member id', 'studentid', 'student id', 'idnumber', 'id']);
  const memberNameIndex = findHeaderIndex(headers, ['name', 'membername', 'member name', 'studentname', 'student name', 'fullname', 'full name']);
  const members = [];

  for (var i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const memberId = safeString(row[memberIdIndex === -1 ? 0 : memberIdIndex]);
    const name = safeString(row[memberNameIndex === -1 ? 1 : memberNameIndex]);
    if (!memberId && !name) continue;
    members.push({ memberId: memberId, name: name });
  }

  return members;
}

function buildAttendanceMembers(activeRecords) {
  const membersById = {};
  const rosterMembers = readRosterMembers();

  for (var rosterIndex = 0; rosterIndex < rosterMembers.length; rosterIndex++) {
    const rosterMember = rosterMembers[rosterIndex] || {};
    const rosterMemberId = safeString(rosterMember.memberId);
    if (!rosterMemberId) continue;

    membersById[rosterMemberId] = {
      memberId: rosterMemberId,
      name: safeString(rosterMember.name),
      statuses: {}
    };
  }

  for (var recordIndex = 0; recordIndex < activeRecords.length; recordIndex++) {
    const record = activeRecords[recordIndex] || {};
    const memberId = safeString(record.memberId);
    if (!memberId) continue;

    if (!membersById.hasOwnProperty(memberId)) {
      membersById[memberId] = {
        memberId: memberId,
        name: safeString(record.memberName),
        statuses: {}
      };
    }

    if (!membersById[memberId].name) {
      membersById[memberId].name = safeString(record.memberName);
    }
    membersById[memberId].statuses[safeString(record.eventId)] = normalizeAttendanceStatus(record.status);
  }

  const members = [];
  for (var memberId in membersById) {
    if (!membersById.hasOwnProperty(memberId)) continue;
    members.push(membersById[memberId]);
  }

  members.sort(function(a, b) {
    return safeString(a.name).localeCompare(safeString(b.name)) || safeString(a.memberId).localeCompare(safeString(b.memberId));
  });
  return members;
}

function buildMyAttendanceRecords(userId, activeRecords) {
  const normalizedUserId = safeString(userId);
  if (!normalizedUserId) return [];

  const records = [];
  for (var i = 0; i < activeRecords.length; i++) {
    const record = activeRecords[i] || {};
    if (safeString(record.memberId) !== normalizedUserId) continue;

    records.push({
      eventId: safeString(record.eventId),
      eventLabel: safeString(record.eventLabel) || safeString(record.eventId),
      status: normalizeAttendanceStatus(record.status)
    });
  }

  records.sort(function(a, b) {
    return safeString(a.eventLabel).localeCompare(safeString(b.eventLabel));
  });
  return records;
}

function buildAttendanceAnalytics(activeRecords) {
  const byStatus = {};
  const byEvent = {};
  var totalMarked = 0;

  for (var i = 0; i < activeRecords.length; i++) {
    const record = activeRecords[i] || {};
    const eventLabel = safeString(record.eventLabel) || safeString(record.eventId);
    const status = normalizeAttendanceStatus(record.status);
    if (!eventLabel || !status) continue;

    byStatus[status] = (byStatus[status] || 0) + 1;
    byEvent[eventLabel] = (byEvent[eventLabel] || 0) + 1;
    totalMarked++;
  }

  return {
    totalMarked: totalMarked,
    byStatus: sortSummaryMap(byStatus),
    byEvent: sortSummaryMap(byEvent)
  };
}

function getAttendanceEvents(activeRecords) {
  const eventsById = {};
  for (var i = 0; i < activeRecords.length; i++) {
    const record = activeRecords[i] || {};
    const eventId = safeString(record.eventId);
    if (!eventId) continue;

    eventsById[eventId] = {
      eventId: eventId,
      label: safeString(record.eventLabel) || eventId
    };
  }

  const events = [];
  for (var eventId in eventsById) {
    if (!eventsById.hasOwnProperty(eventId)) continue;
    events.push(eventsById[eventId]);
  }

  events.sort(function(a, b) {
    return safeString(a.label).localeCompare(safeString(b.label));
  });
  return events;
}

function getTodayAttendanceContext() {
  const schedulesResult = getTodayAttendanceSchedules();
  if (!schedulesResult.success) {
    return {
      success: false,
      error: schedulesResult.error || 'Unable to load today\'s schedules',
      date: schedulesResult.date || getManilaDateString(),
      dayOfWeek: schedulesResult.dayOfWeek || getManilaDayOfWeek(),
      schedules: [],
      sessionOptions: [],
      courseOptions: []
    };
  }

  return {
    success: true,
    date: schedulesResult.date,
    dayOfWeek: schedulesResult.dayOfWeek,
    schedules: schedulesResult.schedules,
    sessionOptions: buildSessionOptions(schedulesResult.schedules),
    courseOptions: buildCourseOptions(schedulesResult.schedules)
  };
}

function getTodayAttendanceSchedules() {
  const schedulesResult = postJsonToService(ATTENDANCE_CLASS_SCHEDULE_GAS_URL, { action: 'getClassSchedules' });
  if (!schedulesResult || !schedulesResult.success || !Array.isArray(schedulesResult.schedules)) {
    return { success: false, error: schedulesResult && schedulesResult.error ? schedulesResult.error : 'Unable to load class schedules' };
  }

  const today = getManilaDateString();
  const currentDayOfWeek = getManilaDayOfWeek();
  const schedules = [];

  for (var i = 0; i < schedulesResult.schedules.length; i++) {
    const schedule = schedulesResult.schedules[i] || {};
    if (!isTodayAttendanceSchedule(schedule, today, currentDayOfWeek)) continue;

    const normalizedSchedule = buildAttendanceSchedule(schedule, today);
    if (!normalizedSchedule.eventId) continue;
    schedules.push(normalizedSchedule);
  }

  schedules.sort(function(a, b) {
    return safeString(a.startTime).localeCompare(safeString(b.startTime)) ||
      safeString(a.courseCode).localeCompare(safeString(b.courseCode)) ||
      safeString(a.label).localeCompare(safeString(b.label));
  });

  return {
    success: true,
    date: today,
    dayOfWeek: currentDayOfWeek,
    schedules: schedules
  };
}

function isTodayAttendanceSchedule(schedule, today, currentDayOfWeek) {
  const type = safeString(schedule.type).toLowerCase();
  if (type === 'semestral') {
    return safeString(schedule.dayOfWeek).toLowerCase() === safeString(currentDayOfWeek).toLowerCase();
  }
  return safeString(schedule.specificDate) === today;
}

function buildAttendanceSchedule(schedule, dateKey) {
  const courseCode = safeString(schedule.courseCode).toUpperCase();
  const courseName = safeString(schedule.courseName);
  const startTime = safeString(schedule.startTime);
  const endTime = safeString(schedule.endTime);
  const type = safeString(schedule.type).toLowerCase();
  const sessionKey = getAttendanceSessionKey(startTime);
  const eventId = buildAttendanceEventId(dateKey, schedule);

  return {
    scheduleId: safeString(schedule.scheduleId),
    courseCode: courseCode,
    courseName: courseName,
    type: type,
    startTime: startTime,
    endTime: endTime,
    startTime12h: safeString(schedule.startTime12h) || startTime,
    endTime12h: safeString(schedule.endTime12h) || endTime,
    specificDate: safeString(schedule.specificDate) || dateKey,
    dayOfWeek: safeString(schedule.dayOfWeek),
    sessionKey: sessionKey,
    sessionLabel: sessionKey === 'morning' ? 'Morning' : 'Afternoon',
    eventId: eventId,
    label: buildAttendanceEventLabel(dateKey, schedule)
  };
}

function buildSessionOptions(schedules) {
  const summary = {};
  for (var i = 0; i < schedules.length; i++) {
    const sessionKey = safeString(schedules[i].sessionKey);
    if (!sessionKey) continue;
    summary[sessionKey] = (summary[sessionKey] || 0) + 1;
  }

  const result = [];
  if (summary.morning) result.push({ key: 'morning', label: 'Morning Session', count: summary.morning });
  if (summary.afternoon) result.push({ key: 'afternoon', label: 'Afternoon Session', count: summary.afternoon });
  return result;
}

function buildCourseOptions(schedules) {
  const byCourse = {};

  for (var i = 0; i < schedules.length; i++) {
    const schedule = schedules[i] || {};
    const courseCode = safeString(schedule.courseCode).toUpperCase();
    if (!courseCode) continue;

    if (!byCourse.hasOwnProperty(courseCode)) {
      byCourse[courseCode] = {
        courseCode: courseCode,
        courseName: safeString(schedule.courseName) || courseCode,
        count: 0
      };
    }

    byCourse[courseCode].count++;
  }

  const result = [];
  for (var key in byCourse) {
    if (!byCourse.hasOwnProperty(key)) continue;
    result.push(byCourse[key]);
  }

  result.sort(function(a, b) {
    return safeString(a.courseCode).localeCompare(safeString(b.courseCode));
  });
  return result;
}

function resolveAttendanceTargets(schedules, recordMode, sessionKey, courseCode) {
  const targets = [];
  const normalizedSessionKey = safeString(sessionKey).toLowerCase();
  const normalizedCourseCode = safeString(courseCode).toUpperCase();

  for (var i = 0; i < schedules.length; i++) {
    const schedule = schedules[i] || {};
    if (recordMode === 'session' && safeString(schedule.sessionKey).toLowerCase() !== normalizedSessionKey) continue;
    if (recordMode === 'course' && safeString(schedule.courseCode).toUpperCase() !== normalizedCourseCode) continue;
    targets.push(schedule);
  }

  return targets;
}

function resolveAttendanceMemberFromQRCode(qrText) {
  const normalizedQrText = safeString(qrText);
  if (!normalizedQrText) return { error: 'QR text is required' };

  const directoryLookup = postJsonToService(ATTENDANCE_DIRECTORY_GAS_URL, {
    action: 'findUserByQRCode',
    qrCodeText: normalizedQrText
  });

  if (directoryLookup && directoryLookup.success && directoryLookup.user) {
    return {
      success: true,
      member: {
        memberId: safeString(directoryLookup.user.idNumber),
        name: safeString(directoryLookup.user.fullName || directoryLookup.user.name),
        fullName: safeString(directoryLookup.user.fullName || directoryLookup.user.name),
        course: safeString(directoryLookup.user.program),
        year: safeString(directoryLookup.user.year),
        section: safeString(directoryLookup.user.section)
      }
    };
  }

  const fallbackUserId = extractIdNumberFromQRText(normalizedQrText);
  if (fallbackUserId) {
    const fallbackProfile = getDirectoryProfile(fallbackUserId);
    if (fallbackProfile.success && fallbackProfile.user) {
      return {
        success: true,
        member: {
          memberId: safeString(fallbackProfile.user.idNumber),
          name: safeString(fallbackProfile.user.fullName || fallbackProfile.user.name),
          fullName: safeString(fallbackProfile.user.fullName || fallbackProfile.user.name),
          course: safeString(fallbackProfile.user.program),
          year: safeString(fallbackProfile.user.year),
          section: safeString(fallbackProfile.user.section)
        }
      };
    }
  }

  return { error: 'No matching student was found for the scanned QR code' };
}

function extractIdNumberFromQRText(qrText) {
  const match = safeString(qrText).match(/\b\d{4}-\d{5}\b/);
  return match ? safeString(match[0]) : '';
}

function getAttendanceActorLabel(user, fallbackUserId) {
  return safeString(user && (user.fullName || user.name || user.idNumber)) || safeString(fallbackUserId);
}

function buildEmptyRow(columnCount) {
  const row = [];
  for (var i = 0; i < columnCount; i++) {
    row.push('');
  }
  return row;
}

function writeSheetValues(sheet, values, columnCount) {
  const width = Math.max(columnCount || 0, 1);
  const normalized = [];

  for (var i = 0; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i].slice(0, width) : [];
    while (row.length < width) {
      row.push('');
    }
    normalized.push(row);
  }

  sheet.clearContents();
  if (normalized.length) {
    sheet.getRange(1, 1, normalized.length, width).setValues(normalized);
  }
  sheet.setFrozenRows(1);
}

function buildAttendanceEventId(dateKey, schedule) {
  const parts = [
    safeString(dateKey),
    safeString(schedule.courseCode).toUpperCase(),
    safeString(schedule.startTime),
    safeString(schedule.endTime),
    safeString(schedule.type).toLowerCase()
  ];
  return parts.join(' | ');
}

function buildAttendanceEventLabel(dateKey, schedule) {
  const pieces = [
    safeString(dateKey),
    safeString(schedule.courseCode).toUpperCase()
  ];

  const courseName = safeString(schedule.courseName);
  if (courseName) pieces.push(courseName);

  const startLabel = safeString(schedule.startTime12h) || safeString(schedule.startTime);
  const endLabel = safeString(schedule.endTime12h) || safeString(schedule.endTime);
  if (startLabel || endLabel) pieces.push([startLabel, endLabel].filter(Boolean).join(' - '));

  return pieces.join(' | ');
}

function getAttendanceSessionKey(startTime) {
  return getTimeInMinutes(startTime) < ATTENDANCE_MORNING_END_MINUTES ? 'morning' : 'afternoon';
}

function getTimeInMinutes(timeValue) {
  const parts = safeString(timeValue).split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return (hours * 60) + minutes;
}

function findHeaderIndex(headers, candidates) {
  for (var i = 0; i < headers.length; i++) {
    const headerKey = normalizeHeaderKey(headers[i]);
    for (var j = 0; j < candidates.length; j++) {
      if (headerKey === normalizeHeaderKey(candidates[j])) return i;
    }
  }
  return -1;
}

function sortSummaryMap(map) {
  const result = [];
  for (var key in map) {
    if (!map.hasOwnProperty(key)) continue;
    result.push({ label: key, value: Number(map[key]) || 0 });
  }
  result.sort(function(a, b) {
    return b.value - a.value || safeString(a.label).localeCompare(safeString(b.label));
  });
  return result;
}

function getResolvedUserProfile(userId) {
  const normalizedUserId = safeString(userId);
  if (!normalizedUserId) {
    return { user: null, position: '' };
  }

  const profileResult = getDirectoryProfile(normalizedUserId);
  if (profileResult.success && profileResult.user) {
    return { user: profileResult.user, position: safeString(profileResult.user.position) };
  }

  return {
    user: {
      idNumber: normalizedUserId,
      fullName: '',
      name: '',
      position: ''
    },
    position: ''
  };
}

function getDirectoryProfile(userId) {
  return postJsonToService(ATTENDANCE_DIRECTORY_GAS_URL, { action: 'getUserProfile', idNumber: safeString(userId) });
}

function postJsonToService(url, payload) {
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    return JSON.parse(response.getContentText() || '{}');
  } catch (error) {
    return { error: error.message || String(error) };
  }
}

function hasOfficerPosition(position) {
  return !!safeString(position);
}

function canAccessAttendanceAnalytics(position) {
  return ATTENDANCE_ANALYTICS_POSITIONS.indexOf(safeString(position).toLowerCase()) !== -1;
}

function normalizeAttendanceStatus(value) {
  const normalized = safeString(value).toLowerCase();
  if (normalized === 'present') return 'Present';
  if (normalized === 'absent') return 'Absent';
  if (normalized === 'late') return 'Late';
  if (normalized === 'excused') return 'Excused';
  return '';
}

function normalizeBoolean(value) {
  const normalized = safeString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function normalizeHeaderKey(value) {
  return safeString(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getManilaTimestamp() {
  return Utilities.formatDate(new Date(), ATTENDANCE_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function getManilaDateString() {
  return Utilities.formatDate(new Date(), ATTENDANCE_TIMEZONE, 'yyyy-MM-dd');
}

function getManilaDayOfWeek() {
  return Utilities.formatDate(new Date(), ATTENDANCE_TIMEZONE, 'EEEE');
}

function safeString(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
