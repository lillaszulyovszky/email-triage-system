// ============================================
// EMAIL TRIAGE SYSTEM — MAIN CODE
// ============================================

function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('🧪 Email Triage')
    .addItem('✅ Test Setup',               'testSetup')
    .addItem('🔑 Configure API Keys',       'configureSecrets')
    .addItem('🔍 View Credential Status',   'viewSecretStatus')
    .addSeparator()
    .addItem('📧 Send 1 Test Email (SAFE)',  'sendSingleTestEmail')
    .addItem('📧 Send 8 Test Emails (SAFE)', 'generateSafeTestEmails')
    .addSeparator()
    .addItem('▶️ Process Emails Now',        'processUnreadEmails')
    .addItem('⏰ Schedule Auto-Processing',  'scheduleProcessing')
    .addItem('🛑 Stop Auto-Processing',      'stopProcessing')
    .addItem('🏷️ Setup Labels',              'ensureLabelsExist')
    .addItem('📅 Setup Availability Sheet',  'setupAvailabilitySheet')
    .addItem('👥 Setup Members Sheet',       'setupMembersSheet')
    .addSeparator()
    .addItem('🔄 Sync from Platform API',    'syncFromPlatform')
    .addSeparator()
    .addItem('📊 Test Accuracy',             'testAccuracy')
    .addItem('📝 Draft Statistics',          'showDraftStatistics')
    .addItem('📬 Send Daily Digest Now',     'sendDailyDigest')
    .addItem('⏰ Schedule Daily Digest',     'scheduleDailyDigest')
    .addToUi();
}

// ============================================
// SETUP & HEALTH CHECK
// ============================================

function testSetup() {
  Logger.log('Starting setup test...');

  try {
    const threads   = GmailApp.search('is:unread', 0, 1);
    Logger.log('✓ Gmail works: ' + threads.length + ' unread found');

    const ss        = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = ss.getName();
    Logger.log('✓ Sheet works: ' + sheetName);

    const apiConfigured  = AI_CONFIG.geminiApiKey !== 'YOUR_GEMINI_API_KEY_HERE';
    const inboxConfigured = CONFIG.inboxAddress   !== 'YOUR_EMAIL@gmail.com';
    const availSheet     = ss.getSheetByName(CONFIG.availabilitySheet);
    const membersSheet   = ss.getSheetByName(CONFIG.membersSheet);
    const platform       = INTEGRATION_CONFIG.platform;
    const autoRunning    = isProcessingScheduled();

    Logger.log(apiConfigured    ? '✓ Gemini API key configured'        : '⚠️ Gemini API key not set');
    Logger.log(inboxConfigured  ? '✓ Inbox address configured'         : '⚠️ Inbox address not set');
    Logger.log(availSheet       ? '✓ Availability sheet found'         : '⚠️ Availability sheet missing');
    Logger.log(membersSheet     ? '✓ Members sheet found'              : '⚠️ Members sheet missing');
    Logger.log(`Platform: ${platform}`);
    Logger.log(autoRunning      ? '✓ Auto-processing is scheduled'     : '⚠️ Auto-processing not scheduled');

    try {
      SpreadsheetApp.getUi().alert(
        '✓ Setup Check\n\n' +
        'Gmail:              Working ✓\n' +
        'Spreadsheet:        ' + sheetName + ' ✓\n' +
        'AI (Gemini):        ' + (apiConfigured    ? 'Configured ✓'  : 'Not set ⚠️')   + '\n' +
        'Inbox address:      ' + (inboxConfigured  ? 'Configured ✓'  : 'Not set ⚠️')   + '\n' +
        'Availability sheet: ' + (availSheet       ? 'Found ✓'       : 'Missing ⚠️')   + '\n' +
        'Members sheet:      ' + (membersSheet     ? 'Found ✓'       : 'Missing ⚠️')   + '\n' +
        'Platform:           ' + platform + '\n' +
        'Auto-processing:    ' + (autoRunning      ? 'Running ✓'     : 'Not scheduled ⚠️') + '\n\n' +
        'Setup checklist:\n' +
        '1. Set inboxAddress in Config.gs\n' +
        '2. Set Gemini API key in Config.gs\n' +
        '3. Run "Setup Labels"\n' +
        '4. Run "Setup Availability Sheet"\n' +
        '5. Run "Setup Members Sheet"\n' +
        '6. (Optional) Set platform in Config.gs + Run "Sync from Platform API"\n' +
        '7. Run "Schedule Auto-Processing"'
      );
    } catch (uiError) {}

    return 'Success!';

  } catch (e) {
    Logger.log('✗ ERROR: ' + e.message);
    try { SpreadsheetApp.getUi().alert('✗ Setup Failed:\n\n' + e.message); } catch (e2) {}
    return 'Failed: ' + e.message;
  }
}


