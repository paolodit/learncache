import { decideRetry } from "./lib/jobs.js";
import {
  addLog,
  markJobComplete,
  markJobFailed,
  markJobRunning,
  markStaleRunningJobsQueued,
  nextDueJob,
  nowMs,
  updateItem
} from "./db/repository.js";
import { processItem, summarizeStoredTranscript } from "./services/processor.js";

let running = false;
let timer: NodeJS.Timeout | null = null;

export function startWorker(): void {
  markStaleRunningJobsQueued();
  timer = setInterval(() => {
    void runWorkerTick();
  }, 2_000);
  void runWorkerTick();
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function runWorkerTick(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const job = nextDueJob();
    if (!job) return;

    markJobRunning(job.id);
    try {
      if (job.type === "summarize") {
        await summarizeStoredTranscript(job.itemId);
      } else {
        await processItem(job.itemId);
      }
      markJobComplete(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retry = decideRetry(job.attempts, nowMs());
      markJobFailed(job.id, retry.attempts, message, retry.retryAt);
      addLog(job.itemId, retry.final ? "error" : "warn", retry.final ? `Processing failed: ${message}` : `Processing failed, retry queued: ${message}`);

      if (retry.final) {
        updateItem(job.itemId, { status: "failed", error: message });
      } else {
        updateItem(job.itemId, { status: "queued", error: message });
      }
    }
  } finally {
    running = false;
  }
}
