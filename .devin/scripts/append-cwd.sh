#!/usr/bin/env bash
# UserPromptSubmit hook.
# Appends the current working directory to the end of the prompt by emitting
# it as `additionalContext` on stdout.
set -euo pipefail

# The user's message is available on stdin as { "prompt": "..." } if needed.
cat >/dev/null 2>&1 || true

context="Current working directory: $(pwd)"

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
