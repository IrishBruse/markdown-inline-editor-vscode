import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import WebSocket from 'ws';

const VISUAL_E2E_ENABLED = process.env.MD_INLINE_VISUAL_E2E === '1'
  || process.env.UPDATE_VISUAL_BASELINES === '1';
const UPDATE_BASELINES = process.env.UPDATE_VISUAL_BASELINES === '1';
const REMOTE_DEBUGGING_PORT = Number(process.env.VSCODE_REMOTE_DEBUGGING_PORT ?? '9333');
const EXTENSION_ID = 'CodeSmith.markdown-inline-editor-vscode';
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'src/test/e2e/fixtures/tables-visual');
const BASELINE_DIR = path.join(REPO_ROOT, 'src/test/e2e/visual-baselines');
const OUTPUT_DIR = path.join(REPO_ROOT, 'dist/visual-regression');
const TABLE_STATE_POLL_MS = 100;
const TABLE_STATE_TIMEOUT_MS = 5000;

type TableVisualMode = 'rendered' | 'raw';

type TableVisualScenario = {
  /** Baseline file slug: `{id}-linux.png` */
  id: string;
  mode: TableVisualMode;
  /** Markdown file under `fixtures/tables-visual/`. */
  fixture: string;
  cursor: { line: number; character: number };
};

const SCENARIOS: TableVisualScenario[] = [
  {
    id: 'custom-basic-rendered',
    mode: 'rendered',
    fixture: 'custom-basic.md',
    cursor: { line: 0, character: 0 },
  },
  {
    id: 'custom-raw-reveal',
    mode: 'raw',
    fixture: 'custom-basic.md',
    cursor: { line: 4, character: 4 },
  },
  {
    id: 'custom-alignment-rendered',
    mode: 'rendered',
    fixture: 'custom-alignment.md',
    cursor: { line: 0, character: 0 },
  },
  {
    id: 'custom-long-rendered',
    mode: 'rendered',
    fixture: 'custom-long.md',
    cursor: { line: 0, character: 0 },
  },
  {
    id: 'custom-long-raw',
    mode: 'raw',
    fixture: 'custom-long.md',
    cursor: { line: 5, character: 4 },
  },
  {
    id: 'custom-wrap-ellipsis-rendered',
    mode: 'rendered',
    fixture: 'custom-wrap-ellipsis.md',
    cursor: { line: 0, character: 0 },
  },
  {
    id: 'custom-cjk-rendered',
    mode: 'rendered',
    fixture: 'custom-cjk.md',
    cursor: { line: 0, character: 0 },
  },
];

type CdpResponse<T> = {
  id: number;
  result?: T;
  error?: { message: string };
};

type CdpPageTarget = {
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
};

type CdpClip = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

type CdpTableState = {
  clip: CdpClip | null;
  overlayCount: number;
  rawLineCount: number;
  diagnostics: string;
};

type DecoratorExport = {
  isEnabled: () => boolean;
  updateDecorationsForSelection: () => void;
};

type ExtensionExports = {
  decorator?: DecoratorExport;
};

