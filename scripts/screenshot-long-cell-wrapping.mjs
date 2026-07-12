#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
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
const extensionBundle = path.join(root, "dist/extension.js");
const cursorLine = Number(process.env.CURSOR_LINE ?? 3);
const maxCaptureFrames = Number(process.env.MAX_CAPTURE_FRAMES ?? 4);
const decorationSettleMs = Number(process.env.DECORATION_SETTLE_MS ?? "1500");
const decorationTimeoutMs = Number(process.env.DECORATION_TIMEOUT_MS ?? 30000);
const cdpPort = Number(process.env.CDP_PORT ?? "9223");
const cdpUrl = `http://127.0.0.1:${cdpPort}`;
const codeBin = process.env.CODE_BIN ?? "code";

async function runTableScreenshotTest() {
  // 1. Prepare local build, profile, and screenshot output directory.
  ensureExtensionBuilt();
  stopStaleEditorIfNeeded();
  ensureScreenshotProfile();
  prepareScreenshotsDir();
  assertEditorBinaryOnPath();

  // 2. Launch VS Code Extension Development Host and connect over CDP.
  console.log(`Launching ${codeBin} with docs workspace...`);
  launchExtensionHost();
  await waitForCdp();
  console.log("CDP ready, waiting for editor...");

  const browser = await chromium.connectOverCDP(cdpUrl);
  let page;

  try {
    page = await findWorkbenchPage(browser);
    if (!page) {
      throw new Error("Could not find VS Code workbench page over CDP");
    }

    // 3. Open the fixture and wait for the editor to be ready.
    await waitForWorkbench(page);
    await dismissInitialDialogs(page);
    await waitForFixtureEditor(page);
    await prepareEditorLayout(page);

    // 4. Wait for inline table decorations to render.
    console.log("Waiting for inline decorations...");
    await waitForDecorations(page);
    if (decorationSettleMs > 0) {
      console.log(`Settling ${decorationSettleMs}ms for decorations...`);
      await sleep(decorationSettleMs);
    }

    // 5. Capture scrolling screenshots through the long-cell table.
    const written = await captureScrollingScreenshots(page);
    console.log(
      `Wrote ${written.length} screenshots to ${path.relative(root, screenshotsDir)}/`
    );
  } finally {
    await shutdown(page, browser);
  }
}

// --- Setup -------------------------------------------------------------------

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
  const which = spawnSync("which", [codeBin], { encoding: "utf8" });
  if (which.status !== 0 || !which.stdout.trim()) {
    throw new Error(`Editor binary not found on PATH: ${codeBin}`);
  }
}

function isCdpPortInUse() {
  const lsof = spawnSync("lsof", ["-ti", `:${cdpPort}`], { encoding: "utf8" });
  return Boolean(lsof.stdout.trim());
}

function stopStaleEditorIfNeeded() {
  if (!isCdpPortInUse()) {
    return;
  }

  killEditorProcesses();
  spawnSync("sleep", ["0.5"]);
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
  fs.mkdirSync(screenshotsDir, { recursive: true });
  for (const entry of fs.readdirSync(screenshotsDir)) {
    if (entry.startsWith(`${screenshotPrefix}-`) && entry.endsWith(".png")) {
      fs.rmSync(path.join(screenshotsDir, entry), { force: true });
    }
  }
}

function launchExtensionHost() {
  spawn(
    codeBin,
    [
      "--new-window",
      `--extensionDevelopmentPath=${root}`,
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      `--goto`,
      `${fixturePath}:${cursorLine}`,
      workspacePath
    ],
    { cwd: root, detached: true, stdio: "ignore" }
  ).unref();
}

function killEditorProcesses() {
  spawnSync("pkill", ["-f", `user-data-dir=${userDataDir}`], {
    stdio: "ignore"
  });

  const lsof = spawnSync("lsof", ["-ti", `:${cdpPort}`], { encoding: "utf8" });
  const myPid = process.pid;
  for (const pid of lsof.stdout.trim().split("\n")) {
    const numericPid = Number(pid);
    if (!pid || numericPid === myPid) {
      continue;
    }
    try {
      process.kill(numericPid, "SIGTERM");
    } catch {
      // Process may already be gone.
    }
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
  await sleep(500);
  killEditorProcesses();
}

// --- CDP / browser -----------------------------------------------------------

async function waitForCdp(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let delayMs = 50;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${cdpUrl}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // VS Code may not be ready yet.
    }
    await sleep(delayMs);
    delayMs = Math.min(delayMs * 2, 250);
  }

  throw new Error(
    `CDP endpoint did not respond within ${timeoutMs}ms (${cdpUrl})`
  );
}

