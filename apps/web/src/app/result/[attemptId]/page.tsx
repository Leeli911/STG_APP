import { ResultClient } from "@/app/result/[attemptId]/ResultClient";

type ResultPageProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export default async function ResultPage({ params }: ResultPageProps) {
  const { attemptId } = await params;

  return (
    <ResultClient
      attemptId={attemptId}
      isDevelopment={process.env.NODE_ENV === "development"}
    />
  );
}
