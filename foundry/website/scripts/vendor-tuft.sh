#!/usr/bin/env bash
#
# Vendor UI components from github.com/slackwing/tuft (lib/ui/<name>/) into
# the website. Copies are never edited here — change tuft, then re-run.
#
# Usage (from anywhere in the repo):
#   foundry/website/scripts/vendor-tuft.sh                  # ref=origin/main, source=~/src/tuft
#   foundry/website/scripts/vendor-tuft.sh --ref=5f66852
#   foundry/website/scripts/vendor-tuft.sh --source=/some/clone
#
# Reads files straight from git at the ref, so it never checks anything
# out in your tuft clone.
#
# Produces, per destination dir:
#   <dest>/<file>         the vendored files
#   <dest>/TUFT_UPSTREAM  provenance stamp (ref, sha, when, files)

set -euo pipefail

REF="origin/main"
SOURCE="$HOME/src/tuft"
for arg in "$@"; do
    case "$arg" in
        --ref=*)    REF="${arg#--ref=}" ;;
        --source=*) SOURCE="${arg#--source=}" ;;
        *) echo "unknown arg: $arg" >&2; exit 2 ;;
    esac
done

if [ ! -d "$SOURCE/.git" ]; then
    echo "vendor-tuft: $SOURCE is not a git clone" >&2
    exit 1
fi

WEBSITE="$(cd "$(dirname "$0")/.." && pwd)"

# component → destination dir (relative to foundry/website). Explicit, not a
# glob: vendoring another component is a deliberate edit here.
COMPONENTS=(
    "grid-of-squares:html/status/vendor"
)

git -C "$SOURCE" fetch --quiet origin
SHA="$(git -C "$SOURCE" rev-parse --short "$REF")"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "== Vendoring tuft @ $REF ($SHA) =="

declare -A STAMPED
for entry in "${COMPONENTS[@]}"; do
    name="${entry%%:*}"
    dest="$WEBSITE/${entry#*:}"
    mkdir -p "$dest"
    for ext in js css; do
        path="lib/ui/$name/$name.$ext"
        git -C "$SOURCE" show "$REF:$path" > "$dest/$name.$ext"
        echo "  $path → ${entry#*:}/$name.$ext"
    done
    STAMPED["$dest"]+="$name.js $name.css "
done

for dest in "${!STAMPED[@]}"; do
    cat > "$dest/TUFT_UPSTREAM" <<EOF
source: github.com/slackwing/tuft
ref:    $REF
sha:    $SHA
at:     $NOW
files:  ${STAMPED[$dest]}
EOF
    echo "  stamped ${dest#$WEBSITE/}/TUFT_UPSTREAM"
done
echo "== Done. =="