suite('Table visual e2e', function () {
  let cdpClient: CdpClient | undefined;
  let decoratorApi: DecoratorExport | undefined;

  if (!VISUAL_E2E_ENABLED) {
    test('PNG visual regression is opt-in', function () {
      this.skip();
    });
    return;
  }

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (extension && !extension.isActive) {
      await extension.activate();
    }
    decoratorApi = (extension?.exports as ExtensionExports | undefined)?.decorator;
  });

  suiteTeardown(() => {
    cdpClient?.close();
  });

  for (const scenario of SCENARIOS) {
    test(`${scenario.id} matches the approved PNG baseline`, async () => {
      const fixturePath = path.join(FIXTURE_DIR, scenario.fixture);
      assert.ok(fs.existsSync(fixturePath), `Missing fixture: ${fixturePath}`);

      await vscode.workspace.getConfiguration().update(
        'markdownInlineEditor.tables.renderingMode',
        'custom',
        vscode.ConfigurationTarget.Global,
      );
      assert.strictEqual(
        vscode.workspace.getConfiguration('markdownInlineEditor').get('tables.renderingMode'),
        'custom',
        'Visual E2E must run with custom table rendering enabled',
      );

      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fixturePath));
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });
      if (decoratorApi && !decoratorApi.isEnabled()) {
        await vscode.commands.executeCommand('mdInline.toggleDecorations');
      }

      const cursorPosition = new vscode.Position(scenario.cursor.line, scenario.cursor.character);
      editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
      editor.revealRange(
        new vscode.Range(0, 0, document.lineCount, 0),
        vscode.TextEditorRevealType.AtTop,
      );
      decoratorApi?.updateDecorationsForSelection();

      const baselinePath = path.join(BASELINE_DIR, `${scenario.id}-linux.png`);
      const actualPath = path.join(OUTPUT_DIR, `${scenario.id}-linux.actual.png`);
      const diffPath = path.join(OUTPUT_DIR, `${scenario.id}-linux.diff.png`);

      const actualPng = await captureEditorPng(
        await getCdpClient(cdpClient, (client) => {
          cdpClient = client;
        }),
        scenario,
      );
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(actualPath, actualPng);

      if (UPDATE_BASELINES) {
        fs.mkdirSync(BASELINE_DIR, { recursive: true });
        fs.writeFileSync(baselinePath, actualPng);
        return;
      }

      assert.ok(
        fs.existsSync(baselinePath),
        `Missing visual baseline: ${baselinePath}. Run npm run test:e2e:visual:update to create it.`,
      );

      const diffRatio = comparePngs(
        fs.readFileSync(baselinePath),
        actualPng,
        diffPath,
      );
      const maxDiffRatio = process.env.CI === 'true' ? 0.01 : 0.02;
      assert.ok(
        diffRatio <= maxDiffRatio,
        `${scenario.id} PNG visual diff ${formatPercent(diffRatio)} exceeded ${formatPercent(maxDiffRatio)}. `
        + `Actual: ${actualPath}. Diff: ${diffPath}.`,
      );
    });
  }
});

async function getCdpClient(
  client: CdpClient | undefined,
  setClient: (client: CdpClient) => void,
): Promise<CdpClient> {
  if (client) {
    return client;
  }
  const target = await findWorkbenchTarget();
  assert.ok(target.webSocketDebuggerUrl, 'VS Code remote debugging target did not expose a WebSocket URL');
  const nextClient = await CdpClient.connect(target.webSocketDebuggerUrl);
  setClient(nextClient);
  return nextClient;
}

async function captureEditorPng(
  client: CdpClient,
  scenario: TableVisualScenario,
): Promise<Buffer> {
  const state = await waitForTableState(client, scenario);
  assert.ok(state.clip, `${scenario.id} did not produce a screenshot clip: ${state.diagnostics}`);
  const capture = await client.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    clip: state.clip,
  });
  return Buffer.from(capture.data, 'base64');
}

async function findWorkbenchTarget(): Promise<CdpPageTarget> {
  const url = `http://127.0.0.1:${REMOTE_DEBUGGING_PORT}/json/list`;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const targets = await response.json() as CdpPageTarget[];
        const target = targets.find((item) =>
          item.type === 'page' && item.webSocketDebuggerUrl && /workbench|vscode/i.test(item.url),
        ) ?? targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
        if (target) {
          return target;
        }
      }
    } catch {
      // VS Code may still be starting the remote debugging endpoint.
    }
    await delay(250);
  }

  throw new Error(`Could not find VS Code CDP target on port ${REMOTE_DEBUGGING_PORT}`);
}

