#!/usr/bin/env bash
# Packages. Signing and notarization run when APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and
# APPLE_TEAM_ID are already in the environment — electron-builder skips them on its own
# when they are absent, and only warns.
set -euo pipefail

exec pnpm exec electron-builder "$@"
