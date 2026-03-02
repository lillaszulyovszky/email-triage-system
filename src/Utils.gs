// ============================================
// UTILITY FUNCTIONS
// ============================================

function getOrCreateLabel(labelName) {
  try {
    let label = GmailApp.getUserLabelByName(labelName);
    if (!label) {
      label = GmailApp.createLabel(labelName);
      Logger.log(`Created label: ${labelName}`);
    }
    return label;
  } catch (e) {
    Logger.log(`Error with label ${labelName}: ${e.message}`);
    return null;
  }
}

function ensureLabelsExist() {
  Logger.log('Ensuring all labels exist...');
  for (const labelKey in CONFIG.labels) {
    getOrCreateLabel(CONFIG.labels[labelKey]);
  }
  Logger.log('All labels created/verified');
  try {
    SpreadsheetApp.getUi().alert('Labels created successfully!\n\nCheck Gmail sidebar to see all labels.');
  } catch (e) {}
}

function isInternalEmail(sender) {
  return CONFIG.internalDomains.some(domain => sender.includes(domain));
}

function isVIP(sender) {
  return CONFIG.vipSenders.some(vip => sender.includes(vip));
}

function logEmailAnalysis(message, analysis, isFollowUp) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName(CONFIG.emailLogSheet);

  if (!logSheet) {
    logSheet = ss.insertSheet(CONFIG.emailLogSheet);
    logSheet.appendRow([
      'Timestamp', 'From', 'Subject', 'Language',
      'Category', 'Confidence', 'Sentiment', 'Method',
      'Draft Created', 'Status', 'Follow-up'  // Follow-up column added
    ]);
    // Style header
    logSheet.getRange(1, 1, 1, 11)
      .setBackground('#1a73e8')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  }

  const draftCreated = (
    analysis.confidence >= CONFIG.confidenceThreshold &&
    analysis.categoryName !== 'COMPLAINT'
  ) ? 'Yes ✓' : 'No ✗';

  const status = analysis.categoryName === 'COMPLAINT'  ? 'Manual Review' :
                 analysis.sentiment    === 'negative'   ? 'Sentiment Alert' :
                 analysis.confidence   < 0.6            ? 'Low Confidence'  : 'Auto-Processed';

  logSheet.appendRow([
    new Date(),
    message.getFrom(),
    message.getSubject(),
    analysis.language ? analysis.language.toUpperCase() : 'N/A',
    analysis.categoryName,
    (analysis.confidence * 100).toFixed(1) + '%',
    analysis.sentiment    || 'N/A',
    analysis.analysisMethod || 'N/A',
    draftCreated,
    status,
    isFollowUp ? 'Yes' : 'No'
  ]);
}

// Maps ISO 639-1 language codes to readable names for Gmail labels
function getLanguageName(code) {
  const languages = {
    en: 'English', es: 'Spanish', de: 'German',  fr: 'French',
    it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
    ru: 'Russian', zh: 'Chinese',  ja: 'Japanese', ko: 'Korean',
    ar: 'Arabic',  hu: 'Hungarian', cs: 'Czech',  ro: 'Romanian',
    sv: 'Swedish', da: 'Danish',   fi: 'Finnish',  tr: 'Turkish'
  };
  return languages[code] || code.toUpperCase();
}
