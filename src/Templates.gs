// ============================================
// DRAFT REPLY TEMPLATES
// ============================================
// Gemini reads the actual email and writes a specific reply
// in the tone shown in REPLY_STYLE_GUIDES.
// Booking drafts include real availability from the sheet.
// ============================================

function generateDraftReply(message, analysis, isFollowUp) {
  const category    = analysis.categoryName;
  const senderEmail = message.getFrom();
  const senderName  = extractName(senderEmail);
  const subject     = message.getSubject();
  const body        = message.getPlainBody().substring(0, 1500);
  const language    = analysis.language || 'en';

  if (category === 'COMPLAINT') return null;

  const member = getMemberByEmail(senderEmail);

  try {
    const draft = generateAIDraft(category, language, senderName, subject, body, isFollowUp, member);
    Logger.log(`Draft generated via AI for: ${subject}`);
    return draft;
  } catch (e) {
    Logger.log(`AI draft failed (using fallback): ${e.message} | subject: ${subject}`);
    return generateFallbackReply(category, senderName);
  }
}



// ============================================
// AI DRAFT GENERATION
// ============================================

function generateAIDraft(category, language, senderName, subject, body, isFollowUp, member) {
  if (!AI_CONFIG.enabled || !AI_CONFIG.geminiApiKey || AI_CONFIG.geminiApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return generateFallbackReply(category, senderName);
  }

  const styleGuide = REPLY_STYLE_GUIDES[category] || REPLY_STYLE_GUIDES['GENERIC'];
  const signOff    = buildSignOff();

  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEEE d MMMM yyyy');

  // ── FEATURE 3: Availability injection for booking emails ──────────────────
  let availabilityContext = '';
  if (category === 'BOOKING') {
    const availability = getAvailabilitySummary();
    if (availability) {
      availabilityContext = `\nCURRENT ROOM AVAILABILITY (reference specific slots — do not guess or invent times):\n${availability}\n`;
    } else {
      availabilityContext = `\nNO LIVE AVAILABILITY DATA: Acknowledge the specific date, time, and group size they mentioned. Tell them you will check and confirm — do not make up availability.\n`;
    }
  }

  // ── Member context — only injected when member is found in the sheet ──────
  let memberContext = '';
  if (member) {
    memberContext =
      `\nMEMBER CONTEXT (use to personalise naturally — don't quote verbatim):\n` +
      `- Name: ${member.name} | Plan: ${member.plan} | Member for: ${member.tenure}\n` +
      (member.notes ? `- Note: ${member.notes}\n` : '');
  }

  const followUpInstruction = isFollowUp
    ? '\nThis is a FOLLOW-UP to a previous thread. Acknowledge it and continue naturally.\n'
    : '';

  const prompt =
    `You are a friendly community manager at a coworking space. Today is ${todayStr}.\n` +
    `Write a reply to the email below.\n` +
    `\nRULES:\n` +
    `- Write ONLY the email body, no subject line\n` +
    `- Sound like a real person — warm, direct, conversational, not corporate\n` +
    `- Use the sender's first name once near the start\n` +
    `- Mirror back the specific details from their email (dates, times, room size, issue described)\n` +
    `- Keep it short (3-5 sentences max)\n` +
    `- Never use em dashes (—) between thoughts\n` +
    `- Never open with "I hope this email finds you well", "Great to hear from you", or "Thank you for reaching out"\n` +
    `- Never close with "do not hesitate to contact us" or "please feel free to"\n` +
    `- Detect the language of the email and reply in the SAME language\n` +
    `- End with one clear next step or friendly question\n` +
    followUpInstruction +
    memberContext +
    availabilityContext +
    `- Sign off with exactly this (do not translate it):\n${signOff}\n` +
    `\nTONE EXAMPLE:\n${styleGuide}\n` +
    `\nEMAIL TO REPLY TO:\nSubject: ${subject}\nFrom: ${senderName}\nBody: ${body}\n` +
    `\nWrite the reply now:`;

  const url     = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.geminiApiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.85, maxOutputTokens: 300 }
  };
  const options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };

  const response = UrlFetchApp.fetch(url, options);
  const result   = JSON.parse(response.getContentText());
  if (!result.candidates || !result.candidates[0]) {
    const apiError = result.error ? `${result.error.status}: ${result.error.message}` : response.getContentText().substring(0, 300);
    throw new Error(apiError);
  }
  return result.candidates[0].content.parts[0].text.trim();
}


