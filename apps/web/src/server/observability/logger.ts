type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const sensitiveKeyPattern =
  /(answer|authorization|cookie|email|edited_text|password|phone|prompt|response|secret|target_role|text|token|training_goal|user_name|full_name)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export const logger = {
  info(message: string, context: LogContext = {}) {
    writeLog("info", message, context);
  },
  warn(message: string, context: LogContext = {}) {
    writeLog("warn", message, context);
  },
  error(message: string, context: LogContext = {}) {
    writeLog("error", message, context);
  }
};

export function redactLogContext(context: LogContext): LogContext {
  return sanitizeRecord(context, 0);
}

function writeLog(level: LogLevel, message: string, context: LogContext) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message: redactString(message),
    ...redactLogContext(context)
  });

  if (level === "error") {
    console.error(entry);
    return;
  }
  if (level === "warn") {
    console.warn(entry);
    return;
  }
  console.info(entry);
}

function sanitizeRecord(value: LogContext, depth: number): LogContext {
  if (depth > 4) return { truncated: true };

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key)
        ? "[REDACTED]"
        : sanitizeValue(item, depth + 1)
    ])
  );
}

function isSensitiveKey(key: string) {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
  return normalized === "name" || sensitiveKeyPattern.test(normalized);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value instanceof Error) {
    const code = readErrorCode(value);
    return {
      name: value.name,
      ...(code ? { code } : {}),
      message: redactString(value.message)
    };
  }
  if (typeof value === "string") return redactString(value);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return sanitizeRecord(value as LogContext, depth);
  }
  return String(value);
}

function redactString(value: string) {
  const scrubbed = value
    .replace(emailPattern, "[REDACTED_EMAIL]")
    .replace(bearerPattern, "Bearer [REDACTED]")
    .replace(jwtPattern, "[REDACTED_TOKEN]");

  return scrubbed.length > 512
    ? `${scrubbed.slice(0, 512)}[TRUNCATED]`
    : scrubbed;
}

function readErrorCode(error: Error) {
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === "string" || typeof code === "number"
    ? String(code)
    : null;
}
