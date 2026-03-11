/**
 * 1SF Directory - Student Faculty Backend System
 * Clean Authentication & Profile Management Backend
 * 
 * PRIMARY KEY: idNumber (Student/Employee ID - format: YYYY-NNNNN)
 * 
 * GOOGLE DRIVE FOLDER IDs:
 */

const DRIVE_FOLDERS = {
  'ProfilePictures': '1jjt7qyCuCKBwq8QyzSPMK16YkB6HA6rb',
  'QRCodes': '1I7KknPvf5hupEKDhpB8iAaa07kPCIOo2',
  'DigitalSignatures': '1st3shhcwythK_nC9N874wjLl5krDfR98'
};

/**
 * SPREADSHEET STRUCTURE (Cleaned - 27 columns):
 * 
 * Sheet: "UserAccounts"
 * Columns:
 * A: idNumber (PRIMARY KEY - Student/Employee ID)
 * B: username
 * C: passwordHash (encrypted password - NEVER store plain text!)
 * D: passwordSalt (random data for unique hashes - security essential)
 * E: firstName
 * F: lastName
 * G: email (personal)
 * H: emailVerified
 * I: schoolEmail
 * J: schoolEmailVerified
 * K: birthday
 * L: profilePictureFileId (URL derived via getFileUrl())
 * M: digitalSignatureFileId (URL derived via getFileUrl())
 * N: qrCodeValue (encrypted)
 * O: school
 * P: college
 * Q: program
 * R: major
 * S: year
 * T: section
 * U: role (student/faculty/admin)
 * V: position (Mayor, Vice Mayor, Secretary, etc.)
 * W: loginAttempts
 * X: accountLocked
 * Y: lockedUntil
 * Z: createdDate
 * AA: lastLogin
 * 
 * Sheet: "EmailVerifications"
 * Columns:
 * A: verificationId (UUID)
 * B: idNumber (references UserAccounts)
 * C: email
 * D: emailType (personal/school)
 * E: otpHash (no plaintext storage)
 * F: createdAt
 * G: expiresAt
 * H: attempts
 * I: isVerified
 * J: verifiedAt
 * K: failedAttempts
 * L: lockedUntil
 */

// Column index constants for UserAccounts (0-based)
const COL = {
  ID_NUMBER: 0,
  USERNAME: 1,
  PASSWORD_HASH: 2,
  PASSWORD_SALT: 3,
  FIRST_NAME: 4,
  LAST_NAME: 5,
  EMAIL: 6,
  EMAIL_VERIFIED: 7,
  SCHOOL_EMAIL: 8,
  SCHOOL_EMAIL_VERIFIED: 9,
  BIRTHDAY: 10,
  PROFILE_PIC_FILE_ID: 11,
  PROFILE_PICTURE_FILE_ID: 11,  // Alias for compatibility
  SIGNATURE_FILE_ID: 12,
  DIGITAL_SIGNATURE_FILE_ID: 12,  // Alias for compatibility
  QR_CODE_VALUE: 13,
  SCHOOL: 14,
  COLLEGE: 15,
  PROGRAM: 16,
  MAJOR: 17,
  YEAR: 18,
  SECTION: 19,
  ROLE: 20,
  POSITION: 21,
  LOGIN_ATTEMPTS: 22,
  ACCOUNT_LOCKED: 23,
  LOCKED_UNTIL: 24,
  CREATED_DATE: 25,
  LAST_LOGIN: 26
};

const GROUP_SHEETS = {
  GROUPS: 'CourseGroups',
  MEMBERS: 'CourseGroupMembers',
  REQUESTS: 'CourseGroupRequests',
  ASSIGNMENTS: 'CourseGroupAssignments'
};

const COURSE_GROUP_HEADERS = [
  'groupId', 'courseCode', 'groupName', 'task', 'deadline', 'description', 'isPermanent',
  'classKey', 'school', 'college', 'program', 'major', 'year', 'section',
  'teamLeaderIds', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'isDisbanded'
];

const COURSE_GROUP_COL = {
  GROUP_ID: 0,
  COURSE_CODE: 1,
  GROUP_NAME: 2,
  TASK: 3,
  DEADLINE: 4,
  DESCRIPTION: 5,
  IS_PERMANENT: 6,
  CLASS_KEY: 7,
  SCHOOL: 8,
  COLLEGE: 9,
  PROGRAM: 10,
  MAJOR: 11,
  YEAR: 12,
  SECTION: 13,
  TEAM_LEADER_IDS: 14,
  CREATED_BY: 15,
  CREATED_AT: 16,
  UPDATED_BY: 17,
  UPDATED_AT: 18,
  IS_DISBANDED: 19
};

const COURSE_GROUP_MEMBER_HEADERS = [
  'membershipId', 'groupId', 'courseCode', 'memberId', 'memberName',
  'joinedAt', 'addedBy', 'status', 'leftAt', 'removedBy', 'note'
];

const COURSE_GROUP_MEMBER_COL = {
  MEMBERSHIP_ID: 0,
  GROUP_ID: 1,
  COURSE_CODE: 2,
  MEMBER_ID: 3,
  MEMBER_NAME: 4,
  JOINED_AT: 5,
  ADDED_BY: 6,
  STATUS: 7,
  LEFT_AT: 8,
  REMOVED_BY: 9,
  NOTE: 10
};

const COURSE_GROUP_REQUEST_HEADERS = [
  'requestId', 'courseCode', 'requestType', 'groupId', 'sourceGroupId',
  'targetMemberId', 'targetMemberName', 'requestedBy', 'requestedAt',
  'status', 'approverId', 'approvedAt', 'reason', 'metadataJson'
];

const COURSE_GROUP_REQUEST_COL = {
  REQUEST_ID: 0,
  COURSE_CODE: 1,
  REQUEST_TYPE: 2,
  GROUP_ID: 3,
  SOURCE_GROUP_ID: 4,
  TARGET_MEMBER_ID: 5,
  TARGET_MEMBER_NAME: 6,
  REQUESTED_BY: 7,
  REQUESTED_AT: 8,
  STATUS: 9,
  APPROVER_ID: 10,
  APPROVED_AT: 11,
  REASON: 12,
  METADATA_JSON: 13
};

const COURSE_GROUP_ASSIGNMENT_HEADERS = [
  'assignmentId', 'groupId', 'courseCode', 'title', 'description', 'deadline',
  'assignedToMemberId', 'assignedToMemberName', 'assignedBy', 'createdAt',
  'updatedAt', 'status', 'isDeleted'
];

const COURSE_GROUP_ASSIGNMENT_COL = {
  ASSIGNMENT_ID: 0,
  GROUP_ID: 1,
  COURSE_CODE: 2,
  TITLE: 3,
  DESCRIPTION: 4,
  DEADLINE: 5,
  ASSIGNED_TO_MEMBER_ID: 6,
  ASSIGNED_TO_MEMBER_NAME: 7,
  ASSIGNED_BY: 8,
  CREATED_AT: 9,
  UPDATED_AT: 10,
  STATUS: 11,
  IS_DELETED: 12
};

const COURSE_GROUP_MANAGER_POSITIONS = ['mayor', 'vice mayor', 'secretary'];
const COURSE_GROUP_OFFICER_POSITIONS = ['mayor', 'vice mayor', 'secretary', 'assistant secretary'];

/**
 * Generate Google Drive direct URL from fileId
 */
function getFileUrl(fileId) {
  if (!fileId) return '';
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

function generateSessionToken() {
  const raw = Utilities.getUuid() + '|' + new Date().toISOString() + '|' + Math.random();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function storeSessionToken(idNumber) {
  const token = generateSessionToken();
  CacheService.getScriptCache().put(`session:${token}`, String(idNumber), 21600);
  return token;
}

function getIdNumberFromSessionToken(sessionToken) {
  if (!sessionToken) return '';
  return CacheService.getScriptCache().get(`session:${sessionToken}`) || '';
}

const CACHE_VERSION_PROPERTY_KEY = 'CACHE_VERSION';

function getStoredCacheVersion() {
  const props = PropertiesService.getScriptProperties();
  const rawVersion = props.getProperty(CACHE_VERSION_PROPERTY_KEY);
  const parsedVersion = parseInt(rawVersion || '1', 10);
  return Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 1;
}

function getUserAccountRowById(userSheet, idNumber) {
  if (!idNumber) return null;

  const data = userSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.ID_NUMBER]) === String(idNumber)) {
      return data[i];
    }
  }

  return null;
}

function canUserManageGlobalCache(idNumber) {
  if (!idNumber) return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('UserAccounts');
  if (!userSheet) return false;

  const userRow = getUserAccountRowById(userSheet, idNumber);
  if (!userRow) return false;

  const role = String(userRow[COL.ROLE] || '').toLowerCase();
  return role === 'admin' || role === 'superadmin';
}

function getCacheVersion() {
  try {
    return {
      success: true,
      version: getStoredCacheVersion()
    };
  } catch (error) {
    return {
      success: false,
      version: 1,
      error: error.message
    };
  }
}

function bumpCacheVersion(requestedByIdNumber, sessionToken) {
  try {
    const callerIdNumber = getIdNumberFromSessionToken(sessionToken);

    if (!callerIdNumber) {
      return { error: 'Unauthorized. Please log in again.' };
    }

    if (requestedByIdNumber && String(requestedByIdNumber) !== String(callerIdNumber)) {
      return { error: 'Unauthorized request context.' };
    }

    if (!canUserManageGlobalCache(callerIdNumber)) {
      return { error: 'Unauthorized. Only admin or superadmin can bump cache version.' };
    }

    const props = PropertiesService.getScriptProperties();
    const oldVersion = getStoredCacheVersion();
    const newVersion = oldVersion + 1;

    props.setProperty(CACHE_VERSION_PROPERTY_KEY, String(newVersion));

    return {
      success: true,
      message: 'Cache version bumped. All users will be forced to reset on their next check.',
      oldVersion: oldVersion,
      newVersion: newVersion
    };
  } catch (error) {
    return { error: 'Failed to bump cache version: ' + error.message };
  }
}

// =====================================================
// MAIN REQUEST HANDLERS
// =====================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('1SF Directory')
    .addItem('Setup Sheets', 'setupSheets')
    .addItem('Install OTP Cleanup Trigger', 'ensureOtpCleanupTrigger')
    .addItem('Clean Expired OTPs', 'cleanExpiredOtps')
    .addItem('Show Email Quota', 'showEmailQuotaSidebar')
    .addToUi();
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'ping';
    
    switch(action) {
      case 'ping':
        return jsonResponse({ success: true, message: '1SF Directory API is running', timestamp: new Date().toISOString() });
      case 'getCacheVersion':
        return jsonResponse(getCacheVersion());
      case 'setupGroupSheets':
        return jsonResponse(setupGroupSheets());
      case 'checkUsername':
        return jsonResponse(checkUsernameAvailable(e.parameter.username));
      case 'checkIdNumber':
        return jsonResponse(checkIdNumberAvailable(e.parameter.idNumber));
      case 'checkEmail':
        return jsonResponse(checkEmailAvailable(e.parameter.email, e.parameter.type));
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message, stack: error.stack });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch(action) {
      // Registration flow
      case 'registerUser':
        return jsonResponse(registerUser(data));
      case 'sendEmailOTP':
        return jsonResponse(sendEmailOTP(data));
      case 'verifyEmailOTP':
        return jsonResponse(verifyEmailOTP(data));
      case 'resendEmailOTP':
        return jsonResponse(resendEmailOTP(data));
      
      // Authentication
      case 'loginWithPassword':
        return jsonResponse(loginWithPassword(data.username, data.password));
      
      // Profile management
      case 'uploadProfilePicture':
        return jsonResponse(uploadProfilePicture(data));
      case 'uploadDigitalSignature':
        return jsonResponse(uploadDigitalSignature(data));
      case 'uploadImage':
        return jsonResponse(uploadImage(data));
      case 'saveScannedQRCode':
        return jsonResponse(saveScannedQRCode(data));
      case 'updateUserProfile':
        return jsonResponse(updateUserProfile(data));
      case 'getUserProfile':
        return jsonResponse(getUserProfile(data));
      case 'getCacheVersion':
        return jsonResponse(getCacheVersion());
      case 'findUserByQRCode':
        return jsonResponse(findUserByQRCode(data));
      case 'getClassmates':
        return jsonResponse(getClassmates(data));
      case 'updateUserRole':
        return jsonResponse(updateUserRole(data.adminIdNumber, data.targetIdNumber, data.role, data.position, data.sessionToken));
      case 'bumpCacheVersion':
        return jsonResponse(bumpCacheVersion(data.userId, data.sessionToken));
      case 'setupGroupSheets':
        return jsonResponse(setupGroupSheets());
      case 'getCourseGroups':
        return jsonResponse(getCourseGroups(data));
      case 'getCourseGroupDetails':
        return jsonResponse(getCourseGroupDetails(data));
      case 'searchCourseGroupMembers':
        return jsonResponse(searchCourseGroupMembers(data));
      case 'createCourseGroup':
        return jsonResponse(createCourseGroup(data));
      case 'updateCourseGroup':
        return jsonResponse(updateCourseGroup(data));
      case 'addCourseGroupMember':
        return jsonResponse(addCourseGroupMember(data));
      case 'requestLeaveCourseGroup':
        return jsonResponse(requestLeaveCourseGroup(data));
      case 'reviewCourseGroupRequest':
        return jsonResponse(reviewCourseGroupRequest(data));
      case 'removeCourseGroupMember':
        return jsonResponse(removeCourseGroupMember(data));
      case 'disbandCourseGroup':
        return jsonResponse(disbandCourseGroup(data));
      case 'assignCourseGroupTask':
        return jsonResponse(assignCourseGroupTask(data));
      case 'createRandomCourseGroups':
        return jsonResponse(createRandomCourseGroups(data));
      case 'createManualCourseGrouping':
        return jsonResponse(createManualCourseGrouping(data));
      
      // Utilities
      case 'checkUsername':
        return jsonResponse(checkUsernameAvailable(data.username));
      case 'checkIdNumber':
        return jsonResponse(checkIdNumberAvailable(data.idNumber));
      case 'checkEmail':
        return jsonResponse(checkEmailAvailable(data.email, data.type));
      
      // Setup
      case 'setupSheets':
        return jsonResponse(setupSheets());
      
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message, stack: error.stack });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================
// SETUP & INITIALIZATION
// =====================================================

