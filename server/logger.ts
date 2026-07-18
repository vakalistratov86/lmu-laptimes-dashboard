/**
 * server/logger.ts
 * Структурированное JSON-логирование для parser pipeline (#12)
 *
 * Использует нативный console с JSON-форматом вместо внешней зависимости pino.
 * Совместим с любым агрегатором логов (Supabase Logs, stdout).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

function emit(level: LogLevel, context: Record<string, unknown>, message: string): void {
  if (!shouldLog(level)) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    service: 'lmu-parser',
    ...context,
    msg: message,
  };
  const output = JSON.stringify(entry);
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (context: Record<string, unknown>, message: string) => emit('debug', context, message),
  info: (context: Record<string, unknown>, message: string) => emit('info', context, message),
  warn: (context: Record<string, unknown>, message: string) => emit('warn', context, message),
  error: (context: Record<string, unknown>, message: string) => emit('error', context, message),
};

// ── Типизированные хелперы для import pipeline ──────────────────────────────

export interface ImportStartedContext {
  importJobId: string;
  fileName: string;
  logVersion: string;
}

export interface ImportCompletedContext {
  importJobId: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  durationMs: number;
}

export interface ParseErrorContext {
  importJobId: string;
  lineNumber?: number;
  raw?: string;
  code: string;
}

export interface ImportSkippedContext {
  importJobId: string;
  fileName: string;
  reason: string;
}

export function logImportStarted(ctx: ImportStartedContext): void {
  logger.info(ctx, 'Import started');
}

export function logImportCompleted(ctx: ImportCompletedContext): void {
  logger.info(ctx, 'Import completed');
}

export function logParseError(ctx: ParseErrorContext, message: string): void {
  logger.warn(ctx, message);
}

export function logImportFailed(importJobId: string, error: Error): void {
  logger.error(
    { importJobId, errorCode: (error as any).code ?? 'UNKNOWN', message: error.message },
    'Import failed'
  );
}

export function logImportSkipped(ctx: ImportSkippedContext): void {
  logger.warn(ctx, 'Import skipped');
}
