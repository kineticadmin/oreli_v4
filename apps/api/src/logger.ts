/**
 * Logging JSON structuré (SYSTEM.md : pas de `console.log`).
 * Écrit une ligne JSON par événement sur stdout.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, message: string, fields: LogFields): void {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export const logger = {
  debug: (message: string, fields: LogFields = {}): void =>
    emit("debug", message, fields),
  info: (message: string, fields: LogFields = {}): void =>
    emit("info", message, fields),
  warn: (message: string, fields: LogFields = {}): void =>
    emit("warn", message, fields),
  error: (message: string, fields: LogFields = {}): void =>
    emit("error", message, fields),
} as const;
