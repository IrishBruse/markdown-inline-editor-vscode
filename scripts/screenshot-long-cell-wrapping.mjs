#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspacePath = path.join(root, "docs");
const fixtureRelPath =
  process.env.FIXTURE_PATH ?? "tests/long-cell-wrapping.md";
const fixturePath = path.join(workspacePath, fixtureRelPath);
const fixtureBasename = path.basename(fixturePath);
const screenshotsDir = path.join(root, "screenshots");
const screenshotPrefix = "long-cell-wrapping";
const userDataDir = path.join(root, ".vscode-screenshot-profile");
const editorPidFile = path.join(userDataDir, ".screenshot-editor.pid");
const extensionBundle = path.join(root, "dist/extension.js");
const maxCaptureFrames = Number(process.env.MAX_CAPTURE_FRAMES ?? 4);
const decorationSettleMs = Number(process.env.DECORATION_SETTLE_MS ?? "1500");
const decorationTimeoutMs = Number(process.env.DECORATION_TIMEOUT_MS ?? 30000);
const minDecorationSpans = 10;
const defaultWindowSize = { width: 800, height: 600 };
const windowSize = parseWindowSize();
const cdpPort = Number(process.env.CDP_PORT ?? "9223");
const cdpUrl = `http://127.0.0.1:${cdpPort}`;
const codeBin = process.env.CODE_BIN ?? "code";

/** @type {import("node:child_process").ChildProcess | null} */
let editorProcess = null;

async function runTableScreenshotTest() {
  ensureExtensionBuilt();
  ensureScreenshotProfile();
  prepareScreenshotsDir();
  assertEditorBinaryOnPath();

  const sizeLabel = formatWindowSize(windowSize);
  console.log(`\n=== Window size ${sizeLabel} ===`);
  const allWritten = await captureAtWindowSize(windowSize);

  console.log(
    `\nWrote ${allWritten.length} screenshots to ${path.relative(root, screenshotsDir)}/`
  );
}

function formatWindowSize({ width, height }) {
  return `${width}x${height}`;
}

function parseWindowSize() {
  const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const envWidth = process.env.WINDOW_WIDTH;
  const envHeight = process.env.WINDOW_HEIGHT;

  let width;
  let height;

  if (cliArgs.length >= 2) {
    width = Number(cliArgs[0]);
    height = Number(cliArgs[1]);
  } else if (cliArgs.length === 1) {
    throw new Error(
      "Pass width and height as two numbers, for example: npm run screenshot:long-cell-wrapping -- 1280 800"
    );
  } else if (envWidth !== undefined || envHeight !== undefined) {
    if (envWidth === undefined || envHeight === undefined) {
      throw new Error("Both WINDOW_WIDTH and WINDOW_HEIGHT are required");
    }
    width = Number(envWidth);
    height = Number(envHeight);
  } else {
    return defaultWindowSize;
  }

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(`Invalid window size: ${width}x${height}`);
  }

  return { width, height };
}

