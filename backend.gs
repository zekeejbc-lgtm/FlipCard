/**
 * CumLaude! Google Apps Script Backend
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
        return jsonResponse(getAllData(e.parameter.userId));
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
        return jsonResponse(getAllData(e.parameter.userId));
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
      case 'saveDeckProgress':
        return jsonResponse(saveDeckProgress(data));
      case 'getDeckProgress':
        return jsonResponse(getDeckProgress(data.idNumber, data.deckName));
      case 'getAllDeckProgress':
        return jsonResponse(getAllDeckProgress(data.idNumber));
      case 'clearDeckProgress':
        return jsonResponse(clearDeckProgressBackend(data.idNumber, data.deckName));
      case 'addExam':
        return jsonResponse(addExam(data));
      case 'updateExam':
        return jsonResponse(updateExam(data));
      case 'deleteExam':
        return jsonResponse(deleteExam(data.examId, data.userId));
      case 'getExams':
        return jsonResponse(getExams(data.subject));
      case 'getCacheVersion':
        return jsonResponse(getCacheVersion());
      case 'bumpCacheVersion':
        return jsonResponse(bumpCacheVersion(data.userId));
      case 'createAnnouncement':
        return jsonResponse(createAnnouncement(data));
      case 'dismissAnnouncement':
        return jsonResponse(dismissAnnouncement(data.announcementId, data.userId));
      case 'deactivateAnnouncement':
        return jsonResponse(deactivateAnnouncement(data.announcementId, data.userId));
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
  
  // 5. Setup DeckProgress sheet for saving card-by-card progress
  let progressSheet = ss.getSheetByName('DeckProgress');
  if (!progressSheet) {
    progressSheet = ss.insertSheet('DeckProgress');
    progressSheet.appendRow(['UserID', 'DeckName', 'CardStatuses', 'CurrentIndex', 'Mode', 'ShuffledOrder', 'LastUpdated']);
    progressSheet.setFrozenRows(1);
    results.push('Created DeckProgress sheet');
  } else {
    results.push('DeckProgress sheet already exists');
  }
  
  // 6. Setup ExamSchedule sheet
  let examSheet = ss.getSheetByName('ExamSchedule');
  if (!examSheet) {
    examSheet = ss.insertSheet('ExamSchedule');
    examSheet.appendRow(['ExamID', 'CourseCode', 'CourseName', 'ExamType', 'Date', 'StartTime', 'EndTime', 'Room', 'Proctor', 'Notes', 'CreatedBy', 'CreatedByName', 'CreatedAt']);
    examSheet.setFrozenRows(1);
    results.push('Created ExamSchedule sheet');
  } else {
    results.push('ExamSchedule sheet already exists');
  }
  
  // 7. Setup Announcements sheet
  let announcementSheet = ss.getSheetByName('Announcements');
  if (!announcementSheet) {
    announcementSheet = ss.insertSheet('Announcements');
    announcementSheet.appendRow(['AnnouncementID', 'Type', 'Title', 'Message', 'Emoji', 'IsActive', 'CreatedBy', 'CreatedByName', 'CreatedAt', 'ExpiresAt']);
    announcementSheet.setFrozenRows(1);
    results.push('Created Announcements sheet');
  } else {
    results.push('Announcements sheet already exists');
  }
  
  // 8. Setup AnnouncementDismissals sheet for tracking which users dismissed which announcements
  let dismissalsSheet = ss.getSheetByName('AnnouncementDismissals');
  if (!dismissalsSheet) {
    dismissalsSheet = ss.insertSheet('AnnouncementDismissals');
    dismissalsSheet.appendRow(['UserID', 'AnnouncementID', 'DismissedAt']);
    dismissalsSheet.setFrozenRows(1);
    results.push('Created AnnouncementDismissals sheet');
  } else {
    results.push('AnnouncementDismissals sheet already exists');
  }
  
  return { 
    success: true, 
    message: 'Setup complete', 
    details: results 
  };
}

/**
 * Get all data needed by the app
 * @param {string} userId - Optional user ID to check announcement dismissals
 */
