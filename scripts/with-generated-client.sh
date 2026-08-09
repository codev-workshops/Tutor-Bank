#!/usr/bin/env bash
set -euo pipefail

client_file="src/generated/prisma/client.ts"
backup_file="$(mktemp)"
cp "$client_file" "$backup_file"
restore() {
  cp "$backup_file" "$client_file"
  rm -f "$backup_file"
}
trap restore EXIT

npx prisma generate >/dev/null
"$@"
