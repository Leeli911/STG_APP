import { updatePasswordAction } from "@/app/reset-password/actions";

type ResetPasswordPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function ResetPasswordPage({
  searchParams
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const hasError = Boolean(params.error);

  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">设置新密码</h1>
        <p className="text-slate-600">新密码至少需要 8 个字符。</p>
      </section>
      <form
        action={updatePasswordAction}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <label className="block space-y-2" htmlFor="new-password">
          <span className="text-sm font-medium">新密码</span>
          <input id="new-password" name="password" type="password" minLength={8} required className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="block space-y-2" htmlFor="password-confirmation">
          <span className="text-sm font-medium">再次输入</span>
          <input id="password-confirmation" name="confirmation" type="password" minLength={8} required className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        {hasError ? <p role="alert" className="text-sm text-red-600">密码不一致，或链接已经失效。</p> : null}
        <button className="w-full rounded-md bg-focus px-4 py-2 text-sm font-medium text-white">保存新密码</button>
      </form>
    </main>
  );
}
