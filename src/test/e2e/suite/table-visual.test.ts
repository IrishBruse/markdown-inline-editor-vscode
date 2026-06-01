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
  /** First visible table line in the clip. */
  headerNeedle: string;
  /** Last table body line included in the clip. */
  lastRowNeedle: string;
  cursor: { line: number; character: number };
  /** Cap screenshot width (raw GFM lines otherwise span the full editor). */
  clipMaxWidth?: number;
};

const SCENARIOS: TableVisualScenario[] = [
  {
    id: 'custom-basic-rendered',
    mode: 'rendered',
    fixture: 'custom-basic.md',
    headerNeedle: '| Name | Role |',
    lastRowNeedle: '| Bob  | Dev  |',
    cursor: { line: 0, character: 0 },
    clipMaxWidth: 360,
  },
  {
    id: 'custom-raw-reveal',
    mode: 'raw',
    fixture: 'custom-basic.md',
    headerNeedle: '| Name | Role |',
    lastRowNeedle: '| Bob  | Dev  |',
    cursor: { line: 4, character: 4 },
    clipMaxWidth: 320,
  },
  {
    id: 'custom-alignment-rendered',
    mode: 'rendered',
    fixture: 'custom-alignment.md',
    headerNeedle: '| Left | Center | Right |',
    lastRowNeedle: '| long |  mid   |   1.0 |',
    cursor: { line: 0, character: 0 },
    clipMaxWidth: 420,
  },
  {
    id: 'custom-wrap-ellipsis-rendered',
    mode: 'rendered',
    fixture: 'custom-wrap-ellipsis.md',
    headerNeedle: 'Section Header',
    lastRowNeedle: 'Row 2',
    cursor: { line: 0, character: 0 },
    clipMaxWidth: 650,
  },
  {
    id: 'custom-cjk-rendered',
    mode: 'rendered',
    fixture: 'custom-cjk.md',
    headerNeedle: '| Name | CJK  | Emoji |',
    lastRowNeedle: '| CD   | 世界 | 🚀    |',
    cursor: { line: 0, character: 0 },
    clipMaxWidth: 360,
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
    await configureStableEditor();
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

      const actualPng = capPngWidth(
        await captureTablePng(
          await getCdpClient(cdpClient, (client) => {
            cdpClient = client;
          }),
          scenario,
          scenario.headerNeedle,
          scenario.lastRowNeedle,
          scenario.clipMaxWidth,
        ),
        scenario.clipMaxWidth,
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

async function configureStableEditor(): Promise<void> {
  await vscode.workspace.getConfiguration('workbench').update('colorTheme', 'Default Dark Modern', vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('window').update('zoomLevel', 0, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('fontFamily', 'monospace', vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('fontSize', 14, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('lineHeight', 20, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('lineNumbers', 'off', vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('glyphMargin', false, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('folding', false, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('minimap.enabled', false, vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('editor').update('cursorBlinking', 'solid', vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('markdownInlineEditor.colors').update('tableBackground', '#111111', vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('markdownInlineEditor.colors').update('tableHeaderBackground', '#222222', vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('markdownInlineEditor.colors').update('tableBorder', '#666666', vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('markdownInlineEditor.colors').update('tableText', '#eeeeee', vscode.ConfigurationTarget.Global);
}

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

async function captureTablePng(
  client: CdpClient,
  scenario: TableVisualScenario,
  headerNeedle: string,
  lastRowNeedle: string,
  clipMaxWidth = 980,
): Promise<Buffer> {
  const state = await waitForTableState(client, scenario, headerNeedle, lastRowNeedle, clipMaxWidth);
  assert.ok(state.clip, `${scenario.id} did not produce a screenshot clip: ${state.diagnostics}`);
  const capture = await client.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    clip: state.clip,
  });
  return tightCropPng(Buffer.from(capture.data, 'base64'));
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
    const headerNeedle = __HEADER_NEEDLE__;
    const lastRowNeedle = __LAST_ROW_NEEDLE__;
    const expectedMode = __EXPECTED_MODE__;
    const editor = document.querySelector('.monaco-editor');
    const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'));
    const textForMatch = (line) => (line.textContent || '').replace(/\\u00a0/g, ' ');
    const headerLine = lines.find((line) => textForMatch(line).includes(headerNeedle));
    const lastLine = lines.find((line) => textForMatch(line).includes(lastRowNeedle));
    if (!editor || !headerLine || !lastLine) {
      const sampleLines = lines.slice(0, 8).map((line) => textForMatch(line).trim()).filter(Boolean);
      return {
        clip: null,
        overlayCount: 0,
        rawLineCount: 0,
        diagnostics: [
          editor ? 'editor found' : 'editor missing',
          headerLine ? 'header found' : 'header missing',
          lastLine ? 'last row found' : 'last row missing',
          'editors=' + document.querySelectorAll('.monaco-editor').length,
          'lines=' + lines.length,
          'sample=' + sampleLines.join(' | '),
        ].join(', '),
      };
    }
    const padX = 20;
    const padY = 12;
    const maxWidth = __CLIP_MAX_WIDTH__;
    const minWidth = 120;
    const minHeight = 48;
    const headerRect = headerLine.getBoundingClientRect();
    const lastRect = lastLine.getBoundingClientRect();
    let bandTop = headerRect.top;
    let bandBottom = lastRect.bottom;
    const maxGrowWidth = editor.getBoundingClientRect().width * 0.9;
    let left = 1e10;
    let right = -1e10;
    let overlayCount = 0;
    let rawLineCount = 0;
    function grow(rect, allowWide, growY) {
      if (!rect || rect.width < 0.5 || rect.height < 0.5) {
        return;
      }
      if (!allowWide && rect.width > maxGrowWidth) {
        return;
      }
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      if (growY) {
        bandTop = Math.min(bandTop, rect.top);
        bandBottom = Math.max(bandBottom, rect.bottom);
      }
    }
    const headerIndex = lines.indexOf(headerLine);
    const lastIndex = lines.indexOf(lastLine);
    const countOverlayRect = (rect, width, height) => {
      if (!rect || rect.bottom < bandTop || rect.top > bandBottom) {
        return;
      }
      overlayCount++;
      if (width > 0 && height > 0) {
        grow({
          left: rect.left,
          right: rect.left + width,
          top: rect.top,
          bottom: rect.top + height,
          width,
          height,
        }, true, true);
        return;
      }
      grow(rect, true, true);
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
    for (let i = headerIndex; i <= lastIndex; i++) {
      const text = textForMatch(lines[i]);
      if (text.indexOf('|') < 0) {
        continue;
      }
      rawLineCount++;
      if (expectedMode !== 'raw') {
        continue;
      }
      const spans = lines[i].querySelectorAll('span');
      for (let j = 0; j < spans.length; j++) {
        grow(spans[j].getBoundingClientRect(), false, false);
      }
    }
    const useCharEstimate = () => {
      let maxChars = 0;
      for (let i = headerIndex; i <= lastIndex; i++) {
        const text = textForMatch(lines[i]);
        if (text.indexOf('|') >= 0) {
          maxChars = Math.max(maxChars, text.length);
        }
      }
      const content = document.querySelector('.monaco-editor .lines-content');
      const contentRect = content
        ? content.getBoundingClientRect()
        : headerRect;
      left = contentRect.left;
      right = contentRect.left + Math.min(maxWidth, Math.max(minWidth, maxChars * 7.2));
    };
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
    if (!isFinite(left) || right <= left) {
      useCharEstimate();
    } else if (right - left > maxGrowWidth * 0.75) {
      useCharEstimate();
    }
    const width = Math.min(maxWidth, Math.max(minWidth, Math.ceil(right - left + padX * 2)));
    const height = Math.max(minHeight, Math.ceil(bandBottom - bandTop + padY * 2));
    const centerX = (left + right) / 2;
    const centerY = (bandTop + bandBottom) / 2;
    return {
      clip: {
        x: Math.max(0, Math.floor(centerX - width / 2)),
        y: Math.max(0, Math.floor(centerY - height / 2)),
        width,
        height,
        scale: 1,
      },
      overlayCount,
      rawLineCount,
      diagnostics: 'ready',
    };
  })()`;

function buildTableStateExpression(
  scenario: TableVisualScenario,
  headerNeedle: string,
  lastRowNeedle: string,
  clipMaxWidth: number,
): string {
  return TABLE_STATE_EXPRESSION
    .replace('__HEADER_NEEDLE__', JSON.stringify(headerNeedle))
    .replace('__LAST_ROW_NEEDLE__', JSON.stringify(lastRowNeedle))
    .replace('__EXPECTED_MODE__', JSON.stringify(scenario.mode))
    .replace('__CLIP_MAX_WIDTH__', String(clipMaxWidth));
}

async function waitForTableState(
  client: CdpClient,
  scenario: TableVisualScenario,
  headerNeedle: string,
  lastRowNeedle: string,
  clipMaxWidth: number,
): Promise<CdpTableState> {
  const expression = buildTableStateExpression(scenario, headerNeedle, lastRowNeedle, clipMaxWidth);
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
  throw new Error(`Could not prepare ${scenario.id} (${scenario.mode}) for ${headerNeedle} / ${lastRowNeedle}: ${diagnostics}`);
}

function capPngWidth(pngBytes: Buffer, maxWidth: number | undefined): Buffer {
  if (maxWidth === undefined) {
    return pngBytes;
  }

  const source = PNG.sync.read(pngBytes);
  if (source.width <= maxWidth) {
    return pngBytes;
  }

  const cropX = Math.max(0, Math.floor((source.width - maxWidth) / 2));
  const cropped = new PNG({ width: maxWidth, height: source.height });
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < maxWidth; x++) {
      const srcOffset = (y * source.width + (cropX + x)) << 2;
      const dstOffset = (y * maxWidth + x) << 2;
      cropped.data[dstOffset] = source.data[srcOffset];
      cropped.data[dstOffset + 1] = source.data[srcOffset + 1];
      cropped.data[dstOffset + 2] = source.data[srcOffset + 2];
      cropped.data[dstOffset + 3] = source.data[srcOffset + 3];
    }
  }

  return PNG.sync.write(cropped);
}

function tightCropPng(pngBytes: Buffer): Buffer {
  const source = PNG.sync.read(pngBytes);
  const { width, height, data } = source;
  if (width === 0 || height === 0) {
    return pngBytes;
  }

  const sample = (x: number, y: number) => {
    const offset = (width * y + x) << 2;
    return [data[offset], data[offset + 1], data[offset + 2]] as const;
  };
  const corners = [
    sample(0, 0),
    sample(width - 1, 0),
    sample(0, height - 1),
    sample(width - 1, height - 1),
  ];
  const background = [
    Math.round(corners.reduce((sum, c) => sum + c[0], 0) / corners.length),
    Math.round(corners.reduce((sum, c) => sum + c[1], 0) / corners.length),
    Math.round(corners.reduce((sum, c) => sum + c[2], 0) / corners.length),
  ] as const;
  const threshold = 18;

  const differs = (x: number, y: number) => {
    const [r, g, b] = sample(x, y);
    return Math.abs(r - background[0]) > threshold
      || Math.abs(g - background[1]) > threshold
      || Math.abs(b - background[2]) > threshold;
  };

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!differs(x, y)) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return pngBytes;
  }

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const cropped = new PNG({ width: cropWidth, height: cropHeight });

  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const srcOffset = ((minY + y) * width + (minX + x)) << 2;
      const dstOffset = (y * cropWidth + x) << 2;
      cropped.data[dstOffset] = data[srcOffset];
      cropped.data[dstOffset + 1] = data[srcOffset + 1];
      cropped.data[dstOffset + 2] = data[srcOffset + 2];
      cropped.data[dstOffset + 3] = data[srcOffset + 3];
    }
  }

  return PNG.sync.write(cropped);
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
