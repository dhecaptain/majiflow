#!/bin/sh
# Validate branch naming: (feature|fix|task)/<contributor>-<short-description>
# Usage: sh scripts/validate-branch.sh [branch-name]
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
if echo "$BRANCH" | grep -Eq '^(feature|fix|task)/[a-z0-9]+-[a-z0-9-]+$'; then
  echo "Branch name OK: $BRANCH"
  exit 0
else
  echo "Invalid branch name '$BRANCH'." >&2
  echo "Expected: (feature|fix|task)/<contributor>-<short-description> e.g. feature/dave-user-auth" >&2
  exit 1
fi