// ============================================
// FIX 1 — PRODUCTION EMAIL FILTER
// ============================================
// Replaces the old "from:YOUR_EMAIL" test filter.
// Finds all real inbound unread emails that haven't been processed yet,
// skipping noise before Gemini is ever called.
// ============================================

function buildSearchQuery() {
  // Base: unread, addressed to the space inbox, not yet processed by this system
  // We use -label to exclude already-processed threads (cheaper than checking sheet)
  let query = `to:${CONFIG.inboxAddress} is:unread -label:${CONFIG.labels.billing.replace(/\s/g,'/')} -label:${CONFIG.labels.booking.replace(/\s/g,'/')} -label:${CONFIG.labels.complaint.replace(/\s/g,'/')} -label:${CONFIG.labels.infoRequest.replace(/\s/g,'/')} -label:${CONFIG.labels.membership.replace(/\s/g,'/')} -label:${CONFIG.labels.spam.replace(/\s/g,'/')} -label:${CONFIG.labels.internal.replace(/\s/g,'/')}`;

  // Exclude internal senders
  CONFIG.internalDomains.forEach(domain => {
    query += ` -from:*${domain}`;
  });

  return query;
}

function isNoisyEmail(message) {
  const sender  = (message.getFrom()    || '').toLowerCase();
  const subject = (message.getSubject() || '').toLowerCase();

  // Check sender patterns
  const noisySender = CONFIG.noiseFilters.senderPatterns.some(p =>
    sender.includes(p.toLowerCase())
  );
  if (noisySender) return true;

  // Check subject patterns
  const noisySubject = CONFIG.noiseFilters.subjectPatterns.some(p =>
    subject.includes(p.toLowerCase())
  );
  if (noisySubject) return true;

  // Check for List-Unsubscribe header (newsletters/marketing)
  // Apps Script doesn't expose raw headers directly, but bulk senders
  // almost always include "unsubscribe" in the body or subject
  if (CONFIG.noiseFilters.skipListEmails) {
    const bodyPreview = message.getPlainBody().substring(0, 500).toLowerCase();
    if (bodyPreview.includes('unsubscribe') && bodyPreview.includes('mailing list')) return true;
  }

  return false;
}

function processUnreadEmails() {
  Logger.log('Starting email processing run...');

  try {
    if (CONFIG.inboxAddress === 'YOUR_EMAIL@gmail.com') {
      Logger.log('⚠️ inboxAddress not configured in Config.gs');
      try {
        SpreadsheetApp.getUi().alert(
          'Inbox Not Configured\n\n' +
          'Please set CONFIG.inboxAddress in Config.gs to the\n' +
          'Gmail address that receives member emails.'
        );
      } catch (e) {}
      return;
    }

    const query   = buildSearchQuery();
    const threads = GmailApp.search(query, 0, CONFIG.maxEmailsPerRun);

    Logger.log(`Search query: ${query}`);
    Logger.log(`Found ${threads.length} candidate threads`);

    if (threads.length === 0) {
      Logger.log('No new emails to process');
      return;
    }

    ensureLabelsExist();

    let processed = 0;
    let skipped   = 0;
    let errors    = 0;

    threads.forEach(thread => {
      try {
        const messages      = thread.getMessages();
        const latestMessage = messages[messages.length - 1];

        // Noise filter — runs before AI to save API calls
        if (isNoisyEmail(latestMessage)) {
          Logger.log(`Skipped (noise): ${latestMessage.getSubject()}`);
          skipped++;
          return;
        }

        processThread(thread);
        processed++;

      } catch (e) {
        Logger.log(`✗ Error on thread: ${e.message}`);
        errors++;
      }
    });

    Logger.log(`\nRun complete. Processed: ${processed}, Skipped (noise): ${skipped}, Errors: ${errors}`);

    // Only show UI alert when triggered manually, not from time trigger
    try {
      SpreadsheetApp.getUi().alert(
        `Processing Complete!\n\nProcessed: ${processed}\nSkipped (noise/spam): ${skipped}\nErrors: ${errors}\n\nCheck Gmail for labels and drafts!`
      );
    } catch (e) {
      // No UI in time-triggered runs — that's expected
    }

  } catch (e) {
    Logger.log(`Fatal error: ${e.message}\n${e.stack}`);
    notifyError('processUnreadEmails', e.message);
  }
}


