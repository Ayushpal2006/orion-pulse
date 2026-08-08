import { ISyncRepository, SyncJob } from "../interfaces/ISyncRepository";
import { db } from "../../db";
import { sync_jobs } from "../../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getTenantContext } from "../../db/context";

export class PostgresSyncRepository implements ISyncRepository {
  async enqueue(jobType: string, payload: any, tx?: any): Promise<void> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    const payloadOrgId = payload?.organization_id ?? organizationId ?? null;
    const payloadStoreId = payload?.store_id ?? currentStoreId ?? 1;

    await client.insert(sync_jobs).values({
      organization_id: payloadOrgId && payloadOrgId > 0 ? payloadOrgId : null,
      store_id: payloadStoreId,
      job_type: jobType,
      payload: JSON.stringify(payload),
      status: "pending",
      retry_count: 0,
    });
  }

  async getPendingJob(tx?: any): Promise<SyncJob | null> {
    const client = tx || db;
    const { currentStoreId } = getTenantContext();

    let cond = eq(sync_jobs.status, "pending") as any;
    if (currentStoreId && currentStoreId > 0) {
      cond = and(eq(sync_jobs.status, "pending"), eq(sync_jobs.store_id, currentStoreId));
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
        organization_id: r.organization_id,
        store_id: r.store_id,
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
    const { currentStoreId } = getTenantContext();
    let cond = eq(sync_jobs.status, "failed") as any;
    if (currentStoreId && currentStoreId > 0) {
      cond = and(eq(sync_jobs.status, "failed"), eq(sync_jobs.store_id, currentStoreId));
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
    const { currentStoreId } = getTenantContext();

    let pendingCond = eq(sync_jobs.status, "pending") as any;
    let failedCond = eq(sync_jobs.status, "failed") as any;
    let lastSyncCond = eq(sync_jobs.status, "completed") as any;

    if (currentStoreId && currentStoreId > 0) {
      pendingCond = and(eq(sync_jobs.status, "pending"), eq(sync_jobs.store_id, currentStoreId));
      failedCond = and(eq(sync_jobs.status, "failed"), eq(sync_jobs.store_id, currentStoreId));
      lastSyncCond = and(eq(sync_jobs.status, "completed"), eq(sync_jobs.store_id, currentStoreId));
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
