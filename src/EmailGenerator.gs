// ============================================
// SAFE TEST EMAIL GENERATION
// ============================================
// Test emails are English-only by default so the system works
// out of the box for any coworking space globally.
// To test other languages, simply add entries to TEST_EMAILS
// in your own language — the AI will detect and reply accordingly.
// ============================================

const TEST_EMAILS = [

  // ── BILLING (3) ────────────────────────────────────────────────────────────
  {
    subject: 'Question about my invoice',
    body: 'Hi, I received invoice #2026-456 but I already paid last week via bank transfer. Could you please check the payment status? Thanks!',
    from: 'john.smith@example.com',
    language: 'en',
    expectedCategory: 'BILLING'
  },
  {
    subject: 'Receipt request',
    body: 'Hello! Could I please get an official receipt for last month\'s membership fee? I need it for my tax records. Thank you!',
    from: 'sarah.jones@example.com',
    language: 'en',
    expectedCategory: 'BILLING'
  },
  {
    subject: 'Payment issue',
    body: 'Hi, my credit card payment failed yesterday. I\'ve updated my card details. Could you please try charging again or let me know how to resolve this? Thanks!',
    from: 'mike.brown@example.com',
    language: 'en',
    expectedCategory: 'BILLING'
  },

  // ── BOOKING (3) ────────────────────────────────────────────────────────────
  {
    subject: 'Meeting room booking request',
    body: 'Hi, I\'d like to book the large meeting room for tomorrow from 2pm to 4pm. We\'ll have 6 people. Is it available? We\'ll need a screen and whiteboard if possible. Thanks!',
    from: 'emma.wilson@example.com',
    language: 'en',
    expectedCategory: 'BOOKING'
  },
  {
    subject: 'Hot desk reservation',
    body: 'Hello! I need to book a hot desk for next week, Monday through Friday. Do you have availability? I\'d prefer a quieter area if possible. Best regards!',
    from: 'david.miller@example.com',
    language: 'en',
    expectedCategory: 'BOOKING'
  },
  {
    subject: 'Change my booking',
    body: 'Hi, I need to change my meeting room booking from 10am-12pm to 3pm-5pm tomorrow. Is that possible? If not, can I cancel with a full refund? Thanks!',
    from: 'lisa.taylor@example.com',
    language: 'en',
    expectedCategory: 'BOOKING'
  },

  // ── COMPLAINT (3) ──────────────────────────────────────────────────────────
  {
    subject: 'WiFi keeps dropping',
    body: 'Hi, the WiFi has been unreliable for the past 3 days. It keeps disconnecting every 20-30 minutes which is making it impossible to work. This really needs to be fixed urgently.',
    from: 'chris.martin@example.com',
    language: 'en',
    expectedCategory: 'COMPLAINT'
  },
  {
    subject: 'Noise issue in open area',
    body: 'Hello, the noise levels in the open workspace have been really disruptive lately. There seem to be phone calls happening constantly without people using the phone booths. Can you address this?',
    from: 'rachel.thomas@example.com',
    language: 'en',
    expectedCategory: 'COMPLAINT'
  },
  {
    subject: 'Air conditioning not working',
    body: 'Hi, the air conditioning on the 3rd floor has been broken since Monday. It\'s really uncomfortable to work here. When will this be fixed?',
    from: 'alex.anderson@example.com',
    language: 'en',
    expectedCategory: 'COMPLAINT'
  },

  // ── INFO REQUEST (3) ───────────────────────────────────────────────────────
  // NOTE: Subject now clearly says "pricing" not "membership pricing" to avoid
  // the Booking misclassification seen in testing. The body also explicitly
  // frames it as a general question rather than an intent to join.
  {
    subject: 'Pricing and space options',
    body: 'Hi, I\'m researching different coworking spaces and would love to know what plans and prices you offer. I\'m a freelancer who would need a desk around 3-4 days a week. Could you send me some info? Thanks!',
    from: 'nina.scott@example.com',
    language: 'en',
    expectedCategory: 'INFO_REQUEST'
  },
  {
    subject: 'Opening hours query',
    body: 'Hello! What are your opening hours? Are you open on weekends and public holidays? I sometimes work odd hours and need to know if the space is 24/7 accessible. Best regards!',
    from: 'tom.harris@example.com',
    language: 'en',
    expectedCategory: 'INFO_REQUEST'
  },
  {
    subject: 'Tour of the space',
    body: 'Hi, I\'d love to come see the space before signing up. Is it possible to arrange a quick tour this week? I\'m free most afternoons. Thanks!',
    from: 'julia.white@example.com',
    language: 'en',
    expectedCategory: 'INFO_REQUEST'
  },

  // ── MEMBERSHIP (3) ─────────────────────────────────────────────────────────
  {
    subject: 'Ready to sign up — what\'s the process?',
    body: 'Hello! I\'ve decided I\'d like to become a member. Could you let me know what the sign-up process is, what\'s included, and how soon I can start? Looking to join as soon as possible.',
    from: 'ben.clark@example.com',
    language: 'en',
    expectedCategory: 'MEMBERSHIP'
  },
  {
    subject: 'Upgrade my membership plan',
    body: 'Hi, I\'m currently on the hot desk plan but I\'d like to upgrade to a dedicated desk. What\'s the price difference and how do I make the switch? Thanks!',
    from: 'anna.lewis@example.com',
    language: 'en',
    expectedCategory: 'MEMBERSHIP'
  },
  {
    subject: 'Cancel membership',
    body: 'Hi, unfortunately I need to cancel my membership at the end of this month. Could you let me know the cancellation process and whether there\'s a notice period? Thank you.',
    from: 'james.walker@example.com',
    language: 'en',
    expectedCategory: 'MEMBERSHIP'
  },

  // ── URGENT (2) ─────────────────────────────────────────────────────────────
  // These test the urgent flag — system should apply 🚨 Urgent label,
  // star the thread, and mark it important.
  {
    subject: 'URGENT: Locked out of the building',
    body: 'Hi, I\'m standing outside the building right now and my access card isn\'t working. I have a client presentation in 20 minutes. Please help urgently!',
    from: 'oliver.reed@example.com',
    language: 'en',
    expectedCategory: 'COMPLAINT',
    expectedUrgent: true
  },
  {
    subject: 'Critical billing error — need immediate help',
    body: 'Hi, I\'ve just been charged three times for this month\'s membership. This is a serious error and I need it resolved immediately. My account cannot sustain these charges. Please contact me urgently.',
    from: 'sophie.hall@example.com',
    language: 'en',
    expectedCategory: 'BILLING',
    expectedUrgent: true
  },

  // ── VIP (2) ────────────────────────────────────────────────────────────────
  // These test VIP detection — sender domains match CONFIG.vipSenders.
  // System should apply ⭐ VIP label and mark the thread important.
  // To activate: add 'boss@company.com' and 'important@client.com'
  // to CONFIG.vipSenders in Config.gs (they're already there as examples).
  {
    subject: 'Quick question about your enterprise plans',
    body: 'Hi, we\'re a team of 15 and looking for a coworking space for the whole group. Do you have enterprise or team membership options? We\'d love to discuss further.',
    from: 'boss@company.com',
    language: 'en',
    expectedCategory: 'MEMBERSHIP',
    expectedVip: true
  },
  {
    subject: 'Meeting room for our quarterly review',
    body: 'Hello, we\'d like to book your largest meeting room for a full-day quarterly review next month. We\'ll need catering and AV setup. Can you send availability and pricing?',
    from: 'important@client.com',
    language: 'en',
    expectedCategory: 'BOOKING',
    expectedVip: true
  }

];


