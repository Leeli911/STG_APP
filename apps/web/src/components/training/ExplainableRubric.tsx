import type { ExplainableDimensionDto } from "@/server/training-sessions";

export function ExplainableRubric({
  dimensions
}: {
  dimensions: ExplainableDimensionDto[];
}) {
  if (dimensions.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">评分明细</h2>
        <p className="mt-2 text-slate-600">
          这份早期训练暂无详细评分证据。
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
          评分明细
        </h2>
        <p className="text-sm text-slate-600">
          查看每个维度的证据、扣分原因与下一步重点。
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
                {dimensionLabel(item.dimension, item.displayName)}
              </h3>
              <p className="shrink-0 text-lg font-semibold text-slate-900">
                {item.score} / {item.maxScore}
              </p>
            </header>

            <RubricDetail label="评分证据">
              <p>{item.evidence}</p>
            </RubricDetail>

            <RubricDetail label="扣分项">
              {item.deductions.length === 0 ? (
                <p>未记录扣分项。</p>
              ) : (
                <ul className="space-y-2">
                  {item.deductions.map((deduction) => (
                    <li key={`${deduction.rule}-${deduction.points}`}>
                      <span>{deduction.reason}</span>
                      <span className="ml-2 text-slate-500">
                        −{deduction.points} 分
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RubricDetail>

            <RubricDetail label="改进重点">
              <p>
                {item.improvementFocus ?? "当前没有首要改进项。"}
              </p>
            </RubricDetail>
          </article>
        ))}
      </div>
    </section>
  );
}

function dimensionLabel(dimension: string, fallback: string) {
  const labels: Record<string, string> = {
    relevance: "回答相关性",
    core_message: "核心信息",
    structure: "表达结构",
    evidence: "事实证据",
    interview_impact: "面试影响力"
  };
  return labels[dimension] ?? fallback;
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
