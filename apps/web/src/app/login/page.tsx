import Link from "next/link";

import { loginAction } from "@/app/login/actions";
import { isDevAuthEnabled } from "@/server/auth/dev-auth";
import { getSafeRedirectPath } from "@/server/auth/protected-routes";

type LoginPageProps = {
  searchParams: Promise<{
    redirectTo?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = getSafeRedirectPath(params.redirectTo);
  const hasLoginError = params.error === "invalid_credentials";
  const hasAuthUnavailableError = params.error === "auth_unavailable";
  const showDevelopmentAuthMessage =
    hasAuthUnavailableError && isDevAuthEnabled();

  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          STG Account
        </p>
        <h1 className="text-3xl font-semibold">登录</h1>
        <p className="text-slate-600">
          登录后继续固定七天的结构化面试表达训练。
        </p>
      </section>

      <form
        action={loginAction}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <label className="block space-y-2" htmlFor="email">
          <span className="text-sm font-medium">邮箱</span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block space-y-2" htmlFor="password">
          <span className="text-sm font-medium">密码</span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        {hasLoginError ? (
          <p className="text-sm text-red-600">
            邮箱或密码不正确。
          </p>
        ) : null}

        {showDevelopmentAuthMessage ? (
          <p className="text-sm text-slate-600">
            Development login is enabled.
          </p>
        ) : null}

        {hasAuthUnavailableError && !showDevelopmentAuthMessage ? (
          <p className="text-sm text-red-600">
            Authentication is not configured for this environment.
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
        >
          登录
        </button>
      </form>
      <div className="flex justify-between text-sm">
        <Link className="font-medium text-focus" href="/signup">创建账号</Link>
        <Link className="text-slate-600" href="/forgot-password">忘记密码？</Link>
      </div>
    </main>
  );
}
