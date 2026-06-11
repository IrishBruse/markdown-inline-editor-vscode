import type { Memento } from 'vscode';

const DECORATION_STATE_KEY_PREFIX = 'mdInline.decorationsEnabled';
const LEGACY_DECORATION_STATE_KEY_PREFIX = 'inlineMarkdown.decorationsEnabled';

function decorationStateKey(uri: string): string {
  return `${DECORATION_STATE_KEY_PREFIX}.${uri}`;
}

function readPersistedEnabled(workspaceState: Memento | undefined, uri: string): boolean | undefined {
  const key = decorationStateKey(uri);
  const current = workspaceState?.get<boolean | undefined>(key, undefined);
  if (current !== undefined) {
    return current;
  }
  return workspaceState?.get<boolean | undefined>(
    `${LEGACY_DECORATION_STATE_KEY_PREFIX}.${uri}`,
    undefined,
  );
}

export class FileDecorationStateStore {
  private readonly fileDecorationState = new Map<string, boolean>();

  constructor(private readonly workspaceState?: Memento) {}

  isEnabled(uri: string): boolean {
    let cached = this.fileDecorationState.get(uri);
    if (cached === undefined) {
      cached = readPersistedEnabled(this.workspaceState, uri) ?? true;
      this.fileDecorationState.set(uri, cached);
    }
    return cached;
  }

  toggle(uri: string): boolean {
    const next = !this.isEnabled(uri);
    this.fileDecorationState.set(uri, next);
    void this.workspaceState?.update(decorationStateKey(uri), next);
    return next;
  }

  renameFile(oldUri: string, newUri: string): void {
    const oldKey = decorationStateKey(oldUri);
    const newKey = decorationStateKey(newUri);
    const cachedValue = this.fileDecorationState.get(oldUri);

    if (cachedValue !== undefined) {
      this.fileDecorationState.set(newUri, cachedValue);
      this.fileDecorationState.delete(oldUri);
    }

    const persistedValue = cachedValue ?? readPersistedEnabled(this.workspaceState, oldUri);
    if (persistedValue !== undefined) {
      void this.workspaceState?.update(newKey, persistedValue);
      void this.workspaceState?.update(oldKey, undefined);
      void this.workspaceState?.update(`${LEGACY_DECORATION_STATE_KEY_PREFIX}.${oldUri}`, undefined);
    }
  }
}
