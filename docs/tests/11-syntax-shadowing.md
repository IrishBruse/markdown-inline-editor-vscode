# Syntax shadowing exercises

Use this file to verify **Rendered -> Ghost -> Raw** behavior.

## Exercise A - bold on its own line

**only bold here**

1. Cursor on another line: line looks fully rendered (no `**`).
2. Cursor on this line, outside the word: faint `**` ghost markers.
3. Cursor inside `bold`: full `**bold**` visible.

## Exercise B - link

[click me](https://example.com)

1. Ghost: cursor on line, not inside brackets.
2. Raw: cursor inside `[click me]` or `(url)`.

## Exercise C - list marker vs body

- list item text

1. Cursor on line in `text`: marker may stay rendered.
2. Click on `-` or bullet: marker goes raw.

## Exercise D - table (whole table raw)

| A | B |
|---|---|
| 1 | 2 |

1. Cursor in any cell: all pipes and cell text show source.
2. Cursor outside table: grid rendering returns.

## Exercise E - heading

### Shadow test heading

1. On this line: `#` visible, heading style may drop.
2. Off this line: styled heading, hidden `#`.

---

**Settings:** `markdownInlineEditor.decorations.ghostFaintOpacity` (try `0.5` if ghosts are hard to see).
