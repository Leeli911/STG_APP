import type { ExplainableDimensionDto } from "@/server/training-sessions";

export function ExplainableRubric({
  dimensions
}: {
  dimensions: ExplainableDimensionDto[];
}) {
  if (dimensions.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Score Breakdown</h2>
        <p className="mt-2 text-slate-600">
          Detailed rubric is unavailable for this earlier attempt.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="explainable-rubric-title"
      className="space-y-4"
    >
      <div className="space-y-1">
        <h2 id="explainable-rubric-title" className="text-xl font-semibold">
          Score Breakdown
        </h2>
        <p className="text-sm text-slate-600">
          See the evidence behind each dimension and the clearest next focus.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {dimensions.map((item) => (
          <article
            key={item.dimension}
            className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
          >
            <header className="flex items-start justify-between gap-4">
              <h3 className="font-semibold text-slate-900">
                {item.displayName}
              </h3>
              <p className="shrink-0 text-lg font-semibold text-slate-900">
                {item.score} / {item.maxScore}
              </p>
            </header>

            <RubricDetail label="Evidence">
              <p>{item.evidence}</p>
            </RubricDetail>

            <RubricDetail label="Deductions">
              {item.deductions.length === 0 ? (
                <p>No deductions recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {item.deductions.map((deduction) => (
                    <li key={`${deduction.rule}-${deduction.points}`}>
                      <span>{deduction.reason}</span>
                      <span className="ml-2 text-slate-500">
                        −{deduction.points} pts
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RubricDetail>

            <RubricDetail label="Improvement Focus">
              <p>
                {item.improvementFocus ?? "No primary improvement focus."}
              </p>
            </RubricDetail>
          </article>
        ))}
      </div>
    </section>
  );
}

function RubricDetail({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 text-sm text-slate-700">
      <p className="font-medium text-slate-500">{label}</p>
      {children}
    </div>
  );
}

