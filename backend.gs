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
 * 2. Resources Sheet (name: "Resources")
 *    - Row 1: Subject headers (FL111, FL112, etc.)
 *    - Row 2+: Resource entries
 *    - Format: A=ResourceName, B=Category|URL
 * 
 * 3. Flashcard Sheets (sheets starting with "F-")
 *    - Cell C1: Display name (shown in frontend)
 *    - Cell D1: Subject category (FL111, FL112, EDUC112, etc.)
 *    - Column A: Question
 *    - Column B: Answer
 *    - Row 1 is the header row (ignored for Q&A)
 */

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
 * Get all data needed by the app
 */
function getAllData() {
  return {
    decks: getAllDecks(),
    categories: getCategories(),
    resources: getResources()
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
    if (data[i][0] === idNumber) {
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
          idNumber: data[i][0],
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
    if (data[i][0] === idNumber) {
      let record = {};
      try {
        record = data[i][2] ? JSON.parse(data[i][2]) : {};
      } catch(e) {
        record = {};
      }
      return {
        success: true,
        user: {
          idNumber: data[i][0],
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
    if (data[i][0] === idNumber) {
      userSheet.getRange(i + 1, 3).setValue(JSON.stringify(record));
      return { success: true };
    }
  }
  
  return { error: 'User not found' };
}

/**
 * Get resources from Resources sheet
 * Format: { "FL111": [{name, category, url}], "FL112": [...] }
 */
function getResources() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resourceSheet = ss.getSheetByName('Resources');
  
  if (!resourceSheet) {
    return {};
  }
  
  const data = resourceSheet.getDataRange().getValues();
  if (data.length === 0) return {};
  
  const result = {};
  const headers = data[0];
  
  // Process pairs of columns (Subject, Category)
  for (let col = 0; col < headers.length; col += 2) {
    const subject = headers[col];
    if (!subject || String(subject).trim() === '') continue;
    
    result[subject] = [];
    
    // Get all resources under this subject
    for (let row = 1; row < data.length; row++) {
      const resourceName = data[row][col];
      const resourceData = data[row][col + 1] || '';
      
      if (resourceName && String(resourceName).trim() !== '') {
        // Parse resource data: "Category|URL" or just URL
        const parts = String(resourceData).split('|');
        let category = 'Files';
        let url = resourceData;
        
        if (parts.length === 2) {
          category = parts[0].trim();
          url = parts[1].trim();
        }
        
        result[subject].push({
          name: String(resourceName).trim(),
          category: category,
          url: url
        });
      }
    }
  }
  
  return result;
}

/**
 * Get all decks from flashcard sheets (sheets starting with "F-")
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
    
    // Only process sheets starting with "F-" (Flashcard sheets)
    if (!sheetName.startsWith('F-')) {
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
