#!/usr/bin/env bash
set -euo pipefail

POSTGRES_NAME="tutor-bank-postgres"
MOTO_NAME="tutor-bank-moto"
DATABASE_URL="${DATABASE_URL:-postgresql://test:test@127.0.0.1:5432/tutor_bank_test}"

wait_for_postgres() {
  for _ in $(seq 1 60); do
    if docker exec "$POSTGRES_NAME" pg_isready -U test -d tutor_bank_test >/dev/null 2>&1; then return; fi
    sleep 1
  done
  echo "Postgres did not become ready" >&2
  exit 1
}

wait_for_moto() {
  for _ in $(seq 1 60); do
    if AWS_ACCESS_KEY_ID=dummy AWS_SECRET_ACCESS_KEY=dummy AWS_DEFAULT_REGION=us-east-1 \
      aws dynamodb list-tables --endpoint-url http://127.0.0.1:5001 >/dev/null 2>&1; then return; fi
    sleep 1
  done
  echo "Moto did not become ready" >&2
  exit 1
}

up() {
  if docker inspect "$POSTGRES_NAME" >/dev/null 2>&1; then
    docker start "$POSTGRES_NAME" >/dev/null 2>&1 || true
  else
    docker run -d --name "$POSTGRES_NAME" \
      -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=tutor_bank_test \
      -p 127.0.0.1:5432:5432 postgres:15 >/dev/null
  fi
  if docker inspect "$MOTO_NAME" >/dev/null 2>&1; then
    docker start "$MOTO_NAME" >/dev/null 2>&1 || true
  else
    docker run -d --name "$MOTO_NAME" \
      -p 127.0.0.1:5001:5000 motoserver/moto >/dev/null
  fi
  wait_for_postgres
  wait_for_moto
  DATABASE_URL="$DATABASE_URL" npx prisma db push
}

down() {
  docker stop "$POSTGRES_NAME" "$MOTO_NAME" >/dev/null 2>&1 || true
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  *) echo "Usage: $0 up|down" >&2; exit 2 ;;
esac
