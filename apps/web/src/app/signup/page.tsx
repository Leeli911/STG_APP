import Link from "next/link";

import { signupAction } from "@/app/signup/actions";

type SignupPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    status?: string | string[];
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-focus">
          7 天结构化表达训练
        </p>
        <h1 className="text-3xl font-semibold">创建账号</h1>
        <p className="text-slate-600">保存训练记录，并在不同设备继续你的进度。</p>
      </section>

      <form
        action={signupAction}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block space-y-2" htmlFor="signup-email">
          <span className="text-sm font-medium">邮箱</span>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block space-y-2" htmlFor="signup-password">
          <span className="text-sm font-medium">密码</span>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <span className="text-xs text-slate-500">至少 8 个字符</span>
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {signupErrorMessage(error)}
          </p>
        ) : null}
        {status === "check_email" ? (
          <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
            注册邮件已发送，请打开邮件完成验证。
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
        >
          创建账号
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        已有账号？ <Link className="font-medium text-focus" href="/login">登录</Link>
      </p>
    </main>
  );
}

function signupErrorMessage(error: string) {
  if (error === "invalid_input") return "请输入有效邮箱，并使用至少 8 位密码。";
  if (error === "auth_unavailable") return "当前环境尚未配置账号服务。";
  return "暂时无法创建账号，请稍后再试。";
}
