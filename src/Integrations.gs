// ============================================
// PLATFORM INTEGRATIONS
// ============================================
// Syncs member and room availability data from your coworking
// management platform into the Members and Availability sheets.
//
// Supported platforms:
//   Nexudus   — nexudus.com       (most widely used globally)
//   Cobot     — cobot.me          (popular in Europe, simple API)
//   OfficeR&D — officernd.com     (enterprise-focused)
//
// HOW IT WORKS:
// Rather than calling the platform API on every email (slow, rate-limited),
// the system syncs to local Google Sheets on a schedule (daily by default).
// Email processing then reads from the sheet — fast and offline-safe.
//
// The sheet becomes a live local cache of your platform data.
// ============================================


// ── Entry point ───────────────────────────────────────────────────────────
// Called from the menu ("Sync from Platform API") or on a daily schedule.

function syncFromPlatform() {
  const platform = INTEGRATION_CONFIG.platform;
  Logger.log(`Starting sync for platform: ${platform}`);

  try {
    switch (platform) {
      case 'nexudus':   syncNexudus();   break;
      case 'cobot':     syncCobot();     break;
      case 'officernd': syncOfficeRnD(); break;
      case 'manual':
        try {
          SpreadsheetApp.getUi().alert(
            'Platform set to "manual"\n\n' +
            'No API sync needed — edit the Members and Availability\n' +
            'sheets directly, or change CONFIG.platform in Config.gs\n' +
            'to connect to Nexudus, Cobot, or OfficeR&D.'
          );
        } catch (e) {}
        return;
      default:
        Logger.log(`Unknown platform: ${platform}`);
        return;
    }

    Logger.log(`Sync complete for: ${platform}`);
    try {
      SpreadsheetApp.getUi().alert(`Sync complete!\n\nMembers and availability data updated from ${platform}.`);
    } catch (e) {}

  } catch (e) {
    Logger.log(`Sync failed: ${e.message}`);
    notifyError('syncFromPlatform', e.message);
    try {
      SpreadsheetApp.getUi().alert(`Sync failed:\n\n${e.message}\n\nCheck View > Logs for details.`);
    } catch (e2) {}
  }
}

// Schedule daily sync at 6am (before the 8am digest)
function schedulePlatformSync() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncFromPlatform')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncFromPlatform')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  Logger.log('Platform sync scheduled daily at 6am');
}


// ============================================
// NEXUDUS
// ============================================
// API docs: https://developers.nexudus.com
// Auth: HTTP Basic (username + password)
// Base URL: https://spaces.nexudus.com/api
//
// Free plan includes API access. Rate limit: 100 req/min.
// ============================================

