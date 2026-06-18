import Link from "next/link";

export default function HomePage() {
  return (
    <main className="space-y-4">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        Sprint 1
      </p>
      <h1 className="text-3xl font-semibold">Structured Thinking Gym</h1>
      <p className="max-w-2xl text-slate-600">
        The first training loop starts from the dashboard.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
      >
        Go to Dashboard
      </Link>
    </main>
  );
}
