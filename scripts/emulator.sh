#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  up)
    docker rm -f tutor-bank-moto tutor-bank-postgres >/dev/null 2>&1 || true
    docker run -d --name tutor-bank-moto -p 127.0.0.1:5001:5000 motoserver/moto:5.1.17 >/dev/null
    docker run -d --name tutor-bank-postgres -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=tutor_bank_test -p 127.0.0.1:55432:5432 postgres:15 >/dev/null
    moto_ready=false
    for _ in $(seq 1 60); do
      if curl -fsS http://127.0.0.1:5001/moto-api/ >/dev/null 2>&1; then moto_ready=true; break; fi
      sleep 1
    done
    if [[ "$moto_ready" != true ]]; then
      echo "Moto did not become ready within 60 seconds" >&2
      exit 1
    fi
    postgres_ready=false
    for _ in $(seq 1 60); do
      if docker exec tutor-bank-postgres pg_isready -U test -d tutor_bank_test >/dev/null 2>&1; then postgres_ready=true; break; fi
      sleep 1
    done
    if [[ "$postgres_ready" != true ]]; then
      echo "PostgreSQL did not become ready within 60 seconds" >&2
      exit 1
    fi
    client_backup="$(mktemp)"
    cp src/generated/prisma/client.ts "$client_backup"
    restore_client() {
      cp "$client_backup" src/generated/prisma/client.ts
      rm -f "$client_backup"
    }
    trap restore_client EXIT
    DATABASE_URL=postgresql://test:test@127.0.0.1:55432/tutor_bank_test npx prisma db push
    restore_client
    trap - EXIT
    ;;
  down)
    docker rm -f tutor-bank-moto tutor-bank-postgres >/dev/null 2>&1 || true
    ;;
  *)
    echo "usage: $0 up|down" >&2
    exit 2
    ;;
esac
