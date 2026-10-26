#!/bin/sh
# Builds the NTULearn submission zip from the last commit, including the git history that the
# AI Audit Report cites as evidence.
# Usage: npm run package                        -> DutchPoint.zip in the repository root
#        GROUP_NAME=OtherName npm run package   -> OtherName.zip
set -eu

name="${GROUP_NAME:-DutchPoint}"
root="$(git rev-parse --show-toplevel)"
cd "$root"

# The zip is built from commits, so anything uncommitted (or never added) would be silently missing.
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit (or stash) these changes first; the zip is built from the last commit:" >&2
  git status --short >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if upstream="$(git rev-parse --verify --quiet '@{u}')" && [ "$upstream" != "$(git rev-parse HEAD)" ]; then
  echo "Note: $branch differs from its GitHub copy; the zip uses your local commits." >&2
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# A fresh single-branch clone holds only tracked files plus this branch's history: no node_modules,
# build output, .env or local deployment record.
git clone --quiet --no-local --single-branch --branch "$branch" "$root" "$work/$name"
if remote="$(git remote get-url origin 2>/dev/null)"; then
  git -C "$work/$name" remote set-url origin "$remote"
fi

# Matriculation numbers are personal data, so they are never committed: the repository is public. The
# submitted copy of the AI Audit Report gets them from a private file kept outside the repository
# (default ../DutchPoint-team-details.md, or TEAM_DETAILS=path), which replaces the report's
# <!-- team-details --> line.
details="${TEAM_DETAILS:-$root/../DutchPoint-team-details.md}"
report="$work/$name/docs/ai-audit/report.md"
if [ -f "$details" ]; then
  if ! grep -qx '<!-- team-details -->' "$report"; then
    echo "The report has no <!-- team-details --> line to replace." >&2
    exit 1
  fi
  awk -v f="$details" '$0 == "<!-- team-details -->" { while ((getline line < f) > 0) print line; next } { print }' \
    "$report" > "$report.tmp" && mv "$report.tmp" "$report"
  echo "Added the team details from $details to the report in the zip (not committed)."
else
  echo "Note: $details not found, so the report in the zip has no matriculation numbers." >&2
fi

rm -f "$root/$name.zip"
(cd "$work" && zip -qr "$root/$name.zip" "$name")

commits="$(git rev-list --count HEAD)"
echo "Wrote $name.zip ($(du -h "$name.zip" | cut -f1 | tr -d ' ')): $branch at $(git rev-parse --short HEAD), $commits commits of history."
