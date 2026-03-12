/**
 * 1SF Class Schedule - Backend System
 * Google Apps Script for Class Schedule Management
 * 
 * GAS URL: https://script.google.com/macros/s/AKfycbxJoCpVWKo1cWku1ErvwGRuVhvPaqoT2hL51mJMS_8KyjSfmCCTngZt7nZ9T6Yq7Q8oNw/exec
 * 
 * SPREADSHEET STRUCTURE:
 * 
 * Sheet: "ClassSchedule"
 * Columns:
 * A: ScheduleID (Unique identifier - format: SCHED-timestamp)
 * B: Type (semestral, makeup, activity, special)
 * C: Semester (1st or 2nd)
 * D: CourseCode (e.g., FL111)
 * E: CourseName (Course title)
 * F: Teacher (Instructor name)
 * G: Classroom (Room/Location)
 * H: DayOfWeek (Monday, Tuesday, etc. - for semestral)
 * I: StartTime (e.g., 08:00)
 * J: EndTime (e.g., 10:00)
 * K: SpecificDate (ISO date string - for makeup/activity/special)
 * L: Details (Additional notes)
 * M: IsActive (true/false)
 * N: CreatedBy (User ID)
 * O: CreatedByName (User name)
 * P: CreatedAt (ISO timestamp)
 * Q: UpdatedAt (ISO timestamp)
 * 
 * Sheet: "SemesterConfig"
 * Columns:
 * A: Semester (1st or 2nd)
 * B: StartDate (ISO date)
 * C: EndDate (ISO date)
 * D: AcademicYear (e.g., 2025-2026)
 * E: IsActive (true/false)
 *
 * Sheet: "CourseCatalog"
 * Columns:
 * A: CourseCode (Unique course code)
 * B: CourseName (Course title)
 * C: IsActive (true/false)
 * D: CreatedBy (User ID)
 * E: CreatedByName (User name)
 * F: CreatedAt (ISO timestamp)
 * G: UpdatedAt (ISO timestamp)
 */

// =====================================================
// CONFIGURATION
// =====================================================

const ADMIN_USER_ID = '2025-00046';
const MANILA_TIMEZONE = 'Asia/Manila';

// Column index constants for ClassSchedule (0-based)
const SCHEDULE_COL = {
  SCHEDULE_ID: 0,
  TYPE: 1,
  SEMESTER: 2,
  COURSE_CODE: 3,
  COURSE_NAME: 4,
  TEACHER: 5,
  CLASSROOM: 6,
  DAY_OF_WEEK: 7,
  START_TIME: 8,
  END_TIME: 9,
  SPECIFIC_DATE: 10,
  DETAILS: 11,
  IS_ACTIVE: 12,
  CREATED_BY: 13,
  CREATED_BY_NAME: 14,
  CREATED_AT: 15,
  UPDATED_AT: 16
};

// Column index constants for CourseCatalog (0-based)
const COURSE_COL = {
  COURSE_CODE: 0,
  COURSE_NAME: 1,
  IS_ACTIVE: 2,
  CREATED_BY: 3,
  CREATED_BY_NAME: 4,
  CREATED_AT: 5,
  UPDATED_AT: 6
};

const OBLIGATION_COL = {
  OBLIGATION_ID: 0,
  COURSE_CODE: 1,
  COURSE_NAME: 2,
  CATEGORY: 3,
  DATE: 4,
  START_TIME: 5,
  END_TIME: 6,
  LOCATION: 7,
  FACILITATOR: 8,
  NOTES: 9,
  IS_ACTIVE: 10,
  CREATED_BY: 11,
  CREATED_BY_NAME: 12,
  CREATED_AT: 13,
  UPDATED_AT: 14,
  END_DATE: 15
};

const USER_ACCOUNT_COL = {
  ID_NUMBER: 0,
  ROLE: 20,
  POSITION: 21
};

const SCHEDULE_MANAGER_POSITIONS = [
  'mayor',
  'vice mayor',
  'secretary',
  'internal public information officer',
  'external public information officer'
];

const SEMESTRAL_MANAGER_POSITIONS = [
  'mayor',
  'vice mayor',
  'secretary'
];

// =====================================================
// TIMEZONE UTILITIES (Manila Local Time)
// =====================================================

/**
 * Get current date/time in Manila timezone
 * @returns {Date} Date object adjusted to Manila time
 */
function getManilaDate() {
  return new Date(Utilities.formatDate(new Date(), MANILA_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss"));
}

/**
 * Format a date to Manila timezone ISO string
 * @param {Date} date - Date to format (optional, defaults to now)
 * @returns {string} ISO-like string in Manila time
 */
function getManilaTimestamp(date) {
  const d = date || new Date();
  return Utilities.formatDate(d, MANILA_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss") + '+08:00';
}

/**
 * Get Manila date string (YYYY-MM-DD)
 * @param {Date} date - Date to format (optional, defaults to now)
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getManilaDateString(date) {
  const d = date || new Date();
  return Utilities.formatDate(d, MANILA_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Get current day of week in Manila timezone
 * @returns {string} Day name (Monday, Tuesday, etc.)
 */
function getManilaDayOfWeek() {
  return Utilities.formatDate(new Date(), MANILA_TIMEZONE, 'EEEE');
}

/**
 * Convert 24-hour time string to 12-hour format
 * @param {string} time24 - Time in HH:mm format (e.g., "14:30")
 * @returns {string} Time in 12-hour format (e.g., "2:30 PM")
 */
function formatTime12Hour(time24) {
  if (!time24) return '';
  
  try {
    const [hours, minutes] = time24.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return time24;
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const minuteStr = String(minutes).padStart(2, '0');
    
    return `${hour12}:${minuteStr} ${period}`;
  } catch (e) {
    return time24;
  }
}

/**
 * Convert 12-hour time string to 24-hour format
 * @param {string} time12 - Time in 12-hour format (e.g., "2:30 PM")
 * @returns {string} Time in HH:mm format (e.g., "14:30")
 */
function formatTime24Hour(time12) {
  if (!time12) return '';
  
  try {
    const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return time12;
    
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  } catch (e) {
    return time12;
  }
}

/**
 * Format a date for display in Manila timezone
 * @param {Date|string} date - Date to format
 * @param {string} format - Format pattern (default: 'MMM dd, yyyy hh:mm a')
 * @returns {string} Formatted date string
 */
function formatManilaDateTime(date, format) {
  if (!date) return '';
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return Utilities.formatDate(d, MANILA_TIMEZONE, format || 'MMM dd, yyyy hh:mm a');
  } catch (e) {
    return String(date);
  }
}

// =====================================================
// MAIN REQUEST HANDLERS
// =====================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('1SF Class Schedule')
    .addItem('Setup Sheets', 'setupAllSheets')
    .addItem('View All Schedules', 'showAllSchedules')
    .addToUi();
}

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'ping';
    
    switch(action) {
      case 'ping':
        return jsonResponse({ 
          success: true, 
          message: '1SF Class Schedule API is running', 
          timestamp: getManilaTimestamp() 
        });
      
      case 'getClassSchedules':
        return jsonResponse(getClassSchedules(e.parameter.semester, e.parameter.type));
      
      case 'getSemesterConfig':
        return jsonResponse(getSemesterConfig());
      
      case 'getCurrentSemester':
        return jsonResponse(getCurrentSemester());

      case 'getCourses':
        return jsonResponse(getCourses(e.parameter.semester));

      case 'getObligations':
        return jsonResponse(getObligations(e.parameter.subject));
      
      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (error) {
    return jsonResponse({ error: error.message, stack: error.stack });
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch(action) {
      // ==================== CRUD Operations ====================
      case 'addClassSchedule':
        return jsonResponse(addClassSchedule(data));

      case 'batchAddSchedules':
        return jsonResponse(batchAddSchedules(data));
      
      case 'updateClassSchedule':
        return jsonResponse(updateClassSchedule(data));
      
      case 'deleteClassSchedule':
        return jsonResponse(deleteClassSchedule(data.scheduleId, data.userId));
      
      case 'getClassSchedules':
        return jsonResponse(getClassSchedules(data.semester, data.type));
      
      // ==================== Semester Configuration ====================
      case 'getSemesterConfig':
        return jsonResponse(getSemesterConfig());
      
      case 'updateSemesterConfig':
        return jsonResponse(updateSemesterConfig(data));
      
      case 'getCurrentSemester':
        return jsonResponse(getCurrentSemester());
      
      case 'getSubjectsBySemester':
        return jsonResponse(getSubjectsBySemester(data.semester));

      case 'getCourses':
        return jsonResponse(getCourses(data.semester));

      case 'getObligations':
        return jsonResponse(getObligations(data.subject));

      case 'addObligation':
        return jsonResponse(addObligation(data));

      case 'updateObligation':
        return jsonResponse(updateObligation(data));

      case 'deleteObligation':
        return jsonResponse(deleteObligation(data.obligationId, data.userId));

      case 'addCourse':
        return jsonResponse(addCourse(data));

      case 'updateCourse':
        return jsonResponse(updateCourse(data));

      case 'deleteCourse':
        return jsonResponse(deleteCourse(data.courseCode, data.userId));
      
      // ==================== Setup ====================
      case 'setupSheets':
        return jsonResponse(setupAllSheets());
      
      case 'setupClassScheduleSheet':
        return jsonResponse(setupClassScheduleSheet());

      case 'setupCourseCatalogSheet':
        return jsonResponse(setupCourseCatalogSheet());

      case 'setupObligationsSheet':
        return jsonResponse(setupObligationsSheet());
      
      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (error) {
    return jsonResponse({ error: error.message, stack: error.stack });
  }
}

/**
 * Return JSON response with CORS headers
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// SETUP FUNCTIONS
// =====================================================

/**
 * Setup all required sheets
 */
function setupAllSheets() {
  const results = [];
  
  results.push(setupClassScheduleSheet());
  results.push(setupSemesterConfigSheet());
  results.push(setupCourseCatalogSheet());
  results.push(setupObligationsSheet());
  
  return { 
    success: true, 
    results: results,
    message: 'All sheets have been set up successfully'
  };
}

/**
 * Setup ClassSchedule sheet
 */
function setupClassScheduleSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ClassSchedule');
  
  if (!sheet) {
    sheet = ss.insertSheet('ClassSchedule');
    sheet.appendRow([
      'ScheduleID',      // A
      'Type',            // B
      'Semester',        // C
      'CourseCode',      // D
      'CourseName',      // E
      'Teacher',         // F
      'Classroom',       // G
      'DayOfWeek',       // H
      'StartTime',       // I
      'EndTime',         // J
      'SpecificDate',    // K
      'Details',         // L
      'IsActive',        // M
      'CreatedBy',       // N
      'CreatedByName',   // O
      'CreatedAt',       // P
      'UpdatedAt'        // Q
    ]);
    sheet.setFrozenRows(1);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, 17);
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    
    return { success: true, message: 'ClassSchedule sheet created' };
  }
  
  return { success: true, message: 'ClassSchedule sheet already exists' };
}

/**
 * Setup SemesterConfig sheet
 */
function setupSemesterConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('SemesterConfig');
  
  if (!sheet) {
    sheet = ss.insertSheet('SemesterConfig');
    sheet.appendRow(['Semester', 'StartDate', 'EndDate', 'AcademicYear', 'IsActive']);
    
    // Add default semester dates
    sheet.appendRow(['1st', '2025-08-01', '2025-12-20', '2025-2026', true]);
    sheet.appendRow(['2nd', '2026-01-06', '2026-05-31', '2025-2026', true]);
    
    sheet.setFrozenRows(1);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, 5);
    headerRange.setBackground('#34a853');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    
    return { success: true, message: 'SemesterConfig sheet created with default dates' };
  }
  
  return { success: true, message: 'SemesterConfig sheet already exists' };
}

function setupObligationsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Obligations');
  const headers = [
    'ObligationID',
    'CourseCode',
    'CourseName',
    'Category',
    'Date',
    'StartTime',
    'EndTime',
    'Location',
    'Facilitator',
    'Notes',
    'IsActive',
    'CreatedBy',
    'CreatedByName',
    'CreatedAt',
    'UpdatedAt',
    'EndDate'
  ];

  if (!sheet) {
    sheet = ss.insertSheet('Obligations');
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);

    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f766e');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');

    return { success: true, message: 'Obligations sheet created' };
  }

  if (sheet.getRange(1, 1, 1, headers.length).getValues()[0][OBLIGATION_COL.END_DATE] !== 'EndDate') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0f766e');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return { success: true, message: 'Obligations sheet already exists' };
}

/**
 * Setup CourseCatalog sheet
 */
function setupCourseCatalogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('CourseCatalog');
  
  if (!sheet) {
    sheet = ss.insertSheet('CourseCatalog');
    sheet.appendRow([
      'CourseCode',
      'CourseName',
      'IsActive',
      'CreatedBy',
      'CreatedByName',
      'CreatedAt',
      'UpdatedAt'
    ]);
    sheet.setFrozenRows(1);
    
    const headerRange = sheet.getRange(1, 1, 1, 7);
    headerRange.setBackground('#fbbc04');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
  }
  
  const syncResult = syncCoursesFromSchedules();
  
  return { 
    success: true, 
    message: 'CourseCatalog sheet is ready',
    syncedCourses: syncResult.synced || 0
  };
}

// =====================================================
// AUTHORIZATION / PERMISSIONS
// =====================================================

/**
 * Check if user has permission to manage schedules
 * Allowed users:
 * - admin / superadmin roles
 * - class officer positions: Mayor, Vice Mayor, Secretary,
 *   Internal Public Information Officer, External Public Information Officer
 */
function canManageSchedules(userId) {
  // Admin always has access
  if (String(userId) === ADMIN_USER_ID) {
    return true;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('UserAccounts');
  
  if (!userSheet) {
    // If no UserAccounts sheet, check if user is in a local authorized list
    return false;
  }
  
  const data = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][USER_ACCOUNT_COL.ID_NUMBER]) === String(userId)) {
      const role = String(data[i][USER_ACCOUNT_COL.ROLE] || '').trim().toLowerCase();
      const position = String(data[i][USER_ACCOUNT_COL.POSITION] || '').trim().toLowerCase();
      return role === 'admin' || role === 'superadmin' || SCHEDULE_MANAGER_POSITIONS.includes(position);
    }
  }
  
  return false;
}

/**
 * Check if user can manage semestral schedules (more restricted)
 * Only admin/superadmin, Mayor, Vice Mayor, and Secretary
 */
function canManageSemestral(userId) {
  if (String(userId) === ADMIN_USER_ID) {
    return true;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('UserAccounts');
  
  if (!userSheet) {
    return false;
  }
  
  const data = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][USER_ACCOUNT_COL.ID_NUMBER]) === String(userId)) {
      const role = String(data[i][USER_ACCOUNT_COL.ROLE] || '').trim().toLowerCase();
      const position = String(data[i][USER_ACCOUNT_COL.POSITION] || '').trim().toLowerCase();
      return role === 'admin' || role === 'superadmin' || SEMESTRAL_MANAGER_POSITIONS.includes(position);
    }
  }
  
  return false;
}

// =====================================================
// COURSE CATALOG HELPERS
// =====================================================

function getOrCreateCourseCatalogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('CourseCatalog');
  
  if (!sheet) {
    setupCourseCatalogSheet();
    sheet = ss.getSheetByName('CourseCatalog');
  }
  
  return sheet;
}

function normalizeCourseCode(courseCode) {
  return String(courseCode || '').trim().toUpperCase();
}

function isTruthy(value) {
  return value === true || value === 'TRUE' || String(value).toLowerCase() === 'true';
}

function findCourseRow(sheet, courseCode) {
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!normalizedCode) return null;
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (normalizeCourseCode(data[i][COURSE_COL.COURSE_CODE]) === normalizedCode) {
      return {
        rowIndex: i + 1,
        row: data[i]
      };
    }
  }
  
  return null;
}

