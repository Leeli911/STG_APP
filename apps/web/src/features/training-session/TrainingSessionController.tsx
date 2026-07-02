"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { validateRevisionDecision } from "@/lib/validation/revision";
import type {
  RevisionAction,
  TrainingSessionDto
} from "@/server/training-sessions/types";
import {
  TrainingSessionGatewayError,
  type CommitTrainingSessionRevisionInput,
  type TrainingSessionGateway
} from "@/features/training-session/TrainingSessionGateway";

export type TrainingSessionControllerViewModel = {
  session: TrainingSessionDto | null;
  isLoading: boolean;
  isSubmitting: boolean;
  validationError: string | null;
  networkError: string | null;
  retrying: boolean;
  editText: string;
  selectedAction: RevisionAction | null;
  controlsDisabled: boolean;
  canRetry: boolean;
  setEditText(value: string): void;
  selectAction(action: RevisionAction): void;
  submitRevision(): Promise<void>;
  retryRevision(): Promise<void>;
  refreshSession(): Promise<void>;
};

export type TrainingSessionControllerProps = {
  gateway: TrainingSessionGateway;
  initialAttemptId: string;
  initialSession?: TrainingSessionDto | null;
  makeCreateSessionIdempotencyKey?: () => string;
  makeRevisionIdempotencyKey?: () => string;
  currentTime?: () => string;
  children(viewModel: TrainingSessionControllerViewModel): ReactNode;
};

