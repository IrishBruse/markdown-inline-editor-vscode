import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

const root = dirname(fileURLToPath(import.meta.url));
const binName = 'vscode-test' + (process.platform === 'win32' ? '.cmd' : '');
const bin = join(root, '..', 'node_modules', '.bin', binName);
const isUpdate = process.argv.includes('--update');

const env = {
  ...process.env,
  MD_INLINE_VISUAL_E2E: '1',
};

if (isUpdate) {
  env.UPDATE_VISUAL_BASELINES = '1';
}

const [cmd, args] = process.platform === 'win32'
  ? ['cmd.exe', ['/c', bin, '--config', '.vscode-test-visual.mjs']]
  : [bin, ['--config', '.vscode-test-visual.mjs']];

const child = spawn(cmd, args, {
  cwd: join(root, '..'),
  env,
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