/**
 * Initialize all sheets with proper structure and formatting
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = [];
  
  // Brown color for headers (RGB: 121, 85, 72 or Hex: #795548)
  const headerColor = '#795548';
  const headerFontColor = '#FFFFFF';
  
  // 1. Setup UserAccounts sheet
  let userSheet = ss.getSheetByName('UserAccounts');
  if (!userSheet) {
    userSheet = ss.insertSheet('UserAccounts');
    const headers = [
      'idNumber', 'username', 'passwordHash', 'passwordSalt',
      'firstName', 'lastName', 'email', 'emailVerified',
      'schoolEmail', 'schoolEmailVerified', 'birthday',
      'profilePictureFileId', 'digitalSignatureFileId', 'qrCodeValue',
      'school', 'college', 'program', 'major', 'year', 'section',
      'role', 'position', 'loginAttempts', 'accountLocked', 'lockedUntil',
      'createdDate', 'lastLogin'
    ];
    userSheet.appendRow(headers);
    
    // Format header row
    const headerRange = userSheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(headerColor);
    headerRange.setFontColor(headerFontColor);
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    
    // Freeze first row
    userSheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      userSheet.autoResizeColumn(i);
    }
    
    results.push('✓ Created UserAccounts sheet (27 columns)');
  } else {
    results.push('✓ UserAccounts sheet already exists');
  }
  
  // 2. Setup EmailVerifications sheet
  let emailVerifSheet = ss.getSheetByName('EmailVerifications');
  if (!emailVerifSheet) {
    emailVerifSheet = ss.insertSheet('EmailVerifications');
    const headers = [
      'verificationId', 'idNumber', 'email', 'emailType',
      'otpHash', 'createdAt', 'expiresAt', 'attempts',
      'isVerified', 'verifiedAt', 'failedAttempts', 'lockedUntil'
    ];
    emailVerifSheet.appendRow(headers);
    
    // Format header row
    const headerRange = emailVerifSheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(headerColor);
    headerRange.setFontColor(headerFontColor);
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    
    // Freeze first row
    emailVerifSheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      emailVerifSheet.autoResizeColumn(i);
    }
    
    results.push('✓ Created EmailVerifications sheet (12 columns)');
  } else {
    results.push('✓ EmailVerifications sheet already exists');
  }
  
  const triggerResult = ensureOtpCleanupTrigger();
  if (triggerResult && triggerResult.message) {
    results.push(triggerResult.message);
  }

  const groupSetup = setupGroupSheets();
  if (groupSetup && groupSetup.results && groupSetup.results.length) {
    Array.prototype.push.apply(results, groupSetup.results);
  }

  return { success: true, results: results };
}

/**
 * Initialize all sheets - alternative name for convenience
 */
function initiateSheets() {
  return setupSheets();
}
function setupGroupSheets() {
  const results = [];
  results.push(ensureDirectorySheetWithHeaders(GROUP_SHEETS.GROUPS, COURSE_GROUP_HEADERS));
  results.push(ensureDirectorySheetWithHeaders(GROUP_SHEETS.MEMBERS, COURSE_GROUP_MEMBER_HEADERS));
  results.push(ensureDirectorySheetWithHeaders(GROUP_SHEETS.REQUESTS, COURSE_GROUP_REQUEST_HEADERS));
  results.push(ensureDirectorySheetWithHeaders(GROUP_SHEETS.ASSIGNMENTS, COURSE_GROUP_ASSIGNMENT_HEADERS));

  return {
    success: true,
    results: results.filter(Boolean)
  };
}

function ensureDirectorySheetWithHeaders(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  const headerColor = '#795548';
  const headerFontColor = '#FFFFFF';

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(headerColor);
    headerRange.setFontColor(headerFontColor);
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);

    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

    return `Created ${sheetName} sheet`;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  let needsHeaderRefresh = false;
  for (let i = 0; i < headers.length; i++) {
    if (String(existingHeaders[i] || '') !== headers[i]) {
      needsHeaderRefresh = true;
      break;
    }
  }

  if (needsHeaderRefresh) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return `${sheetName} sheet already exists`;
}

function safeDirectoryString(value) {
  return String(value || '').trim();
}

function normalizeDirectoryCsvList(values) {
  const seen = {};
  const items = [];
  for (let i = 0; i < (values || []).length; i++) {
    const next = safeDirectoryString(values[i]);
    if (!next || seen[next]) continue;
    seen[next] = true;
    items.push(next);
  }
  return items;
}

function parseDirectoryCsv(value) {
  if (!value) return [];
  return normalizeDirectoryCsvList(String(value).split(',').map(item => item.trim()));
}

function serializeDirectoryCsv(values) {
  return normalizeDirectoryCsvList(values).join(',');
}

function parseDirectoryJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function getUserRowIndexById(data, idNumber) {
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.ID_NUMBER]) === String(idNumber)) {
      return i;
    }
  }
  return -1;
}

function buildDirectoryUserSummary(row) {
  if (!row) return null;
  return {
    idNumber: String(row[COL.ID_NUMBER] || ''),
    username: row[COL.USERNAME] || '',
    firstName: row[COL.FIRST_NAME] || '',
    lastName: row[COL.LAST_NAME] || '',
    fullName: `${row[COL.FIRST_NAME] || ''} ${row[COL.LAST_NAME] || ''}`.trim(),
    email: row[COL.EMAIL] || '',
    schoolEmail: row[COL.SCHOOL_EMAIL] || '',
    school: row[COL.SCHOOL] || '',
    college: row[COL.COLLEGE] || '',
    program: row[COL.PROGRAM] || '',
    major: row[COL.MAJOR] || '',
    year: row[COL.YEAR] || '',
    section: row[COL.SECTION] || '',
    role: row[COL.ROLE] || 'student',
    position: row[COL.POSITION] || '',
    profilePictureURL: getFileUrl(row[COL.PROFILE_PICTURE_FILE_ID])
  };
}

function getDirectoryClassProfileFromRow(row) {
  return {
    school: safeDirectoryString(row[COL.SCHOOL]),
    college: safeDirectoryString(row[COL.COLLEGE]),
    program: safeDirectoryString(row[COL.PROGRAM]),
    major: safeDirectoryString(row[COL.MAJOR]),
    year: safeDirectoryString(row[COL.YEAR]),
    section: safeDirectoryString(row[COL.SECTION]),
    classKey: buildDirectoryClassKeyFromValues(
      row[COL.SCHOOL],
      row[COL.COLLEGE],
      row[COL.PROGRAM],
      row[COL.MAJOR],
      row[COL.YEAR],
      row[COL.SECTION]
    )
  };
}

function buildDirectoryClassKeyFromValues(school, college, program, major, year, section) {
  return [
    normalizeClassField(school),
    normalizeClassField(college),
    normalizeClassField(program),
    normalizeClassField(major),
    normalizeClassField(year),
    normalizeClassField(section)
  ].join('|');
}

function getAuthenticatedDirectoryContext(requestUserId, sessionToken) {
  const callerIdNumber = getIdNumberFromSessionToken(sessionToken);
  if (!callerIdNumber) {
    return { error: 'Unauthorized. Please log in again.' };
  }

  if (requestUserId && String(requestUserId) !== String(callerIdNumber)) {
    return { error: 'Unauthorized request context.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('UserAccounts');
  if (!userSheet) {
    return { error: 'User sheet not found' };
  }

  const data = userSheet.getDataRange().getValues();
  const rowIndex = getUserRowIndexById(data, callerIdNumber);
  if (rowIndex === -1) {
    return { error: 'User not found' };
  }

  const row = data[rowIndex];
  const user = buildDirectoryUserSummary(row);
  user.classProfile = getDirectoryClassProfileFromRow(row);

  return {
    success: true,
    user: user,
    userRow: row,
    userRowIndex: rowIndex,
    userSheet: userSheet,
    userData: data
  };
}

function getExistingDirectoryUserById(idNumber) {
  if (!idNumber) {
    return { rowIndex: -1, row: null, userSheet: null, userData: [] };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('UserAccounts');
  if (!userSheet) {
    return { rowIndex: -1, row: null, userSheet: null, userData: [] };
  }

  const userData = userSheet.getDataRange().getValues();
  const rowIndex = getUserRowIndexById(userData, idNumber);

  return {
    rowIndex: rowIndex,
    row: rowIndex === -1 ? null : userData[rowIndex],
    userSheet: userSheet,
    userData: userData
  };
}

function getDirectoryEmailColumnByType(emailType) {
  return emailType === 'school' ? COL.SCHOOL_EMAIL : COL.EMAIL;
}

function getDirectoryVerifiedColumnByType(emailType) {
  return emailType === 'school' ? COL.SCHOOL_EMAIL_VERIFIED : COL.EMAIL_VERIFIED;
}

function doesDirectoryEmailMatchUserRow(userRow, email, emailType) {
  if (!userRow) return false;
  const emailColumn = getDirectoryEmailColumnByType(emailType);
  return String(userRow[emailColumn] || '').toLowerCase() === String(email || '').toLowerCase();
}

function validateOtpRequestOwnership(idNumber, email, emailType) {
  const existingUser = getExistingDirectoryUserById(idNumber);
  if (!existingUser.row) {
    return { success: true, existingUser: existingUser };
  }

  if (!doesDirectoryEmailMatchUserRow(existingUser.row, email, emailType)) {
    return {
      error: `The provided ${emailType === 'school' ? 'school email' : 'email'} does not match the existing account for this ID number.`
    };
  }

  return { success: true, existingUser: existingUser };
}

function validateCourseGroupLeaderIdsForMembers(leaderIds, allowedMemberIds, userMap) {
  const allowedLookup = {};
  for (let i = 0; i < allowedMemberIds.length; i++) {
    allowedLookup[String(allowedMemberIds[i])] = true;
  }

  for (let i = 0; i < leaderIds.length; i++) {
    const leaderId = String(leaderIds[i]);
    if (!userMap[leaderId]) {
      return { error: `Team leader ${leaderId} was not found.` };
    }
    if (!allowedLookup[leaderId]) {
      return { error: `Team leader ${leaderId} must be an active member of the group.` };
    }
  }

  return { success: true };
}

function isCourseGroupOfficer(user) {
  if (!user) return false;
  const role = safeDirectoryString(user.role).toLowerCase();
  const position = safeDirectoryString(user.position).toLowerCase();
  return role === 'admin' || role === 'superadmin' || COURSE_GROUP_OFFICER_POSITIONS.indexOf(position) !== -1;
}

function isCourseGroupManager(user) {
  if (!user) return false;
  const role = safeDirectoryString(user.role).toLowerCase();
  const position = safeDirectoryString(user.position).toLowerCase();
  return role === 'admin' || role === 'superadmin' || COURSE_GROUP_MANAGER_POSITIONS.indexOf(position) !== -1;
}

function getCourseGroupSheets() {
  setupGroupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    groups: ss.getSheetByName(GROUP_SHEETS.GROUPS),
    members: ss.getSheetByName(GROUP_SHEETS.MEMBERS),
    requests: ss.getSheetByName(GROUP_SHEETS.REQUESTS),
    assignments: ss.getSheetByName(GROUP_SHEETS.ASSIGNMENTS)
  };
}

function getSheetDataRows(sheet) {
  const values = sheet.getDataRange().getValues();
  return values.length > 1 ? values.slice(1) : [];
}

function overwriteSheetRows(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function buildCourseGroupRecord(row) {
  return {
    groupId: safeDirectoryString(row[COURSE_GROUP_COL.GROUP_ID]),
    courseCode: safeDirectoryString(row[COURSE_GROUP_COL.COURSE_CODE]),
    groupName: safeDirectoryString(row[COURSE_GROUP_COL.GROUP_NAME]),
    task: safeDirectoryString(row[COURSE_GROUP_COL.TASK]),
    deadline: safeDirectoryString(row[COURSE_GROUP_COL.DEADLINE]),
    description: safeDirectoryString(row[COURSE_GROUP_COL.DESCRIPTION]),
    isPermanent: row[COURSE_GROUP_COL.IS_PERMANENT] === true || String(row[COURSE_GROUP_COL.IS_PERMANENT]).toLowerCase() === 'true',
    classKey: safeDirectoryString(row[COURSE_GROUP_COL.CLASS_KEY]),
    school: safeDirectoryString(row[COURSE_GROUP_COL.SCHOOL]),
    college: safeDirectoryString(row[COURSE_GROUP_COL.COLLEGE]),
    program: safeDirectoryString(row[COURSE_GROUP_COL.PROGRAM]),
    major: safeDirectoryString(row[COURSE_GROUP_COL.MAJOR]),
    year: safeDirectoryString(row[COURSE_GROUP_COL.YEAR]),
    section: safeDirectoryString(row[COURSE_GROUP_COL.SECTION]),
    teamLeaderIds: parseDirectoryCsv(row[COURSE_GROUP_COL.TEAM_LEADER_IDS]),
    createdBy: safeDirectoryString(row[COURSE_GROUP_COL.CREATED_BY]),
    createdAt: safeDirectoryString(row[COURSE_GROUP_COL.CREATED_AT]),
    updatedBy: safeDirectoryString(row[COURSE_GROUP_COL.UPDATED_BY]),
    updatedAt: safeDirectoryString(row[COURSE_GROUP_COL.UPDATED_AT]),
    isDisbanded: row[COURSE_GROUP_COL.IS_DISBANDED] === true || String(row[COURSE_GROUP_COL.IS_DISBANDED]).toLowerCase() === 'true'
  };
}

function buildCourseGroupMemberRecord(row) {
  return {
    membershipId: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.MEMBERSHIP_ID]),
    groupId: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.GROUP_ID]),
    courseCode: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.COURSE_CODE]),
    memberId: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.MEMBER_ID]),
    memberName: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.MEMBER_NAME]),
    joinedAt: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.JOINED_AT]),
    addedBy: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.ADDED_BY]),
    status: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.STATUS] || 'active'),
    leftAt: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.LEFT_AT]),
    removedBy: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.REMOVED_BY]),
    note: safeDirectoryString(row[COURSE_GROUP_MEMBER_COL.NOTE])
  };
}

function buildCourseGroupRequestRecord(row) {
  return {
    requestId: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.REQUEST_ID]),
    courseCode: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.COURSE_CODE]),
    requestType: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.REQUEST_TYPE]),
    groupId: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.GROUP_ID]),
    sourceGroupId: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.SOURCE_GROUP_ID]),
    targetMemberId: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.TARGET_MEMBER_ID]),
    targetMemberName: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.TARGET_MEMBER_NAME]),
    requestedBy: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.REQUESTED_BY]),
    requestedAt: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.REQUESTED_AT]),
    status: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.STATUS]),
    approverId: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.APPROVER_ID]),
    approvedAt: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.APPROVED_AT]),
    reason: safeDirectoryString(row[COURSE_GROUP_REQUEST_COL.REASON]),
    metadata: parseDirectoryJson(row[COURSE_GROUP_REQUEST_COL.METADATA_JSON], {})
  };
}

function buildCourseGroupAssignmentRecord(row) {
  return {
    assignmentId: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.ASSIGNMENT_ID]),
    groupId: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.GROUP_ID]),
    courseCode: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.COURSE_CODE]),
    title: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.TITLE]),
    description: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.DESCRIPTION]),
    deadline: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.DEADLINE]),
    assignedToMemberId: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.ASSIGNED_TO_MEMBER_ID]),
    assignedToMemberName: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.ASSIGNED_TO_MEMBER_NAME]),
    assignedBy: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.ASSIGNED_BY]),
    createdAt: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.CREATED_AT]),
    updatedAt: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.UPDATED_AT]),
    status: safeDirectoryString(row[COURSE_GROUP_ASSIGNMENT_COL.STATUS] || 'assigned'),
    isDeleted: row[COURSE_GROUP_ASSIGNMENT_COL.IS_DELETED] === true || String(row[COURSE_GROUP_ASSIGNMENT_COL.IS_DELETED]).toLowerCase() === 'true'
  };
}

function findCourseGroupRowIndex(rows, groupId) {
  for (let i = 0; i < rows.length; i++) {
    if (safeDirectoryString(rows[i][COURSE_GROUP_COL.GROUP_ID]) === String(groupId)) {
      return i;
    }
  }
  return -1;
}

