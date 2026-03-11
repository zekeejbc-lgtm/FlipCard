const FINANCE_AUDIT_DIRECTORY_GAS_URL = 'https://script.google.com/macros/s/AKfycbx7gVOloTlgAZ5NJalR5QRrEo8iRdc-rJWZiaiStu2KMU7hAXvicAJXUm2Jm5iCLZZn/exec';
const FINANCE_AUDIT_TIMEZONE = 'Asia/Manila';
const AUDIT_EDITOR_POSITIONS = ['auditor', 'mayor', 'vice mayor', 'secretary', 'assistant secretary'];
const FINANCE_MANAGER_POSITIONS = ['treasurer'];

const AUDIT_HEADERS = ['AuditId', 'AuditDate', 'Title', 'Area', 'Category', 'Status', 'Summary', 'Findings', 'Recommendations', 'CreatedBy', 'CreatedAt', 'UpdatedBy', 'UpdatedAt', 'IsDeleted', 'Amount', 'Payee', 'ReceiptReference', 'LiquidationDetails'];
const AUDIT_INDEX = { AUDIT_ID: 0, AUDIT_DATE: 1, TITLE: 2, AREA: 3, CATEGORY: 4, STATUS: 5, SUMMARY: 6, FINDINGS: 7, RECOMMENDATIONS: 8, CREATED_BY: 9, CREATED_AT: 10, UPDATED_BY: 11, UPDATED_AT: 12, IS_DELETED: 13, AMOUNT: 14, PAYEE: 15, RECEIPT_REFERENCE: 16, LIQUIDATION_DETAILS: 17 };
const FINANCE_DUE_HEADERS = ['DueId', 'Date', 'Amount', 'Description', 'UpdatedBy', 'UpdatedAt', 'IsDeleted'];
const FINANCE_DUE_INDEX = { DUE_ID: 0, DATE: 1, AMOUNT: 2, DESCRIPTION: 3, UPDATED_BY: 4, UPDATED_AT: 5, IS_DELETED: 6 };
const FINANCE_ACCOUNTABILITY_HEADERS = ['ObligationId', 'Title', 'Amount', 'Deadline', 'Description', 'MemberIds', 'CreatedBy', 'CreatedAt', 'UpdatedBy', 'UpdatedAt', 'IsDeleted'];
const FINANCE_ACCOUNTABILITY_INDEX = { OBLIGATION_ID: 0, TITLE: 1, AMOUNT: 2, DEADLINE: 3, DESCRIPTION: 4, MEMBER_IDS: 5, CREATED_BY: 6, CREATED_AT: 7, UPDATED_BY: 8, UPDATED_AT: 9, IS_DELETED: 10 };
const FINANCE_PAYMENT_HEADERS = ['PaymentId', 'MemberId', 'MemberName', 'ObligationId', 'Amount', 'PaidAt', 'Note', 'RecordedBy', 'RecordedAt', 'UpdatedBy', 'UpdatedAt', 'IsDeleted'];
const FINANCE_PAYMENT_INDEX = { PAYMENT_ID: 0, MEMBER_ID: 1, MEMBER_NAME: 2, OBLIGATION_ID: 3, AMOUNT: 4, PAID_AT: 5, NOTE: 6, RECORDED_BY: 7, RECORDED_AT: 8, UPDATED_BY: 9, UPDATED_AT: 10, IS_DELETED: 11 };
const FINANCE_EXPENSE_HEADERS = ['ExpenseId', 'Title', 'Amount', 'Date', 'Description', 'CreatedBy', 'CreatedAt', 'UpdatedBy', 'UpdatedAt', 'IsDeleted'];
const FINANCE_EXPENSE_INDEX = { EXPENSE_ID: 0, TITLE: 1, AMOUNT: 2, DATE: 3, DESCRIPTION: 4, CREATED_BY: 5, CREATED_AT: 6, UPDATED_BY: 7, UPDATED_AT: 8, IS_DELETED: 9 };

function doGet(e) {
  try {
    const action = safeString(e && e.parameter && e.parameter.action) || 'ping';
    switch (action) {
      case 'ping': return jsonResponse({ success: true, message: '1SF Finance and Audit API is running', timestamp: getManilaTimestamp() });
      case 'setupAuditSheet': return jsonResponse(setupAuditSheet());
      case 'setupFinanceSheets': return jsonResponse(setupFinanceSheets());
      case 'setupFinanceAuditSheets': return jsonResponse(setupFinanceAuditSheets());
      case 'getAuditConfig': return jsonResponse(getAuditConfig(safeString(e && e.parameter && e.parameter.userId)));
      case 'getFinanceConfig': return jsonResponse(getFinanceConfig(safeString(e && e.parameter && e.parameter.userId)));
      default: return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message || String(error) });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (safeString(data.action)) {
      case 'setupAuditSheet': return jsonResponse(setupAuditSheet());
      case 'setupFinanceSheets': return jsonResponse(setupFinanceSheets());
      case 'setupFinanceAuditSheets': return jsonResponse(setupFinanceAuditSheets());
      case 'getAuditConfig': return jsonResponse(getAuditConfig(data.userId));
      case 'saveAuditEntry': return jsonResponse(saveAuditEntry(data));
      case 'deleteAuditEntry': return jsonResponse(deleteAuditEntry(data));
      case 'getFinanceConfig': return jsonResponse(getFinanceConfig(data.userId));
      case 'saveFinanceAccountability': return jsonResponse(saveFinanceAccountability(data));
      case 'deleteFinanceAccountability': return jsonResponse(deleteFinanceAccountability(data));
      case 'saveFinanceExpense': return jsonResponse(saveFinanceExpense(data));
      case 'createFinanceDueBatch': return jsonResponse(createFinanceDueBatch(data));
      case 'updateFinanceDueAmountsFromDate': return jsonResponse(updateFinanceDueAmountsFromDate(data));
      case 'updateFinanceDueDay': return jsonResponse(updateFinanceDueDay(data));
      case 'recordFinancePayment': return jsonResponse(recordFinancePayment(data));
      default: return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message || String(error) });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function setupFinanceAuditSheets() {
  setupAuditSheet();
  setupFinanceSheets();
  return { success: true };
}

