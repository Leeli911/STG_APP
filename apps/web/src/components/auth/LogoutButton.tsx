import { logoutAction } from "@/app/logout/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-sm text-slate-600">
        退出登录
      </button>
    </form>
  );
}