function ensureCourseExists(courseCode, courseName, userId, userName) {
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!normalizedCode) {
    return { success: false, error: 'Missing courseCode' };
  }
  
  const sheet = getOrCreateCourseCatalogSheet();
  const existing = findCourseRow(sheet, normalizedCode);
  const now = getManilaTimestamp();
  const safeName = String(courseName || '').trim();
  
  if (existing) {
    const currentName = String(existing.row[COURSE_COL.COURSE_NAME] || '').trim();
    const rowIndex = existing.rowIndex;
    
    sheet.getRange(rowIndex, COURSE_COL.COURSE_CODE + 1).setValue(normalizedCode);
    
    if (safeName && safeName !== currentName) {
      sheet.getRange(rowIndex, COURSE_COL.COURSE_NAME + 1).setValue(safeName);
    }
    
    if (!isTruthy(existing.row[COURSE_COL.IS_ACTIVE])) {
      sheet.getRange(rowIndex, COURSE_COL.IS_ACTIVE + 1).setValue(true);
    }
    
    sheet.getRange(rowIndex, COURSE_COL.UPDATED_AT + 1).setValue(now);
    
    return {
      success: true,
      created: false,
      course: {
        code: normalizedCode,
        name: safeName || currentName || normalizedCode
      }
    };
  }
  
  sheet.appendRow([
    normalizedCode,
    safeName || normalizedCode,
    true,
    userId || '',
    userName || '',
    now,
    now
  ]);
  
  return {
    success: true,
    created: true,
    course: {
      code: normalizedCode,
      name: safeName || normalizedCode
    }
  };
}

function syncCoursesFromSchedules() {
  try {
    const sheet = getOrCreateCourseCatalogSheet();
    const schedulesResult = getClassSchedules();
    
    if (!schedulesResult.success || !schedulesResult.schedules) {
      return { success: true, synced: 0 };
    }
    
    let synced = 0;
    
    schedulesResult.schedules.forEach(schedule => {
      const result = ensureCourseExists(
        schedule.courseCode,
        schedule.courseName,
        schedule.createdBy,
        schedule.createdByName
      );
      
      if (result.success && result.created) {
        synced++;
      }
    });
    
    return { success: true, synced: synced };
  } catch (error) {
    return { success: false, synced: 0, error: error.message };
  }
}

function normalizeTimeValue(timeValue) {
  if (!timeValue) return '';

  if (timeValue instanceof Date) {
    return Utilities.formatDate(timeValue, MANILA_TIMEZONE, 'HH:mm');
  }

  const value = String(timeValue).trim();
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;

  const converted = formatTime24Hour(value);
  if (/^\d{2}:\d{2}$/.test(converted)) return converted;

  const parts = value.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }
  }

  return value;
}

function scheduleTypeRequiresCourse(type) {
  return String(type || '').trim().toLowerCase() === 'semestral';
}

function canManageRestrictedObligations(userId) {
  return canManageSemestral(userId);
}

function isRestrictedObligationCategory(category) {
  const normalized = String(category || '').trim().toLowerCase();
  return [
    'midterm exam',
    'final exam',
    'quiz',
    'le deadline',
    'reporting',
    'performance',
    'presentation',
    'submission',
    'exam'
  ].includes(normalized);
}

function getCourses(semester) {
  try {
    const sheet = getOrCreateCourseCatalogSheet();
    const syncResult = syncCoursesFromSchedules();
    const data = sheet.getDataRange().getValues();
    const semesterCourseCodes = new Set();
    
    if (semester) {
      const schedulesResult = getClassSchedules(semester);
      if (schedulesResult.success && schedulesResult.schedules) {
        schedulesResult.schedules.forEach(schedule => {
          if (schedule.courseCode) {
            semesterCourseCodes.add(normalizeCourseCode(schedule.courseCode));
          }
        });
      }
    }
    
    const courses = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const code = normalizeCourseCode(row[COURSE_COL.COURSE_CODE]);
      if (!code || !isTruthy(row[COURSE_COL.IS_ACTIVE])) continue;
      if (semester && !semesterCourseCodes.has(code)) continue;
      
      courses.push({
        code: code,
        name: String(row[COURSE_COL.COURSE_NAME] || '').trim() || code,
        isActive: true,
        createdBy: String(row[COURSE_COL.CREATED_BY] || '').trim(),
        createdByName: String(row[COURSE_COL.CREATED_BY_NAME] || '').trim(),
        createdAt: row[COURSE_COL.CREATED_AT],
        updatedAt: row[COURSE_COL.UPDATED_AT]
      });
    }
    
    courses.sort((a, b) => a.code.localeCompare(b.code));
    
    return {
      success: true,
      courses: courses,
      subjects: courses.map(course => ({ code: course.code, name: course.name })),
      syncedCourses: syncResult.synced || 0
    };
  } catch (error) {
    return { error: 'Failed to get courses: ' + error.message };
  }
}

