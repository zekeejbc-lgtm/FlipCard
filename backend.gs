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
      case 'saveAnalytics':
        return jsonResponse(saveAnalytics(data));
      case 'getAnalytics':
        return jsonResponse(getAnalytics(data.idNumber));
      case 'getUserAnalytics':
        return jsonResponse(getUserAnalytics(data.idNumber, data.subject));
      case 'uploadResource':
        return jsonResponse(uploadResource(data));
      case 'deleteResource':
        return jsonResponse(deleteResource(data.resourceUrl, data.userId));
      case 'addResourceByLink':
        return jsonResponse(addResourceByLink(data));
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
  
  // 1. Setup User sheet with analytics column
  let userSheet = ss.getSheetByName('User');
  if (!userSheet) {
    userSheet = ss.insertSheet('User');
    userSheet.appendRow(['ID Number', 'Name', 'Record', 'Analytics', 'LastActive']);
    userSheet.setFrozenRows(1);
    results.push('Created User sheet with analytics columns');
  } else {
    // Check if headers exist and update if needed
    const headers = userSheet.getRange(1, 1, 1, 5).getValues()[0];
    if (headers[0] !== 'ID Number' || headers[3] !== 'Analytics') {
      userSheet.getRange(1, 1, 1, 5).setValues([['ID Number', 'Name', 'Record', 'Analytics', 'LastActive']]);
      results.push('Updated User sheet headers with analytics');
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
  
  // 3. Setup Resources sheet with Title and Description
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
  
  // 4. Setup Analytics sheet for tracking user progress
  let analyticsSheet = ss.getSheetByName('Analytics');
  if (!analyticsSheet) {
    analyticsSheet = ss.insertSheet('Analytics');
    analyticsSheet.appendRow(['UserID', 'Subject', 'Deck', 'TotalAttempts', 'CorrectAnswers', 'IncorrectAnswers', 'LastPlayed', 'BestScore', 'AverageScore', 'TimeSpent']);
    analyticsSheet.setFrozenRows(1);
    results.push('Created Analytics sheet');
  } else {
    results.push('Analytics sheet already exists');
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
 * Save analytics data for a flashcard session
 * @param {Object} data - { idNumber, subject, deck, correct, incorrect, timeSpent }
 */
function saveAnalytics(data) {
  try {
    const { idNumber, subject, deck, correct, incorrect, timeSpent } = data;
    
    if (!idNumber || !subject || !deck) {
      return { error: 'Missing required fields' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const analyticsSheet = ss.getSheetByName('Analytics');
    
    if (!analyticsSheet) {
      return { error: 'Analytics sheet not found. Please run setupSheets first.' };
    }
    
    const totalAttempts = (correct || 0) + (incorrect || 0);
    const score = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;
    const now = new Date().toISOString();
    
    // Find existing row for this user/subject/deck combo
    const analyticsData = analyticsSheet.getDataRange().getValues();
    let existingRow = -1;
    
    for (let i = 1; i < analyticsData.length; i++) {
      if (String(analyticsData[i][0]) === String(idNumber) && 
          String(analyticsData[i][1]) === String(subject) && 
          String(analyticsData[i][2]) === String(deck)) {
        existingRow = i + 1;
        break;
      }
    }
    
    if (existingRow > 0) {
      // Update existing record
      const oldTotalAttempts = analyticsData[existingRow - 1][3] || 0;
      const oldCorrect = analyticsData[existingRow - 1][4] || 0;
      const oldIncorrect = analyticsData[existingRow - 1][5] || 0;
      const oldBestScore = analyticsData[existingRow - 1][7] || 0;
      const oldTimeSpent = analyticsData[existingRow - 1][9] || 0;
      
      const newTotalAttempts = oldTotalAttempts + totalAttempts;
      const newCorrect = oldCorrect + correct;
      const newIncorrect = oldIncorrect + incorrect;
      const newBestScore = Math.max(oldBestScore, score);
      const newAvgScore = newTotalAttempts > 0 ? Math.round((newCorrect / newTotalAttempts) * 100) : 0;
      const newTimeSpent = oldTimeSpent + (timeSpent || 0);
      
      analyticsSheet.getRange(existingRow, 4, 1, 7).setValues([[
        newTotalAttempts, newCorrect, newIncorrect, now, newBestScore, newAvgScore, newTimeSpent
      ]]);
    } else {
      // Add new record
      analyticsSheet.appendRow([
        idNumber, subject, deck, totalAttempts, correct, incorrect, now, score, score, timeSpent || 0
      ]);
    }
    
    // Also update User Record JSON for quick access
    updateUserRecordWithAnalytics(idNumber, subject, deck, correct, incorrect, score);
    
    return { success: true };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Update user's Record JSON with analytics summary
 */
function updateUserRecordWithAnalytics(idNumber, subject, deck, correct, incorrect, score) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('User');
  
  if (!userSheet) return;
  
  const data = userSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idNumber)) {
      let record = {};
      try {
        record = JSON.parse(data[i][2] || '{}');
      } catch (e) {
        record = {};
      }
      
      // Initialize structure if needed
      if (!record.analytics) {
        record.analytics = { subjects: {} };
      }
      if (!record.analytics.subjects[subject]) {
        record.analytics.subjects[subject] = {
          totalAttempts: 0,
          correct: 0,
          incorrect: 0,
          decks: {}
        };
      }
      if (!record.analytics.subjects[subject].decks[deck]) {
        record.analytics.subjects[subject].decks[deck] = {
          attempts: 0,
          correct: 0,
          incorrect: 0,
          bestScore: 0,
          lastPlayed: null
        };
      }
      
      // Update subject totals
      record.analytics.subjects[subject].totalAttempts += (correct + incorrect);
      record.analytics.subjects[subject].correct += correct;
      record.analytics.subjects[subject].incorrect += incorrect;
      
      // Update deck stats
      const deckStats = record.analytics.subjects[subject].decks[deck];
      deckStats.attempts += (correct + incorrect);
      deckStats.correct += correct;
      deckStats.incorrect += incorrect;
      deckStats.bestScore = Math.max(deckStats.bestScore, score);
      deckStats.lastPlayed = new Date().toISOString();
      
      userSheet.getRange(i + 1, 3).setValue(JSON.stringify(record));
      break;
    }
  }
}

/**
 * Get all analytics for a user
 * @param {string} idNumber - User ID
 */
function getAnalytics(idNumber) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const analyticsSheet = ss.getSheetByName('Analytics');
    
    if (!analyticsSheet) {
      return { error: 'Analytics sheet not found' };
    }
    
    const data = analyticsSheet.getDataRange().getValues();
    const headers = data[0];
    const analytics = [];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idNumber)) {
        analytics.push({
          subject: data[i][1],
          deck: data[i][2],
          totalAttempts: data[i][3],
          correctAnswers: data[i][4],
          incorrectAnswers: data[i][5],
          lastPlayed: data[i][6],
          bestScore: data[i][7],
          averageScore: data[i][8],
          timeSpent: data[i][9]
        });
      }
    }
    
    // Also get summary from user record
    const userSheet = ss.getSheetByName('User');
    let recordAnalytics = null;
    
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      for (let i = 1; i < userData.length; i++) {
        if (String(userData[i][0]) === String(idNumber)) {
          try {
            const record = JSON.parse(userData[i][2] || '{}');
            recordAnalytics = record.analytics || null;
          } catch (e) {}
          break;
        }
      }
    }
    
    return { 
      success: true, 
      analytics: analytics,
      summary: recordAnalytics
    };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Get analytics for a specific user and subject
 * @param {string} idNumber - User ID
 * @param {string} subject - Subject code (optional)
 */
