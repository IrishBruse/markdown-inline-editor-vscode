import { ColorThemeKind, Range, ThemeColor, window, type DecorationOptions, type Position, type TextEditor } from 'vscode';
import type { DecorationRange, DecorationType } from '../parser';
import { config } from '../config';
import { isMarkerDecorationType } from './decoration-categories';
import { DECORATION_DEBUG, dbgDecoration } from './debug-decoration-trace';

export type ScopeEntry = {
  startPos: number;
  endPos: number;
  range: Range;
  kind?: string;
};

type RangeFactory = (startPos: number, endPos: number, originalText: string) => Range | null;
type FilteredDecoration = Range | DecorationOptions;

function isValidPosition(position: Position | undefined): position is Position {
  return position !== undefined && typeof position.line === 'number' && typeof position.character === 'number';
}

function positionBeforeOrEqual(a: Position, b: Position): boolean {
  return a.line < b.line || (a.line === b.line && a.character <= b.character);
}

function isValidRange(range: Range | undefined | null): range is Range {
  return (
    range !== undefined &&
    range !== null &&
    isValidPosition(range.start) &&
    isValidPosition(range.end) &&
    positionBeforeOrEqual(range.start, range.end)
  );
}

function safeIntersection(a: Range, b: Range): Range | undefined {
  if (!isValidRange(a) || !isValidRange(b)) {
    return undefined;
  }
  try {
    return a.intersection(b);
  } catch {
    return undefined;
  }
}

function safeContains(range: Range, position: Position): boolean {
  if (!isValidRange(range) || !isValidPosition(position)) {
    return false;
  }
  try {
    return range.contains(position);
  } catch {
    return false;
  }
}