async function captureAtWindowSize(size) {
  const sizeLabel = formatWindowSize(size);
  await stopStaleEditorIfNeeded();

  console.log(`Launching ${codeBin} at ${sizeLabel}...`);
  launchExtensionHost(size);
  await waitForCdp();

  const browser = await connectBrowserWithRetry();
  let page;

  try {
    page = await findWorkbenchPage(browser);

    await waitForWorkbench(page);
    await dismissInitialDialogs(page);
    await waitForFixtureEditor(page);
    await page.keyboard.press("Control+Shift+F1");
    await page.keyboard.press("Control+Shift+F2");

    console.log("Waiting for inline decorations...");
    await waitForDecorations(page);
    if (decorationSettleMs > 0) {
      console.log(`Settling ${decorationSettleMs}ms for decorations...`);
      await sleep(decorationSettleMs);
    }

    return await captureScrollingScreenshots(page, sizeLabel);
  } finally {
    await shutdown(page, browser);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureExtensionBuilt() {
  if (fs.existsSync(extensionBundle)) {
    return;
  }

  console.log("dist/extension.js missing, running npm run bundle...");
  const result = spawnSync("npm", ["run", "bundle"], {
    cwd: root,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error("Failed to build extension bundle");
  }
}

function assertEditorBinaryOnPath() {
  const lookup = process.platform === "win32" ? "where" : "which";
  const which = spawnSync(lookup, [codeBin], { encoding: "utf8" });
  if (which.status !== 0 || !which.stdout.trim()) {
    throw new Error(`Editor binary not found on PATH: ${codeBin}`);
  }
}

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForPortClosed(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Port ${port} still in use after ${timeoutMs}ms`);
}

function readStoredEditorPid() {
  if (!fs.existsSync(editorPidFile)) {
    return null;
  }
  const pid = Number(fs.readFileSync(editorPidFile, "utf8").trim());
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function writeStoredEditorPid(pid) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(editorPidFile, `${pid}\n`);
}

function clearStoredEditorPid() {
  fs.rmSync(editorPidFile, { force: true });
}

function killPid(pid, signal = "SIGTERM") {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
        stdio: "ignore"
      });
      return true;
    }

    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function releaseEditorAndPort(pid) {
  if (!pid) {
    return;
  }

  killPid(pid);
  await waitForPortClosed(cdpPort).catch(() => {});
  if (await isPortOpen(cdpPort)) {
    killPid(pid, "SIGKILL");
    await waitForPortClosed(cdpPort).catch(() => {});
  }
}

async function stopStaleEditorIfNeeded() {
  const stalePid = readStoredEditorPid();
  if (stalePid) {
    await releaseEditorAndPort(stalePid);
    clearStoredEditorPid();
    await sleep(500);
  }

  if (await isPortOpen(cdpPort)) {
    await waitForPortClosed(cdpPort, 5000).catch(() => {});
  }

  if (await isPortOpen(cdpPort)) {
    throw new Error(
      `CDP port ${cdpPort} is already in use by another process. ` +
        "Set CDP_PORT to a free port or close the other debugger."
    );
  }
}

function ensureScreenshotProfile() {
  const userDir = path.join(userDataDir, "User");
  const settingsPath = path.join(userDir, "settings.json");
  const keybindingsPath = path.join(userDir, "keybindings.json");
  fs.mkdirSync(userDir, { recursive: true });

  const settings = {
    "workbench.startupEditor": "none",
    "workbench.welcome.enabled": false,
    "workbench.welcomePage.walkthroughs.openOnInstall": false,
    "extensions.ignoreRecommendations": true,
    "task.allowAutomaticTasks": "on",
    "editor.minimap.enabled": false,
    "editor.stickyScroll.enabled": false,
    "editor.accessibilitySupport": "off",
    "security.workspace.trust.enabled": false,
    "window.zoomLevel": 0,
    "workbench.editor.restoreViewState": false,
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "git.openRepositoryInParentFolders": "never"
  };

  const existing = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    : {};
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ ...existing, ...settings }, null, 2) + "\n"
  );

  fs.writeFileSync(
    keybindingsPath,
    JSON.stringify(
      [
        { key: "ctrl+shift+f1", command: "workbench.action.closeSidebar" },
        { key: "ctrl+shift+f2", command: "workbench.action.closeAuxiliaryBar" },
        { key: "ctrl+shift+f4", command: "workbench.action.quit" }
      ],
      null,
      2
    ) + "\n"
  );
}

function prepareScreenshotsDir() {
  fs.rmSync(screenshotsDir, { recursive: true, force: true });
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

function launchExtensionHost({ width, height }) {
  const args = [
    "--new-window",
    `--extensionDevelopmentPath=${root}`,
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    workspacePath
  ];

  editorProcess = spawn(codeBin, args, {
    cwd: root,
    detached: process.platform !== "win32",
    stdio: "ignore"
  });

  if (!editorProcess.pid) {
    throw new Error(`Failed to launch ${codeBin}`);
  }

  writeStoredEditorPid(editorProcess.pid);
  if (process.platform !== "win32") {
    editorProcess.unref();
  }
}

async function shutdown(page, browser) {
  if (page && !page.isClosed()) {
    await page.keyboard.press("Control+Shift+F4").catch(() => {});
    await sleep(800);
  }

  if (browser) {
    await browser.close().catch(() => {});
  }

  await releaseEditorAndPort(editorProcess?.pid ?? readStoredEditorPid());
  clearStoredEditorPid();
  editorProcess = null;
  await sleep(400);
}

async function connectBrowserWithRetry(attempts = 5) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await chromium.connectOverCDP(cdpUrl);
    } catch (error) {
      lastError = error;
      await sleep(Math.min(250 * attempt, 1000));
    }
  }

  throw new Error(
    `Failed to connect Playwright to CDP at ${cdpUrl}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

async function waitForCdp(timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let delayMs = 100;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${cdpUrl}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until CDP responds.
    }
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 1.5, 500);
  }

  throw new Error(
    `CDP endpoint did not respond within ${timeoutMs}ms (${cdpUrl})`
  );
}

async function findWorkbenchPage(browser, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const candidate of context.pages()) {
        const url = candidate.url();
        if (url.includes("vscode-app") || url.startsWith("vscode-file://")) {
          return candidate;
        }
      }
    }

    await sleep(150);
  }

  throw new Error("Could not find VS Code workbench page over CDP");
}

