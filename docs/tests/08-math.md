# LaTeX / math

Requires `markdownInlineEditor.math.enabled` (default on).

## Inline

Einstein: $E = mc^2$ in a sentence.

Two inline: $a^2$ and $b^2$ on one line.

## Display (dollar block)

$$
\int_0^\infty e^{-x^2}\, dx = \frac{\sqrt{\pi}}{2}
$$

## Fenced math

```math
\begin{align}
a &= b + c \\
d &= e
\end{align}
```

## Next to code

`$x$` inline then:

```math
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
```

---

**Checks**

- Inline `$...$` renders in place.
- `$$...$$` block renders as display math.
- `` ```math `` fence renders like display math.
- Invalid TeX should fail gracefully (no editor crash).