function addCourse(data) {
  try {
    const { courseCode, courseName, userId, userName } = data;
    
    if (!canManageSchedules(userId)) {
      return { error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage courses.' };
    }
    
    if (!courseCode) {
      return { error: 'Missing courseCode' };
    }
    
    const result = ensureCourseExists(courseCode, courseName, userId, userName);
    if (!result.success) {
      return { error: result.error || 'Failed to add course' };
    }
    
    return {
      success: true,
      message: result.created ? 'Course added successfully' : 'Course already exists and was updated',
      course: result.course
    };
  } catch (error) {
    return { error: 'Failed to add course: ' + error.message };
  }
}

function updateCourse(data) {
  try {
    const { courseCode, newCourseCode, courseName, userId } = data;
    
    if (!canManageSchedules(userId)) {
      return { error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage courses.' };
    }
    
    const currentCode = normalizeCourseCode(courseCode);
    const nextCode = normalizeCourseCode(newCourseCode || courseCode);
    
    if (!currentCode || !nextCode) {
      return { error: 'Missing courseCode' };
    }
    
    const sheet = getOrCreateCourseCatalogSheet();
    const existing = findCourseRow(sheet, currentCode);
    
    if (!existing) {
      return { error: 'Course not found' };
    }
    
    if (currentCode !== nextCode) {
      const duplicate = findCourseRow(sheet, nextCode);
      if (duplicate) {
        return { error: 'New course code already exists' };
      }
    }
    
    const now = getManilaTimestamp();
    sheet.getRange(existing.rowIndex, COURSE_COL.COURSE_CODE + 1).setValue(nextCode);
    if (courseName !== undefined) {
      sheet.getRange(existing.rowIndex, COURSE_COL.COURSE_NAME + 1).setValue(String(courseName || '').trim());
    }
    sheet.getRange(existing.rowIndex, COURSE_COL.IS_ACTIVE + 1).setValue(true);
    sheet.getRange(existing.rowIndex, COURSE_COL.UPDATED_AT + 1).setValue(now);
    
    if (currentCode !== nextCode || courseName !== undefined) {
      const scheduleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ClassSchedule');
      if (scheduleSheet) {
        const scheduleData = scheduleSheet.getDataRange().getValues();
        for (let i = 1; i < scheduleData.length; i++) {
          if (normalizeCourseCode(scheduleData[i][SCHEDULE_COL.COURSE_CODE]) === currentCode) {
            if (currentCode !== nextCode) {
              scheduleSheet.getRange(i + 1, SCHEDULE_COL.COURSE_CODE + 1).setValue(nextCode);
            }
            if (courseName !== undefined) {
              scheduleSheet.getRange(i + 1, SCHEDULE_COL.COURSE_NAME + 1).setValue(String(courseName || '').trim());
            }
            scheduleSheet.getRange(i + 1, SCHEDULE_COL.UPDATED_AT + 1).setValue(now);
          }
        }
      }
    }
    
    return {
      success: true,
      message: 'Course updated successfully',
      course: {
        code: nextCode,
        name: String(courseName || existing.row[COURSE_COL.COURSE_NAME] || '').trim() || nextCode,
        updatedAt: now
      }
    };
  } catch (error) {
    return { error: 'Failed to update course: ' + error.message };
  }
}

function deleteCourse(courseCode, userId) {
  try {
    if (!canManageSchedules(userId)) {
      return { error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage courses.' };
    }
    
    const normalizedCode = normalizeCourseCode(courseCode);
    if (!normalizedCode) {
      return { error: 'Missing courseCode' };
    }
    
    const scheduleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ClassSchedule');
    if (scheduleSheet) {
      const scheduleData = scheduleSheet.getDataRange().getValues();
      for (let i = 1; i < scheduleData.length; i++) {
        const isActiveSchedule = isTruthy(scheduleData[i][SCHEDULE_COL.IS_ACTIVE]);
        if (isActiveSchedule && normalizeCourseCode(scheduleData[i][SCHEDULE_COL.COURSE_CODE]) === normalizedCode) {
          return { error: 'Cannot delete course while active schedules still use it.' };
        }
      }
    }
    
    const sheet = getOrCreateCourseCatalogSheet();
    const existing = findCourseRow(sheet, normalizedCode);
    
    if (!existing) {
      return { error: 'Course not found' };
    }
    
    const now = getManilaTimestamp();
    sheet.getRange(existing.rowIndex, COURSE_COL.IS_ACTIVE + 1).setValue(false);
    sheet.getRange(existing.rowIndex, COURSE_COL.UPDATED_AT + 1).setValue(now);
    
    return {
      success: true,
      message: 'Course removed successfully',
      courseCode: normalizedCode,
      updatedAt: now
    };
  } catch (error) {
    return { error: 'Failed to delete course: ' + error.message };
  }
}

// =====================================================
// CRUD OPERATIONS - CREATE
// =====================================================

/**
 * Add a new class schedule
 * @param {Object} data - Schedule data
 * @returns {Object} Result with success status and schedule data
 */
function addClassSchedule(data) {
  try {
    const { 
      type, 
      semester, 
      courseCode, 
      courseName, 
      teacher, 
      classroom, 
      dayOfWeek, 
      startTime, 
      endTime, 
      specificDate, 
      details, 
      userId, 
      userName 
    } = data;
    const normalizedType = String(type || '').trim();
    const normalizedCourseCode = normalizeCourseCode(courseCode);
    const providedCourseName = String(courseName || '').trim();
    const requiresCourse = scheduleTypeRequiresCourse(normalizedType);
    
    // Validate permission
    if (!canManageSchedules(userId)) {
      return { 
        error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage schedules.' 
      };
    }
    
    // PIOs can only add non-semestral schedules
    if (normalizedType === 'semestral' && !canManageSemestral(userId)) {
      return { 
        error: 'Unauthorized. Only Mayor, Vice Mayor, or Secretary can add semestral schedules.' 
      };
    }
    
    // Validate required fields
    if (!normalizedType || !startTime || !endTime) {
      return { error: 'Missing required fields (type, startTime, endTime)' };
    }

    if (requiresCourse && !normalizedCourseCode) {
      return { error: 'Semestral schedules require a course code' };
    }
    
    // Validate type-specific requirements
    if (normalizedType === 'semestral' && (!dayOfWeek || !semester)) {
      return { error: 'Semestral schedules require dayOfWeek and semester' };
    }
    
    if (normalizedType !== 'semestral' && !specificDate) {
      return { error: 'Special schedules (makeup, activity, special) require a specific date' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('ClassSchedule');
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      setupClassScheduleSheet();
      sheet = ss.getSheetByName('ClassSchedule');
    }

    let savedCourseName = providedCourseName;
    if (normalizedCourseCode) {
      const courseResult = ensureCourseExists(normalizedCourseCode, courseName, userId, userName);
      if (!courseResult.success) {
        return { error: courseResult.error || 'Failed to save course' };
      }
      savedCourseName = courseResult.course.name;
    }
    
    // Generate unique ID
    const scheduleId = 'SCHED-' + Date.now();
    const now = getManilaTimestamp();
    
    // Append the new row
    sheet.appendRow([
      scheduleId,                    // A: ScheduleID
      normalizedType,                // B: Type
      semester || '',                // C: Semester
      normalizedCourseCode,          // D: CourseCode
      savedCourseName,               // E: CourseName
      teacher || '',                 // F: Teacher
      classroom || '',               // G: Classroom
      dayOfWeek || '',               // H: DayOfWeek
      startTime,                     // I: StartTime
      endTime,                       // J: EndTime
      specificDate || '',            // K: SpecificDate
      details || '',                 // L: Details
      true,                          // M: IsActive
      userId,                        // N: CreatedBy
      userName || '',                // O: CreatedByName
      now,                           // P: CreatedAt
      now                            // Q: UpdatedAt
    ]);
    
    // Return the created schedule with 12-hour time format
    return {
      success: true,
      schedule: {
        scheduleId,
        type: normalizedType,
        semester: semester || '',
        courseCode: normalizedCourseCode,
        courseName: savedCourseName,
        teacher: teacher || '',
        classroom: classroom || '',
        dayOfWeek: dayOfWeek || '',
        startTime,
        endTime,
        startTime12h: formatTime12Hour(startTime),
        endTime12h: formatTime12Hour(endTime),
        specificDate: specificDate || '',
        details: details || '',
        isActive: true,
        createdBy: userId,
        createdByName: userName || '',
        createdAt: now,
        updatedAt: now,
        status: 'scheduled'
      }
    };
    
  } catch (error) {
    return { error: 'Failed to add schedule: ' + error.message };
  }
}

// =====================================================
// CRUD OPERATIONS - READ
// =====================================================

/**
 * Get all class schedules with optional filters
 * @param {string} semester - Optional: Filter by semester (1st or 2nd)
 * @param {string} type - Optional: Filter by type (semestral, makeup, activity, special)
 * @returns {Object} Result with schedules array
 */
function getClassSchedules(semester, type) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ClassSchedule');
    
    // Return empty if sheet doesn't exist
    if (!sheet) {
      return { success: true, schedules: [] };
    }
    
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    const displayData = dataRange.getDisplayValues();
    
    // Return empty if only header row exists
    if (data.length <= 1) {
      return { success: true, schedules: [] };
    }
    
    const schedules = [];
    const today = getManilaDateString();
    const currentDayOfWeek = getManilaDayOfWeek();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const displayRow = displayData[i];
      
      const scheduleType = String(row[SCHEDULE_COL.TYPE]).trim();
      const scheduleSemester = String(row[SCHEDULE_COL.SEMESTER]).trim();
      
      // Apply filters
      if (semester && scheduleSemester && scheduleSemester !== semester) continue;
      if (type && scheduleType !== type) continue;
      
      // Check if schedule is active
      const isActive = row[SCHEDULE_COL.IS_ACTIVE] === true || 
                       row[SCHEDULE_COL.IS_ACTIVE] === 'TRUE' || 
                       String(row[SCHEDULE_COL.IS_ACTIVE]).toLowerCase() === 'true';
      if (!isActive) continue;
      
      // Parse times for display (use display values to preserve formatting)
      const startTimeDisplay = String(displayRow[SCHEDULE_COL.START_TIME] || '').trim();
      const endTimeDisplay = String(displayRow[SCHEDULE_COL.END_TIME] || '').trim();
      
      // Determine schedule status
      let status = 'scheduled';
      const specificDate = row[SCHEDULE_COL.SPECIFIC_DATE];
      
      if (scheduleType !== 'semestral' && specificDate) {
        // For non-semestral schedules, check date
        const scheduleDate = specificDate instanceof Date 
          ? Utilities.formatDate(specificDate, MANILA_TIMEZONE, 'yyyy-MM-dd')
          : String(specificDate);
        
        if (scheduleDate < today) {
          status = 'completed';
        } else if (scheduleDate === today) {
          status = 'today';
        } else {
          status = 'upcoming';
        }
      } else if (scheduleType === 'semestral') {
        // For semestral, check if it's today's class
        const scheduleDayOfWeek = String(row[SCHEDULE_COL.DAY_OF_WEEK]).trim();
        if (scheduleDayOfWeek === currentDayOfWeek) {
          status = 'today';
        }
      }
      
      // Get time strings and format for display
      const startTime24 = startTimeDisplay || '00:00';
      const endTime24 = endTimeDisplay || '';
      
      schedules.push({
        scheduleId: row[SCHEDULE_COL.SCHEDULE_ID],
        type: scheduleType,
        semester: scheduleSemester,
        courseCode: String(row[SCHEDULE_COL.COURSE_CODE]).trim(),
        courseName: String(row[SCHEDULE_COL.COURSE_NAME]).trim(),
        teacher: String(row[SCHEDULE_COL.TEACHER]).trim(),
        classroom: String(row[SCHEDULE_COL.CLASSROOM]).trim(),
        dayOfWeek: String(row[SCHEDULE_COL.DAY_OF_WEEK]).trim(),
        startTime: startTime24,
        endTime: endTime24,
        startTime12h: formatTime12Hour(startTime24),
        endTime12h: formatTime12Hour(endTime24),
        specificDate: specificDate instanceof Date 
          ? Utilities.formatDate(specificDate, MANILA_TIMEZONE, 'yyyy-MM-dd')
          : String(specificDate || ''),
        details: String(row[SCHEDULE_COL.DETAILS]).trim(),
        isActive: isActive,
        createdBy: String(row[SCHEDULE_COL.CREATED_BY]).trim(),
        createdByName: String(row[SCHEDULE_COL.CREATED_BY_NAME]).trim(),
        createdAt: row[SCHEDULE_COL.CREATED_AT],
        updatedAt: row[SCHEDULE_COL.UPDATED_AT],
        status: status
      });
    }
    
    // Sort schedules
    schedules.sort((a, b) => {
      // Semestral schedules first
      if (a.type === 'semestral' && b.type !== 'semestral') return -1;
      if (a.type !== 'semestral' && b.type === 'semestral') return 1;
      
      if (a.type === 'semestral' && b.type === 'semestral') {
        // Sort by day of week, then by start time
        const dayOrder = { 
          'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 
          'Friday': 5, 'Saturday': 6, 'Sunday': 7 
        };
        const dayDiff = (dayOrder[a.dayOfWeek] || 8) - (dayOrder[b.dayOfWeek] || 8);
        if (dayDiff !== 0) return dayDiff;
        return a.startTime.localeCompare(b.startTime);
      } else {
        // Sort non-semestral by date, then by time
        const dateDiff = (a.specificDate || '').localeCompare(b.specificDate || '');
        if (dateDiff !== 0) return dateDiff;
        return a.startTime.localeCompare(b.startTime);
      }
    });
    
    return { success: true, schedules };
    
  } catch (error) {
    return { error: 'Failed to get schedules: ' + error.message };
  }
}

/**
 * Get a single schedule by ID
 * @param {string} scheduleId - The schedule ID to find
 * @returns {Object} Result with schedule data or error
 */
function getScheduleById(scheduleId) {
  try {
    if (!scheduleId) {
      return { error: 'Missing scheduleId' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ClassSchedule');
    
    if (!sheet) {
      return { error: 'ClassSchedule sheet not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][SCHEDULE_COL.SCHEDULE_ID] === scheduleId) {
        const row = data[i];
        const startTime24 = String(row[SCHEDULE_COL.START_TIME]).trim();
        const endTime24 = String(row[SCHEDULE_COL.END_TIME]).trim();
        
        return {
          success: true,
          schedule: {
            scheduleId: row[SCHEDULE_COL.SCHEDULE_ID],
            type: String(row[SCHEDULE_COL.TYPE]).trim(),
            semester: String(row[SCHEDULE_COL.SEMESTER]).trim(),
            courseCode: String(row[SCHEDULE_COL.COURSE_CODE]).trim(),
            courseName: String(row[SCHEDULE_COL.COURSE_NAME]).trim(),
            teacher: String(row[SCHEDULE_COL.TEACHER]).trim(),
            classroom: String(row[SCHEDULE_COL.CLASSROOM]).trim(),
            dayOfWeek: String(row[SCHEDULE_COL.DAY_OF_WEEK]).trim(),
            startTime: startTime24,
            endTime: endTime24,
            startTime12h: formatTime12Hour(startTime24),
            endTime12h: formatTime12Hour(endTime24),
            specificDate: row[SCHEDULE_COL.SPECIFIC_DATE] instanceof Date 
              ? Utilities.formatDate(row[SCHEDULE_COL.SPECIFIC_DATE], MANILA_TIMEZONE, 'yyyy-MM-dd')
              : String(row[SCHEDULE_COL.SPECIFIC_DATE] || ''),
            details: String(row[SCHEDULE_COL.DETAILS]).trim(),
            isActive: row[SCHEDULE_COL.IS_ACTIVE] === true || 
                      String(row[SCHEDULE_COL.IS_ACTIVE]).toLowerCase() === 'true',
            createdBy: String(row[SCHEDULE_COL.CREATED_BY]).trim(),
            createdByName: String(row[SCHEDULE_COL.CREATED_BY_NAME]).trim(),
            createdAt: row[SCHEDULE_COL.CREATED_AT],
            updatedAt: row[SCHEDULE_COL.UPDATED_AT]
          }
        };
      }
    }
    
    return { error: 'Schedule not found' };
    
  } catch (error) {
    return { error: 'Failed to get schedule: ' + error.message };
  }
}

// =====================================================
// CRUD OPERATIONS - UPDATE
// =====================================================

/**
 * Update an existing class schedule
 * @param {Object} data - Schedule data with scheduleId
 * @returns {Object} Result with success status
 */
function updateClassSchedule(data) {
  try {
    const { scheduleId, userId } = data;
    
    if (!scheduleId) {
      return { error: 'Missing scheduleId' };
    }
    
    // Validate permission
    if (!canManageSchedules(userId)) {
      return { 
        error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage schedules.' 
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ClassSchedule');
    
    if (!sheet) {
      return { error: 'ClassSchedule sheet not found' };
    }
    
    const sheetData = sheet.getDataRange().getValues();
    
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][SCHEDULE_COL.SCHEDULE_ID] === scheduleId) {
        const now = getManilaTimestamp();
        
        // Check if trying to update semestral schedule
        const currentType = String(sheetData[i][SCHEDULE_COL.TYPE]).trim();
        const newType = String(data.type || currentType).trim();
        const requiresCourse = scheduleTypeRequiresCourse(newType);
        
        if ((currentType === 'semestral' || newType === 'semestral') && !canManageSemestral(userId)) {
          return { 
            error: 'Unauthorized. Only Mayor, Vice Mayor, or Secretary can modify semestral schedules.' 
          };
        }
        
        // Update fields if provided (row is 1-indexed, column is 1-indexed)
        const rowIndex = i + 1;
        const nextCourseCode = normalizeCourseCode(data.courseCode !== undefined ? data.courseCode : sheetData[i][SCHEDULE_COL.COURSE_CODE]);
        const nextCourseName = String(data.courseName !== undefined ? data.courseName : sheetData[i][SCHEDULE_COL.COURSE_NAME] || '').trim();

        if (requiresCourse && !nextCourseCode) {
          return { error: 'Semestral schedules require a course code' };
        }

        let savedCourseName = nextCourseName;
        if (nextCourseCode) {
          const courseResult = ensureCourseExists(
            nextCourseCode,
            nextCourseName,
            userId,
            data.userName || sheetData[i][SCHEDULE_COL.CREATED_BY_NAME]
          );
          
          if (!courseResult.success) {
            return { error: courseResult.error || 'Failed to save course' };
          }

          savedCourseName = courseResult.course.name;
        }
        
        if (data.type !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.TYPE + 1).setValue(newType);
        if (data.semester !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.SEMESTER + 1).setValue(data.semester);
        if (data.courseCode !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.COURSE_CODE + 1).setValue(nextCourseCode);
        if (data.courseCode !== undefined || data.courseName !== undefined)
          sheet.getRange(rowIndex, SCHEDULE_COL.COURSE_NAME + 1).setValue(savedCourseName);
        if (data.teacher !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.TEACHER + 1).setValue(data.teacher);
        if (data.classroom !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.CLASSROOM + 1).setValue(data.classroom);
        if (data.dayOfWeek !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.DAY_OF_WEEK + 1).setValue(data.dayOfWeek);
        if (data.startTime !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.START_TIME + 1).setValue(data.startTime);
        if (data.endTime !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.END_TIME + 1).setValue(data.endTime);
        if (data.specificDate !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.SPECIFIC_DATE + 1).setValue(data.specificDate);
        if (data.details !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.DETAILS + 1).setValue(data.details);
        if (data.isActive !== undefined) 
          sheet.getRange(rowIndex, SCHEDULE_COL.IS_ACTIVE + 1).setValue(data.isActive);
        
        // Always update the updatedAt timestamp
        sheet.getRange(rowIndex, SCHEDULE_COL.UPDATED_AT + 1).setValue(now);
        
        return { 
          success: true, 
          message: 'Schedule updated successfully',
          updatedAt: now
        };
      }
    }
    
    return { error: 'Schedule not found' };
    
  } catch (error) {
    return { error: 'Failed to update schedule: ' + error.message };
  }
}

// =====================================================
// CRUD OPERATIONS - DELETE
// =====================================================

/**
 * Delete a class schedule
 * @param {string} scheduleId - Schedule ID to delete
 * @param {string} userId - User requesting deletion
 * @returns {Object} Result with success status
 */
function deleteClassSchedule(scheduleId, userId) {
  try {
    if (!scheduleId) {
      return { error: 'Missing scheduleId' };
    }
    
    // Validate permission
    if (!canManageSchedules(userId)) {
      return { 
        error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage schedules.' 
      };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ClassSchedule');
    
    if (!sheet) {
      return { error: 'ClassSchedule sheet not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][SCHEDULE_COL.SCHEDULE_ID] === scheduleId) {
        // Check if trying to delete semestral schedule
        const scheduleType = String(data[i][SCHEDULE_COL.TYPE]).trim();
        
        if (scheduleType === 'semestral' && !canManageSemestral(userId)) {
          return { 
            error: 'Unauthorized. Only Mayor, Vice Mayor, or Secretary can delete semestral schedules.' 
          };
        }
        
        // Delete the row (row index is 1-based)
        sheet.deleteRow(i + 1);
        
        return { 
          success: true, 
          message: 'Schedule deleted successfully' 
        };
      }
    }
    
    return { error: 'Schedule not found' };
    
  } catch (error) {
    return { error: 'Failed to delete schedule: ' + error.message };
  }
}

function getOrCreateObligationsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Obligations');

  if (!sheet) {
    setupObligationsSheet();
    sheet = ss.getSheetByName('Obligations');
  }

  return sheet;
}

function parseObligationDateValue(dateValue) {
  if (dateValue instanceof Date) {
    return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  }

  const rawDate = String(dateValue || '').trim();
  if (!rawDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const dateParts = rawDate.split('-').map(Number);
    return new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  }

  const parsed = new Date(rawDate);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getObligationStatus(dateValue, endDateValue, startTime, endTime) {
  const now = getManilaDate();
  const obligationDate = parseObligationDateValue(dateValue);
  if (!obligationDate) return 'upcoming';
  const obligationEndDate = parseObligationDateValue(endDateValue) || new Date(obligationDate);

  const normalizedStartTime = normalizeTimeValue(startTime) || '00:00';
  const normalizedEndTime = normalizeTimeValue(endTime) || '23:59';
  const [startHour, startMinute] = normalizedStartTime.split(':').map(Number);
  const [endHour, endMinute] = normalizedEndTime.split(':').map(Number);

  const startDateTime = new Date(obligationDate);
  startDateTime.setHours(startHour || 0, startMinute || 0, 0, 0);

  const endDateTime = new Date(obligationEndDate);
  endDateTime.setHours(endHour || 23, endMinute || 59, 59, 999);

  if (endDateTime.getTime() <= startDateTime.getTime()) {
    endDateTime.setHours(23, 59, 59, 999);
  }

  if (now.getTime() < startDateTime.getTime()) return 'upcoming';
  if (now.getTime() <= endDateTime.getTime()) return 'ongoing';
  return 'done';
}

function mapObligationRow(row, displayRow) {
  const rawDate = row[OBLIGATION_COL.DATE];
  const rawEndDate = row[OBLIGATION_COL.END_DATE];
  const startTime = normalizeTimeValue(displayRow[OBLIGATION_COL.START_TIME] || row[OBLIGATION_COL.START_TIME]);
  const endTime = normalizeTimeValue(displayRow[OBLIGATION_COL.END_TIME] || row[OBLIGATION_COL.END_TIME]);
  const date = rawDate instanceof Date
    ? Utilities.formatDate(rawDate, MANILA_TIMEZONE, 'yyyy-MM-dd')
    : String(rawDate || '').trim();
  const endDate = rawEndDate instanceof Date
    ? Utilities.formatDate(rawEndDate, MANILA_TIMEZONE, 'yyyy-MM-dd')
    : String(rawEndDate || '').trim() || date;

  return {
    examId: String(row[OBLIGATION_COL.OBLIGATION_ID] || '').trim(),
    obligationId: String(row[OBLIGATION_COL.OBLIGATION_ID] || '').trim(),
    courseCode: normalizeCourseCode(row[OBLIGATION_COL.COURSE_CODE]),
    courseName: String(row[OBLIGATION_COL.COURSE_NAME] || '').trim(),
    examType: String(row[OBLIGATION_COL.CATEGORY] || '').trim() || 'Obligation',
    obligationType: String(row[OBLIGATION_COL.CATEGORY] || '').trim() || 'Obligation',
    date: date,
    endDate: endDate,
    startTime: startTime,
    endTime: endTime,
    room: String(row[OBLIGATION_COL.LOCATION] || '').trim(),
    location: String(row[OBLIGATION_COL.LOCATION] || '').trim(),
    proctor: String(row[OBLIGATION_COL.FACILITATOR] || '').trim(),
    facilitator: String(row[OBLIGATION_COL.FACILITATOR] || '').trim(),
    notes: String(row[OBLIGATION_COL.NOTES] || '').trim(),
    createdBy: String(row[OBLIGATION_COL.CREATED_BY] || '').trim(),
    createdByName: String(row[OBLIGATION_COL.CREATED_BY_NAME] || '').trim(),
    createdAt: String(row[OBLIGATION_COL.CREATED_AT] || ''),
    updatedAt: String(row[OBLIGATION_COL.UPDATED_AT] || ''),
    status: getObligationStatus(rawDate, rawEndDate || rawDate, startTime, endTime)
  };
}

function getObligations(subject) {
  try {
    const sheet = getOrCreateObligationsSheet();
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    const displayData = dataRange.getDisplayValues();

    if (data.length <= 1) {
      return { success: true, obligations: [], exams: [] };
    }

    const obligations = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!isTruthy(row[OBLIGATION_COL.IS_ACTIVE])) continue;

      const courseCode = normalizeCourseCode(row[OBLIGATION_COL.COURSE_CODE]);
      if (subject && courseCode && courseCode !== normalizeCourseCode(subject)) continue;

      obligations.push(mapObligationRow(row, displayData[i]));
    }

    obligations.sort(function(a, b) {
      const statusOrder = { ongoing: 0, upcoming: 1, done: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return new Date(a.date + 'T' + (a.startTime || '00:00')).getTime() -
        new Date(b.date + 'T' + (b.startTime || '00:00')).getTime();
    });

    return { success: true, obligations: obligations, exams: obligations };
  } catch (error) {
    return { error: 'Failed to get obligations: ' + error.message };
  }
}

function addObligation(data) {
  try {
    const category = String(data.examType || data.obligationType || data.category || '').trim();
    const userId = data.userId;
    const userName = data.userName;
    const courseCode = normalizeCourseCode(data.courseCode);
    const courseName = String(data.courseName || '').trim();

    if (!canManageSchedules(userId)) {
      return { error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage obligations.' };
    }

    if (isRestrictedObligationCategory(category) && !canManageRestrictedObligations(userId)) {
      return { error: 'Unauthorized. Only Mayor, Vice Mayor, or Secretary can add exam-type obligations.' };
    }

    if (!category || !data.date) {
      return { error: 'Missing required fields (category, date)' };
    }

    const sheet = getOrCreateObligationsSheet();
    if (!courseCode && !courseName) {
      return { error: 'Add either a course code or an event name' };
    }

    let resolvedCourseName = courseName;
    if (courseCode) {
      const courseResult = ensureCourseExists(courseCode, data.courseName, userId, userName);
      if (!courseResult.success) {
        return { error: courseResult.error || 'Failed to save course' };
      }
      resolvedCourseName = courseResult.course.name;
    }

    const obligationId = 'OBL-' + Date.now();
    const now = getManilaTimestamp();
    const dateValue = String(data.date || '').trim();
    const endDateValue = String(data.endDate || '').trim();
    const startTime = normalizeTimeValue(data.startTime);
    const endTime = normalizeTimeValue(data.endTime);
    const location = String(data.room || data.location || '').trim();
    const facilitator = String(data.proctor || data.facilitator || '').trim();
    const notes = String(data.notes || '').trim();

    if (endDateValue && endDateValue < dateValue) {
      return { error: 'End date must be on or after the start date' };
    }

    sheet.appendRow([
      obligationId,
      courseCode,
      resolvedCourseName,
      category,
      dateValue,
      startTime,
      endTime,
      location,
      facilitator,
      notes,
      true,
      userId,
      userName || '',
      now,
      now,
      endDateValue
    ]);

    return {
      success: true,
      message: 'Obligation added',
      obligation: mapObligationRow([
        obligationId,
        courseCode,
        resolvedCourseName,
        category,
        dateValue,
        startTime,
        endTime,
        location,
        facilitator,
        notes,
        true,
        userId,
        userName || '',
        now,
        now,
        endDateValue
      ], [
        obligationId,
        courseCode,
        resolvedCourseName,
        category,
        dateValue,
        startTime,
        endTime,
        location,
        facilitator,
        notes,
        'TRUE',
        userId,
        userName || '',
        now,
        now,
        endDateValue
      ])
    };
  } catch (error) {
    return { error: 'Failed to add obligation: ' + error.message };
  }
}

function updateObligation(data) {
  try {
    const obligationId = String(data.obligationId || data.examId || '').trim();
    const userId = data.userId;

    if (!obligationId) {
      return { error: 'Missing obligationId' };
    }

    if (!canManageSchedules(userId)) {
      return { error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage obligations.' };
    }

    const sheet = getOrCreateObligationsSheet();
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][OBLIGATION_COL.OBLIGATION_ID]) !== obligationId) continue;

      if (userId && String(values[i][OBLIGATION_COL.CREATED_BY]) !== String(userId)) {
        return { error: 'You can only edit obligations you created' };
      }

      const nextCategory = String(
        data.examType !== undefined ? data.examType :
        data.obligationType !== undefined ? data.obligationType :
        data.category !== undefined ? data.category :
        values[i][OBLIGATION_COL.CATEGORY]
      ).trim();

      if (isRestrictedObligationCategory(nextCategory) && !canManageRestrictedObligations(userId)) {
        return { error: 'Unauthorized. Only Mayor, Vice Mayor, or Secretary can manage exam-type obligations.' };
      }

      const rowIndex = i + 1;
      const nextCourseCode = data.courseCode !== undefined ? normalizeCourseCode(data.courseCode) : normalizeCourseCode(values[i][OBLIGATION_COL.COURSE_CODE]);
      const nextCourseName = String(data.courseName !== undefined ? data.courseName : values[i][OBLIGATION_COL.COURSE_NAME] || '').trim();
      if (!nextCourseCode && !nextCourseName) {
        return { error: 'Add either a course code or an event name' };
      }

      let resolvedCourseName = nextCourseName;
      if (nextCourseCode) {
        const courseResult = ensureCourseExists(
          nextCourseCode,
          nextCourseName,
          userId,
          data.userName || values[i][OBLIGATION_COL.CREATED_BY_NAME]
        );

        if (!courseResult.success) {
          return { error: courseResult.error || 'Failed to save course' };
        }

        resolvedCourseName = courseResult.course.name;
      }

      const nextDate = String(data.date !== undefined ? data.date : values[i][OBLIGATION_COL.DATE] || '').trim();
      const nextEndDate = String(data.endDate !== undefined ? data.endDate : values[i][OBLIGATION_COL.END_DATE] || '').trim();
      if (nextEndDate && nextEndDate < nextDate) {
        return { error: 'End date must be on or after the start date' };
      }

      if (data.courseCode !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.COURSE_CODE + 1).setValue(nextCourseCode);
      if (data.courseCode !== undefined || data.courseName !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.COURSE_NAME + 1).setValue(resolvedCourseName);
      if (data.examType !== undefined || data.obligationType !== undefined || data.category !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.CATEGORY + 1).setValue(nextCategory);
      if (data.date !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.DATE + 1).setValue(String(data.date || '').trim());
      if (data.endDate !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.END_DATE + 1).setValue(String(data.endDate || '').trim());
      if (data.startTime !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.START_TIME + 1).setValue(normalizeTimeValue(data.startTime));
      if (data.endTime !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.END_TIME + 1).setValue(normalizeTimeValue(data.endTime));
      if (data.room !== undefined || data.location !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.LOCATION + 1).setValue(String(data.room !== undefined ? data.room : data.location || '').trim());
      if (data.proctor !== undefined || data.facilitator !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.FACILITATOR + 1).setValue(String(data.proctor !== undefined ? data.proctor : data.facilitator || '').trim());
      if (data.notes !== undefined) sheet.getRange(rowIndex, OBLIGATION_COL.NOTES + 1).setValue(String(data.notes || '').trim());
      sheet.getRange(rowIndex, OBLIGATION_COL.UPDATED_AT + 1).setValue(getManilaTimestamp());

      return { success: true, message: 'Obligation updated' };
    }

    return { error: 'Obligation not found' };
  } catch (error) {
    return { error: 'Failed to update obligation: ' + error.message };
  }
}