function getActiveCourseMembershipsByCourse(memberRows, courseCode) {
  const lookup = {};
  for (let i = 0; i < memberRows.length; i++) {
    const membership = buildCourseGroupMemberRecord(memberRows[i]);
    if (membership.status !== 'active') continue;
    if (courseCode && membership.courseCode !== courseCode) continue;
    lookup[membership.memberId] = membership;
  }
  return lookup;
}

function getActiveGroupMembers(memberRows, groupId) {
  const members = [];
  for (let i = 0; i < memberRows.length; i++) {
    const membership = buildCourseGroupMemberRecord(memberRows[i]);
    if (membership.groupId === groupId && membership.status === 'active') {
      members.push(membership);
    }
  }
  return members;
}

function findActiveMembershipRowIndex(memberRows, groupId, memberId) {
  for (let i = 0; i < memberRows.length; i++) {
    const membership = buildCourseGroupMemberRecord(memberRows[i]);
    if (membership.groupId === groupId && membership.memberId === String(memberId) && membership.status === 'active') {
      return i;
    }
  }
  return -1;
}

function createCourseGroupMembershipRow(group, member, addedBy, note) {
  return [
    Utilities.getUuid(),
    group.groupId,
    group.courseCode,
    member.idNumber,
    member.fullName || member.name || member.idNumber,
    new Date().toISOString(),
    addedBy,
    'active',
    '',
    '',
    note || ''
  ];
}

function markCourseMembershipInactive(memberRows, rowIndex, removedBy, note) {
  memberRows[rowIndex][COURSE_GROUP_MEMBER_COL.STATUS] = 'removed';
  memberRows[rowIndex][COURSE_GROUP_MEMBER_COL.LEFT_AT] = new Date().toISOString();
  memberRows[rowIndex][COURSE_GROUP_MEMBER_COL.REMOVED_BY] = removedBy;
  memberRows[rowIndex][COURSE_GROUP_MEMBER_COL.NOTE] = note || '';
}

function getDirectoryUserMap(data) {
  const lookup = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    lookup[String(row[COL.ID_NUMBER] || '')] = buildDirectoryUserSummary(row);
  }
  return lookup;
}

function groupMatchesClassProfile(group, classProfile) {
  return group.classKey === classProfile.classKey;
}

function assertCourseCode(courseCode) {
  const normalized = safeDirectoryString(courseCode);
  return normalized ? normalized : '';
}

function canManageSpecificCourseGroup(user, group) {
  if (isCourseGroupManager(user)) return true;
  if (!group) return false;
  return group.teamLeaderIds.indexOf(String(user.idNumber)) !== -1;
}

function getCourseGroups(data) {
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };

    const courseCode = assertCourseCode(data.courseCode);
    if (!courseCode) return { error: 'Course code is required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const requestRows = getSheetDataRows(sheets.requests);
    const activeMemberships = getActiveCourseMembershipsByCourse(memberRows, courseCode);
    const groups = [];

    for (let i = 0; i < groupRows.length; i++) {
      const group = buildCourseGroupRecord(groupRows[i]);
      if (group.courseCode !== courseCode || group.isDisbanded) continue;
      if (!groupMatchesClassProfile(group, auth.user.classProfile)) continue;
      const members = getActiveGroupMembers(memberRows, group.groupId);
      groups.push({
        groupId: group.groupId,
        courseCode: group.courseCode,
        groupName: group.groupName,
        task: group.task,
        deadline: group.deadline,
        description: group.description,
        isPermanent: group.isPermanent,
        teamLeaderIds: group.teamLeaderIds,
        memberCount: members.length,
        members: members.map(member => ({ memberId: member.memberId, memberName: member.memberName }))
      });
    }

    const myMembership = activeMemberships[auth.user.idNumber] || null;
    const myRequests = [];
    for (let i = 0; i < requestRows.length; i++) {
      const request = buildCourseGroupRequestRecord(requestRows[i]);
      if (request.courseCode !== courseCode) continue;
      if (request.targetMemberId !== auth.user.idNumber && request.requestedBy !== auth.user.idNumber) continue;
      if (request.status === 'approved' || request.status === 'rejected' || request.status === 'cancelled') continue;
      myRequests.push(request);
    }

    return {
      success: true,
      courseCode: courseCode,
      viewer: auth.user,
      currentGroupId: myMembership ? myMembership.groupId : '',
      groups: groups.sort((a, b) => a.groupName.localeCompare(b.groupName)),
      requests: myRequests
    };
  } catch (error) {
    return { error: error.message };
  }
}

function getCourseGroupDetails(data) {
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };
    const groupId = safeDirectoryString(data.groupId);
    if (!groupId) return { error: 'Group ID is required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const requestRows = getSheetDataRows(sheets.requests);
    const assignmentRows = getSheetDataRows(sheets.assignments);
    const groupIndex = findCourseGroupRowIndex(groupRows, groupId);
    if (groupIndex === -1) return { error: 'Group not found' };

    const group = buildCourseGroupRecord(groupRows[groupIndex]);
    if (group.isDisbanded) return { error: 'Group is no longer active' };
    if (!groupMatchesClassProfile(group, auth.user.classProfile) && !isCourseGroupManager(auth.user)) {
      return { error: 'Unauthorized for this class group' };
    }

    const activeMembers = getActiveGroupMembers(memberRows, groupId);
    const sameCourseMemberships = getActiveCourseMembershipsByCourse(memberRows, group.courseCode);
    const viewerMembership = sameCourseMemberships[auth.user.idNumber] || null;
    const isViewerInsideGroup = !!(viewerMembership && viewerMembership.groupId === groupId);
    const canManage = canManageSpecificCourseGroup(auth.user, group);
    const userMap = getDirectoryUserMap(auth.userData);

    const members = activeMembers.map(member => {
      const user = userMap[member.memberId];
      return {
        memberId: member.memberId,
        memberName: member.memberName,
        username: user ? user.username : '',
        profilePictureURL: user ? user.profilePictureURL : '',
        role: user ? user.role : '',
        position: user ? user.position : '',
        isTeamLeader: group.teamLeaderIds.indexOf(member.memberId) !== -1
      };
    });

    const otherGroups = [];
    for (let i = 0; i < groupRows.length; i++) {
      const candidate = buildCourseGroupRecord(groupRows[i]);
      if (candidate.courseCode !== group.courseCode || candidate.groupId === groupId || candidate.isDisbanded) continue;
      if (!groupMatchesClassProfile(candidate, auth.user.classProfile) && !isCourseGroupManager(auth.user)) continue;
      otherGroups.push({
        groupId: candidate.groupId,
        groupName: candidate.groupName,
        task: candidate.task,
        deadline: candidate.deadline,
        isPermanent: candidate.isPermanent,
        memberCount: getActiveGroupMembers(memberRows, candidate.groupId).length
      });
    }

    const pendingRequests = [];
    for (let i = 0; i < requestRows.length; i++) {
      const request = buildCourseGroupRequestRecord(requestRows[i]);
      if (request.status !== 'pending') continue;
      if (request.groupId !== groupId && request.sourceGroupId !== groupId) continue;
      if (!canManage && request.targetMemberId !== auth.user.idNumber && request.requestedBy !== auth.user.idNumber) continue;
      pendingRequests.push(request);
    }

    let assignments = [];
    if (isViewerInsideGroup || canManage) {
      assignments = assignmentRows
        .map(row => buildCourseGroupAssignmentRecord(row))
        .filter(item => item.groupId === groupId && !item.isDeleted)
        .filter(item => canManage || item.assignedToMemberId === auth.user.idNumber || !item.assignedToMemberId);
    }

    return {
      success: true,
      group: {
        groupId: group.groupId,
        courseCode: group.courseCode,
        groupName: group.groupName,
        task: group.task,
        deadline: group.deadline,
        description: group.description,
        isPermanent: group.isPermanent,
        teamLeaderIds: group.teamLeaderIds
      },
      viewer: auth.user,
      canManage: canManage,
      currentGroupId: viewerMembership ? viewerMembership.groupId : '',
      members: members,
      otherGroups: otherGroups.sort((a, b) => a.groupName.localeCompare(b.groupName)),
      pendingRequests: pendingRequests,
      assignments: assignments
    };
  } catch (error) {
    return { error: error.message };
  }
}

function searchCourseGroupMembers(data) {
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };
    const courseCode = assertCourseCode(data.courseCode);
    if (!courseCode) return { error: 'Course code is required' };

    const query = safeDirectoryString(data.query).toLowerCase();
    const classmatesResult = getClassmates(auth.user.idNumber, auth.user.section);
    if (!classmatesResult.success) {
      return { error: classmatesResult.error || 'Failed to load classmates', members: [] };
    }

    const sheets = getCourseGroupSheets();
    const memberRows = getSheetDataRows(sheets.members);
    const groupRows = getSheetDataRows(sheets.groups);
    const activeMemberships = getActiveCourseMembershipsByCourse(memberRows, courseCode);
    const groupNameById = {};

    for (let i = 0; i < groupRows.length; i++) {
      const group = buildCourseGroupRecord(groupRows[i]);
      if (!group.isDisbanded) {
        groupNameById[group.groupId] = group.groupName;
      }
    }

    const filtered = classmatesResult.classmates.filter(member => {
      if (!query) return true;
      return (
        String(member.name || '').toLowerCase().indexOf(query) !== -1 ||
        String(member.username || '').toLowerCase().indexOf(query) !== -1 ||
        String(member.idNumber || '').toLowerCase().indexOf(query) !== -1
      );
    }).map(member => {
      const membership = activeMemberships[member.idNumber] || null;
      return {
        idNumber: member.idNumber,
        name: member.name,
        username: member.username,
        profilePicture: member.profilePicture,
        role: member.role,
        position: member.position,
        currentGroupId: membership ? membership.groupId : '',
        currentGroupName: membership ? (groupNameById[membership.groupId] || '') : '',
        canAddDirectly: !membership
      };
    });

    return {
      success: true,
      members: filtered.slice(0, 25)
    };
  } catch (error) {
    return { error: error.message, members: [] };
  }
}

