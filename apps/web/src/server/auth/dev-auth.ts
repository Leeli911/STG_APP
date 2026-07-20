export const DEV_AUTH_EMAIL = "test@123.com";
export const DEV_AUTH_PASSWORD = "123";
export const DEV_AUTH_COOKIE_NAME = "stg_dev_session";
export const DEV_AUTH_COOKIE_VALUE = DEV_AUTH_EMAIL;

export type DevAuthUser = {
  id: string;
  email: string;
};

type DevAuthEnv = Record<string, string | undefined>;

/**
 * Development authentication is intentionally opt-in and can never be enabled
 * in production, even if a deployment accidentally carries the feature flag.
 */
export function isDevAuthEnabled(env: DevAuthEnv = process.env) {
  return (
    env.NODE_ENV !== "production" && env.STG_ENABLE_DEV_AUTH === "true"
  );
}

export function isDevAuthCredential(
  email: string,
  password: string,
  env: DevAuthEnv = process.env
) {
  if (!isDevAuthEnabled(env)) {
    return false;
  }

  return email === DEV_AUTH_EMAIL && password === DEV_AUTH_PASSWORD;
}

export function getDevAuthUserFromCookie(
  cookieValue: string | undefined,
  env: DevAuthEnv = process.env
): DevAuthUser | null {
  if (!isDevAuthEnabled(env) || cookieValue !== DEV_AUTH_COOKIE_VALUE) {
    return null;
  }

  return {
    id: "dev-user-test-123",
    email: DEV_AUTH_EMAIL
  };
}

export function getDevAuthUserFromCookieHeader(
  cookieHeader: string | null,
  env: DevAuthEnv = process.env
): DevAuthUser | null {
  if (!isDevAuthEnabled(env) || !cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DEV_AUTH_COOKIE_NAME}=`));

  if (!cookie) {
    return null;
  }

  return getDevAuthUserFromCookie(
    decodeURIComponent(cookie.slice(DEV_AUTH_COOKIE_NAME.length + 1)),
    env
  );
}

export function getDevAuthCookieOptions(env: DevAuthEnv = process.env) {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production"
  };
}
