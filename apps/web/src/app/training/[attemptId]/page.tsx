import { TrainingAttemptClient } from "@/app/training/[attemptId]/TrainingAttemptClient";
import { redirect } from "next/navigation";

import { isLiveTrainingV2Enabled } from "@/server/features/liveTrainingV2";

type TrainingPageProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export default async function TrainingPage({ params }: TrainingPageProps) {
  const { attemptId } = await params;

  if (!isLiveTrainingV2Enabled()) {
    redirect(`/result/${attemptId}`);
  }

  return <TrainingAttemptClient attemptId={attemptId} />;
}
