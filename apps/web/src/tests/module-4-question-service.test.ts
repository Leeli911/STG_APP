import {
  createQuestionService,
  type QuestionRepository,
  type QuestionRow
} from "@/server/questions";

const seedQuestions: QuestionRow[] = [
  question(1, "Conclusion First", "只训练结论先行。"),
  question(2, "Categorization", "只训练分类表达。"),
  question(3, "STAR", "只训练完整案例表达。"),
  question(4, "Evidence", "只训练用事实支撑观点。"),
  question(5, "Conflict Handling", "只训练冲突处理表达。"),
  question(6, "Stakeholder Communication", "只训练向上汇报。"),
  question(7, "Final Pitch", "只训练说服表达。")
];

function question(
  dayNumber: number,
  title: string,
  learningGoal: string
): QuestionRow {
  return {
    id: `question-${dayNumber}`,
    day_number: dayNumber,
    title,
    scenario: `${title} scenario`,
    prompt: `${title} prompt`,
    learning_goal: learningGoal,
    expected_structure: `${title} structure`,
    evaluation_focus: `${title} evaluation focus`,
    knowledge_card: {
      title: `${title} knowledge title`,
      content: `${title} knowledge content`
    },
    is_active: true,
    created_at: "2026-06-18T00:00:00.000Z",
    updated_at: "2026-06-18T00:00:00.000Z"
  };
}

function createRepository({
  questions = seedQuestions,
  currentDay,
  completedDays = []
}: {
  questions?: QuestionRow[];
  currentDay?: number;
  completedDays?: number[];
} = {}): QuestionRepository {
  return {
    async listActiveQuestions() {
      return questions;
    },
    async findActiveQuestionByDay(dayNumber) {
      return questions.find((item) => item.day_number === dayNumber) ?? null;
    },
    async findGrowthProfile(_userId) {
      if (!currentDay) {
        return null;
      }

      return {
        user_id: "user-1",
        level_1_score: 0,
        level_2_score: 0,
        level_3_score: 0,
        level_4_score: 0,
        current_day: currentDay,
        updated_at: "2026-06-18T00:00:00.000Z"
      };
    },
    async listCompletedAttemptDayNumbers(_userId) {
      return completedDays;
    }
  };
}

describe("Module 4 question service layer", () => {
  it("reads the fixed Day1-Day7 question sequence as standard DTOs", async () => {
    const service = createQuestionService(createRepository());

    await expect(service.listTrainingSequence()).resolves.toEqual(
      seedQuestions.map((item) => ({
        id: item.id,
        dayNumber: item.day_number,
        title: item.title,
        scenario: item.scenario,
        prompt: item.prompt,
        learningGoal: item.learning_goal,
        expectedStructure: item.expected_structure,
        evaluationFocus: item.evaluation_focus,
        knowledgeCard: item.knowledge_card,
        isActive: item.is_active
      }))
    );
  });

  it("gets one active question by day_number", async () => {
    const service = createQuestionService(createRepository());

    await expect(service.getQuestionByDay(3)).resolves.toMatchObject({
      dayNumber: 3,
      title: "STAR",
      learningGoal: "只训练完整案例表达。",
      evaluationFocus: "STAR evaluation focus",
      knowledgeCard: {
        title: "STAR knowledge title",
        content: "STAR knowledge content"
      },
      isActive: true
    });
  });

  it("rejects day_number outside the fixed 7-day path", async () => {
    const service = createQuestionService(createRepository());

    await expect(service.getQuestionByDay(0)).rejects.toThrow(
      "day_number must be between 1 and 7"
    );
    await expect(service.getQuestionByDay(8)).rejects.toThrow(
      "day_number must be between 1 and 7"
    );
  });

  it("computes current training day from growth profile when present", async () => {
    const service = createQuestionService(
      createRepository({
        currentDay: 4,
        completedDays: [1, 2]
      })
    );

    await expect(service.resolveCurrentDay("user-1")).resolves.toBe(4);
  });

  it("computes current training day from completed attempts when no growth profile exists", async () => {
    const service = createQuestionService(
      createRepository({
        completedDays: [1, 2, 3]
      })
    );

    await expect(service.resolveCurrentDay("user-1")).resolves.toBe(4);
  });

  it("caps current training day at Day 7", async () => {
    const service = createQuestionService(
      createRepository({
        currentDay: 99,
        completedDays: [1, 2, 3, 4, 5, 6, 7]
      })
    );

    await expect(service.resolveCurrentDay("user-1")).resolves.toBe(7);
  });
});
