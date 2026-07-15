import { ISyncRepository, SyncJob } from "../interfaces/ISyncRepository";
import { db } from "../../db";
import { sync_jobs } from "../../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresSyncRepository implements ISyncRepository {
  async enqueue(jobType: string, payload: any, tx?: any): Promise<void> {
    const client = tx || db;
    const storeId = getStoreId() || 1;
    await client.insert(sync_jobs).values({
      store_id: storeId,
      job_type: jobType,
      payload: JSON.stringify(payload),
      status: "pending",
      retry_count: 0,
    });
  }

  async getPendingJob(tx?: any): Promise<SyncJob | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(sync_jobs.status, "pending");
    if (storeId !== undefined) {
      cond = and(cond, eq(sync_jobs.store_id, storeId)) as any;
    }

    // Retrieve up to 50 pending jobs to find the first one ready
    const rows = await client
      .select()
      .from(sync_jobs)
      .where(cond)
      .orderBy(sync_jobs.id)
      .limit(50);

    const now = Date.now();
    for (const r of rows) {
      // If the job has failed attempts, enforce an exponential backoff retry delay
      if (r.last_attempt && r.retry_count > 0) {
        // 1st retry: 5s, 2nd retry: 25s, 3rd retry: 125s
        const backoffMs = Math.pow(5, r.retry_count) * 1000;
        const elapsed = now - r.last_attempt.getTime();
        if (elapsed < backoffMs) {
          continue; // Skip this job for now (still in backoff window)
        }
      }

      return {
        ...r,
        status: r.status as "pending" | "completed" | "failed",
        last_attempt: r.last_attempt ? r.last_attempt.toISOString() : undefined,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
      };
    }

    return null;
  }

  async updateJobStatus(
    id: number,
    status: string,
    retryCount: number,
    errorMessage?: string,
    tx?: any
  ): Promise<void> {
    const client = tx || db;
    await client
      .update(sync_jobs)
      .set({
        status,
        retry_count: retryCount,
        error_message: errorMessage ?? null,
        updated_at: new Date(),
      })
      .where(eq(sync_jobs.id, id));
  }

  async recordJobAttempt(id: number, tx?: any): Promise<void> {
    const client = tx || db;
    await client
      .update(sync_jobs)
      .set({
        last_attempt: new Date(),
        updated_at: new Date(),
      })
      .where(eq(sync_jobs.id, id));
  }

  async retryFailedJobs(tx?: any): Promise<void> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(sync_jobs.status, "failed");
    if (storeId !== undefined) {
      cond = and(cond, eq(sync_jobs.store_id, storeId)) as any;
    }

    await client
      .update(sync_jobs)
      .set({
        status: "pending",
        retry_count: 0,
        error_message: null,
        updated_at: new Date(),
      })
      .where(cond);
  }

  async getStats(tx?: any): Promise<{
    pendingJobs: number;
    failedJobs: number;
    lastSync: string;
  }> {
    const client = tx || db;
    const storeId = getStoreId();

    let pendingCond = eq(sync_jobs.status, "pending");
    let failedCond = eq(sync_jobs.status, "failed");
    let lastSyncCond = eq(sync_jobs.status, "completed");

    if (storeId !== undefined) {
      pendingCond = and(pendingCond, eq(sync_jobs.store_id, storeId)) as any;
      failedCond = and(failedCond, eq(sync_jobs.store_id, storeId)) as any;
      lastSyncCond = and(lastSyncCond, eq(sync_jobs.store_id, storeId)) as any;
    }

    const [pendingRow] = await client
      .select({ count: sql<string>`COUNT(*)` })
      .from(sync_jobs)
      .where(pendingCond);
    const pendingJobs = Number(pendingRow?.count || 0);

    const [failedRow] = await client
      .select({ count: sql<string>`COUNT(*)` })
      .from(sync_jobs)
      .where(failedCond);
    const failedJobs = Number(failedRow?.count || 0);

    const [lastJobRow] = await client
      .select({ updated_at: sync_jobs.updated_at })
      .from(sync_jobs)
      .where(lastSyncCond)
      .orderBy(desc(sync_jobs.updated_at))
      .limit(1);
    const lastSync = lastJobRow?.updated_at ? lastJobRow.updated_at.toISOString() : "Never";

    return {
      pendingJobs,
      failedJobs,
      lastSync,
    };
  }
}
