#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OMS reconnaissance
#
# Run this BEFORE building any login UI. It proves the exact endpoint,
# credential format and TOKEN CONVENTION your instance uses, then prints the
# facts we need to code against. Every response is saved to ./oms-recon-out/.
#
# Usage:
#   chmod +x scripts/oms-recon.sh
#   OMS_BASE_URL=https://oms-host:8443 OMS_USER=admin OMS_PASS='secret' \
#     ./scripts/oms-recon.sh
#
# Optional:
#   OMS_INSECURE=1                     add -k (self-signed certs)
#   SMOKE_API=getOrderList             read-only API used to prove the token
#   SMOKE_PAYLOAD='<Order MaximumRecords="1"/>'
#   ORDER_PAYLOAD=./order.xml          if set, also POSTs a createOrder
#
# The password is never written to disk and is masked in all output.
# ---------------------------------------------------------------------------
set -uo pipefail

: "${OMS_BASE_URL:?set OMS_BASE_URL, e.g. https://oms-host:8443 (with or without a trailing /smcfs)}"
: "${OMS_USER:?set OMS_USER}"
: "${OMS_PASS:?set OMS_PASS}"

# Normalise the base url: drop trailing slashes and any trailing /smcfs so
# both "...cloud" and "...cloud/smcfs" work.
BASE="${OMS_BASE_URL%/}"
BASE="${BASE%/smcfs}"
BASE="${BASE%/}"
API="$BASE/smcfs/restapi"

OUT="${OUT_DIR:-./oms-recon-out}"
SMOKE_API="${SMOKE_API:-getOrderList}"
SMOKE_PAYLOAD="${SMOKE_PAYLOAD:-<Order MaximumRecords=\"1\"/>}"

mkdir -p "$OUT"

# Share one cookie jar across every call. Sterling on Kubernetes commonly uses
# sticky sessions: login lands on pod A, the next request hits pod B, and pod B
# does not know the token -> YCP0427. curl drops cookies unless told not to.
COOKIE_JAR="$OUT/cookies.txt"
: > "$COOKIE_JAR"

CURL=(curl -sS --max-time 60 -c "$COOKIE_JAR" -b "$COOKIE_JAR")
[ "${OMS_INSECURE:-0}" = "1" ] && CURL+=(-k)

# Read a dotted key out of a JSON file without needing jq.
json_get() {
  node -e '
    const fs = require("fs");
    let j;
    try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch { process.exit(1); }
    const v = process.argv[2].split(".").reduce((o, k) => (o == null ? o : o[k]), j);
    if (v !== undefined && v !== null) console.log(v);
  ' "$1" "$2"
}

# Print a JSON file with the Password field masked.
json_mask() {
  node -e '
    const fs = require("fs");
    let j;
    try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch { console.log(fs.readFileSync(process.argv[1], "utf8")); process.exit(0); }
    for (const k of ["Password", "password", "UserToken"]) {
      if (typeof j[k] === "string" && j[k]) j[k] = j[k].slice(0, 8) + "...<redacted>";
    }
    console.log(JSON.stringify(j, null, 2));
  ' "$1"
}

# Pull the ErrorCode out of either an XML or a JSON Sterling error response.
error_code() {
  local f="$1" e
  e=$(grep -o 'ErrorCode="[^"]*"' "$f" 2>/dev/null | head -1 | sed 's/ErrorCode="//;s/"$//')
  [ -z "$e" ] && e=$(grep -o '"ErrorCode":"[^"]*"' "$f" 2>/dev/null | head -1 | sed 's/"ErrorCode":"//;s/"$//')
  printf '%s' "$e"
}

hr() { printf '%s\n' "---------------------------------------------------------------"; }

hr
echo "OMS recon  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "base url : $API"
echo "user     : $OMS_USER"
echo "output   : $OUT"
hr

# ===========================================================================
# 1. LOGIN
# ===========================================================================
echo
echo "== [1/4] LOGIN  POST $API/invoke/login"

