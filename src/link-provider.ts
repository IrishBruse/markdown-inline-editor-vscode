import * as vscode from "vscode";
import type { DecorationRange } from "./parser";
import { MarkdownParseCache } from "./markdown-parse-cache";
import { shouldSkipInDiffView } from "./diff-context";
import {
  createDecorationRange,
  isLinkLikeDecoration,
  resolveInteractionTarget,
  toInteractionUri,
} from "./link-interactions/shared";

/**
 * VS Code rejects DocumentLink ranges where start === end ("Illegal argument: range").
 * Empty image alt (![](url)) yields a zero-width decoration range; expand by one UTF-16 unit.
 */
function rangeIsEmpty(range: vscode.Range): boolean {
  return (
    range.start.line === range.end.line &&
    range.start.character === range.end.character
  );
}

function documentLinkRange(
  document: vscode.TextDocument,
  decoration: DecorationRange,
  normalizedText: string,
): vscode.Range {
  const range = createDecorationRange(document, decoration, normalizedText);
  if (!rangeIsEmpty(range)) {
    return range;
  }
  const startOffset = document.offsetAt(range.start);
  const endOffset = Math.min(startOffset + 1, document.getText().length);
  if (endOffset <= startOffset) {
    return range;
  }
  return new vscode.Range(range.start, document.positionAt(endOffset));
}

/**
 * Provides clickable links and images for markdown documents.
 *
 * This class implements VS Code's DocumentLinkProvider to make markdown links
 * and images clickable. It parses markdown links/images and creates DocumentLink
 * objects that VS Code can render as clickable.
 *
 * - Links: Click to navigate to URL or anchor
 * - Images: Click to open image file in VS Code's image viewer
 *
 * Note: Links inside code blocks are already filtered out by the parser's
 * post-processing filter (filterDecorationsInCodeBlocks), so this provider
 * only receives valid link decorations.
 *
 * However, VS Code's built-in markdown link provider may still detect links using
 * regex patterns and doesn't respect code blocks. If you see links inside code blocks,
 * they are likely from VS Code's built-in provider, not this extension.
 */
export class MarkdownLinkProvider implements vscode.DocumentLinkProvider {
  constructor(private parseCache: MarkdownParseCache) {}

  /**
   * Provides document links for a markdown document.
   *
   * @param document - The text document
   * @param token - Cancellation token
   * @returns Array of DocumentLink objects
   */
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink[]> {
    if (document.languageId !== "markdown") {
      return [];
    }

    // Skip links in diff views when decorations are disabled (raw markdown mode)
    if (shouldSkipInDiffView(document)) {
      return [];
    }

    const parseEntry = this.parseCache.get(document);
    const text = parseEntry.text;
    const decorations = parseEntry.decorations;
    return decorations
      .filter(isLinkLikeDecoration)
      .flatMap((decoration) => {
        const target = resolveInteractionTarget(decoration, document.uri);
        if (!target) {
          return [];
        }

        return [new vscode.DocumentLink(
          documentLinkRange(document, decoration, text),
          toInteractionUri(target)
        )];
      });
  }

  /**
   * Resolves a document link, potentially updating its target.
   *
   * @param link - The document link to resolve
   * @param token - Cancellation token
   * @returns The resolved link
   */
  resolveDocumentLink(
    link: vscode.DocumentLink,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentLink> {
    return link;
  }
}
