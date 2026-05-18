#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "$0")" && pwd)"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

info()    { printf "%s==>%s %s\n" "$BLUE"   "$NC" "$*"; }
success() { printf "%s✓%s %s\n"   "$GREEN"  "$NC" "$*"; }
warn()    { printf "%s!%s %s\n"   "$YELLOW" "$NC" "$*"; }
die()     { printf "%s✗%s %s\n"   "$RED"    "$NC" "$*" >&2; exit 1; }

# ── args ────────────────────────────────────────────────────────────────
[ $# -eq 1 ] || die "Usage: $0 <version>  (e.g. 1.0.0 or 1.0.0-beta1)"

TAG="$1"
if [[ ! "$TAG" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    die "Invalid version: $TAG — expected X.Y.Z or X.Y.Z-suffix (no leading 'v')"
fi

VERSION="$TAG"
PRERELEASE=false
[[ "$TAG" == *-* ]] && PRERELEASE=true

# ── required tools ──────────────────────────────────────────────────────
command -v pnpm >/dev/null || die "pnpm not found"
command -v gh   >/dev/null || die "gh CLI not found"

# ── git state ───────────────────────────────────────────────────────────
info "Pre-flight checks"

git rev-parse --git-dir >/dev/null 2>&1 || die "Not a git repository"
[ -z "$(git status --porcelain)" ]      || die "Working tree is not clean — commit or stash first"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
LOCAL_HEAD=$(git rev-parse HEAD)
SHORT_HEAD=$(git rev-parse --short HEAD)

[ "$BRANCH" = "main" ] || die "Releases must be cut from 'main' (currently on '$BRANCH')"

info "Fetching from origin..."
git fetch --tags --quiet origin

# Tag must not already exist
if git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null; then
    die "Tag $TAG already exists locally"
fi
if git ls-remote --tags --exit-code origin "refs/tags/$TAG" >/dev/null 2>&1; then
    die "Tag $TAG already exists on origin"
fi

# Branch must be in sync with remote
REMOTE_HEAD=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")
if [ -z "$REMOTE_HEAD" ]; then
    die "Branch $BRANCH has no upstream on origin"
elif [ "$REMOTE_HEAD" != "$LOCAL_HEAD" ]; then
    REMOTE_SHORT=$(git rev-parse --short "origin/$BRANCH")
    die "Local $BRANCH ($SHORT_HEAD) is out of sync with origin/$BRANCH ($REMOTE_SHORT) — pull or push first"
fi

# ── CI check ────────────────────────────────────────────────────────────
info "Checking CI on $SHORT_HEAD..."
CI_FAILED=$(gh run list --branch "$BRANCH" --limit 20 --json headSha,conclusion \
    --jq "[.[] | select(.headSha == \"$LOCAL_HEAD\") | select(.conclusion == \"failure\" or .conclusion == \"cancelled\" or .conclusion == \"timed_out\" or .conclusion == \"action_required\")] | length")
CI_PENDING=$(gh run list --branch "$BRANCH" --limit 20 --json headSha,status \
    --jq "[.[] | select(.headSha == \"$LOCAL_HEAD\") | select(.status != \"completed\")] | length")
CI_PASSED=$(gh run list --branch "$BRANCH" --limit 20 --json headSha,conclusion \
    --jq "[.[] | select(.headSha == \"$LOCAL_HEAD\") | select(.conclusion == \"success\")] | length")

if [ "$CI_FAILED" != "0" ]; then
    die "$CI_FAILED CI workflow(s) failed on $SHORT_HEAD — fix before releasing"
fi

if [ "$CI_PENDING" != "0" ]; then
    warn "$CI_PENDING CI workflow(s) still running on $SHORT_HEAD"
    read -r -p "Continue anyway? (y/N) " REPLY
    [[ "$REPLY" =~ ^[Yy]$ ]] || die "Aborted"
elif [ "$CI_PASSED" = "0" ]; then
    warn "No CI runs found for $SHORT_HEAD"
    read -r -p "Continue anyway? (y/N) " REPLY
    [[ "$REPLY" =~ ^[Yy]$ ]] || die "Aborted"
else
    success "CI green ($CI_PASSED workflow(s) passed)"
fi

# ── confirm ─────────────────────────────────────────────────────────────
MARK_LATEST=true
[ "$PRERELEASE" = true ] && MARK_LATEST=false

CURRENT_VERSION=$(node -p "require('./package.json').version")

echo
info "About to release:"
printf "  %-12s %s\n" "Current:"     "$CURRENT_VERSION"
printf "  %-12s %s\n" "Version:"     "$VERSION"
printf "  %-12s %s\n" "Tag:"         "$TAG"
printf "  %-12s %s @ %s\n" "Branch:" "$BRANCH" "$SHORT_HEAD"
printf "  %-12s %s\n" "Pre-release:" "$PRERELEASE"
printf "  %-12s %s\n" "Mark latest:" "$MARK_LATEST"
echo
read -r -p "Proceed? (y/N) " REPLY
[[ "$REPLY" =~ ^[Yy]$ ]] || die "Aborted"

# ── bump version ────────────────────────────────────────────────────────
info "Bumping package.json to $VERSION..."
pnpm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null

# ── sanity build ────────────────────────────────────────────────────────
info "Running production build..."
pnpm run build >/dev/null

# Build must not have left source changes behind (e.g. formatter/lint auto-fix).
# Only package.json should be modified at this point (from pnpm version).
UNEXPECTED_CHANGES=$(git status --porcelain | grep -vE "^.M package\.json$" || true)
if [ -n "$UNEXPECTED_CHANGES" ]; then
    echo
    warn "Build modified unexpected files:"
    echo "$UNEXPECTED_CHANGES"
    die "Commit those fixes first, then re-run this script"
fi

success "Build clean"

# ── commit ──────────────────────────────────────────────────────────────
git add package.json

if git diff --cached --quiet; then
    warn "Nothing to commit (version unchanged)"
else
    info "Committing release..."
    git commit -m "$VERSION"
fi

# ── tag + push ──────────────────────────────────────────────────────────
info "Tagging $TAG..."
git tag "$TAG"

info "Pushing branch and tag..."
git push origin "$BRANCH"
git push origin "$TAG"

# ── github release ──────────────────────────────────────────────────────
info "Creating GitHub release..."
RELEASE_FLAGS=(--title "$TAG" --generate-notes)
[ "$PRERELEASE" = true ] && RELEASE_FLAGS+=(--prerelease)
gh release create "$TAG" "${RELEASE_FLAGS[@]}"

echo
success "Released $TAG"
info "Publish to NPM workflow has been triggered by the release event."
info "Watch: gh run watch"
