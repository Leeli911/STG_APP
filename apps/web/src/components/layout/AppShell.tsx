import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { getCurrentUser } from "@/server/auth/session";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workspace", label: "Workspace" },
  { href: "/history", label: "History" }
];

type AppShellUser = {
  id: string;
  email?: string | null;
};

export async function AppShell({
  children,
  user
}: {
  children: ReactNode;
  user?: AppShellUser | null;
}) {
  const currentUser = user === undefined ? await getCurrentUser() : user;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-semibold">
            Structured Thinking Gym
          </Link>
          {currentUser ? (
            <>
              <nav aria-label="Main navigation" className="flex gap-4 text-sm">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <LogoutButton />
            </>
          ) : null}
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
