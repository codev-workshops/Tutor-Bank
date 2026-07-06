#!/usr/bin/env bash
# UserPromptSubmit hook.
# Scans the submitted prompt for credential-style key/value pairs
# (e.g. `password: hunter2`, `api_key=abc123`, `abc:password`) and blocks
# the submission if any are found, showing a redacted preview instead of the
# raw secret. A hook cannot rewrite the prompt in place, so blocking keeps the
# secret from ever reaching the model.
set -euo pipefail

payload="$(cat)"

PAYLOAD="$payload" node -e '
  let raw = process.env.PAYLOAD || "";
  let prompt = "";
  try {
    const data = JSON.parse(raw || "{}");
    prompt = String(data.prompt || "");
  } catch (_) {
    prompt = "";
  }

  // Words that mark a key or value as sensitive.
  const SECRET = "(?:password|passwd|pwd|pass|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|auth|credentials?|bearer)";

  // Credential-context words that, when present anywhere in the prompt, make
  // even a generic user:pass pair (where neither side is a keyword) suspicious.
  const CONTEXT = "(?:password|passwd|pwd|credentials?|log[\\s-]?in|logon|sign[\\s-]?in|username|user\\s*name)";
  const hasCredContext = new RegExp(CONTEXT, "i").test(prompt);

  // Match key<sep>value where separator is : or = ; capture key, sep, value.
  const re = new RegExp("([\\w.@-]+)\\s*([:=])\\s*(\\S+)", "gi");
  const secretRe = new RegExp(SECRET, "i");

  const findings = [];
  let m;
  while ((m = re.exec(prompt)) !== null) {
    const [, key, sep, value] = m;
    const keywordHit = secretRe.test(key) || secretRe.test(value);
    // Generic user:pass pair: both sides are plain identifiers (letters+digits,
    // no URL-ish content), and the prompt talks about credentials/login.
    const looksLikePair =
      hasCredContext &&
      /^[\w.@-]{2,}$/.test(key) &&
      /^[^\s:/\\]{3,}$/.test(value) &&
      !/^\d+$/.test(value) &&        // skip pure numbers (e.g. times 12:30)
      !/^\/\//.test(value);          // skip protocol-relative / URLs
    if (keywordHit || looksLikePair) {
      const masked = value.length <= 2 ? "**" : value[0] + "*".repeat(Math.max(4, value.length - 1));
      findings.push(key + sep + " " + masked);
    }
  }

  if (findings.length === 0) {
    process.exit(0); // Nothing sensitive; let the prompt through.
  }

  const reason =
    "Blocked by Tutor-Bank sanitise-secrets hook: your message appears to contain " +
    findings.length + " credential(s). Remove or redact them and resend.\n" +
    "Detected (redacted):\n  - " + findings.join("\n  - ");

  process.stderr.write(reason + "\n");
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(2);
'
