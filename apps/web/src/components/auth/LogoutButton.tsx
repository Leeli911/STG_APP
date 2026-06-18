import { logoutAction } from "@/app/logout/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-sm text-slate-600">
        Log out
      </button>
    </form>
  );
}
