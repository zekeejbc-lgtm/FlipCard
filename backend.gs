/**
 * FlashMaster Google Apps Script Backend
 * 
 * SHEETS STRUCTURE:
 * 
 * 1. User Sheet (name: "User")
 *    - Column A: ID Number (format: 2025-00000)
 *    - Column B: Name
 *    - Column C: Record (JSON string of user progress)
 * 
 * 2. Category Sheet (name: "Category")
 *    - Row 1: Subject headers in odd columns (A=FL111, C=FL112, E=EDUC112, etc.)
 *    - Even columns (B, D, F, etc.) are "Category" labels - ignored
 * 
 * 3. Resources Sheet (name: "Resources")
 *    - Column A: Title
 *    - Column B: Description
 *    - Column C: Subject (FL111, FL112, etc.)
 *    - Column D: Category (Lesson PPT, Lesson PDF, Video, Reviewer)
 *    - Column E: URL (Google Drive link)
 *    - Column F: SubmittedBy (User ID)
 *    - Column G: SubmittedByName (User Name)
 *    - Column H: Timestamp
 * 
 * 4. Flashcard Sheets (any sheet NOT named User, Category, or Resources)
 *    - Cell C1: Display name (shown in frontend)
 *    - Cell D1: Subject category (FL111, FL112, EDUC112, etc.)
 *    - Column A: Question
 *    - Column B: Answer
 *    - Row 1 is the header row (ignored for Q&A)
 * 
 * GOOGLE DRIVE FOLDER IDs:
 */

const DRIVE_FOLDERS = {
  'Lesson PPT': '1XXa2wCPpEryBWa4mVXiVNMMwY2BKvfCb',
  'Lesson PDF': '1TWdoPCALda3BRyavwHFOFxoyQN7wx0PP',
  'Video': '1aaNEEUoUR_NRsXDCyh6ctgz4AXPbhAUr',
  'Reviewer': '1D8P1n1AiOx4ZB6mXoR9DbcAwaJNhwcdx'
};

