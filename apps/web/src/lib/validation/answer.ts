export const MINIMUM_ANSWER_MESSAGE =
  "回答内容太短。请至少写出一个完整观点和简单原因。";

export const MAX_ANSWER_LENGTH = 6000;

const CJK_PATTERN = /[\u3400-\u9fff]/g;
const ENGLISH_WORD_PATTERN = /[A-Za-z]+(?:'[A-Za-z]+)?/g;

type AnswerValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      message: string;
    };

export function validateMinimumAnswer(answer: string): AnswerValidationResult {
  const trimmedAnswer = answer.trim();

  if (trimmedAnswer.length === 0) {
    return {
      ok: false,
      message: "Please enter an answer before submitting."
    };
  }

  const cjkCharacters = trimmedAnswer.match(CJK_PATTERN) ?? [];

  if (cjkCharacters.length > 0) {
    return trimmedAnswer.length >= 20
      ? { ok: true }
      : {
          ok: false,
          message: MINIMUM_ANSWER_MESSAGE
        };
  }

  const englishWords = trimmedAnswer.match(ENGLISH_WORD_PATTERN) ?? [];

  if (englishWords.length > 0) {
    return englishWords.length >= 10
      ? { ok: true }
      : {
          ok: false,
          message: MINIMUM_ANSWER_MESSAGE
        };
  }

  return trimmedAnswer.length >= 20
    ? { ok: true }
    : {
        ok: false,
        message: MINIMUM_ANSWER_MESSAGE
      };
}
