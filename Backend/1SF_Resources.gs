/**
 * 1SF Resources Backend
 *
 * Stores resource metadata in the container spreadsheet and stores
 * flipcards as standalone spreadsheet files in Drive.
 */

const FLIPCARD_FOLDER_ID = '1wGD_h1BKiR7riPXws8o7CZiYkjiHppFO';
const VIDEO_FOLDER_ID = '1bKM0uRh_aQDcLBu1mQVcldjby6IPjb_t';
const DOCUMENT_FOLDER_ID = '1bKM0uRh_aQDcLBu1mQVcldjby6IPjb_t';

const RESOURCE_FOLDER_BY_CATEGORY = {
  Video: VIDEO_FOLDER_ID,
  PDF: DOCUMENT_FOLDER_ID,
  PPT: DOCUMENT_FOLDER_ID,
  Document: DOCUMENT_FOLDER_ID,
  'Lesson PPT': DOCUMENT_FOLDER_ID,
  'Lesson PDF': DOCUMENT_FOLDER_ID,
  Reviewer: DOCUMENT_FOLDER_ID,
  Files: DOCUMENT_FOLDER_ID
};

const RESOURCE_USER_ACCOUNT_COL = {
  ID_NUMBER: 0,
  ROLE: 20,
  POSITION: 21
};

