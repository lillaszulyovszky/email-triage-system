#!/bin/bash
# ============================================
# EMAIL TRIAGE — ONE-TIME SETUP SCRIPT
# ============================================
# Run this once on your local machine to connect
# the project to Google Apps Script and GitHub.
#
# Usage: bash scripts/setup.sh
# ============================================

set -e  # Stop on any error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

echo ""
echo "=================================================="
echo "  Email Triage System — Project Setup"
echo "=================================================="
echo ""

# ── Step 1: Check Node.js ─────────────────────────────
echo "Checking prerequisites..."
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found.${NC}"
  echo "  Install it from: https://nodejs.org (LTS version)"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ── Step 2: Install clasp ─────────────────────────────
echo ""
echo "Installing clasp (Google Apps Script CLI)..."
if command -v clasp &> /dev/null; then
  echo -e "${GREEN}✓ clasp already installed: $(clasp -v)${NC}"
else
  npm install -g @google/clasp
  echo -e "${GREEN}✓ clasp installed${NC}"
fi

# ── Step 3: Google login ──────────────────────────────
echo ""
echo -e "${YELLOW}Step 1/3 — Google Authentication${NC}"
echo "A browser window will open. Sign in with the Google account"
echo "that owns the Apps Script project."
echo ""
read -p "Press Enter to open the browser..."
clasp login
echo -e "${GREEN}✓ Logged in to Google${NC}"

# ── Step 4: Get Script ID ─────────────────────────────
echo ""
echo -e "${YELLOW}Step 2/3 — Connect to your Apps Script project${NC}"
echo ""
echo "To find your Script ID:"
echo "  1. Open your Google Sheet"
echo "  2. Click Extensions > Apps Script"
echo "  3. Click Project Settings (⚙️ gear icon)"
echo "  4. Copy the Script ID shown there"
echo ""
read -p "Paste your Script ID here: " SCRIPT_ID

if [ -z "$SCRIPT_ID" ]; then
  echo -e "${RED}✗ No Script ID entered. Run setup again.${NC}"
  exit 1
fi

# Write to .clasp.json
cat > .clasp.json << EOF
{
  "scriptId": "$SCRIPT_ID",
  "rootDir": "./src"
}
EOF

echo -e "${GREEN}✓ .clasp.json updated with Script ID${NC}"

# ── Step 5: Test push ─────────────────────────────────
echo ""
echo "Testing connection with a dry-run push..."
if clasp push --force; then
  echo -e "${GREEN}✓ Successfully pushed to Apps Script${NC}"
else
  echo -e "${RED}✗ Push failed. Check that the Script ID is correct.${NC}"
  exit 1
fi

# ── Step 6: GitHub ────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 3/3 — GitHub setup${NC}"
echo ""

if git remote get-url origin &> /dev/null; then
  echo -e "${GREEN}✓ Git remote already configured: $(git remote get-url origin)${NC}"
else
  echo "Go to github.com and create a new repository called 'email-triage-system'"
  echo "(make it private if you prefer)"
  echo ""
  read -p "Paste your GitHub repo URL (e.g. https://github.com/yourname/email-triage-system): " GITHUB_URL

  if [ -z "$GITHUB_URL" ]; then
    echo -e "${YELLOW}⚠ Skipping GitHub setup — you can add it later with:${NC}"
    echo "  git remote add origin YOUR_GITHUB_URL"
    echo "  git push -u origin main"
  else
    git remote add origin "$GITHUB_URL"
    git add -A
    git commit -m "Initial commit: email triage system"
    git push -u origin main
    echo -e "${GREEN}✓ Pushed to GitHub${NC}"
  fi
fi

# ── Done ──────────────────────────────────────────────
echo ""
echo "=================================================="
echo -e "${GREEN}  Setup complete!${NC}"
echo "=================================================="
echo ""
echo "Your workflow from now on:"
echo ""
echo "  1. Open Claude Code in this folder:"
echo "     claude"
echo ""
echo "  2. Describe what you want to change, e.g.:"
echo "     'Add a new category for partnership inquiries'"
echo "     'Make the billing reply warmer in tone'"
echo "     'Add Slack notification support'"
echo ""
echo "  3. Claude Code edits the files, then run:"
echo "     clasp push && git add -A && git commit -m 'your message' && git push"
echo ""
echo "  Or ask Claude Code to run the deploy command for you."
echo ""