function setupAuditSheet() {
  ensureSheetWithHeaders('Audit', AUDIT_HEADERS, parseAuditRows, writeAuditRows);
  return { success: true };
}

function setupFinanceSheets() {
  ensureSheetWithHeaders('Finance_DueDays', FINANCE_DUE_HEADERS, parseFinanceDueRows, writeFinanceDueRows);
  ensureSheetWithHeaders('Finance_Accountabilities', FINANCE_ACCOUNTABILITY_HEADERS, parseFinanceAccountabilityRows, writeFinanceAccountabilityRows);
  ensureSheetWithHeaders('Finance_Payments', FINANCE_PAYMENT_HEADERS, parseFinancePaymentRows, writeFinancePaymentRows);
  ensureSheetWithHeaders('Finance_Expenses', FINANCE_EXPENSE_HEADERS, parseFinanceExpenseRows, writeFinanceExpenseRows);
  return { success: true };
}

function getAuditConfig(userId) {
  const userProfile = getResolvedUserProfile(userId);
  const auditData = getAuditSheetData();
  return { success: true, userProfile: userProfile.user, canEdit: canEditAuditEntries(userProfile), audits: buildAuditEntries(auditData.rows) };
}

function saveAuditEntry(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const userProfile = getResolvedUserProfile(data.userId);
    if (!canEditAuditEntries(userProfile)) return { error: 'Unauthorized' };
    const title = safeString(data.title);
    if (!title) return { error: 'Missing audit title' };
    const auditData = getAuditSheetData();
    const auditId = upsertAuditEntry(auditData.rows, {
      auditId: data.auditId, auditDate: normalizeDateValue(data.auditDate) || getManilaDateString(), title: title,
      area: data.area, category: data.category, status: data.status, summary: data.summary, findings: data.findings,
      recommendations: data.recommendations, amount: data.amount, payee: data.payee,
      receiptReference: data.receiptReference, liquidationDetails: data.liquidationDetails,
      actor: getActorLabel(userProfile.user, data.userId)
    });
    writeAuditRows(auditData.sheet, auditData.rows);
    return { success: true, auditId: auditId, audits: buildAuditEntries(auditData.rows) };
  } catch (error) {
    return { error: 'Failed to save audit entry: ' + (error.message || String(error)) };
  } finally {
    lock.releaseLock();
  }
}

function deleteAuditEntry(data) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const userProfile = getResolvedUserProfile(data.userId);
    if (!canEditAuditEntries(userProfile)) return { error: 'Unauthorized' };
    const auditId = safeString(data.auditId);
    if (!auditId) return { error: 'Missing auditId' };
    const auditData = getAuditSheetData();
    if (!markAuditEntryDeleted(auditData.rows, auditId, getActorLabel(userProfile.user, data.userId))) return { error: 'Audit entry not found' };
    writeAuditRows(auditData.sheet, auditData.rows);
    return { success: true, audits: buildAuditEntries(auditData.rows) };
  } catch (error) {
    return { error: 'Failed to delete audit entry: ' + (error.message || String(error)) };
  } finally {
    lock.releaseLock();
  }
}

function getFinanceConfig(userId) {
  setupFinanceSheets();
  const userProfile = getResolvedUserProfile(userId);
  const auditData = getAuditSheetData();
  const dueData = getFinanceDueData();
  const accountabilityData = getFinanceAccountabilityData();
  const paymentData = getFinancePaymentData();
  const expenseData = getFinanceExpenseData();
  return {
    success: true,
    canManage: canManageFinance(userProfile),
    members: getFinanceMembers(userProfile.user, accountabilityData.rows, paymentData.rows),
    dueDays: buildFinanceDueDays(dueData.rows),
    customObligations: buildFinanceAccountabilities(accountabilityData.rows),
    payments: buildFinancePayments(paymentData.rows),
    expenses: buildFinanceExpenses(auditData.rows, expenseData.rows)
  };
}

function saveFinanceAccountability(data) {
  return withFinanceWriteLock(data.userId, function(userProfile, actor) {
    if (!canManageFinance(userProfile)) return { error: 'Unauthorized' };
    const title = safeString(data.title);
    const amount = normalizeNumber(data.amount);
    const memberIds = normalizeMemberIds(data.memberIds);
    if (!title) return { error: 'Missing title' };
    if (amount <= 0) return { error: 'Invalid amount' };
    if (!memberIds.length) return { error: 'Select at least one member' };
    const accountabilityData = getFinanceAccountabilityData();
    const obligationId = upsertFinanceAccountability(accountabilityData.rows, {
      obligationId: data.obligationId, title: title, amount: amount, deadline: normalizeDateValue(data.deadline),
      description: data.description, memberIds: memberIds, actor: actor
    });
    writeFinanceAccountabilityRows(accountabilityData.sheet, accountabilityData.rows);
    return buildFinancePayload({ success: true, obligationId: obligationId }, userProfile);
  });
}

function deleteFinanceAccountability(data) {
  return withFinanceWriteLock(data.userId, function(userProfile, actor) {
    if (!canManageFinance(userProfile)) return { error: 'Unauthorized' };
    const obligationId = safeString(data.obligationId);
    if (!obligationId) return { error: 'Missing obligationId' };
    const accountabilityData = getFinanceAccountabilityData();
    if (!markFinanceAccountabilityDeleted(accountabilityData.rows, obligationId, actor)) return { error: 'Accountability not found' };
    writeFinanceAccountabilityRows(accountabilityData.sheet, accountabilityData.rows);
    return buildFinancePayload({ success: true }, userProfile);
  });
}

