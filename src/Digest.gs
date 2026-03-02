// ============================================
// DAILY DIGEST — Feature 5
// ============================================
// Sends a morning summary email to CONFIG.digestRecipient
// covering the previous day's activity: emails processed,
// drafts created, urgent items, VIPs, sentiment alerts.
//
// Can be triggered manually from the menu or scheduled
// to run automatically every morning via scheduleDailyDigest().
// ============================================

function sendDailyDigest() {
  const recipient = CONFIG.digestRecipient;

  if (!recipient || recipient === 'YOUR_EMAIL@gmail.com') {
    try {
      SpreadsheetApp.getUi().alert(
        'Digest Not Configured',
        'Please set digestRecipient in Config.gs to your email address.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {}
    return;
  }

  const stats = getYesterdayStats();
  const html  = buildDigestHtml(stats);
  const plain = buildDigestPlain(stats);

  const yesterday = Utilities.formatDate(
    stats.date, Session.getScriptTimeZone(), 'EEEE d MMMM yyyy'
  );

  GmailApp.sendEmail(recipient, `📬 Daily Inbox Summary — ${yesterday}`, plain, {
    htmlBody: html,
    name:     CONFIG.spaceName || 'Email Triage System'
  });

  Logger.log(`Daily digest sent to ${recipient}`);

  try {
    SpreadsheetApp.getUi().alert(
      `Digest sent to ${recipient}!\n\nCheck your inbox.`
    );
  } catch (e) {}
}


// ── Pull yesterday's stats from Email Log sheet ───────────────────────────
function getYesterdayStats() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet  = ss.getSheetByName(CONFIG.emailLogSheet);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const dayEnd    = new Date(yesterday); dayEnd.setHours(23, 59, 59, 999);

  const stats = {
    date:           yesterday,
    total:          0,
    draftsCreated:  0,
    urgent:         0,
    vip:            0,
    sentimentAlerts:0,
    manualReview:   0,
    followUps:      0,
    byCategory:     {},
    topSenders:     {}
  };

  if (!logSheet) return stats;

  const data = logSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][0];
    if (!(rowDate instanceof Date)) continue;
    if (rowDate < yesterday || rowDate > dayEnd) continue;

    stats.total++;
    const category  = data[i][4]  || 'Unknown';
    const draft     = data[i][8]  || '';
    const status    = data[i][9]  || '';
    const followUp  = data[i][10] || '';
    const sentiment = data[i][6]  || '';
    const from      = data[i][1]  || '';

    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    if (draft   === 'Yes ✓')          stats.draftsCreated++;
    if (status.includes('Manual'))    stats.manualReview++;
    if (followUp === 'Yes')           stats.followUps++;
    if (sentiment === 'negative')     stats.sentimentAlerts++;

    // Track top senders (domain level)
    const domain = from.match(/@([\w.-]+)/)?.[1] || from;
    stats.topSenders[domain] = (stats.topSenders[domain] || 0) + 1;
  }

  // Also check Gmail labels for urgent/VIP from yesterday
  try {
    const urgentThreads = GmailApp.search(`label:${CONFIG.labels.urgent} after:${Utilities.formatDate(yesterday, Session.getScriptTimeZone(), 'yyyy/MM/dd')}`);
    stats.urgent = urgentThreads.length;
    const vipThreads = GmailApp.search(`label:${CONFIG.labels.vip} after:${Utilities.formatDate(yesterday, Session.getScriptTimeZone(), 'yyyy/MM/dd')}`);
    stats.vip = vipThreads.length;
  } catch (e) {
    Logger.log('Could not fetch urgent/VIP counts: ' + e.message);
  }

  return stats;
}


