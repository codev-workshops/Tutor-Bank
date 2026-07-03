#!/usr/bin/env bash
# PreToolUse hook for the `exec` tool.
# Reads the hook event JSON on stdin and blocks commands that are dangerous
# or that violate Tutor-Bank conventions. Exit code 2 blocks the tool call;
# the message on stderr is shown to the agent.
set -euo pipefail

payload="$(cat)"

# Extract the command string from tool_input without extra dependencies.
command_str="$(printf '%s' "$payload" | node -e '
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    try {
      const data = JSON.parse(raw || "{}");
      process.stdout.write(String((data.tool_input && data.tool_input.command) || ""));
    } catch (_) {
      process.stdout.write("");
    }
  });
')"

block() {
  echo "Blocked by Tutor-Bank guard-exec hook: $1" >&2
  exit 2
}

# Destructive filesystem / VCS operations.
if printf '%s' "$command_str" | grep -Eq 'rm[[:space:]]+(-[a-zA-Z]*\s+)*-?[rf]'; then
  block "recursive/forced 'rm' is not allowed. Delete files explicitly instead."
fi
if printf '%s' "$command_str" | grep -Eq 'git[[:space:]]+push[[:space:]].*(--force|-f)([[:space:]]|$)'; then
  block "force-pushing is not allowed."
fi
if printf '%s' "$command_str" | grep -Eq 'git[[:space:]]+push[[:space:]].+\b(main|master)\b'; then
  block "pushing directly to main/master is not allowed. Open a PR."
fi

# Project convention: never edit the auto-generated Prisma client by hand.
if printf '%s' "$command_str" | grep -Eq 'src/generated/'; then
  block "src/generated/ is the auto-generated Prisma client. Change prisma/schema.prisma and regenerate instead."
fi

# Allow everything else.
exit 0
