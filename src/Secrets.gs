// ============================================
// SECRETS SETUP
// ============================================
// Walks you through storing API keys and credentials
// securely in Apps Script's Script Properties.
//
// Run from: Email Triage menu > 🔑 Configure API Keys
//
// Values entered here are stored in Google's secure storage —
// they never appear in any file and cannot be read from the code.
// You only need to do this once per Apps Script project.
// ============================================

function configureSecrets() {
  const ui         = SpreadsheetApp.getUi();
  const props      = PropertiesService.getScriptProperties();
  const current    = props.getProperties();
  const platform   = CONFIG.platform;

  ui.alert(
    '🔑 API Key Setup',
    'This will walk you through storing your credentials securely.\n\n' +
    'Each prompt asks for one value. Your input is stored in\n' +
    'Google\'s secure Script Properties — not in any file.\n\n' +
    'Leave a prompt blank and press OK to skip it (keeps existing value).\n\n' +
    'Current platform: ' + platform,
    ui.ButtonSet.OK
  );

  // ── Always required ───────────────────────────────────────────────────

  const geminiResult = ui.prompt(
    '1 of ' + totalPrompts(platform),
    'GEMINI API KEY\n\n' +
    'Get a free key at: aistudio.google.com/app/apikey\n\n' +
    (current['GEMINI_API_KEY'] ? '✓ Already set — paste new key to update, or leave blank to keep.' : '⚠️ Not yet set.'),
    ui.ButtonSet.OK_CANCEL
  );
  if (geminiResult.getSelectedButton() === ui.Button.CANCEL) return;
  saveIfNotBlank(props, 'GEMINI_API_KEY', geminiResult.getResponseText());

  // ── Platform-specific credentials ─────────────────────────────────────

  if (platform === 'nexudus') {
    const userResult = ui.prompt(
      '2 of ' + totalPrompts(platform),
      'NEXUDUS USERNAME\n\nThe email you use to log into app.nexudus.com.\n\n' +
      (current['NEXUDUS_USERNAME'] ? '✓ Already set.' : '⚠️ Not yet set.'),
      ui.ButtonSet.OK_CANCEL
    );
    if (userResult.getSelectedButton() === ui.Button.CANCEL) return;
    saveIfNotBlank(props, 'NEXUDUS_USERNAME', userResult.getResponseText());

    const passResult = ui.prompt(
      '3 of ' + totalPrompts(platform),
      'NEXUDUS PASSWORD\n\nYour Nexudus login password.\n\n' +
      (current['NEXUDUS_PASSWORD'] ? '✓ Already set.' : '⚠️ Not yet set.'),
      ui.ButtonSet.OK_CANCEL
    );
    if (passResult.getSelectedButton() === ui.Button.CANCEL) return;
    saveIfNotBlank(props, 'NEXUDUS_PASSWORD', passResult.getResponseText());
  }

  if (platform === 'cobot') {
    const tokenResult = ui.prompt(
      '2 of ' + totalPrompts(platform),
      'COBOT ACCESS TOKEN\n\n' +
      'Generate one at: [yourspace].cobot.me/oauth/access_tokens\n' +
      'Scope needed: read\n\n' +
      (current['COBOT_ACCESS_TOKEN'] ? '✓ Already set.' : '⚠️ Not yet set.'),
      ui.ButtonSet.OK_CANCEL
    );
    if (tokenResult.getSelectedButton() === ui.Button.CANCEL) return;
    saveIfNotBlank(props, 'COBOT_ACCESS_TOKEN', tokenResult.getResponseText());
  }

  if (platform === 'officernd') {
    const clientIdResult = ui.prompt(
      '2 of ' + totalPrompts(platform),
      'OFFICERND CLIENT ID\n\n' +
      'Found in: OfficeR&D Settings > Integrations > API\n\n' +
      (current['OFFICERND_CLIENT_ID'] ? '✓ Already set.' : '⚠️ Not yet set.'),
      ui.ButtonSet.OK_CANCEL
    );
    if (clientIdResult.getSelectedButton() === ui.Button.CANCEL) return;
    saveIfNotBlank(props, 'OFFICERND_CLIENT_ID', clientIdResult.getResponseText());

    const clientSecretResult = ui.prompt(
      '3 of ' + totalPrompts(platform),
      'OFFICERND CLIENT SECRET\n\n' +
      'Found in: OfficeR&D Settings > Integrations > API\n\n' +
      (current['OFFICERND_CLIENT_SECRET'] ? '✓ Already set.' : '⚠️ Not yet set.'),
      ui.ButtonSet.OK_CANCEL
    );
    if (clientSecretResult.getSelectedButton() === ui.Button.CANCEL) return;
    saveIfNotBlank(props, 'OFFICERND_CLIENT_SECRET', clientSecretResult.getResponseText());
  }

  // ── Confirmation ──────────────────────────────────────────────────────

  const stored    = props.getProperties();
  const geminiOk  = !!stored['GEMINI_API_KEY'];
  const platformOk = isPlatformConfigured(platform, stored);

  ui.alert(
    '✓ Credentials Saved',
    'Gemini API key: '  + (geminiOk   ? '✓ Set'     : '⚠️ Missing') + '\n' +
    platformStatus(platform, stored) + '\n\n' +
    (geminiOk && platformOk
      ? 'You\'re all set! Run ✅ Test Setup to verify everything works.'
      : '⚠️ Some credentials are still missing. Run 🔑 Configure API Keys again to complete setup.'),
    ui.ButtonSet.OK
  );
}