// ============================================
// FIX 2 — AUTOMATIC TIME-TRIGGERED PROCESSING
// ============================================

function scheduleProcessing() {
  // Remove existing processing triggers to avoid duplicates
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processUnreadEmails')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Run every 15 minutes — fast enough for real-time feel, well within
  // Apps Script's 6 min/run quota for free accounts
  ScriptApp.newTrigger('processUnreadEmails')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('Auto-processing scheduled: every 15 minutes');

  try {
    SpreadsheetApp.getUi().alert(
      'Auto-Processing Scheduled!\n\n' +
      'The system will now process new emails automatically every 15 minutes.\n\n' +
      'You don\'t need to click anything — just check Gmail for labels and drafts.\n\n' +
      'To stop: Email Triage > Stop Auto-Processing'
    );
  } catch (e) {}
}

function stopProcessing() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processUnreadEmails');

  triggers.forEach(t => ScriptApp.deleteTrigger(t));

  Logger.log(`Removed ${triggers.length} processing trigger(s)`);

  try {
    SpreadsheetApp.getUi().alert(
      triggers.length > 0
        ? 'Auto-processing stopped.\n\nRun "Schedule Auto-Processing" to restart.'
        : 'No active processing triggers found.'
    );
  } catch (e) {}
}

function isProcessingScheduled() {
  return ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'processUnreadEmails');
}


// ============================================
// THREAD PROCESSING
// ============================================

function processThread(thread) {
  const messages      = thread.getMessages();
  const latestMessage = messages[messages.length - 1];
  const sender        = latestMessage.getFrom();
  const subject       = latestMessage.getSubject();

  if (isInternalEmail(sender)) {
    thread.addLabel(getOrCreateLabel(CONFIG.labels.internal));
    Logger.log(`Skipped internal: ${sender}`);
    return;
  }

  const isFollowUp = detectFollowUp(thread, messages);
  if (isFollowUp) Logger.log(`Follow-up detected: ${subject}`);

  const analysis = analyzeEmailWithAI(latestMessage);
  if (!analysis) {
    Logger.log(`Analysis failed: ${subject}`);
    return;
  }

  Logger.log(`[${analysis.analysisMethod}] [${analysis.language?.toUpperCase()}] ${subject} → ${analysis.categoryName} (${(analysis.confidence * 100).toFixed(0)}%) sentiment:${analysis.sentiment}`);

  // Category label
  const categoryLabel = getOrCreateLabel(CATEGORIES[analysis.categoryName]?.label || analysis.categoryName);
  if (categoryLabel) thread.addLabel(categoryLabel);

  // Urgent
  if (analysis.isUrgent) {
    thread.addLabel(getOrCreateLabel(CONFIG.labels.urgent));
    thread.markImportant();
    thread.star();
  }

  // VIP
  if (isVIP(sender)) {
    thread.addLabel(getOrCreateLabel(CONFIG.labels.vip));
    thread.markImportant();
  }

  // Sentiment escalation — negative tone on any category
  if (analysis.sentiment === 'negative' && analysis.categoryName !== 'COMPLAINT') {
    thread.addLabel(getOrCreateLabel(CONFIG.labels.needsReview));
    thread.addLabel(getOrCreateLabel(CONFIG.labels.sentimentAlert));
    Logger.log(`Negative sentiment on ${analysis.categoryName}`);
  }

  // Draft generation
  if (analysis.confidence >= CONFIG.confidenceThreshold &&
      analysis.categoryName !== 'COMPLAINT' &&
      analysis.categoryName !== 'SPAM') {
    try {
      const draft = generateDraftReply(latestMessage, analysis, isFollowUp);
      if (draft) {
        thread.createDraftReply(draft);
        Logger.log(`✓ Draft created${isFollowUp ? ' [FOLLOW-UP]' : ''}`);
      }
    } catch (e) {
      Logger.log(`Draft failed: ${e.message}`);
    }
  }

  // Needs review
  if (analysis.confidence < 0.6 || analysis.categoryName === 'COMPLAINT') {
    thread.addLabel(getOrCreateLabel(CONFIG.labels.needsReview));
  }

  logEmailAnalysis(latestMessage, analysis, isFollowUp);
}

