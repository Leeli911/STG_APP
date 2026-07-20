import Link from "next/link";

import { requestPasswordResetAction } from "@/app/forgot-password/actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    status?: string | string[];
  }>;
};

export default async function ForgotPasswordPage({
  searchParams
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">找回密码</h1>
        <p className="text-slate-600">输入注册邮箱，我们会发送安全的重置链接。</p>
      </section>
      <form
        action={requestPasswordResetAction}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <label className="block space-y-2" htmlFor="reset-email">
          <span className="text-sm font-medium">邮箱</span>
          <input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        {error ? <p role="alert" className="text-sm text-red-600">无法发送重置邮件，请稍后重试。</p> : null}
        {status === "sent" ? (
          <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
            如果该邮箱已注册，重置邮件将很快送达。
          </p>
        ) : null}
        <button className="w-full rounded-md bg-focus px-4 py-2 text-sm font-medium text-white">
          发送重置邮件
        </button>
      </form>
      <Link className="text-sm font-medium text-focus" href="/login">返回登录</Link>
    </main>
  );
}
