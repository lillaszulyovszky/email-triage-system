// ============================================
// CONFIGURATION
// ============================================
// Two types of settings live here:
//
// 1. SPACE SETTINGS (bottom of this file) — things like your space name,
//    website, which platform you use. Edit these directly in this file.
//    They're not sensitive so it's fine for them to be in the code.
//
// 2. SECRETS (API keys, passwords, tokens) — these are NOT stored here.
//    They live in Apps Script's Script Properties (Google's secure storage)
//    and are loaded at runtime by getSecret().
//    To set them up: Email Triage menu > 🔑 Configure API Keys
// ============================================


// ── Secret loader ─────────────────────────────────────────────────────────
// Reads a value from Script Properties (secure storage).
// Never returns the key itself — just fetches the stored value.
function getSecret(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}


// ── Non-sensitive space settings ──────────────────────────────────────────
// Safe to edit directly and commit to GitHub.

const CONFIG = {
  labels: {
    billing:        '💰 Billing',
    booking:        '📅 Booking',
    complaint:      '⚠️ Complaint',
    infoRequest:    '❓ Info',
    membership:     '👥 Membership',
    spam:           '🚫 Spam',

    // Language labels created dynamically at runtime
    // e.g. "🌐 English", "🌐 Spanish" — see getLanguageName() in Utils.gs

    // Status labels
    needsReview:    '👀 Needs Review',
    urgent:         '🚨 Urgent',
    vip:            '⭐ VIP',
    internal:       '🏢 Internal',
    sentimentAlert: '😤 Unhappy Member'
  },

  // ── Edit these for your space ─────────────────────────────────────────
  spaceName:    'Your Coworking Space',
  spaceWebsite: 'www.yourspace.com',
  spacePhone:   '',   // leave blank to omit from replies
  spaceEmail:   '',   // leave blank to omit from replies

  // Gmail address that receives member emails
  // Used to build the email search filter
  inboxAddress:    'YOUR_EMAIL@gmail.com',

  // Who gets the morning digest and error alerts
  digestRecipient: 'YOUR_EMAIL@gmail.com',

  // Which platform you use for member/booking data
  // Options: 'nexudus', 'cobot', 'officernd', 'manual'
  // Credentials are set via Email Triage > Configure API Keys
  platform: 'manual',

  // Nexudus subdomain (if using Nexudus)
  // e.g. if your URL is acmecowork.spaces.nexudus.com → 'acmecowork'
  nexudusSubdomain: '',

  // Cobot subdomain (if using Cobot)
  // e.g. if your URL is acmecowork.cobot.me → 'acmecowork'
  cobotSubdomain: '',

  // OfficeR&D org slug (if using OfficeR&D)
  // e.g. from app.officernd.com/[orgSlug]
  officerndOrgSlug: '',
  // ─────────────────────────────────────────────────────────────────────

  maxEmailsPerRun:     50,
  confidenceThreshold: 0.7,

  emailLogSheet:    'Email Log',
  availabilitySheet:'Room Availability',
  membersSheet:     'Members',

  // ── Noise filter ──────────────────────────────────────────────────────
  // Emails matching any of these are skipped before Gemini is ever called.
  // Add patterns specific to your inbox if needed.
  noiseFilters: {
    senderPatterns: [
      'noreply', 'no-reply', 'donotreply', 'do-not-reply',
      'notifications@', 'alerts@', 'mailer@', 'bounce@',
      'postmaster@', 'support@stripe.com', 'receipt@',
      'hello@mailchimp', 'campaigns@', 'newsletter@',
      '@linkedin.com', '@facebookmail.com', '@twitter.com',
      '@google.com', '@accounts.google'
    ],
    subjectPatterns: [
      'unsubscribe', 'newsletter', 'weekly digest',
      'invoice from stripe', 'payment confirmation',
      'your receipt', 'order confirmation',
      'delivery failed', 'out of office', 'auto-reply',
      'automatic reply', 'vacation response'
    ],
    skipListEmails: true
  },

  vipSenders: [
    'boss@company.com',
    'important@client.com'
  ],

  internalDomains: [
    '@yourcompany.com'
  ]
};


