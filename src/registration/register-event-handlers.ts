import * as vscode from 'vscode';
import { config, configAffectsConfiguration } from '../config';
import { Decorator } from '../decorator';
import { LinkClickHandler } from '../link-click-handler';

const MERMAID_VIEWPORT_REFRESH_MS = 150;
let mermaidViewportRefreshTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleMermaidViewportRefresh(decorator: Decorator): void {
  if (mermaidViewportRefreshTimer) {
    clearTimeout(mermaidViewportRefreshTimer);
  }
  mermaidViewportRefreshTimer = setTimeout(() => {
    mermaidViewportRefreshTimer = undefined;
    decorator.clearMermaidDecorationCache();
  }, MERMAID_VIEWPORT_REFRESH_MS);
}

export function registerEventHandlers(
  decorator: Decorator,
  linkClickHandler: LinkClickHandler
): vscode.Disposable[] {
  return [
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      decorator.setActiveEditor(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      decorator.updateDecorationsForSelection(event.kind);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        decorator.updateDecorationsFromChange(event);
      }
    }),
    vscode.workspace.onDidRenameFiles((event) => {
      for (const { oldUri, newUri } of event.files) {
        decorator.renameFile(oldUri.toString(), newUri.toString());
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (configAffectsConfiguration(event, 'defaultBehaviors.diffView.applyDecorations')) {
        const diffViewApplyDecorations = config.diffView.applyDecorations();
        decorator.updateDiffViewDecorationSetting(!diffViewApplyDecorations);
        decorator.refreshDecorations();
      }

      if (configAffectsConfiguration(event, 'decorations.ghostFaintOpacity')) {
        decorator.recreateGhostFaintDecorationType();
      }

      if (configAffectsConfiguration(event, 'decorations.ghostLinks.collapse')) {
        decorator.updateDecorationsForSelection();
      }

      if (configAffectsConfiguration(event, 'decorations.frontmatterDelimiterOpacity')) {
        decorator.recreateFrontmatterDelimiterDecorationType();
      }

      if (configAffectsConfiguration(event, 'decorations.codeBlockLanguageOpacity')) {
        decorator.recreateCodeBlockLanguageDecorationType();
      }

      if (configAffectsConfiguration(event, 'links.singleClickOpen')) {
        linkClickHandler.setEnabled(config.links.singleClickOpen());
      }

      if (configAffectsConfiguration(event, 'links.showEmoji')) {
        decorator.recreateLinkDecorationType();
      }

      if (configAffectsConfiguration(event, 'tables.forceRaw')) {
        decorator.updateDecorationsForSelection();
      }

      if (configAffectsConfiguration(event, 'colors')) {
        decorator.recreateColorDependentTypes();
      }

      if (event.affectsConfiguration('editor.fontSize') || event.affectsConfiguration('editor.lineHeight')) {
        decorator.clearMathDecorationCache();
      }

      if (
        event.affectsConfiguration('markdownInlineEditor.mermaid.maxWidthColumns') ||
        event.affectsConfiguration('editor.fontSize')
      ) {
        decorator.clearMermaidDecorationCache();
      }
    }),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (event.textEditor === vscode.window.activeTextEditor) {
        scheduleMermaidViewportRefresh(decorator);
      }
    }),
    vscode.window.onDidChangeWindowState(() => {
      scheduleMermaidViewportRefresh(decorator);
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      decorator.recreateColorDependentTypes();
    }),
  ];
}
