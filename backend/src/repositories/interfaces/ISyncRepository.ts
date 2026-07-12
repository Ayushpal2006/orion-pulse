import { DatabaseAdapter } from "../../database";

export interface SyncJob {
  id: number;
  job_type: string;
  payload: string;
  status: "pending" | "completed" | "failed";
  retry_count: number;
  error_message?: string;
  last_attempt?: string;
  created_at: string;
  updated_at: string;
}

export interface ISyncRepository {
  enqueue(jobType: string, payload: any, tx?: DatabaseAdapter): Promise<void>;
  getPendingJob(tx?: DatabaseAdapter): Promise<SyncJob | null>;
  updateJobStatus(id: number, status: string, retryCount: number, errorMessage?: string, tx?: DatabaseAdapter): Promise<void>;
  recordJobAttempt(id: number, tx?: DatabaseAdapter): Promise<void>;
  retryFailedJobs(tx?: DatabaseAdapter): Promise<void>;
  getStats(tx?: DatabaseAdapter): Promise<{
    pendingJobs: number;
    failedJobs: number;
    lastSync: string;
  }>;
}
