#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspacePath = path.join(root, "docs");
const fixturePath = path.join(workspacePath, "tests/05-tables.md");
const outputPath = path.join(root, "screenshot.png");
const userDataDir = path.join(root, ".vscode-screenshot-profile");
const extensionBundle = path.join(root, "dist/extension.js");
const targetLine = 326;
const cdpPort = Number(process.env.CDP_PORT ?? "9223");
const cdpUrl = `http://127.0.0.1:${cdpPort}`;
const codeBin = process.env.CODE_BIN ?? "code";

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

function ensureScreenshotProfile() {
  const userDir = path.join(userDataDir, "User");
  const settingsPath = path.join(userDir, "settings.json");
  const keybindingsPath = path.join(userDir, "keybindings.json");
  fs.mkdirSync(userDir, { recursive: true });

  const settings = {
    "workbench.startupEditor": "none",
    "workbench.welcome.enabled": false,
    "extensions.ignoreRecommendations": true,
    "task.allowAutomaticTasks": "on",
    "editor.minimap.enabled": false,
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

function findWorkbenchPage(browser) {
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

  return null;
}

async function clickIfVisible(locator, timeoutMs = 400) {
  if (await locator.isVisible({ timeout: timeoutMs }).catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

async function dismissInitialDialogs(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const dismissed =
      (await clickIfVisible(
        page.getByText("Continue without Signing In", { exact: false })
      )) ||
      (await clickIfVisible(
        page.getByRole("button", { name: "Continue", exact: true })
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

async function prepareEditorLayout(page) {
  await page.keyboard.press("Control+Shift+F1");
  await page.keyboard.press("Control+Shift+F2");
}

async function waitForFixtureEditor(page, timeoutMs = 20_000) {
  await page
    .locator(".tab.active")
    .filter({ hasText: "05-tables.md" })
    .waitFor({ state: "visible", timeout: timeoutMs });
  await page.locator(".monaco-editor").first().waitFor({
    state: "visible",
    timeout: timeoutMs
  });

  const deadline = Date.now() + 1_500;
  let lastLineCount = 0;
  while (Date.now() < deadline) {
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
  if (page) {
    await page.keyboard.press("Control+Shift+F4").catch(() => {});
    await sleep(200);
  }
  if (browser) {
    await browser.close().catch(() => {});
  }
  killEditorProcesses();
}

async function main() {
  ensureExtensionBuilt();
  ensureScreenshotProfile();

  const which = spawnSync("which", [codeBin], { encoding: "utf8" });
  if (which.status !== 0 || !which.stdout.trim()) {
    throw new Error(`Editor binary not found on PATH: ${codeBin}`);
  }

  const gotoTarget = `${fixturePath}:${targetLine}:1`;
  const args = [
    "--new-window",
    `--extensionDevelopmentPath=${root}`,
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    `--goto=${gotoTarget}`,
    workspacePath
  ];

  console.log(
    `Launching ${codeBin} with docs workspace at line ${targetLine}...`
  );
  spawn(codeBin, args, {
    cwd: root,
    detached: true,
    stdio: "ignore"
  }).unref();

  await waitForCdp();
  console.log("CDP ready, waiting for editor...");

  const browser = await chromium.connectOverCDP(cdpUrl);
  let page;

  try {
    page = findWorkbenchPage(browser);
    if (!page) {
      throw new Error("Could not find VS Code workbench page over CDP");
    }

    await dismissInitialDialogs(page);
    await prepareEditorLayout(page);
    await waitForFixtureEditor(page);

    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`Wrote ${path.relative(root, outputPath)}`);
  } finally {
    await shutdown(page, browser);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