async function waitForWorkbench(page, timeoutMs = 45_000) {
  await page.waitForFunction(
    () => document.title.includes("Extension Development Host"),
    undefined,
    { timeout: timeoutMs }
  );
}

async function openFixtureFile(page) {
  const explorerEntry = page
    .locator(".monaco-list-row")
    .filter({ hasText: fixtureBasename })
    .first();
  if (await explorerEntry.isVisible({ timeout: 1000 }).catch(() => false)) {
    await explorerEntry.click();
    await sleep(400);
    return;
  }

  await page.keyboard.press("Escape");
  await sleep(100);
  await page.keyboard.press("Control+P");
  await sleep(300);
  await page.keyboard.type(fixtureBasename, { delay: 15 });
  await sleep(200);
  await page.keyboard.press("Enter");
  await sleep(800);
}

async function waitForFixtureEditor(page, timeoutMs = 45_000) {
  const activeTab = page
    .locator(".tab.active")
    .filter({ hasText: fixtureBasename });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await activeTab.isVisible({ timeout: 500 }).catch(() => false)) {
      break;
    }
    await openFixtureFile(page);
    await sleep(500);
  }

  await activeTab.waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".monaco-editor").first().waitFor({
    state: "visible",
    timeout: 10_000
  });

  const settleDeadline = Date.now() + 3_000;
  let lastLineCount = 0;
  while (Date.now() < settleDeadline) {
    const lineCount = await page
      .locator(".view-line")
      .count()
      .catch(() => 0);
    if (lineCount > 0 && lineCount === lastLineCount) {
      return;
    }
    lastLineCount = lineCount;
    await sleep(100);
  }
}

function editorCaptureLocator(page) {
  return page
    .locator(
      ".editor-group-container.active .monaco-editor, .editor-group-container .monaco-editor"
    )
    .first();
}

async function captureEditorScreenshot(page, filepath) {
  await resetEditorHorizontalScroll(page);
  const editor = editorCaptureLocator(page);
  await editor.waitFor({ state: "visible", timeout: 10_000 });
  await editor.screenshot({ path: filepath });
}

async function resetEditorHorizontalScroll(page) {
  await page.evaluate(() => {
    for (const linesContent of document.querySelectorAll(
      ".monaco-editor .lines-content"
    )) {
      linesContent.style.left = "0px";
      const transform = linesContent.style.transform ?? "";
      const match = transform.match(
        /translate3d\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px/
      );
      if (match) {
        linesContent.style.transform = `translate3d(0px, ${match[2]}, 0px)`;
      }
    }

    for (const scrollable of document.querySelectorAll(
      ".monaco-editor .monaco-scrollable-element"
    )) {
      scrollable.scrollLeft = 0;
    }
  });
  await sleep(50);
}

async function scrollEditorToTop(page) {
  await editorCaptureLocator(page).click();
  await sleep(100);
  await page.keyboard.press("Control+Home");
  await sleep(300);
}

async function clickIfVisible(locator, timeoutMs = 400) {
  if (await locator.isVisible({ timeout: timeoutMs }).catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

async function dismissInitialDialogs(page) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const dismissed =
      (await clickIfVisible(
        page
          .getByRole("dialog", { name: "Welcome to Visual Studio Code" })
          .getByRole("button", { name: "Close" })
      )) ||
      (await clickIfVisible(
        page
          .locator(".onboarding-a-overlay button")
          .filter({ hasText: /skip|close|later|continue without/i })
      )) ||
      (await clickIfVisible(
        page.getByText("Continue without Signing In", { exact: false })
      )) ||
      (await clickIfVisible(
        page.getByRole("button", { name: "Continue", exact: true })
      )) ||
      (await clickIfVisible(
        page.getByRole("button", {
          name: "Yes, I trust the authors",
          exact: false
        })
      )) ||
      (await clickIfVisible(
        page.getByRole("button", { name: "Trust", exact: true })
      )) ||
      (await clickIfVisible(
        page.getByRole("button", { name: "No", exact: true })
      )) ||
      (await clickIfVisible(
        page
          .locator(".dialog-buttons-row .monaco-button")
          .filter({ hasText: "Close" }),
        250
      ));

    if (!dismissed) {
      break;
    }
    await sleep(150);
  }

  const notificationClose = page.locator(
    ".notifications-toasts .codicon-close"
  );
  while ((await notificationClose.count()) > 0) {
    await notificationClose
      .first()
      .click({ timeout: 250 })
      .catch(() => {});
  }

  await clickIfVisible(
    page.getByRole("button", { name: "Never", exact: true }),
    250
  );
  await page.keyboard.press("Escape");
}

