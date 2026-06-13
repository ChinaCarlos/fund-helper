import type { ExtensionContext } from 'vscode';
import type { YjbSession } from './types/portfolio';

const STORAGE_KEY = 'yjb_session';

export class SessionStore {
  constructor(private readonly context: ExtensionContext) {}

  load(): YjbSession | null {
    return this.context.globalState.get<YjbSession>(STORAGE_KEY) ?? null;
  }

  async save(session: YjbSession): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, session);
  }

  async clear(): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, undefined);
  }
}
