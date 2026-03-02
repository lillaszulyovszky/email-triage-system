// ============================================
// AVAILABILITY SHEET — SETUP & MANAGEMENT
// Feature 3: Room availability context injection
// ============================================
// This file creates and manages the "Room Availability" sheet.
// The system reads today's and tomorrow's slots and injects them
// into booking draft replies so Gemini can give specific answers
// instead of "I'll check and get back to you."
// ============================================

function setupAvailabilitySheet() {
  const ss         = SpreadsheetApp.getActiveSpreadsheet();
  let sheet        = ss.getSheetByName(CONFIG.availabilitySheet);

  if (sheet) {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
      'Sheet Already Exists',
      'The Room Availability sheet already exists. Recreate it with fresh demo data?',
      ui.ButtonSet.YES_NO
    );
    if (result !== ui.Button.YES) return;
    ss.deleteSheet(sheet);
  }

  sheet = ss.insertSheet(CONFIG.availabilitySheet);

  // ── Headers ───────────────────────────────────────────────────────────────
  const headers = ['Room', 'Date', 'Time Slot', 'Status', 'Capacity', 'Notes'];
  sheet.appendRow(headers);

  // Style header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1a73e8')
             .setFontColor('#ffffff')
             .setFontWeight('bold');

  // ── Demo data ─────────────────────────────────────────────────────────────
  // Generates 2 weeks of realistic availability data for demo purposes.
  // Rooms, capacities and time slots are generic — easy to customise.

  const rooms = [
    { name: 'Focus Room (4 pax)',   capacity: 4  },
    { name: 'Board Room (10 pax)',  capacity: 10 },
    { name: 'Workshop Space (20 pax)', capacity: 20 },
    { name: 'Phone Pod 1',          capacity: 1  },
    { name: 'Phone Pod 2',          capacity: 1  }
  ];

  const timeSlots = [
    '08:00 - 10:00',
    '10:00 - 12:00',
    '12:00 - 14:00',
    '14:00 - 16:00',
    '16:00 - 18:00'
  ];

  const statuses  = ['Available', 'Available', 'Available', 'Booked', 'Available']; // weighted toward available
  const today     = new Date();
  const rows      = [];

  for (let d = 0; d < 14; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);

    // Skip weekends for realism
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy');

    rooms.forEach(room => {
      timeSlots.forEach((slot, slotIndex) => {
        // Randomise status slightly — lunch slot more likely booked, mornings more available
        let status;
        if (slotIndex === 2) {
          status = Math.random() > 0.6 ? 'Booked' : 'Available';
        } else if (d === 0 || d === 1) {
          // Today and tomorrow — more realistic mix
          status = Math.random() > 0.55 ? 'Available' : 'Booked';
        } else {
          status = statuses[Math.floor(Math.random() * statuses.length)];
        }

        rows.push([
          room.name,
          dateStr,
          slot,
          status,
          room.capacity,
          status === 'Booked' ? 'Reserved' : ''
        ]);
      });
    });
  }

  // Write all rows in one batch (much faster than appendRow in a loop)
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // ── Conditional formatting: green = Available, red = Booked ──────────────
  const dataRange   = sheet.getRange(2, 4, rows.length, 1); // Status column
  const greenRule   = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Available')
    .setBackground('#c6efce')
    .setFontColor('#276221')
    .setRanges([dataRange])
    .build();
  const redRule     = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Booked')
    .setBackground('#ffc7ce')
    .setFontColor('#9c0006')
    .setRanges([dataRange])
    .build();
  sheet.setConditionalFormatRules([greenRule, redRule]);

  // ── Column widths ─────────────────────────────────────────────────────────
  sheet.setColumnWidth(1, 200); // Room
  sheet.setColumnWidth(2, 110); // Date
  sheet.setColumnWidth(3, 150); // Time Slot
  sheet.setColumnWidth(4, 100); // Status
  sheet.setColumnWidth(5, 90);  // Capacity
  sheet.setColumnWidth(6, 160); // Notes

  sheet.setFrozenRows(1);

  Logger.log(`Availability sheet created with ${rows.length} slots across 2 weeks`);

  try {
    SpreadsheetApp.getUi().alert(
      'Availability Sheet Created!\n\n' +
      `Generated ${rows.length} time slots across 2 weeks.\n\n` +
      'The system will now automatically inject today\'s and tomorrow\'s ' +
      'availability into booking draft replies.\n\n' +
      'You can edit the Status column (Available/Booked) at any time ' +
      'to keep it up to date.'
    );
  } catch (e) {}
}
