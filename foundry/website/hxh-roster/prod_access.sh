#!/usr/bin/env bash
# prod_access.sh start|stop — give roster.py an hxh-admin login on
# PRODUCTION without anyone's password: `start` mints a throwaway admin
# on the VM (psql to Cloud SQL), sets its password through the public
# one-time-token flow, and writes ~/.claude/hxh-roster.env; `stop`
# deletes the user (roles, sessions and tokens cascade). The user is
# never a chat buddy for long and never a bot. Same pattern as the
# 2026-09-17 roster push.
set -uo pipefail
SSH=(ssh -o BatchMode=yes -i "$HOME/.ssh/id_ed25519_gcp_202512" acheong87@35.243.192.242)
BASE="https://andrewcheong.com"
USER="rosterbot"
ENV="$HOME/.claude/hxh-roster.env"

psql_vm() {
  "${SSH[@]}" 'PW=$(grep -A8 "name: admin" ~/.config/hobby-server/config.yaml | grep password | sed -E "s/.*password: *\"?([^\"]*)\"?.*/\1/"); PGPASSWORD="$PW" psql -h 10.12.32.3 -U hobby_server -d hobby_server -v ON_ERROR_STOP=1 -q -t -A -c "'"$1"'"' 2>&1 | grep -v -i 'warning\|post-quantum\|openssh\|store now' || true
}

case "${1:-}" in
  start)
    CODE="$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')"
    HASH="$(printf '%s' "$CODE" | sha256sum | cut -d' ' -f1)"
    PASS="$(head -c 24 /dev/urandom | base64 | tr -d '/+=\n')"
    psql_vm "INSERT INTO hobby_server_user (username, display_name, initial, color, active_site) VALUES ('$USER', 'Roster Bot', 'RB', '#4a7fa0', 'hxh') ON CONFLICT DO NOTHING; INSERT INTO hobby_server_user_roles VALUES ('$USER', 'hxh', 'admin') ON CONFLICT DO NOTHING; INSERT INTO hobby_server_password_token (token_hash, username, website, kind, expires_at) VALUES ('$HASH', '$USER', 'hxh', 'invite', NOW() + interval '10 minutes');"
    code=$(curl -s -H 'Content-Type: application/json' -X POST "$BASE/admin/api/set-password" -d "{\"code\":\"$CODE\",\"password\":\"$PASS\"}" -o /dev/null -w '%{http_code}')
    [[ "$code" == "200" ]] || { echo "set-password failed: HTTP $code" >&2; exit 1; }
    printf 'HXH_ROSTER_BASE=%s\nHXH_ROSTER_USER=%s\nHXH_ROSTER_PASS=%s\n' "$BASE" "$USER" "$PASS" > "$ENV"
    chmod 600 "$ENV"; rm -f "$HOME/.claude/hxh-roster.cookie"
    echo "prod access as $USER (env: $ENV)";;
  stop)
    psql_vm "DELETE FROM hobby_server_user WHERE username = '$USER';"
    rm -f "$HOME/.claude/hxh-roster.cookie"
    echo "$USER removed";;
  *) echo "usage: prod_access.sh start|stop" >&2; exit 2;;
esac
