type AdminEnv = Record<string, string | undefined>;

type AuthenticatedUser = {
  id: string;
} | null;

/**
 * STG does not yet have a production role-assignment system. Keep the admin
 * surface fail-closed until one exists; local access requires an explicit flag.
 */
export function isAdminAccessAllowed(
  user: AuthenticatedUser,
  env: AdminEnv = process.env
) {
  return Boolean(user) &&
    env.NODE_ENV !== "production" &&
    env.STG_ENABLE_DEV_ADMIN === "true";
}
