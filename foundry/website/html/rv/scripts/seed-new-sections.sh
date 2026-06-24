#!/usr/bin/env bash
# Seeds the 3 new prep sections + their initial items into the live
# hobby-server DB via the /rv/api/prep API. Requires a valid rv-server
# session cookie passed as RV_COOKIE env var.
#
# Usage:
#   1. Log into the rv site in a browser (https://andrewcheong.com/rv/).
#   2. Open devtools → Application → Cookies → copy the `rv_session`
#      cookie value.
#   3. Run:
#        RV_COOKIE='rv_session=...' bash scripts/seed-new-sections.sh
#
# Only run ONCE — items are not deduped.

set -euo pipefail

BASE="${BASE:-https://andrewcheong.com/rv/api/prep}"

if [[ -z "${RV_COOKIE:-}" ]]; then
  echo "ERROR: set RV_COOKIE env var (e.g. RV_COOKIE='rv_session=...')" >&2
  exit 1
fi

post_json() {
  local path="$1"
  local body="$2"
  curl -sS -o /tmp/seed-resp.json -w '%{http_code}' \
    -X POST "${BASE}${path}" \
    -H "Cookie: ${RV_COOKIE}" \
    -H 'Content-Type: application/json' \
    -d "${body}"
}

add_section() {
  local id="$1" title="$2" sort_order="$3"
  local body code
  body=$(python3 -c 'import json,sys; print(json.dumps({"id":sys.argv[1],"title":sys.argv[2],"sort_order":float(sys.argv[3])}))' "${id}" "${title}" "${sort_order}")
  code=$(post_json "/sections" "${body}")
  if [[ "${code}" == "201" ]]; then
    echo "  + section ${id} (${title})"
  else
    echo "  = section ${id} HTTP ${code} (skipping; may already exist)" >&2
  fi
}

add_item() {
  local section="$1" text="$2" sort_order="$3"
  local body code
  body=$(python3 -c 'import json,sys; print(json.dumps({"section":sys.argv[1],"text":sys.argv[2],"sort_order":float(sys.argv[3])}))' "${section}" "${text}" "${sort_order}")
  code=$(post_json "" "${body}")
  if [[ "${code}" == "201" ]]; then
    echo "  + ${section}: ${text}"
  else
    echo "  ! ${section} '${text}' HTTP ${code}" >&2
    cat /tmp/seed-resp.json >&2
  fi
}

echo "Creating sections…"
add_section "buy_before"    "Things to buy/obtain before the trip"   1100
add_section "buy_during"    "Things to buy/obtain while there"       1200
add_section "amazon_locker" "Things to pick up from an Amazon locker" 1300

echo "Seeding buy_before…"
sort=1000
for text in \
  "binoculars" \
  "travel shampoo/conditioner for andrew" \
  "rei sunglasses" \
  "enzymes for airhead" \
  "laundry soap bar" \
  "bodywash or soap bar" \
  "dc fan" \
  "sey coffee beans" \
  "grinder" \
  "aeropress"; do
  add_item "buy_before" "${text}" "${sort}"
  sort=$((sort + 1000))
done

echo "Seeding buy_during…"
sort=1000
for text in \
  "electrolyte powder" \
  "emergency gallons of water (non-distilled)" \
  "mace"; do
  add_item "buy_during" "${text}" "${sort}"
  sort=$((sort + 1000))
done

echo "amazon_locker section seeded empty (intentional)."

echo "Done."