function saveFinanceExpense(data) {
  return saveAuditEntry({
    userId: data.userId,
    auditId: data.expenseId,
    auditDate: data.date,
    title: data.title,
    area: data.area || 'Finance',
    category: data.category || 'Financial',
    status: data.status || 'Published',
    summary: data.description,
    findings: data.findings,
    recommendations: data.recommendations,
    amount: data.amount,
    payee: data.payee,
    receiptReference: data.receiptReference,
    liquidationDetails: data.liquidationDetails || data.description
  });
}

function createFinanceDueBatch(data) {
  return withFinanceWriteLock(data.userId, function(userProfile, actor) {
    if (!canManageFinance(userProfile)) return { error: 'Unauthorized' };
    const amount = normalizeNumber(data.amount);
    const startDate = normalizeDateValue(data.startDate);
    const endDate = normalizeDateValue(data.endDate);
    const weekday = normalizeWeekday(data.weekday);
    if (amount <= 0) return { error: 'Invalid amount' };
    if (!startDate || !endDate) return { error: 'Missing date range' };
    if (weekday === null) return { error: 'Invalid weekday' };
    const dates = enumerateMatchingDates(startDate, endDate, weekday);
    if (!dates.length) return { error: 'No matching dates found in range' };
    const dueData = getFinanceDueData();
    for (var i = 0; i < dates.length; i++) {
      upsertFinanceDueDay(dueData.rows, { dueId: 'due-' + dates[i], date: dates[i], amount: amount, description: data.description, actor: actor });
    }
    writeFinanceDueRows(dueData.sheet, dueData.rows);
    return buildFinancePayload({ success: true, createdCount: dates.length }, userProfile);
  });
}

function updateFinanceDueAmountsFromDate(data) {
  return withFinanceWriteLock(data.userId, function(userProfile, actor) {
    if (!canManageFinance(userProfile)) return { error: 'Unauthorized' };
    const effectiveDate = normalizeDateValue(data.effectiveDate);
    const amount = normalizeNumber(data.amount);
    if (!effectiveDate) return { error: 'Missing effectiveDate' };
    if (amount <= 0) return { error: 'Invalid amount' };
    const dueData = getFinanceDueData();
    const timestamp = getManilaTimestamp();
    var updatedCount = 0;
    for (var i = 0; i < dueData.rows.length; i++) {
      const row = dueData.rows[i];
      if (row.isDeleted || safeString(row.date) < effectiveDate) continue;
      row.amount = amount;
      row.updatedBy = actor;
      row.updatedAt = timestamp;
      updatedCount++;
    }
    writeFinanceDueRows(dueData.sheet, dueData.rows);
    return buildFinancePayload({ success: true, updatedCount: updatedCount }, userProfile);
  });
}

function updateFinanceDueDay(data) {
  return withFinanceWriteLock(data.userId, function(userProfile, actor) {
    if (!canManageFinance(userProfile)) return { error: 'Unauthorized' };
    const dueId = safeString(data.dueId);
    const amount = normalizeNumber(data.amount);
    if (!dueId) return { error: 'Missing dueId' };
    if (amount <= 0) return { error: 'Invalid amount' };
    const dueData = getFinanceDueData();
    if (!updateFinanceDueDayAmount(dueData.rows, dueId, amount, actor)) return { error: 'Due day not found' };
    writeFinanceDueRows(dueData.sheet, dueData.rows);
    return buildFinancePayload({ success: true }, userProfile);
  });
}

function recordFinancePayment(data) {
  return withFinanceWriteLock(data.userId, function(userProfile, actor) {
    if (!canManageFinance(userProfile)) return { error: 'Unauthorized' };
    const memberId = safeString(data.memberId);
    const obligationId = safeString(data.obligationId);
    const amount = normalizeNumber(data.amount);
    if (!memberId) return { error: 'Missing memberId' };
    if (!obligationId) return { error: 'Missing obligationId' };
    if (amount <= 0) return { error: 'Invalid payment amount' };
    const dueData = getFinanceDueData();
    const accountabilityData = getFinanceAccountabilityData();
    const paymentData = getFinancePaymentData();
    const members = getFinanceMembers(userProfile.user, accountabilityData.rows, paymentData.rows);
    const obligation = findFinanceObligationById(obligationId, dueData.rows, accountabilityData.rows, members);
    if (!obligation) return { error: 'Obligation not found' };
    if (obligation.kind === 'accountability' && obligation.memberIds.indexOf(memberId) === -1) return { error: 'Member is not assigned to this accountability' };
    const outstanding = getOutstandingAmountForObligation(memberId, obligation, paymentData.rows);
    if (outstanding <= 0) return { error: 'This obligation is already fully paid' };
    const timestamp = getManilaTimestamp();
    paymentData.rows.push({
      paymentId: buildEntityId('PAY'),
      memberId: memberId,
      memberName: findMemberNameById(memberId, members, paymentData.rows),
      obligationId: obligationId,
      amount: Math.min(amount, outstanding),
      paidAt: normalizeDateValue(data.paidAt) || getManilaDateString(),
      note: safeString(data.note),
      recordedBy: actor,
      recordedAt: timestamp,
      updatedBy: actor,
      updatedAt: timestamp,
      isDeleted: false
    });
    writeFinancePaymentRows(paymentData.sheet, paymentData.rows);
    return buildFinancePayload({ success: true }, userProfile);
  });
}

function withFinanceWriteLock(userId, callback) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    setupFinanceSheets();
    const userProfile = getResolvedUserProfile(userId);
    return callback(userProfile, getActorLabel(userProfile.user, userId));
  } catch (error) {
    return { error: error.message || String(error) };
  } finally {
    lock.releaseLock();
  }
}

function buildFinancePayload(extra, userProfile) {
  const payload = getFinanceConfig(userProfile && userProfile.user ? userProfile.user.idNumber : '');
  for (var key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) payload[key] = extra[key];
  return payload;
}

function canEditAuditEntries(userProfile) {
  const role = safeString(userProfile && userProfile.user && userProfile.user.role).toLowerCase();
  const position = safeString(userProfile && userProfile.position).toLowerCase();
  return role === 'admin' || role === 'superadmin' || AUDIT_EDITOR_POSITIONS.indexOf(position) !== -1;
}

