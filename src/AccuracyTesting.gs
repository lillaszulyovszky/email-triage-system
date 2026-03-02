// ============================================
// ACCURACY TESTING
// ============================================

function testAccuracy() {
  Logger.log('Starting accuracy test...');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let testSheet = ss.getSheetByName('Accuracy Test');

  if (!testSheet) {
    testSheet = ss.insertSheet('Accuracy Test');
  } else {
    testSheet.clear();
  }

  testSheet.appendRow([
    'Subject', 'Expected Category', 'AI Category',
    'Confidence', 'Category Correct?',
    'Expected Urgent', 'AI Urgent', 'Urgent Correct?',
    'Expected VIP', 'VIP Correct?', 'Method'
  ]);

  let correctCategory = 0;
  let correctUrgent   = 0;
  let urgentTotal     = 0;
  let correctVip      = 0;
  let vipTotal        = 0;
  let total           = 0;

  TEST_EMAILS.forEach(testEmail => {
    const mockMessage = {
      getSubject:   () => testEmail.subject,
      getPlainBody: () => testEmail.body,
      getFrom:      () => testEmail.from
    };

    const analysis      = analyzeEmailWithAI(mockMessage);
    const catCorrect    = analysis.categoryName === testEmail.expectedCategory;

    // Urgent check
    const expectUrgent  = testEmail.expectedUrgent === true;
    const urgentCorrect = expectUrgent ? analysis.isUrgent === true : true; // only penalise false negatives
    if (expectUrgent) {
      urgentTotal++;
      if (analysis.isUrgent) correctUrgent++;
    }

    // VIP check (based on sender match against CONFIG.vipSenders)
    const expectVip     = testEmail.expectedVip === true;
    const vipDetected   = isVIP(testEmail.from);
    const vipCorrect    = expectVip ? vipDetected : true;
    if (expectVip) {
      vipTotal++;
      if (vipDetected) correctVip++;
    }

    testSheet.appendRow([
      testEmail.subject,
      testEmail.expectedCategory,
      analysis.categoryName,
      (analysis.confidence * 100).toFixed(1) + '%',
      catCorrect    ? '✓' : '✗',
      expectUrgent  ? 'Yes' : '',
      analysis.isUrgent ? 'Yes' : '',
      expectUrgent  ? (analysis.isUrgent ? '✓' : '✗') : '',
      expectVip     ? 'Yes' : '',
      expectVip     ? (vipDetected ? '✓' : '✗') : '',
      analysis.analysisMethod
    ]);

    if (catCorrect) correctCategory++;
    total++;
  });

  const categoryAccuracy = ((correctCategory / total) * 100).toFixed(1);

  testSheet.appendRow([]);
  testSheet.appendRow([
    'RESULTS',
    `Category: ${correctCategory}/${total} (${categoryAccuracy}%)`,
    '',  '', '',
    `Urgent: ${correctUrgent}/${urgentTotal}`,
    '', '',
    `VIP: ${correctVip}/${vipTotal}`
  ]);

  Logger.log(`Category accuracy: ${categoryAccuracy}% (${correctCategory}/${total})`);
  Logger.log(`Urgent detection: ${correctUrgent}/${urgentTotal}`);
  Logger.log(`VIP detection: ${correctVip}/${vipTotal}`);

  try {
    SpreadsheetApp.getUi().alert(
      `Accuracy Test Complete!\n\n` +
      `Category accuracy: ${correctCategory}/${total} (${categoryAccuracy}%)\n` +
      `Urgent detection:  ${correctUrgent}/${urgentTotal}\n` +
      `VIP detection:     ${correctVip}/${vipTotal}\n\n` +
      `Check the "Accuracy Test" sheet for details.`
    );
  } catch (e) {}
}

function createConfusionMatrix() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet  = ss.getSheetByName(CONFIG.emailLogSheet);

  if (!logSheet) {
    Logger.log('No email log found');
    return;
  }

  Logger.log('Confusion matrix creation not yet implemented');
}
