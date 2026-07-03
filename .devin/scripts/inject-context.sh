#!/usr/bin/env bash
# UserPromptSubmit hook.
# Runs whenever a user submits a message and injects always-on Tutor-Bank
# context into the agent by printing `additionalContext` on stdout.
set -euo pipefail

# The user's message is available on stdin as { "prompt": "..." } if needed.
cat >/dev/null 2>&1 || true

context=$(cat <<'CTX'
Tutor-Bank reminders:
- Next.js 16.2 has breaking changes; read node_modules/next/dist/docs/ before writing route handlers.
- API routes use Web Request/Response APIs (not Express-style). Every new route needs tests in src/__tests__/api/.
- Never use localStorage; use NextAuth server-side sessions. Validate inputs and roles in protected routes.
- Use Prisma transactions for multi-step DB operations. Prisma is mocked globally in jest.setup.js.
- Run `npm run lint` and `npm test` before considering a task complete.
CTX
)

# Emit context as JSON so the agent ingests it, escaping via node for safety.
CONTEXT="$context" node -e '
  const ctx = process.env.CONTEXT || "";
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ctx
    }
  }));
'