function canManageFinance(userProfile) {
  const role = safeString(userProfile && userProfile.user && userProfile.user.role).toLowerCase();
  const position = safeString(userProfile && userProfile.position).toLowerCase();
  return role === 'admin' || role === 'superadmin' || FINANCE_MANAGER_POSITIONS.indexOf(position) !== -1;
}

function getAuditSheetData() {
  const sheet = ensureSheetWithHeaders('Audit', AUDIT_HEADERS, parseAuditRows, writeAuditRows);
  return { sheet: sheet, rows: parseAuditRows(sheet.getDataRange().getValues()) };
}

function getFinanceDueData() {
  const sheet = ensureSheetWithHeaders('Finance_DueDays', FINANCE_DUE_HEADERS, parseFinanceDueRows, writeFinanceDueRows);
  return { sheet: sheet, rows: parseFinanceDueRows(sheet.getDataRange().getValues()) };
}

function getFinanceAccountabilityData() {
  const sheet = ensureSheetWithHeaders('Finance_Accountabilities', FINANCE_ACCOUNTABILITY_HEADERS, parseFinanceAccountabilityRows, writeFinanceAccountabilityRows);
  return { sheet: sheet, rows: parseFinanceAccountabilityRows(sheet.getDataRange().getValues()) };
}

function getFinancePaymentData() {
  const sheet = ensureSheetWithHeaders('Finance_Payments', FINANCE_PAYMENT_HEADERS, parseFinancePaymentRows, writeFinancePaymentRows);
  return { sheet: sheet, rows: parseFinancePaymentRows(sheet.getDataRange().getValues()) };
}

function getFinanceExpenseData() {
  const sheet = ensureSheetWithHeaders('Finance_Expenses', FINANCE_EXPENSE_HEADERS, parseFinanceExpenseRows, writeFinanceExpenseRows);
  return { sheet: sheet, rows: parseFinanceExpenseRows(sheet.getDataRange().getValues()) };
}

function ensureSheetWithHeaders(sheetName, headers, parseRows, writeRows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    writeSheetValues(sheet, [headers], headers.length);
    return sheet;
  }
  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    writeSheetValues(sheet, [headers], headers.length);
    return sheet;
  }
  const currentHeaders = values[0] || [];
  var needsRewrite = currentHeaders.length !== headers.length;
  for (var i = 0; !needsRewrite && i < headers.length; i++) if (safeString(currentHeaders[i]) !== headers[i]) needsRewrite = true;
  if (needsRewrite) writeRows(sheet, parseRows(values)); else sheet.setFrozenRows(1);
  return sheet;
}

function parseAuditRows(values) {
  const rows = [];
  for (var i = 1; i < values.length; i++) {
    const row = values[i] || [];
    if (!hasRowContent(row)) continue;
    rows.push({
      auditId: safeString(row[AUDIT_INDEX.AUDIT_ID]),
      auditDate: normalizeDateValue(row[AUDIT_INDEX.AUDIT_DATE]),
      title: safeString(row[AUDIT_INDEX.TITLE]),
      area: safeString(row[AUDIT_INDEX.AREA]),
      category: safeString(row[AUDIT_INDEX.CATEGORY]),
      status: safeString(row[AUDIT_INDEX.STATUS]),
      summary: safeString(row[AUDIT_INDEX.SUMMARY]),
      findings: safeString(row[AUDIT_INDEX.FINDINGS]),
      recommendations: safeString(row[AUDIT_INDEX.RECOMMENDATIONS]),
      createdBy: safeString(row[AUDIT_INDEX.CREATED_BY]),
      createdAt: normalizeTimestampValue(row[AUDIT_INDEX.CREATED_AT]),
      updatedBy: safeString(row[AUDIT_INDEX.UPDATED_BY]),
      updatedAt: normalizeTimestampValue(row[AUDIT_INDEX.UPDATED_AT]),
      isDeleted: normalizeBoolean(row[AUDIT_INDEX.IS_DELETED]),
      amount: normalizeNumber(row[AUDIT_INDEX.AMOUNT]),
      payee: safeString(row[AUDIT_INDEX.PAYEE]),
      receiptReference: safeString(row[AUDIT_INDEX.RECEIPT_REFERENCE]),
      liquidationDetails: safeString(row[AUDIT_INDEX.LIQUIDATION_DETAILS])
    });
  }
  return rows;
}

function parseFinanceDueRows(values) {
  const rows = [];
  for (var i = 1; i < values.length; i++) {
    const row = values[i] || [];
    if (!hasRowContent(row)) continue;
    rows.push({
      dueId: safeString(row[FINANCE_DUE_INDEX.DUE_ID]),
      date: normalizeDateValue(row[FINANCE_DUE_INDEX.DATE]),
      amount: normalizeNumber(row[FINANCE_DUE_INDEX.AMOUNT]),
      description: safeString(row[FINANCE_DUE_INDEX.DESCRIPTION]),
      updatedBy: safeString(row[FINANCE_DUE_INDEX.UPDATED_BY]),
      updatedAt: normalizeTimestampValue(row[FINANCE_DUE_INDEX.UPDATED_AT]),
      isDeleted: normalizeBoolean(row[FINANCE_DUE_INDEX.IS_DELETED])
    });
  }
  return rows;
}