// ── View what's currently stored (shows keys, not values) ─────────────────
// Useful for checking what's been set without exposing the actual secrets.

function viewSecretStatus() {
  const ui    = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties().getProperties();

  const keys = [
    'GEMINI_API_KEY',
    'NEXUDUS_USERNAME', 'NEXUDUS_PASSWORD',
    'COBOT_ACCESS_TOKEN',
    'OFFICERND_CLIENT_ID', 'OFFICERND_CLIENT_SECRET'
  ];

  const lines = keys.map(k =>
    (props[k] ? '✓' : '✗') + ' ' + k + (props[k] ? ' (set)' : ' (not set)')
  ).join('\n');

  ui.alert(
    '🔑 Stored Credentials',
    'The following credentials are stored in Script Properties.\n' +
    'Values are never shown — only whether they\'re set or not.\n\n' +
    lines + '\n\n' +
    'To update any value: Email Triage > 🔑 Configure API Keys',
    ui.ButtonSet.OK
  );
}


// ── Clear all stored secrets ───────────────────────────────────────────────
// Use if you're moving the project to a new account or starting fresh.

function clearSecrets() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Clear All Secrets?',
    'This will delete all stored API keys and credentials from Script Properties.\n\n' +
    'The system will stop working until you run 🔑 Configure API Keys again.\n\n' +
    'Are you sure?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  PropertiesService.getScriptProperties().deleteAllProperties();
  ui.alert('Done. All credentials cleared.\n\nRun 🔑 Configure API Keys to set them up again.');
}


// ── Helpers ───────────────────────────────────────────────────────────────

function saveIfNotBlank(props, key, value) {
  const trimmed = (value || '').trim();
  if (trimmed) {
    props.setProperty(key, trimmed);
    Logger.log(`Saved: ${key}`);
  } else {
    Logger.log(`Skipped (blank): ${key}`);
  }
}

function totalPrompts(platform) {
  const extras = { nexudus: 2, cobot: 1, officernd: 2 };
  return 2 + (extras[platform] || 0);
}

function isPlatformConfigured(platform, stored) {
  if (platform === 'manual')    return true;
  if (platform === 'nexudus')   return !!(stored['NEXUDUS_USERNAME'] && stored['NEXUDUS_PASSWORD']);
  if (platform === 'cobot')     return !!(stored['COBOT_ACCESS_TOKEN']);
  if (platform === 'officernd') return !!(stored['OFFICERND_CLIENT_ID'] && stored['OFFICERND_CLIENT_SECRET']);
  return false;
}

function platformStatus(platform, stored) {
  if (platform === 'manual')    return 'Platform: manual (no credentials needed)';
  if (platform === 'nexudus')   return 'Nexudus username: ' + (stored['NEXUDUS_USERNAME'] ? '✓ Set' : '⚠️ Missing') + '\nNexudus password: ' + (stored['NEXUDUS_PASSWORD'] ? '✓ Set' : '⚠️ Missing');
  if (platform === 'cobot')     return 'Cobot token: '     + (stored['COBOT_ACCESS_TOKEN'] ? '✓ Set' : '⚠️ Missing');
  if (platform === 'officernd') return 'OfficeR&D client ID: ' + (stored['OFFICERND_CLIENT_ID'] ? '✓ Set' : '⚠️ Missing') + '\nOfficeR&D secret: ' + (stored['OFFICERND_CLIENT_SECRET'] ? '✓ Set' : '⚠️ Missing');
  return '';
}
