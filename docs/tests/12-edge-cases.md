# Edge cases

## Adjacent emphasis

**bold***italic* boundary test.

***triple*** then **bold** *italic*.

## Link inside bold

**See [nested](https://example.com) link**

## Blockquote + list

> - quoted list item
> - second item

## Table adjacent to text

Paragraph directly above table.

| X | Y |
|---|---|
| 1 | 2 |

Paragraph directly below.

## Empty and minimal

#

**

``

## Long line (wrap / performance sniff)

Lorem ipsum dolor sit amet, consectetur adipiscing elit. **bold section** with more text repeated: lorem ipsum dolor sit amet. `code` tail.

## HR next to content

text above
---
text below

---

**Checks**

- No crashes or stuck decorations on malformed/minimal tokens.
- Nested constructs pick correct innermost raw scope.
- Large files: duplicate this paragraph many times only when testing perf.
