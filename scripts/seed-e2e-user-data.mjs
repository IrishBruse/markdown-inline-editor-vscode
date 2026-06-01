import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const visualE2e = process.env.MD_INLINE_VISUAL_E2E === '1'
  || process.env.UPDATE_VISUAL_BASELINES === '1';
const settingsFile = visualE2e ? 'e2e-visual-user-settings.json' : 'e2e-user-settings.json';
const settingsSource = join(root, 'src/test/e2e', settingsFile);
const settingsTarget = join(root, '.vscode-test/user-data/User/settings.json');

const settings = await readFile(settingsSource, 'utf8');
await mkdir(dirname(settingsTarget), { recursive: true });
await writeFile(settingsTarget, `${settings.trim()}\n`, 'utf8');
