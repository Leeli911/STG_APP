import Link from "next/link";

export default function HomePage() {
  return (
    <main className="space-y-12 py-8">
      <section className="max-w-3xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-focus">
          结构化表达训练场
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          把“知道方法”练成
          <span className="text-focus">“在真实工作中说得清楚”</span>
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-600">
          每天五分钟：先无提示回答，再看一个最重要的问题，亲自重写，并用新情境检验自己是否真的会用。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/training-demo"
            className="inline-flex rounded-md bg-focus px-5 py-3 text-sm font-semibold text-white shadow-sm"
          >
            开始免费五分钟训练
          </Link>
          <Link
            href="/login"
            className="inline-flex rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800"
          >
            登录并保存训练进度
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          免费训练无需注册，只使用浏览器内的确定性规则，不调用付费模型或数据库。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="训练流程">
        <FeatureCard
          index="01"
          title="无提示回答"
          description="先按你平时的方式表达，避免把照着方法写误认为已经掌握。"
        />
        <FeatureCard
          index="02"
          title="只改一个问题"
          description="反馈引用你的原文，只解释一个主要问题及其对听众的影响。"
        />
        <FeatureCard
          index="03"
          title="亲自重写并迁移"
          description="没有一键采用；你必须自己修改，再到新工作情境中独立使用。"
        />
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
        <p className="text-sm font-semibold text-focus">为什么不直接让聊天工具改写？</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-9 text-slate-950 sm:text-3xl">
          不是帮你把这一次写得更好，而是训练你下一次自己说清楚
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ComparisonCard
            title="通用聊天工具"
            items={[
              "你需要自己设计训练提示词和判断标准",
              "容易直接得到润色稿，却没有完成主动提取",
              "一次对话结束后，很难证明能否迁移到新情境"
            ]}
          />
          <ComparisonCard
            emphasized
            title="结构化表达训练场"
            items={[
              "先锁定一个微技能，再进行无提示冷回答",
              "只给一个有原文证据的反馈，并强制亲自重写",
              "立刻换题迁移，记录的是行为证据而非黑盒高分"
            ]}
          />
        </div>
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

function ComparisonCard({
  emphasized = false,
  items,
  title
}: {
  emphasized?: boolean;
  items: string[];
  title: string;
}) {
  return (
    <article
      className={
        emphasized
          ? "rounded-xl border border-blue-200 bg-white p-5 shadow-sm"
          : "rounded-xl border border-slate-200 bg-slate-50 p-5"
      }
    >
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li className="flex gap-2" key={item}>
            <span aria-hidden="true" className="text-focus">
              {emphasized ? "✓" : "—"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
