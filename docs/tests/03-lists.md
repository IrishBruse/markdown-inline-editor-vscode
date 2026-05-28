# Lists

## Unordered

- Item A
- Item B
  - Nested B1
  - Nested B2
- Item C

* asterisk style
+ plus style

## Ordered (dot) - lazy 1. markers

1. First
1. Second
1. Third

## Ordered (parenthesis)

1) Alpha
1) Beta
1) Gamma

## Source number mismatch (warn highlight when enabled)

5. Starts at five
1. Should show as six
1. Should show as seven

## Task lists

- [ ] Unchecked
- [x] Checked
- [ ] Click checkbox to toggle (extension command)

## Ordered + tasks

1. [ ] Ordered task open
2. [x] Ordered task done

## Nested ordered

1. Outer
   1. Inner A
   1. Inner B
1. Outer again

---

**Checks**

- Ordered markers auto-number (default) vs source numbers (`orderedLists.autoNumber`).
- List markers stay rendered on active line until you click the marker.
- Checkbox click toggles `[ ]` / `[x]` in file.
