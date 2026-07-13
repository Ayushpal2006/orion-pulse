import { ISyncRepository, SyncJob } from "../interfaces/ISyncRepository";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";

export class PostgresSyncRepository implements ISyncRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  async enqueue(jobType: string, payload: any, tx?: DatabaseAdapter): Promise<void> {
    const client = tx || this.db;
    await client.execute(`
      INSERT INTO sync_jobs (job_type, payload, status, retry_count)
      VALUES (?, ?, 'pending', 0)
    `, [jobType, JSON.stringify(payload)]);
  }

  async getPendingJob(tx?: DatabaseAdapter): Promise<SyncJob | null> {
    const client = tx || this.db;
    return client.queryOne<SyncJob>(
      "SELECT * FROM sync_jobs WHERE status = 'pending' ORDER BY id ASC LIMIT 1"
    );
  }

  async updateJobStatus(
    id: number,
    status: string,
    retryCount: number,
    errorMessage?: string,
    tx?: DatabaseAdapter
  ): Promise<void> {
    const client = tx || this.db;
    await client.execute(`
      UPDATE sync_jobs 
      SET status = ?, 
          retry_count = ?, 
          error_message = ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [status, retryCount, errorMessage ?? null, id]);
  }

  async recordJobAttempt(id: number, tx?: DatabaseAdapter): Promise<void> {
    const client = tx || this.db;
    await client.execute(
      "UPDATE sync_jobs SET last_attempt = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
  }

  async retryFailedJobs(tx?: DatabaseAdapter): Promise<void> {
    const client = tx || this.db;
    await client.execute(
      "UPDATE sync_jobs SET status = 'pending', retry_count = 0, error_message = NULL WHERE status = 'failed'"
    );
  }

  async getStats(tx?: DatabaseAdapter): Promise<{
    pendingJobs: number;
    failedJobs: number;
    lastSync: string;
  }> {
    const client = tx || this.db;

    const pendingRow = await client.queryOne<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM sync_jobs WHERE status = 'pending'"
    );
    const pendingJobs = Number(pendingRow ? pendingRow.count : 0);

    const failedRow = await client.queryOne<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM sync_jobs WHERE status = 'failed'"
    );
    const failedJobs = Number(failedRow ? failedRow.count : 0);

    const lastJobRow = await client.queryOne<{ updated_at: any }>(
      "SELECT updated_at FROM sync_jobs WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 1"
    );
    const lastSync = lastJobRow ? String(lastJobRow.updated_at) : "Never";

    return {
      pendingJobs,
      failedJobs,
      lastSync,
    };
  }
}
