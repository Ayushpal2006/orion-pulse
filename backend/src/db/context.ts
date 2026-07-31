import { AsyncLocalStorage } from "async_hooks";

export interface TenantContext {
  userId: number;
  organizationId: number;
  currentStoreId: number;
  role: string;
}

export interface StoreContext extends TenantContext {
  storeId: number;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

// Backward compatibility alias for storeStorage
export const storeStorage = {
  run: <R>(context: { storeId?: number; currentStoreId?: number; organizationId?: number; userId: number; role: string }, callback: () => R): R => {
    const tenantCtx: TenantContext = {
      userId: context.userId,
      organizationId: context.organizationId ?? 0,
      currentStoreId: context.currentStoreId ?? context.storeId ?? 0,
      role: context.role,
    };
    return tenantStorage.run(tenantCtx, callback);
  },
  getStore: (): StoreContext | undefined => {
    const store = tenantStorage.getStore();
    if (!store) return undefined;
    return {
      ...store,
      storeId: store.currentStoreId,
    };
  },
};

export function getTenantContext(): TenantContext {
  const store = tenantStorage.getStore();
  if (!store) {
    return {
      userId: 0,
      organizationId: 0,
      currentStoreId: 0,
      role: "none",
    };
  }
  return {
    userId: store.userId,
    organizationId: store.organizationId,
    currentStoreId: store.currentStoreId,
    role: store.role,
  };
}

export function getOrganizationId(): number {
  return getTenantContext().organizationId;
}

export function getStoreId(): number {
  return getTenantContext().currentStoreId;
}

export function getUserId(): number {
  return getTenantContext().userId;
}

export function getRole(): string {
  return getTenantContext().role;
}