export function TrainingSessionController({
  gateway,
  initialAttemptId,
  initialSession = null,
  makeCreateSessionIdempotencyKey = makeDefaultIdempotencyKey,
  makeRevisionIdempotencyKey = makeDefaultIdempotencyKey,
  currentTime = () => new Date().toISOString(),
  children
}: TrainingSessionControllerProps) {
  const [session, setSession] = useState<TrainingSessionDto | null>(
    initialSession
  );
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [editText, setEditTextState] = useState("");
  const [selectedAction, setSelectedAction] =
    useState<RevisionAction | null>(null);

  const createSessionKeyRef = useRef<string | null>(null);
  const revisionKeyRef = useRef<string | null>(
    initialSession?.decision?.idempotencyKey ?? null
  );

  const updateSession = useCallback((next: TrainingSessionDto) => {
    if (next.decision) {
      revisionKeyRef.current = next.decision.idempotencyKey;
    }
    setSession(next);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!session) return;

    try {
      const next = await gateway.getSession(session.id);
      setNetworkError(null);
      updateSession(next);
    } catch (error) {
      setNetworkError(toUserFacingNetworkMessage(error));
    }
  }, [gateway, session, updateSession]);

  const recoverFromUncertainOutcome = useCallback(
    async (sessionId: string) => {
      try {
        const recovered = await gateway.getSession(sessionId);
        updateSession(recovered);
        setNetworkError(
          recovered.status === "feedback_ready"
            ? unknownOutcomeMessage
            : null
        );
      } catch (recoveryError) {
        setNetworkError(toUserFacingNetworkMessage(recoveryError));
      }
    },
    [gateway, updateSession]
  );

  const handleCommitError = useCallback(
    async (error: unknown, sessionId: string) => {
      if (
        error instanceof TrainingSessionGatewayError &&
        isRecoverableByReadingSession(error.code)
      ) {
        await recoverFromUncertainOutcome(sessionId);
        return;
      }

      setNetworkError(toUserFacingNetworkMessage(error));
    },
    [recoverFromUncertainOutcome]
  );

  useEffect(() => {
    if (initialSession) {
      updateSession(initialSession);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    async function loadSession() {
      setIsLoading(true);
      setNetworkError(null);

      try {
        if (!createSessionKeyRef.current) {
          createSessionKeyRef.current = makeCreateSessionIdempotencyKey();
        }
        const created = await gateway.createSession({
          initialAttemptId,
          idempotencyKey: createSessionKeyRef.current
        });
        if (!isActive) return;
        updateSession(created);

        const hydrated = await gateway.getSession(created.id);
        if (!isActive) return;
        updateSession(hydrated);
      } catch (error) {
        if (!isActive) return;
        setNetworkError(toUserFacingNetworkMessage(error));
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadSession();

    return () => {
      isActive = false;
    };
  }, [
    gateway,
    initialAttemptId,
    initialSession,
    makeCreateSessionIdempotencyKey,
    updateSession
  ]);

  const setEditText = useCallback((value: string) => {
    setEditTextState(value);
    setValidationError(null);
  }, []);

  const selectAction = useCallback((action: RevisionAction) => {
    setSelectedAction(action);
    setValidationError(null);
  }, []);

  const submitRevision = useCallback(async () => {
    if (!session) return;
    if (!selectedAction) {
      setValidationError("Please choose how to use the suggestion.");
      return;
    }

    const validated = validateRevisionDecision({
      action: selectedAction,
      editedText: selectedAction === "edited" ? editText : null,
      draftText: session.draft.text,
      suggestionText: session.suggestion.text
    });

    if (!validated.ok) {
      setValidationError(validated.message);
      return;
    }

    const idempotencyKey =
      session.decision?.idempotencyKey ??
      revisionKeyRef.current ??
      makeRevisionIdempotencyKey();
    revisionKeyRef.current = idempotencyKey;

    const input: CommitTrainingSessionRevisionInput = {
      sessionId: session.id,
      idempotencyKey,
      action: validated.value.action,
      editedText: validated.value.editedText,
      clientDecidedAt: currentTime()
    };

    setIsSubmitting(true);
    setValidationError(null);
    setNetworkError(null);
    try {
      const next = await gateway.commitRevision(input);
      updateSession(next);
    } catch (error) {
      await handleCommitError(error, session.id);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentTime,
    editText,
    gateway,
    handleCommitError,
    makeRevisionIdempotencyKey,
    selectedAction,
    session,
    updateSession
  ]);

  const retryRevision = useCallback(async () => {
    if (!session || !session.decision) {
      setNetworkError("There is no committed revision to retry.");
      return;
    }

    const input: CommitTrainingSessionRevisionInput = {
      sessionId: session.id,
      idempotencyKey: session.decision.idempotencyKey,
      action: session.decision.action,
      editedText: session.decision.editedText,
      clientDecidedAt: session.decision.decidedAt
    };
    revisionKeyRef.current = session.decision.idempotencyKey;

    setRetrying(true);
    setValidationError(null);
    setNetworkError(null);
    try {
      const next = await gateway.commitRevision(input);
      updateSession(next);
    } catch (error) {
      await handleCommitError(error, session.id);
    } finally {
      setRetrying(false);
    }
  }, [gateway, handleCommitError, session, updateSession]);

  const controlsDisabled =
    isLoading || isSubmitting || retrying || session?.status === "rescoring";
  const canRetry = session?.status === "rescore_failed" && Boolean(session.decision);

  const viewModel = useMemo<TrainingSessionControllerViewModel>(
    () => ({
      session,
      isLoading,
      isSubmitting,
      validationError,
      networkError,
      retrying,
      editText,
      selectedAction,
      controlsDisabled,
      canRetry,
      setEditText,
      selectAction,
      submitRevision,
      retryRevision,
      refreshSession
    }),
    [
      canRetry,
      controlsDisabled,
      editText,
      isLoading,
      isSubmitting,
      networkError,
      refreshSession,
      retryRevision,
      retrying,
      selectAction,
      selectedAction,
      session,
      setEditText,
      submitRevision,
      validationError
    ]
  );

  return <>{children(viewModel)}</>;
}

function isRecoverableByReadingSession(
  code: TrainingSessionGatewayError["code"]
) {
  return (
    code === "NETWORK_ERROR" ||
    code === "NETWORK_UNCERTAIN" ||
    code === "RESCORE_FAILED" ||
    code === "REVISION_ALREADY_COMMITTED"
  );
}

function toUserFacingNetworkMessage(error: unknown) {
  if (error instanceof TrainingSessionGatewayError) {
    if (error.code === "UNAUTHENTICATED") {
      return "Please sign in to continue.";
    }
    if (error.code === "NETWORK_ERROR" || error.code === "NETWORK_UNCERTAIN") {
      return unknownOutcomeMessage;
    }
    return error.message;
  }

  return "Something went wrong while updating your training session.";
}

function makeDefaultIdempotencyKey() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  return `training-session:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2)}`;
}

const unknownOutcomeMessage =
  "We could not confirm whether your revision was saved. Please try again.";