export function filterDecorationsForEditor(
  editor: TextEditor,
  decorations: DecorationRange[],
  scopes: ScopeEntry[],
  originalText: string,
  rangeFactory: RangeFactory
): Map<DecorationType, FilteredDecoration[]> {
  const selectedRanges: Range[] = [];
  const cursorPositions: Position[] = [];
  const activeLines = new Set<number>(); // Lines with selections or cursors
  const safeScopes = scopes.filter((scope) => isValidRange(scope.range));

  for (const selection of editor.selections) {
    const selectionStart = isValidPosition(selection.start)
      ? selection.start
      : isValidPosition((selection as { active?: Position }).active)
        ? (selection as { active: Position }).active
        : undefined;
    const selectionEnd = isValidPosition(selection.end)
      ? selection.end
      : selectionStart;
    if (!isValidPosition(selectionStart) || !isValidPosition(selectionEnd)) {
      continue;
    }
    const normalizedSelection = new Range(selectionStart, selectionEnd);
    if (!selection.isEmpty) {
      selectedRanges.push(normalizedSelection);
      // Add all lines in the selection to activeLines
      for (let line = selectionStart.line; line <= selectionEnd.line; line++) {
        activeLines.add(line);
      }
    } else {
      cursorPositions.push(selectionStart);
      activeLines.add(selectionStart.line);
    }
  }

  const rawRanges = mergeRanges([
    ...collectRawRanges(selectedRanges, safeScopes),
    ...collectCursorScopeRanges(cursorPositions, safeScopes),
  ]);

  if (DECORATION_DEBUG) {
    const cursorScopeKinds = safeScopes
      .filter((scope) =>
        cursorPositions.some((position) => {
          if (!isValidPosition(position) || !isValidRange(scope.range)) {
            return false;
          }
          return (
            safeContains(scope.range, position) ||
            (position.line === scope.range.start.line &&
              position.character === scope.range.start.character) ||
            (position.line === scope.range.end.line &&
              position.character === scope.range.end.character)
          );
        }),
      )
      .map((scope) => scope.kind ?? 'none');
    dbgDecoration('visibility rawRanges', {
      rawRangeCount: rawRanges.length,
      scopeCount: safeScopes.length,
      cursorLines: [...activeLines],
      cursorScopeKinds,
    });
  }

  const debugSkip = DECORATION_DEBUG
    ? {
        rangeNull: 0,
        headingActiveLine: 0,
        hideRaw: 0,
        hideGhost: 0,
        hideApplied: 0,
        markerRaw: 0,
        markerGhost: 0,
        cursorLineSamples: [] as Array<Record<string, unknown>>,
      }
    : undefined;

  const selectionOnlyMarkerTypes = new Set<DecorationType>([
    'blockquote',
    'listItem',
    'orderedListItem',
    'checkboxUnchecked',
    'checkboxChecked',
  ]);
  const headingTypes = new Set<DecorationType>([
    'heading',
    'heading1',
    'heading2',
    'heading3',
    'heading4',
    'heading5',
    'heading6',
  ]);
  const headingMarkerEndPositions = new Set<number>();
  for (const decoration of decorations) {
    if (headingTypes.has(decoration.type)) {
      headingMarkerEndPositions.add(decoration.startPos);
    }
  }

  const tableTypes = new Set<DecorationType>([
    'tablePipe', 'tableSeparatorPipe', 'tableSeparatorDash', 'tableCell', 'tableCellImage',
  ]);

  const tablesForceRaw = config.tables.forceRaw();

  const tableScopes = safeScopes.filter((scope) => scope.kind === 'table');
  const rawTableRanges: Range[] = [];
  if (!tablesForceRaw) {
    for (const tableScope of tableScopes) {
      let tableIsActive = false;
      for (let line = tableScope.range.start.line; line <= tableScope.range.end.line; line++) {
        if (activeLines.has(line)) {
          tableIsActive = true;
          break;
        }
      }
      if (tableIsActive) {
        rawTableRanges.push(tableScope.range);
      }
    }
  }

  const paddedTableCellRanges: Range[] = [];
  for (const decoration of decorations) {
    if (decoration.type !== 'tableCell' && decoration.type !== 'tableCellImage') {
      continue;
    }
    const cellRange = rangeFactory(decoration.startPos, decoration.endPos, originalText);
    if (cellRange) {
      paddedTableCellRanges.push(cellRange);
    }
  }

  const tableCellInlineConflictTypes = new Set<DecorationType>([
    'bold', 'italic', 'boldItalic', 'hide', 'code', 'transparent', 'strikethrough', 'link', 'image',
  ]);

  const filtered = new Map<DecorationType, FilteredDecoration[]>();
  const ghostFaintRanges: Range[] = [];
  const selectionOverlayRanges: Range[] = [];

  const selectionOrCursorOverlaps = (range: Range): boolean => {
    const selectionOverlaps = selectedRanges.some((selection) => {
      return safeIntersection(range, selection) !== undefined;
    });
    if (selectionOverlaps) {
      return true;
    }
    return cursorPositions.some((position) => safeContains(range, position));
  };

  for (const decoration of decorations) {
    const range = rangeFactory(decoration.startPos, decoration.endPos, originalText);
    if (!range) {
      debugSkip && debugSkip.rangeNull++;
      continue;
    }
    const isActiveLine = activeLines.size > 0 && activeLines.has(range.start.line);

    if (
      tableCellInlineConflictTypes.has(decoration.type) &&
      paddedTableCellRanges.some((cellRange) => safeIntersection(range, cellRange) !== undefined)
    ) {
      continue;
    }

    // Code blocks and frontmatter use opaque, whole-line backgrounds.
    // On some themes, VS Code's native selection highlight is drawn "under" those
    // backgrounds, making selections appear invisible. We keep the background,
    // but add an explicit selection overlay decoration on top for the intersection.
    if ((decoration.type === 'codeBlock' || decoration.type === 'frontmatter') && selectedRanges.length > 0) {
      for (const selection of selectedRanges) {
        const intersection = safeIntersection(range, selection);
        if (intersection !== undefined) {
          selectionOverlayRanges.push(intersection);
        }
      }
    }

    if (selectionOnlyMarkerTypes.has(decoration.type)) {
      if (selectionOrCursorOverlaps(range)) {
        // Raw state: show actual marker characters
        continue;
      }
      // Rendered state: apply marker decorations even on active lines
      const ranges = filtered.get(decoration.type) || [];
      if (decoration.replacement) {
        const beforeOpts: Record<string, unknown> = {
          contentText: decoration.replacement,
        };
        if (decoration.orderedListMarkerMismatch) {
          beforeOpts.color = new ThemeColor('editorWarning.foreground');
        }
        ranges.push({
          range,
          renderOptions: {
            before: beforeOpts,
          },
        });
      } else {
        ranges.push(range);
      }
      filtered.set(decoration.type, ranges);
      continue;
    }

    if (headingTypes.has(decoration.type) && isActiveLine) {
      debugSkip && debugSkip.headingActiveLine++;
      // Show raw heading text (no heading styling) on active lines
      continue;
    }

    if (decoration.type === 'hide' || decoration.type === 'transparent') {
      const intersectsRaw = rangeIntersectsAny(range, rawRanges);
      const isHeadingMarkerHide = decoration.type === 'hide' &&
        headingMarkerEndPositions.has(decoration.endPos);

      if (intersectsRaw) {
        debugSkip && debugSkip.hideRaw++;
        if (debugSkip && isActiveLine && debugSkip.cursorLineSamples.length < 12) {
          debugSkip.cursorLineSamples.push({
            type: decoration.type,
            reason: 'intersectsRaw',
            startPos: decoration.startPos,
            endPos: decoration.endPos,
            snippet: originalText.slice(decoration.startPos, decoration.endPos),
          });
        }
        // Raw state: skip (show actual syntax)
        continue;
      }
      if (isHeadingMarkerHide && isActiveLine) {
        // Show heading markers on active lines
        continue;
      }
      if (isActiveLine) {
        debugSkip && debugSkip.hideGhost++;
        if (debugSkip && debugSkip.cursorLineSamples.length < 12) {
          debugSkip.cursorLineSamples.push({
            type: decoration.type,
            reason: 'activeLineGhost',
            startPos: decoration.startPos,
            endPos: decoration.endPos,
            snippet: originalText.slice(decoration.startPos, decoration.endPos),
          });
        }
        // Ghost state: show faint markers on active lines
        ghostFaintRanges.push(range);
        continue;
      }
      // Rendered state: hide markers normally. Inside tables without padded cell
      // replacement, use transparent so marker chars stay in the monospace layout.
      const ranges = filtered.get(decoration.type) || [];
      if (
        decoration.type === 'hide' &&
        isInsideTableScopeWithoutPaddedCell(range, tableScopes, paddedTableCellRanges)
      ) {
        const transparentRanges = filtered.get('transparent') || [];
        transparentRanges.push(range);
        filtered.set('transparent', transparentRanges);
      } else {
        debugSkip && debugSkip.hideApplied++;
        ranges.push(range);
        filtered.set(decoration.type, ranges);
      }
      continue;
    }

    if (decoration.type === 'emoji') {
      const intersectsRaw = rangeIntersectsAny(range, rawRanges);
      if (intersectsRaw) {
        // Raw state: show actual shortcode
        continue;
      }

      if (decoration.emoji) {
        const ranges = filtered.get(decoration.type) || [];
        ranges.push({
          range,
          renderOptions: {
            before: {
              contentText: decoration.emoji,
            },
          },
        });
        filtered.set(decoration.type, ranges);
      }
      continue;
    }

    if (tableTypes.has(decoration.type)) {
      if (tablesForceRaw || rangeIntersectsAny(range, rawTableRanges)) {
        continue;
      }
      if (decoration.replacement !== undefined) {
        const ranges = filtered.get(decoration.type) || [];
        const beforeOpts: Record<string, unknown> = {
          contentText: decoration.replacement,
        };
        if (decoration.cellStyle) {
          if (decoration.cellStyle.fontWeight) beforeOpts.fontWeight = decoration.cellStyle.fontWeight;
          if (decoration.cellStyle.fontStyle) beforeOpts.fontStyle = decoration.cellStyle.fontStyle;
          if (decoration.cellStyle.textDecoration) beforeOpts.textDecoration = decoration.cellStyle.textDecoration;
          if (decoration.cellStyle.inlineCode) {
            Object.assign(beforeOpts, inlineCodeTableCellBeforeStyle());
          }
          if (decoration.cellStyle.link) {
            Object.assign(beforeOpts, inlineLinkTableCellBeforeStyle());
          }
        }
        ranges.push({
          range,
          renderOptions: {
            before: beforeOpts,
          },
        });
        filtered.set(decoration.type, ranges);
      }
      continue;
    }

    if (isMarkerDecorationType(decoration.type)) {
      const intersectsRaw = rangeIntersectsAny(range, rawRanges);

      if (intersectsRaw) {
        debugSkip && debugSkip.markerRaw++;
        // Raw state: skip marker decorations (show actual syntax)
        continue;
      }
      if (isActiveLine) {
        debugSkip && debugSkip.markerGhost++;
        // Ghost state: show faint markers on active lines
        ghostFaintRanges.push(range);
        continue;
      }
      // Rendered state: apply marker decorations normally
    }

    // Add to appropriate type array
    const ranges = filtered.get(decoration.type) || [];
    ranges.push(range);
    filtered.set(decoration.type, ranges);
  }

  if (ghostFaintRanges.length > 0) {
    filtered.set('ghostFaint', ghostFaintRanges);
  }

  if (selectionOverlayRanges.length > 0) {
    filtered.set('selectionOverlay', mergeRanges(selectionOverlayRanges));
  }

  if (debugSkip) {
    dbgDecoration('visibility skip summary', debugSkip);
  }

  return filtered;
}

