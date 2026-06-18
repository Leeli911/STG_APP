export type TrainingDayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type KnowledgeCard = {
  title: string;
  content: string;
};

export type QuestionRow = {
  id: string;
  day_number: number;
  title: string;
  scenario: string;
  prompt: string;
  learning_goal: string;
  expected_structure: string;
  evaluation_focus: string;
  knowledge_card: KnowledgeCard;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type GrowthProfileRow = {
  user_id: string;
  level_1_score: number;
  level_2_score: number;
  level_3_score: number;
  level_4_score: number;
  current_day: number;
  updated_at: string;
};

export type QuestionDto = {
  id: string;
  dayNumber: TrainingDayNumber;
  title: string;
  scenario: string;
  prompt: string;
  learningGoal: string;
  expectedStructure: string;
  evaluationFocus: string;
  knowledgeCard: KnowledgeCard;
  isActive: boolean;
};

export type QuestionRepository = {
  listActiveQuestions: () => Promise<QuestionRow[]>;
  findActiveQuestionByDay: (dayNumber: TrainingDayNumber) => Promise<QuestionRow | null>;
  findGrowthProfile: (userId: string) => Promise<GrowthProfileRow | null>;
  listCompletedAttemptDayNumbers: (userId: string) => Promise<number[]>;
};