// ── AI config — reads key from Script Properties at runtime ───────────────
const AI_CONFIG = {
  get geminiApiKey() { return getSecret('GEMINI_API_KEY'); },
  model:       'gemini-1.5-flash',
  enabled:     true,
  temperature: 0.3,
  maxTokens:   500
};


// ── Integration config — all credentials from Script Properties ───────────
// Subdomains/slugs are non-sensitive so they live in CONFIG above.
// Actual credentials (passwords, tokens, secrets) are stored securely.
const INTEGRATION_CONFIG = {
  get platform()  { return CONFIG.platform; },

  nexudus: {
    get username()  { return getSecret('NEXUDUS_USERNAME'); },
    get password()  { return getSecret('NEXUDUS_PASSWORD'); },
    get subdomain() { return CONFIG.nexudusSubdomain; }
  },

  cobot: {
    get accessToken() { return getSecret('COBOT_ACCESS_TOKEN'); },
    get subdomain()   { return CONFIG.cobotSubdomain; }
  },

  officernd: {
    get clientId()     { return getSecret('OFFICERND_CLIENT_ID'); },
    get clientSecret() { return getSecret('OFFICERND_CLIENT_SECRET'); },
    get orgSlug()      { return CONFIG.officerndOrgSlug; }
  }
};


// ── Email categories ──────────────────────────────────────────────────────

const CATEGORIES = {
  BILLING: {
    label: CONFIG.labels.billing,
    keywords: {
      en: ['invoice', 'payment', 'bill', 'charge', 'fee', 'receipt', 'transaction', 'refund'],
      es: ['factura', 'pago', 'cargo', 'recibo', 'transacción'],
      de: ['rechnung', 'zahlung', 'gebühr', 'quittung'],
      fr: ['facture', 'paiement', 'frais', 'reçu']
    }
  },
  BOOKING: {
    label: CONFIG.labels.booking,
    keywords: {
      en: ['booking', 'reservation', 'meeting room', 'desk', 'space', 'availability', 'schedule'],
      es: ['reserva', 'sala de reuniones', 'escritorio', 'disponibilidad'],
      de: ['buchung', 'reservierung', 'besprechungsraum', 'verfügbarkeit'],
      fr: ['réservation', 'salle de réunion', 'bureau', 'disponibilité']
    }
  },
  COMPLAINT: {
    label: CONFIG.labels.complaint,
    keywords: {
      en: ['complaint', 'problem', 'issue', 'not working', 'disappointed', 'unhappy', 'broken'],
      es: ['queja', 'problema', 'no funciona', 'decepcionado'],
      de: ['beschwerde', 'problem', 'funktioniert nicht', 'enttäuscht'],
      fr: ['plainte', 'problème', 'ne fonctionne pas', 'déçu']
    }
  },
  INFO_REQUEST: {
    label: CONFIG.labels.infoRequest,
    keywords: {
      en: ['question', 'information', 'inquiry', 'interested', 'how', 'what', 'when', 'pricing', 'tour'],
      es: ['pregunta', 'información', 'interesado', 'precio', 'visita'],
      de: ['frage', 'information', 'interessiert', 'preis', 'besichtigung'],
      fr: ['question', 'information', 'intéressé', 'prix', 'visite']
    }
  },
  MEMBERSHIP: {
    label: CONFIG.labels.membership,
    keywords: {
      en: ['membership', 'join', 'sign up', 'cancel', 'subscription', 'plan', 'upgrade', 'downgrade'],
      es: ['membresía', 'unirse', 'cancelar', 'suscripción', 'plan'],
      de: ['mitgliedschaft', 'beitreten', 'kündigen', 'abonnement'],
      fr: ['adhésion', 'rejoindre', 'annuler', 'abonnement']
    }
  },
  SPAM: {
    label: CONFIG.labels.spam,
    keywords: {
      en: ['winner', 'free money', 'viagra', 'click here', 'congratulations', 'lottery']
    }
  }
};
