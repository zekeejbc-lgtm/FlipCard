/**
 * FlashMaster Google Apps Script Backend
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a Google Spreadsheet
 * 2. Each sheet = One Deck (e.g., "FL111 exam (1)", "FL111 exam (2)")
 * 3. Row 1 = Headers (will be ignored)
 * 4. Column A = Question
 * 5. Column B = Answer
 * 6. Deploy as Web App: Extensions > Apps Script > Deploy > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the Web App URL and paste it into the FlashMaster app settings
 */

function doGet(e) {
  try {
    const output = getAllDecks();
    return ContentService
      .createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get all decks from all sheets in the spreadsheet
 * Each sheet becomes a deck, sheet name becomes deck name
 * Format: { "DeckName1": [{q: "question", a: "answer"}, ...], "DeckName2": [...] }
 */
function getAllDecks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const result = {};

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const sheetName = sheet.getName();
    
    // Get all data from the sheet
    const data = sheet.getDataRange().getValues();
    
    // Skip if sheet is empty or has only header row
    if (data.length <= 1) {
      continue;
    }

    const cards = [];
    
    // Start from row 2 (index 1) to skip the header row
    for (let row = 1; row < data.length; row++) {
      const question = data[row][0]; // Column A (index 0)
      const answer = data[row][1];   // Column B (index 1)
      
      // Only add card if both question and answer exist and are not empty
      if (question && answer && 
          String(question).trim() !== '' && 
          String(answer).trim() !== '') {
        cards.push({
          q: String(question).trim(),
          a: String(answer).trim()
        });
      }
    }

    // Only add deck if it has at least one valid card
    if (cards.length > 0) {
      result[sheetName] = cards;
    }
  }

  return result;
}

/**
 * Test function - Run this to verify your data
 * View > Logs to see the output
 */
function testGetAllDecks() {
  const result = getAllDecks();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
