import type { TrainingSessionDto } from "@/server/training-sessions/types";

type SuggestionPanelProps = {
  suggestion: TrainingSessionDto["suggestion"];
};

export function SuggestionPanel({ suggestion }: SuggestionPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-500">AI Suggestion</p>
        <p className="inline-flex rounded-full bg-focus/10 px-3 py-1 text-sm font-medium text-focus">
          {suggestion.structureUsed}
        </p>
        <p className="whitespace-pre-wrap text-base leading-7 text-slate-900">
          {suggestion.text}
        </p>
      </div>

      {suggestion.whyBetter.length > 0 ? (
        <div className="mt-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Why this is stronger
          </h2>
          <ul className="space-y-3">
            {suggestion.whyBetter.map((item, index) => (
              <li
                className="rounded-md bg-slate-50 p-3 text-sm text-slate-700"
                key={`${item.changed_what}-${index}`}
              >
                <p className="font-medium text-slate-900">
                  {item.changed_what}
                </p>
                <p className="mt-1">{item.why_changed}</p>
                <p className="mt-1 text-slate-600">{item.impact}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
