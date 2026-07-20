"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { UserProfileDto } from "@/server/profiles/types";

type ProfileEnvelope = {
  ok: true;
  data: { profile: UserProfileDto | null };
};

type ErrorEnvelope = {
  ok: false;
  error: { message: string };
};

export function OnboardingForm() {
  const router = useRouter();
  const [targetRole, setTargetRole] = useState("");
  const [interviewType, setInterviewType] = useState("behavioral");
  const [trainingGoal, setTrainingGoal] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/me/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as ProfileEnvelope | ErrorEnvelope;
        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "无法读取训练设置。" : body.error.message);
        }
        if (!active || !body.data.profile) return;
        const profile = body.data.profile;
        setTargetRole(profile.targetRole);
        setInterviewType(profile.interviewType);
        setTrainingGoal(profile.trainingGoal);
        setConsent(profile.consentToAnonymizedEvals);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "无法读取训练设置。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target_role: targetRole,
          interview_type: interviewType,
          training_goal: trainingGoal,
          preferred_answer_language: "zh",
          consent_to_anonymized_evals: consent
        })
      });
      const body = (await response.json()) as ProfileEnvelope | ErrorEnvelope;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "无法保存训练设置。" : body.error.message);
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "无法保存训练设置。");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block space-y-2" htmlFor="target-role">
        <span className="text-sm font-semibold">目标岗位</span>
        <input id="target-role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} minLength={2} maxLength={120} required placeholder="例如：数据分析师" className="w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>

      <label className="block space-y-2" htmlFor="interview-type">
        <span className="text-sm font-semibold">主要面试类型</span>
        <select id="interview-type" value={interviewType} onChange={(event) => setInterviewType(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="behavioral">行为面试</option>
          <option value="case">案例 / 业务问题</option>
          <option value="general">综合面试</option>
        </select>
      </label>

      <label className="block space-y-2" htmlFor="training-goal">
        <span className="text-sm font-semibold">希望改善什么</span>
        <textarea id="training-goal" value={trainingGoal} onChange={(event) => setTrainingGoal(event.target.value)} minLength={10} maxLength={500} rows={4} required placeholder="例如：减少铺垫，用更清晰的证据说明我的贡献。" className="w-full resize-y rounded-md border border-slate-300 px-3 py-2" />
      </label>

      <section className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">反馈语言：简体中文</p>
        <p className="mt-1">当前测试版本统一使用中文界面和中文反馈。</p>
      </section>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />
        <span>我自愿允许系统在去标识化后将回答用于内部质量评测。该选项不影响使用，并可之后关闭。</span>
      </label>

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={loading || submitting} className="w-full rounded-md bg-focus px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? "读取设置中…" : submitting ? "保存中…" : "保存并开始训练"}
      </button>
    </form>
  );
}
