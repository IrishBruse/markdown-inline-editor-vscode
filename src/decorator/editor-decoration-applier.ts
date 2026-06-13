import { DecorationOptions, Range, TextDocument, TextEditor } from 'vscode';
import type { DecorationType, ScopeRange } from '../parser';
import { mapNormalizedToOriginal } from '../position-mapping';
import { config } from '../config';
import type { DecorationTypeRegistry } from './decoration-type-registry';
import type { ScopeEntry } from './visibility-model';

export function createRange(
  editor: TextEditor,
  startPos: number,
  endPos: number,
  originalText?: string
): Range | null {
  try {
    const mappedStart = mapNormalizedToOriginal(startPos, originalText);
    const mappedEnd = mapNormalizedToOriginal(endPos, originalText);
    return new Range(
      editor.document.positionAt(mappedStart),
      editor.document.positionAt(mappedEnd)
    );
  } catch {
    return null;
  }
}

export function buildScopeEntries(
  editor: TextEditor | undefined,
  scopes: ScopeRange[],
  originalText: string
): ScopeEntry[] {
  if (!editor || scopes.length === 0) {
    return [];
  }

  const entries: ScopeEntry[] = [];
  for (const scope of scopes) {
    const range = createRange(editor, scope.startPos, scope.endPos, originalText);
    if (range) {
      entries.push({
        startPos: scope.startPos,
        endPos: scope.endPos,
        range,
        kind: scope.kind,
      });
    }
  }
  return entries;
}

export function isSelectionOrCursorInsideOffsets(
  startPos: number,
  endPos: number,
  normalizedText: string,
  selections: readonly Range[],
  document: TextDocument
): boolean {
  const mappedStart = mapNormalizedToOriginal(startPos, normalizedText);
  const mappedEnd = mapNormalizedToOriginal(endPos, normalizedText);

  return selections.some((selection) => {
    const selectionStart = document.offsetAt(selection.start);
    const selectionEnd = document.offsetAt(selection.end);
    if (selectionStart === selectionEnd) {
      return selectionStart >= mappedStart && selectionStart <= mappedEnd;
    }
    return selectionStart <= mappedEnd && selectionEnd >= mappedStart;
  });
}

function isDecorationOptionsEntry(entry: Range | DecorationOptions): entry is DecorationOptions {
  return typeof entry === 'object' && entry !== null && 'range' in entry;
}

/**
 * VS Code requires setDecorations to receive either Range[] or DecorationOptions[],
 * never a mixed array. Table hide markers use DecorationOptions (space replacement)
 * alongside plain Range hide entries, so normalize when needed.
 */
export function prepareDecorationPayload(
  entries: Array<Range | DecorationOptions> | undefined
): Range[] | DecorationOptions[] {
  if (!entries?.length) {
    return [];
  }
  const hasOptionsEntries = entries.some(isDecorationOptionsEntry);
  if (!hasOptionsEntries) {
    return entries as Range[];
  }
  return entries.map((entry) =>
    isDecorationOptionsEntry(entry) ? entry : { range: entry }
  );
}

export function applyFilteredDecorations(
  editor: TextEditor,
  filteredDecorations: Map<DecorationType, Array<Range | DecorationOptions>>,
  decorationTypes: DecorationTypeRegistry,
  onApply?: (nonEmptyTypeCount: number) => void
): void {
  for (const [type, decorationType] of decorationTypes.getMap().entries()) {
    if (type === 'emoji' && !config.emojis.enabled()) {
      editor.setDecorations(decorationType, []);
      continue;
    }

    editor.setDecorations(
      decorationType,
      prepareDecorationPayload(filteredDecorations.get(type))
    );
  }

  const ghostFaintRanges = (filteredDecorations.get('ghostFaint') as Range[] | undefined) || [];
  editor.setDecorations(decorationTypes.getGhostFaintDecorationType(), ghostFaintRanges);

  if (onApply) {
    const nonEmptyTypeCount = [...filteredDecorations.values()].filter((ranges) => ranges.length > 0).length;
    onApply(nonEmptyTypeCount);
  }
}
