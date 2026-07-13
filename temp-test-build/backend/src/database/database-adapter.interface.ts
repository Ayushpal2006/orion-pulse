export interface PreparedStatement {
  all<T>(params?: any[] | Record<string, any>): Promise<T[]>;
  get<T>(params?: any[] | Record<string, any>): Promise<T | null>;
  run(params?: any[] | Record<string, any>): Promise<{ changes: number; lastInsertId?: number | string }>;
}

export interface DatabaseAdapter {
  query<T>(sql: string, params?: any[] | Record<string, any>): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[] | Record<string, any>): Promise<T | null>;
  execute(sql: string, params?: any[] | Record<string, any>): Promise<{ changes: number; lastInsertId?: number | string }>;
  prepare(sql: string): Promise<PreparedStatement>;
  transaction<T>(cb: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  backup?(destPath: string): Promise<void>;
}
