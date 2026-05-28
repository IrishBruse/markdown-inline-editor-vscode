# Mentions and issue references

Requires `markdownInlineEditor.mentions.enabled` (default on).

## Users

Hey @octocat and @user-name - review this.

Not mentions: @-bad, @user_name (underscore), email@domain.com

## Issues

Fixes #42 and #999 on the same line.

## Team

cc @my-org/platform-team for infra.

## Repo-scoped

See @SeardnaSchmid/markdown-inline-editor-vscode#1 for tracking.

## Inside code (should NOT decorate)

```
@ghost inside fence
```

Inline `@ghost` in backticks.

---

**Checks**

- Mentions styled; optional links when `mentions.linksEnabled` or git remote infers repo.
- No false positive on emails or `@user_name`.
- Code blocks suppress mention detection.
