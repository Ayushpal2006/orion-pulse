import { Pool, PoolClient } from "pg";
import { DatabaseAdapter, PreparedStatement } from "../database-adapter.interface";
import { logger } from "../../logger/logger";

function translateQuery(sql: string, params?: any[] | Record<string, any>): { sql: string; values: any[] } {
  // 1. If it's an INSERT query and doesn't have a RETURNING clause, append it
  let processedSql = sql;
  const isInsert = /^\s*insert\s+into/i.test(sql);
  const hasReturning = /returning\s+/i.test(sql);
  if (isInsert && !hasReturning) {
    if (/insert\s+into\s+settings/i.test(sql)) {
      processedSql += " RETURNING key";
    } else {
      processedSql += " RETURNING id";
    }
  }

  if (!params) {
    return { sql: processedSql, values: [] };
  }

  const values: any[] = [];

  if (Array.isArray(params)) {
    let paramIndex = 1;
    processedSql = processedSql.replace(/\?/g, () => {
      const placeholder = `$${paramIndex}`;
      paramIndex++;
      return placeholder;
    });
    return { sql: processedSql, values: params };
  } else {
    // Named parameters like @name, $startDate, etc.
    const regex = /([@$:][a-zA-Z_][a-zA-Z0-9_]*)/g;
    const matches = processedSql.match(regex);
    if (!matches) {
      return { sql: processedSql, values: [] };
    }

    const paramMap: Record<string, number> = {};
    let paramIndex = 1;

    processedSql = processedSql.replace(regex, (match) => {
      const name = match.substring(1); // remove prefix symbol (@, $, :)
      if (!(name in paramMap)) {
        paramMap[name] = paramIndex;
        const val = params[name] !== undefined ? params[name] : null;
        values.push(val);
        paramIndex++;
      }
      return `$${paramMap[name]}`;
    });

    return { sql: processedSql, values };
  }
}

class PostgresPreparedStatement implements PreparedStatement {
  constructor(private pool: Pool | PoolClient, private sql: string) {}

  async all<T>(params?: any[] | Record<string, any>): Promise<T[]> {
    const { sql, values } = translateQuery(this.sql, params);
    const res = await this.pool.query(sql, values);
    return res.rows as T[];
  }

  async get<T>(params?: any[] | Record<string, any>): Promise<T | null> {
    const { sql, values } = translateQuery(this.sql, params);
    const res = await this.pool.query(sql, values);
    return (res.rows[0] as T) || null;
  }

  async run(params?: any[] | Record<string, any>): Promise<{ changes: number; lastInsertId?: number | string }> {
    const { sql, values } = translateQuery(this.sql, params);
    const res = await this.pool.query(sql, values);
    const lastRow = res.rows[0];
    let lastInsertId: number | string | undefined;
    if (lastRow) {
      lastInsertId = lastRow.id !== undefined ? lastRow.id : (lastRow.key !== undefined ? lastRow.key : undefined);
    }
    return {
      changes: res.rowCount ?? 0,
      lastInsertId,
    };
  }
}

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;
  private clientInTransaction?: PoolClient;

  constructor(connectionStringOrPool: string | Pool, client?: PoolClient) {
    if (typeof connectionStringOrPool === "string") {
      this.pool = new Pool({
        connectionString: connectionStringOrPool,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      this.pool.on("error", (err) => {
        logger.error("Unexpected error on idle PostgreSQL client", err);
      });
    } else {
      this.pool = connectionStringOrPool;
      this.clientInTransaction = client;
    }
  }

  private getExecutor(): Pool | PoolClient {
    return this.clientInTransaction || this.pool;
  }

  async query<T>(sql: string, params?: any[] | Record<string, any>): Promise<T[]> {
    const { sql: pgSql, values } = translateQuery(sql, params);
    const res = await this.getExecutor().query(pgSql, values);
    return res.rows as T[];
  }

  async queryOne<T>(sql: string, params?: any[] | Record<string, any>): Promise<T | null> {
    const { sql: pgSql, values } = translateQuery(sql, params);
    const res = await this.getExecutor().query(pgSql, values);
    return (res.rows[0] as T) || null;
  }

  async execute(sql: string, params?: any[] | Record<string, any>): Promise<{ changes: number; lastInsertId?: number | string }> {
    const { sql: pgSql, values } = translateQuery(sql, params);
    const res = await this.getExecutor().query(pgSql, values);
    const lastRow = res.rows[0];
    let lastInsertId: number | string | undefined;
    if (lastRow) {
      lastInsertId = lastRow.id !== undefined ? lastRow.id : (lastRow.key !== undefined ? lastRow.key : undefined);
    }
    return {
      changes: res.rowCount ?? 0,
      lastInsertId,
    };
  }

  async prepare(sql: string): Promise<PreparedStatement> {
    return new PostgresPreparedStatement(this.getExecutor(), sql);
  }

  async transaction<T>(cb: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    if (this.clientInTransaction) {
      // Already inside a transaction, reuse current adapter
      return cb(this);
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const txAdapter = new PostgresAdapter(this.pool, client);
      const result = await cb(txAdapter);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