function deleteObligation(obligationId, userId) {
  try {
    if (!obligationId) {
      return { error: 'Missing obligationId' };
    }

    const sheet = getOrCreateObligationsSheet();
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][OBLIGATION_COL.OBLIGATION_ID]) !== String(obligationId)) continue;

      if (userId && String(values[i][OBLIGATION_COL.CREATED_BY]) !== String(userId)) {
        return { error: 'You can only delete obligations you created' };
      }

      sheet.getRange(i + 1, OBLIGATION_COL.IS_ACTIVE + 1).setValue(false);
      sheet.getRange(i + 1, OBLIGATION_COL.UPDATED_AT + 1).setValue(getManilaTimestamp());
      return { success: true, message: 'Obligation deleted' };
    }

    return { error: 'Obligation not found' };
  } catch (error) {
    return { error: 'Failed to delete obligation: ' + error.message };
  }
}

// =====================================================
// SEMESTER CONFIGURATION
// =====================================================

/**
 * Get semester configuration
 * @returns {Object} Result with semesters array
 */
function getSemesterConfig() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('SemesterConfig');
    
    if (!sheet) {
      // Return defaults if sheet doesn't exist
      return {
        success: true,
        semesters: [
          { semester: '1st', startDate: '', endDate: '', academicYear: '', isActive: true },
          { semester: '2nd', startDate: '', endDate: '', academicYear: '', isActive: true }
        ]
      };
    }
    
    const data = sheet.getDataRange().getValues();
    const semesters = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {
        semesters.push({
          semester: String(row[0]).trim(),
          startDate: row[1] instanceof Date ? Utilities.formatDate(row[1], MANILA_TIMEZONE, 'yyyy-MM-dd') : String(row[1] || ''),
          endDate: row[2] instanceof Date ? Utilities.formatDate(row[2], MANILA_TIMEZONE, 'yyyy-MM-dd') : String(row[2] || ''),
          academicYear: String(row[3] || '').trim(),
          isActive: row[4] === true || row[4] === 'TRUE' || String(row[4]).toLowerCase() === 'true'
        });
      }
    }
    
    return { success: true, semesters };
    
  } catch (error) {
    return { error: 'Failed to get semester config: ' + error.message };
  }
}