async function disableScreenReaderMode(page) {
  const screenReaderStatus = page
    .locator(".statusbar-item")
    .filter({ hasText: "Screen Reader Optimized" });
  if (
    !(await screenReaderStatus.isVisible({ timeout: 500 }).catch(() => false))
  ) {
    return;
  }

  await screenReaderStatus.click();
  await clickIfVisible(page.getByRole("button", { name: "No", exact: true }));
  await page.keyboard.press("Escape");
  await sleep(150);
}

async function waitForDecorations(page, timeoutMs = decorationTimeoutMs) {
  await disableScreenReaderMode(page);

  const decorationLocator = page.locator(
    '.view-line span[class*="TextEditorDecorationType"]'
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await decorationLocator.count()) > minDecorationSpans) {
      return;
    }
    await sleep(200);
  }

  console.warn("Decorations did not fully settle, continuing with capture...");
}

async function readVisibleLineRange(page) {
  return page.evaluate(() => {
    const lineNumbers = Array.from(document.querySelectorAll(".line-numbers"))
      .map((element) => Number(element.textContent?.trim()))
      .filter((line) => Number.isFinite(line) && line > 0)
      .sort((left, right) => left - right);
    if (lineNumbers.length === 0) {
      return null;
    }
    return {
      top: lineNumbers[0],
      bottom: lineNumbers[lineNumbers.length - 1]
    };
  });
}

async function captureViewportSignature(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll(".view-line")]
      .map((line) => line.textContent?.trim().slice(0, 60) ?? "")
      .join("|");
  });
}

function tableContentScore(signature) {
  const markers = [
    "Section Header",
    "Detailed Placeholder",
    "Row 1",
    "Row 2",
    "Row 3",
    "Row 4",
    "Row 5",
    "Row 6",
    "Row 7",
    "Row 8",
    "Lorem"
  ];
  return markers.reduce(
    (score, marker) => score + (signature.includes(marker) ? 1 : 0),
    0
  );
}

async function scrollEditorViewport(page) {
  const beforeSignature = await captureViewportSignature(page);
  const editor = editorCaptureLocator(page);
  const box = await editor.boundingBox();
  if (!box) {
    return false;
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.mouse.wheel(0, box.height * 0.4);
  await sleep(600);

  const afterSignature = await captureViewportSignature(page);
  return afterSignature !== beforeSignature;
}

async function captureScrollingScreenshots(page, sizeLabel) {
  console.log(
    `Capturing ${fixtureBasename} (${sizeLabel}, viewport scroll until end)`
  );

  await scrollEditorToTop(page);

  const written = [];
  let previousSignature = "";
  const sizeToken = sizeLabel.replace("x", "-");

  for (let frame = 0; frame < maxCaptureFrames; frame += 1) {
    if (page.isClosed()) {
      throw new Error("VS Code page closed unexpectedly");
    }

    const range = await readVisibleLineRange(page);
    const signature = await captureViewportSignature(page);

    if (
      frame > 0 &&
      (tableContentScore(signature) === 0 || signature === previousSignature)
    ) {
      break;
    }

    const filename = `${screenshotPrefix}-${sizeToken}-${frame}.png`;
    const filepath = path.join(screenshotsDir, filename);
    await captureEditorScreenshot(page, filepath);
    const relativePath = path.relative(screenshotsDir, filepath);
    written.push(relativePath);

    const rangeLabel = range
      ? `lines ${range.top}-${range.bottom}`
      : "lines unknown";
    console.log(
      `Wrote screenshots/${relativePath} (scroll ${frame}, ${rangeLabel})`
    );

    previousSignature = signature;

    if (!(await scrollEditorViewport(page))) {
      break;
    }

    await sleep(400);
  }

  return written;
}

runTableScreenshotTest().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