function detectFollowUp(thread, messages) {
  if (messages.length > 1) return true;
  const existingLabels = thread.getLabels().map(l => l.getName());
  const categoryLabels = Object.values(CATEGORIES).map(c => c.label);
  return existingLabels.some(l => categoryLabels.includes(l));
}


// ============================================
// ERROR NOTIFICATIONS
// ============================================
// Emails the digest recipient when a processing run fails silently.
// Without this, time-triggered failures are invisible.

function notifyError(functionName, errorMessage) {
  try {
    const recipient = CONFIG.digestRecipient;
    if (!recipient || recipient === 'YOUR_EMAIL@gmail.com') return;

    GmailApp.sendEmail(
      recipient,
      `⚠️ Email Triage Error — ${CONFIG.spaceName}`,
      `An error occurred in the email triage system.\n\n` +
      `Function: ${functionName}\n` +
      `Error: ${errorMessage}\n` +
      `Time: ${new Date().toLocaleString()}\n\n` +
      `Check Apps Script View > Logs for the full stack trace.`,
      { name: CONFIG.spaceName || 'Email Triage System' }
    );
  } catch (e) {
    Logger.log('Could not send error notification: ' + e.message);
  }
}


// ============================================
// DRAFT STATISTICS
// ============================================

function showDraftStatistics() {
  try {
    const ss       = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(CONFIG.emailLogSheet);

    if (!logSheet) {
      SpreadsheetApp.getUi().alert('No email log found. Process emails first.');
      return;
    }

    const data           = logSheet.getDataRange().getValues();
    let totalEmails      = data.length - 1;
    let draftsCreated    = 0;
    let manualReview     = 0;
    let followUps        = 0;
    let sentimentAlerts  = 0;
    const languageCounts = {};

    for (let i = 1; i < data.length; i++) {
      const language  = data[i][3];
      const draft     = data[i][8];
      const status    = data[i][9];
      const followUp  = data[i][10];
      const sentiment = data[i][6];

      if (draft    === 'Yes ✓')             { draftsCreated++; languageCounts[language] = (languageCounts[language] || 0) + 1; }
      if (status   && status.includes('Manual')) manualReview++;
      if (followUp === 'Yes')                    followUps++;
      if (sentiment === 'negative')              sentimentAlerts++;
    }

    const draftRate     = totalEmails > 0 ? ((draftsCreated / totalEmails) * 100).toFixed(1) : 0;
    const langBreakdown = Object.entries(languageCounts)
      .map(([l, c]) => `  - ${l}: ${c}`).join('\n');

    SpreadsheetApp.getUi().alert(
      `📊 Draft Statistics\n\n` +
      `Total Processed:  ${totalEmails}\n` +
      `Drafts Created:   ${draftsCreated} (${draftRate}%)\n` +
      (langBreakdown ? `Languages:\n${langBreakdown}\n` : '') +
      `\nFollow-up threads: ${followUps}\n` +
      `Sentiment alerts:  ${sentimentAlerts}\n` +
      `Manual review:     ${manualReview}\n\n` +
      `Time Saved: ~${(draftsCreated * 3).toFixed(0)} minutes`
    );

  } catch (e) {
    SpreadsheetApp.getUi().alert(`Error: ${e.message}`);
  }
}