/**
 * Update semester configuration
 * Accepts two formats:
 * 1. { config: { firstSemesterStart, firstSemesterEnd, secondSemesterStart, secondSemesterEnd, academicYear } }
 * 2. { semesters: [{ semester, startDate, endDate, academicYear, isActive }] }
 * 
 * @param {Object} data - Configuration data
 * @returns {Object} Result with success status
 */
function updateSemesterConfig(data) {
  try {
    const { userId, config, semesters } = data;
    
    // Check permission
    if (!canManageSchedules(userId) && String(userId) !== ADMIN_USER_ID) {
      return { error: 'Unauthorized. Only officers can update semester config.' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('SemesterConfig');
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('SemesterConfig');
      sheet.appendRow(['Semester', 'StartDate', 'EndDate', 'AcademicYear', 'IsActive']);
      sheet.setFrozenRows(1);
    }
    
    // Clear existing data (except header)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    }
    
    // Handle the config object format (from frontend)
    if (config) {
      const { 
        firstSemesterStart, 
        firstSemesterEnd, 
        secondSemesterStart, 
        secondSemesterEnd, 
        academicYear 
      } = config;
      
      // Determine which semester is currently active based on today's date
      const today = getManilaDateString();
      let currentSemester = '1st';
      
      if (secondSemesterStart && secondSemesterEnd) {
        if (today >= secondSemesterStart && today <= secondSemesterEnd) {
          currentSemester = '2nd';
        }
      }
      
      // Add 1st semester
      sheet.getRange(2, 1, 1, 5).setValues([[
        '1st',
        firstSemesterStart || '',
        firstSemesterEnd || '',
        academicYear || '',
        true
      ]]);
      
      // Add 2nd semester
      sheet.getRange(3, 1, 1, 5).setValues([[
        '2nd',
        secondSemesterStart || '',
        secondSemesterEnd || '',
        academicYear || '',
        true
      ]]);
      
      return { 
        success: true, 
        message: 'Semester config updated',
        currentSemester: currentSemester
      };
    }
    
    // Handle the semesters array format
    if (semesters && Array.isArray(semesters)) {
      semesters.forEach((sem, idx) => {
        sheet.getRange(idx + 2, 1, 1, 5).setValues([[
          sem.semester,
          sem.startDate || '',
          sem.endDate || '',
          sem.academicYear || '',
          sem.isActive !== false
        ]]);
      });
      
      return { success: true, message: 'Semester config updated' };
    }
    
    return { error: 'Invalid configuration format. Provide either config or semesters.' };
    
  } catch (error) {
    return { error: 'Failed to update semester config: ' + error.message };
  }
}

/**
 * Get current semester based on today's date
 * @returns {Object} Current semester information
 */
function getCurrentSemester() {
  try {
    const configResult = getSemesterConfig();
    
    if (!configResult.success || !configResult.semesters || configResult.semesters.length === 0) {
      return { 
        success: true, 
        currentSemester: '1st', 
        academicYear: '' 
      };
    }
    
    const todayStr = getManilaDateString();
    
    // Find the semester that includes today
    for (const sem of configResult.semesters) {
      if (!sem.isActive) continue;
      
      const startDate = sem.startDate;
      const endDate = sem.endDate;
      
      if (startDate && endDate && todayStr >= startDate && todayStr <= endDate) {
        return {
          success: true,
          currentSemester: sem.semester,
          academicYear: sem.academicYear,
          startDate: sem.startDate,
          endDate: sem.endDate
        };
      }
    }
    
    // If no active semester found, check for upcoming or most recent
    const sortedSemesters = configResult.semesters
      .filter(s => s.isActive && s.startDate)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    
    if (sortedSemesters.length > 0) {
      // Find the closest past semester
      for (const sem of sortedSemesters) {
        if (sem.startDate <= todayStr) {
          return {
            success: true,
            currentSemester: sem.semester,
            academicYear: sem.academicYear,
            startDate: sem.startDate,
            endDate: sem.endDate
          };
        }
      }
      
      // Find the next upcoming semester
      const upcoming = configResult.semesters
        .filter(s => s.isActive && s.startDate && s.startDate > todayStr)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
      
      if (upcoming.length > 0) {
        return {
          success: true,
          currentSemester: upcoming[0].semester,
          academicYear: upcoming[0].academicYear,
          startDate: upcoming[0].startDate,
          endDate: upcoming[0].endDate
        };
      }
    }
    
    // Default fallback
    return { 
      success: true, 
      currentSemester: '1st', 
      academicYear: '' 
    };
    
  } catch (error) {
    return { 
      success: true, 
      currentSemester: '1st', 
      academicYear: '' 
    };
  }
}

// =====================================================
// SEMESTER SUBJECT FILTERING
// =====================================================

/**
 * Get subjects filtered by semester
 * Returns unique course codes from the class schedules for the given semester
 * @param {string} semester - Semester to filter by (1st or 2nd)
 * @returns {Object} Result with subjects array
 */
function getSubjectsBySemester(semester) {
  try {
    const result = getCourses(semester);
    
    if (!result.success) {
      return { success: true, subjects: [], noSchedules: true };
    }
    
    return {
      success: true,
      subjects: result.subjects || [],
      noSchedules: (result.subjects || []).length === 0
    };
    
  } catch (error) {
    return { error: 'Failed to get subjects by semester: ' + error.message };
  }
}

/**
 * Get all unique subjects from all schedules
 * @returns {Object} Result with all subjects
 */
function getAllSubjects() {
  try {
    const result = getCourses();
    
    if (!result.success) {
      return { success: true, subjects: [] };
    }
    
    return { success: true, subjects: result.subjects || [] };
    
  } catch (error) {
    return { error: 'Failed to get all subjects: ' + error.message };
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Show all schedules in a dialog (for debugging)
 */
function showAllSchedules() {
  const result = getClassSchedules();
  
  if (!result.success) {
    SpreadsheetApp.getUi().alert('Error: ' + result.error);
    return;
  }
  
  let message = 'Total Schedules: ' + result.schedules.length + '\n\n';
  
  result.schedules.forEach((s, i) => {
    message += `${i + 1}. ${s.courseCode} - ${s.courseName}\n`;
    message += `   Type: ${s.type}, Day: ${s.dayOfWeek || s.specificDate}\n`;
    message += `   Time: ${s.startTime} - ${s.endTime}\n\n`;
  });
  
  SpreadsheetApp.getUi().alert(message);
}

/**
 * Get schedules for a specific day of the week
 * @param {string} dayOfWeek - Day name (Monday, Tuesday, etc.)
 * @param {string} semester - Optional semester filter
 * @returns {Object} Result with schedules for that day
 */
function getSchedulesForDay(dayOfWeek, semester) {
  try {
    const result = getClassSchedules(semester, 'semestral');
    
    if (!result.success) {
      return result;
    }
    
    const daySchedules = result.schedules.filter(s => 
      s.dayOfWeek.toLowerCase() === dayOfWeek.toLowerCase()
    );
    
    return { success: true, schedules: daySchedules };
    
  } catch (error) {
    return { error: 'Failed to get schedules for day: ' + error.message };
  }
}

/**
 * Get today's schedules (both semestral for today's day and special for today's date)
 * @returns {Object} Result with today's schedules
 */
function getTodaySchedules() {
  try {
    const today = getManilaDateString();
    const currentDayOfWeek = getManilaDayOfWeek();
    
    const result = getClassSchedules();
    
    if (!result.success) {
      return result;
    }
    
    const todaySchedules = result.schedules.filter(s => {
      if (s.type === 'semestral') {
        return s.dayOfWeek === currentDayOfWeek;
      } else {
        return s.specificDate === today;
      }
    });
    
    // Sort by start time
    todaySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    return { 
      success: true, 
      schedules: todaySchedules,
      date: today,
      dayOfWeek: currentDayOfWeek
    };
    
  } catch (error) {
    return { error: 'Failed to get today\'s schedules: ' + error.message };
  }
}

/**
 * Batch add multiple schedules at once
 * @param {Object} data - Contains schedules array and userId
 * @returns {Object} Result with added schedules
 */
function batchAddSchedules(data) {
  try {
    const { schedules, userId, userName } = data;
    
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return { error: 'No schedules provided' };
    }
    
    // Validate permission once
    if (!canManageSchedules(userId)) {
      return { 
        error: 'Unauthorized. Only Mayor, Vice Mayor, Secretary, or PIOs can manage schedules.' 
      };
    }
    
    const results = [];
    const errors = [];
    
    for (const schedule of schedules) {
      const result = addClassSchedule({
        ...schedule,
        userId,
        userName
      });
      
      if (result.success) {
        results.push(result.schedule);
      } else {
        errors.push({
          schedule: schedule.courseCode,
          error: result.error
        });
      }
    }
    
    return {
      success: true,
      added: results.length,
      failed: errors.length,
      schedules: results,
      errors: errors
    };
    
  } catch (error) {
    return { error: 'Failed to batch add schedules: ' + error.message };
  }
}

/**
 * Clear all schedules (admin only)
 * @param {string} userId - Admin user ID
 * @param {string} type - Optional: Only clear specific type
 * @returns {Object} Result with count of deleted schedules
 */
function clearAllSchedules(userId, type) {
  try {
    if (String(userId) !== ADMIN_USER_ID) {
      return { error: 'Unauthorized. Only admin can clear all schedules.' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ClassSchedule');
    
    if (!sheet) {
      return { success: true, deleted: 0 };
    }
    
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return { success: true, deleted: 0 };
    }
    
    if (type) {
      // Delete only schedules of specific type
      const data = sheet.getDataRange().getValues();
      let deleted = 0;
      
      // Go backwards to avoid index shifting issues
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][SCHEDULE_COL.TYPE]).trim() === type) {
          sheet.deleteRow(i + 1);
          deleted++;
        }
      }
      
      return { success: true, deleted };
    } else {
      // Delete all data rows
      const deleted = lastRow - 1;
      sheet.deleteRows(2, lastRow - 1);
      return { success: true, deleted };
    }
    
  } catch (error) {
    return { error: 'Failed to clear schedules: ' + error.message };
  }
}
