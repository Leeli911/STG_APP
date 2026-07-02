import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import TrainingDemoPage from "@/app/training-demo/page";
import { isProtectedRoute } from "@/server/auth/protected-routes";

const draftText = "我希望通过数据分析帮助团队更清楚地理解业务问题。";
const suggestionText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出更清晰的判断。";
const editedText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出清晰、可靠的业务判断。";

describe("Module 10 direct training demo route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders /training-demo without login and without fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("training demo must not call fetch"));

    expect(isProtectedRoute("/training-demo")).toBe(false);

    render(<TrainingDemoPage />);

    expect(
      await screen.findByRole("heading", { name: "Training Feedback" })
    ).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText(draftText)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows Score Breakdown and Suggestion without DeltaSummary", async () => {
    render(<TrainingDemoPage />);

    expect(await screen.findByText("Score Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Core Message")).toBeInTheDocument();
    expect(screen.getByText("AI Suggestion")).toBeInTheDocument();
    expect(screen.getByText("Conclusion First")).toBeInTheDocument();
    expect(screen.getByText(suggestionText)).toBeInTheDocument();
    expect(screen.queryByText(/DeltaSummary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Score Delta/i)).not.toBeInTheDocument();
  });

  it("accepts the suggestion and shows it as the Final Answer", async () => {
    render(<TrainingDemoPage />);
    await chooseAndSubmit("Accept suggestion");

    const status = await completedStatusSection();
    expect(within(status).getByText("Final Answer")).toBeInTheDocument();
    expect(within(status).getByText(suggestionText)).toBeInTheDocument();
  });

  it("rejects the suggestion and shows the original Draft as the Final Answer", async () => {
    render(<TrainingDemoPage />);
    await chooseAndSubmit("Keep original");

    const status = await completedStatusSection();
    expect(within(status).getByText("Final Answer")).toBeInTheDocument();
    expect(within(status).getByText(draftText)).toBeInTheDocument();
  });

  it("submits an edited answer and shows the edited Final Answer", async () => {
    render(<TrainingDemoPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit myself" }));
    fireEvent.change(screen.getByLabelText("Edited final answer"), {
      target: {
        value: editedText
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit revision" }));

    const status = await completedStatusSection();
    expect(within(status).getByText("Final Answer")).toBeInTheDocument();
    expect(within(status).getByText(editedText)).toBeInTheDocument();
  });
});

async function chooseAndSubmit(buttonName: "Accept suggestion" | "Keep original") {
  fireEvent.click(await screen.findByRole("button", { name: buttonName }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: buttonName }))
      .toHaveAttribute("aria-pressed", "true");
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit revision" }));
}

async function completedStatusSection() {
  const complete = await screen.findByText("Re-score complete");
  const section = complete.closest("section");
  if (!section) throw new Error("Completed status section was not rendered.");
  return section;
}