function parseFinanceAccountabilityRows(values) {
  const rows = [];
  for (var i = 1; i < values.length; i++) {
    const row = values[i] || [];
    if (!hasRowContent(row)) continue;
    rows.push({
      obligationId: safeString(row[FINANCE_ACCOUNTABILITY_INDEX.OBLIGATION_ID]),
      title: safeString(row[FINANCE_ACCOUNTABILITY_INDEX.TITLE]),
      amount: normalizeNumber(row[FINANCE_ACCOUNTABILITY_INDEX.AMOUNT]),
      deadline: normalizeDateValue(row[FINANCE_ACCOUNTABILITY_INDEX.DEADLINE]),
      description: safeString(row[FINANCE_ACCOUNTABILITY_INDEX.DESCRIPTION]),
      memberIds: normalizeMemberIds(row[FINANCE_ACCOUNTABILITY_INDEX.MEMBER_IDS]),
      createdBy: safeString(row[FINANCE_ACCOUNTABILITY_INDEX.CREATED_BY]),
      createdAt: normalizeTimestampValue(row[FINANCE_ACCOUNTABILITY_INDEX.CREATED_AT]),
      updatedBy: safeString(row[FINANCE_ACCOUNTABILITY_INDEX.UPDATED_BY]),
      updatedAt: normalizeTimestampValue(row[FINANCE_ACCOUNTABILITY_INDEX.UPDATED_AT]),
      isDeleted: normalizeBoolean(row[FINANCE_ACCOUNTABILITY_INDEX.IS_DELETED])
    });
  }
  return rows;
}

function parseFinancePaymentRows(values) {
  const rows = [];
  for (var i = 1; i < values.length; i++) {
    const row = values[i] || [];
    if (!hasRowContent(row)) continue;
    rows.push({
      paymentId: safeString(row[FINANCE_PAYMENT_INDEX.PAYMENT_ID]),
      memberId: safeString(row[FINANCE_PAYMENT_INDEX.MEMBER_ID]),
      memberName: safeString(row[FINANCE_PAYMENT_INDEX.MEMBER_NAME]),
      obligationId: safeString(row[FINANCE_PAYMENT_INDEX.OBLIGATION_ID]),
      amount: normalizeNumber(row[FINANCE_PAYMENT_INDEX.AMOUNT]),
      paidAt: normalizeDateValue(row[FINANCE_PAYMENT_INDEX.PAID_AT]),
      note: safeString(row[FINANCE_PAYMENT_INDEX.NOTE]),
      recordedBy: safeString(row[FINANCE_PAYMENT_INDEX.RECORDED_BY]),
      recordedAt: normalizeTimestampValue(row[FINANCE_PAYMENT_INDEX.RECORDED_AT]),
      updatedBy: safeString(row[FINANCE_PAYMENT_INDEX.UPDATED_BY]),
      updatedAt: normalizeTimestampValue(row[FINANCE_PAYMENT_INDEX.UPDATED_AT]),
      isDeleted: normalizeBoolean(row[FINANCE_PAYMENT_INDEX.IS_DELETED])
    });
  }
  return rows;
}

function parseFinanceExpenseRows(values) {
  const rows = [];
  for (var i = 1; i < values.length; i++) {
    const row = values[i] || [];
    if (!hasRowContent(row)) continue;
    rows.push({
      expenseId: safeString(row[FINANCE_EXPENSE_INDEX.EXPENSE_ID]),
      title: safeString(row[FINANCE_EXPENSE_INDEX.TITLE]),
      amount: normalizeNumber(row[FINANCE_EXPENSE_INDEX.AMOUNT]),
      date: normalizeDateValue(row[FINANCE_EXPENSE_INDEX.DATE]),
      description: safeString(row[FINANCE_EXPENSE_INDEX.DESCRIPTION]),
      createdBy: safeString(row[FINANCE_EXPENSE_INDEX.CREATED_BY]),
      createdAt: normalizeTimestampValue(row[FINANCE_EXPENSE_INDEX.CREATED_AT]),
      updatedBy: safeString(row[FINANCE_EXPENSE_INDEX.UPDATED_BY]),
      updatedAt: normalizeTimestampValue(row[FINANCE_EXPENSE_INDEX.UPDATED_AT]),
      isDeleted: normalizeBoolean(row[FINANCE_EXPENSE_INDEX.IS_DELETED])
    });
  }
  return rows;
}

function writeAuditRows(sheet, rows) {
  const values = [AUDIT_HEADERS];
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    values.push([row.auditId, row.auditDate, row.title, row.area, row.category, row.status, row.summary, row.findings, row.recommendations, row.createdBy, row.createdAt, row.updatedBy, row.updatedAt, row.isDeleted ? 'TRUE' : 'FALSE', Number(row.amount) || 0, row.payee, row.receiptReference, row.liquidationDetails]);
  }
  writeSheetValues(sheet, values, AUDIT_HEADERS.length);
}

function writeFinanceDueRows(sheet, rows) {
  const values = [FINANCE_DUE_HEADERS];
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    values.push([row.dueId, row.date, Number(row.amount) || 0, row.description, row.updatedBy, row.updatedAt, row.isDeleted ? 'TRUE' : 'FALSE']);
  }
  writeSheetValues(sheet, values, FINANCE_DUE_HEADERS.length);
}

function writeFinanceAccountabilityRows(sheet, rows) {
  const values = [FINANCE_ACCOUNTABILITY_HEADERS];
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    values.push([row.obligationId, row.title, Number(row.amount) || 0, row.deadline, row.description, normalizeMemberIds(row.memberIds).join(','), row.createdBy, row.createdAt, row.updatedBy, row.updatedAt, row.isDeleted ? 'TRUE' : 'FALSE']);
  }
  writeSheetValues(sheet, values, FINANCE_ACCOUNTABILITY_HEADERS.length);
}

function writeFinancePaymentRows(sheet, rows) {
  const values = [FINANCE_PAYMENT_HEADERS];
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    values.push([row.paymentId, row.memberId, row.memberName, row.obligationId, Number(row.amount) || 0, row.paidAt, row.note, row.recordedBy, row.recordedAt, row.updatedBy, row.updatedAt, row.isDeleted ? 'TRUE' : 'FALSE']);
  }
  writeSheetValues(sheet, values, FINANCE_PAYMENT_HEADERS.length);
}

function writeFinanceExpenseRows(sheet, rows) {
  const values = [FINANCE_EXPENSE_HEADERS];
  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    values.push([row.expenseId, row.title, Number(row.amount) || 0, row.date, row.description, row.createdBy, row.createdAt, row.updatedBy, row.updatedAt, row.isDeleted ? 'TRUE' : 'FALSE']);
  }
  writeSheetValues(sheet, values, FINANCE_EXPENSE_HEADERS.length);
}