// ── FEATURE 3: Read availability from sheet ────────────────────────────────
function getAvailabilitySummary() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.availabilitySheet);
    if (!sheet) return null;

    const data  = sheet.getDataRange().getValues();
    if (data.length < 2) return null;

    // Format: Room Name | Date | Time Slot | Status
    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const fmtDate  = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');

    const relevantRows = data.slice(1).filter(row => {
      const rowDate = row[1] instanceof Date ? fmtDate(row[1]) : row[1];
      return rowDate === fmtDate(today) || rowDate === fmtDate(tomorrow);
    });

    if (relevantRows.length === 0) return null;

    return relevantRows.map(row => {
      const room   = row[0];
      const date   = row[1] instanceof Date ? fmtDate(row[1]) : row[1];
      const slot   = row[2];
      const status = row[3];
      return `- ${room}: ${date} ${slot} — ${status}`;
    }).join('\n');

  } catch (e) {
    Logger.log('Could not read availability: ' + e.message);
    return null;
  }
}


// ============================================
// SIGN-OFF BUILDER
// ============================================

function buildSignOff() {
  const name    = CONFIG.spaceName    || 'The Team';
  const phone   = CONFIG.spacePhone   ? '\nPhone: '  + CONFIG.spacePhone   : '';
  const email   = CONFIG.spaceEmail   ? '\nEmail: '  + CONFIG.spaceEmail   : '';
  const website = CONFIG.spaceWebsite ? '\n'         + CONFIG.spaceWebsite : '';
  return 'Cheers,\n' + name + phone + email + website;
}


// ============================================
// STYLE GUIDES
// ============================================

const REPLY_STYLE_GUIDES = {
  BILLING:
    'Hi [Name], thanks for flagging this! I\'ve pulled up your account and I\'m looking into the ' +
    'charge now. I\'ll have a clear answer for you by tomorrow, but if you need it sooner just ' +
    'give us a shout. Does that work for you?',

  BOOKING:
    'Hi [Name], great timing! I\'ve checked and the large room is free tomorrow 2-4pm — I\'ll ' +
    'pencil you in now and send a confirmation shortly. Do you need any AV setup for the session?',

  INFO_REQUEST:
    'Hi [Name], happy to help! [Specific answer to their question]. If it\'d be easier to just ' +
    'come see the space, we do quick tours most days. Would that be useful?',

  MEMBERSHIP:
    'Hi [Name], excited you\'re considering joining! [Address their specific question]. The easiest ' +
    'next step is usually a quick visit — want me to set something up?',

  GENERIC:
    'Hi [Name], thanks for reaching out! [Address their question directly]. Let me know if you need ' +
    'anything else or want to pop by for a chat.'
};


// ============================================
// FALLBACK TEMPLATES
// ============================================

function generateFallbackReply(category, name) {
  const signOff  = buildSignOff();
  const template = getFallbackTemplate(category, signOff);
  return template.replace('[Name]', name);
}

function getFallbackTemplate(category, signOff) {
  const templates = {
    BILLING:
      'Hi [Name],\n\nThanks for getting in touch about this. I\'m looking into it now and will ' +
      'get back to you within 24 hours. If it\'s urgent, feel free to reach out directly.\n\n' + signOff,

    BOOKING:
      'Hi [Name],\n\nThanks for reaching out! I\'m checking availability now and will confirm ' +
      'your booking shortly. Let us know if you need something sooner.\n\n' + signOff,

    INFO_REQUEST:
      'Hi [Name],\n\nThanks for your question! I\'ll send details your way within 24 hours. Or ' +
      'if you\'d rather come take a look, we\'re happy to arrange a quick tour anytime.\n\n' + signOff,

    MEMBERSHIP:
      'Hi [Name],\n\nThanks for getting in touch about membership! I\'m on it and will be back ' +
      'with details soon.\n\n' + signOff,

    GENERIC:
      'Hi [Name],\n\nThanks for your message! I\'ll get back to you shortly.\n\n' + signOff
  };
  return templates[category] || templates['GENERIC'];
}


// ============================================
// HELPER
// ============================================

function extractName(email) {
  const match = email.match(/^([^<@]+)/);
  if (match) {
    const name = match[1].trim();
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return 'there';
}
