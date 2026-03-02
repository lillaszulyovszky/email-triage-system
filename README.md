# AI-Powered Email Triage System

Automated email categorisation and draft reply generation for coworking spaces.
Processes inbound emails using Google Gemini AI, syncs member data from coworking
platforms, and sends daily activity digests.

## Features

- **AI categorisation** — Gemini 1.5 Flash classifies emails into 5 categories (90%+ accuracy)
- **Human-sounding drafts** — AI-written replies with manager summary note, not templates
- **Multilingual** — auto-detects any language, replies in the same language
- **Member context** — draft note shows member tenure, plan, and notes from your system
- **Availability injection** — booking replies include real room availability
- **Sentiment escalation** — flags frustrated members across all categories
- **Follow-up detection** — recognises reply threads and drafts accordingly
- **Platform sync** — pulls live data from Nexudus, Cobot, or OfficeR&D
- **Auto-processing** — runs every 15 minutes via time trigger, no manual clicks
- **Daily digest** — morning summary of previous day's activity
- **Noise filtering** — skips newsletters, auto-replies, and notifications before AI

## Tech stack

- Google Apps Script (JavaScript)
- Google Gemini 1.5 Flash API
- Gmail API + Google Sheets
- clasp (CLI deployment)

## Setup

### Prerequisites
- Node.js (LTS) — [nodejs.org](https://nodejs.org)
- Google account with Gmail
- Gemini API key (free) — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### One-time setup
```bash
git clone https://github.com/YOUR_USERNAME/email-triage-system
cd email-triage-system
bash scripts/setup.sh
```

The setup script installs clasp, authenticates with Google, connects to your
Apps Script project, and links your GitHub repo.

### Configuration
Open `src/Config.gs` and fill in:
```javascript
inboxAddress:    'hello@yourspace.com',   // Gmail that receives member emails
spaceName:       'Your Coworking Space',
spaceWebsite:    'www.yourspace.com',
digestRecipient: 'you@yourspace.com',
```

For platform integration (optional):
```javascript
platform: 'nexudus',  // or 'cobot', 'officernd', 'manual'
nexudus: {
  username:  'your@login.com',
  password:  'yourpassword',
  subdomain: 'yourspace'
}
```

### In Google Sheets (first time only)
From the **Email Triage** menu:
1. ✅ Test Setup
2. 🏷️ Setup Labels
3. 📅 Setup Availability Sheet
4. 👥 Setup Members Sheet
5. 🔄 Sync from Platform API *(if using a platform)*
6. ⏰ Schedule Auto-Processing

## Development workflow with Claude Code

```bash
# Open Claude Code in the project folder
cd email-triage-system
claude
```

Describe what you want — Claude Code edits the files, then deploy:

```bash
bash scripts/deploy.sh "what you changed"
```

This pushes to Apps Script and GitHub in one command.

## File structure

```
src/
├── Code.gs            # Main logic, email filter, auto-trigger
├── Config.gs          # All configuration — edit this first
├── EmailAnalysis.gs   # Gemini categorisation
├── Templates.gs       # Draft generation + manager note
├── Members.gs         # Member sheet setup + lookup
├── Availability.gs    # Availability sheet setup
├── Integrations.gs    # Nexudus / Cobot / OfficeR&D sync
├── Digest.gs          # Daily summary email
├── EmailGenerator.gs  # Test email generation
├── AccuracyTesting.gs # Categorisation accuracy testing
├── Utils.gs           # Shared helpers
└── appsscript.json    # Manifest

scripts/
├── setup.sh           # One-time setup
└── deploy.sh          # Push to Apps Script + GitHub

CLAUDE.md              # Instructions Claude Code reads at session start
```

## Platform integrations

| Platform | Coverage | Auth method |
|----------|----------|-------------|
| [Nexudus](https://nexudus.com) | Most widely used globally | Username + password |
| [Cobot](https://cobot.me) | Popular in Europe | OAuth token |
| [OfficeR&D](https://officernd.com) | Enterprise-focused | OAuth client credentials |
| Manual | Any space | Edit sheets directly |

## Gmail labels applied

| Label | Meaning |
|-------|---------|
| 💰 Billing | Invoice, payment, receipt queries |
| 📅 Booking | Room or desk reservations |
| ⚠️ Complaint | Issues — always flagged for human review |
| ❓ Info | General questions, pricing, tours |
| 👥 Membership | Join, upgrade, cancel |
| 🚨 Urgent | High-urgency emails — starred and marked important |
| ⭐ VIP | Emails from configured VIP senders |
| 😤 Unhappy Member | Negative sentiment on non-complaint emails |
| 👀 Needs Review | Low confidence or complaints — no auto-draft |

## License

MIT — free to use and adapt for your own space.
