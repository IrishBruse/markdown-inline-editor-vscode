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
const scrollLine = 326;
const cursorLine = 326;
const cdpPort = Number(process.env.CDP_PORT ?? "9223");
const cdpUrl = `http://127.0.0.1:${cdpPort}`;
const codeBin = process.env.CODE_BIN ?? "code";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "git.openRepositoryInParentFolders": "never"
  };

  if (fs.existsSync(settingsPath)) {
    const existing = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ ...existing, ...settings }, null, 2) + "\n"
    );
  } else {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  }

  const keybindings = [
    { key: "ctrl+shift+f1", command: "workbench.action.closeSidebar" },
    { key: "ctrl+shift+f2", command: "workbench.action.closeAuxiliaryBar" },
    { key: "ctrl+shift+f4", command: "workbench.action.quit" }
  ];
  fs.writeFileSync(
    keybindingsPath,
    JSON.stringify(keybindings, null, 2) + "\n"
  );
}

async function waitForCdp(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${cdpUrl}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // VS Code may not be ready yet.
    }
    await sleep(500);
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

async function dismissInitialDialogs(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const continueWithoutSignIn = page.getByText(
      "Continue without Signing In",
      { exact: false }
    );
    if (
      await continueWithoutSignIn
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      await continueWithoutSignIn.click();
      await sleep(500);
      continue;
    }

    const continueButton = page.getByRole("button", {
      name: "Continue",
      exact: true
    });
    if (await continueButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await continueButton.click();
      await sleep(500);
      continue;
    }

    const closeButton = page
      .locator(".dialog-buttons-row .monaco-button")
      .filter({ hasText: "Close" });
    if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeButton.click();
      await sleep(500);
      continue;
    }

    break;
  }

  const notificationClose = page.locator(
    ".notifications-toasts .codicon-close"
  );
  const toastCount = await notificationClose.count();
  for (let i = 0; i < toastCount; i += 1) {
    await notificationClose
      .first()
      .click({ timeout: 500 })
      .catch(() => {});
    await sleep(100);
  }

  const gitNever = page.getByRole("button", { name: "Never", exact: true });
  if (await gitNever.isVisible({ timeout: 500 }).catch(() => false)) {
    await gitNever.click();
    await sleep(100);
  }

  await page.keyboard.press("Escape");
  await sleep(100);
}

async function openFixtureAtLine(page) {
  await page.keyboard.press("Control+P");
  await sleep(300);
  await page.keyboard.type("tests/05-tables.md");
  await sleep(300);
  await page.keyboard.press("Enter");
  await sleep(1000);

  await page.keyboard.press("Control+G");
  await sleep(200);
  await page.keyboard.type(String(cursorLine));
  await page.keyboard.press("Enter");
  await sleep(500);
}

async function prepareEditorLayout(page) {
  await page.keyboard.press("Control+Shift+F1");
  await page.keyboard.press("Control+Shift+F2");
  await sleep(150);
}

async function closeVscodeApp(page) {
  if (page) {
    await page.keyboard.press("Control+Shift+F4").catch(() => {});
    await sleep(400);
  }

  spawnSync("pkill", ["-f", `--user-data-dir=${userDataDir}`], {
    stdio: "ignore"
  });

  const lsof = spawnSync("lsof", ["-ti", `:${cdpPort}`], { encoding: "utf8" });
  for (const pid of lsof.stdout.trim().split("\n")) {
    if (!pid) {
      continue;
    }
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // Process may already be gone.
    }
  }

  await sleep(300);
}

let workbenchPage;

async function main() {
  ensureExtensionBuilt();
  ensureScreenshotProfile();

  const which = spawnSync("which", [codeBin], { encoding: "utf8" });
  if (which.status !== 0 || !which.stdout.trim()) {
    throw new Error(`Editor binary not found on PATH: ${codeBin}`);
  }

  const gotoTarget = `${fixturePath}:${scrollLine}:1`;
  const args = [
    "--new-window",
    `--extensionDevelopmentPath=${root}`,
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    `--goto=${gotoTarget}`,
    workspacePath
  ];

  console.log(
    `Launching ${codeBin} with docs workspace at line ${scrollLine}...`
  );
  spawn(codeBin, args, {
    cwd: root,
    detached: true,
    stdio: "ignore"
  }).unref();

  await waitForCdp();
  console.log("CDP ready, waiting for decorations...");
  await sleep(1000);

  const browser = await chromium.connectOverCDP(cdpUrl);
  try {
    workbenchPage = findWorkbenchPage(browser);
    if (!workbenchPage) {
      throw new Error("Could not find VS Code workbench page over CDP");
    }

    await dismissInitialDialogs(workbenchPage);
    await prepareEditorLayout(workbenchPage);
    await openFixtureAtLine(workbenchPage);
    await sleep(2000);

    await workbenchPage.screenshot({ path: outputPath, fullPage: false });
    console.log(`Wrote ${path.relative(root, outputPath)}`);

    await closeVscodeApp(workbenchPage);
    workbenchPage = undefined;
  } finally {
    await browser.close().catch(() => {});
    await closeVscodeApp(workbenchPage);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
