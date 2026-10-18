#!/bin/sh
# Optional Stop hook: if code in src/ changed but CHANGELOG.md did not, ask Claude once to
# write the memory before it stops. It never loops: it steps aside when stop_hook_active is
# true, and it blocks each set of changes only once.
input=$(cat)
printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && exit 0
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
changed=$(git status --porcelain -- src 2>/dev/null)
[ -z "$changed" ] && exit 0
[ -n "$(git status --porcelain -- CHANGELOG.md)" ] && exit 0
key=$(printf '%s' "$changed" | cksum | cut -d' ' -f1)
mark="$(git rev-parse --git-dir)/memory-gate-$key"
[ -f "$mark" ] && exit 0
: > "$mark"
echo "Memory gate: code in src/ changed but CHANGELOG.md did not. Do the Record step (log line, STATE.md, IDEAS.md) before you stop." >&2
exit 2