login_code=$("${CURL[@]}" -o "$OUT/01-login.json" -w '%{http_code}' \
  -X POST "$API/invoke/login" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d "{\"LoginID\":\"$OMS_USER\",\"Password\":\"$OMS_PASS\"}" 2>"$OUT/00-curl.log")

echo "HTTP $login_code"
if [ ! -s "$OUT/01-login.json" ]; then
  echo "!! empty response - check host/port/TLS. curl said:"; cat "$OUT/00-curl.log"; exit 1
fi
echo "--- response (Password + UserToken masked) ---"
json_mask "$OUT/01-login.json"
echo

TOKEN="$(json_get "$OUT/01-login.json" UserToken)"
if [ -z "$TOKEN" ]; then
  echo "!! no UserToken in the response - cannot continue."
  echo "   check servlet.authstyle and that the body uses LoginID / Password."
  exit 1
fi
echo "OK  UserToken acquired (${#TOKEN} chars, opaque - not a JWT)"
if [ -s "$COOKIE_JAR" ]; then
  echo "    cookies set  : $(awk '!/^#/ && NF {print $6}' "$COOKIE_JAR" | paste -sd, -)  (sticky session - jar is reused for every call)"
else
  echo "    cookies set  : none"
fi

# ===========================================================================
# 2. AUTH MATRIX - which convention does this instance actually accept?
#    A fresh token returned YCP0427 with _token alone, so try them all.
# ===========================================================================
echo
echo "== [2/4] AUTH MATRIX  POST $API/invoke/$SMOKE_API"
echo "    looking for HTTP 200 / no YCP0427"
printf '    %-26s %-6s %s\n' "METHOD" "HTTP" "ERROR CODE"

WINNER=""
WINNER_ARGS=""

try_auth() {
  local name="$1"; shift
  local url="$1"; shift
  local code err
  "${CURL[@]}" -o "$OUT/method-$name.out" -w '%{http_code}' \
    -X POST "$url" "$@" >"$OUT/method-$name.code" 2>>"$OUT/00-curl.log"
  code=$(cat "$OUT/method-$name.code")
  err=$(error_code "$OUT/method-$name.out")
  printf '    %-26s %-6s %s\n' "$name" "$code" "${err:-none}"
  if [ "$code" = "200" ] && [ -z "$WINNER" ]; then
    WINNER="$name"
  fi
}

try_auth "A_token_only" \
  "$API/invoke/$SMOKE_API?_token=$TOKEN" \
  -H 'Content-Type: application/xml' -d "$SMOKE_PAYLOAD"

try_auth "B_loginid_and_token" \
  "$API/invoke/$SMOKE_API?_loginid=$OMS_USER&_token=$TOKEN" \
  -H 'Content-Type: application/xml' -d "$SMOKE_PAYLOAD"

try_auth "C_basic_auth" \
  "$API/invoke/$SMOKE_API" \
  -u "$OMS_USER:$OMS_PASS" -H 'Content-Type: application/xml' -d "$SMOKE_PAYLOAD"

try_auth "D_header_token" \
  "$API/invoke/$SMOKE_API" \
  -H "_token: $TOKEN" -H 'Content-Type: application/xml' -d "$SMOKE_PAYLOAD"

try_auth "E_bearer" \
  "$API/invoke/$SMOKE_API" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/xml' -d "$SMOKE_PAYLOAD"

try_auth "F_no_auth" \
  "$API/invoke/$SMOKE_API" \
  -H 'Content-Type: application/xml' -d "$SMOKE_PAYLOAD"

echo
if [ -z "$WINNER" ]; then
  echo "!! none of the methods returned HTTP 200."
  echo "   most common causes:"
  echo "     - the API is not exposed for this user (API Security -> YCP0428)"
  echo "     - multi-pod cluster with no session affinity: the token was minted"
  echo "       on one pod and validated on another (very common on IKS/ROKS)"
  echo "     - servlet.authstyle is not STANDARD on this instance"
  echo "   inspect: $OUT/method-*.out"
