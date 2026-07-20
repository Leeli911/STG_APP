import { SettingsClient } from "@/app/settings/SettingsClient";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-focus">
          STG Account
        </p>
        <h1 className="text-3xl font-semibold">账户与数据</h1>
        <p className="max-w-2xl leading-7 text-slate-600">
          更新训练偏好、导出你的数据，或永久删除账户。
        </p>
      </section>
      <SettingsClient />
    </main>
  );
}