function doGet(e) {
  try {
    const action = e.parameter.action || 'getAll';
    
    switch(action) {
      case 'getAll':
        return jsonResponse(getAllData());
      case 'getUser':
        return jsonResponse(getUser(e.parameter.idNumber));
      case 'getDecks':
        return jsonResponse(getAllDecks());
      case 'getCategories':
        return jsonResponse(getCategories());
      case 'getResources':
        return jsonResponse(getResources());
      case 'getSubjects':
        return jsonResponse(getSubjects());
      case 'setupSheets':
        return jsonResponse(setupSheets());
      default:
        return jsonResponse(getAllData());
    }
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch(action) {
      case 'login':
        return jsonResponse(loginOrCreateUser(data.idNumber, data.name));
      case 'updateRecord':
        return jsonResponse(updateUserRecord(data.idNumber, data.record));
      case 'uploadResource':
        return jsonResponse(uploadResource(data));
      case 'deleteResource':
        return jsonResponse(deleteResource(data.resourceUrl, data.userId));
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Setup all required sheets with proper columns
 * Run this function to initialize the spreadsheet structure
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = [];
  
  // 1. Setup User sheet
  let userSheet = ss.getSheetByName('User');
  if (!userSheet) {
    userSheet = ss.insertSheet('User');
    userSheet.appendRow(['ID Number', 'Name', 'Record']);
    userSheet.setFrozenRows(1);
    results.push('Created User sheet');
  } else {
    // Check if headers exist
    const headers = userSheet.getRange(1, 1, 1, 3).getValues()[0];
    if (headers[0] !== 'ID Number') {
      userSheet.getRange(1, 1, 1, 3).setValues([['ID Number', 'Name', 'Record']]);
      results.push('Updated User sheet headers');
    } else {
      results.push('User sheet already exists');
    }
  }
  
  // 2. Setup Category sheet
  let categorySheet = ss.getSheetByName('Category');
  if (!categorySheet) {
    categorySheet = ss.insertSheet('Category');
    categorySheet.appendRow(['FL111', 'Category', 'FL112', 'Category', 'EDUC112', 'Category', 'EDUC111', 'Category', 'GE111', 'Category', 'GE112', 'Category', 'PE111', 'Category', 'NSTP111', 'Category']);
    categorySheet.setFrozenRows(1);
    results.push('Created Category sheet with default subjects');
  } else {
    results.push('Category sheet already exists');
  }
  
  // 3. Setup Resources sheet with new structure
  let resourceSheet = ss.getSheetByName('Resources');
  if (!resourceSheet) {
    resourceSheet = ss.insertSheet('Resources');
    resourceSheet.appendRow(['Title', 'Description', 'Subject', 'Category', 'URL', 'SubmittedBy', 'SubmittedByName', 'Timestamp']);
    resourceSheet.setFrozenRows(1);
    results.push('Created Resources sheet');
  } else {
    // Check if new structure exists
    const headers = resourceSheet.getRange(1, 1, 1, 8).getValues()[0];
    if (headers[0] !== 'Title') {
      // Old structure - need to migrate or reset
      results.push('Resources sheet exists with old structure - please backup and delete to use new structure');
    } else {
      results.push('Resources sheet already exists');
    }
  }
  
  return { 
    success: true, 
    message: 'Setup complete', 
    details: results 
  };
}

/**
 * Get all data needed by the app
 */
function getAllData() {
  return {
    decks: getAllDecks(),
    categories: getCategories(),
    resources: getResources(),
    subjects: getSubjects()
  };
}

/**
 * Login or create a new user
 * @param {string} idNumber - Format: 2025-00000
 * @param {string} name - User's name
 */
function loginOrCreateUser(idNumber, name) {
  // Validate ID format
  const idPattern = /^\d{4}-\d{5}$/;
  if (!idPattern.test(idNumber)) {
    return { error: 'Invalid ID format. Use format: 2025-00000' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let userSheet = ss.getSheetByName('User');
  
  // Create User sheet if it doesn't exist
  if (!userSheet) {
    userSheet = ss.insertSheet('User');
    userSheet.appendRow(['ID Number', 'Name', 'Record']);
  }
  
  const data = userSheet.getDataRange().getValues();
  
  // Find existing user
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idNumber)) {
      // User exists, return their data
      let record = {};
      try {
        record = data[i][2] ? JSON.parse(data[i][2]) : {};
      } catch(e) {
        record = {};
      }
      return {
        success: true,
        isNew: false,
        user: {
          idNumber: String(data[i][0]),
          name: data[i][1],
          record: record
        }
      };
    }
  }
  
  // Create new user
  userSheet.appendRow([idNumber, name, '{}']);
  return {
    success: true,
    isNew: true,
    user: {
      idNumber: idNumber,
      name: name,
      record: {}
    }
  };
}

/**
 * Get user by ID number
 */
function getUser(idNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('User');
  
  if (!userSheet) {
    return { error: 'User sheet not found' };
  }
  
  const data = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idNumber)) {
      let record = {};
      try {
        record = data[i][2] ? JSON.parse(data[i][2]) : {};
      } catch(e) {
        record = {};
      }
      return {
        success: true,
        user: {
          idNumber: String(data[i][0]),
          name: data[i][1],
          record: record
        }
      };
    }
  }
  
  return { error: 'User not found' };
}

/**
 * Update user's record/progress
 */
function updateUserRecord(idNumber, record) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('User');
  
  if (!userSheet) {
    return { error: 'User sheet not found' };
  }
  
  const data = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idNumber)) {
      userSheet.getRange(i + 1, 3).setValue(JSON.stringify(record));
      return { success: true };
    }
  }
  
  return { error: 'User not found' };
}

/**
 * Upload a resource file to Google Drive and save to Resources sheet
 * @param {Object} data - { title, description, subject, category, fileData (base64), fileName, mimeType, userId, userName }
 */
