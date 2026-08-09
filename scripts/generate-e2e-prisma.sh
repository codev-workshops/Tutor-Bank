#!/usr/bin/env bash
set -euo pipefail

rm -rf .e2e-schema .e2e-generated
mkdir -p .e2e-schema
sed \
  -e 's/provider = "prisma-client"/provider = "prisma-client-js"/' \
  -e '/^[[:space:]]*engineType[[:space:]]*=/d' \
  -e 's#output   = "../src/generated/prisma"#output   = "../.e2e-generated"#' \
  prisma/schema.prisma > .e2e-schema/schema.prisma
npx prisma generate --schema .e2e-schema/schema.prisma
