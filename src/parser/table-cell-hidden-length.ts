import type {
  Delete,
  Emphasis,
  Image,
  InlineCode,
  Link,
  Node,
  Strong,
  TableCell,
  Text,
} from 'mdast';
import { getItalicMarker, hasValidPosition } from './common';

function strongDelimiterRunLength(source: string, strongStart: number): number {
  const marker = source[strongStart];
  if (marker === undefined) {
    return 0;
  }
  let len = 0;
  while (source[strongStart + len] === marker) {
    len++;
  }
  return len;
}

/**
 * Characters hidden by image decorations (markers and URL), excluding alt text.
 * Used with table native-column width math; must stay aligned with image decoration ranges.
 */
export function countImageSyntaxHiddenLength(node: Image, source: string): number {
  if (!hasValidPosition(node)) {
    return 0;
  }
  const start = node.position!.start.offset!;
  const end = node.position!.end.offset!;
  const exclamationStart = source.indexOf('![', start);
  if (exclamationStart === -1 || exclamationStart > start) {
    return 0;
  }
  let n = 2;
  const altStart = exclamationStart + 2;
  const bracketEnd = source.indexOf(']', altStart);
  if (bracketEnd === -1) {
    return n;
  }
  n += 1;
  const parenStart = source.indexOf('(', bracketEnd);
  if (parenStart === -1) {
    return n;
  }
  const between = source.substring(bracketEnd + 1, parenStart);
  const hasOnlyWhitespaceBetween =
    between.length > 0 && between.trim().length === 0;
  if (parenStart !== bracketEnd + 1 && !hasOnlyWhitespaceBetween) {
    return n;
  }
  if (hasOnlyWhitespaceBetween) {
    n += parenStart - (bracketEnd + 1);
  }
  n += 1;
  const parenEnd = source.indexOf(')', parenStart + 1);
  if (parenEnd === -1 || parenEnd > end) {
    return n;
  }
  const urlStart = parenStart + 1;
  if (urlStart < parenEnd) {
    n += parenEnd - urlStart;
  }
  n += 1;
  return n;
}

/**
 * Counts source characters inside a table cell that decorations hide, for native-cell
 * column width math. Keep in sync with inline hide rules in the main parser.
 */
export function countHiddenMarkerLength(cell: TableCell, source: string): number {
  let total = 0;
  const walk = (node: Node, ancestors: Node[]): void => {
    switch (node.type) {
      case 'strong': {
        const start = node.position?.start.offset;
        if (start !== undefined && source[start] !== undefined) {
          const run = strongDelimiterRunLength(source, start);
          if (run > 0) {
            total += run * 2;
          }
        }
        const strongNode = node as Strong;
        ancestors.push(node);
        strongNode.children.forEach((ch) => walk(ch, ancestors));
        ancestors.pop();
        return;
      }
      case 'emphasis': {
        const em = node as Emphasis;
        const start = em.position?.start.offset;
        const end = em.position?.end.offset;
        if (start !== undefined && end !== undefined) {
          const marker = getItalicMarker(source, start);
          if (marker) {
            const markerLength = marker.length;
            const parentStrong = ancestors.find((a) => a.type === 'strong');
            if (
              parentStrong?.position?.start?.offset !== undefined &&
              parentStrong.position.end?.offset !== undefined
            ) {
              const strongStart = parentStrong.position.start.offset;
              const strongEnd = parentStrong.position.end.offset;
              const strongRun = strongDelimiterRunLength(
                source,
                strongStart,
              );
              if (
                strongRun > 0 &&
                start === strongStart + strongRun &&
                end === strongEnd - strongRun
              ) {
                ancestors.push(node);
                em.children.forEach((ch) => walk(ch, ancestors));
                ancestors.pop();
                return;
              }
            }
            total += markerLength * 2;
          }
        }
        ancestors.push(node);
        em.children.forEach((ch) => walk(ch, ancestors));
        ancestors.pop();
        return;
      }
      case 'delete': {
        const del = node as Delete;
        const start = del.position?.start.offset;
        const end = del.position?.end.offset;
        if (
          start === undefined ||
          end === undefined ||
          start + 1 >= source.length ||
          source[start] !== '~' ||
          source[start + 1] !== '~' ||
          end < 2 ||
          source[end - 2] !== '~' ||
          source[end - 1] !== '~'
        ) {
          del.children.forEach((ch) => walk(ch, ancestors));
          return;
        }
        total += 4;
        ancestors.push(node);
        del.children.forEach((ch) => walk(ch, ancestors));
        ancestors.pop();
        return;
      }
      case 'inlineCode': {
        const ic = node as InlineCode;
        const start = ic.position?.start.offset;
        const end = ic.position?.end.offset;
        if (start === undefined || end === undefined) {
          return;
        }
        const span = end - start;
        const innerLen = ic.value.length;
        if (span > innerLen) {
          total += span - innerLen;
        }
        return;
      }
      case 'link': {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        if (start === undefined || end === undefined) return;
        if (source[start] === '<' && source[end - 1] === '>') {
          total += 2;
          return;
        }
        const linkNode = node as Link;
        const firstChild = linkNode.children?.[0];
        const linkText =
          firstChild && firstChild.type === 'text'
            ? (firstChild as Text).value
            : '';
        const url = linkNode.url || '';
        const urlNoMail = url.replace(/^mailto:/, '');
        if (linkText === url || linkText === urlNoMail) {
          return;
        }
        const bracketStart = source.indexOf('[', start);
        const bracketEnd = source.indexOf(']', bracketStart);
        if (bracketStart === -1 || bracketEnd === -1 || bracketEnd >= end)
          return;
        total += 2;
        const parenStart = bracketEnd + 1;
        if (source[parenStart] === '(') {
          const parenEnd = source.indexOf(')', parenStart + 1);
          if (parenEnd !== -1 && parenEnd < end) {
            total += parenEnd - parenStart + 1;
          }
        }
        (linkNode.children || []).forEach((ch) => walk(ch, ancestors));
        return;
      }
      case 'image': {
        total += countImageSyntaxHiddenLength(node as Image, source);
        return;
      }
      default: {
        const asParent = node as { children?: Node[] };
        if (asParent.children) {
          asParent.children.forEach((ch) => walk(ch, ancestors));
        }
      }
    }
  };
  cell.children.forEach((ch) => walk(ch, []));
  return total;
}
