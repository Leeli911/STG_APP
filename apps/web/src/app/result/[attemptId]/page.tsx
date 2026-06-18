type ResultPageProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export default async function ResultPage({ params }: ResultPageProps) {
  const { attemptId } = await params;

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Sprint 1 Module 1
        </p>
        <h1 className="text-3xl font-semibold">Result</h1>
        <p className="text-slate-600">Attempt: {attemptId}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Training result placeholder</h2>
        <p className="mt-2 text-slate-600">
          Score, diagnosis, rewrite, and growth suggestion will be displayed here.
        </p>
      </section>
    </main>
  );
}
