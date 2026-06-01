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
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'src/test/e2e/fixtures/tables-visual');
const BASELINE_DIR = path.join(REPO_ROOT, 'src/test/e2e/visual-baselines');
const OUTPUT_DIR = path.join(REPO_ROOT, 'dist/visual-regression');
const RENDER_SETTLE_MS = 1800;

type TableRenderingMode = 'inline' | 'custom';

type TableVisualScenario = {
  /** Baseline file slug: `{id}-linux.png` */
  id: string;
  renderingMode: TableRenderingMode;
  /** Markdown file under `fixtures/tables-visual/`. */
  fixture: string;
  /** First visible table line in the clip. */
  headerNeedle: string;
  /** Last table body line included in the clip. */
  lastRowNeedle: string;
  cursor: { line: number; character: number };
};

const SCENARIOS: TableVisualScenario[] = [
  {
    id: 'custom-long-rendered',
    renderingMode: 'custom',
    fixture: 'custom-long.md',
    headerNeedle: 'Section Header',
    lastRowNeedle: 'Row 3',
    cursor: { line: 0, character: 0 },
  },
  {
    id: 'custom-long-raw',
    renderingMode: 'custom',
    fixture: 'custom-long.md',
    headerNeedle: 'Section Header',
    lastRowNeedle: 'Row 3',
    cursor: { line: 6, character: 4 },
  },
  {
    id: 'inline-basic-rendered',
    renderingMode: 'inline',
    fixture: 'inline-basic.md',
    headerNeedle: '| Name | Role |',
    lastRowNeedle: '| Bob  | Dev  |',
    cursor: { line: 0, character: 0 },
  },
  {
    id: 'inline-basic-raw',
    renderingMode: 'inline',
    fixture: 'inline-basic.md',
    headerNeedle: '| Name | Role |',
    lastRowNeedle: '| Bob  | Dev  |',
    cursor: { line: 3, character: 3 },
  },
  {
    id: 'custom-alignment-rendered',
    renderingMode: 'custom',
    fixture: 'custom-alignment.md',
    headerNeedle: '|:-----|:------:|------:|',
    lastRowNeedle: '| long |  mid   |   1.0 |',
    cursor: { line: 0, character: 0 },
  },
  {
    id: 'custom-cjk-rendered',
    renderingMode: 'custom',
    fixture: 'custom-cjk.md',
    headerNeedle: '| Name | CJK  | Emoji |',
    lastRowNeedle: '| CD   | 世界 | 🚀    |',
    cursor: { line: 0, character: 0 },
  },
  {
    id: 'inline-formatting-rendered',
    renderingMode: 'inline',
    fixture: 'inline-formatting.md',
    headerNeedle: '| Plain | **Bold** | *Italic* | `code` |',
    lastRowNeedle: '| ok    | loud     | soft     | mono   |',
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

suite('Table visual e2e', function () {
  if (!VISUAL_E2E_ENABLED) {
    test('PNG visual regression is opt-in', function () {
      this.skip();
    });
    return;
  }

  suiteSetup(async () => {
    await configureStableEditor();
  });

  for (const scenario of SCENARIOS) {
    test(`${scenario.id} matches the approved PNG baseline`, async () => {
      const fixturePath = path.join(FIXTURE_DIR, scenario.fixture);
      assert.ok(fs.existsSync(fixturePath), `Missing fixture: ${fixturePath}`);

      await vscode.workspace.getConfiguration('markdownInlineEditor.tables').update(
        'renderingMode',
        scenario.renderingMode,
        vscode.ConfigurationTarget.Global,
      );

      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fixturePath));
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });

      const cursorPosition = new vscode.Position(scenario.cursor.line, scenario.cursor.character);
      editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
      editor.revealRange(
        new vscode.Range(0, 0, document.lineCount, 0),
        vscode.TextEditorRevealType.AtTop,
      );
      await delay(RENDER_SETTLE_MS);

      const baselinePath = path.join(BASELINE_DIR, `${scenario.id}-linux.png`);
      const actualPath = path.join(OUTPUT_DIR, `${scenario.id}-linux.actual.png`);
      const diffPath = path.join(OUTPUT_DIR, `${scenario.id}-linux.diff.png`);

      const actualPng = await captureTablePng(scenario.headerNeedle, scenario.lastRowNeedle);
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

async function captureTablePng(headerNeedle: string, lastRowNeedle: string): Promise<Buffer> {
  const target = await findWorkbenchTarget();
  assert.ok(target.webSocketDebuggerUrl, 'VS Code remote debugging target did not expose a WebSocket URL');

  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  try {
    const clip = await waitForTableClip(client, headerNeedle, lastRowNeedle);
    const capture = await client.send<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      clip,
    });
    return Buffer.from(capture.data, 'base64');
  } finally {
    client.close();
  }
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

async function waitForTableClip(
  client: CdpClient,
  headerNeedle: string,
  lastRowNeedle: string,
): Promise<CdpClip> {
  const expression = `(() => {
    const headerNeedle = ${JSON.stringify(headerNeedle)};
    const lastRowNeedle = ${JSON.stringify(lastRowNeedle)};
    const editor = document.querySelector('.monaco-editor');
    const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'));
    const headerLine = lines.find((line) => (line.textContent || '').includes(headerNeedle));
    const lastLine = lines.find((line) => (line.textContent || '').includes(lastRowNeedle));
    if (!editor || !headerLine || !lastLine) {
      if (!editor) {
        return null;
      }
      const editorRect = editor.getBoundingClientRect();
      return {
        x: Math.max(0, Math.floor(editorRect.left + 4)),
        y: Math.max(0, Math.floor(editorRect.top + 36)),
        width: Math.ceil(Math.min(editorRect.width - 8, 900)),
        height: 190,
        scale: 1,
      };
    }
    const editorRect = editor.getBoundingClientRect();
    const headerRect = headerLine.getBoundingClientRect();
    const lastRect = lastLine.getBoundingClientRect();
    const x = Math.max(0, Math.floor(editorRect.left + 4));
    const y = Math.max(0, Math.floor(headerRect.top - 10));
    const width = Math.ceil(Math.min(editorRect.width - 8, 900));
    const height = Math.ceil(lastRect.bottom - headerRect.top + 42);
    return { x, y, width, height, scale: 1 };
  })()`;

  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await client.send<{ result: { value: CdpClip | null } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });
    if (result.result.value) {
      return result.result.value;
    }
    await delay(250);
  }

  throw new Error(`Could not locate rendered table lines for ${headerNeedle} / ${lastRowNeedle}`);
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
