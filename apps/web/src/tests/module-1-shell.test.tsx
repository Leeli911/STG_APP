import React from "react";
import { render, screen } from "@testing-library/react";

import AdminPage from "@/app/admin/page";
import DashboardPage from "@/app/dashboard/page";
import HistoryPage from "@/app/history/page";
import ResultPage from "@/app/result/[attemptId]/page";
import WorkspacePage from "@/app/workspace/page";
import { AppShell } from "@/components/layout/AppShell";

describe("Module 1 app shell", () => {
  it("renders the app shell with STG navigation", () => {
    render(
      <AppShell>
        <main>Module shell</main>
      </AppShell>
    );

    expect(screen.getByText("Structured Thinking Gym")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByText("Module shell")).toBeInTheDocument();
  });

  it("renders all Sprint 1 page skeletons", async () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Today Training")).toBeInTheDocument();

    render(<WorkspacePage />);
    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByText("Question placeholder")).toBeInTheDocument();

    render(await ResultPage({ params: Promise.resolve({ attemptId: "attempt-1" }) }));
    expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument();
    expect(screen.getByText("Attempt: attempt-1")).toBeInTheDocument();

    render(<HistoryPage />);
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();

    render(<AdminPage />);
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
  });
});
