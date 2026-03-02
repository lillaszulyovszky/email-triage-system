// ============================================
// MEMBERS SHEET — SETUP & LOOKUP
// ============================================
// Creates and manages the "Members" sheet with demo data.
// Used by the manager summary note in Templates.gs to show
// how long a member has been active, their plan, and any notes.
//
// Lookup is by email address — the system extracts the sender's
// email from each incoming message and searches this sheet.
// ============================================

// ── Sheet setup ───────────────────────────────────────────────────────────

function setupMembersSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(CONFIG.membersSheet);

  if (sheet) {
    const ui     = SpreadsheetApp.getUi();
    const result = ui.alert(
      'Sheet Already Exists',
      'The Members sheet already exists. Recreate it with fresh demo data?',
      ui.ButtonSet.YES_NO
    );
    if (result !== ui.Button.YES) return;
    ss.deleteSheet(sheet);
  }

  sheet = ss.insertSheet(CONFIG.membersSheet);

  // ── Headers ───────────────────────────────────────────────────────────────
  const headers = [
    'Full Name', 'Email', 'Plan', 'Start Date',
    'Status', 'Desk', 'Company', 'Notes'
  ];
  sheet.appendRow(headers);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1a73e8')
             .setFontColor('#ffffff')
             .setFontWeight('bold');

  // ── Demo data ─────────────────────────────────────────────────────────────
  // Realistic mix of tenures, plans, and statuses for demo purposes.
  // Includes some of the same email addresses used in EmailGenerator.gs
  // so that test emails trigger a member lookup.

  const today = new Date();

  function daysAgo(n) {
    const d = new Date(today);
    d.setDate(today.getDate() - n);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  const members = [
    // Long-term members
    ['John Smith',     'john.smith@example.com',     'Dedicated Desk',  daysAgo(730),  'Active',   'Desk 12',  'Smith Consulting',   'Prefers quiet zone'],
    ['Sarah Jones',    'sarah.jones@example.com',    'Private Office',  daysAgo(548),  'Active',   'Office 3', 'Jones & Co',         'Key holder'],
    ['Emma Wilson',    'emma.wilson@example.com',    'Team Plan (5)',    daysAgo(412),  'Active',   'Zone B',   'Wilson Design',      'Books Board Room weekly'],
    ['David Miller',   'david.miller@example.com',   'Hot Desk',        daysAgo(365),  'Active',   'Hot Desk', 'Freelance',          ''],
    ['Lisa Taylor',    'lisa.taylor@example.com',    'Dedicated Desk',  daysAgo(290),  'Active',   'Desk 7',   'Taylor Media',       'Often works late'],

    // Mid-tenure members
    ['Chris Martin',   'chris.martin@example.com',   'Hot Desk',        daysAgo(180),  'Active',   'Hot Desk', 'Freelance Dev',      'Reported WiFi issues before'],
    ['Rachel Thomas',  'rachel.thomas@example.com',  'Dedicated Desk',  daysAgo(155),  'Active',   'Desk 3',   'Thomas PR',          ''],
    ['Alex Anderson',  'alex.anderson@example.com',  'Hot Desk',        daysAgo(120),  'Active',   'Hot Desk', 'Anderson Studio',    ''],
    ['Nina Scott',     'nina.scott@example.com',     'Hot Desk',        daysAgo(95),   'Active',   'Hot Desk', 'Freelance',          'Considering upgrade'],
    ['Tom Harris',     'tom.harris@example.com',     'Dedicated Desk',  daysAgo(88),   'Active',   'Desk 15',  'Harris Tech',        ''],

    // Newer members
    ['Julia White',    'julia.white@example.com',    'Hot Desk',        daysAgo(45),   'Active',   'Hot Desk', 'White Consulting',   'New — on trial month'],
    ['Ben Clark',      'ben.clark@example.com',      'Hot Desk',        daysAgo(30),   'Active',   'Hot Desk', 'Freelance',          'Just joined'],
    ['Anna Lewis',     'anna.lewis@example.com',     'Hot Desk',        daysAgo(14),   'Active',   'Hot Desk', 'Lewis Design',       'Wants to upgrade'],
    ['James Walker',   'james.walker@example.com',   'Dedicated Desk',  daysAgo(60),   'Active',   'Desk 9',   'Walker & Sons',      'Mentioned leaving'],

    // Urgent / VIP test senders
    ['Oliver Reed',    'oliver.reed@example.com',    'Private Office',  daysAgo(500),  'Active',   'Office 1', 'Reed Ventures',      'VIP — handle with priority'],
    ['Sophie Hall',    'sophie.hall@example.com',    'Team Plan (3)',    daysAgo(200),  'Active',   'Zone A',   'Hall Creative',      ''],
    ['Boss Person',    'boss@company.com',            'Enterprise',      daysAgo(900),  'Active',   'Suite A',  'Company Corp',       'Enterprise client — key account'],
    ['Key Client',     'important@client.com',        'Team Plan (10)',  daysAgo(600),  'Active',   'Zone C',   'Client Industries',  'Quarterly review coming up'],

    // Lapsed / cancelled (to show the system handles non-members too)
    ['Mike Brown',     'mike.brown@example.com',     'Hot Desk',        daysAgo(400),  'Cancelled','',         'Brown Media',        'Left — payment dispute'],
    ['Chris Palmer',   'chris.palmer@example.com',   'Dedicated Desk',  daysAgo(700),  'Paused',   'Desk 11',  'Palmer Group',       'On leave until Q3']
  ];

  if (members.length > 0) {
    sheet.getRange(2, 1, members.length, headers.length).setValues(members);
  }

  // ── Conditional formatting: Active = green, Cancelled = red, Paused = amber
  const statusRange = sheet.getRange(2, 5, members.length, 1);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Active')
      .setBackground('#c6efce').setFontColor('#276221')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Cancelled')
      .setBackground('#ffc7ce').setFontColor('#9c0006')
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Paused')
      .setBackground('#ffeb9c').setFontColor('#9c6500')
      .setRanges([statusRange]).build()
  ];
  sheet.setConditionalFormatRules(rules);

  // ── Column widths ─────────────────────────────────────────────────────────
  sheet.setColumnWidth(1, 160); // Full Name
  sheet.setColumnWidth(2, 220); // Email
  sheet.setColumnWidth(3, 160); // Plan
  sheet.setColumnWidth(4, 110); // Start Date
  sheet.setColumnWidth(5, 100); // Status
  sheet.setColumnWidth(6, 90);  // Desk
  sheet.setColumnWidth(7, 160); // Company
  sheet.setColumnWidth(8, 220); // Notes
  sheet.setFrozenRows(1);

  Logger.log(`Members sheet created with ${members.length} records`);

  try {
    SpreadsheetApp.getUi().alert(
      'Members Sheet Created!\n\n' +
      `${members.length} demo members added.\n\n` +
      'The system will now look up member details when processing emails ' +
      'and include tenure, plan and notes in the manager summary note.\n\n' +
      'Add real members by editing this sheet directly — ' +
      'the Email column is used to match incoming emails.'
    );
  } catch (e) {}
}


