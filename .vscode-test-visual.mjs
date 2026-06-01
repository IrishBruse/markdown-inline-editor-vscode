import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
  {
    files: 'dist/test/e2e/suite/table-visual.test.js',
    launchArgs: [
      '--remote-debugging-port=9333',
      '--disable-gpu',
      '--force-device-scale-factor=1',
      '--window-size=1024,768',
    ],
    mocha: {
      ui: 'tdd',
      timeout: 120000,
    },
  },
]);
