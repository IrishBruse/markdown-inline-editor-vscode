# Mermaid diagrams

Diagrams render inline in the editor (may take a moment on first paint).

## Flowchart

```mermaid
flowchart TD
  Start([Start]) --> Choice{OK?}
  Choice -->|yes| Done([Done])
  Choice -->|no| Retry[Retry]
  Retry --> Start
```

## Sequence

```mermaid
sequenceDiagram
  participant U as User
  participant E as Extension
  U->>E: Open .md file
  E-->>U: Inline decorations
```

## Simple graph

```mermaid
graph LR
  A[Parser] --> B[Decorator]
  B --> C[VS Code API]
```

---

**Checks**

- Diagram visible without opening preview.
- Cursor in mermaid block: raw fence + source visible.
- Activity bar **Markdown Inline** entry is the hidden Mermaid host (can ignore).