// ── Member lookup ─────────────────────────────────────────────────────────
// Called from Templates.gs when building the manager note.
// Returns a plain object with member details, or null if not found.

function getMemberByEmail(emailAddress) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.membersSheet);
    if (!sheet) return null;

    // Extract just the email address if it's in "Name <email>" format
    const emailMatch = emailAddress.match(/<([^>]+)>/) || emailAddress.match(/([^\s]+@[^\s]+)/);
    const cleanEmail = emailMatch ? emailMatch[1].toLowerCase() : emailAddress.toLowerCase();

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const rowEmail = (data[i][1] || '').toString().toLowerCase().trim();
      if (rowEmail === cleanEmail) {
        return {
          name:      data[i][0] || '',
          email:     data[i][1] || '',
          plan:      data[i][2] || '',
          startDate: data[i][3] || '',
          status:    data[i][4] || '',
          desk:      data[i][5] || '',
          company:   data[i][6] || '',
          notes:     data[i][7] || '',
          tenure:    calculateTenure(data[i][3])
        };
      }
    }

    return null; // Not found — likely a prospect or new inquiry

  } catch (e) {
    Logger.log('Member lookup failed: ' + e.message);
    return null;
  }
}


// ── Tenure calculation ────────────────────────────────────────────────────
// Converts a start date string (dd/MM/yyyy) into a human-readable tenure.
// e.g. "2 years 3 months" or "45 days"

function calculateTenure(startDateValue) {
  try {
    let startDate;

    if (startDateValue instanceof Date) {
      startDate = startDateValue;
    } else {
      // Parse dd/MM/yyyy
      const parts = startDateValue.toString().split('/');
      if (parts.length !== 3) return 'unknown tenure';
      startDate = new Date(
        parseInt(parts[2]),
        parseInt(parts[1]) - 1,
        parseInt(parts[0])
      );
    }

    const today     = new Date();
    const diffMs    = today - startDate;
    const diffDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0)   return 'not started yet';
    if (diffDays < 7)   return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    if (diffDays < 30)  return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''}`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''}`;
    }

    const years    = Math.floor(diffDays / 365);
    const remMonths = Math.floor((diffDays % 365) / 30);
    return remMonths > 0
      ? `${years} year${years !== 1 ? 's' : ''} ${remMonths} month${remMonths !== 1 ? 's' : ''}`
      : `${years} year${years !== 1 ? 's' : ''}`;

  } catch (e) {
    return 'unknown tenure';
  }
}