function createCourseGroup(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };

    const courseCode = assertCourseCode(data.courseCode);
    const groupName = safeDirectoryString(data.groupName);
    if (!courseCode) return { error: 'Course code is required' };
    if (!groupName) return { error: 'Group name is required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const requestedLeaderIds = normalizeDirectoryCsvList([].concat(data.teamLeaderIds || []));
    const requestedMemberIds = normalizeDirectoryCsvList([auth.user.idNumber].concat(data.memberIds || [], requestedLeaderIds));
    const userMap = getDirectoryUserMap(auth.userData);
    const leaderValidation = validateCourseGroupLeaderIdsForMembers(requestedLeaderIds, requestedMemberIds, userMap);
    if (leaderValidation.error) return { error: leaderValidation.error };

    for (let i = 0; i < requestedMemberIds.length; i++) {
      const candidate = userMap[requestedMemberIds[i]];
      if (!candidate) return { error: `User ${requestedMemberIds[i]} was not found` };
      const candidateClassKey = buildDirectoryClassKeyFromValues(candidate.school, candidate.college, candidate.program, candidate.major, candidate.year, candidate.section);
      if (candidateClassKey !== auth.user.classProfile.classKey) {
        return { error: `${candidate.fullName || candidate.idNumber} is outside your class.` };
      }
    }

    for (let i = 0; i < groupRows.length; i++) {
      const existing = buildCourseGroupRecord(groupRows[i]);
      if (existing.isDisbanded) continue;
      if (existing.courseCode === courseCode && existing.classKey === auth.user.classProfile.classKey && existing.groupName.toLowerCase() === groupName.toLowerCase()) {
        return { error: 'Group name already exists for this course.' };
      }
    }

    const activeMemberships = getActiveCourseMembershipsByCourse(memberRows, courseCode);
    for (let i = 0; i < requestedMemberIds.length; i++) {
      const membership = activeMemberships[requestedMemberIds[i]];
      if (membership) {
        return { error: `${userMap[requestedMemberIds[i]].fullName || requestedMemberIds[i]} already belongs to ${membership.groupId} for this course.` };
      }
    }

    const now = new Date().toISOString();
    const groupId = Utilities.getUuid();
    const group = {
      groupId: groupId,
      courseCode: courseCode,
      groupName: groupName,
      task: safeDirectoryString(data.task),
      deadline: safeDirectoryString(data.deadline),
      description: safeDirectoryString(data.description),
      isPermanent: data.isPermanent === true || String(data.isPermanent).toLowerCase() === 'true',
      classKey: auth.user.classProfile.classKey,
      school: auth.user.classProfile.school,
      college: auth.user.classProfile.college,
      program: auth.user.classProfile.program,
      major: auth.user.classProfile.major,
      year: auth.user.classProfile.year,
      section: auth.user.classProfile.section,
      teamLeaderIds: requestedLeaderIds,
      createdBy: auth.user.idNumber,
      createdAt: now,
      updatedBy: auth.user.idNumber,
      updatedAt: now
    };

    groupRows.push([
      group.groupId,
      group.courseCode,
      group.groupName,
      group.task,
      group.deadline,
      group.description,
      group.isPermanent,
      group.classKey,
      group.school,
      group.college,
      group.program,
      group.major,
      group.year,
      group.section,
      serializeDirectoryCsv(group.teamLeaderIds),
      group.createdBy,
      group.createdAt,
      group.updatedBy,
      group.updatedAt,
      false
    ]);

    for (let i = 0; i < requestedMemberIds.length; i++) {
      memberRows.push(createCourseGroupMembershipRow(group, userMap[requestedMemberIds[i]], auth.user.idNumber, 'Group creation'));
    }

    overwriteSheetRows(sheets.groups, COURSE_GROUP_HEADERS, groupRows);
    overwriteSheetRows(sheets.members, COURSE_GROUP_MEMBER_HEADERS, memberRows);

    return { success: true, groupId: groupId, message: 'Group created successfully.' };
  } catch (error) {
    return { error: 'Failed to create group: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function updateCourseGroup(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };
    const groupId = safeDirectoryString(data.groupId);
    if (!groupId) return { error: 'Group ID is required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const groupIndex = findCourseGroupRowIndex(groupRows, groupId);
    if (groupIndex === -1) return { error: 'Group not found' };

    const group = buildCourseGroupRecord(groupRows[groupIndex]);
    if (group.isDisbanded) {
      return { error: 'Group is no longer active.' };
    }
    if (!canManageSpecificCourseGroup(auth.user, group)) {
      return { error: 'Unauthorized. Only team leaders or class managers can update this group.' };
    }

    const nextLeaderIds = data.teamLeaderIds !== undefined
      ? normalizeDirectoryCsvList(data.teamLeaderIds || [])
      : group.teamLeaderIds;
    const activeMembers = getActiveGroupMembers(getSheetDataRows(sheets.members), groupId);
    const activeMemberIds = activeMembers.map(member => member.memberId);
    const userMap = getDirectoryUserMap(auth.userData);
    const leaderValidation = validateCourseGroupLeaderIdsForMembers(nextLeaderIds, activeMemberIds, userMap);
    if (leaderValidation.error) return { error: leaderValidation.error };

    const nextGroupName = data.groupName !== undefined ? safeDirectoryString(data.groupName) : group.groupName;
    if (!nextGroupName) {
      return { error: 'Group name is required' };
    }

    for (let i = 0; i < groupRows.length; i++) {
      if (i === groupIndex) continue;
      const existing = buildCourseGroupRecord(groupRows[i]);
      if (existing.isDisbanded) continue;
      if (existing.courseCode === group.courseCode && existing.classKey === group.classKey && existing.groupName.toLowerCase() === nextGroupName.toLowerCase()) {
        return { error: 'Group name already exists for this course.' };
      }
    }

    if (data.groupName !== undefined) groupRows[groupIndex][COURSE_GROUP_COL.GROUP_NAME] = nextGroupName;
    if (data.task !== undefined) groupRows[groupIndex][COURSE_GROUP_COL.TASK] = safeDirectoryString(data.task);
    if (data.deadline !== undefined) groupRows[groupIndex][COURSE_GROUP_COL.DEADLINE] = safeDirectoryString(data.deadline);
    if (data.description !== undefined) groupRows[groupIndex][COURSE_GROUP_COL.DESCRIPTION] = safeDirectoryString(data.description);
    if (data.isPermanent !== undefined) groupRows[groupIndex][COURSE_GROUP_COL.IS_PERMANENT] = data.isPermanent === true || String(data.isPermanent).toLowerCase() === 'true';
    groupRows[groupIndex][COURSE_GROUP_COL.TEAM_LEADER_IDS] = serializeDirectoryCsv(nextLeaderIds);
    groupRows[groupIndex][COURSE_GROUP_COL.UPDATED_BY] = auth.user.idNumber;
    groupRows[groupIndex][COURSE_GROUP_COL.UPDATED_AT] = new Date().toISOString();

    overwriteSheetRows(sheets.groups, COURSE_GROUP_HEADERS, groupRows);
    return { success: true, message: 'Group updated successfully.' };
  } catch (error) {
    return { error: 'Failed to update group: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function addCourseGroupMember(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };

    const groupId = safeDirectoryString(data.groupId);
    const memberId = safeDirectoryString(data.memberId);
    if (!groupId || !memberId) return { error: 'Group ID and member ID are required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const requestRows = getSheetDataRows(sheets.requests);
    const groupIndex = findCourseGroupRowIndex(groupRows, groupId);
    if (groupIndex === -1) return { error: 'Group not found' };

    const group = buildCourseGroupRecord(groupRows[groupIndex]);
    if (group.isDisbanded) {
      return { error: 'Group is no longer active.' };
    }
    if (!canManageSpecificCourseGroup(auth.user, group)) {
      return { error: 'Unauthorized. Only team leaders or class managers can add members.' };
    }

    const userMap = getDirectoryUserMap(auth.userData);
    const targetUser = userMap[memberId];
    if (!targetUser) return { error: 'Target member not found' };

    const targetClassKey = buildDirectoryClassKeyFromValues(targetUser.school, targetUser.college, targetUser.program, targetUser.major, targetUser.year, targetUser.section);
    if (targetClassKey !== group.classKey) {
      return { error: 'Target member is outside the class for this group.' };
    }

    const activeMemberships = getActiveCourseMembershipsByCourse(memberRows, group.courseCode);
    const existing = activeMemberships[memberId];
    if (!existing) {
      memberRows.push(createCourseGroupMembershipRow(group, targetUser, auth.user.idNumber, safeDirectoryString(data.reason) || 'Added by manager'));
      overwriteSheetRows(sheets.members, COURSE_GROUP_MEMBER_HEADERS, memberRows);
      return { success: true, mode: 'direct_add', message: 'Member added to group.' };
    }

    if (existing.groupId === groupId) {
      return { error: 'Member already belongs to this group.' };
    }

    for (let i = 0; i < requestRows.length; i++) {
      const request = buildCourseGroupRequestRecord(requestRows[i]);
      if (
        request.status === 'pending' &&
        request.requestType === 'transfer' &&
        request.targetMemberId === memberId &&
        request.groupId === groupId &&
        request.sourceGroupId === existing.groupId
      ) {
        return { error: 'A transfer request for this member is already pending.' };
      }
    }

    requestRows.push([
      Utilities.getUuid(),
      group.courseCode,
      'transfer',
      groupId,
      existing.groupId,
      memberId,
      targetUser.fullName || memberId,
      auth.user.idNumber,
      new Date().toISOString(),
      'pending',
      '',
      '',
      safeDirectoryString(data.reason) || 'Requested group transfer',
      JSON.stringify({
        requestedTargetGroupName: group.groupName,
        sourceGroupId: existing.groupId
      })
    ]);

    overwriteSheetRows(sheets.requests, COURSE_GROUP_REQUEST_HEADERS, requestRows);
    return {
      success: true,
      mode: 'transfer_request',
      message: 'Member already belongs to another group. A transfer request was sent to their current group.'
    };
  } catch (error) {
    return { error: 'Failed to add member: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function requestLeaveCourseGroup(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };

    const groupId = safeDirectoryString(data.groupId);
    if (!groupId) return { error: 'Group ID is required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const requestRows = getSheetDataRows(sheets.requests);
    const groupIndex = findCourseGroupRowIndex(groupRows, groupId);
    if (groupIndex === -1) return { error: 'Group not found' };

    const group = buildCourseGroupRecord(groupRows[groupIndex]);
    if (group.isDisbanded) {
      return { error: 'Group is no longer active.' };
    }
    if (findActiveMembershipRowIndex(memberRows, groupId, auth.user.idNumber) === -1) {
      return { error: 'You are not an active member of this group.' };
    }

    for (let i = 0; i < requestRows.length; i++) {
      const request = buildCourseGroupRequestRecord(requestRows[i]);
      if (
        request.status === 'pending' &&
        request.requestType === 'leave' &&
        request.groupId === groupId &&
        request.targetMemberId === auth.user.idNumber
      ) {
        return { error: 'A leave request is already pending.' };
      }
    }

    requestRows.push([
      Utilities.getUuid(),
      group.courseCode,
      'leave',
      groupId,
      groupId,
      auth.user.idNumber,
      auth.user.fullName,
      auth.user.idNumber,
      new Date().toISOString(),
      'pending',
      '',
      '',
      safeDirectoryString(data.reason) || 'Requested to leave group',
      JSON.stringify({})
    ]);

    overwriteSheetRows(sheets.requests, COURSE_GROUP_REQUEST_HEADERS, requestRows);
    return {
      success: true,
      message: 'Leave request sent. A team leader must approve it before you leave the group.'
    };
  } catch (error) {
    return { error: 'Failed to submit leave request: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function reviewCourseGroupRequest(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };

    const requestId = safeDirectoryString(data.requestId);
    const decision = safeDirectoryString(data.decision).toLowerCase();
    if (!requestId) return { error: 'Request ID is required' };
    if (decision !== 'approve' && decision !== 'reject') return { error: 'Decision must be approve or reject' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const requestRows = getSheetDataRows(sheets.requests);
    let requestIndex = -1;
    let request = null;

    for (let i = 0; i < requestRows.length; i++) {
      const candidate = buildCourseGroupRequestRecord(requestRows[i]);
      if (candidate.requestId === requestId) {
        requestIndex = i;
        request = candidate;
        break;
      }
    }

    if (requestIndex === -1 || !request) return { error: 'Request not found' };
    if (request.status !== 'pending') return { error: 'This request has already been processed.' };

    const approvalGroupId = request.requestType === 'transfer' ? request.sourceGroupId : request.groupId;
    const approvalGroupIndex = findCourseGroupRowIndex(groupRows, approvalGroupId);
    if (approvalGroupIndex === -1) return { error: 'Approval group not found' };
    const approvalGroup = buildCourseGroupRecord(groupRows[approvalGroupIndex]);
    if (approvalGroup.isDisbanded) return { error: 'Approval group is no longer active.' };

    if (!canManageSpecificCourseGroup(auth.user, approvalGroup)) {
      return { error: 'Unauthorized. Only team leaders or class managers can review this request.' };
    }

    if (decision === 'approve') {
      if (request.requestType === 'leave') {
        const memberIndex = findActiveMembershipRowIndex(memberRows, request.groupId, request.targetMemberId);
        if (memberIndex === -1) return { error: 'Member is no longer active in this group.' };
        markCourseMembershipInactive(memberRows, memberIndex, auth.user.idNumber, 'Leave request approved');
      } else if (request.requestType === 'transfer') {
        const sourceMemberIndex = findActiveMembershipRowIndex(memberRows, request.sourceGroupId, request.targetMemberId);
        if (sourceMemberIndex === -1) return { error: 'Source membership is no longer active.' };
        const targetGroupIndex = findCourseGroupRowIndex(groupRows, request.groupId);
        if (targetGroupIndex === -1) return { error: 'Target group not found.' };
        const targetGroup = buildCourseGroupRecord(groupRows[targetGroupIndex]);
        if (targetGroup.isDisbanded) return { error: 'Target group is no longer active.' };
        if (targetGroup.courseCode !== request.courseCode) return { error: 'Target group course no longer matches this request.' };
        if (targetGroup.classKey !== approvalGroup.classKey) return { error: 'Target group is outside the source class.' };
        const currentMemberships = getActiveCourseMembershipsByCourse(memberRows, request.courseCode);
        const currentMembership = currentMemberships[request.targetMemberId];
        if (currentMembership && currentMembership.groupId !== request.sourceGroupId) {
          return { error: 'Member already belongs to another active group for this course.' };
        }
        const userMap = getDirectoryUserMap(auth.userData);
        const targetUser = userMap[request.targetMemberId];
        if (!targetUser) return { error: 'Target member not found.' };
        markCourseMembershipInactive(memberRows, sourceMemberIndex, auth.user.idNumber, 'Transfer approved');
        memberRows.push(createCourseGroupMembershipRow(targetGroup, targetUser, auth.user.idNumber, 'Transfer approved'));
      }
      requestRows[requestIndex][COURSE_GROUP_REQUEST_COL.STATUS] = 'approved';
    } else {
      requestRows[requestIndex][COURSE_GROUP_REQUEST_COL.STATUS] = 'rejected';
    }

    requestRows[requestIndex][COURSE_GROUP_REQUEST_COL.APPROVER_ID] = auth.user.idNumber;
    requestRows[requestIndex][COURSE_GROUP_REQUEST_COL.APPROVED_AT] = new Date().toISOString();
    if (data.reason !== undefined) {
      requestRows[requestIndex][COURSE_GROUP_REQUEST_COL.REASON] = safeDirectoryString(data.reason);
    }

    overwriteSheetRows(sheets.members, COURSE_GROUP_MEMBER_HEADERS, memberRows);
    overwriteSheetRows(sheets.requests, COURSE_GROUP_REQUEST_HEADERS, requestRows);
    return { success: true, message: decision === 'approve' ? 'Request approved.' : 'Request rejected.' };
  } catch (error) {
    return { error: 'Failed to review request: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function removeCourseGroupMember(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };
    const groupId = safeDirectoryString(data.groupId);
    const memberId = safeDirectoryString(data.memberId);
    if (!groupId || !memberId) return { error: 'Group ID and member ID are required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const groupIndex = findCourseGroupRowIndex(groupRows, groupId);
    if (groupIndex === -1) return { error: 'Group not found' };
    const group = buildCourseGroupRecord(groupRows[groupIndex]);
    if (group.isDisbanded) return { error: 'Group is no longer active.' };

    if (!canManageSpecificCourseGroup(auth.user, group)) {
      return { error: 'Unauthorized. Only team leaders or class managers can remove members.' };
    }

    const memberIndex = findActiveMembershipRowIndex(memberRows, groupId, memberId);
    if (memberIndex === -1) return { error: 'Member is not active in this group.' };
    markCourseMembershipInactive(memberRows, memberIndex, auth.user.idNumber, safeDirectoryString(data.reason) || 'Removed from group');

    overwriteSheetRows(sheets.members, COURSE_GROUP_MEMBER_HEADERS, memberRows);
    return { success: true, message: 'Member removed from group.' };
  } catch (error) {
    return { error: 'Failed to remove member: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function disbandCourseGroup(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };
    if (!isCourseGroupManager(auth.user)) {
      return { error: 'Unauthorized. Only admin, superadmin, Mayor, Vice Mayor, or Secretary can disband groups.' };
    }

    const groupId = safeDirectoryString(data.groupId);
    if (!groupId) return { error: 'Group ID is required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const groupIndex = findCourseGroupRowIndex(groupRows, groupId);
    if (groupIndex === -1) return { error: 'Group not found' };

    groupRows[groupIndex][COURSE_GROUP_COL.IS_DISBANDED] = true;
    groupRows[groupIndex][COURSE_GROUP_COL.UPDATED_BY] = auth.user.idNumber;
    groupRows[groupIndex][COURSE_GROUP_COL.UPDATED_AT] = new Date().toISOString();

    for (let i = 0; i < memberRows.length; i++) {
      const membership = buildCourseGroupMemberRecord(memberRows[i]);
      if (membership.groupId === groupId && membership.status === 'active') {
        markCourseMembershipInactive(memberRows, i, auth.user.idNumber, safeDirectoryString(data.reason) || 'Group disbanded');
      }
    }

    overwriteSheetRows(sheets.groups, COURSE_GROUP_HEADERS, groupRows);
    overwriteSheetRows(sheets.members, COURSE_GROUP_MEMBER_HEADERS, memberRows);
    return { success: true, message: 'Group disbanded successfully.' };
  } catch (error) {
    return { error: 'Failed to disband group: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function assignCourseGroupTask(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };
    const groupId = safeDirectoryString(data.groupId);
    if (!groupId) return { error: 'Group ID is required' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const assignmentRows = getSheetDataRows(sheets.assignments);
    const groupIndex = findCourseGroupRowIndex(groupRows, groupId);
    if (groupIndex === -1) return { error: 'Group not found' };
    const group = buildCourseGroupRecord(groupRows[groupIndex]);
    if (group.isDisbanded) return { error: 'Group is no longer active.' };

    if (!canManageSpecificCourseGroup(auth.user, group)) {
      return { error: 'Unauthorized. Only team leaders or class managers can assign tasks.' };
    }

    const assignedToMemberId = safeDirectoryString(data.assignedToMemberId);
    if (assignedToMemberId && findActiveMembershipRowIndex(memberRows, groupId, assignedToMemberId) === -1) {
      return { error: 'Assigned member must be active in the group.' };
    }

    const assignmentTitle = safeDirectoryString(data.title);
    if (!assignmentTitle) return { error: 'Assignment title is required' };

    const userMap = getDirectoryUserMap(auth.userData);
    const targetUser = assignedToMemberId ? userMap[assignedToMemberId] : null;
    const now = new Date().toISOString();
    assignmentRows.push([
      Utilities.getUuid(),
      groupId,
      group.courseCode,
      assignmentTitle,
      safeDirectoryString(data.description),
      safeDirectoryString(data.deadline || group.deadline),
      assignedToMemberId,
      targetUser ? targetUser.fullName : '',
      auth.user.idNumber,
      now,
      now,
      safeDirectoryString(data.status || 'assigned'),
      false
    ]);

    overwriteSheetRows(sheets.assignments, COURSE_GROUP_ASSIGNMENT_HEADERS, assignmentRows);
    return { success: true, message: 'Group task assigned successfully.' };
  } catch (error) {
    return { error: 'Failed to assign task: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function shuffleDirectoryArray(items) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = next[i];
    next[i] = next[j];
    next[j] = temp;
  }
  return next;
}

function createRandomCourseGroups(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const auth = getAuthenticatedDirectoryContext(data.userId, data.sessionToken);
    if (auth.error) return { error: auth.error };
    if (!isCourseGroupOfficer(auth.user)) {
      return { error: 'Unauthorized. Only officers, admin, or superadmin can create randomized groupings.' };
    }

    const courseCode = assertCourseCode(data.courseCode);
    const baseGroupName = safeDirectoryString(data.groupName);
    const numberOfGroups = parseInt(data.numberOfGroups, 10);
    if (!courseCode) return { error: 'Course code is required' };
    if (!baseGroupName) return { error: 'Base group name is required' };
    if (!Number.isFinite(numberOfGroups) || numberOfGroups < 1) return { error: 'Number of groups must be at least 1' };

    const classmatesResult = getClassmates(auth.user.idNumber, auth.user.section);
    if (!classmatesResult.success) return { error: classmatesResult.error || 'Failed to load classmates' };
    const leaderIds = normalizeDirectoryCsvList(data.teamLeaderIds || []);
    const candidateIds = normalizeDirectoryCsvList(
      (data.memberIds && data.memberIds.length ? data.memberIds : classmatesResult.classmates.map(item => item.idNumber)).concat(leaderIds)
    );
    if (candidateIds.length < numberOfGroups) return { error: 'Number of groups cannot exceed selected members.' };

    const sheets = getCourseGroupSheets();
    const groupRows = getSheetDataRows(sheets.groups);
    const memberRows = getSheetDataRows(sheets.members);
    const userMap = getDirectoryUserMap(auth.userData);
    const activeMemberships = getActiveCourseMembershipsByCourse(memberRows, courseCode);
    for (let i = 0; i < candidateIds.length; i++) {
      if (activeMemberships[candidateIds[i]]) return { error: `${candidateIds[i]} already belongs to a group in this course.` };
      if (!userMap[candidateIds[i]]) return { error: `User ${candidateIds[i]} was not found.` };
    }
    const shuffled = shuffleDirectoryArray(candidateIds.filter(id => leaderIds.indexOf(id) === -1));
    const buckets = [];
    for (let i = 0; i < numberOfGroups; i++) {
      buckets.push([]);
    }

    for (let i = 0; i < leaderIds.length; i++) {
      buckets[i % buckets.length].push(leaderIds[i]);
    }

    for (let i = 0; i < shuffled.length; i++) {
      buckets[i % numberOfGroups].push(shuffled[i]);
    }

    const now = new Date().toISOString();
    const createdGroups = [];
    for (let i = 0; i < buckets.length; i++) {
      const nextName = `${baseGroupName} ${i + 1}`;
      const existingName = groupRows.some(row => {
        const group = buildCourseGroupRecord(row);
        return !group.isDisbanded && group.courseCode === courseCode && group.classKey === auth.user.classProfile.classKey && group.groupName.toLowerCase() === nextName.toLowerCase();
      });
      if (existingName) return { error: `Group name ${nextName} already exists for this course.` };

      const uniqueBucketMembers = normalizeDirectoryCsvList(buckets[i]);
      const bucketLeaderIds = uniqueBucketMembers.filter(memberId => leaderIds.indexOf(memberId) !== -1);
      const groupId = Utilities.getUuid();
      groupRows.push([
        groupId,
        courseCode,
        nextName,
        safeDirectoryString(data.task),
        safeDirectoryString(data.deadline),
        safeDirectoryString(data.description),
        data.isPermanent === true || String(data.isPermanent).toLowerCase() === 'true',
        auth.user.classProfile.classKey,
        auth.user.classProfile.school,
        auth.user.classProfile.college,
        auth.user.classProfile.program,
        auth.user.classProfile.major,
        auth.user.classProfile.year,
        auth.user.classProfile.section,
        serializeDirectoryCsv(bucketLeaderIds),
        auth.user.idNumber,
        now,
        auth.user.idNumber,
        now,
        false
      ]);

      for (let j = 0; j < uniqueBucketMembers.length; j++) {
        memberRows.push(createCourseGroupMembershipRow({ groupId: groupId, courseCode: courseCode }, userMap[uniqueBucketMembers[j]], auth.user.idNumber, 'Randomized grouping'));
      }

      createdGroups.push({
        groupId: groupId,
        groupName: nextName,
        memberIds: uniqueBucketMembers,
        teamLeaderIds: bucketLeaderIds
      });
    }

    overwriteSheetRows(sheets.groups, COURSE_GROUP_HEADERS, groupRows);
    overwriteSheetRows(sheets.members, COURSE_GROUP_MEMBER_HEADERS, memberRows);
    return { success: true, message: 'Random groups created successfully.', groups: createdGroups };
  } catch (error) {
    return { error: 'Failed to create random groups: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}

function createManualCourseGrouping(data) {
  return createCourseGroup(data);
}

// =====================================================
// PASSWORD HASHING (Improved with PBKDF2)
// =====================================================

/**
 * Generate a random salt using Google Apps Script compatible method
 */
function generateSalt() {
  // Use Utilities.getUuid() and timestamp for randomness, then hash it
  const randomSource = Utilities.getUuid() + new Date().getTime() + Math.random();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, randomSource);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Hash password using PBKDF2-like algorithm with salt
 * Iterations: 10000 (balance between security and Google Apps Script execution time)
 */
function hashPassword(password, salt) {
  if (!salt) {
    salt = generateSalt();
  }
  
  // PBKDF2 implementation using SHA-256
  let hash = password + salt;
  
  // 10000 iterations
  for (let i = 0; i < 10000; i++) {
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, 
      hash + i
    );
    hash = digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  }
  
  return { hash: hash, salt: salt };
}

/**
 * Verify password against stored hash
 */
function verifyPassword(password, storedHash, storedSalt) {
  const computed = hashPassword(password, storedSalt);
  return computed.hash === storedHash;
}

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

function checkUsernameAvailable(username) {
  if (!username || username.length < 4) {
    return { available: false, valid: false, error: 'Username must be at least 4 characters' };
  }
  
  // Username format validation (alphanumeric + underscore only)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { available: false, valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let userSheet = ss.getSheetByName('UserAccounts');
  
  if (!userSheet) {
    return { available: true, valid: true };
  }
  
  const data = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL.USERNAME] && String(data[i][COL.USERNAME]).toLowerCase() === username.toLowerCase()) {
      return { available: false, valid: true, error: 'Username is already taken' };
    }
  }
  
  return { available: true, valid: true };
}

function checkIdNumberAvailable(idNumber) {
  if (!idNumber || !/^\d{4}-\d{5}$/.test(idNumber)) {
    return { available: false, valid: false, error: 'Invalid ID format. Use: YYYY-NNNNN (e.g., 2025-12345)' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let userSheet = ss.getSheetByName('UserAccounts');
  
  if (!userSheet) {
    return { available: true, valid: true };
  }
  
  const data = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.ID_NUMBER]) === String(idNumber)) {
      return { available: false, valid: true, error: 'This ID number is already registered' };
    }
  }
  
  return { available: true, valid: true };
}

function checkEmailAvailable(email, type) {
  if (!email) {
    return { available: false, valid: false, error: 'Email is required' };
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { available: false, valid: false, error: 'Invalid email format' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let userSheet = ss.getSheetByName('UserAccounts');
  
  if (!userSheet) {
    return { available: true, valid: true };
  }
  
  const data = userSheet.getDataRange().getValues();
  const colIndex = type === 'school' ? COL.SCHOOL_EMAIL : COL.EMAIL;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] && String(data[i][colIndex]).toLowerCase() === email.toLowerCase()) {
      return { available: false, valid: true, error: `This ${type || 'email'} is already registered` };
    }
  }
  
  return { available: true, valid: true };
}

// =====================================================
// FILE UPLOAD HANDLERS
// =====================================================

/**
 * Helper function to get user info for file naming
 * @param {string} idNumber - ID Number to look up
 * @returns {Object} - { firstName, lastName, idNumber } or null
 */
function getUserInfoForFileName(idNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('UserAccounts');
  if (!userSheet) return null;
  
  const data = userSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL.ID_NUMBER] === idNumber) {
      return {
        firstName: data[i][COL.FIRST_NAME] || 'Unknown',
        lastName: data[i][COL.LAST_NAME] || 'User',
        idNumber: data[i][COL.ID_NUMBER]
      };
    }
  }
  return null;
}

/**
 * Upload profile picture to Google Drive
 * File naming: FirstName_LastName_IdNumber_ProfilePicture.ext
 * @param {Object} data - { idNumber, data (base64), mimeType, firstName, lastName }
 */
function uploadProfilePicture(data) {
  try {
    if (!data.idNumber) {
      return { error: 'ID Number is required' };
    }
    const auth = getAuthenticatedDirectoryContext(data.idNumber, data.sessionToken);
    if (auth.error) return { error: auth.error };
    
    // Get user info for file naming
    let userInfo = { firstName: data.firstName, lastName: data.lastName, idNumber: data.idNumber };
    if (!userInfo.firstName || !userInfo.lastName) {
      const dbInfo = getUserInfoForFileName(data.idNumber);
      if (dbInfo) {
        userInfo = { ...dbInfo, ...userInfo };
      }
    }
    
    const folder = DriveApp.getFolderById(DRIVE_FOLDERS.ProfilePictures);
    const ext = (data.mimeType || 'image/png').split('/')[1] || 'png';
    const fileNamePrefix = `${userInfo.firstName || 'User'}_${userInfo.lastName || 'Unknown'}_${userInfo.idNumber}`.replace(/\s+/g, '_');
    const fileName = `${fileNamePrefix}_ProfilePicture.${ext}`;
    
    // Delete existing profile pictures for this user
    const allFiles = folder.getFiles();
    while (allFiles.hasNext()) {
      const existingFile = allFiles.next();
      if (existingFile.getName().startsWith(fileNamePrefix)) {
        existingFile.setTrashed(true);
      }
    }
    
    const blob = Utilities.newBlob(
      Utilities.base64Decode(data.data), 
      data.mimeType, 
      fileName
    );
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    
    return { 
      success: true, 
      url: getFileUrl(fileId), 
      fileId: fileId,
      fileName: fileName,
      message: 'Profile picture uploaded successfully'
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Upload digital signature to Google Drive
 * File naming: FirstName_LastName_IdNumber_Signature.ext
 * @param {Object} data - { idNumber, data (base64), mimeType, firstName, lastName }
 */
function uploadDigitalSignature(data) {
  try {
    if (!data.idNumber) {
      return { error: 'ID Number is required' };
    }
    const auth = getAuthenticatedDirectoryContext(data.idNumber, data.sessionToken);
    if (auth.error) return { error: auth.error };
    
    // Get user info for file naming
    let userInfo = { firstName: data.firstName, lastName: data.lastName, idNumber: data.idNumber };
    if (!userInfo.firstName || !userInfo.lastName) {
      const dbInfo = getUserInfoForFileName(data.idNumber);
      if (dbInfo) {
        userInfo = { ...dbInfo, ...userInfo };
      }
    }
    
    const folder = DriveApp.getFolderById(DRIVE_FOLDERS.DigitalSignatures);
    const ext = (data.mimeType || 'image/png').split('/')[1] || 'png';
    const fileNamePrefix = `${userInfo.firstName || 'User'}_${userInfo.lastName || 'Unknown'}_${userInfo.idNumber}`.replace(/\s+/g, '_');
    const fileName = `${fileNamePrefix}_Signature.${ext}`;
    
    // Delete existing signatures for this user
    const allFiles = folder.getFiles();
    while (allFiles.hasNext()) {
      const existingFile = allFiles.next();
      if (existingFile.getName().startsWith(fileNamePrefix)) {
        existingFile.setTrashed(true);
      }
    }
    
    const blob = Utilities.newBlob(
      Utilities.base64Decode(data.data), 
      data.mimeType, 
      fileName
    );
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    
    return { 
      success: true, 
      url: getFileUrl(fileId), 
      fileId: fileId,
      fileName: fileName,
      message: 'Digital signature uploaded successfully'
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Save scanned QR code text to user profile
 * @param {Object} data - { idNumber, qrCodeText }
 */
function saveScannedQRCode(data) {
  try {
    if (!data.idNumber || !data.qrCodeText) {
      return { error: 'ID Number and QR code text are required' };
    }
    const auth = getAuthenticatedDirectoryContext(data.idNumber, data.sessionToken);
    if (auth.error) return { error: auth.error };
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('UserAccounts');
    
    if (!userSheet) {
      return { error: 'User sheet not found' };
    }
    
    const sheetData = userSheet.getDataRange().getValues();
    
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][COL.ID_NUMBER] === data.idNumber) {
        const encryptedQRValue = encryptQRValue(data.qrCodeText);
        userSheet.getRange(i + 1, COL.QR_CODE_VALUE + 1).setValue(encryptedQRValue);
        
        return {
          success: true,
          message: 'QR code text saved successfully',
          qrCodeText: data.qrCodeText
        };
      }
    }
    
    return { error: 'User not found' };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * General-purpose image upload to Google Drive (CORS-resilient)
 * Returns the direct googleusercontent URL for perfect rendering
 * 
 * Frontend must send Content-Type: text/plain;charset=utf-8 to bypass CORS preflight
 * @param {Object} data - { base64Data, fileName, mimeType, folderId? }
 */
function uploadImage(data) {
  try {
    const { base64Data, fileName, mimeType, folderId } = data;
    const auth = getAuthenticatedDirectoryContext(data.userId || data.idNumber, data.sessionToken);
    if (auth.error) return { error: auth.error };
    
    if (!base64Data || !fileName || !mimeType) {
      return { error: 'Missing required fields: base64Data, fileName, mimeType' };
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(mimeType.toLowerCase())) {
      return { error: 'Invalid file type. Allowed: PNG, JPG, WebP, GIF' };
    }
    
    // Use provided folder or default to ProfilePictures
    const targetFolderId = folderId || DRIVE_FOLDERS.ProfilePictures;
    const folder = DriveApp.getFolderById(targetFolderId);
    
    // Decode base64 and create blob
    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, mimeType, fileName);
    
    // Create file in Drive
    const file = folder.createFile(blob);
    
    // CRITICAL: Set public permissions for embedding
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    
    // CRITICAL: Construct the direct googleusercontent URL (best for embedding)
    const publicUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
    
    return {
      success: true,
      fileId: fileId,
      url: publicUrl,
      // Also provide alternative URLs for fallback
      alternativeUrls: {
        googleusercontent: publicUrl,
        thumbnail: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000',
        driveView: 'https://drive.google.com/uc?export=view&id=' + fileId
      },
      fileName: fileName,
      message: 'Image uploaded successfully'
    };
  } catch (error) {
    return { error: 'Upload failed: ' + error.message };
  }
}

/**
 * Simple encryption for QR value (for future enhancement)
 */
function encryptQRValue(value) {
  if (!value) return '';
  // Simple obfuscation - should be enhanced with proper encryption
  const encoded = Utilities.base64Encode(value);
  return encoded;
}

function decryptQRValue(encrypted) {
  if (!encrypted) return '';
  try {
    return Utilities.newBlob(Utilities.base64Decode(encrypted)).getDataAsString();
  } catch(e) {
    return '';
  }
}

// =====================================================
// EMAIL OTP VERIFICATION
// =====================================================

/**
 * Generate 6-digit OTP code
 */
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Fast hash for OTP codes (single SHA-256, no iterations needed for short-lived codes)
 */
function hashOTP(otp, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    otp + salt
  );
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Calculate OTP expiration based on failed attempts
 * 0 fails: 15 minutes
 * 1 fail: 15 minutes
 * 2 fails: 30 seconds
 * 3 fails: 1 minute
 * 4+ fails: 15 minutes lockout
 */
function getOTPExpiration(failedAttempts) {
  const now = new Date();
  
  if (failedAttempts === 0 || failedAttempts === 1) {
    // 15 minutes for first attempts
    return new Date(now.getTime() + 15 * 60 * 1000);
  } else if (failedAttempts === 2) {
    // 30 seconds after 2nd failure
    return new Date(now.getTime() + 30 * 1000);
  } else if (failedAttempts === 3) {
    // 1 minute after 3rd failure
    return new Date(now.getTime() + 60 * 1000);
  } else {
    // 15 minutes lockout after 4+ failures
    return new Date(now.getTime() + 15 * 60 * 1000);
  }
}

/**
 * Send OTP to email
 * @param {Object} data - { idNumber, email, emailType }
 */
function sendEmailOTP(data) {
  try {
    const { idNumber, email, emailType } = data;
    
    if (!idNumber || !email || !emailType) {
      return { error: 'Missing required fields (idNumber, email, emailType)' };
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { error: 'Invalid email format' };
    }
    const ownershipCheck = validateOtpRequestOwnership(idNumber, email, emailType);
    if (ownershipCheck.error) {
      return { error: ownershipCheck.error };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let emailVerifSheet = ss.getSheetByName('EmailVerifications');
    
    if (!emailVerifSheet) {
      setupSheets();
      emailVerifSheet = ss.getSheetByName('EmailVerifications');
    }

    removeExpiredOtpRows(emailVerifSheet);
    
    // Check if there's an existing active verification for this email
    const existingData = emailVerifSheet.getDataRange().getValues();
    let hasVerifiedRecord = false;
    let failedAttempts = 0;
    let sendCount = 0;
    let lastSentAt = null;
    
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][1] === idNumber && 
          existingData[i][2] === email && 
          existingData[i][3] === emailType) {
        sendCount++;
        const createdTs = existingData[i][5] ? new Date(existingData[i][5]) : null;
        if (createdTs && (!lastSentAt || createdTs > lastSentAt)) {
          lastSentAt = createdTs;
        }
        
        // Check if account is locked
        if (existingData[i][11]) { // lockedUntil column
          const lockTime = new Date(existingData[i][11]);
          if (lockTime > new Date()) {
            const remainingSeconds = Math.ceil((lockTime - new Date()) / 1000);
            return { 
              error: 'Too many failed attempts. Please try again later.',
              locked: true,
              lockedUntil: lockTime.toISOString(),
              remainingSeconds: remainingSeconds
            };
          }
        }
        
        // Get failed attempts count
        failedAttempts = existingData[i][10] || 0;
        
        // Keep verified rows until registration persists the verified flags.
        if (existingData[i][8] === true) {
          hasVerifiedRecord = true;
        }
      }
    }

    if (hasVerifiedRecord) {
      return {
        success: true,
        alreadyVerified: true,
        message: 'Email already verified; no new code sent'
      };
    }

    // Progressive resend cooldown: 30s, 1m, 5m, 12h
    if (sendCount > 0 && lastSentAt) {
      const cooldowns = [30, 60, 300, 43200];
      const idx = Math.min(sendCount - 1, cooldowns.length - 1);
      const waitMs = cooldowns[idx] * 1000;
      const elapsed = new Date().getTime() - lastSentAt.getTime();
      if (elapsed < waitMs) {
        const remainingSeconds = Math.ceil((waitMs - elapsed) / 1000);
        return {
          error: 'Please wait before requesting another code.',
          remainingSeconds: remainingSeconds,
          cooldownSeconds: cooldowns[idx]
        };
      }
    }
    
    // Generate OTP
    const otpCode = generateOTP();
    const otpHash = hashOTP(otpCode, idNumber); // Fast single-hash for OTP
    const verificationId = Utilities.getUuid();
    const createdAt = new Date().toISOString();
    const expiresAt = getOTPExpiration(failedAttempts).toISOString();
    
    // Send email using shared template helper when available
    let subject = `1SF Directory - Email Verification Code`;
    let htmlBody = '';
    if (typeof buildVerificationEmail === 'function') {
      const template = buildVerificationEmail({ code: otpCode, emailType: emailType, recipientEmail: email });
      subject = template.subject || subject;
      htmlBody = template.html || '';
    }
    
    try {
      if (htmlBody) {
        MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });
      } else {
        MailApp.sendEmail({ to: email, subject: subject, htmlBody: `Your verification code is ${otpCode}` });
      }
    } catch (emailError) {
      return { error: 'Failed to send email: ' + emailError.message };
    }
    
    // Store verification record (no plaintext OTP in production)
    emailVerifSheet.appendRow([
      verificationId,
      idNumber,
      email,
      emailType,
      otpHash,
      createdAt,
      expiresAt,
      0, // attempts
      false, // isVerified
      '', // verifiedAt
      failedAttempts,
      '' // lockedUntil
    ]);

    // Auto-clean if sheet grows large
    if (emailVerifSheet.getLastRow() > 1000) {
      cleanExpiredOtps();
    }
    
    return { 
      success: true, 
      verificationId: verificationId,
      expiresAt: expiresAt,
      message: `Verification code sent to ${email}`,
      failedAttempts: failedAttempts
    };
    
  } catch (error) {
    return { error: error.message, stack: error.stack };
  }
}

/**
 * Remove old/expired OTP records to avoid sheet bloat
 * - Removes rows where:
 *   a) isVerified is true AND verifiedAt older than retentionDays
 *   b) expired (expiresAt < now)
 * Default retention: 7 days
 */
function cleanExpiredOtps(retentionDays) {
  const days = retentionDays || 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('EmailVerifications');
  if (!sheet) return { success: false, message: 'EmailVerifications sheet not found' };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, removed: 0 };

  let removed = 0;
  // Traverse bottom-up for safe deletions
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const isVerified = row[8] === true;
    const verifiedAt = row[9] ? new Date(row[9]) : null;
    const expiresAt = row[6] ? new Date(row[6]) : null;

    const shouldRemove =
      (isVerified && verifiedAt && verifiedAt < cutoff) ||
      (!isVerified && expiresAt && expiresAt < now);

    if (shouldRemove) {
      sheet.deleteRow(i + 1); // 1-based
      removed++;
    }
  }

  return { success: true, removed: removed };
}

function cleanExpiredOtpsScheduled() {
  return cleanExpiredOtps();
}

function ensureOtpCleanupTrigger() {
  const handler = 'cleanExpiredOtpsScheduled';
  const triggers = ScriptApp.getProjectTriggers();

  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === handler) {
      return { success: true, exists: true, message: 'OTP cleanup trigger already installed' };
    }
  }

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyHours(1)
    .create();

  return { success: true, created: true, message: 'Installed hourly OTP cleanup trigger' };
}

function removeExpiredOtpRows(sheet) {
  if (!sheet) return 0;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;

  const now = new Date();
  let removed = 0;

  for (let i = data.length - 1; i >= 1; i--) {
    const expiresAt = data[i][6] ? new Date(data[i][6]) : null;
    const isVerified = data[i][8] === true;
    if (!isVerified && expiresAt && expiresAt < now) {
      sheet.deleteRow(i + 1);
      removed++;
    }
  }

  return removed;
}

function removeVerifiedOtpRowsForEmail(sheet, idNumber, email, emailType) {
  if (!sheet || !idNumber || !email || !emailType) return 0;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;

  let removed = 0;

  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const isMatch =
      row[1] === idNumber &&
      row[2] === email &&
      row[3] === emailType &&
      row[8] === true;

    if (isMatch) {
      sheet.deleteRow(i + 1);
      removed++;
    }
  }

  return removed;
}

/**
 * Show daily email quota in a sidebar
 */
function showEmailQuotaSidebar() {
  const quota = MailApp.getRemainingDailyQuota();
  const maxPerDay = 1500; // Apps Script consumer default; adjust if domain quota differs
  const used = Math.max(0, maxPerDay - quota);

  const html = HtmlService.createHtmlOutput(`
    <div style="font-family:Segoe UI, Arial, sans-serif; padding:16px; color:#111827;">
      <h2 style="margin:0 0 8px 0; font-size:18px;">1SF Directory</h2>
      <div style="margin-bottom:12px; color:#4b5563;">Email Quota (per 24h)</div>
      <div style="padding:12px; border:1px solid #e5e7eb; border-radius:8px; background:#f9fafb;">
        <div style="font-size:14px; margin-bottom:6px;"><strong>Remaining:</strong> ${quota}</div>
        <div style="font-size:14px; margin-bottom:6px;"><strong>Used:</strong> ${used}</div>
        <div style="font-size:14px;"><strong>Limit:</strong> ${maxPerDay}</div>
      </div>
      <div style="margin-top:14px; font-size:12px; color:#6b7280; line-height:1.5;">
        This is the current Apps Script daily send limit. Large attachments or high volume may reduce availability.
      </div>
      <div style="margin-top:14px;">
        <button onclick="google.script.run.cleanExpiredOtps();" style="padding:8px 12px; background:#111827; color:#fff; border:none; border-radius:6px; cursor:pointer;">Clean Expired OTPs</button>
      </div>
    </div>
  `);

  html.setTitle('1SF Directory');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Verify OTP code
 * @param {Object} data - { idNumber, email, emailType, otpCode }
 */
function verifyEmailOTP(data) {
  try {
    const { idNumber, email, emailType, otpCode } = data;
    
    if (!idNumber || !email || !emailType || !otpCode) {
      return { error: 'Missing required fields' };
    }
    const ownershipCheck = validateOtpRequestOwnership(idNumber, email, emailType);
    if (ownershipCheck.error) {
      return { error: ownershipCheck.error };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let emailVerifSheet = ss.getSheetByName('EmailVerifications');
    
    if (!emailVerifSheet) {
      return { error: 'No verification records found' };
    }
    
    const sheetData = emailVerifSheet.getDataRange().getValues();
    const now = new Date();
    
    // Find the most recent verification record for this email
    let verificationRow = -1;
    let mostRecentDate = null;
    
    for (let i = sheetData.length - 1; i >= 1; i--) {
      if (sheetData[i][1] === idNumber && 
          sheetData[i][2] === email && 
          sheetData[i][3] === emailType &&
          sheetData[i][8] !== true) { // Not already verified
        
        const createdDate = new Date(sheetData[i][5]);
        if (!mostRecentDate || createdDate > mostRecentDate) {
          mostRecentDate = createdDate;
          verificationRow = i;
        }
      }
    }
    
    if (verificationRow === -1) {
      return { error: 'No pending verification found for this email' };
    }
    
    const row = sheetData[verificationRow];
    
    // Check if locked
    if (row[11]) {
      const lockTime = new Date(row[11]);
      if (lockTime > now) {
        const remainingSeconds = Math.ceil((lockTime - now) / 1000);
        return { 
          error: 'Account temporarily locked due to too many failed attempts',
          locked: true,
          remainingSeconds: remainingSeconds,
          lockedUntil: lockTime.toISOString()
        };
      }
    }
    
    // Check if expired
    const expiresAt = new Date(row[6]);
    if (expiresAt < now) {
      emailVerifSheet.deleteRow(verificationRow + 1);
      return { 
        error: 'Verification code has expired. Please request a new one.',
        expired: true
      };
    }
    
    // Check attempts limit
    const attempts = row[7] || 0;
    if (attempts >= 5) {
      // Lock account for 15 minutes
      const lockUntil = new Date(now.getTime() + 15 * 60 * 1000);
      emailVerifSheet.getRange(verificationRow + 1, 12).setValue(lockUntil.toISOString());
      return { 
        error: 'Too many failed attempts. Account locked for 15 minutes.',
        locked: true,
        lockedUntil: lockUntil.toISOString()
      };
    }
    
    // Verify OTP
    const storedOtpHash = row[4];
    const computedHash = hashOTP(otpCode, idNumber);
    
    if (computedHash !== storedOtpHash) {
      // Increment attempts and failed attempts
      const newAttempts = attempts + 1;
      const newFailedAttempts = (row[10] || 0) + 1;
      
      emailVerifSheet.getRange(verificationRow + 1, 8).setValue(newAttempts);
      emailVerifSheet.getRange(verificationRow + 1, 11).setValue(newFailedAttempts);
      
      // Check if we need to lock after this failure
      if (newAttempts >= 5) {
        const lockUntil = new Date(now.getTime() + 15 * 60 * 1000);
        emailVerifSheet.getRange(verificationRow + 1, 12).setValue(lockUntil.toISOString());
        return { 
          error: 'Invalid code. Too many failed attempts. Account locked for 15 minutes.',
          locked: true,
          lockedUntil: lockUntil.toISOString()
        };
      }
      
      return { 
        error: 'Invalid verification code',
        attempts: newAttempts,
        remainingAttempts: 5 - newAttempts
      };
    }
    
    // OTP is correct - mark as verified
    const verifiedAt = now.toISOString();
    emailVerifSheet.getRange(verificationRow + 1, 9).setValue(true); // isVerified
    emailVerifSheet.getRange(verificationRow + 1, 10).setValue(verifiedAt); // verifiedAt

    // Clean up other verified rows for this user/email/type to avoid clutter
    for (let i = sheetData.length - 1; i >= 1; i--) {
      if (i === verificationRow) continue;
      const rowMatch = sheetData[i][1] === idNumber && sheetData[i][2] === email && sheetData[i][3] === emailType;
      if (rowMatch && sheetData[i][8] === true) {
        emailVerifSheet.deleteRow(i + 1);
      }
    }
    
    // Update user account to mark email as verified
    let userSheet = ss.getSheetByName('UserAccounts');
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      for (let i = 1; i < userData.length; i++) {
        if (userData[i][COL.ID_NUMBER] === idNumber) {
          if (!doesDirectoryEmailMatchUserRow(userData[i], email, emailType)) {
            return { error: 'The verified email no longer matches the account record.' };
          }
          const verifiedColumn = getDirectoryVerifiedColumnByType(emailType);
          userSheet.getRange(i + 1, verifiedColumn + 1).setValue(true);
          break;
        }
      }
    }
    
    return { 
      success: true, 
      verified: true,
      message: 'Email verified successfully',
      verifiedAt: verifiedAt
    };
    
  } catch (error) {
    return { error: error.message, stack: error.stack };
  }
}

/**
 * Resend OTP (creates new verification record)
 */
function resendEmailOTP(data) {
  return sendEmailOTP(data);
}

// =====================================================
// USER REGISTRATION
// =====================================================

/**
 * Register a new user with full profile
 * @param {Object} data - User registration data
 */
function registerUser(data) {
  try {
    // Validate required fields
    if (!data.username || data.username.length < 4) {
      return { error: 'Username must be at least 4 characters' };
    }
    
    if (!data.password || data.password.length < 8) {
      return { error: 'Password must be at least 8 characters' };
    }
    
    if (!data.idNumber || !/^\d{4}-\d{5}$/.test(data.idNumber)) {
      return { error: 'Invalid ID number format (must be YYYY-NNNNN)' };
    }
    
    if (!data.firstName || !data.lastName) {
      return { error: 'First name and last name are required' };
    }
    
    if (!data.email) {
      return { error: 'Email is required' };
    }

    if (!data.schoolEmail) {
      return { error: 'School email is required' };
    }
    
    // Validate username availability
    const usernameCheck = checkUsernameAvailable(data.username);
    if (!usernameCheck.available) {
      return { error: usernameCheck.error || 'Username is already taken' };
    }
    
    // Validate ID number availability
    const idCheck = checkIdNumberAvailable(data.idNumber);
    if (!idCheck.available) {
      return { error: idCheck.error || 'ID number is already registered' };
    }
    
    // Validate email availability
    const emailCheck = checkEmailAvailable(data.email, 'personal');
    if (!emailCheck.available) {
      return { error: emailCheck.error || 'Email is already registered' };
    }
    
    const schoolEmailCheck = checkEmailAvailable(data.schoolEmail, 'school');
    if (!schoolEmailCheck.available) {
      return { error: schoolEmailCheck.error || 'School email is already registered' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let userSheet = ss.getSheetByName('UserAccounts');
    
    if (!userSheet) {
      setupSheets();
      userSheet = ss.getSheetByName('UserAccounts');
    }
    
    // Hash password with unique salt
    const passwordData = hashPassword(data.password);
    
    const now = new Date().toISOString();
    
    // Generate file naming prefix: FirstName_LastName_IdNumber
    const fileNamePrefix = `${data.firstName}_${data.lastName}_${data.idNumber}`.replace(/\s+/g, '_');

    // Check if this email/school email already verified in EmailVerifications
    let emailVerifiedFlag = data.emailVerified === true;
    let schoolEmailVerifiedFlag = data.schoolEmailVerified === true;
    
    const emailVerifSheet = ss.getSheetByName('EmailVerifications');
    if (emailVerifSheet) {
      const verifData = emailVerifSheet.getDataRange().getValues();
      for (let i = 1; i < verifData.length; i++) {
        if (verifData[i][1] === data.idNumber && verifData[i][8] === true) {
          const vEmail = verifData[i][2];
          const vType = verifData[i][3];
          if (vType === 'personal' && vEmail === data.email) emailVerifiedFlag = true;
          if (vType === 'school' && vEmail === data.schoolEmail) schoolEmailVerifiedFlag = true;
        }
      }
    }
    
    // Handle profile picture upload if provided as dataURL
    let profilePictureFileId = data.profilePictureFileId || '';
    
    if (data.profilePictureURL && data.profilePictureURL.startsWith('data:image')) {
      try {
        const folder = DriveApp.getFolderById(DRIVE_FOLDERS.ProfilePictures);
        const base64Data = data.profilePictureURL.split(',')[1];
        const mimeType = data.profilePictureURL.match(/data:([^;]+);/)?.[1] || 'image/png';
        const ext = mimeType.split('/')[1] || 'png';
        const fileName = `${fileNamePrefix}_ProfilePicture.${ext}`;
        
        // Delete existing files with same name
        const existingFiles = folder.getFilesByName(fileName);
        while (existingFiles.hasNext()) {
          existingFiles.next().setTrashed(true);
        }
        
        const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        profilePictureFileId = file.getId();
      } catch (picError) {
        Logger.log('Profile picture upload error: ' + picError.message);
      }
    }
    
    // Handle digital signature upload if provided as dataURL
    let digitalSignatureFileId = data.digitalSignatureFileId || '';
    
    if (data.digitalSignatureURL && data.digitalSignatureURL.startsWith('data:image')) {
      try {
        const folder = DriveApp.getFolderById(DRIVE_FOLDERS.DigitalSignatures);
        const base64Data = data.digitalSignatureURL.split(',')[1];
        const mimeType = data.digitalSignatureURL.match(/data:([^;]+);/)?.[1] || 'image/png';
        const ext = mimeType.split('/')[1] || 'png';
        const fileName = `${fileNamePrefix}_Signature.${ext}`;
        
        // Delete existing files with same name
        const existingFiles = folder.getFilesByName(fileName);
        while (existingFiles.hasNext()) {
          existingFiles.next().setTrashed(true);
        }
        
        const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        digitalSignatureFileId = file.getId();
      } catch (sigError) {
        Logger.log('Signature upload error: ' + sigError.message);
      }
    }
    
    // Handle QR code value
    let qrCodeValue = data.qrCodeValue ? encryptQRValue(data.qrCodeValue) : '';
    
    // Create user record (27 columns)
    userSheet.appendRow([
      data.idNumber,                    // A: idNumber (PRIMARY KEY)
      data.username.toLowerCase(),      // B: username
      passwordData.hash,                // C: passwordHash
      passwordData.salt,                // D: passwordSalt
      data.firstName,                   // E: firstName
      data.lastName,                    // F: lastName
      data.email,                       // G: email
      emailVerifiedFlag,                // H: emailVerified
      data.schoolEmail,                 // I: schoolEmail
      schoolEmailVerifiedFlag,          // J: schoolEmailVerified
      data.birthday || '',              // K: birthday
      profilePictureFileId,             // L: profilePictureFileId
      digitalSignatureFileId,           // M: digitalSignatureFileId
      qrCodeValue,                      // N: qrCodeValue
      data.school || 'University of Southeastern Philippines Tagum Unit',  // O: school
      data.college || 'College of Teacher Education and Technology',       // P: college
      data.program || 'Bachelor of Secondary Education',                   // Q: program
      data.major || '',                 // R: major
      data.year || 1,                   // S: year
      data.section || '',               // T: section
      'student',                        // U: role
      '',                               // V: position (Mayor, Vice Mayor, Secretary, etc.)
      0,                                // W: loginAttempts
      false,                            // X: accountLocked
      '',                               // Y: lockedUntil
      now,                              // Z: createdDate
      now                               // AA: lastLogin
    ]);

    if (emailVerifSheet) {
      if (emailVerifiedFlag) {
        removeVerifiedOtpRowsForEmail(emailVerifSheet, data.idNumber, data.email, 'personal');
      }
      if (schoolEmailVerifiedFlag) {
        removeVerifiedOtpRowsForEmail(emailVerifSheet, data.idNumber, data.schoolEmail, 'school');
      }
    }
    
    // Return user object
    return {
      success: true,
      idNumber: data.idNumber,
      user: {
        idNumber: data.idNumber,
        username: data.username.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: `${data.firstName} ${data.lastName}`,
        email: data.email,
        emailVerified: emailVerifiedFlag,
        schoolEmail: data.schoolEmail,
        schoolEmailVerified: schoolEmailVerifiedFlag,
        birthday: data.birthday || '',
        profilePictureURL: getFileUrl(profilePictureFileId),
        digitalSignatureURL: getFileUrl(digitalSignatureFileId),
        qrCodeValue: data.qrCodeValue || '',
        school: data.school || 'University of Southeastern Philippines Tagum Unit',
        college: data.college || 'College of Teacher Education and Technology',
        program: data.program || 'Bachelor of Secondary Education',
        major: data.major || '',
        year: data.year || 1,
        section: data.section || '',
        role: 'student',
        position: '',
        createdDate: now,
        lastLogin: now
      },
      message: 'Account created successfully!'
    };
    
  } catch (error) {
    return { error: error.message, stack: error.stack };
  }
}

// =====================================================
// USER AUTHENTICATION
// =====================================================

/**
 * Login with username and password
 */
function loginWithPassword(username, password) {
  try {
    if (!username || !password) {
      return { error: 'Username and password are required' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('UserAccounts');
    
    if (!userSheet) {
      return { error: 'No user accounts found. Please register first.' };
    }
    
    const data = userSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.USERNAME] && data[i][COL.USERNAME].toLowerCase() === username.toLowerCase()) {
        
        // Check if account is locked
        if (data[i][COL.ACCOUNT_LOCKED]) {
          if (data[i][COL.LOCKED_UNTIL]) {
            const lockTime = new Date(data[i][COL.LOCKED_UNTIL]);
            if (lockTime > new Date()) {
              const remainingSeconds = Math.ceil((lockTime - new Date()) / 1000);
              return { 
                error: 'Account temporarily locked due to failed login attempts',
                locked: true,
                remainingSeconds: remainingSeconds
              };
            } else {
              // Lock expired - reset
              userSheet.getRange(i + 1, COL.ACCOUNT_LOCKED + 1).setValue(false);
              userSheet.getRange(i + 1, COL.LOCKED_UNTIL + 1).setValue('');
              userSheet.getRange(i + 1, COL.LOGIN_ATTEMPTS + 1).setValue(0);
            }
          }
        }
        
        // Verify password
        const storedHash = data[i][COL.PASSWORD_HASH];
        const storedSalt = data[i][COL.PASSWORD_SALT];
        
        if (!verifyPassword(password, storedHash, storedSalt)) {
          // Increment login attempts
          const attempts = (data[i][COL.LOGIN_ATTEMPTS] || 0) + 1;
          userSheet.getRange(i + 1, COL.LOGIN_ATTEMPTS + 1).setValue(attempts);
          
          // Lock account after 5 failed attempts
          if (attempts >= 5) {
            const lockUntil = new Date(new Date().getTime() + 15 * 60 * 1000);
            userSheet.getRange(i + 1, COL.ACCOUNT_LOCKED + 1).setValue(true);
            userSheet.getRange(i + 1, COL.LOCKED_UNTIL + 1).setValue(lockUntil.toISOString());
            return { 
              error: 'Invalid password. Account locked for 15 minutes due to too many failed attempts.',
              locked: true
            };
          }
          
          return { 
            error: 'Invalid password',
            attempts: attempts,
            remainingAttempts: 5 - attempts
          };
        }
        
        // Password correct - reset login attempts and update last login
        const now = new Date().toISOString();
        userSheet.getRange(i + 1, COL.LOGIN_ATTEMPTS + 1).setValue(0);
        userSheet.getRange(i + 1, COL.LAST_LOGIN + 1).setValue(now);
        
        // Return user data
        const sessionToken = storeSessionToken(data[i][COL.ID_NUMBER]);

        return {
          success: true,
          user: {
            idNumber: data[i][COL.ID_NUMBER],
            username: data[i][COL.USERNAME],
            firstName: data[i][COL.FIRST_NAME],
            lastName: data[i][COL.LAST_NAME],
            fullName: `${data[i][COL.FIRST_NAME]} ${data[i][COL.LAST_NAME]}`,
            email: data[i][COL.EMAIL],
            emailVerified: data[i][COL.EMAIL_VERIFIED] === true,
            schoolEmail: data[i][COL.SCHOOL_EMAIL],
            schoolEmailVerified: data[i][COL.SCHOOL_EMAIL_VERIFIED] === true,
            birthday: data[i][COL.BIRTHDAY],
            profilePictureURL: getFileUrl(data[i][COL.PROFILE_PICTURE_FILE_ID]),
            digitalSignatureURL: getFileUrl(data[i][COL.DIGITAL_SIGNATURE_FILE_ID]),
            school: data[i][COL.SCHOOL],
            college: data[i][COL.COLLEGE],
            program: data[i][COL.PROGRAM],
            major: data[i][COL.MAJOR],
            year: data[i][COL.YEAR],
            section: data[i][COL.SECTION],
            role: data[i][COL.ROLE],
            position: data[i][COL.POSITION],
            createdDate: data[i][COL.CREATED_DATE],
            lastLogin: now,
            sessionToken: sessionToken
          }
        };
      }
    }
    
    return { error: 'Username not found' };
    
  } catch (error) {
    return { error: error.message, stack: error.stack };
  }
}

// =====================================================
// PROFILE MANAGEMENT
// =====================================================

/**
 * Get user profile by idNumber (primary key)
 */
function getUserProfile(input) {
  try {
    const isObjectInput = typeof input === 'object' && input !== null;
    const idNumber = isObjectInput ? input.idNumber : input;
    const sessionToken = isObjectInput ? input.sessionToken : '';
    const shouldAuthorize = isObjectInput;

    if (!idNumber) {
      return { error: 'ID Number is required' };
    }
    if (shouldAuthorize) {
      const auth = getAuthenticatedDirectoryContext(idNumber, sessionToken);
      if (auth.error) return { error: auth.error };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('UserAccounts');
    
    if (!userSheet) {
      return { error: 'User sheet not found' };
    }
    
    const data = userSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][COL.ID_NUMBER] === idNumber) {
        return {
          success: true,
          user: {
            idNumber: data[i][COL.ID_NUMBER],
            username: data[i][COL.USERNAME],
            firstName: data[i][COL.FIRST_NAME],
            lastName: data[i][COL.LAST_NAME],
            fullName: `${data[i][COL.FIRST_NAME]} ${data[i][COL.LAST_NAME]}`,
            email: data[i][COL.EMAIL],
            emailVerified: data[i][COL.EMAIL_VERIFIED] === true,
            schoolEmail: data[i][COL.SCHOOL_EMAIL],
            schoolEmailVerified: data[i][COL.SCHOOL_EMAIL_VERIFIED] === true,
            birthday: data[i][COL.BIRTHDAY],
            profilePictureURL: getFileUrl(data[i][COL.PROFILE_PICTURE_FILE_ID]),
            profilePictureFileId: data[i][COL.PROFILE_PICTURE_FILE_ID],
            digitalSignatureURL: getFileUrl(data[i][COL.DIGITAL_SIGNATURE_FILE_ID]),
            digitalSignatureFileId: data[i][COL.DIGITAL_SIGNATURE_FILE_ID],
            qrCodeValue: data[i][COL.QR_CODE_VALUE] ? decryptQRValue(data[i][COL.QR_CODE_VALUE]) : '',
            school: data[i][COL.SCHOOL],
            college: data[i][COL.COLLEGE],
            program: data[i][COL.PROGRAM],
            major: data[i][COL.MAJOR],
            year: data[i][COL.YEAR],
            section: data[i][COL.SECTION],
            role: data[i][COL.ROLE],
            position: data[i][COL.POSITION],
            createdDate: data[i][COL.CREATED_DATE],
            lastLogin: data[i][COL.LAST_LOGIN]
          }
        };
      }
    }
    
    return { error: 'User not found' };
    
  } catch (error) {
    return { error: error.message, stack: error.stack };
  }
}

/**
 * Find user profile by the saved QR code text.
 */
function findUserByQRCode(input) {
  try {
    const targetQrCode = String((typeof input === 'object' && input !== null ? input.qrCodeText : input) || '').trim();
    if (!targetQrCode) {
      return { error: 'QR code text is required' };
    }
    if (typeof input === 'object' && input !== null) {
      const auth = getAuthenticatedDirectoryContext(input.userId, input.sessionToken);
      if (auth.error) return { error: auth.error };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('UserAccounts');

    if (!userSheet) {
      return { error: 'User sheet not found' };
    }

    const data = userSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const savedQrCode = data[i][COL.QR_CODE_VALUE] ? decryptQRValue(data[i][COL.QR_CODE_VALUE]) : '';
      if (String(savedQrCode || '').trim() !== targetQrCode) {
        continue;
      }

      return {
        success: true,
        user: {
          idNumber: data[i][COL.ID_NUMBER],
          firstName: data[i][COL.FIRST_NAME],
          lastName: data[i][COL.LAST_NAME],
          fullName: `${data[i][COL.FIRST_NAME] || ''} ${data[i][COL.LAST_NAME] || ''}`.trim(),
          school: data[i][COL.SCHOOL],
          college: data[i][COL.COLLEGE],
          program: data[i][COL.PROGRAM],
          major: data[i][COL.MAJOR],
          year: data[i][COL.YEAR],
          section: data[i][COL.SECTION],
          role: data[i][COL.ROLE],
          position: data[i][COL.POSITION]
        }
      };
    }

    return { error: 'User not found for the provided QR code' };
  } catch (error) {
    return { error: error.message, stack: error.stack };
  }
}

/**
 * Normalize text values for reliable class matching.
 */
function normalizeClassField(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Get classmates who share the same class profile as the requester.
 * Matching fields: school, college, program, year, section, and major when set.
 */
function getClassmates(input, section) {
  try {
    const isObjectInput = typeof input === 'object' && input !== null;
    const idNumber = isObjectInput ? input.idNumber : input;
    const resolvedSection = isObjectInput ? input.section : section;
    if (!idNumber) {
      return { error: 'ID Number is required', classmates: [] };
    }
    if (isObjectInput) {
      const auth = getAuthenticatedDirectoryContext(idNumber, input.sessionToken);
      if (auth.error) return { error: auth.error, classmates: [] };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('UserAccounts');

    if (!userSheet) {
      return { error: 'User sheet not found', classmates: [] };
    }

    const data = userSheet.getDataRange().getValues();
    let requester = null;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][COL.ID_NUMBER]) === String(idNumber)) {
        requester = data[i];
        break;
      }
    }

    if (!requester) {
      return { error: 'User not found', classmates: [] };
    }

    const requesterSection = normalizeClassField(requester[COL.SECTION] || resolvedSection);
    if (!requesterSection) {
      return { error: 'Section is required', classmates: [] };
    }

    const requesterSchool = normalizeClassField(requester[COL.SCHOOL]);
    const requesterCollege = normalizeClassField(requester[COL.COLLEGE]);
    const requesterProgram = normalizeClassField(requester[COL.PROGRAM]);
    const requesterMajor = normalizeClassField(requester[COL.MAJOR]);
    const requesterYear = String(requester[COL.YEAR] || '').trim();

    const classmates = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowSection = normalizeClassField(row[COL.SECTION]);
      const rowSchool = normalizeClassField(row[COL.SCHOOL]);
      const rowCollege = normalizeClassField(row[COL.COLLEGE]);
      const rowProgram = normalizeClassField(row[COL.PROGRAM]);
      const rowMajor = normalizeClassField(row[COL.MAJOR]);
      const rowYear = String(row[COL.YEAR] || '').trim();

      const matchesBaseClass =
        rowSection === requesterSection &&
        rowSchool === requesterSchool &&
        rowCollege === requesterCollege &&
        rowProgram === requesterProgram &&
        rowYear === requesterYear;

      if (!matchesBaseClass) {
        continue;
      }

      // Only enforce major when both sides have a value.
      if (requesterMajor && rowMajor && rowMajor !== requesterMajor) {
        continue;
      }

      classmates.push({
        idNumber: String(row[COL.ID_NUMBER] || ''),
        username: row[COL.USERNAME] || '',
        name: `${row[COL.FIRST_NAME] || ''} ${row[COL.LAST_NAME] || ''}`.trim(),
        profilePicture: getFileUrl(row[COL.PROFILE_PICTURE_FILE_ID]),
        birthday: row[COL.BIRTHDAY] || '',
        email: row[COL.EMAIL] || '',
        schoolEmail: row[COL.SCHOOL_EMAIL] || '',
        school: row[COL.SCHOOL] || '',
        college: row[COL.COLLEGE] || '',
        program: row[COL.PROGRAM] || '',
        major: row[COL.MAJOR] || '',
        year: row[COL.YEAR] || 1,
        section: row[COL.SECTION] || '',
        role: row[COL.ROLE] || 'student',
        position: row[COL.POSITION] || '',
        createdAt: row[COL.CREATED_DATE] || ''
      });
    }

    classmates.sort((a, b) => a.name.localeCompare(b.name));

    return {
      success: true,
      classmates: classmates,
      filters: {
        school: requester[COL.SCHOOL] || '',
        college: requester[COL.COLLEGE] || '',
        program: requester[COL.PROGRAM] || '',
        major: requester[COL.MAJOR] || '',
        year: requester[COL.YEAR] || '',
        section: requester[COL.SECTION] || resolvedSection || ''
      }
    };
  } catch (error) {
    return { error: error.message, classmates: [] };
  }
}

