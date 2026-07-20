import type {
  AiBackgroundResponseResult,
  AiBackgroundResponseStatus
} from "@/server/ai/types";
import type {
  AiBackgroundProvider,
  AiJobRepository,
  AiJobResultHandler,
  ClaimedAiJob
} from "@/server/ai/jobs/types";

export type ReconcileSummary = {
  claimed: number;
  completed: number;
  failed: number;
  pending: number;
};

export function createAiJobReconcileService({
  repository,
  provider,
  resultHandler,
  now = () => new Date()
}: {
  repository: AiJobRepository;
  provider: AiBackgroundProvider;
  resultHandler: AiJobResultHandler;
  now?: () => Date;
}) {
  return {
    async reconcile({
      staleAfterMs = 60_000,
      limit = 25
    }: {
      staleAfterMs?: number;
      limit?: number;
    } = {}): Promise<ReconcileSummary> {
      const staleBefore = new Date(now().getTime() - staleAfterMs).toISOString();
      const jobs = await repository.claimReconcileCandidates({
        staleBefore,
        limit
      });
      const summary: ReconcileSummary = {
        claimed: jobs.length,
        completed: 0,
        failed: 0,
        pending: 0
      };

      for (const job of jobs) {
        if (job.status === "queued") {
          try {
            await submitClaimedAiJob(job, provider, repository);
          } catch {
            // Keep the durable queued intent. Its lease expiry makes it eligible
            // for a later retry; the stable Provider key prevents double charge.
          }
          // Submission is retryable with the job-bound idempotency key. Even if
          // the process dies after Provider acceptance but before attach, the
          // next reconciler pass safely obtains the same response.
          summary.pending += 1;
          continue;
        }

        const response = await provider.retrieveBackgroundJson(
          requireProviderResponseId(job)
        );
        await dispatchProviderResponse(job, response, resultHandler, repository);
        const bucket = responseBucket(response.status);
        summary[bucket] += 1;
      }

      return summary;
    }
  };
}

export async function submitClaimedAiJob(
  job: ClaimedAiJob,
  provider: AiBackgroundProvider,
  repository: AiJobRepository
) {
  if (job.status !== "queued") {
    throw new Error(`AI job ${job.id} is not queued for Provider submission.`);
  }
  const response = await provider.startBackgroundJson({
    ...job.requestPayload,
    idempotencyKey: job.providerIdempotencyKey
  });
  return repository.attachProviderResponse(
    job.id,
    job.leaseToken,
    response.responseId
  );
}

export async function dispatchProviderResponse(
  job: ClaimedAiJob,
  response: AiBackgroundResponseResult,
  resultHandler: AiJobResultHandler,
  repository: AiJobRepository
) {
  if (response.status === "completed") {
    await resultHandler.onCompleted(job, response);
    return;
  }

  if (isTerminalFailure(response.status)) {
    await resultHandler.onFailed(job, response);
    return;
  }

  // Release the reconcile/webhook claim as a retryable failure only when the
  // provider did not return a valid pending state. Normal queued/in-progress jobs
  // are left leased until the next reconcile window.
  if (response.status !== "queued" && response.status !== "in_progress") {
    await repository.fail({
      jobId: job.id,
      leaseToken: job.leaseToken,
      errorCode: "PROVIDER_STATUS_INVALID",
      errorMessage: `Unexpected provider status ${response.status}.`
    });
  }
}

function requireProviderResponseId(job: ClaimedAiJob) {
  if (!job.providerResponseId) {
    throw new Error(`AI job ${job.id} is missing provider_response_id.`);
  }
  return job.providerResponseId;
}

function isTerminalFailure(status: AiBackgroundResponseStatus) {
  return status === "failed" || status === "cancelled" || status === "incomplete";
}

function responseBucket(
  status: AiBackgroundResponseStatus
): "completed" | "failed" | "pending" {
  if (status === "completed") return "completed";
  if (isTerminalFailure(status)) return "failed";
  return "pending";
}