function collectRawRanges(selectedRanges: Range[], scopes: ScopeEntry[]): Range[] {
  if (selectedRanges.length === 0 || scopes.length === 0) {
    return [];
  }

  const rawRanges: Range[] = [];
  for (const selection of selectedRanges) {
    if (!isValidRange(selection)) {
      continue;
    }
    for (const scope of scopes) {
      if (!isValidRange(scope.range)) {
        continue;
      }
      const intersection = safeIntersection(selection, scope.range);
      if (intersection !== undefined) {
        rawRanges.push(scope.range);
      }
    }
  }

  return rawRanges;
}

function collectCursorScopeRanges(cursorPositions: Position[], scopes: ScopeEntry[]): Range[] {
  if (cursorPositions.length === 0 || scopes.length === 0) {
    return [];
  }

  const cursorRanges: Range[] = [];
  for (const position of cursorPositions) {
    if (!isValidPosition(position)) {
      continue;
    }
    // Check if cursor is inside scope or at its boundaries (start or end)
    // Range.contains() uses exclusive end, so we also check if position equals start or end
    const matchingScopes = scopes.filter((scope) => {
      if (!isValidRange(scope.range)) {
        return false;
      }
      const isInside = safeContains(scope.range, position);
      const isAtStart = position.line === scope.range.start.line &&
                        position.character === scope.range.start.character;
      const isAtEnd = position.line === scope.range.end.line &&
                      position.character === scope.range.end.character;
      return isInside || isAtStart || isAtEnd;
    });

    if (matchingScopes.length === 0) {
      continue;
    }

    const smallestScope = matchingScopes.reduce((smallest, scope) => {
      if (!smallest) {
        return scope;
      }
      const smallestLength = smallest.endPos - smallest.startPos;
      const scopeLength = scope.endPos - scope.startPos;
      return scopeLength < smallestLength ? scope : smallest;
    }, undefined as ScopeEntry | undefined);

    if (smallestScope && isValidRange(smallestScope.range)) {
      cursorRanges.push(smallestScope.range);
    }
  }

  return cursorRanges;
}

