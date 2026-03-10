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

// =====================================================
// MAIN REQUEST HANDLERS
// =====================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('1SF Directory')
    .addItem('Setup Sheets', 'setupSheets')
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
        return jsonResponse(getUserProfile(data.idNumber));
      case 'findUserByQRCode':
        return jsonResponse(findUserByQRCode(data.qrCodeText));
      case 'getClassmates':
        return jsonResponse(getClassmates(data.idNumber, data.section));
      case 'updateUserRole':
        return jsonResponse(updateUserRole(data.adminIdNumber, data.targetIdNumber, data.role, data.position, data.sessionToken));
      
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
  
  return { success: true, results: results };
}

/**
 * Initialize all sheets - alternative name for convenience
 */
function initiateSheets() {
  return setupSheets();
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
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let emailVerifSheet = ss.getSheetByName('EmailVerifications');
    
    if (!emailVerifSheet) {
      setupSheets();
      emailVerifSheet = ss.getSheetByName('EmailVerifications');
    }
    
    // Check if there's an existing active verification for this email
    const existingData = emailVerifSheet.getDataRange().getValues();
    const rowsToDelete = [];
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
        
        // Mark verified records for cleanup to avoid clutter
        if (existingData[i][8] === true) {
          hasVerifiedRecord = true;
          rowsToDelete.push(i + 1); // 1-based row index for deletion
        }
      }
    }

    // Remove old verified rows for this email/emailType to keep the sheet tidy
    if (rowsToDelete.length > 0) {
      rowsToDelete.sort((a, b) => b - a).forEach(rowIdx => emailVerifSheet.deleteRow(rowIdx));
      if (hasVerifiedRecord) {
        return {
          success: true,
          alreadyVerified: true,
          message: 'Email already verified; no new code sent'
        };
      }
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
 *   b) expired (expiresAt < now) and older than retentionDays
 * Default retention: 7 days
 */
function cleanExpiredOtps(retentionDays) {
  const days = retentionDays || 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
      (!isVerified && expiresAt && expiresAt < cutoff);

    if (shouldRemove) {
      sheet.deleteRow(i + 1); // 1-based
      removed++;
    }
  }

  return { success: true, removed: removed };
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
          const verifiedColumn = emailType === 'school' ? COL.SCHOOL_EMAIL_VERIFIED : COL.EMAIL_VERIFIED;
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
function getUserProfile(idNumber) {
  try {
    if (!idNumber) {
      return { error: 'ID Number is required' };
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
function findUserByQRCode(qrCodeText) {
  try {
    const targetQrCode = String(qrCodeText || '').trim();
    if (!targetQrCode) {
      return { error: 'QR code text is required' };
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
function getClassmates(idNumber, section) {
  try {
    if (!idNumber) {
      return { error: 'ID Number is required', classmates: [] };
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

    const requesterSection = normalizeClassField(requester[COL.SECTION] || section);
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
        section: requester[COL.SECTION] || section || ''
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
          if (data.newPassword.length < 8) {
            return { error: 'New password must be at least 8 characters' };
          }
          const passwordData = hashPassword(data.newPassword);
          userSheet.getRange(i + 1, COL.PASSWORD_HASH + 1).setValue(passwordData.hash);
          userSheet.getRange(i + 1, COL.PASSWORD_SALT + 1).setValue(passwordData.salt);
        }
        
        // Handle username change
        if (data.newUsername && data.newUsername !== sheetData[i][COL.USERNAME]) {
          const usernameCheck = checkUsernameAvailable(data.newUsername);
          if (!usernameCheck.available) {
            return { error: 'Username is already taken' };
          }
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
