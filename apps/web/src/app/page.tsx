import Link from "next/link";

export default function HomePage() {
  return (
    <main className="space-y-12 py-8">
      <section className="max-w-3xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-focus">
          结构化思维训练场
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          把“我知道”练成
          <span className="text-focus">“我能清楚地说出来”</span>
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-600">
          用七天结构化训练完成回答、反馈、修订与重新评分。智能教练提供建议，最终表达由你决定。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/training-demo"
            className="inline-flex rounded-md bg-focus px-5 py-3 text-sm font-semibold text-white shadow-sm"
          >
            立即体验公开演示
          </Link>
          <Link
            href="/login"
            className="inline-flex rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800"
          >
            登录并开始七天训练
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          公开演示使用固定数据，不调用外部模型服务，也不需要注册。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="训练流程">
        <FeatureCard
          index="01"
          title="先完成真实回答"
          description="从你的原始表达出发，不让智能教练替你虚构经历或数字。"
        />
        <FeatureCard
          index="02"
          title="看懂反馈证据"
          description="按相关性、核心信息、结构、证据与面试影响力解释评分。"
        />
        <FeatureCard
          index="03"
          title="自己做修订决定"
          description="采用、保留或自主编辑，再用同一套标准查看前后变化。"
        />
      </section>
    </main>
  );
}

function FeatureCard({
  index,
  title,
  description
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-focus">{index}</p>
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}
