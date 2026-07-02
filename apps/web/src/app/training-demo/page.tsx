"use client";

import { useMemo } from "react";

import { createDemoTrainingSessionGateway } from "@/features/training-session/DemoAdapter";
import { TrainingSessionController } from "@/features/training-session/TrainingSessionController";
import { TrainingSessionScreen } from "@/features/training-session/TrainingSessionScreen";

const demoInitialAttemptId = "00000000-0000-4000-8000-000000000101";
const demoCreateSessionKey = "training-demo:create-session";
const demoRevisionKey = "training-demo:revision";
const demoDecisionTime = "2026-06-25T00:03:00.000Z";

export default function TrainingDemoPage() {
  const gateway = useMemo(() => createDemoTrainingSessionGateway(), []);

  return (
    <TrainingSessionController
      currentTime={readDemoDecisionTime}
      gateway={gateway}
      initialAttemptId={demoInitialAttemptId}
      makeCreateSessionIdempotencyKey={makeDemoCreateSessionKey}
      makeRevisionIdempotencyKey={makeDemoRevisionKey}
    >
      {(viewModel) => <TrainingSessionScreen viewModel={viewModel} />}
    </TrainingSessionController>
  );
}

function makeDemoCreateSessionKey() {
  return demoCreateSessionKey;
}

function makeDemoRevisionKey() {
  return demoRevisionKey;
}

function readDemoDecisionTime() {
  return demoDecisionTime;
}
