"use client";

import { useCallback, useEffect, useState } from "react";

import type { TrainingOverview } from "@/server/training-overview";

type TrainingOverviewEnvelope =
  | {
      ok: true;
      data: {
        overview: TrainingOverview;
      };
    }
  | {
      ok: false;
      error: {
        message: string;
      };
    };

export function useTrainingOverview() {
  const [overview, setOverview] = useState<TrainingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/training-overview", {
        headers: {
          Accept: "application/json"
        }
      });
      const body = (await response.json()) as TrainingOverviewEnvelope;

      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "训练数据读取失败。" : body.error.message);
      }

      setOverview(body.data.overview);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "训练数据读取失败。"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    overview,
    isLoading,
    error,
    retry: load
  };
}