// ============================================
// SAFE TEST FUNCTIONS
// ============================================

function sendSingleTestEmail() {
  const targetEmail = getSecret('INBOX_ADDRESS');

  if (!targetEmail) {
    SpreadsheetApp.getUi().alert(
      'Email Not Configured',
      'Please set your inbox address via:\nEmail Triage > 🔑 Configure API Keys',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const testEmail = TEST_EMAILS[0];

  const ui     = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Send Single Test Email',
    `Send 1 test email to:\n${targetEmail}\n\nEmail: ${testEmail.subject}\nCategory: ${testEmail.expectedCategory}\n\nContinue?`,
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) return;

  try {
    const htmlBody = `<div style="font-family: Arial, sans-serif; charset=UTF-8;">
<p><strong>[Test Email]</strong><br>
<em>[From: ${testEmail.from}]</em></p>
<p>${testEmail.body.replace(/\n/g, '<br>')}</p>
</div>`;

    GmailApp.sendEmail(targetEmail, testEmail.subject, testEmail.body, { htmlBody });
    Logger.log('Test email sent successfully');

    ui.alert(
      'Test Email Sent!',
      `Email sent to: ${targetEmail}\n\nWait 1 minute, then run:\nEmail Triage > Process Emails`,
      ui.ButtonSet.OK
    );

  } catch (e) {
    Logger.log(`Failed: ${e.message}`);
    ui.alert('Error', `Failed to send email: ${e.message}`, ui.ButtonSet.OK);
  }
}

function generateSafeTestEmails() {
  const targetEmail = getSecret('INBOX_ADDRESS');

  if (!targetEmail) {
    SpreadsheetApp.getUi().alert(
      'Email Not Configured',
      'Please set your inbox address via:\nEmail Triage > 🔑 Configure API Keys',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  // One per category + urgent + VIP = 8 emails covering all system features
  const safeTestSet = [
    TEST_EMAILS[0],   // Billing
    TEST_EMAILS[3],   // Booking
    TEST_EMAILS[6],   // Complaint (no draft — tests that path)
    TEST_EMAILS[9],   // Info Request
    TEST_EMAILS[12],  // Membership
    TEST_EMAILS[15],  // Urgent complaint
    TEST_EMAILS[17],  // VIP sender (boss@company.com)
    TEST_EMAILS[18]   // VIP sender (important@client.com)
  ];

  const ui     = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Safe Test Email Generation',
    `This will send ${safeTestSet.length} test emails to:\n${targetEmail}\n\n` +
    `Covers: Billing, Booking, Complaint, Info, Membership, Urgent x2, VIP x2\n` +
    `With 15-second delays between each.\nTotal time: ~2 minutes\n\nContinue?`,
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) return;

  let sent   = 0;
  let failed = 0;

  safeTestSet.forEach((email, index) => {
    try {
      const tags = [
        email.expectedCategory,
        email.expectedUrgent ? 'URGENT' : null,
        email.expectedVip    ? 'VIP'    : null
      ].filter(Boolean).join(' | ');

      const htmlBody = `<div style="font-family: Arial, sans-serif; charset=UTF-8;">
<p><strong>[Test Email - ${tags}]</strong><br>
<em>[From: ${email.from}]</em></p>
<p>${email.body.replace(/\n/g, '<br>')}</p>
</div>`;

      GmailApp.sendEmail(targetEmail, email.subject, email.body, { htmlBody });
      sent++;
      Logger.log(`${index + 1}/${safeTestSet.length}: [${tags}] ${email.subject}`);

      if (index < safeTestSet.length - 1) {
        Logger.log('Waiting 15 seconds...');
        Utilities.sleep(15000);
      }

    } catch (e) {
      failed++;
      Logger.log(`Failed: ${e.message}`);
    }
  });

  Logger.log(`Complete. Sent: ${sent}, Failed: ${failed}`);

  ui.alert(
    'Test Emails Sent!',
    `Successfully sent ${sent} emails to:\n${targetEmail}\n\n` +
    `Wait 2 minutes, then run:\nEmail Triage > Process Emails\n\n` +
    `Then check Gmail for:\n` +
    `- Category labels (Billing, Booking etc.)\n` +
    `- 🚨 Urgent on the two urgent emails\n` +
    `- ⭐ VIP on emails from boss@company.com and important@client.com`,
    ui.ButtonSet.OK
  );
}
