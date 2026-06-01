import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const settingsSource = join(root, 'src/test/e2e/e2e-user-settings.json');
const settingsTarget = join(root, '.vscode-test/user-data/User/settings.json');

const settings = await readFile(settingsSource, 'utf8');
await mkdir(dirname(settingsTarget), { recursive: true });
await writeFile(settingsTarget, `${settings.trim()}\n`, 'utf8');
