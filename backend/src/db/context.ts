import { AsyncLocalStorage } from "async_hooks";

export interface StoreContext {
  storeId: number;
  userId: number;
  role: string;
}

export const storeStorage = new AsyncLocalStorage<StoreContext>();

export function getStoreId(): number | undefined {
  return storeStorage.getStore()?.storeId;
}

export function getUserId(): number | undefined {
  return storeStorage.getStore()?.userId;
}

export function getRole(): string | undefined {
  return storeStorage.getStore()?.role;
}
