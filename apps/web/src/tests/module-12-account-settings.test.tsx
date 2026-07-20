import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SettingsClient } from "@/app/settings/SettingsClient";
import SettingsPage from "@/app/settings/page";
import { AppShell } from "@/components/layout/AppShell";
import {
  handleDeleteAccount,
  type AccountDeletionAdminClient,
  type AccountDeletionAdminClientFactory,
  type AccountDeletionUserClient
} from "@/server/account/accountDeletionApi";
import { isProtectedRoute } from "@/server/auth/protected-routes";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ replace, refresh })
}));

describe("current-user-only account deletion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    replace.mockReset();
    refresh.mockReset();
  });

  it("requires an authenticated current user before resolving admin access", async () => {
    const fixture = deletionFixture({ authenticated: false });

    const response = await handleDeleteAccount(
      fixture.client,
      fixture.createAdminClient
    );

    expect(response.status).toBe(401);
    expect(fixture.createAdminClient).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
    expect(fixture.deleteUser).not.toHaveBeenCalled();
    expect(fixture.signOut).not.toHaveBeenCalled();
  });

  it("deletes data through auth.uid and passes only the session user to Auth Admin", async () => {
    const fixture = deletionFixture({ userId: "current-session-user" });

    const response = await handleDeleteAccount(
      fixture.client,
      fixture.createAdminClient
    );

    expect(response.status).toBe(200);
    expect(fixture.rpc).toHaveBeenCalledWith("delete_my_training_data", {});
    expect(fixture.deleteUser).toHaveBeenCalledWith("current-session-user");
    expect(fixture.signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("clear-site-data")).toContain("cookies");
  });

  it("fails closed before deleting data when service-role access is absent", async () => {
    const fixture = deletionFixture();
    fixture.createAdminClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
    });

    const response = await handleDeleteAccount(
      fixture.client,
      fixture.createAdminClient
    );

    expect(response.status).toBe(503);
    expect(fixture.rpc).not.toHaveBeenCalled();
    expect(fixture.deleteUser).not.toHaveBeenCalled();
    expect(fixture.signOut).not.toHaveBeenCalled();
  });

  it("stops before Auth Admin deletion when owned-data deletion fails", async () => {
    const fixture = deletionFixture({
      rpcError: { message: "database unavailable" }
    });

    const response = await handleDeleteAccount(
      fixture.client,
      fixture.createAdminClient
    );

    expect(response.status).toBe(500);
    expect(fixture.deleteUser).not.toHaveBeenCalled();
    expect(fixture.signOut).not.toHaveBeenCalled();
  });

  it("reports a partial failure without signing out when Auth Admin rejects deletion", async () => {
    const fixture = deletionFixture({
      adminError: { message: "admin delete failed" }
    });

    const response = await handleDeleteAccount(
      fixture.client,
      fixture.createAdminClient
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(fixture.signOut).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "TRAINING_DATA_DELETED_ACCOUNT_DELETE_FAILED",
        details: {
          trainingDataDeleted: true,
          accountDeleted: false
        }
      }
    });
  });

  it("clears browser state if server sign-out fails after the account is gone", async () => {
    const fixture = deletionFixture({
      signOutError: { message: "session already gone" }
    });

    const response = await handleDeleteAccount(
      fixture.client,
      fixture.createAdminClient
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("clear-site-data")).toContain("cookies");
    expect(await response.json()).toMatchObject({
      error: {
        code: "ACCOUNT_DELETED_SIGN_OUT_FAILED",
        details: { accountDeleted: true }
      }
    });
  });
});

describe("account settings UI", () => {
  it("is protected and exposes profile, export, and irreversible deletion controls", () => {
    expect(isProtectedRoute("/settings")).toBe(true);

    render(<SettingsPage />);

    expect(
      screen.getByRole("heading", { name: "账户与数据" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "编辑训练资料" })).toHaveAttribute(
      "href",
      "/onboarding"
    );
    expect(
      screen.getByRole("link", { name: "导出训练数据（JSON）" })
    ).toHaveAttribute("href", "/api/me/export");
    expect(
      screen.getByRole("button", { name: "永久删除账户" })
    ).toBeDisabled();
    expect(screen.getByText(/无法撤销或恢复/)).toBeInTheDocument();
  });

  it("requires both explicit acknowledgements before calling the delete API", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: { message: "账户删除服务暂时不可用。" }
      })
    } as Response);
    render(<SettingsClient />);

    const deleteButton = screen.getByRole("button", {
      name: "永久删除账户"
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /我了解账户及全部训练数据将被永久删除/
      })
    );
    fireEvent.change(screen.getByLabelText("输入“删除账户”以确认"), {
      target: { value: "删除账户" }
    });
    expect(deleteButton).toBeEnabled();

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        "/api/me/account",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("账户删除服务暂时不可用。");
  });

  it("adds account settings to authenticated navigation", () => {
    render(
      <AppShell user={{ id: "user-1", email: "learner@example.com" }}>
        <p>Settings shell</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "账户设置" })).toHaveAttribute(
      "href",
      "/settings"
    );
  });
});

function deletionFixture({
  authenticated = true,
  userId = "user-1",
  rpcError = null,
  adminError = null,
  signOutError = null
}: {
  authenticated?: boolean;
  userId?: string;
  rpcError?: { message: string } | null;
  adminError?: { message: string } | null;
  signOutError?: { message: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: { deleted: true }, error: rpcError });
  const signOut = vi.fn().mockResolvedValue({ data: null, error: signOutError });
  const deleteUser = vi.fn().mockResolvedValue({ data: null, error: adminError });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: userId } : null },
        error: null
      }),
      signOut
    },
    rpc
  } as unknown as AccountDeletionUserClient;
  const adminClient = {
    auth: { admin: { deleteUser } }
  } as unknown as AccountDeletionAdminClient;
  const createAdminClient = vi.fn(() => adminClient) as unknown as
    AccountDeletionAdminClientFactory & ReturnType<typeof vi.fn>;

  return {
    client,
    rpc,
    signOut,
    deleteUser,
    createAdminClient
  };
}