const TABLE_STATE_EXPRESSION = `(() => {
    const expectedMode = __EXPECTED_MODE__;
    const editor = document.querySelector('.monaco-editor');
    const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'));
    const textForMatch = (line) => (line.textContent || '').replace(/\\u00a0/g, ' ');
    if (!editor) {
      return {
        clip: null,
        overlayCount: 0,
        rawLineCount: 0,
        diagnostics: 'editor missing',
      };
    }
    const hasTableLines = lines.some((line) => textForMatch(line).includes('|'));
    if (!hasTableLines) {
      const sampleLines = lines.slice(0, 8).map((line) => textForMatch(line).trim()).filter(Boolean);
      return {
        clip: null,
        overlayCount: 0,
        rawLineCount: 0,
        diagnostics: 'table lines missing; sample=' + sampleLines.join(' | '),
      };
    }
    let overlayCount = 0;
    let rawLineCount = 0;
    const countOverlayRect = (rect, width, height) => {
      if (!rect) {
        return;
      }
      const bottom = height > 0 ? rect.top + height : rect.bottom;
      if (bottom <= rect.top) {
        return;
      }
      overlayCount++;
    };
    const imgs = document.querySelectorAll('.monaco-editor img');
    for (let k = 0; k < imgs.length; k++) {
      const rect = imgs[k].getBoundingClientRect();
      countOverlayRect(rect, rect.width, rect.height);
    }
    const decorationElements = document.querySelectorAll('.monaco-editor .view-line, .monaco-editor .view-line *');
    for (let k = 0; k < decorationElements.length; k++) {
      const element = decorationElements[k];
      const before = getComputedStyle(element, '::before');
      const generatedImage = [
        before.backgroundImage,
        before.webkitMaskImage,
        before.content,
      ].join(' ');
      const rect = element.getBoundingClientRect();
      const width = parseFloat(before.width) || rect.width;
      const height = parseFloat(before.height) || rect.height;
      const looksLikeGeneratedOverlay = generatedImage.includes('svg') ||
        (before.content !== 'none' && width > 20 && height > 10);
      if (!looksLikeGeneratedOverlay) {
        continue;
      }
      countOverlayRect(rect, width, height);
    }
    for (let i = 0; i < lines.length; i++) {
      if (textForMatch(lines[i]).indexOf('|') < 0) {
        continue;
      }
      rawLineCount++;
    }
    if (expectedMode === 'rendered' && overlayCount === 0) {
      return {
        clip: null,
        overlayCount,
        rawLineCount,
        diagnostics: 'waiting for custom table overlay image',
      };
    }
    if (expectedMode === 'raw' && overlayCount > 0) {
      return {
        clip: null,
        overlayCount,
        rawLineCount,
        diagnostics: 'waiting for raw reveal to remove custom table overlays',
      };
    }
    if (expectedMode === 'raw' && rawLineCount < 3) {
      return {
        clip: null,
        overlayCount,
        rawLineCount,
        diagnostics: 'waiting for raw table source lines',
      };
    }
    const editorRect = editor.getBoundingClientRect();
    return {
      clip: {
        x: Math.max(0, Math.floor(editorRect.left)),
        y: Math.max(0, Math.floor(editorRect.top)),
        width: Math.max(1, Math.ceil(editorRect.width)),
        height: Math.max(1, Math.ceil(editorRect.height)),
        scale: 1,
      },
      overlayCount,
      rawLineCount,
      diagnostics: 'ready',
    };
  })()`;

function buildTableStateExpression(scenario: TableVisualScenario): string {
  return TABLE_STATE_EXPRESSION.replace('__EXPECTED_MODE__', JSON.stringify(scenario.mode));
}

async function waitForTableState(
  client: CdpClient,
  scenario: TableVisualScenario,
): Promise<CdpTableState> {
  const expression = buildTableStateExpression(scenario);
  const startedAt = Date.now();
  let lastState: CdpTableState | null = null;

  while (Date.now() - startedAt < TABLE_STATE_TIMEOUT_MS) {
    const result = await client.send<{ result: { value: CdpTableState | null } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });
    lastState = result.result.value;
    if (lastState?.clip) {
      return lastState;
    }
    await delay(TABLE_STATE_POLL_MS);
  }

  const diagnostics = lastState
    ? `${lastState.diagnostics}; overlays=${lastState.overlayCount}; rawLines=${lastState.rawLineCount}`
    : 'no table state returned';
  throw new Error(`Could not prepare ${scenario.id} (${scenario.mode}): ${diagnostics}`);
}

function comparePngs(expectedBytes: Buffer, actualBytes: Buffer, diffPath: string): number {
  const expected = PNG.sync.read(expectedBytes);
  const actual = PNG.sync.read(actualBytes);
  assert.strictEqual(actual.width, expected.width, 'Actual PNG width must match the baseline');
  assert.strictEqual(actual.height, expected.height, 'Actual PNG height must match the baseline');

  const diff = new PNG({ width: expected.width, height: expected.height });
  const mismatchedPixels = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    expected.width,
    expected.height,
    { threshold: 0.1, includeAA: false },
  );
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return mismatchedPixels / (expected.width * expected.height);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();

  private constructor(private readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as CdpResponse<unknown>;
      if (typeof message.id !== 'number') {
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }
      pending.resolve(message.result);
    });
  }

  static connect(url: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.once('open', () => resolve(new CdpClient(socket)));
      socket.once('error', reject);
    });
  }

  send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.socket.send(payload, (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  close(): void {
    this.socket.close();
  }
}