function buildAuditEntries(rows) {
  return rows.filter(function(row) { return !row.isDeleted; }).sort(function(a, b) {
    return safeString(b.auditDate).localeCompare(safeString(a.auditDate)) || safeString(b.updatedAt).localeCompare(safeString(a.updatedAt));
  }).map(function(row) {
    return {
      auditId: row.auditId, auditDate: row.auditDate, title: row.title, area: row.area, category: row.category,
      status: row.status || 'Published', summary: row.summary, findings: row.findings, recommendations: row.recommendations,
      createdBy: row.createdBy, createdAt: row.createdAt, updatedBy: row.updatedBy, updatedAt: row.updatedAt,
      amount: Number(row.amount) || 0, payee: row.payee, receiptReference: row.receiptReference, liquidationDetails: row.liquidationDetails
    };
  });
}

function buildFinanceDueDays(rows) {
  return rows.filter(function(row) { return !row.isDeleted; }).sort(function(a, b) {
    return safeString(a.date).localeCompare(safeString(b.date));
  }).map(function(row) {
    return { id: row.dueId, date: row.date, amount: Number(row.amount) || 0, description: row.description };
  });
}

function buildFinanceAccountabilities(rows) {
  return rows.filter(function(row) { return !row.isDeleted; }).sort(function(a, b) {
    return safeString(a.deadline).localeCompare(safeString(b.deadline)) || safeString(a.title).localeCompare(safeString(b.title));
  }).map(function(row) {
    return { id: row.obligationId, title: row.title, amount: Number(row.amount) || 0, deadline: row.deadline, description: row.description, memberIds: normalizeMemberIds(row.memberIds) };
  });
}

function buildFinancePayments(rows) {
  return rows.filter(function(row) { return !row.isDeleted; }).sort(function(a, b) {
    return safeString(b.paidAt).localeCompare(safeString(a.paidAt)) || safeString(b.recordedAt).localeCompare(safeString(a.recordedAt));
  }).map(function(row) {
    return { id: row.paymentId, memberId: row.memberId, obligationId: row.obligationId, amount: Number(row.amount) || 0, paidAt: row.paidAt, note: row.note };
  });
}

function buildFinanceExpenses(auditRows, legacyExpenseRows) {
  const expenses = [];
  for (var i = 0; i < auditRows.length; i++) {
    const row = auditRows[i];
    if (row.isDeleted || (Number(row.amount) || 0) <= 0) continue;
    expenses.push({
      id: row.auditId,
      title: row.title,
      amount: Number(row.amount) || 0,
      date: row.auditDate,
      description: row.summary,
      payee: row.payee,
      receiptReference: row.receiptReference,
      liquidationDetails: row.liquidationDetails,
      createdBy: row.createdBy,
      source: 'audit'
    });
  }
  for (var j = 0; j < legacyExpenseRows.length; j++) {
    const legacyRow = legacyExpenseRows[j];
    if (legacyRow.isDeleted) continue;
    expenses.push({
      id: legacyRow.expenseId,
      title: legacyRow.title,
      amount: Number(legacyRow.amount) || 0,
      date: legacyRow.date,
      description: legacyRow.description,
      payee: '',
      receiptReference: '',
      liquidationDetails: legacyRow.description,
      createdBy: legacyRow.createdBy,
      source: 'legacy_expense'
    });
  }
  return expenses.sort(function(a, b) {
    return safeString(b.date).localeCompare(safeString(a.date)) || safeString(b.id).localeCompare(safeString(a.id));
  });
}

function upsertAuditEntry(rows, payload) {
  const timestamp = getManilaTimestamp();
  const actor = safeString(payload.actor);
  const auditId = safeString(payload.auditId) || buildEntityId('AUD');
  for (var i = 0; i < rows.length; i++) {
    if (safeString(rows[i].auditId) !== auditId) continue;
    rows[i].auditDate = safeString(payload.auditDate) || rows[i].auditDate || getManilaDateString();
    rows[i].title = safeString(payload.title);
    rows[i].area = safeString(payload.area);
    rows[i].category = safeString(payload.category) || 'General';
    rows[i].status = safeString(payload.status) || 'Published';
    rows[i].summary = safeString(payload.summary);
    rows[i].findings = safeString(payload.findings);
    rows[i].recommendations = safeString(payload.recommendations);
    rows[i].amount = normalizeNumber(payload.amount);
    rows[i].payee = safeString(payload.payee);
    rows[i].receiptReference = safeString(payload.receiptReference);
    rows[i].liquidationDetails = safeString(payload.liquidationDetails);
    rows[i].updatedBy = actor;
    rows[i].updatedAt = timestamp;
    rows[i].isDeleted = false;
    if (!rows[i].createdBy) rows[i].createdBy = actor;
    if (!rows[i].createdAt) rows[i].createdAt = timestamp;
    return auditId;
  }
  rows.push({
    auditId: auditId, auditDate: safeString(payload.auditDate) || getManilaDateString(), title: safeString(payload.title),
    area: safeString(payload.area), category: safeString(payload.category) || 'General', status: safeString(payload.status) || 'Published',
    summary: safeString(payload.summary), findings: safeString(payload.findings), recommendations: safeString(payload.recommendations),
    createdBy: actor, createdAt: timestamp, updatedBy: actor, updatedAt: timestamp, isDeleted: false,
    amount: normalizeNumber(payload.amount), payee: safeString(payload.payee),
    receiptReference: safeString(payload.receiptReference), liquidationDetails: safeString(payload.liquidationDetails)
  });
  return auditId;
}

function markAuditEntryDeleted(rows, auditId, actor) {
  const timestamp = getManilaTimestamp();
  for (var i = 0; i < rows.length; i++) {
    if (safeString(rows[i].auditId) !== safeString(auditId) || rows[i].isDeleted) continue;
    rows[i].isDeleted = true;
    rows[i].updatedBy = actor;
    rows[i].updatedAt = timestamp;
    return true;
  }
  return false;
}

