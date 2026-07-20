"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const deletionConfirmation = "删除账户";

type ErrorEnvelope = {
  ok: false;
  error: {
    message: string;
  };
};

export function SettingsClient() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete =
    understood && confirmation.trim() === deletionConfirmation && !isDeleting;

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/me/account", {
        method: "DELETE",
        headers: {
          accept: "application/json"
        }
      });
      const body = (await response.json().catch(() => null)) as
        | ErrorEnvelope
        | null;

      if (!response.ok) {
        throw new Error(
          body && !body.ok
            ? body.error.message
            : "暂时无法删除账户，请稍后重试。"
        );
      }

      router.replace("/");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "暂时无法删除账户，请稍后重试。"
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">训练资料</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          调整目标岗位、面试类型、训练目标和回答语言偏好。
        </p>
        <Link
          className="mt-4 inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
          href="/onboarding"
        >
          编辑训练资料
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">导出数据</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          下载当前账户中的训练资料、回答、评分、反馈和修订记录。文件格式为 JSON。
        </p>
        <a
          className="mt-4 inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
          download
          href="/api/me/export"
        >
          导出训练数据（JSON）
        </a>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-xl font-semibold text-red-900">危险操作</h2>
        <p className="mt-2 text-sm leading-6 text-red-800">
          永久删除账户会移除登录身份以及全部训练资料、回答、评分、反馈和修订记录。此操作无法撤销或恢复。
        </p>

        <form className="mt-5 space-y-4" onSubmit={deleteAccount}>
          <label className="flex items-start gap-3 text-sm text-red-900">
            <input
              checked={understood}
              className="mt-1"
              onChange={(event) => setUnderstood(event.target.checked)}
              type="checkbox"
            />
            <span>我了解账户及全部训练数据将被永久删除，且无法恢复。</span>
          </label>

          <label className="block space-y-2" htmlFor="account-deletion-confirmation">
            <span className="text-sm font-medium text-red-900">
              输入“{deletionConfirmation}”以确认
            </span>
            <input
              autoComplete="off"
              className="w-full rounded-md border border-red-300 bg-white px-3 py-2"
              id="account-deletion-confirmation"
              onChange={(event) => setConfirmation(event.target.value)}
              value={confirmation}
            />
          </label>

          {error ? (
            <p className="text-sm font-medium text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-red-300"
            disabled={!canDelete}
            type="submit"
          >
            {isDeleting ? "正在永久删除…" : "永久删除账户"}
          </button>
        </form>
      </section>
    </div>
  );
}
