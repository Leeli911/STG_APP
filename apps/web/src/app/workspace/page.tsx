export default function WorkspacePage() {
  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Sprint 1 Module 1
        </p>
        <h1 className="text-3xl font-semibold">Workspace</h1>
        <p className="max-w-2xl text-slate-600">
          The user will read the interview question and submit an answer here.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Question placeholder</h2>
        <p className="mt-2 text-slate-600">
          Question, micro hint, and answer input will be added in a later module.
        </p>
      </section>
    </main>
  );
}