/**
 * Update user role and class position (admin only).
 */
function updateUserRole(adminIdNumber, targetIdNumber, role, position, sessionToken) {
  try {
    const callerIdNumber = getIdNumberFromSessionToken(sessionToken);

    if (!callerIdNumber) {
      return { error: 'Unauthorized. Please log in again.' };
    }

    if (adminIdNumber && String(adminIdNumber) !== String(callerIdNumber)) {
      return { error: 'Unauthorized request context.' };
    }

    if (!targetIdNumber) {
      return { error: 'Target ID Number is required' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('UserAccounts');

    if (!userSheet) {
      return { error: 'User sheet not found' };
    }

    const data = userSheet.getDataRange().getValues();

    let caller = null;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][COL.ID_NUMBER]) === String(callerIdNumber)) {
        caller = data[i];
        break;
      }
    }

    if (!caller) {
      return { error: 'Unauthorized. Admin account not found.' };
    }

    const callerRole = String(caller[COL.ROLE] || '').toLowerCase();
    const isAllowedAdmin =
      callerRole === 'admin' ||
      callerRole === 'superadmin';

    if (!isAllowedAdmin) {
      return { error: 'Unauthorized. Only admin can assign roles.' };
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][COL.ID_NUMBER]) === String(targetIdNumber)) {
        userSheet.getRange(i + 1, COL.ROLE + 1).setValue(role || 'student');
        userSheet.getRange(i + 1, COL.POSITION + 1).setValue(position || '');

        return {
          success: true,
          user: {
            idNumber: String(targetIdNumber),
            role: role || 'student',
            position: position || ''
          }
        };
      }
    }

    return { error: 'User not found' };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Update user profile
 */