function syncNexudus() {
  const cfg = INTEGRATION_CONFIG.nexudus;

  if (!cfg.username || !cfg.password) {
    throw new Error('Nexudus credentials not set in INTEGRATION_CONFIG.nexudus');
  }

  const authHeader = 'Basic ' + Utilities.base64Encode(cfg.username + ':' + cfg.password);
  const baseUrl    = 'https://spaces.nexudus.com/api';

  // ── Members ────────────────────────────────────────────────────────────
  // Fetch active coworkers (members)
  // Endpoint returns paginated results — we fetch page 1, sufficient for most spaces
  const membersResponse = nexudusGet(`${baseUrl}/spaces/coworkers?size=200&page=1`, authHeader);
  const coworkers       = membersResponse.Records || [];

  const members = coworkers.map(c => ({
    name:      `${c.FullName || ''}`.trim(),
    email:     c.Email || '',
    plan:      c.TariffName || '',
    startDate: c.CreatedDate ? formatNexudusDate(c.CreatedDate) : '',
    status:    c.Active ? 'Active' : 'Inactive',
    desk:      c.DeskName || '',
    company:   c.CompanyName || '',
    notes:     c.Notes || ''
  })).filter(m => m.email);

  writeMembersToSheet(members);

  // ── Room bookings ──────────────────────────────────────────────────────
  // Fetch bookings for the next 14 days
  const today    = new Date();
  const twoWeeks = new Date(today); twoWeeks.setDate(today.getDate() + 14);
  const fromStr  = Utilities.formatDate(today,    Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const toStr    = Utilities.formatDate(twoWeeks, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const bookingsResponse = nexudusGet(
    `${baseUrl}/spaces/bookings?fromDate=${fromStr}&toDate=${toStr}&size=500`,
    authHeader
  );
  const bookings = bookingsResponse.Records || [];

  // Also fetch resources (rooms) so we have names and capacities
  const resourcesResponse = nexudusGet(`${baseUrl}/spaces/resources?size=100`, authHeader);
  const resourceMap       = {};
  (resourcesResponse.Records || []).forEach(r => { resourceMap[r.Id] = r; });

  const slots = buildNexudusSlots(bookings, resourceMap, fromStr, toStr);
  writeAvailabilityToSheet(slots);

  Logger.log(`Nexudus sync: ${members.length} members, ${slots.length} availability slots`);
}

function nexudusGet(url, authHeader) {
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Nexudus API error ${response.getResponseCode()}: ${response.getContentText().substring(0, 200)}`);
  }

  return JSON.parse(response.getContentText());
}

function formatNexudusDate(dateStr) {
  // Nexudus returns ISO 8601: "2023-04-15T00:00:00"
  try {
    const d = new Date(dateStr);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  } catch (e) { return dateStr; }
}

function buildNexudusSlots(bookings, resourceMap, fromStr, toStr) {
  // Build a set of all room+date+slot combinations, mark which are booked
  const slots    = [];
  const bookedSet = new Set();

  bookings.forEach(b => {
    const room  = resourceMap[b.ResourceId];
    const start = new Date(b.FromTime);
    const end   = new Date(b.ToTime);
    const dateStr = Utilities.formatDate(start, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const slotStr = `${formatHour(start)} - ${formatHour(end)}`;
    bookedSet.add(`${b.ResourceId}|${dateStr}|${slotStr}`);

    slots.push({
      room:     room ? room.Name : `Room ${b.ResourceId}`,
      date:     dateStr,
      slot:     slotStr,
      status:   'Booked',
      capacity: room ? (room.Capacity || '') : '',
      notes:    b.Description || ''
    });
  });

  return slots;
}

function formatHour(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm');
}


// ============================================
// COBOT
// ============================================
// API docs: https://www.cobot.me/api-docs
// Auth: OAuth Bearer token (generated from your Cobot admin panel)
// Base URL: https://[subdomain].cobot.me/api
//
// Free plan includes API. No rate limit documented but be reasonable.
// ============================================

function syncCobot() {
  const cfg = INTEGRATION_CONFIG.cobot;

  if (!cfg.accessToken || !cfg.subdomain) {
    throw new Error('Cobot credentials not set in INTEGRATION_CONFIG.cobot');
  }

  const baseUrl     = `https://${cfg.subdomain}.cobot.me/api`;
  const authHeader  = `Bearer ${cfg.accessToken}`;

  // ── Members ────────────────────────────────────────────────────────────
  // Cobot calls members "memberships"
  const membershipsRaw = cobotGet(`${baseUrl}/memberships`, authHeader);

  const members = membershipsRaw.map(m => ({
    name:      m.name        || '',
    email:     m.user ? (m.user.email || '') : '',
    plan:      m.plan ? (m.plan.name  || '') : '',
    startDate: m.starts_at   ? formatCobotDate(m.starts_at) : '',
    status:    m.state === 'active' ? 'Active' : 'Inactive',
    desk:      m.address     || '',
    company:   m.company     || '',
    notes:     m.comments    || ''
  })).filter(m => m.email);

  writeMembersToSheet(members);

  // ── Bookings ───────────────────────────────────────────────────────────
  const today    = new Date();
  const twoWeeks = new Date(today); twoWeeks.setDate(today.getDate() + 14);
  const fromStr  = Utilities.formatDate(today,    Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const toStr    = Utilities.formatDate(twoWeeks, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const bookings = cobotGet(`${baseUrl}/bookings?from=${fromStr}&to=${toStr}`, authHeader);
  const resources = cobotGet(`${baseUrl}/resources`, authHeader);

  const resourceMap = {};
  resources.forEach(r => { resourceMap[r.id] = r; });

  const slots = bookings.map(b => {
    const resource = resourceMap[b.resource_id] || {};
    const start    = new Date(b.from);
    const end      = new Date(b.to);
    return {
      room:     resource.name || `Room ${b.resource_id}`,
      date:     Utilities.formatDate(start, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      slot:     `${formatHour(start)} - ${formatHour(end)}`,
      status:   'Booked',
      capacity: resource.capacity || '',
      notes:    b.comments || ''
    };
  });

  writeAvailabilityToSheet(slots);

  Logger.log(`Cobot sync: ${members.length} members, ${slots.length} bookings`);
}

function cobotGet(url, authHeader) {
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Cobot API error ${response.getResponseCode()}: ${response.getContentText().substring(0, 200)}`);
  }

  return JSON.parse(response.getContentText());
}

function formatCobotDate(dateStr) {
  try {
    return Utilities.formatDate(new Date(dateStr), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  } catch (e) { return dateStr; }
}


// ============================================
// OFFICERND
// ============================================
// API docs: https://developer.officernd.com
// Auth: OAuth 2.0 client credentials flow
// Base URL: https://app.officernd.com/api/v1/organizations/[orgSlug]
//
// Requires a paid plan. Rate limit: 300 req/min.
// ============================================

function syncOfficeRnD() {
  const cfg = INTEGRATION_CONFIG.officernd;

  if (!cfg.clientId || !cfg.clientSecret || !cfg.orgSlug) {
    throw new Error('OfficeR&D credentials not set in INTEGRATION_CONFIG.officernd');
  }

  // Step 1: Get OAuth token via client credentials
  const token   = getOfficeRnDToken(cfg);
  const baseUrl = `https://app.officernd.com/api/v1/organizations/${cfg.orgSlug}`;
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // ── Members ────────────────────────────────────────────────────────────
  const membersRaw = officeRnDGet(`${baseUrl}/members?status=active`, headers);

  const members = membersRaw.map(m => ({
    name:      m.name        || '',
    email:     m.email       || '',
    plan:      m.planName    || '',
    startDate: m.startDate   ? formatOfficeRnDDate(m.startDate) : '',
    status:    m.status      === 'active' ? 'Active' : 'Inactive',
    desk:      m.officeName  || '',
    company:   m.companyName || '',
    notes:     m.description || ''
  })).filter(m => m.email);

  writeMembersToSheet(members);

  // ── Bookings ───────────────────────────────────────────────────────────
  const today    = new Date();
  const twoWeeks = new Date(today); twoWeeks.setDate(today.getDate() + 14);
  const fromStr  = today.toISOString();
  const toStr    = twoWeeks.toISOString();

  const bookings  = officeRnDGet(`${baseUrl}/bookings?startDate=${fromStr}&endDate=${toStr}`, headers);
  const resources = officeRnDGet(`${baseUrl}/resources`, headers);

  const resourceMap = {};
  resources.forEach(r => { resourceMap[r._id] = r; });

  const slots = bookings.map(b => {
    const resource = resourceMap[b.resourceId] || {};
    const start    = new Date(b.start);
    const end      = new Date(b.end);
    return {
      room:     resource.name || `Room ${b.resourceId}`,
      date:     Utilities.formatDate(start, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      slot:     `${formatHour(start)} - ${formatHour(end)}`,
      status:   'Booked',
      capacity: resource.capacity || '',
      notes:    b.summary || ''
    };
  });

  writeAvailabilityToSheet(slots);

  Logger.log(`OfficeR&D sync: ${members.length} members, ${slots.length} bookings`);
}

function getOfficeRnDToken(cfg) {
  const response = UrlFetchApp.fetch('https://identity.officernd.com/oauth/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type:    'client_credentials',
      client_id:     cfg.clientId,
      client_secret: cfg.clientSecret,
      scope:         'officernd.api.read'
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`OfficeR&D auth failed: ${response.getContentText().substring(0, 200)}`);
  }

  return JSON.parse(response.getContentText()).access_token;
}

function officeRnDGet(url, headers) {
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`OfficeR&D API error ${response.getResponseCode()}: ${response.getContentText().substring(0, 200)}`);
  }

  return JSON.parse(response.getContentText());
}

function formatOfficeRnDDate(dateStr) {
  try {
    return Utilities.formatDate(new Date(dateStr), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  } catch (e) { return dateStr; }
}


// ============================================
// SHARED SHEET WRITERS
// ============================================
// Both Members and Availability sheets have a consistent format
// so getMemberByEmail() and getAvailabilitySummary() in other files
// work regardless of which platform the data came from.

function writeMembersToSheet(members) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(CONFIG.membersSheet);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.membersSheet);
  } else {
    sheet.clearContents();
  }

  const headers = ['Full Name', 'Email', 'Plan', 'Start Date', 'Status', 'Desk', 'Company', 'Notes'];
  sheet.appendRow(headers);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');

  if (members.length > 0) {
    const rows = members.map(m => [
      m.name, m.email, m.plan, m.startDate,
      m.status, m.desk, m.company, m.notes
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

    // Conditional formatting on Status column
    const statusRange = sheet.getRange(2, 5, rows.length, 1);
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Active')
        .setBackground('#c6efce').setFontColor('#276221').setRanges([statusRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Inactive')
        .setBackground('#ffc7ce').setFontColor('#9c0006').setRanges([statusRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Cancelled')
        .setBackground('#ffc7ce').setFontColor('#9c0006').setRanges([statusRange]).build()
    ]);
  }

  sheet.setFrozenRows(1);
  Logger.log(`Members sheet updated: ${members.length} records`);
}

function writeAvailabilityToSheet(bookedSlots) {
  // The availability sheet shows booked slots from the platform.
  // Anything NOT in this list is considered available.
  // This is simpler than trying to enumerate every possible free slot.

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(CONFIG.availabilitySheet);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.availabilitySheet);
  } else {
    sheet.clearContents();
  }

  const headers = ['Room', 'Date', 'Time Slot', 'Status', 'Capacity', 'Notes'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');

  if (bookedSlots.length > 0) {
    const rows = bookedSlots.map(s => [
      s.room, s.date, s.slot, s.status, s.capacity, s.notes
    ]);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

    const statusRange = sheet.getRange(2, 4, rows.length, 1);
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Booked')
        .setBackground('#ffc7ce').setFontColor('#9c0006').setRanges([statusRange]).build()
    ]);
  }

  // Add a note explaining what "not listed = available" means
  sheet.getRange(bookedSlots.length + 3, 1).setValue(
    'Note: Only booked slots are listed. Unlisted slots are available.'
  ).setFontStyle('italic').setFontColor('#888888');

  sheet.setFrozenRows(1);
  Logger.log(`Availability sheet updated: ${bookedSlots.length} booked slots`);
}