function upsertFinanceAccountability(rows, payload) {
  const timestamp = getManilaTimestamp();
  const obligationId = safeString(payload.obligationId) || buildEntityId('ACC');
  for (var i = 0; i < rows.length; i++) {
    if (safeString(rows[i].obligationId) !== obligationId) continue;
    rows[i].title = safeString(payload.title);
    rows[i].amount = normalizeNumber(payload.amount);
    rows[i].deadline = safeString(payload.deadline);
    rows[i].description = safeString(payload.description) || 'Custom accountability';
    rows[i].memberIds = normalizeMemberIds(payload.memberIds);
    rows[i].updatedBy = safeString(payload.actor);
    rows[i].updatedAt = timestamp;
    rows[i].isDeleted = false;
    if (!rows[i].createdBy) rows[i].createdBy = safeString(payload.actor);
    if (!rows[i].createdAt) rows[i].createdAt = timestamp;
    return obligationId;
  }
  rows.push({
    obligationId: obligationId, title: safeString(payload.title), amount: normalizeNumber(payload.amount), deadline: safeString(payload.deadline),
    description: safeString(payload.description) || 'Custom accountability', memberIds: normalizeMemberIds(payload.memberIds),
    createdBy: safeString(payload.actor), createdAt: timestamp, updatedBy: safeString(payload.actor), updatedAt: timestamp, isDeleted: false
  });
  return obligationId;
}

function markFinanceAccountabilityDeleted(rows, obligationId, actor) {
  const timestamp = getManilaTimestamp();
  for (var i = 0; i < rows.length; i++) {
    if (safeString(rows[i].obligationId) !== safeString(obligationId) || rows[i].isDeleted) continue;
    rows[i].isDeleted = true;
    rows[i].updatedBy = actor;
    rows[i].updatedAt = timestamp;
    return true;
  }
  return false;
}

function upsertFinanceExpense(rows, payload) {
  const timestamp = getManilaTimestamp();
  const expenseId = safeString(payload.expenseId) || buildEntityId('EXP');
  for (var i = 0; i < rows.length; i++) {
    if (safeString(rows[i].expenseId) !== expenseId) continue;
    rows[i].title = safeString(payload.title);
    rows[i].amount = normalizeNumber(payload.amount);
    rows[i].date = safeString(payload.date);
    rows[i].description = safeString(payload.description);
    rows[i].updatedBy = safeString(payload.actor);
    rows[i].updatedAt = timestamp;
    rows[i].isDeleted = false;
    if (!rows[i].createdBy) rows[i].createdBy = safeString(payload.actor);
    if (!rows[i].createdAt) rows[i].createdAt = timestamp;
    return expenseId;
  }
  rows.push({
    expenseId: expenseId, title: safeString(payload.title), amount: normalizeNumber(payload.amount), date: safeString(payload.date),
    description: safeString(payload.description), createdBy: safeString(payload.actor), createdAt: timestamp,
    updatedBy: safeString(payload.actor), updatedAt: timestamp, isDeleted: false
  });
  return expenseId;
}

function upsertFinanceDueDay(rows, payload) {
  const timestamp = getManilaTimestamp();
  const dueId = safeString(payload.dueId) || ('due-' + safeString(payload.date));
  for (var i = 0; i < rows.length; i++) {
    if (safeString(rows[i].dueId) !== dueId) continue;
    rows[i].date = safeString(payload.date);
    rows[i].amount = normalizeNumber(payload.amount);
    rows[i].description = safeString(payload.description) || 'Regular class daily due.';
    rows[i].updatedBy = safeString(payload.actor);
    rows[i].updatedAt = timestamp;
    rows[i].isDeleted = false;
    return dueId;
  }
  rows.push({
    dueId: dueId, date: safeString(payload.date), amount: normalizeNumber(payload.amount),
    description: safeString(payload.description) || 'Regular class daily due.', updatedBy: safeString(payload.actor),
    updatedAt: timestamp, isDeleted: false
  });
  return dueId;
}

function updateFinanceDueDayAmount(rows, dueId, amount, actor) {
  const timestamp = getManilaTimestamp();
  for (var i = 0; i < rows.length; i++) {
    if (safeString(rows[i].dueId) !== safeString(dueId) || rows[i].isDeleted) continue;
    rows[i].amount = amount;
    rows[i].updatedBy = actor;
    rows[i].updatedAt = timestamp;
    return true;
  }
  return false;
}

function getFinanceMembers(user, accountabilityRows, paymentRows) {
  const members = [];
  const seen = {};
  const directoryMembers = fetchDirectoryMembers(user && user.idNumber ? user.idNumber : '');
  for (var i = 0; i < directoryMembers.length; i++) pushUniqueMember(members, seen, directoryMembers[i].id, directoryMembers[i].name);
  if (user && user.idNumber) pushUniqueMember(members, seen, safeString(user.idNumber), safeString(user.fullName || user.name));
  for (var j = 0; j < accountabilityRows.length; j++) {
    const row = accountabilityRows[j];
    if (row.isDeleted) continue;
    const memberIds = normalizeMemberIds(row.memberIds);
    for (var k = 0; k < memberIds.length; k++) pushUniqueMember(members, seen, memberIds[k], memberIds[k]);
  }
  for (var m = 0; m < paymentRows.length; m++) {
    const payment = paymentRows[m];
    if (payment.isDeleted) continue;
    pushUniqueMember(members, seen, payment.memberId, payment.memberName || payment.memberId);
  }
  members.sort(function(a, b) { return safeString(a.name).localeCompare(safeString(b.name)) || safeString(a.id).localeCompare(safeString(b.id)); });
  return members;
}