// ── Build HTML digest email ───────────────────────────────────────────────
function buildDigestHtml(stats) {
  const dateStr    = Utilities.formatDate(stats.date, Session.getScriptTimeZone(), 'EEEE d MMMM');
  const draftRate  = stats.total > 0 ? Math.round((stats.draftsCreated / stats.total) * 100) : 0;
  const timeSaved  = stats.draftsCreated * 3;

  const categoryRows = Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) =>
      `<tr><td style="padding:4px 12px;">${cat}</td><td style="padding:4px 12px;text-align:center;">${count}</td></tr>`
    ).join('');

  const alertSection = (stats.urgent > 0 || stats.vip > 0 || stats.sentimentAlerts > 0) ? `
    <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;margin:16px 0;border-radius:4px;">
      <strong>⚠️ Needs Attention</strong><br>
      ${stats.urgent         > 0 ? `🚨 ${stats.urgent} urgent email(s)<br>`                   : ''}
      ${stats.vip            > 0 ? `⭐ ${stats.vip} VIP sender(s)<br>`                         : ''}
      ${stats.sentimentAlerts > 0 ? `😤 ${stats.sentimentAlerts} unhappy member email(s)<br>` : ''}
    </div>` : '';

  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">

  <div style="background:#1a73e8;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:white;margin:0;">📬 Daily Inbox Summary</h2>
    <p style="color:#c8d8f8;margin:4px 0 0;">${dateStr} — ${CONFIG.spaceName || 'Coworking Space'}</p>
  </div>

  <div style="background:#f8f9fa;padding:20px 24px;">

    ${alertSection}

    <div style="display:flex;gap:12px;margin-bottom:16px;">
      ${statCard('📧', stats.total,         'Emails received')}
      ${statCard('📝', stats.draftsCreated, `Drafts created (${draftRate}%)`)}
      ${statCard('⏱️', timeSaved + ' min',  'Time saved')}
      ${statCard('👀', stats.manualReview,  'Need manual reply')}
    </div>

    ${stats.followUps > 0 ? `<p style="color:#555;">🔄 <strong>${stats.followUps}</strong> follow-up thread(s) detected and re-drafted automatically.</p>` : ''}

    <h3 style="border-bottom:1px solid #ddd;padding-bottom:6px;">By Category</h3>
    <table style="width:100%;border-collapse:collapse;background:white;border-radius:6px;overflow:hidden;">
      <thead><tr style="background:#e8f0fe;">
        <th style="padding:8px 12px;text-align:left;">Category</th>
        <th style="padding:8px 12px;text-align:center;">Count</th>
      </tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>

    <p style="color:#888;font-size:12px;margin-top:24px;">
      Sent by ${CONFIG.spaceName || 'Email Triage System'} •
      <a href="https://docs.google.com/spreadsheets" style="color:#1a73e8;">View Email Log</a>
    </p>
  </div>

</body>
</html>`;
}

function statCard(icon, value, label) {
  return `<div style="background:white;border-radius:8px;padding:14px 16px;flex:1;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="font-size:22px;">${icon}</div>
    <div style="font-size:24px;font-weight:bold;color:#1a73e8;">${value}</div>
    <div style="font-size:11px;color:#888;">${label}</div>
  </div>`;
}


// ── Plain text fallback ───────────────────────────────────────────────────
function buildDigestPlain(stats) {
  const dateStr   = Utilities.formatDate(stats.date, Session.getScriptTimeZone(), 'EEEE d MMMM yyyy');
  const draftRate = stats.total > 0 ? Math.round((stats.draftsCreated / stats.total) * 100) : 0;

  const categoryLines = Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `  - ${cat}: ${count}`)
    .join('\n');

  return (
    `Daily Inbox Summary — ${dateStr}\n` +
    `${'='.repeat(40)}\n\n` +
    `Total emails:    ${stats.total}\n` +
    `Drafts created:  ${stats.draftsCreated} (${draftRate}%)\n` +
    `Time saved:      ~${stats.draftsCreated * 3} minutes\n` +
    `Manual review:   ${stats.manualReview}\n` +
    `Follow-ups:      ${stats.followUps}\n` +
    `\nAlerts:\n` +
    (stats.urgent          > 0 ? `  🚨 ${stats.urgent} urgent\n`                   : '') +
    (stats.vip             > 0 ? `  ⭐ ${stats.vip} VIP\n`                         : '') +
    (stats.sentimentAlerts > 0 ? `  😤 ${stats.sentimentAlerts} unhappy member\n`  : '') +
    `\nBy category:\n${categoryLines}\n`
  );
}


// ── Schedule trigger ──────────────────────────────────────────────────────
function scheduleDailyDigest() {
  // Remove any existing digest triggers to avoid duplicates
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendDailyDigest')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Schedule for 8:00 AM every day
  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log('Daily digest scheduled for 8:00 AM every day');

  try {
    SpreadsheetApp.getUi().alert(
      'Digest Scheduled!\n\n' +
      'You\'ll receive a summary email every morning at 8:00 AM.\n\n' +
      'To send one right now: Email Triage > Send Daily Digest Now'
    );
  } catch (e) {}
}
