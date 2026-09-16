import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextPayload {
  tenantId: string;
  userId: string;
  role: 'SUPER_ADMIN' | 'MERCHANT_OWNER' | 'CASHIER';
}

export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantContextPayload>();

  static run<R>(context: TenantContextPayload, fn: () => R): R {
    return this.storage.run(context, fn);
  }

  static get(): TenantContextPayload | undefined {
    return this.storage.getStore();
  }

  static getTenantId(): string {
    const store = this.get();
    if (!store?.tenantId) {
      throw new Error('TenantContext: No active tenant in current execution context');
    }
    return store.tenantId;
  }

  static getUserId(): string {
    const store = this.get();
    if (!store?.userId) {
      throw new Error('TenantContext: No active user in current execution context');
    }
    return store.userId;
  }

  static getRole(): string {
    const store = this.get();
    if (!store?.role) {
      throw new Error('TenantContext: No active role in current execution context');
    }
    return store.role;
  }
}
