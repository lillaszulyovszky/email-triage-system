#!/bin/bash
# ============================================
# EMAIL TRIAGE — DEPLOY SCRIPT
# ============================================
# Pushes all changes to both Google Apps Script and GitHub.
# Run after any change to files in src/.
#
# Usage:
#   bash scripts/deploy.sh "describe what you changed"
#
# Or without a message (uses a timestamp):
#   bash scripts/deploy.sh
# ============================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

COMMIT_MSG="${1:-"Update: $(date '+%Y-%m-%d %H:%M')"}"

echo ""
echo "Deploying: $COMMIT_MSG"
echo ""

# Push to Apps Script
echo "→ Pushing to Google Apps Script..."
if clasp push --force; then
  echo -e "${GREEN}✓ Apps Script updated${NC}"
else
  echo -e "${RED}✗ Apps Script push failed${NC}"
  exit 1
fi

# Push to GitHub
echo "→ Pushing to GitHub..."
git add -A

if git diff --cached --quiet; then
  echo "  No changes to commit."
else
  git commit -m "$COMMIT_MSG"
  git push
  echo -e "${GREEN}✓ GitHub updated${NC}"
fi

echo ""
echo -e "${GREEN}Done! Both Apps Script and GitHub are up to date.${NC}"
echo ""
