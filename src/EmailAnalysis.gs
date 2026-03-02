// ============================================
// AI-POWERED EMAIL ANALYSIS
// ============================================

function analyzeEmailWithAI(message) {
  if (!AI_CONFIG.enabled || !AI_CONFIG.geminiApiKey || AI_CONFIG.geminiApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    Logger.log('AI not configured, using fallback');
    return analyzeFallback(message);
  }

  try {
    return analyzeWithGemini(message);
  } catch (e) {
    Logger.log(`AI analysis failed: ${e.message}, using fallback`);
    return analyzeFallback(message);
  }
}

function analyzeWithGemini(message) {
  const subject = message.getSubject();
  const body    = message.getPlainBody().substring(0, 2000);
  const from    = message.getFrom();

  const prompt = `You are an email triage assistant for a coworking space.

ANALYZE THIS EMAIL:

Subject: ${subject}
From: ${from}
Body: ${body}

COWORKING SPACE CONTEXT:
- Services: Hot desks, meeting rooms, private offices, memberships
- Common inquiries: Billing, room bookings, membership, general info, complaints

CATEGORIES (choose ONE):
- BILLING:      invoices, payments, receipts, refunds
- BOOKING:      meeting room or desk reservations, scheduling
- COMPLAINT:    problems, issues, dissatisfaction (flag for human review)
- INFO_REQUEST: questions, general information, pricing, tours
- MEMBERSHIP:   joining, canceling, upgrading plans
- SPAM:         promotional or irrelevant content

IMPORTANT:
- Detect the language of the email (use standard ISO 639-1 code, e.g. "en", "es", "de", "fr", "hu", "pt", etc.)
- Consider context, sentiment, and urgency
- Be accurate in categorization — when in doubt, use INFO_REQUEST

RESPOND WITH ONLY THIS JSON (no markdown, no code blocks):
{
  "category": "BILLING",
  "confidence": 0.95,
  "language": "en",
  "sentiment": "neutral",
  "urgency": "normal",
  "reasoning": "Brief explanation in English"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.geminiApiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: AI_CONFIG.temperature,
      maxOutputTokens: AI_CONFIG.maxTokens
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result   = JSON.parse(response.getContentText());

  if (!result.candidates || !result.candidates[0]) {
    throw new Error('No response from Gemini');
  }

  const aiText = result.candidates[0].content.parts[0].text;

  let cleaned = aiText.trim();
  cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  const analysis = JSON.parse(cleaned);

  return {
    categoryName:   analysis.category   || 'INFO_REQUEST',
    confidence:     analysis.confidence || 0.5,
    language:       analysis.language   || 'en',
    sentiment:      analysis.sentiment  || 'neutral',
    isUrgent:       analysis.urgency === 'high' || analysis.urgency === 'urgent',
    reasoning:      analysis.reasoning  || '',
    analysisMethod: 'Gemini'
  };
}

function analyzeFallback(message) {
  const subject = message.getSubject().toLowerCase();
  const body    = message.getPlainBody().toLowerCase().substring(0, 1000);
  const text    = subject + ' ' + body;

  // Basic language detection: check for common non-English characters
  // This is intentionally simple — the AI handles this properly when available
  const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
  const language = nonAsciiCount > 3 ? 'other' : 'en';

  let categoryName = 'INFO_REQUEST';
  let confidence   = 0.5;

  // Check keywords across all languages in each category
  for (const [category, config] of Object.entries(CATEGORIES)) {
    const allKeywords = Object.values(config.keywords || {}).flat();
    const matches     = allKeywords.filter(kw => text.includes(kw)).length;

    if (matches > 0) {
      categoryName = category;
      confidence   = Math.min(0.9, 0.6 + (matches * 0.1));
      break;
    }
  }

  return {
    categoryName:   categoryName,
    confidence:     confidence,
    language:       language,
    sentiment:      'neutral',
    isUrgent:       false,
    reasoning:      'Fallback keyword matching',
    analysisMethod: 'Fallback'
  };
}

function trackAIUsage(category, language, confidence) {
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  let usageSheet    = ss.getSheetByName('AI Usage');

  if (!usageSheet) {
    usageSheet = ss.insertSheet('AI Usage');
    usageSheet.appendRow(['Timestamp', 'Category', 'Language', 'Confidence', 'Method']);
  }

  usageSheet.appendRow([new Date(), category, language, confidence, 'Gemini']);
}
