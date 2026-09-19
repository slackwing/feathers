#!/usr/bin/env bash
# claude_access.sh [--local] — log roster.py in as "claude", the shared-auth
# bot user that owns what the hxh-character skill finds (Andrew,
# 2026-09-19: "add you to the admin database as a bot user but with
# admin/admin role, not an hxh role"). Ensures the user and its role
# exist, mints a one-time token, sets a fresh password through the public
# set-password flow, and writes ~/.claude/hxh-roster.env. Production by
# default (psql on the VM); --local targets the docker test stack.
set -uo pipefail
ENV="$HOME/.claude/hxh-roster.env"
USER="claude"
if [[ "${1:-}" == "--local" ]]; then
  BASE="http://127.0.0.1:8770"
  psql_run() { PGPASSWORD=devpass psql -h 127.0.0.1 -p 5434 -U postgres -d hobby_server_test -v ON_ERROR_STOP=1 -q -t -A -c "$1"; }
else
  BASE="https://andrewcheong.com"
  SSH=(ssh -o BatchMode=yes -i "$HOME/.ssh/id_ed25519_gcp_202512" acheong87@35.243.192.242)
  psql_run() {
    "${SSH[@]}" 'PW=$(grep -A8 "name: admin" ~/.config/hobby-server/config.yaml | grep password | sed -E "s/.*password: *\"?([^\"]*)\"?.*/\1/"); PGPASSWORD="$PW" psql -h 10.12.32.3 -U hobby_server -d hobby_server -v ON_ERROR_STOP=1 -q -t -A -c "'"$1"'"' 2>&1 | grep -v -i 'warning\|post-quantum\|openssh\|store now' || true
  }
fi
CODE="$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')"
HASH="$(printf '%s' "$CODE" | sha256sum | cut -d' ' -f1)"
PASS="$(head -c 24 /dev/urandom | base64 | tr -d '/+=\n')"
psql_run "INSERT INTO hobby_server_user (username, display_name, initial, color, active_site, is_bot) VALUES ('$USER', 'Claude', 'CL', '#d97757', 'hxh', true) ON CONFLICT (username) DO UPDATE SET is_bot = true; INSERT INTO hobby_server_user_roles VALUES ('$USER', 'admin', 'admin') ON CONFLICT DO NOTHING; INSERT INTO hobby_server_password_token (token_hash, username, website, kind, expires_at) VALUES ('$HASH', '$USER', 'admin', 'reset', NOW() + interval '10 minutes');"
code=$(curl -s -H 'Content-Type: application/json' -X POST "$BASE/admin/api/set-password" -d "{\"code\":\"$CODE\",\"password\":\"$PASS\"}" -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] || { echo "set-password failed: HTTP $code" >&2; exit 1; }
printf 'HXH_ROSTER_BASE=%s\nHXH_ROSTER_USER=%s\nHXH_ROSTER_PASS=%s\n' "$BASE" "$USER" "$PASS" > "$ENV"
chmod 600 "$ENV"; rm -f "$HOME/.claude/hxh-roster.cookie"
echo "roster.py now logs in as $USER at $BASE (env: $ENV)"