function positionAfterOrEqual(a: Position, b: Position): boolean {
  return a.line > b.line || (a.line === b.line && a.character >= b.character);
}

function positionAfter(a: Position, b: Position): boolean {
  return a.line > b.line || (a.line === b.line && a.character > b.character);
}

function mergeRanges(ranges: Range[]): Range[] {
  const validRanges = ranges.filter(isValidRange);
  if (validRanges.length === 0) {
    return [];
  }

  const sorted = [...validRanges].sort((a, b) => {
    if (a.start.line !== b.start.line) {
      return a.start.line - b.start.line;
    }
    return a.start.character - b.start.character;
  });

  const merged: Range[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (
      positionBeforeOrEqual(current.start, last.end) &&
      positionAfterOrEqual(current.end, last.start)
    ) {
      merged[merged.length - 1] = new Range(
        last.start,
        positionAfter(current.end, last.end) ? current.end : last.end
      );
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function isInsideTableScopeWithoutPaddedCell(
  range: Range,
  tableScopes: ScopeEntry[],
  paddedTableCellRanges: Range[],
): boolean {
  if (!isValidRange(range)) {
    return false;
  }
  const insideTable = tableScopes.some((scope) => {
    if (!isValidRange(scope.range)) {
      return false;
    }
    return safeIntersection(range, scope.range) !== undefined
      || safeContains(scope.range, range.start);
  });
  if (!insideTable) {
    return false;
  }
  return !paddedTableCellRanges.some((cellRange) => safeIntersection(range, cellRange) !== undefined);
}

/** Matches {@link CodeDecorationType} defaults for tableCell inline-code cells. */
function inlineCodeTableCellBeforeStyle(): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  const color = config.colors.inlineCode();
  const backgroundColor = config.colors.inlineCodeBackground();
  opts.color = color ?? new ThemeColor('textPreformat.foreground');
  if (backgroundColor) {
    opts.backgroundColor = backgroundColor;
  } else {
    const themeKind = window.activeColorTheme.kind;
    const isDark = themeKind === ColorThemeKind.Dark || themeKind === ColorThemeKind.HighContrast;
    opts.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  }
  return opts;
}

/** Link-colored table cells: no underline so padding NBSPs stay clean. */
function inlineLinkTableCellBeforeStyle(): Record<string, unknown> {
  const color = config.colors.link();
  return {
    color: color ?? new ThemeColor('textLink.foreground'),
    cursor: 'pointer',
    textDecoration: 'none',
  };
}

function rangeIntersectsAny(range: Range, ranges: Range[]): boolean {
  if (!isValidRange(range)) {
    return false;
  }
  return ranges.some((candidate) => {
    if (!isValidRange(candidate)) {
      return false;
    }
    if (safeContains(candidate, range.start)) {
      return true;
    }
    const intersection = safeIntersection(range, candidate);
    return intersection !== undefined;
  });
}