function fetchDirectoryMembers(userId) {
  const normalizedUserId = safeString(userId);
  if (!normalizedUserId) return [];
  const response = postJsonToService(FINANCE_AUDIT_DIRECTORY_GAS_URL, { action: 'getClassmates', idNumber: normalizedUserId });
  const classmates = Array.isArray(response.classmates) ? response.classmates : [];
  return classmates.map(function(item) {
    return { id: safeString(item.idNumber), name: safeString(item.name || item.fullName || item.idNumber) };
  }).filter(function(item) { return !!item.id; });
}

function pushUniqueMember(members, seen, id, name) {
  const memberId = safeString(id);
  if (!memberId || seen[memberId]) return;
  seen[memberId] = true;
  members.push({ id: memberId, name: safeString(name) || memberId });
}

function findFinanceObligationById(obligationId, dueRows, accountabilityRows, members) {
  const targetId = safeString(obligationId);
  for (var i = 0; i < dueRows.length; i++) {
    if (safeString(dueRows[i].dueId) === targetId && !dueRows[i].isDeleted) {
      return { id: dueRows[i].dueId, kind: 'daily_due', amount: Number(dueRows[i].amount) || 0, memberIds: members.map(function(member) { return member.id; }) };
    }
  }
  for (var j = 0; j < accountabilityRows.length; j++) {
    if (safeString(accountabilityRows[j].obligationId) === targetId && !accountabilityRows[j].isDeleted) {
      return { id: accountabilityRows[j].obligationId, kind: 'accountability', amount: Number(accountabilityRows[j].amount) || 0, memberIds: normalizeMemberIds(accountabilityRows[j].memberIds) };
    }
  }
  return null;
}

function getOutstandingAmountForObligation(memberId, obligation, paymentRows) {
  var paid = 0;
  for (var i = 0; i < paymentRows.length; i++) {
    const row = paymentRows[i];
    if (row.isDeleted) continue;
    if (safeString(row.memberId) !== safeString(memberId)) continue;
    if (safeString(row.obligationId) !== safeString(obligation.id)) continue;
    paid += Number(row.amount) || 0;
  }
  return Math.max((Number(obligation.amount) || 0) - paid, 0);
}

function findMemberNameById(memberId, members, paymentRows) {
  const normalizedMemberId = safeString(memberId);
  for (var i = 0; i < members.length; i++) if (safeString(members[i].id) === normalizedMemberId) return safeString(members[i].name) || normalizedMemberId;
  for (var j = 0; j < paymentRows.length; j++) if (safeString(paymentRows[j].memberId) === normalizedMemberId && safeString(paymentRows[j].memberName)) return safeString(paymentRows[j].memberName);
  return normalizedMemberId;
}

function getResolvedUserProfile(userId) {
  const normalizedUserId = safeString(userId);
  if (!normalizedUserId) return { user: null, position: '' };
  const profileResult = getDirectoryProfile(normalizedUserId);
  if (profileResult.success && profileResult.user) return { user: profileResult.user, position: safeString(profileResult.user.position) };
  return { user: { idNumber: normalizedUserId, fullName: '', name: '', role: '', position: '' }, position: '' };
}

function getDirectoryProfile(userId) {
  return postJsonToService(FINANCE_AUDIT_DIRECTORY_GAS_URL, { action: 'getUserProfile', idNumber: safeString(userId) });
}

function postJsonToService(url, payload) {
  try {
    const response = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
    return JSON.parse(response.getContentText() || '{}');
  } catch (error) {
    return { error: error.message || String(error) };
  }
}

function writeSheetValues(sheet, values, columnCount) {
  const width = Math.max(Number(columnCount) || 0, 1);
  const normalized = [];
  for (var i = 0; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i].slice(0, width) : [];
    while (row.length < width) row.push('');
    normalized.push(row);
  }
  sheet.clearContents();
  if (normalized.length) sheet.getRange(1, 1, normalized.length, width).setValues(normalized);
  sheet.setFrozenRows(1);
}

function hasRowContent(row) {
  for (var i = 0; i < row.length; i++) if (safeString(row[i]) !== '') return true;
  return false;
}

function normalizeMemberIds(value) {
  const source = Array.isArray(value) ? value : safeString(value).split(',');
  const result = [];
  const seen = {};
  for (var i = 0; i < source.length; i++) {
    const memberId = safeString(source[i]);
    if (!memberId || seen[memberId]) continue;
    seen[memberId] = true;
    result.push(memberId);
  }
  return result;
}

function normalizeBoolean(value) {
  const normalized = safeString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

function normalizeDateValue(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, FINANCE_AUDIT_TIMEZONE, 'yyyy-MM-dd');
  const raw = safeString(value);
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? '' : Utilities.formatDate(parsed, FINANCE_AUDIT_TIMEZONE, 'yyyy-MM-dd');
}

function normalizeTimestampValue(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, FINANCE_AUDIT_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  const raw = safeString(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? raw : Utilities.formatDate(parsed, FINANCE_AUDIT_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function normalizeWeekday(value) {
  const numeric = Number(value);
  return isNaN(numeric) || numeric < 0 || numeric > 6 ? null : numeric;
}

function enumerateMatchingDates(startDate, endDate, weekday) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
  const dates = [];
  const current = new Date(start.getTime());
  while (current <= end) {
    if (current.getDay() === weekday) dates.push(Utilities.formatDate(current, FINANCE_AUDIT_TIMEZONE, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function buildEntityId(prefix) {
  return [safeString(prefix || 'ROW'), Utilities.formatDate(new Date(), FINANCE_AUDIT_TIMEZONE, 'yyyyMMdd'), Utilities.getUuid().slice(0, 8).toUpperCase()].join('-');
}

function getActorLabel(user, fallbackUserId) {
  return safeString(user && (user.fullName || user.name || user.idNumber)) || safeString(fallbackUserId) || 'System';
}

function getManilaTimestamp() {
  return Utilities.formatDate(new Date(), FINANCE_AUDIT_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function getManilaDateString() {
  return Utilities.formatDate(new Date(), FINANCE_AUDIT_TIMEZONE, 'yyyy-MM-dd');
}

function safeString(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