const RESOURCE_DELETE_POSITIONS = ['mayor', 'vice mayor', 'internal public information officer'];

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getAll';
    const userId = safeString(e && e.parameter && e.parameter.userId);
    const deckName = safeString(e && e.parameter && e.parameter.deckName);

    switch (action) {
      case 'getAll':
        return jsonResponse(getAllResourceData());
      case 'getDecks':
        return jsonResponse(getAllDecks());
      case 'getCategories':
        return jsonResponse(getCategories());
      case 'getResources':
        return jsonResponse(getResources());
      case 'getSubjects':
        return jsonResponse(getSubjects());
      case 'setupSheets':
        return jsonResponse(setupResourceSheets());
      case 'getDeckProgress':
        return jsonResponse(getDeckProgress(userId, deckName));
      case 'getAllDeckProgress':
        return jsonResponse(getAllDeckProgress(userId));
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

    switch (data.action) {
      case 'getAll':
        return jsonResponse(getAllResourceData());
      case 'getDecks':
        return jsonResponse(getAllDecks());
      case 'getCategories':
        return jsonResponse(getCategories());
      case 'getResources':
        return jsonResponse(getResources());
      case 'getSubjects':
        return jsonResponse(getSubjects());
      case 'uploadResource':
        return jsonResponse(uploadResource(data));
      case 'addResourceByLink':
        return jsonResponse(addResourceByLink(data));
      case 'deleteResource':
        return jsonResponse(deleteResource(data.resourceUrl, data.userId));
      case 'createDeckFromCards':
        return jsonResponse(createDeckFromCards(data));
      case 'createDeckFromSheetLink':
        return jsonResponse(createDeckFromSheetLink(data));
      case 'syncObligationLinks':
        return jsonResponse(syncObligationLinks(data));
      case 'deleteObligationLinks':
        return jsonResponse(deleteObligationLinks(data.obligationId));
      case 'saveDeckProgress':
        return jsonResponse(saveDeckProgress(data));
      case 'getDeckProgress':
        return jsonResponse(getDeckProgress(data.userId || data.idNumber, data.deckName));
      case 'getAllDeckProgress':
        return jsonResponse(getAllDeckProgress(data.userId || data.idNumber));
      case 'clearDeckProgress':
        return jsonResponse(clearDeckProgress(data.userId || data.idNumber, data.deckName));
      case 'saveStudySession':
        return jsonResponse(saveStudySession(data));
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

function getAllResourceData() {
  const decks = getAllDecks();
  const resources = getResources();
  const categories = getCategoriesFromDecks(decks);
  const subjects = getSubjectsFromData(decks, resources);
  const resourceLinks = getResourceLinks();
  const subjectInfo = {};

  for (var i = 0; i < subjects.length; i++) {
    subjectInfo[subjects[i].code] = {
      code: subjects[i].code,
      name: subjects[i].name || ''
    };
  }

  return {
    decks: decks,
    categories: categories,
    resources: resources,
    resourceLinks: resourceLinks,
    subjects: subjects,
    subjectInfo: subjectInfo
  };
}

function setupResourceSheets() {
  ensureResourcesSheet();
  ensureResourceLinksSheet();
  ensureDeckProgressSheet();
  ensureStudySessionsSheet();
  ensureStudySessionCardsSheet();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('Category')) {
    const categorySheet = ss.insertSheet('Category');
    categorySheet.appendRow([]);
    categorySheet.appendRow([]);
    categorySheet.setFrozenRows(2);
  }

  return { success: true };
}

function ensureResourcesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Resources');

  if (!sheet) {
    sheet = ss.insertSheet('Resources');
    sheet.appendRow([
      'Type',
      'Title',
      'Description',
      'Subject',
      'Category',
      'URL',
      'StorageFileId',
      'SubmittedBy',
      'SubmittedByName',
      'Timestamp'
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureResourceLinksSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ResourceLinks');

  if (!sheet) {
    sheet = ss.insertSheet('ResourceLinks');
    sheet.appendRow([
      'ResourceUrl',
      'ResourceTitle',
      'ResourceCategory',
      'ObligationId',
      'ObligationType',
      'ObligationLabel',
      'CourseCode',
      'CreatedBy',
      'CreatedByName',
      'CreatedAt'
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureDeckProgressSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('DeckProgress');

  if (!sheet) {
    sheet = ss.insertSheet('DeckProgress');
    sheet.appendRow([
      'UserID',
      'DeckName',
      'CardStatuses',
      'CurrentIndex',
      'Mode',
      'ShuffledOrder',
      'LastUpdated'
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureStudySessionsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('StudySessions');

  if (!sheet) {
    sheet = ss.insertSheet('StudySessions');
    sheet.appendRow([
      'SessionId',
      'UserID',
      'UserName',
      'DeckName',
      'DeckFileId',
      'Subject',
      'Mode',
      'StartedAt',
      'EndedAt',
      'TimeSpentSeconds',
      'CardsInSession',
      'Correct',
      'Incorrect',
      'CardsAnswered',
      'Accuracy',
      'CreatedAt'
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureStudySessionCardsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('StudySessionCards');

  if (!sheet) {
    sheet = ss.insertSheet('StudySessionCards');
    sheet.appendRow([
      'SessionId',
      'UserID',
      'DeckName',
      'DeckFileId',
      'Subject',
      'CardId',
      'Question',
      'Answer',
      'FinalStatus',
      'AttemptCount',
      'TimeSpentMs',
      'CreatedAt'
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function uploadResource(data) {
  try {
    const title = safeString(data.title);
    const description = safeString(data.description);
    const subject = safeString(data.subject);
    const category = normalizeResourceCategory(data.category);
    const fileData = data.fileData;
    const fileName = safeString(data.fileName);
    const mimeType = safeString(data.mimeType) || 'application/octet-stream';
    const userId = safeString(data.userId);
    const userName = safeString(data.userName);

    if (!title || !subject || !category || !fileData || !fileName || !userId) {
      return { error: 'Missing required fields' };
    }

    const folder = DriveApp.getFolderById(getFolderIdForResourceCategory(category));
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const resource = appendResourceRow({
      type: 'resource',
      title: title,
      description: description,
      subject: subject,
      category: category,
      url: file.getUrl(),
      storageFileId: file.getId(),
      submittedBy: userId,
      submittedByName: userName
    });

    maybeLinkResourceToObligation(resource, data);

    return { success: true, resource: resource };
  } catch (error) {
    return { error: 'Upload failed: ' + (error.message || String(error)) };
  }
}

function addResourceByLink(data) {
  try {
    const title = safeString(data.title);
    const description = safeString(data.description);
    const subject = safeString(data.subject);
    const category = normalizeResourceCategory(data.category);
    const link = safeString(data.link);
    const userId = safeString(data.userId);
    const userName = safeString(data.userName);

    if (!title || !subject || !category || !link || !userId) {
      return { error: 'Missing required fields' };
    }

    if (!isAllowedResourceLink(link, category)) {
      return { error: 'Please provide a valid link for this resource type' };
    }

    const resource = appendResourceRow({
      type: 'resource',
      title: title,
      description: description,
      subject: subject,
      category: category,
      url: link,
      storageFileId: extractFileIdFromUrl(link) || '',
      submittedBy: userId,
      submittedByName: userName
    });

    maybeLinkResourceToObligation(resource, data);

    return { success: true, resource: resource };
  } catch (error) {
    return { error: 'Failed to add resource: ' + (error.message || String(error)) };
  }
}

function deleteResource(resourceUrl, userId) {
  try {
    const sheet = ensureResourcesSheet();
    const data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      const parsed = mapResourceRow(data[i], i);
      if (parsed.url !== resourceUrl) continue;

      if (!canDeleteResource(userId, parsed.submittedBy)) {
        return { error: 'Unauthorized. Only the uploader, Mayor, Vice Mayor, Internal PIO, admin, or superadmin can delete this resource.' };
      }

      if (parsed.storageFileId && String(parsed.category) === 'Flipcard') {
        trashDriveFile(parsed.storageFileId);
      } else if (parsed.storageFileId && !/^yt-/.test(parsed.storageFileId)) {
        trashDriveFile(parsed.storageFileId);
      }

      var cleanup = { deckProgressDeleted: 0, studySessionsDeleted: 0, studySessionCardsDeleted: 0 };
      if (parsed.type === 'flipcard' || String(parsed.category) === 'Flipcard') {
        cleanup = deleteFlipcardRelatedData(parsed);
      }

      sheet.deleteRow(i + 1);
      deleteResourceLinks(resourceUrl);
      return {
        success: true,
        cleanup: cleanup
      };
    }

    return { error: 'Resource not found' };
  } catch (error) {
    return { error: 'Delete failed: ' + (error.message || String(error)) };
  }
}

function canDeleteResource(userId, submittedBy) {
  const normalizedUserId = safeString(userId);
  const normalizedSubmittedBy = safeString(submittedBy);

  if (!normalizedUserId) return false;
  if (normalizedUserId === normalizedSubmittedBy) return true;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName('UserAccounts');
  if (!userSheet) return false;

  const values = userSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (safeString(values[i][RESOURCE_USER_ACCOUNT_COL.ID_NUMBER]) !== normalizedUserId) continue;

    const role = safeString(values[i][RESOURCE_USER_ACCOUNT_COL.ROLE]).toLowerCase();
    const position = safeString(values[i][RESOURCE_USER_ACCOUNT_COL.POSITION]).toLowerCase();

    return role === 'admin' ||
      role === 'superadmin' ||
      RESOURCE_DELETE_POSITIONS.indexOf(position) !== -1;
  }

  return false;
}

function deleteFlipcardRelatedData(resource) {
  return {
    deckProgressDeleted: deleteDeckProgressForDeck(resource.title),
    studySessionsDeleted: deleteStudySessionsForDeck(resource.storageFileId, resource.title),
    studySessionCardsDeleted: deleteStudySessionCardsForDeck(resource.storageFileId, resource.title)
  };
}

function deleteDeckProgressForDeck(deckName) {
  const normalizedDeckName = safeString(deckName);
  if (!normalizedDeckName) return 0;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DeckProgress');
  if (!sheet) return 0;

  const values = sheet.getDataRange().getValues();
  var deleted = 0;

  for (var i = values.length - 1; i >= 1; i--) {
    if (safeString(values[i][1]) === normalizedDeckName) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }

  return deleted;
}

function deleteStudySessionsForDeck(deckFileId, deckName) {
  const normalizedDeckFileId = safeString(deckFileId);
  const normalizedDeckName = safeString(deckName);
  if (!normalizedDeckFileId && !normalizedDeckName) return 0;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StudySessions');
  if (!sheet) return 0;

  const values = sheet.getDataRange().getValues();
  var deleted = 0;

  for (var i = values.length - 1; i >= 1; i--) {
    const rowDeckName = safeString(values[i][3]);
    const rowDeckFileId = safeString(values[i][4]);
    if (
      (normalizedDeckFileId && rowDeckFileId === normalizedDeckFileId) ||
      (normalizedDeckName && rowDeckName === normalizedDeckName)
    ) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }

  return deleted;
}

function deleteStudySessionCardsForDeck(deckFileId, deckName) {
  const normalizedDeckFileId = safeString(deckFileId);
  const normalizedDeckName = safeString(deckName);
  if (!normalizedDeckFileId && !normalizedDeckName) return 0;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StudySessionCards');
  if (!sheet) return 0;

  const values = sheet.getDataRange().getValues();
  var deleted = 0;

  for (var i = values.length - 1; i >= 1; i--) {
    const rowDeckName = safeString(values[i][2]);
    const rowDeckFileId = safeString(values[i][3]);
    if (
      (normalizedDeckFileId && rowDeckFileId === normalizedDeckFileId) ||
      (normalizedDeckName && rowDeckName === normalizedDeckName)
    ) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }

  return deleted;
}

function getResources() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Resources');
  if (!sheet) return {};

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return {};
  const links = getResourceLinks();
  const linksByResourceUrl = {};
  for (var linkIndex = 0; linkIndex < links.length; linkIndex++) {
    const link = links[linkIndex];
    if (!linksByResourceUrl[link.resourceUrl]) {
      linksByResourceUrl[link.resourceUrl] = [];
    }
    linksByResourceUrl[link.resourceUrl].push({
      obligationId: link.obligationId,
      obligationType: link.obligationType,
      obligationLabel: link.obligationLabel,
      courseCode: link.courseCode
    });
  }

  const resources = {};

  for (var i = 1; i < values.length; i++) {
    const resource = mapResourceRow(values[i], i);
    if (!resource || resource.type === 'flipcard') continue;

    if (!resources[resource.subject]) {
      resources[resource.subject] = [];
    }

    resources[resource.subject].push({
      id: resource.storageFileId || ('resource-' + i),
      title: resource.title,
      name: resource.title,
      description: resource.description,
      category: resource.category,
      url: resource.url,
      submittedBy: resource.submittedBy,
      submittedByName: resource.submittedByName,
      timestamp: resource.timestamp,
      linkedObligations: linksByResourceUrl[resource.url] || []
    });
  }

  return resources;
}

function getAllDecks() {
  const decks = {};
  const metadata = getFlipcardMetadataByFileId();
  const fileIds = Object.keys(metadata);

  for (var i = 0; i < fileIds.length; i++) {
    const fileId = fileIds[i];
    const meta = metadata[fileId];
    if (!meta) continue;

    const spreadsheet = SpreadsheetApp.openById(fileId);
    const sourceSheet = spreadsheet.getSheets()[0];
    if (!sourceSheet) continue;

    const values = sourceSheet.getDataRange().getDisplayValues();
    const extracted = extractDeckCardsFromValues(values);
    if (!extracted.cards.length) continue;

    decks[meta.title] = {
      fileId: fileId,
      sheetName: spreadsheet.getName(),
      subject: meta.subject,
      url: meta.url,
      submittedBy: meta.submittedBy,
      submittedByName: meta.submittedByName,
      timestamp: meta.timestamp,
      cards: extracted.cards
    };
  }

  return decks;
}

function getCategories() {
  return getCategoriesFromDecks(getAllDecks());
}

function getCategoriesFromDecks(decks) {
  const categories = {};

  for (var deckName in decks) {
    if (!decks.hasOwnProperty(deckName)) continue;

    const subject = safeString(decks[deckName].subject) || 'Uncategorized';
    if (!categories[subject]) {
      categories[subject] = [];
    }

    categories[subject].push({
      name: deckName,
      category: 'Flipcard'
    });
  }

  return categories;
}

function getSubjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const categorySheet = ss.getSheetByName('Category');

  if (categorySheet) {
    const values = categorySheet.getDataRange().getValues();
    const codes = values.length > 0 ? values[0] : [];
    const names = values.length > 1 ? values[1] : [];
    const subjects = [];

    for (var i = 0; i < codes.length; i++) {
      const code = safeString(codes[i]);
      if (!code || code === 'Category') continue;
      subjects.push({ code: code, name: safeString(names[i]) });
    }

    if (subjects.length) return subjects;
  }

  return getSubjectsFromData(getAllDecks(), getResources());
}

function getSubjectsFromData(decks, resources) {
  const subjectsMap = {};

  for (var deckName in decks) {
    if (!decks.hasOwnProperty(deckName)) continue;
    const deckSubject = safeString(decks[deckName].subject);
    if (deckSubject) subjectsMap[deckSubject] = { code: deckSubject, name: '' };
  }

  for (var resourceSubject in resources) {
    if (!resources.hasOwnProperty(resourceSubject)) continue;
    subjectsMap[resourceSubject] = subjectsMap[resourceSubject] || { code: resourceSubject, name: '' };
  }

  const fallback = [];
  for (var code in subjectsMap) {
    if (subjectsMap.hasOwnProperty(code)) fallback.push(subjectsMap[code]);
  }

  fallback.sort(function(a, b) {
    return a.code > b.code ? 1 : a.code < b.code ? -1 : 0;
  });

  return fallback;
}

function createDeckFromCards(data) {
  try {
    const title = safeString(data.title);
    const subject = safeString(data.subject);
    const userId = safeString(data.userId);
    const userName = safeString(data.userName);
    let cards = normalizeCards(Array.isArray(data.cards) ? data.cards : []);

    if (!cards.length && data.fileData) {
      cards = extractDeckCardsFromCsvString(Utilities.newBlob(Utilities.base64Decode(data.fileData)).getDataAsString());
    }

    if (!title || !subject || !userId) {
      return { error: 'Missing required fields' };
    }

    if (!cards.length) {
      return { error: 'No valid flipcards were detected' };
    }

    const created = createFlipcardSpreadsheet(title, subject, cards, {
      sourceLabel: 'CSV Upload',
      sourceValue: safeString(data.originalFileName),
      submittedBy: userId,
      submittedByName: userName
    });

    appendResourceRow({
      type: 'flipcard',
      title: created.title,
      description: '',
      subject: subject,
      category: 'Flipcard',
      url: created.url,
      storageFileId: created.fileId,
      submittedBy: userId,
      submittedByName: userName
    });
    maybeLinkResourceToObligation({
      title: created.title,
      category: 'Flipcard',
      url: created.url,
      subject: subject,
      submittedBy: userId,
      submittedByName: userName
    }, data);

    return {
      success: true,
      deck: {
        name: created.title,
        sheetName: created.fileName,
        subject: subject,
        cards: cards
      }
    };
  } catch (error) {
    return { error: 'Failed to create flipcard set: ' + (error.message || String(error)) };
  }
}

function extractDeckCardsFromCsvString(csvText) {
  const rows = Utilities.parseCsv(csvText || '');
  if (!rows || !rows.length) {
    return [];
  }

  const config = getDeckColumnConfig(rows);
  const cards = [];

  for (var i = config.startRow; i < rows.length; i++) {
    const q = safeString(rows[i][config.questionIndex]);
    const a = safeString(rows[i][config.answerIndex]);
    if (!q || !a) continue;
    cards.push({ q: q, a: a });
  }

  return cards;
}

function createDeckFromSheetLink(data) {
  try {
    const title = safeString(data.title);
    const subject = safeString(data.subject);
    const userId = safeString(data.userId);
    const userName = safeString(data.userName);
    const sheetUrl = safeString(data.sheetUrl);

    if (!sheetUrl || !subject || !userId) {
      return { error: 'Missing required fields' };
    }

    const sourceSpreadsheet = SpreadsheetApp.openByUrl(sheetUrl);
    const sourceSheet = findSourceSheet(sourceSpreadsheet, sheetUrl);
    if (!sourceSheet) {
      return { error: 'No readable sheet found in the provided spreadsheet' };
    }

    const extracted = extractDeckCardsFromValues(sourceSheet.getDataRange().getDisplayValues());
    if (!extracted.cards.length) {
      return { error: 'No valid question and answer columns were detected' };
    }

    const createdTitle = title || extracted.title || sourceSheet.getName();
    const created = createFlipcardSpreadsheet(createdTitle, subject, extracted.cards, {
      sourceLabel: 'Google Sheets',
      sourceValue: sheetUrl,
      submittedBy: userId,
      submittedByName: userName
    });

    appendResourceRow({
      type: 'flipcard',
      title: created.title,
      description: '',
      subject: subject,
      category: 'Flipcard',
      url: created.url,
      storageFileId: created.fileId,
      submittedBy: userId,
      submittedByName: userName
    });
    maybeLinkResourceToObligation({
      title: created.title,
      category: 'Flipcard',
      url: created.url,
      subject: subject,
      submittedBy: userId,
      submittedByName: userName
    }, data);

    return {
      success: true,
      deck: {
        name: created.title,
        sheetName: created.fileName,
        subject: subject,
        cards: extracted.cards
      }
    };
  } catch (error) {
    return { error: 'Failed to import Google Sheet: ' + (error.message || String(error)) };
  }
}

function createFlipcardSpreadsheet(title, subject, cards, meta) {
  const uniqueTitle = makeUniqueFlipcardTitle(title);
  const spreadsheet = SpreadsheetApp.create(uniqueTitle);
  const sheet = spreadsheet.getSheets()[0];
  const now = new Date().toISOString();

  sheet.clear();
  sheet.getRange(1, 1, 1, 2).setValues([['Question', 'Answer']]);

  const rows = [];
  for (var i = 0; i < cards.length; i++) {
    rows.push([cards[i].q, cards[i].a]);
  }
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  sheet.setFrozenRows(1);
  spreadsheet.rename(uniqueTitle);

  const file = DriveApp.getFileById(spreadsheet.getId());
  const targetFolder = DriveApp.getFolderById(FLIPCARD_FOLDER_ID);
  targetFolder.addFile(file);
  try {
    DriveApp.getRootFolder().removeFile(file);
  } catch (error) {
    Logger.log('Root remove skipped: ' + (error.message || error));
  }
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    title: uniqueTitle,
    fileId: file.getId(),
    fileName: file.getName(),
    url: spreadsheet.getUrl(),
    createdAt: now,
    sourceLabel: meta.sourceLabel || '',
    sourceValue: meta.sourceValue || '',
    submittedBy: meta.submittedBy || '',
    submittedByName: meta.submittedByName || ''
  };
}

function appendResourceRow(resource) {
  const sheet = ensureResourcesSheet();
  const timestamp = new Date().toISOString();

  sheet.appendRow([
    resource.type || 'resource',
    resource.title || '',
    resource.description || '',
    resource.subject || '',
    resource.category || '',
    resource.url || '',
    resource.storageFileId || '',
    resource.submittedBy || '',
    resource.submittedByName || '',
    timestamp
  ]);

  return {
    id: resource.storageFileId || ('resource-' + sheet.getLastRow()),
    title: resource.title || '',
    name: resource.title || '',
    description: resource.description || '',
    subject: resource.subject || '',
    category: resource.category || '',
    url: resource.url || '',
    submittedBy: resource.submittedBy || '',
    submittedByName: resource.submittedByName || '',
    timestamp: timestamp
  };
}

function maybeLinkResourceToObligation(resource, data) {
  const obligationId = safeString(data.obligationId);
  if (!obligationId) return;

  appendResourceLink({
    resourceUrl: resource.url,
    resourceTitle: resource.title || resource.name || '',
    resourceCategory: resource.category || '',
    obligationId: obligationId,
    obligationType: safeString(data.obligationType),
    obligationLabel: safeString(data.obligationLabel),
    courseCode: safeString(data.subject || resource.subject),
    createdBy: safeString(data.userId || resource.submittedBy),
    createdByName: safeString(data.userName || resource.submittedByName)
  });
}

function appendResourceLink(link) {
  const sheet = ensureResourceLinksSheet();
  sheet.appendRow([
    link.resourceUrl || '',
    link.resourceTitle || '',
    link.resourceCategory || '',
    link.obligationId || '',
    link.obligationType || '',
    link.obligationLabel || '',
    link.courseCode || '',
    link.createdBy || '',
    link.createdByName || '',
    new Date().toISOString()
  ]);
}

function deleteResourceLinks(resourceUrl) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ResourceLinks');
  if (!sheet) return;

  const values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (safeString(values[i][0]) === safeString(resourceUrl)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function getResourceLinks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ResourceLinks');
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  const links = [];
  for (var i = 1; i < values.length; i++) {
    if (!safeString(values[i][0]) || !safeString(values[i][3])) continue;
    links.push({
      resourceUrl: safeString(values[i][0]),
      resourceTitle: safeString(values[i][1]),
      resourceCategory: safeString(values[i][2]),
      obligationId: safeString(values[i][3]),
      obligationType: safeString(values[i][4]),
      obligationLabel: safeString(values[i][5]),
      courseCode: safeString(values[i][6]),
      createdBy: safeString(values[i][7]),
      createdByName: safeString(values[i][8]),
      createdAt: values[i][9] ? new Date(values[i][9]).toISOString() : ''
    });
  }

  return links;
}

function syncObligationLinks(data) {
  const obligationId = safeString(data.obligationId);
  if (!obligationId) return { error: 'Missing obligationId' };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ResourceLinks');
  if (!sheet) return { success: true, updated: 0 };

  const values = sheet.getDataRange().getValues();
  var updated = 0;
  for (var i = 1; i < values.length; i++) {
    if (safeString(values[i][3]) !== obligationId) continue;
    sheet.getRange(i + 1, 5).setValue(safeString(data.obligationType));
    sheet.getRange(i + 1, 6).setValue(safeString(data.obligationLabel));
    sheet.getRange(i + 1, 7).setValue(safeString(data.courseCode));
    updated++;
  }

  return { success: true, updated: updated };
}

function deleteObligationLinks(obligationId) {
  const normalized = safeString(obligationId);
  if (!normalized) return { error: 'Missing obligationId' };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ResourceLinks');
  if (!sheet) return { success: true, deleted: 0 };

  const values = sheet.getDataRange().getValues();
  var deleted = 0;
  for (var i = values.length - 1; i >= 1; i--) {
    if (safeString(values[i][3]) === normalized) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }

  return { success: true, deleted: deleted };
}

function saveDeckProgress(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const userId = safeString(data.userId || data.idNumber);
    const deckName = safeString(data.deckName);
    const mode = normalizeDeckProgressMode(data.mode);
    const currentIndex = normalizeDeckProgressIndex(data.currentIndex);
    const cardStatuses = normalizeCardStatuses(data.cardStatuses);
    const shuffledOrder = normalizeShuffledOrder(data.shuffledOrder);

    if (!userId || !deckName) {
      return { error: 'Missing required fields (userId, deckName)' };
    }

    const sheet = ensureDeckProgressSheet();
    const values = sheet.getDataRange().getValues();
    const timestamp = new Date().toISOString();
    const cardStatusesJson = JSON.stringify(cardStatuses);
    const shuffledOrderJson = JSON.stringify(shuffledOrder);
    const existingRow = findDeckProgressRow(values, userId, deckName);

    if (existingRow > 0) {
      sheet.getRange(existingRow, 3, 1, 5).setValues([[
        cardStatusesJson,
        currentIndex,
        mode,
        shuffledOrderJson,
        timestamp
      ]]);
    } else {
      sheet.appendRow([
        userId,
        deckName,
        cardStatusesJson,
        currentIndex,
        mode,
        shuffledOrderJson,
        timestamp
      ]);
    }

    return {
      success: true,
      progress: {
        deckName: deckName,
        cardStatuses: cardStatuses,
        currentIndex: currentIndex,
        mode: mode,
        shuffledOrder: shuffledOrder,
        lastUpdated: timestamp
      }
    };
  } catch (error) {
    return { error: 'Failed to save deck progress: ' + (error.message || String(error)) };
  } finally {
    lock.releaseLock();
  }
}

function getDeckProgress(userId, deckName) {
  try {
    const normalizedUserId = safeString(userId);
    const normalizedDeckName = safeString(deckName);

    if (!normalizedUserId || !normalizedDeckName) {
      return { error: 'Missing required fields (userId, deckName)' };
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DeckProgress');
    if (!sheet) {
      return { success: true, progress: null };
    }

    const values = sheet.getDataRange().getValues();
    const existingRow = findDeckProgressRow(values, normalizedUserId, normalizedDeckName);
    if (existingRow <= 0) {
      return { success: true, progress: null };
    }

    return {
      success: true,
      progress: mapDeckProgressRow(values[existingRow - 1])
    };
  } catch (error) {
    return { error: 'Failed to get deck progress: ' + (error.message || String(error)) };
  }
}

function getAllDeckProgress(userId) {
  try {
    const normalizedUserId = safeString(userId);
    if (!normalizedUserId) {
      return { error: 'Missing required field (userId)' };
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DeckProgress');
    if (!sheet) {
      return { success: true, progress: {} };
    }

    const values = sheet.getDataRange().getValues();
    const result = {};

    for (var i = 1; i < values.length; i++) {
      if (safeString(values[i][0]) !== normalizedUserId) continue;
      const progress = mapDeckProgressRow(values[i]);
      if (!progress.deckName) continue;
      result[progress.deckName] = progress;
    }

    return { success: true, progress: result };
  } catch (error) {
    return { error: 'Failed to get all deck progress: ' + (error.message || String(error)) };
  }
}

function clearDeckProgress(userId, deckName) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const normalizedUserId = safeString(userId);
    const normalizedDeckName = safeString(deckName);

    if (!normalizedUserId || !normalizedDeckName) {
      return { error: 'Missing required fields (userId, deckName)' };
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DeckProgress');
    if (!sheet) {
      return { success: true, deleted: 0 };
    }

    const values = sheet.getDataRange().getValues();
    const existingRow = findDeckProgressRow(values, normalizedUserId, normalizedDeckName);
    if (existingRow > 0) {
      sheet.deleteRow(existingRow);
      return { success: true, deleted: 1 };
    }

    return { success: true, deleted: 0 };
  } catch (error) {
    return { error: 'Failed to clear deck progress: ' + (error.message || String(error)) };
  } finally {
    lock.releaseLock();
  }
}

function findDeckProgressRow(values, userId, deckName) {
  for (var i = 1; i < values.length; i++) {
    if (safeString(values[i][0]) === safeString(userId) &&
        safeString(values[i][1]) === safeString(deckName)) {
      return i + 1;
    }
  }
  return -1;
}

function mapDeckProgressRow(row) {
  return {
    deckName: safeString(row && row[1]),
    cardStatuses: parseJsonObject(row && row[2]),
    currentIndex: normalizeDeckProgressIndex(row && row[3]),
    mode: normalizeDeckProgressMode(row && row[4]),
    shuffledOrder: parseJsonArray(row && row[5]),
    lastUpdated: row && row[6] ? new Date(row[6]).toISOString() : ''
  };
}

function normalizeCardStatuses(value) {
  const parsed = typeof value === 'string' ? parseJsonObject(value) : value;
  const result = {};

  for (var key in parsed) {
    if (!parsed.hasOwnProperty(key)) continue;
    const normalizedKey = safeString(key);
    const normalizedStatus = normalizeDeckCardStatus(parsed[key]);
    if (!normalizedKey || !normalizedStatus) continue;
    result[normalizedKey] = normalizedStatus;
  }

  return result;
}

function normalizeDeckCardStatus(value) {
  const normalized = safeString(value).toLowerCase();
  if (normalized === 'correct' || normalized === 'incorrect' || normalized === 'unanswered') {
    return normalized;
  }
  return '';
}

function normalizeShuffledOrder(value) {
  const parsed = typeof value === 'string' ? parseJsonArray(value) : value;
  const result = [];

  if (!parsed || !parsed.length) return result;

  for (var i = 0; i < parsed.length; i++) {
    const normalized = safeString(parsed[i]);
    if (normalized) {
      result.push(normalized);
    }
  }

  return result;
}

function normalizeDeckProgressIndex(value) {
  const parsed = Number(value);
  if (!isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function normalizeDeckProgressMode(value) {
  return safeString(value) === 'chronological' ? 'chronological' : 'shuffle';
}

function parseJsonObject(value) {
  if (!value) return {};

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function parseJsonArray(value) {
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveStudySession(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sessionId = safeString(data.sessionId) || Utilities.getUuid();
    const userId = safeString(data.userId || data.idNumber);
    const userName = safeString(data.userName);
    const deckName = safeString(data.deckName || data.deck);
    const deckFileId = safeString(data.deckFileId);
    const subject = safeString(data.subject);
    const mode = normalizeDeckProgressMode(data.mode);
    const startedAt = normalizeIsoTimestamp(data.startedAt);
    const endedAt = normalizeIsoTimestamp(data.endedAt) || new Date().toISOString();
    const timeSpentSeconds = normalizeDeckProgressIndex(data.timeSpentSeconds || data.timeSpent);
    const cardsInSession = normalizeDeckProgressIndex(data.cardsInSession);
    const correct = normalizeDeckProgressIndex(data.correct);
    const incorrect = normalizeDeckProgressIndex(data.incorrect);
    const cardsAnswered = normalizeDeckProgressIndex(data.cardsAnswered || (correct + incorrect));
    const accuracy = cardsAnswered > 0 ? Math.round((correct / cardsAnswered) * 100) : 0;
    const createdAt = new Date().toISOString();
    const cardSummaries = normalizeStudySessionCardSummaries(data.cardSummaries);

    if (!userId || !deckName || !subject) {
      return { error: 'Missing required fields (userId, deckName, subject)' };
    }

    const sessionSheet = ensureStudySessionsSheet();
    const existingSessionRow = findStudySessionRowBySessionId(sessionSheet.getDataRange().getValues(), sessionId);
    if (existingSessionRow > 0) {
      return {
        success: true,
        sessionId: sessionId,
        cardsLogged: cardSummaries.length,
        duplicate: true
      };
    }

    sessionSheet.appendRow([
      sessionId,
      userId,
      userName,
      deckName,
      deckFileId,
      subject,
      mode,
      startedAt,
      endedAt,
      timeSpentSeconds,
      cardsInSession,
      correct,
      incorrect,
      cardsAnswered,
      accuracy,
      createdAt
    ]);

    if (cardSummaries.length) {
      const cardsSheet = ensureStudySessionCardsSheet();
      const rows = [];

      for (var i = 0; i < cardSummaries.length; i++) {
        rows.push([
          sessionId,
          userId,
          deckName,
          deckFileId,
          subject,
          cardSummaries[i].cardId,
          cardSummaries[i].question,
          cardSummaries[i].answer,
          cardSummaries[i].finalStatus,
          cardSummaries[i].attemptCount,
          cardSummaries[i].timeSpentMs,
          createdAt
        ]);
      }

      cardsSheet.getRange(cardsSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return {
      success: true,
      sessionId: sessionId,
      cardsLogged: cardSummaries.length
    };
  } catch (error) {
    return { error: 'Failed to save study session: ' + (error.message || String(error)) };
  } finally {
    lock.releaseLock();
  }
}

function normalizeIsoTimestamp(value) {
  const normalized = safeString(value);
  if (!normalized) return '';
  const parsed = new Date(normalized);
  return isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeStudySessionCardSummaries(value) {
  const parsed = typeof value === 'string' ? parseJsonArray(value) : value;
  const result = [];

  if (!Array.isArray(parsed)) return result;

  for (var i = 0; i < parsed.length; i++) {
    const item = parsed[i] || {};
    const cardId = safeString(item.cardId);
    const finalStatus = normalizeDeckCardStatus(item.finalStatus);
    if (!cardId || !finalStatus || finalStatus === 'unanswered') continue;

    result.push({
      cardId: cardId,
      question: safeString(item.question),
      answer: safeString(item.answer),
      finalStatus: finalStatus,
      attemptCount: Math.max(1, normalizeDeckProgressIndex(item.attemptCount || 1)),
      timeSpentMs: Math.max(0, Number(item.timeSpentMs) || 0)
    });
  }

  return result;
}

function findStudySessionRowBySessionId(values, sessionId) {
  const normalizedSessionId = safeString(sessionId);
  if (!normalizedSessionId) return -1;

  for (var i = 1; i < values.length; i++) {
    if (safeString(values[i][0]) === normalizedSessionId) {
      return i + 1;
    }
  }

  return -1;
}

function mapResourceRow(row) {
  if (!row || row.length < 10) {
    return {
      type: 'resource',
      title: safeString(row && row[0]),
      description: safeString(row && row[1]),
      subject: safeString(row && row[2]),
      category: normalizeResourceCategory(row && row[3]),
      url: safeString(row && row[4]),
      storageFileId: safeString(extractFileIdFromUrl(row && row[4])),
      submittedBy: safeString(row && row[5]),
      submittedByName: safeString(row && row[6]),
      timestamp: row && row[7] ? new Date(row[7]).toISOString() : ''
    };
  }

  return {
    type: safeString(row[0]) || 'resource',
    title: safeString(row[1]),
    description: safeString(row[2]),
    subject: safeString(row[3]),
    category: normalizeResourceCategory(row[4]),
    url: safeString(row[5]),
    storageFileId: safeString(row[6]),
    submittedBy: safeString(row[7]),
    submittedByName: safeString(row[8]),
    timestamp: row[9] ? new Date(row[9]).toISOString() : ''
  };
}

function getFlipcardMetadataByFileId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Resources');
  const metadata = {};
  if (!sheet) return metadata;

  const values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    const row = mapResourceRow(values[i]);
    if (row.type !== 'flipcard' || !row.storageFileId) continue;
    metadata[row.storageFileId] = row;
  }

  return metadata;
}

function getExistingFlipcardTitles() {
  const metadata = getFlipcardMetadataByFileId();
  const titles = {};

  for (var fileId in metadata) {
    if (!metadata.hasOwnProperty(fileId)) continue;
    const title = safeString(metadata[fileId].title);
    if (!title) continue;
    titles[title] = true;
  }

  return titles;
}

function normalizeCards(cards) {
  const normalized = [];

  for (var i = 0; i < cards.length; i++) {
    const question = safeString(cards[i].q || cards[i].question || cards[i].front || cards[i].term);
    const answer = safeString(cards[i].a || cards[i].answer || cards[i].back || cards[i].definition);
    if (!question || !answer) continue;
    normalized.push({ q: question, a: answer });
  }

  return normalized;
}

function extractDeckCardsFromValues(values) {
  if (!values || !values.length) return { title: '', cards: [] };

  const config = getDeckColumnConfig(values);
  const cards = [];
  const title = config.startRow === 1 && config.titleIndex !== -1 && values[1]
    ? safeString(values[1][config.titleIndex])
    : '';

  for (var i = config.startRow; i < values.length; i++) {
    const q = safeString(values[i][config.questionIndex]);
    const a = safeString(values[i][config.answerIndex]);
    if (!q || !a) continue;
    cards.push({ q: q, a: a });
  }

  return { title: title, cards: cards };
}

function getDeckColumnConfig(values) {
  const firstRow = values[0] || [];
  const headerRow = firstRow.map(function(value) {
    return safeString(value).toLowerCase();
  });
  const questionIndex = findHeaderIndex(headerRow, ['question', 'q', 'front', 'term', 'prompt']);
  const answerIndex = findHeaderIndex(headerRow, ['answer', 'a', 'back', 'definition', 'meaning']);
  const titleIndex = findHeaderIndex(headerRow, ['title', 'deck', 'deck title', 'name', 'set']);
  const hasNamedColumns = questionIndex !== -1 && answerIndex !== -1;
  const hasTwoColumns = firstRow.length >= 2;

  return {
    questionIndex: hasNamedColumns ? questionIndex : 0,
    answerIndex: hasNamedColumns ? answerIndex : 1,
    titleIndex: titleIndex,
    startRow: hasNamedColumns || isDefaultDeckHeaderRow(firstRow) ? 1 : 0,
    isValid: hasNamedColumns || hasTwoColumns
  };
}

function isDefaultDeckHeaderRow(row) {
  return safeString(row[0]).toLowerCase() === 'question' &&
    safeString(row[1]).toLowerCase() === 'answer';
}

function findHeaderIndex(headerRow, candidates) {
  for (var i = 0; i < headerRow.length; i++) {
    if (candidates.indexOf(headerRow[i]) !== -1) return i;
  }
  return -1;
}

function findSourceSheet(spreadsheet, sheetUrl) {
  const gidMatch = String(sheetUrl).match(/[#&]gid=(\d+)/);
  if (gidMatch) {
    const sheetId = Number(gidMatch[1]);
    const sheets = spreadsheet.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === sheetId) return sheets[i];
    }
  }
  return spreadsheet.getSheets()[0] || null;
}

function makeUniqueFlipcardTitle(baseTitle) {
  const sanitized = sanitizeText(baseTitle) || 'Untitled Flipcard';
  const existingTitles = getExistingFlipcardTitles();
  if (!existingTitles[sanitized]) return sanitized;

  var counter = 2;
  while (existingTitles[sanitized + ' (' + counter + ')']) {
    counter++;
  }
  return sanitized + ' (' + counter + ')';
}

function getFolderIdForResourceCategory(category) {
  return RESOURCE_FOLDER_BY_CATEGORY[normalizeResourceCategory(category)] || DOCUMENT_FOLDER_ID;
}

function normalizeResourceCategory(category) {
  const value = safeString(category);
  if (value === 'Flipcard') return 'Flipcard';
  if (value === 'Video') return 'Video';
  if (value === 'PDF') return 'PDF';
  if (value === 'PPT') return 'PPT';
  if (value === 'Lesson PPT' || value === 'Lesson PDF' || value === 'Reviewer' || value === 'Files') {
    return value;
  }
  return 'Document';
}

function isAllowedResourceLink(link, category) {
  if (normalizeResourceCategory(category) === 'Video') {
    return /youtube\.com|youtu\.be|drive\.google\.com|docs\.google\.com/i.test(link);
  }
  return /drive\.google\.com|docs\.google\.com/i.test(link);
}

function trashDriveFile(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (error) {
    Logger.log('Trash skipped: ' + (error.message || error));
  }
}

function sanitizeText(value) {
  return safeString(value).replace(/\s+/g, ' ').trim();
}

function safeString(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function extractFileIdFromUrl(url) {
  if (!url) return null;

  const drivePatterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
  ];

  for (var i = 0; i < drivePatterns.length; i++) {
    const driveMatch = String(url).match(drivePatterns[i]);
    if (driveMatch) return driveMatch[1];
  }

  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (var j = 0; j < youtubePatterns.length; j++) {
    const youtubeMatch = String(url).match(youtubePatterns[j]);
    if (youtubeMatch) return 'yt-' + youtubeMatch[1];
  }

  return null;
}