function uploadResource(data) {
  try {
    const { title, description, subject, category, fileData, fileName, mimeType, userId, userName } = data;
    
    // Validate required fields
    if (!title || !subject || !category || !fileData || !fileName || !userId) {
      return { error: 'Missing required fields' };
    }
    
    // Get the folder ID for this category
    const folderId = DRIVE_FOLDERS[category];
    if (!folderId) {
      return { error: 'Invalid category' };
    }
    
    // Decode base64 file data
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
    
    // Get the folder
    const folder = DriveApp.getFolderById(folderId);
    
    // Create file in folder
    const file = folder.createFile(blob);
    
    // Make file viewable by anyone with the link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Get the public view URL
    const fileUrl = file.getUrl();
    const fileId = file.getId();
    
    // Save to Resources sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let resourceSheet = ss.getSheetByName('Resources');
    
    if (!resourceSheet) {
      resourceSheet = ss.insertSheet('Resources');
      resourceSheet.appendRow(['Title', 'Description', 'Subject', 'Category', 'URL', 'SubmittedBy', 'SubmittedByName', 'Timestamp']);
    }
    
    const timestamp = new Date().toISOString();
    resourceSheet.appendRow([title, description || '', subject, category, fileUrl, userId, userName || '', timestamp]);
    
    return {
      success: true,
      resource: {
        id: fileId,
        title: title,
        description: description || '',
        subject: subject,
        category: category,
        url: fileUrl,
        submittedBy: userId,
        submittedByName: userName || '',
        timestamp: timestamp
      }
    };
  } catch (error) {
    return { error: 'Upload failed: ' + error.message };
  }
}

/**
 * Delete a resource (only by the owner)
 * @param {string} resourceUrl - The URL of the resource to delete
 * @param {string} userId - The ID of the user requesting deletion
 */
function deleteResource(resourceUrl, userId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const resourceSheet = ss.getSheetByName('Resources');
    
    if (!resourceSheet) {
      return { error: 'Resources sheet not found' };
    }
    
    const data = resourceSheet.getDataRange().getValues();
    
    // Find the resource
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === resourceUrl) { // Column E is URL
        // Check if user is the owner
        if (String(data[i][5]) !== String(userId)) { // Column F is SubmittedBy
          return { error: 'You can only delete your own submissions' };
        }
        
        // Try to delete the file from Drive
        try {
          const fileId = extractFileIdFromUrl(resourceUrl);
          if (fileId) {
            DriveApp.getFileById(fileId).setTrashed(true);
          }
        } catch (e) {
          // File might already be deleted or inaccessible
          Logger.log('Could not delete file from Drive: ' + e.message);
        }
        
        // Delete the row from the sheet
        resourceSheet.deleteRow(i + 1);
        
        return { success: true, message: 'Resource deleted successfully' };
      }
    }
    
    return { error: 'Resource not found' };
  } catch (error) {
    return { error: 'Delete failed: ' + error.message };
  }
}

/**
 * Extract file ID from Google Drive URL
 */
function extractFileIdFromUrl(url) {
  // Handle different Google Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Get resources from Resources sheet (new format)
 * Returns: { "FL111": [{id, title, description, category, url, submittedBy, submittedByName, timestamp}], ... }
 */
function getResources() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resourceSheet = ss.getSheetByName('Resources');
  
  if (!resourceSheet) {
    return {};
  }
  
  const data = resourceSheet.getDataRange().getValues();
  if (data.length <= 1) return {};
  
  const result = {};
  
  // Check if it's the new format (Title in A1)
  if (data[0][0] === 'Title') {
    // New format: Title, Description, Subject, Category, URL, SubmittedBy, SubmittedByName, Timestamp
    for (let row = 1; row < data.length; row++) {
      const title = data[row][0];
      const description = data[row][1] || '';
      const subject = data[row][2];
      const category = data[row][3];
      const url = data[row][4];
      const submittedBy = data[row][5];
      const submittedByName = data[row][6] || '';
      const timestamp = data[row][7] || '';
      
      if (!subject || !url) continue;
      
      if (!result[subject]) {
        result[subject] = [];
      }
      
      result[subject].push({
        id: extractFileIdFromUrl(url) || url,
        name: String(title).trim(),
        title: String(title).trim(),
        description: String(description).trim(),
        category: String(category).trim() || 'Files',
        url: String(url).trim(),
        submittedBy: String(submittedBy),
        submittedByName: String(submittedByName),
        timestamp: String(timestamp)
      });
    }
  } else {
    // Old format: fallback to paired columns
    const headers = data[0];
    
    for (let col = 0; col < headers.length; col += 2) {
      const subject = headers[col];
      if (!subject || String(subject).trim() === '') continue;
      
      result[subject] = [];
      
      for (let row = 1; row < data.length; row++) {
        const resourceName = data[row][col];
        const resourceData = data[row][col + 1] || '';
        
        if (resourceName && String(resourceName).trim() !== '') {
          const parts = String(resourceData).split('|');
          let category = 'Files';
          let url = resourceData;
          
          if (parts.length === 2) {
            category = parts[0].trim();
            url = parts[1].trim();
          }
          
          result[subject].push({
            id: url,
            name: String(resourceName).trim(),
            title: String(resourceName).trim(),
            description: '',
            category: category,
            url: url,
            submittedBy: '',
            submittedByName: '',
            timestamp: ''
          });
        }
      }
    }
  }
  
  return result;
}