function getAllData(userId) {
  const examsResult = getExams();
  const subjects = getSubjects();
  const cacheVersionResult = getCacheVersion();
  const announcementResult = getActiveAnnouncement(userId);
  
  // Build subjectInfo map for quick lookup
  const subjectInfo = {};
  subjects.forEach(s => {
    subjectInfo[s.code] = { code: s.code, name: s.name };
  });
  
  return {
    decks: getAllDecks(),
    categories: getCategories(),
    resources: getResources(),
    subjects: subjects, // Array of {code, name} objects
    subjectInfo: subjectInfo, // Map of code -> {code, name}
    exams: examsResult.success ? examsResult.exams : [],
    cacheVersion: cacheVersionResult.version || 1,
    activeAnnouncement: announcementResult.success ? announcementResult.announcement : null
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
    
    // If Analytics sheet doesn't exist, return empty but successful response
    if (!analyticsSheet) {
      // Still try to get summary from user record
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
        analytics: [],
        summary: recordAnalytics
      };
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
 * Add a resource by external link (user uploads to Drive manually or YouTube)
 * @param {Object} data - Resource data with link
 */
function addResourceByLink(data) {
  try {
    const { title, description, subject, category, link, userId, userName } = data;
    
    // Validate required fields
    if (!title || !subject || !category || !link || !userId) {
      return { error: 'Missing required fields' };
    }
    
    // Validate that it's a Google Drive or YouTube link
    const isGoogleDrive = link.includes('drive.google.com') || link.includes('docs.google.com');
    const isYouTube = link.includes('youtube.com') || link.includes('youtu.be');
    
    if (!isGoogleDrive && !isYouTube) {
      return { error: 'Please provide a valid Google Drive or YouTube link' };
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
 * Extract file ID from Google Drive or YouTube URL
 */
function extractFileIdFromUrl(url) {
  // Handle different Google Drive URL formats
  const drivePatterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of drivePatterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Handle YouTube URL formats
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return 'yt-' + match[1];
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
  // All system/special sheets that should NOT be treated as flashcard decks
  const specialSheets = ['User', 'Category', 'Resources', 'Analytics', 'DeckProgress', 'ExamSchedule', 'Announcements', 'AnnouncementDismissals'];

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
    
    // IMPORTANT: Only include sheets that have BOTH C1 (title) AND D1 (subject) properly set
    // This prevents system sheets or misconfigured sheets from showing up
    const displayName = data[0][2] ? String(data[0][2]).trim() : '';
    const subject = data[0][3] ? String(data[0][3]).trim() : '';
    
    // Skip sheets that don't have proper flashcard configuration
    // A valid flashcard sheet MUST have a title in C1 and a subject in D1
    if (!displayName || !subject) {
      continue;
    }

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
 * NEW FORMAT:
 * - Row 1: Course codes (FL111, FL112, etc.) - one per column (A1, B1, C1...)
 * - Row 2: Course names/descriptions (Introduksyon sa Pag-aaral ng Wika, etc.)
 * Returns array of objects: [{ code: "FL111", name: "Introduksyon sa Pag-aaral ng Wika" }, ...]
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
    return Array.from(subjectSet).map(code => ({ code: code, name: code }));
  }
  
  const data = categorySheet.getDataRange().getValues();
  if (data.length === 0) return [];
  
  const codesRow = data[0]; // Row 1: Course codes
  const namesRow = data.length > 1 ? data[1] : []; // Row 2: Course names
  const subjects = [];
  
  // Read each column - each column is a subject
  for (let col = 0; col < codesRow.length; col++) {
    const code = codesRow[col];
    const name = namesRow[col] || '';
    
    // Skip empty cells and "Category" labels (from old format)
    if (code && String(code).trim() !== '' && 
        String(code).trim().toLowerCase() !== 'category') {
      subjects.push({
        code: String(code).trim(),
        name: String(name).trim() || String(code).trim() // Fallback to code if no name
      });
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

/**
 * Save deck progress for a user
 * @param {Object} data - { idNumber, deckName, cardStatuses, currentIndex, mode, shuffledOrder }
 */
function saveDeckProgress(data) {
  try {
    const { idNumber, deckName, cardStatuses, currentIndex, mode, shuffledOrder } = data;
    
    if (!idNumber || !deckName) {
      return { error: 'Missing required fields (idNumber, deckName)' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let progressSheet = ss.getSheetByName('DeckProgress');
    
    if (!progressSheet) {
      // Create the sheet if it doesn't exist
      progressSheet = ss.insertSheet('DeckProgress');
      progressSheet.appendRow(['UserID', 'DeckName', 'CardStatuses', 'CurrentIndex', 'Mode', 'ShuffledOrder', 'LastUpdated']);
      progressSheet.setFrozenRows(1);
    }
    
    const progressData = progressSheet.getDataRange().getValues();
    let existingRow = -1;
    
    // Find existing row for this user/deck combo
    for (let i = 1; i < progressData.length; i++) {
      if (String(progressData[i][0]) === String(idNumber) && 
          String(progressData[i][1]) === String(deckName)) {
        existingRow = i + 1;
        break;
      }
    }
    
    const now = new Date().toISOString();
    const cardStatusesJson = JSON.stringify(cardStatuses || {});
    const shuffledOrderJson = JSON.stringify(shuffledOrder || []);
    
    if (existingRow > 0) {
      // Update existing record
      progressSheet.getRange(existingRow, 3, 1, 5).setValues([[
        cardStatusesJson, currentIndex || 0, mode || 'shuffle', shuffledOrderJson, now
      ]]);
    } else {
      // Add new record
      progressSheet.appendRow([
        idNumber, deckName, cardStatusesJson, currentIndex || 0, mode || 'shuffle', shuffledOrderJson, now
      ]);
    }
    
    return { success: true };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Get deck progress for a user
 * @param {string} idNumber - User ID
 * @param {string} deckName - Deck name
 */
function getDeckProgress(idNumber, deckName) {
  try {
    if (!idNumber || !deckName) {
      return { error: 'Missing required fields' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const progressSheet = ss.getSheetByName('DeckProgress');
    
    if (!progressSheet) {
      return { success: true, progress: null };
    }
    
    const data = progressSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idNumber) && 
          String(data[i][1]) === String(deckName)) {
        let cardStatuses = {};
        let shuffledOrder = [];
        
        try {
          cardStatuses = JSON.parse(data[i][2] || '{}');
        } catch (e) {
          cardStatuses = {};
        }
        
        try {
          shuffledOrder = JSON.parse(data[i][5] || '[]');
        } catch (e) {
          shuffledOrder = [];
        }
        
        return {
          success: true,
          progress: {
            deckName: data[i][1],
            cardStatuses: cardStatuses,
            currentIndex: data[i][3] || 0,
            mode: data[i][4] || 'shuffle',
            shuffledOrder: shuffledOrder,
            lastUpdated: data[i][6]
          }
        };
      }
    }
    
    return { success: true, progress: null };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Get all deck progress for a user
 * @param {string} idNumber - User ID
 */
function getAllDeckProgress(idNumber) {
  try {
    if (!idNumber) {
      return { error: 'Missing idNumber' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const progressSheet = ss.getSheetByName('DeckProgress');
    
    if (!progressSheet) {
      return { success: true, progress: {} };
    }
    
    const data = progressSheet.getDataRange().getValues();
    const result = {};
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idNumber)) {
        let cardStatuses = {};
        let shuffledOrder = [];
        
        try {
          cardStatuses = JSON.parse(data[i][2] || '{}');
        } catch (e) {
          cardStatuses = {};
        }
        
        try {
          shuffledOrder = JSON.parse(data[i][5] || '[]');
        } catch (e) {
          shuffledOrder = [];
        }
        
        result[data[i][1]] = {
          deckName: data[i][1],
          cardStatuses: cardStatuses,
          currentIndex: data[i][3] || 0,
          mode: data[i][4] || 'shuffle',
          shuffledOrder: shuffledOrder,
          lastUpdated: data[i][6]
        };
      }
    }
    
    return { success: true, progress: result };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Clear deck progress for a user
 * @param {string} idNumber - User ID
 * @param {string} deckName - Deck name
 */
function clearDeckProgressBackend(idNumber, deckName) {
  try {
    if (!idNumber || !deckName) {
      return { error: 'Missing required fields' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const progressSheet = ss.getSheetByName('DeckProgress');
    
    if (!progressSheet) {
      return { success: true };
    }
    
    const data = progressSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(idNumber) && 
          String(data[i][1]) === String(deckName)) {
        progressSheet.deleteRow(i + 1);
        return { success: true, message: 'Progress cleared' };
      }
    }
    
    return { success: true };
  } catch (error) {
    return { error: error.toString() };
  }
}

/**
 * Test deck progress functions
 */
function testDeckProgress() {
  // Test save
  const saveResult = saveDeckProgress({
    idNumber: '2025-12345',
    deckName: 'Test Deck',
    cardStatuses: { 'card1': 'correct', 'card2': 'incorrect', 'card3': 'unanswered' },
    currentIndex: 2,
    mode: 'shuffle',
    shuffledOrder: ['card1', 'card2', 'card3']
  });
  Logger.log('Save result: ' + JSON.stringify(saveResult));
  
  // Test get
  const getResult = getDeckProgress('2025-12345', 'Test Deck');
  Logger.log('Get result: ' + JSON.stringify(getResult));
  
  return { saveResult, getResult };
}

// ==================== EXAM SCHEDULE FUNCTIONS ====================

/**
 * Add a new exam to the schedule
 * @param {Object} data - { courseCode, courseName, examType, date, startTime, endTime, room, proctor, notes, userId, userName }
 */
function addExam(data) {
  try {
    const { courseCode, courseName, examType, date, startTime, endTime, room, proctor, notes, userId, userName } = data;
    
    if (!courseCode || !date || !startTime || !userId) {
      return { error: 'Missing required fields (courseCode, date, startTime, userId)' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let examSheet = ss.getSheetByName('ExamSchedule');
    
    if (!examSheet) {
      examSheet = ss.insertSheet('ExamSchedule');
      examSheet.appendRow(['ExamID', 'CourseCode', 'CourseName', 'ExamType', 'Date', 'StartTime', 'EndTime', 'Room', 'Proctor', 'Notes', 'CreatedBy', 'CreatedByName', 'CreatedAt']);
      examSheet.setFrozenRows(1);
    }
    
    const examId = 'EXAM-' + Date.now();
    const createdAt = new Date().toISOString();
    
    examSheet.appendRow([
      examId,
      courseCode,
      courseName || '',
      examType || 'Exam',
      date,
      startTime,
      endTime || '',
      room || '',
      proctor || '',
      notes || '',
      userId,
      userName || '',
      createdAt
    ]);
    
    return {
      success: true,
      exam: {
        examId,
        courseCode,
        courseName: courseName || '',
        examType: examType || 'Exam',
        date,
        startTime,
        endTime: endTime || '',
        room: room || '',
        proctor: proctor || '',
        notes: notes || '',
        createdBy: userId,
        createdByName: userName || '',
        createdAt
      }
    };
  } catch (error) {
    return { error: 'Failed to add exam: ' + error.message };
  }
}

/**
 * Helper function to format time value from Google Sheets
 * Handles Date objects, numbers (decimal fraction), and strings
 * Uses Philippines timezone (Asia/Manila) for consistent display
 */
function formatTimeValue(timeVal) {
  if (!timeVal && timeVal !== 0) return '';
  
  // If it's a Date object (Google Sheets stores times as Date with base date 1899-12-30)
  if (timeVal instanceof Date) {
    // Use Utilities.formatDate with Philippines timezone to get correct local time
    try {
      const formatted = Utilities.formatDate(timeVal, 'Asia/Manila', 'HH:mm');
      return formatted;
    } catch (e) {
      // Fallback to getHours/getMinutes if formatDate fails
      const hours = timeVal.getHours();
      const minutes = timeVal.getMinutes();
      return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }
  }
  
  // If it's a number (decimal fraction of day, e.g., 0.333... = 8:00)
  if (typeof timeVal === 'number') {
    const totalMinutes = Math.round(timeVal * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  }
  
  // If it's a string, normalize it to HH:MM format
  const str = String(timeVal).trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  }
  
  return str;
}

/**
 * Get all exams or exams for a specific subject
 * @param {string} subject - Optional course code to filter by
 */
function getExams(subject) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const examSheet = ss.getSheetByName('ExamSchedule');
    
    if (!examSheet) {
      return { success: true, exams: [] };
    }
    
    const dataRange = examSheet.getDataRange();
    const data = dataRange.getValues();
    const displayData = dataRange.getDisplayValues(); // Get values as displayed in sheet
    
    if (data.length <= 1) {
      return { success: true, exams: [] };
    }
    
    const now = new Date();
    const exams = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const displayRow = displayData[i];
      const courseCode = String(row[1]).trim();
      
      // Filter by subject if provided
      if (subject && courseCode !== subject) {
        continue;
      }
      
      // Use display values for times (exactly as shown in sheet)
      const startTimeDisplay = String(displayRow[5] || '').trim();
      const endTimeDisplay = String(displayRow[6] || '').trim();
      
      // Parse exam date and time to determine status
      const examDateStr = row[4];
      
      let status = 'upcoming';
      let examDateTime = null;
      let examEndDateTime = null;
      
      try {
        // Parse date - could be Date object or string
        let examDate;
        if (examDateStr instanceof Date) {
          examDate = new Date(examDateStr.getFullYear(), examDateStr.getMonth(), examDateStr.getDate());
        } else {
          // Parse date string like "2025-12-09" - split and create date to avoid timezone issues
          const dateStr = String(examDateStr);
          if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-').map(Number);
            examDate = new Date(year, month - 1, day); // month is 0-indexed
          } else {
            examDate = new Date(dateStr);
          }
        }
        
        // Parse start time from display value
        const startTimeParts = (startTimeDisplay || '00:00').split(':');
        const startHours = parseInt(startTimeParts[0]) || 0;
        const startMinutes = parseInt(startTimeParts[1]) || 0;
        
        examDateTime = new Date(examDate);
        examDateTime.setHours(startHours, startMinutes, 0, 0);
        
        // Parse end time from display value
        const endTimeParts = (endTimeDisplay || '23:59').split(':');
        const endHours = parseInt(endTimeParts[0]);
        const endMinutes = parseInt(endTimeParts[1]) || 0;
        
        examEndDateTime = new Date(examDate);
        if (isNaN(endHours)) {
          examEndDateTime.setHours(23, 59, 59, 999);
        } else {
          // Set to end of the minute for proper comparison
          examEndDateTime.setHours(endHours, endMinutes, 59, 999);
        }
        
        // Handle case where end time equals or is before start time (default to end of day)
        if (examEndDateTime.getTime() <= examDateTime.getTime()) {
          examEndDateTime.setHours(23, 59, 59, 999);
        }
        
        // Determine status based on current time
        if (examDateTime && examEndDateTime) {
          if (now.getTime() < examDateTime.getTime()) {
            status = 'upcoming';
          } else if (now.getTime() <= examEndDateTime.getTime()) {
            status = 'ongoing';
          } else {
            status = 'done';
          }
        } else if (examDateTime) {
          // No end time - assume 2 hour duration
          const assumedEnd = new Date(examDateTime.getTime() + 2 * 60 * 60 * 1000);
          if (now < examDateTime) {
            status = 'upcoming';
          } else if (now >= examDateTime && now <= assumedEnd) {
            status = 'ongoing';
          } else {
            status = 'done';
          }
        }
      } catch (e) {
        // If date parsing fails, default to upcoming
        status = 'upcoming';
      }
      
      exams.push({
        examId: row[0],
        courseCode: courseCode,
        courseName: String(row[2]).trim(),
        examType: String(row[3]).trim() || 'Exam',
        date: examDateStr instanceof Date ? examDateStr.toISOString().split('T')[0] : String(examDateStr),
        startTime: startTimeDisplay || '00:00',
        endTime: endTimeDisplay || '',
        room: String(row[7]).trim(),
        proctor: String(row[8]).trim(),
        notes: String(row[9]).trim(),
        createdBy: String(row[10]).trim(),
        createdByName: String(row[11]).trim(),
        createdAt: row[12],
        status: status
      });
    }
    
    // Sort by date and time (upcoming first, then ongoing, then done)
    exams.sort((a, b) => {
      const statusOrder = { 'ongoing': 0, 'upcoming': 1, 'done': 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      // Then sort by date
      return new Date(a.date + ' ' + a.startTime) - new Date(b.date + ' ' + b.startTime);
    });
    
    return { success: true, exams };
  } catch (error) {
    return { error: 'Failed to get exams: ' + error.message };
  }
}

/**
 * Update an existing exam
 * @param {Object} data - { examId, ...fields to update, userId }
 */
function updateExam(data) {
  try {
    const { examId, userId } = data;
    
    if (!examId) {
      return { error: 'Missing examId' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const examSheet = ss.getSheetByName('ExamSchedule');
    
    if (!examSheet) {
      return { error: 'ExamSchedule sheet not found' };
    }
    
    const sheetData = examSheet.getDataRange().getValues();
    
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] === examId) {
        // Check if user is the creator
        if (userId && String(sheetData[i][10]) !== String(userId)) {
          return { error: 'You can only edit exams you created' };
        }
        
        // Update fields if provided
        if (data.courseCode !== undefined) examSheet.getRange(i + 1, 2).setValue(data.courseCode);
        if (data.courseName !== undefined) examSheet.getRange(i + 1, 3).setValue(data.courseName);
        if (data.examType !== undefined) examSheet.getRange(i + 1, 4).setValue(data.examType);
        if (data.date !== undefined) examSheet.getRange(i + 1, 5).setValue(data.date);
        if (data.startTime !== undefined) examSheet.getRange(i + 1, 6).setValue(data.startTime);
        if (data.endTime !== undefined) examSheet.getRange(i + 1, 7).setValue(data.endTime);
        if (data.room !== undefined) examSheet.getRange(i + 1, 8).setValue(data.room);
        if (data.proctor !== undefined) examSheet.getRange(i + 1, 9).setValue(data.proctor);
        if (data.notes !== undefined) examSheet.getRange(i + 1, 10).setValue(data.notes);
        
        return { success: true, message: 'Exam updated' };
      }
    }
    
    return { error: 'Exam not found' };
  } catch (error) {
    return { error: 'Failed to update exam: ' + error.message };
  }
}

/**
 * Delete an exam
 * @param {string} examId - Exam ID to delete
 * @param {string} userId - User requesting deletion
 */
function deleteExam(examId, userId) {
  try {
    if (!examId) {
      return { error: 'Missing examId' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const examSheet = ss.getSheetByName('ExamSchedule');
    
    if (!examSheet) {
      return { error: 'ExamSchedule sheet not found' };
    }
    
    const data = examSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === examId) {
        // Check if user is the creator
        if (userId && String(data[i][10]) !== String(userId)) {
          return { error: 'You can only delete exams you created' };
        }
        
        examSheet.deleteRow(i + 1);
        return { success: true, message: 'Exam deleted' };
      }
    }
    
    return { error: 'Exam not found' };
  } catch (error) {
    return { error: 'Failed to delete exam: ' + error.message };
  }
}

// ==================== CACHE VERSION FUNCTIONS ====================

const ADMIN_USER_ID = '2025-00046';

/**
 * Get current cache version from script properties
 */
function getCacheVersion() {
  try {
    const props = PropertiesService.getScriptProperties();
    const version = props.getProperty('CACHE_VERSION');
    return { 
      success: true, 
      version: version ? parseInt(version) : 1 
    };
  } catch (error) {
    return { success: false, version: 1, error: error.message };
  }
}

/**
 * Bump cache version (admin only) - forces all clients to clear cache
 * @param {string} userId - User ID requesting the bump
 */
function bumpCacheVersion(userId) {
  try {
    // Only allow admin user
    if (String(userId) !== ADMIN_USER_ID) {
      return { error: 'Unauthorized. Only admin can bump cache version.' };
    }
    
    const props = PropertiesService.getScriptProperties();
    const currentVersion = props.getProperty('CACHE_VERSION');
    const newVersion = (currentVersion ? parseInt(currentVersion) : 1) + 1;
    
    props.setProperty('CACHE_VERSION', String(newVersion));
    
    return { 
      success: true, 
      message: 'Cache version bumped. All users will clear their cache on next load.',
      oldVersion: currentVersion ? parseInt(currentVersion) : 1,
      newVersion: newVersion
    };
  } catch (error) {
    return { error: 'Failed to bump cache version: ' + error.message };
  }
}

// ==================== ANNOUNCEMENT FUNCTIONS ====================

/**
 * Create a new announcement (admin only)
 * @param {object} data - Announcement data
 */
function createAnnouncement(data) {
  try {
    // Only allow admin user
    if (String(data.userId) !== ADMIN_USER_ID) {
      return { error: 'Unauthorized. Only admin can create announcements.' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Announcements');
    
    if (!sheet) {
      sheet = ss.insertSheet('Announcements');
      sheet.appendRow(['AnnouncementID', 'Type', 'Title', 'Message', 'Emoji', 'IsActive', 'CreatedBy', 'CreatedByName', 'CreatedAt', 'ExpiresAt']);
      sheet.setFrozenRows(1);
    }
    
    const announcementId = 'ann_' + Date.now();
    const now = new Date().toISOString();
    
    // Calculate expiry (default 24 hours from now, or custom)
    let expiresAt = data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    // First, deactivate any existing active announcements
    const existingData = sheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][5] === true || existingData[i][5] === 'TRUE') {
        sheet.getRange(i + 1, 6).setValue(false);
      }
    }
    
    // Add new announcement
    sheet.appendRow([
      announcementId,
      data.type || 'custom',
      data.title,
      data.message,
      data.emoji || '🎉',
      true, // IsActive
      data.userId,
      data.userName || 'Admin',
      now,
      expiresAt
    ]);
    
    return { 
      success: true, 
      message: 'Announcement created',
      announcement: {
        id: announcementId,
        type: data.type || 'custom',
        title: data.title,
        message: data.message,
        emoji: data.emoji || '🎉',
        isActive: true,
        createdAt: now,
        expiresAt: expiresAt
      }
    };
  } catch (error) {
    return { error: 'Failed to create announcement: ' + error.message };
  }
}

/**
 * Get the currently active announcement
 * @param {string} userId - Optional user ID to check if they've dismissed the announcement
 */
function getActiveAnnouncement(userId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Announcements');
    
    if (!sheet) {
      return { success: true, announcement: null };
    }
    
    const data = sheet.getDataRange().getValues();
    const now = new Date();
    
    // Find active announcement that hasn't expired
    for (let i = 1; i < data.length; i++) {
      const isActive = data[i][5] === true || data[i][5] === 'TRUE' || String(data[i][5]).toLowerCase() === 'true';
      
      // Parse expiration date - handle various formats
      let expiresAt = null;
      if (data[i][9]) {
        if (data[i][9] instanceof Date) {
          expiresAt = data[i][9];
        } else {
          expiresAt = new Date(data[i][9]);
        }
        // Check if date is valid
        if (isNaN(expiresAt.getTime())) {
          expiresAt = null;
        }
      }
      
      // Check if announcement is active and not expired
      const isNotExpired = !expiresAt || expiresAt.getTime() > now.getTime();
      
      if (isActive && isNotExpired) {
        const announcementId = data[i][0];
        
        // Check if this user has already dismissed this announcement (server-side)
        if (userId && hasUserDismissedAnnouncement(userId, announcementId)) {
          return { success: true, announcement: null };
        }
        
        return {
          success: true,
          announcement: {
            id: announcementId,
            type: data[i][1],
            title: data[i][2],
            message: data[i][3],
            emoji: data[i][4],
            isActive: true,
            createdBy: data[i][6],
            createdByName: data[i][7],
            createdAt: data[i][8],
            expiresAt: data[i][9]
          }
        };
      }
    }
    
    return { success: true, announcement: null };
  } catch (error) {
    return { success: false, announcement: null, error: error.message };
  }
}

/**
 * Check if a user has dismissed an announcement (server-side)
 * @param {string} userId - User ID
 * @param {string} announcementId - Announcement ID
 * @returns {boolean} - True if user has dismissed this announcement
 */
function hasUserDismissedAnnouncement(userId, announcementId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('AnnouncementDismissals');
    
    if (!sheet) {
      return false;
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(userId) && String(data[i][1]) === String(announcementId)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Deactivate an announcement (admin only)
 * @param {string} announcementId - The announcement ID to deactivate
 * @param {string} userId - User ID requesting the deactivation
 */
function deactivateAnnouncement(announcementId, userId) {
  try {
    // Only allow admin user
    if (String(userId) !== ADMIN_USER_ID) {
      return { error: 'Unauthorized. Only admin can deactivate announcements.' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Announcements');
    
    if (!sheet) {
      return { error: 'Announcements sheet not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === announcementId) {
        sheet.getRange(i + 1, 6).setValue(false); // Set IsActive to false
        return { success: true, message: 'Announcement deactivated' };
      }
    }
    
    return { error: 'Announcement not found' };
  } catch (error) {
    return { error: 'Failed to deactivate announcement: ' + error.message };
  }
}

/**
 * Record that a user dismissed an announcement (server-side tracking)
 * @param {string} announcementId - The announcement ID
 * @param {string} userId - User ID who dismissed
 */
function dismissAnnouncement(announcementId, userId) {
  try {
    if (!announcementId || !userId) {
      return { error: 'Missing announcementId or userId' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('AnnouncementDismissals');
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('AnnouncementDismissals');
      sheet.appendRow(['UserID', 'AnnouncementID', 'DismissedAt']);
      sheet.setFrozenRows(1);
    }
    
    // Check if already dismissed (avoid duplicates)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(userId) && String(data[i][1]) === String(announcementId)) {
        return { success: true, message: 'Already dismissed' };
      }
    }
    
    // Add dismissal record
    const now = new Date().toISOString();
    sheet.appendRow([userId, announcementId, now]);
    
    return { success: true, message: 'Dismissal recorded' };
  } catch (error) {
    return { error: 'Failed to record dismissal: ' + error.message };
  }
}
