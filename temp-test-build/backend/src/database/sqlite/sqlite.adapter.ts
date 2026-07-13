import Database from "better-sqlite3";
import { DatabaseAdapter, PreparedStatement } from "../database-adapter.interface";

class SQLitePreparedStatement implements PreparedStatement {
  constructor(private stmt: Database.Statement) {}

  async all<T>(params?: any[] | Record<string, any>): Promise<T[]> {
    if (params) {
      if (Array.isArray(params)) {
        return this.stmt.all(...params) as T[];
      } else {
        return this.stmt.all(params) as T[];
      }
    }
    return this.stmt.all() as T[];
  }

  async get<T>(params?: any[] | Record<string, any>): Promise<T | null> {
    let result: any;
    if (params) {
      if (Array.isArray(params)) {
        result = this.stmt.get(...params);
      } else {
        result = this.stmt.get(params);
      }
    } else {
      result = this.stmt.get();
    }
    return (result as T) || null;
  }

  async run(params?: any[] | Record<string, any>): Promise<{ changes: number; lastInsertId?: number | string }> {
    let result: Database.RunResult;
    if (params) {
      if (Array.isArray(params)) {
        result = this.stmt.run(...params);
      } else {
        result = this.stmt.run(params);
      }
    } else {
      result = this.stmt.run();
    }
    return {
      changes: result.changes,
      lastInsertId: Number(result.lastInsertRowid),
    };
  }
}

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor(dbPathOrDb: string | Database.Database) {
    if (typeof dbPathOrDb === "string") {
      this.db = new Database(dbPathOrDb);
      this.db.pragma("journal_mode = WAL");
    } else {
      this.db = dbPathOrDb;
    }
  }

  // Exposed for backup/restore operations that need the underlying better-sqlite3 object
  getNativeConnection(): Database.Database {
    return this.db;
  }

  async query<T>(sql: string, params?: any[] | Record<string, any>): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    if (params) {
      if (Array.isArray(params)) {
        return stmt.all(...params) as T[];
      } else {
        return stmt.all(params) as T[];
      }
    }
    return stmt.all() as T[];
  }

  async queryOne<T>(sql: string, params?: any[] | Record<string, any>): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    let result: any;
    if (params) {
      if (Array.isArray(params)) {
        result = stmt.get(...params);
      } else {
        result = stmt.get(params);
      }
    } else {
      result = stmt.get();
    }
    return (result as T) || null;
  }

  async execute(sql: string, params?: any[] | Record<string, any>): Promise<{ changes: number; lastInsertId?: number | string }> {
    const stmt = this.db.prepare(sql);
    let result: Database.RunResult;
    if (params) {
      if (Array.isArray(params)) {
        result = stmt.run(...params);
      } else {
        result = stmt.run(params);
      }
    } else {
      result = stmt.run();
    }
    return {
      changes: result.changes,
      lastInsertId: Number(result.lastInsertRowid),
    };
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    return new SQLitePreparedStatement(this.db.prepare(sql));
  }

  async transaction<T>(cb: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const result = await cb(this);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async backup(destPath: string): Promise<void> {
    await this.db.backup(destPath);
  }
}