/**
 * Get all decks from flashcard sheets
 * Skips special sheets (User, Category, Resources)
 * Uses C1 as display name, D1 as subject category, A=Question, B=Answer
 */
function getAllDecks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const result = {};
  const specialSheets = ['User', 'Category', 'Resources'];

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();
    
    // Skip special sheets
    if (specialSheets.includes(sheetName)) {
      continue;
    }
    
    // Get all data from the sheet
    const data = sheet.getDataRange().getValues();
    
    // Skip if sheet is empty or has only header row
    if (data.length <= 1) {
      continue;
    }
    
    // Get display name from C1, fallback to sheet name if empty
    const displayName = (data[0][2] && String(data[0][2]).trim() !== '') 
      ? String(data[0][2]).trim() 
      : sheetName;
    
    // Get subject/category from D1, default to "Uncategorized"
    const subject = (data[0][3] && String(data[0][3]).trim() !== '') 
      ? String(data[0][3]).trim() 
      : 'Uncategorized';

    const cards = [];
    
    // Start from row 2 (index 1) to skip the header row
    for (let row = 1; row < data.length; row++) {
      const question = data[row][0];
      const answer = data[row][1];
      
      if (question && answer && 
          String(question).trim() !== '' && 
          String(answer).trim() !== '') {
        cards.push({
          q: String(question).trim(),
          a: String(answer).trim()
        });
      }
    }

    if (cards.length > 0) {
      result[displayName] = {
        sheetName: sheetName,
        subject: subject,
        cards: cards
      };
    }
  }

  return result;
}

/**
 * Get categories - built automatically from deck subjects
 */
function getCategories() {
  const decks = getAllDecks();
  const categories = {};
  
  for (const [displayName, deckData] of Object.entries(decks)) {
    const subject = deckData.subject || 'Uncategorized';
    
    if (!categories[subject]) {
      categories[subject] = [];
    }
    
    categories[subject].push({
      name: displayName,
      category: 'Flashcard'
    });
  }
  
  return categories;
}

/**
 * Get subjects from Category sheet
 * Reads row 1, odd columns (A, C, E, G, etc.) - skips "Category" columns (B, D, F, H, etc.)
 * Returns array of subject names like ["FL111", "FL112", "EDUC112", ...]
 */
function getSubjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const categorySheet = ss.getSheetByName('Category');
  
  if (!categorySheet) {
    // Fallback: extract unique subjects from decks
    const decks = getAllDecks();
    const subjectSet = new Set();
    for (const deckData of Object.values(decks)) {
      if (deckData.subject) {
        subjectSet.add(deckData.subject);
      }
    }
    return Array.from(subjectSet);
  }
  
  const data = categorySheet.getDataRange().getValues();
  if (data.length === 0) return [];
  
  const headers = data[0];
  const subjects = [];
  
  // Read odd columns (0, 2, 4, 6, ...) which are A, C, E, G, ...
  for (let col = 0; col < headers.length; col += 2) {
    const subject = headers[col];
    if (subject && String(subject).trim() !== '' && String(subject).trim().toLowerCase() !== 'category') {
      subjects.push(String(subject).trim());
    }
  }
  
  return subjects;
}

/**
 * Test function - Run this to verify your data
 */
function testGetAllData() {
  const result = getAllData();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testLogin() {
  const result = loginOrCreateUser('2025-12345', 'Test User');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSetupSheets() {
  const result = setupSheets();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