function updateUserProfile(data) {
  try {
    if (!data.idNumber) {
      return { error: 'ID Number is required' };
    }
    const auth = getAuthenticatedDirectoryContext(data.idNumber, data.sessionToken);
    if (auth.error) return { error: auth.error };
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const userSheet = ss.getSheetByName('UserAccounts');
    
    if (!userSheet) {
      return { error: 'User sheet not found' };
    }
    
    const sheetData = userSheet.getDataRange().getValues();
    
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][COL.ID_NUMBER] === data.idNumber) {
        const now = new Date().toISOString();
        const currentEmail = sheetData[i][COL.EMAIL];
        const currentSchoolEmail = sheetData[i][COL.SCHOOL_EMAIL];
        const personalEmailChanged = data.email !== undefined && String(data.email || '') !== String(currentEmail || '');
        const schoolEmailChanged = data.schoolEmail !== undefined && String(data.schoolEmail || '') !== String(currentSchoolEmail || '');

        if (data.email !== undefined) {
          const emailCheck = checkEmailAvailable(data.email, 'personal');
          if (!emailCheck.available && String(data.email || '').toLowerCase() !== String(currentEmail || '').toLowerCase()) {
            return { error: emailCheck.error || 'Email is already registered' };
          }
        }

        if (data.schoolEmail !== undefined) {
          const schoolEmailCheck = checkEmailAvailable(data.schoolEmail, 'school');
          if (!schoolEmailCheck.available && String(data.schoolEmail || '').toLowerCase() !== String(currentSchoolEmail || '').toLowerCase()) {
            return { error: schoolEmailCheck.error || 'School email is already registered' };
          }
        }

        if (data.newPassword && data.newPassword.length < 8) {
          return { error: 'New password must be at least 8 characters' };
        }

        if (data.newUsername && String(data.newUsername).toLowerCase() !== String(sheetData[i][COL.USERNAME] || '').toLowerCase()) {
          const usernameCheck = checkUsernameAvailable(data.newUsername);
          if (!usernameCheck.available) {
            return { error: usernameCheck.error || 'Username is already taken' };
          }
        }
        
        // Update allowed fields using COL constants (1-based indexing for getRange, so +1)
        if (data.firstName !== undefined) userSheet.getRange(i + 1, COL.FIRST_NAME + 1).setValue(data.firstName);
        if (data.lastName !== undefined) userSheet.getRange(i + 1, COL.LAST_NAME + 1).setValue(data.lastName);
        if (data.birthday !== undefined) userSheet.getRange(i + 1, COL.BIRTHDAY + 1).setValue(data.birthday);
        if (data.email !== undefined) userSheet.getRange(i + 1, COL.EMAIL + 1).setValue(data.email);
        if (data.schoolEmail !== undefined) userSheet.getRange(i + 1, COL.SCHOOL_EMAIL + 1).setValue(data.schoolEmail);
        if (data.profilePictureFileId !== undefined) userSheet.getRange(i + 1, COL.PROFILE_PICTURE_FILE_ID + 1).setValue(data.profilePictureFileId);
        if (data.digitalSignatureFileId !== undefined) userSheet.getRange(i + 1, COL.DIGITAL_SIGNATURE_FILE_ID + 1).setValue(data.digitalSignatureFileId);
        if (data.qrCodeValue !== undefined) userSheet.getRange(i + 1, COL.QR_CODE_VALUE + 1).setValue(encryptQRValue(data.qrCodeValue));
        if (data.major !== undefined) userSheet.getRange(i + 1, COL.MAJOR + 1).setValue(data.major);
        if (data.year !== undefined) userSheet.getRange(i + 1, COL.YEAR + 1).setValue(data.year);
        if (data.section !== undefined) userSheet.getRange(i + 1, COL.SECTION + 1).setValue(data.section);

        if (personalEmailChanged) {
          userSheet.getRange(i + 1, COL.EMAIL_VERIFIED + 1).setValue(false);
        }

        if (schoolEmailChanged) {
          userSheet.getRange(i + 1, COL.SCHOOL_EMAIL_VERIFIED + 1).setValue(false);
        }
        
        // Update lastLogin as activity marker
        userSheet.getRange(i + 1, COL.LAST_LOGIN + 1).setValue(now);
        
        // Handle password change
        if (data.newPassword) {
          const passwordData = hashPassword(data.newPassword);
          userSheet.getRange(i + 1, COL.PASSWORD_HASH + 1).setValue(passwordData.hash);
          userSheet.getRange(i + 1, COL.PASSWORD_SALT + 1).setValue(passwordData.salt);
        }
        
        // Handle username change
        if (data.newUsername && String(data.newUsername).toLowerCase() !== String(sheetData[i][COL.USERNAME] || '').toLowerCase()) {
          userSheet.getRange(i + 1, COL.USERNAME + 1).setValue(data.newUsername.toLowerCase());
        }
        
        return {
          success: true,
          message: 'Profile updated successfully',
          emailVerified: personalEmailChanged ? false : sheetData[i][COL.EMAIL_VERIFIED] === true,
          schoolEmailVerified: schoolEmailChanged ? false : sheetData[i][COL.SCHOOL_EMAIL_VERIFIED] === true
        };
      }
    }
    
    return { error: 'User not found' };
    
  } catch (error) {
    return { error: error.message, stack: error.stack };
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Test function - call this to verify setup
 */
function testRegistration() {
  // First setup sheets
  Logger.log(setupSheets());
  
  // Test registration
  const testUser = {
    username: 'testuser123',
    password: 'TestPassword123!',
    idNumber: '2025-12345',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan@example.com',
    schoolEmail: 'juan@ustp.edu.ph',
    birthday: '2000-01-01',
    major: 'Mathematics',
    year: 2,
    section: 'A',
    position: 'Mayor'  // Test position field
  };
  
  const result = registerUser(testUser);
  Logger.log('Registration Result:');
  Logger.log(result);
  
  return result;
}

/**
 * Test OTP sending
 */
function testOTPSending() {
  const data = {
    idNumber: '2025-12345',  // Changed from userId
    email: 'your-email@gmail.com', // Replace with your email
    emailType: 'personal'
  };
  
  const result = sendEmailOTP(data);
  Logger.log('OTP Send Result:');
  Logger.log(result);
  
  return result;
}

function inspectOtpRecords(idNumber, email, emailType) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('EmailVerifications');
  if (!sheet) return { success: false, error: 'EmailVerifications sheet not found' };

  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const matchesId = !idNumber || String(row[1]) === String(idNumber);
    const matchesEmail = !email || String(row[2]) === String(email);
    const matchesType = !emailType || String(row[3]) === String(emailType);

    if (matchesId && matchesEmail && matchesType) {
      records.push({
        rowNumber: i + 1,
        verificationId: row[0],
        idNumber: row[1],
        email: row[2],
        emailType: row[3],
        createdAt: row[5],
        expiresAt: row[6],
        attempts: row[7],
        isVerified: row[8] === true,
        verifiedAt: row[9],
        failedAttempts: row[10] || 0,
        lockedUntil: row[11] || ''
      });
    }
  }

  return {
    success: true,
    count: records.length,
    records: records
  };
}

