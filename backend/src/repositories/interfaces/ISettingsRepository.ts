import { DatabaseAdapter } from "../../database";

export interface ISettingsRepository {
  getAll(tx?: DatabaseAdapter): Promise<Record<string, string>>;
  get(key: string, fallback?: string, tx?: DatabaseAdapter): Promise<string>;
  set(key: string, value: string, tx?: DatabaseAdapter): Promise<void>;
  setMany(settings: Record<string, string>, tx?: DatabaseAdapter): Promise<void>;
}
