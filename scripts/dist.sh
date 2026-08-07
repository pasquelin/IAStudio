#!/usr/bin/env bash
# Loads the signing credentials, if any, then packages.
#
# electron-builder skips signing and notarization on its own when the variables are absent —
# it only warns — so there is no branch to write here. Fill secrets/.env and the same command
# produces a signed, notarized build.
set -euo pipefail

if [ -f secrets/.env ]; then
  set -a
  # shellcheck disable=SC1091
  . secrets/.env
  set +a
fi

exec pnpm exec electron-builder "$@"
