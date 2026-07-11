/**
 * Runs the Cursor e2e tests and filters out Cursor's own internal noise from
 * stdout/stderr, keeping all Mocha test output intact.
 *
 * Noise is identified by trigger patterns and suppressed as multi-line blocks
 * (stack traces + following JSON objects) until brace depth returns to zero.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

/** Lines that start a suppressible noise block. */
const TRIGGER_PATTERNS = [
  // Cursor auth errors (followed by stack trace + {…} object)
  /\[unauthenticated\]/,
  /^Error fetching user /,

  // Cursor / VS Code internal startup and config noise
  /^\[main \d{4}-/,
  /^\[CursorExtensionIsolationService\]/,
  /^\[CursorProclist/,
  /^\[cursor-agent-exec\]/,
  /^\[cursor-resolver\]/,
  /^\[WorktreeCleanupCron\]/,
  /^\[Debug\] Registered command palette/,
  /^\[LocalProcessExtensionHost\]/,
  /^\[MainThreadCursor\]/,
  /^\[MainThreadShellExec\]/,
  /^\[ShellExec\]/,
  /^\[storage\]/,
  /^\[Cursor Proclist/,
  /^Via 'product\.json#extensionEnabledApiProposals'/,
  /^Missing property "[^"]+" in oldValue\./,
  /^Unexpected error checking unified sidebar/,
  /^Started (local extension host|initializing default profile)/,
  /^Completed initializing default profile/,
  /^Loading development extension/,
  /^OpenInBrowserWatcher/,
  /^repoResult\.error/,

  // Node deprecation warnings (from Cursor's own process)
  /^\(node:\d+\) \[DEP0/,
];

/**
 * Lines that are always suppressed on their own AND keep continuation alive.
 * Used to skip "Require stack:" + path list lines between a [main …] trigger
 * and the following "    at …" stack trace lines.
 */
const CONTINUATION_PATTERNS = [
  /^\(Use `(Cursor|node) --trace-deprecation/,
  /^Require stack:/,
  /^- [A-Za-z]:\\/,  // Windows require-stack path
  /^- \//,            // Unix require-stack path
];

function makeFilter() {
  let inBlock = false;       // inside a {…} / […] block
  let blockDepth = 0;
  let inContinuation = false; // after a trigger, waiting for stack trace or block

  return function shouldSuppress(line) {
    // ── Inside an open brace/bracket block ───────────────────────────────
    if (inBlock) {
      for (const ch of line) {
        if (ch === '{' || ch === '[') blockDepth++;
        if (ch === '}' || ch === ']') blockDepth--;
      }
      if (blockDepth <= 0) {
        inBlock = false;
        blockDepth = 0;
        inContinuation = false;
      }
      return true;
    }

    // ── In a noise continuation (stack trace or helper lines) ────────────
    if (inContinuation) {
      // Continuation lines: "    at …" stack frames or known helper patterns
      if (/^\s{4}at /.test(line) || CONTINUATION_PATTERNS.some(p => p.test(line))) {
        // If this line opens a block, transition to inBlock mode
        let d = 0;
        for (const ch of line) {
          if (ch === '{' || ch === '[') d++;
          if (ch === '}' || ch === ']') d--;
        }
        if (d > 0) {
          inBlock = true;
          blockDepth = d;
          inContinuation = false;
        }
        return true;
      }
      inContinuation = false;
    }

    // ── Fresh trigger line ───────────────────────────────────────────────
    if (TRIGGER_PATTERNS.some(p => p.test(line))) {
      let d = 0;
      for (const ch of line) {
        if (ch === '{' || ch === '[') d++;
        if (ch === '}' || ch === ']') d--;
      }
      if (d > 0) {
        inBlock = true;
        blockDepth = d;
      } else {
        inContinuation = true;
      }
      return true;
    }

    return false;
  };
}

const suppress = makeFilter();
let pending = '';

function processChunk(chunk) {
  pending += chunk.toString();
  const lines = pending.split('\n');
  pending = lines.pop();
  for (const line of lines) {
    if (!suppress(line)) process.stdout.write(line + '\n');
  }
}

const root = dirname(fileURLToPath(import.meta.url));

// On Windows, .bin entries are .cmd wrappers — invoke via cmd.exe directly
// to avoid the DEP0190 shell-option warning that `shell: true` produces.
const binName = 'vscode-test' + (process.platform === 'win32' ? '.cmd' : '');
const bin = join(root, '..', 'node_modules', '.bin', binName);
const [cmd, cmdArgs] =
  process.platform === 'win32'
    ? ['cmd.exe', ['/c', bin, '--config', '.vscode-test-cursor.mjs']]
    : [bin, ['--config', '.vscode-test-cursor.mjs']];

const child = spawn(cmd, cmdArgs, {
  stdio: ['inherit', 'pipe', 'pipe'],
  cwd: join(root, '..'),
});

child.stdout.on('data', processChunk);
child.stderr.on('data', processChunk);

child.on('close', (code) => {
  if (pending) process.stdout.write(pending + '\n');
  process.exit(code ?? 0);
});
