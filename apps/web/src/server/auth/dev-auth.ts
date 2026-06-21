export const DEV_AUTH_EMAIL = "test@123.com";
export const DEV_AUTH_PASSWORD = "123";
export const DEV_AUTH_COOKIE_NAME = "stg_dev_session";
export const DEV_AUTH_COOKIE_VALUE = DEV_AUTH_EMAIL;

export type DevAuthUser = {
  id: string;
  email: string;
};

export function isDevAuthCredential(email: string, password: string) {
  return email === DEV_AUTH_EMAIL && password === DEV_AUTH_PASSWORD;
}

export function getDevAuthUserFromCookie(
  cookieValue: string | undefined
): DevAuthUser | null {
  if (cookieValue !== DEV_AUTH_COOKIE_VALUE) {
    return null;
  }

  return {
    id: "dev-user-test-123",
    email: DEV_AUTH_EMAIL
  };
}

export function getDevAuthUserFromCookieHeader(
  cookieHeader: string | null
): DevAuthUser | null {
  if (!cookieHeader) {
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
    decodeURIComponent(cookie.slice(DEV_AUTH_COOKIE_NAME.length + 1))
  );
}

export function getDevAuthCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}
