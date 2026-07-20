import { OnboardingForm } from "@/app/onboarding/OnboardingForm";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-focus">开始之前</p>
        <h1 className="text-3xl font-semibold">设置你的训练目标</h1>
        <p className="max-w-xl leading-7 text-slate-600">
          这些信息只用于调整题目说明和反馈语境；七天课程与评分标准仍保持固定，便于比较前后变化。
        </p>
      </section>
      <OnboardingForm />
    </main>
  );
}