function getUserAnalytics(idNumber, subject) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const analyticsSheet = ss.getSheetByName('Analytics');
    
    if (!analyticsSheet) {
      return { error: 'Analytics sheet not found' };
    }
    
    const data = analyticsSheet.getDataRange().getValues();
    const analytics = [];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idNumber)) {
        // If subject specified, filter by it
        if (!subject || String(data[i][1]) === String(subject)) {
          analytics.push({
            subject: data[i][1],
            deck: data[i][2],
            totalAttempts: data[i][3],
            correctAnswers: data[i][4],
            incorrectAnswers: data[i][5],
            lastPlayed: data[i][6],
            bestScore: data[i][7],
            averageScore: data[i][8],
            timeSpent: data[i][9]
          });
        }
      }
    }
    
    // Calculate aggregated stats
    let totalAttempts = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalTimeSpent = 0;
    let overallBestScore = 0;
    
    analytics.forEach(a => {
      totalAttempts += a.totalAttempts || 0;
      totalCorrect += a.correctAnswers || 0;
      totalIncorrect += a.incorrectAnswers || 0;
      totalTimeSpent += a.timeSpent || 0;
      overallBestScore = Math.max(overallBestScore, a.bestScore || 0);
    });
    
    const overallAverage = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    
    return { 
      success: true, 
      analytics: analytics,
      aggregated: {
        totalAttempts,
        totalCorrect,
        totalIncorrect,
        totalTimeSpent,
        overallBestScore,
        overallAverage,
        decksPlayed: analytics.length
      }
    };
  } catch (error) {
    return { error: error.toString() };
  }
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
 * Add a resource by external link (user uploads to Drive manually)
 * @param {Object} data - Resource data with link
 */
function addResourceByLink(data) {
  try {
    const { title, description, subject, category, link, userId, userName } = data;
    
    // Validate required fields
    if (!title || !subject || !category || !link || !userId) {
      return { error: 'Missing required fields' };
    }
    
    // Validate that it's a Google Drive link
    if (!link.includes('drive.google.com') && !link.includes('docs.google.com')) {
      return { error: 'Please provide a valid Google Drive link' };
    }
    
    // Save to Resources sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let resourceSheet = ss.getSheetByName('Resources');
    
    if (!resourceSheet) {
      resourceSheet = ss.insertSheet('Resources');
      resourceSheet.appendRow(['Title', 'Description', 'Subject', 'Category', 'URL', 'SubmittedBy', 'SubmittedByName', 'Timestamp']);
    }
    
    const timestamp = new Date().toISOString();
    resourceSheet.appendRow([title, description || '', subject, category, link, userId, userName || '', timestamp]);
    
    // Try to extract file ID for the resource object
    const fileId = extractFileIdFromUrl(link);
    
    return {
      success: true,
      resource: {
        id: fileId || 'external-' + Date.now(),
        title: title,
        description: description || '',
        subject: subject,
        category: category,
        url: link,
        submittedBy: userId,
        submittedByName: userName || '',
        timestamp: timestamp
      }
    };
  } catch (error) {
    return { error: 'Failed to add resource: ' + error.message };
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
  const specialSheets = ['User', 'Category', 'Resources', 'Analytics'];

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
