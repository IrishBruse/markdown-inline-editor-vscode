# Text formatting

## Basic emphasis

**bold** and *italic* and ***bold italic*** on one line.

__bold underscore__ and _italic underscore_ variants.

~~strikethrough~~ and `inline code` in a sentence.

## Mixed on one line

Start **bold with *italic inside* bold** end.

`code with **not bold** inside` should stay literal in source.

## Emoji shortcodes

:smile: :rocket: :+1: :tada: (requires `markdownInlineEditor.emojis.enabled`)

## Escaping (usually no decoration)

\*not bold\* \`not code\` \~\~not strike\~\~

---

**Checks**

- Click inside `**bold**`: full marker visible (raw).
- Cursor on line but outside construct: ghost markers on that line only.
- Emoji render as glyphs when enabled.
