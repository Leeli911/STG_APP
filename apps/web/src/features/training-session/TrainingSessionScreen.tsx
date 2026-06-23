import { ExplainableRubric } from "@/components/training/ExplainableRubric";
import type { FeedbackReadyTrainingSessionDto } from "@/server/training-sessions";

export function TrainingSessionScreen({
  session
}: {
  session: FeedbackReadyTrainingSessionDto;
}) {
  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-focus">
          Day {session.practiceDay}
        </p>
        <h1 className="text-3xl font-semibold">Training Feedback</h1>
        <p className="max-w-2xl text-slate-600">
          Review how your answer was assessed before choosing what to revise.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-500">Total Score</p>
        <p className="mt-1 text-4xl font-semibold text-slate-900">
          {session.scoreBefore.total}
        </p>
      </section>

      <ExplainableRubric dimensions={session.scoreBefore.dimensions} />
    </main>
  );
}

