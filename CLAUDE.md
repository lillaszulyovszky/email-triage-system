# Email Triage System — Claude Code Instructions

## What this project is
An AI-powered email triage system for coworking spaces. It processes inbound
emails, categorises them using Gemini AI, generates human-sounding draft replies,
syncs member and availability data from coworking platforms, and sends daily digests.

## Tech stack
- **Google Apps Script** (JavaScript) — all runtime logic lives in `src/`
- **Google Gemini 1.5 Flash** — email categorisation and draft generation
- **Gmail API** — reading emails, applying labels, creating drafts
- **Google Sheets** — Email Log, Members, Room Availability (local data cache)
- **clasp** — deploys `src/` to Google Apps Script on every change
- **git** — version control, syncs to GitHub

## File map
| File | Purpose |
|------|---------|
| `src/Code.gs` | Main entry point, menu, email filter, auto-trigger |
| `src/Config.gs` | All configuration — space details, API keys, platform |
| `src/EmailAnalysis.gs` | Gemini categorisation call |
| `src/Templates.gs` | Draft generation, manager summary note, availability injection |
| `src/Members.gs` | Members sheet setup and email→member lookup |
| `src/Availability.gs` | Availability sheet setup |
| `src/Integrations.gs` | Nexudus / Cobot / OfficeR&D API sync |
| `src/Digest.gs` | Daily summary email |
| `src/EmailGenerator.gs` | Test email generation |
| `src/AccuracyTesting.gs` | Categorisation accuracy testing |
| `src/Utils.gs` | Shared helpers: labels, logging, language names |
| `src/appsscript.json` | Apps Script manifest (OAuth scopes, timezone) |

## Deploy workflow
After making any changes:
```bash
cd email-triage
clasp push          # → pushes src/ to Google Apps Script
git add -A
git commit -m "describe what changed"
git push            # → pushes to GitHub
```

Both commands should always be run together after changes. Never push to
one without the other so they stay in sync.

## Key rules when making changes

### Never hardcode
- No brand names, locations, phone numbers, or email addresses in source files
- All user-specific values belong in `Config.gs` under clearly labelled sections
- The `INTEGRATION_CONFIG` block in Config.gs is the single source of truth
  for platform credentials — never scatter credentials elsewhere

### Apps Script constraints
- No `import`/`require` — Apps Script uses a global scope, all functions are
  available across files automatically
- No `npm` packages — only built-in Apps Script services and `UrlFetchApp`
  for external HTTP calls
- `UrlFetchApp.fetch()` is the only way to make API calls — no fetch/axios
- Time triggers are managed via `ScriptApp` — see `scheduleProcessing()` in Code.gs
- `Logger.log()` for all logging — visible in Apps Script View > Logs

### Config.gs is the only file a new user should need to edit
When adding any new configurable value, always:
1. Add it to `CONFIG` or `INTEGRATION_CONFIG` in Config.gs with a clear comment
2. Reference it as `CONFIG.fieldName` everywhere else — never inline the value

### Noise filter first, Gemini second
The email processing pipeline runs:
1. Gmail search query (excludes already-labelled threads)
2. `isNoisyEmail()` check (fast, no API call)
3. `analyzeEmailWithAI()` (Gemini — costs a token)
Any new pre-processing logic should go before step 3.

### Error handling
All time-triggered functions must catch errors and call `notifyError()` — 
triggered runs have no UI, so silent failures are completely invisible otherwise.

### Adding a new platform integration
Follow the pattern in `Integrations.gs`:
1. Add credentials block to `INTEGRATION_CONFIG` in Config.gs
2. Add a `syncXxx()` function in Integrations.gs
3. Add a case to the `syncFromPlatform()` switch
4. Both `writeMembersToSheet()` and `writeAvailabilityToSheet()` are shared —
   normalise your API response to their expected format, don't create new sheet structures

## Common tasks

### User wants to change the reply tone
Edit `REPLY_STYLE_GUIDES` in `Templates.gs`. The style guides are shown to
Gemini as tone examples — they're not copy-pasted, just used for style reference.

### User wants to add a new email category
1. Add to `CATEGORIES` in Config.gs (label + keywords)
2. Add a style guide entry in `REPLY_STYLE_GUIDES` in Templates.gs
3. Add fallback template in `getFallbackTemplate()` in Templates.gs
4. Add test emails for the new category in EmailGenerator.gs

### User wants to add a new noise filter pattern
Add to `CONFIG.noiseFilters.senderPatterns` or `subjectPatterns` in Config.gs.

### User wants to change processing frequency
Edit `everyMinutes(15)` in `scheduleProcessing()` in Code.gs, then re-run
"Schedule Auto-Processing" from the sheet menu to update the trigger.

### User wants to add a new integration platform
See "Adding a new platform integration" above.
