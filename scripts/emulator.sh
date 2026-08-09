#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  up)
    docker rm -f tutor-bank-moto tutor-bank-postgres >/dev/null 2>&1 || true
    docker run -d --name tutor-bank-moto -p 127.0.0.1:5001:5001 motoserver/moto -H 0.0.0.0 -p 5001 >/dev/null
    docker run -d --name tutor-bank-postgres -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=tutor_bank_test -p 127.0.0.1:5432:5432 postgres:15 >/dev/null
    for i in {1..60}; do curl -fsS http://127.0.0.1:5001/moto-api/ >/dev/null 2>&1 && break; sleep 1; done
    for i in {1..60}; do pg_isready -h 127.0.0.1 -p 5432 -U test >/dev/null 2>&1 && break; sleep 1; done
    ;;
  down) docker rm -f tutor-bank-moto tutor-bank-postgres >/dev/null 2>&1 || true ;;
  *) echo "usage: $0 up|down" >&2; exit 2 ;;
esac
