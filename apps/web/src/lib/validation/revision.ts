import {
  MAX_ANSWER_LENGTH,
  validateMinimumAnswer
} from "@/lib/validation/answer";

export type RevisionDecisionAction = "accepted" | "rejected" | "edited";

export type RevisionDecisionValidationResult =
  | {
      ok: true;
      value: {
        action: RevisionDecisionAction;
        editedText: string | null;
        finalText: string;
      };
    }
  | {
      ok: false;
      field: "action" | "edited_text";
      message: string;
    };

export function validateRevisionDecision({
  action,
  editedText,
  draftText,
  suggestionText
}: {
  action: unknown;
  editedText: unknown;
  draftText: string;
  suggestionText: string;
}): RevisionDecisionValidationResult {
  if (!isRevisionDecisionAction(action)) {
    return {
      ok: false,
      field: "action",
      message: "Revision action is invalid."
    };
  }

  if (action === "accepted" || action === "rejected") {
    if (editedText !== null && editedText !== undefined) {
      return {
        ok: false,
        field: "edited_text",
        message: "edited_text must be null for this action."
      };
    }

    return {
      ok: true,
      value: {
        action,
        editedText: null,
        finalText: action === "accepted" ? suggestionText : draftText
      }
    };
  }

  if (typeof editedText !== "string") {
    return {
      ok: false,
      field: "edited_text",
      message: "edited_text is required for an edited revision."
    };
  }

  const normalized = editedText.trim();
  if (!normalized) {
    return {
      ok: false,
      field: "edited_text",
      message: "edited_text cannot be empty."
    };
  }
  if (normalized.length > MAX_ANSWER_LENGTH) {
    return {
      ok: false,
      field: "edited_text",
      message: `edited_text must be ${MAX_ANSWER_LENGTH} characters or fewer.`
    };
  }
  if (normalized === draftText.trim()) {
    return {
      ok: false,
      field: "edited_text",
      message: "edited_text must differ from the draft."
    };
  }
  if (normalized === suggestionText.trim()) {
    return {
      ok: false,
      field: "edited_text",
      message: "edited_text must differ from the suggestion."
    };
  }

  const minimum = validateMinimumAnswer(normalized);
  if (!minimum.ok) {
    return {
      ok: false,
      field: "edited_text",
      message: minimum.message
    };
  }

  return {
    ok: true,
    value: {
      action,
      editedText: normalized,
      finalText: normalized
    }
  };
}

function isRevisionDecisionAction(
  value: unknown
): value is RevisionDecisionAction {
  return value === "accepted" || value === "rejected" || value === "edited";
}
