import {
  handleGetQuestions,
  type GetQuestionsDependencies
} from "@/server/questions/questionApi";
import type { QuestionDto } from "@/server/questions";

const questions: QuestionDto[] = [
  question(1, "Conclusion First"),
  question(2, "Categorization"),
  question(3, "STAR"),
  question(4, "Evidence"),
  question(5, "Conflict Handling"),
  question(6, "Stakeholder Communication"),
  question(7, "Final Pitch")
];

function question(dayNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7, title: string): QuestionDto {
  return {
    id: `question-${dayNumber}`,
    dayNumber,
    title,
    scenario: `${title} scenario`,
    prompt: `${title} prompt`,
    learningGoal: `${title} learning goal`,
    expectedStructure: `${title} expected structure`,
    evaluationFocus: `${title} evaluation focus`,
    knowledgeCard: {
      title: `${title} knowledge title`,
      content: `${title} knowledge content`
    },
    isActive: true
  };
}

function request(path: string) {
  return new Request(`http://localhost:3000${path}`);
}

async function json(response: Response) {
  return response.json();
}

function createDependencies({
  authenticated = true
}: {
  authenticated?: boolean;
} = {}): GetQuestionsDependencies {
  return {
    getUser: vi.fn().mockResolvedValue(
      authenticated
        ? {
            id: "user-1"
          }
        : null
    ),
    questionService: {
      listTrainingSequence: vi.fn().mockResolvedValue(questions),
      getQuestionByDay: vi.fn(async (dayNumber: number) => {
        const questionForDay = questions.find(
          (item) => item.dayNumber === dayNumber
        );

        if (!questionForDay) {
          throw new Error(`Question for day ${dayNumber} was not found`);
        }

        return questionForDay;
      })
    }
  };
}

describe("Module 5 GET /api/questions", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
    vi.resetModules();
  });

  it("returns 401 when the user is unauthenticated", async () => {
    const response = await handleGetQuestions(
      request("/api/questions?scope=today"),
      createDependencies({ authenticated: false })
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required."
      },
      meta: {
        request_id: expect.any(String)
      }
    });
  });

  it("returns 401 when the route cannot create a Supabase session client", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: vi
        .fn()
        .mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_URL"))
    }));

    const { GET } = await import("@/app/api/questions/route");
    const response = await GET(request("/api/questions?scope=today"));

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required."
      },
      meta: {
        request_id: expect.any(String)
      }
    });
  });

  it("returns 401 when session lookup fails", async () => {
    const dependencies = createDependencies();
    dependencies.getUser = vi
      .fn()
      .mockRejectedValue(new Error("Supabase auth is unavailable"));

    const response = await handleGetQuestions(
      request("/api/questions?scope=today"),
      dependencies
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required."
      },
      meta: {
        request_id: expect.any(String)
      }
    });
  });

  it("returns Day1 for scope=today for a new user", async () => {
    const dependencies = createDependencies();
    const response = await handleGetQuestions(
      request("/api/questions?scope=today"),
      dependencies
    );

    expect(response.status).toBe(200);
    expect(dependencies.questionService.getQuestionByDay).toHaveBeenCalledWith(1);
    expect(await json(response)).toMatchObject({
      ok: true,
      data: {
        question: {
          dayNumber: 1,
          title: "Conclusion First"
        }
      },
      meta: {
        request_id: expect.any(String)
      }
    });
  });

  it("returns seven active questions with MVP availability statuses for scope=all", async () => {
    const response = await handleGetQuestions(
      request("/api/questions?scope=all"),
      createDependencies()
    );

    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.questions).toHaveLength(7);
    expect(body.data.questions.map((item: { status: string }) => item.status)).toEqual([
      "available",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked"
    ]);
    expect(body.meta.request_id).toEqual(expect.any(String));
  });

  it("returns 400 when day is outside Day1-Day7", async () => {
    const response = await handleGetQuestions(
      request("/api/questions?day=8"),
      createDependencies()
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_DAY",
        message: "day must be an integer between 1 and 7."
      },
      meta: {
        request_id: expect.any(String)
      }
    });
  });

  it("returns a standard Day1 Question DTO for day=1", async () => {
    const response = await handleGetQuestions(
      request("/api/questions?day=1"),
      createDependencies()
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      ok: true,
      data: {
        question: {
          id: "question-1",
          dayNumber: 1,
          title: "Conclusion First",
          scenario: "Conclusion First scenario",
          prompt: "Conclusion First prompt",
          learningGoal: "Conclusion First learning goal",
          expectedStructure: "Conclusion First expected structure",
          evaluationFocus: "Conclusion First evaluation focus",
          knowledgeCard: {
            title: "Conclusion First knowledge title",
            content: "Conclusion First knowledge content"
          },
          isActive: true
        }
      },
      meta: {
        request_id: expect.any(String)
      }
    });
  });
});