async function findWorkbenchPage(browser, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        const url = page.url();
        if (url.includes("vscode-app") || url.startsWith("vscode-file://")) {
          return page;
        }
      }
    }

    for (const context of browser.contexts()) {
      if (context.pages().length > 0) {
        return context.pages()[0];
      }
    }

    await sleep(100);
  }

  return null;
}

async function ensurePageReady(page) {
  if (page.isClosed()) {
    throw new Error("VS Code page closed unexpectedly");
  }
}

// --- Editor navigation -------------------------------------------------------

async function waitForWorkbench(page, timeoutMs = 30_000) {
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

async function waitForFixtureEditor(page, timeoutMs = 30_000) {
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

  await activeTab.waitFor({ state: "visible", timeout: 5_000 });
  await page.locator(".monaco-editor").first().waitFor({
    state: "visible",
    timeout: 5_000
  });

  const settleDeadline = Date.now() + 2_000;
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

async function prepareEditorLayout(page) {
  await page.keyboard.press("Control+Shift+F1");
  await page.keyboard.press("Control+Shift+F2");
}

async function runCommandPalette(page, command) {
  await page.keyboard.press("Control+Shift+P");
  await sleep(300);
  await page.keyboard.type(command, { delay: 15 });
  await sleep(200);
  await page.keyboard.press("Enter");
  await sleep(300);
}

async function moveCursorToLine(page, line) {
  const statusLine = page
    .locator(".statusbar-item")
    .filter({ hasText: `Ln ${line},` });
  if (await statusLine.isVisible({ timeout: 500 }).catch(() => false)) {
    return;
  }

  await dismissInitialDialogs(page);
  await page.locator(".monaco-editor").first().click();
  await sleep(100);
  await runCommandPalette(page, "Go to Line/Column");
  await page.keyboard.type(String(line), { delay: 20 });
  await page.keyboard.press("Enter");
  await sleep(300);

  if (await statusLine.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  throw new Error(`Failed to move cursor to line ${line}`);
}

// --- Dialogs / accessibility -------------------------------------------------

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
        page.getByRole("dialog", { name: "Welcome to Visual Studio Code" }).getByRole("button", { name: "Close" })
      )) ||
      (await clickIfVisible(
        page.locator(".onboarding-a-overlay button").filter({ hasText: /skip|close|later|continue without/i })
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

// --- Decorations / capture ---------------------------------------------------

async function waitForDecorations(page, timeoutMs = decorationTimeoutMs) {
  await disableScreenReaderMode(page);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const decorationSpans = await decorationSpanCount(page);
    if (decorationSpans > 10) {
      return;
    }
    await disableScreenReaderMode(page);
    await sleep(200);
  }

  console.warn("Decorations did not fully settle, continuing with capture...");
}

async function decorationSpanCount(page) {
  return page
    .locator('.view-line span[class*="TextEditorDecorationType"]')
    .count();
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

function isBlankViewport(signature) {
  const text = signature.replaceAll("|", "").trim();
  return (
    text.length < 40 ||
    (!text.includes("Row") &&
      !text.includes("Section Header") &&
      !text.includes("Lorem"))
  );
}

async function shouldStopCapture(page, frame, signature, previousSignature) {
  if (frame === 0) {
    return false;
  }

  return (
    (await decorationSpanCount(page)) < 15 ||
    isBlankViewport(signature) ||
    signature === previousSignature
  );
}

async function scrollEditorViewport(page) {
  const beforeSignature = await captureViewportSignature(page);
  const editor = page.locator(".monaco-editor").first();
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

async function captureScrollingScreenshots(page) {
  console.log(`Capturing ${fixtureBasename} (viewport scroll until end)`);

  await moveCursorToLine(page, cursorLine);
  await sleep(decorationSettleMs);

  const written = [];
  let previousSignature = "";

  for (let frame = 0; frame < maxCaptureFrames; frame += 1) {
    await ensurePageReady(page);
    const range = await readVisibleLineRange(page);
    const signature = await captureViewportSignature(page);

    if (await shouldStopCapture(page, frame, signature, previousSignature)) {
      break;
    }

    const filename = `${screenshotPrefix}-${String(written.length + 1).padStart(2, "0")}.png`;
    const filepath = path.join(screenshotsDir, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    const relativePath = path.relative(root, filepath);
    written.push(relativePath);

    const rangeLabel = range
      ? `lines ${range.top}-${range.bottom}`
      : "lines unknown";
    console.log(`Wrote ${relativePath} (${rangeLabel})`);

    previousSignature = signature;

    if (frame >= maxCaptureFrames - 1) {
      break;
    }

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