else
  echo "OK  working method: $WINNER  (see $OUT/method-$WINNER.out)"
  head -c 600 "$OUT/method-$WINNER.out"; echo
fi

# ===========================================================================
# 3. INVALID-TOKEN PROBE - the signal the app uses to trigger a re-login
# ===========================================================================
echo
echo "== [3/4] INVALID-TOKEN PROBE"

"${CURL[@]}" -o "$OUT/03-invalid-token.xml" -w '%{http_code}' \
  -X POST "$API/invoke/$SMOKE_API?_token=THIS_IS_NOT_A_VALID_TOKEN" \
  -H 'Content-Type: application/xml' -d "$SMOKE_PAYLOAD" \
  >"$OUT/03.code" 2>>"$OUT/00-curl.log"

echo "HTTP $(cat "$OUT/03.code")  ErrorCode=$(error_code "$OUT/03-invalid-token.xml")"
head -c 500 "$OUT/03-invalid-token.xml"; echo

# ===========================================================================
# 4. OPTIONAL: createOrder end-to-end
# ===========================================================================
echo
if [ -n "${ORDER_PAYLOAD:-}" ] && [ -f "${ORDER_PAYLOAD}" ]; then
  echo "== [4/4] CREATE ORDER (using method: ${WINNER:-B_loginid_and_token})"
  if [ "$WINNER" = "C_basic_auth" ]; then
    AUTH_ARGS=(-u "$OMS_USER:$OMS_PASS")
    ORDER_URL="$API/invoke/createOrder"
  elif [ "$WINNER" = "D_header_token" ]; then
    AUTH_ARGS=(-H "_token: $TOKEN")
    ORDER_URL="$API/invoke/createOrder"
  else
    AUTH_ARGS=()
    ORDER_URL="$API/invoke/createOrder?_loginid=$OMS_USER&_token=$TOKEN"
  fi
  order_code=$("${CURL[@]}" -o "$OUT/04-createOrder.xml" -w '%{http_code}' \
    -X POST "$ORDER_URL" "${AUTH_ARGS[@]}" \
    -H 'Content-Type: application/xml' -d "@${ORDER_PAYLOAD}" 2>>"$OUT/00-curl.log")
  echo "HTTP $order_code  ErrorCode=$(error_code "$OUT/04-createOrder.xml")"
  head -c 1200 "$OUT/04-createOrder.xml"; echo
else
  echo "== [4/4] CREATE ORDER  skipped (set ORDER_PAYLOAD=./order.xml to run it)"
fi

# ===========================================================================
# Summary
# ===========================================================================
hr
echo "FACTS COLLECTED - paste these back:"
hr
printf '%-26s %s\n' "base URL"           "$API"
printf '%-26s %s\n' "login path"         "/smcfs/restapi/invoke/login"
printf '%-26s %s\n' "login body"         '{"LoginID":"...","Password":"..."}'
printf '%-26s %s\n' "token field"        "UserToken (${#TOKEN} chars, opaque)"
printf '%-26s %s\n' "WORKING METHOD"     "${WINNER:-NONE FOUND}"
printf '%-26s %s\n' "login HTTP"         "$login_code"
printf '%-26s %s\n' "invalid token"      "HTTP $(cat "$OUT/03.code") / $(error_code "$OUT/03-invalid-token.xml")  <-- re-login signal"
printf '%-26s %s\n' "default expiry"     "1800000 ms (30 min) via yfs.api.security.token.timeout"
printf '%-26s %s\n' "cookies"            "$(if [ -s "$COOKIE_JAR" ]; then awk '!/^#/ && NF {print $6}' "$COOKIE_JAR" | paste -sd, -; else echo none; fi)"
hr
echo "clean up with:  rm -rf $OUT"
echo "note: $OUT/01-login.json contains the Password field - delete it when done."