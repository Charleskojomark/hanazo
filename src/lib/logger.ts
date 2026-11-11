/**
 * Hanazo Structured Logger
 * Emits JSON formatted log events automatically indexed by Vercel Observability and log drains.
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  environment: string;
  context?: Record<string, any>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

function formatError(err: unknown): { name?: string; message: string; stack?: string } | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return {
    message: typeof err === "string" ? err : JSON.stringify(err),
  };
}

function log(level: LogLevel, message: string, context?: Record<string, any>, err?: unknown): void {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    ...(context ? { context } : {}),
    ...(err ? { error: formatError(err) } : {}),
  };

  const output = JSON.stringify(payload);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (message: string, context?: Record<string, any>) => log("info", message, context),
  warn: (message: string, context?: Record<string, any>, err?: unknown) => log("warn", message, context, err),
  error: (message: string, err?: unknown, context?: Record<string, any>) => log("error", message, context, err),
  debug: (message: string, context?: Record<string, any>) => log("debug", message, context),
};

