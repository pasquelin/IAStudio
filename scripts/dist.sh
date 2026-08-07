#!/usr/bin/env bash
# Loads the signing credentials, if any, then packages.
#
# electron-builder skips signing and notarization on its own when the variables are absent —
# it only warns — so there is no branch to write here. Fill secrets/.env and the same command
# produces a signed, notarized build.
set -euo pipefail

# Only the three Apple variables are exported. `set -a` would also hand SCENARIO_API_KEY to
# signtool, makensis and every afterPack hook — and builder-util only scrubs sensitive names
# on non-Windows hosts.
if [ -f secrets/.env ]; then
  # shellcheck disable=SC1091
  . secrets/.env
  export APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID
fi

exec pnpm exec electron-builder "$@"