function testOtpCleanupFlow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('EmailVerifications');
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName('EmailVerifications');
  }

  const stamp = new Date().getTime();
  const idNumber = 'TEST-' + stamp;
  const email = 'otp-cleanup-' + stamp + '@example.com';
  const emailType = 'personal';
  const now = Date.now();
  const oldIso = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
  const expiredIso = new Date(now - 10 * 60 * 1000).toISOString();
  const futureIso = new Date(now + 10 * 60 * 1000).toISOString();

  sheet.appendRow([
    Utilities.getUuid(),
    idNumber,
    email,
    emailType,
    'expired-hash',
    oldIso,
    expiredIso,
    0,
    false,
    '',
    0,
    ''
  ]);

  sheet.appendRow([
    Utilities.getUuid(),
    idNumber,
    email,
    emailType,
    'verified-hash',
    oldIso,
    futureIso,
    0,
    true,
    oldIso,
    0,
    ''
  ]);

  sheet.appendRow([
    Utilities.getUuid(),
    idNumber,
    email,
    emailType,
    'active-hash',
    new Date(now).toISOString(),
    futureIso,
    0,
    false,
    '',
    0,
    ''
  ]);

  const before = inspectOtpRecords(idNumber, email, emailType);
  const cleanup = cleanExpiredOtps();
  const afterGlobalCleanup = inspectOtpRecords(idNumber, email, emailType);
  const removedActiveExpired = removeExpiredOtpRows(sheet);
  const afterActiveCleanup = inspectOtpRecords(idNumber, email, emailType);
  const removedVerified = removeVerifiedOtpRowsForEmail(sheet, idNumber, email, emailType);
  const finalState = inspectOtpRecords(idNumber, email, emailType);

  const result = {
    success: true,
    testIdNumber: idNumber,
    beforeCount: before.count,
    afterGlobalCleanupCount: afterGlobalCleanup.count,
    afterActiveCleanupCount: afterActiveCleanup.count,
    finalCount: finalState.count,
    cleanupResult: cleanup,
    removedActiveExpired: removedActiveExpired,
    removedVerified: removedVerified,
    finalRecords: finalState.records
  };

  Logger.log('OTP Cleanup Flow Test Result:');
  Logger.log(result);
  return result;
}
