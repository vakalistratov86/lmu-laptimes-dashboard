/**
 * shared/parserContracts.ts
 * Контракты версионирования форматов логов LMU/rFactor (#7)
 */

// Поддерживаемые версии формата лога
export const SUPPORTED_LOG_VERSIONS = ['1.0', '1.1', '2.0'] as const;
export type LogVersion = typeof SUPPORTED_LOG_VERSIONS[number];

/**
 * Определяет версию формата лога по содержимому файла.
 * Эвристика основана на наличии тегов/атрибутов, характерных для каждой версии.
 *
 * v2.0 — содержит <Stream> и DateTime в Unix-секундах
 * v1.1 — содержит <Stream> без DateTime Unix
 * v1.0 — базовый rFactor/LMU формат без Stream
 */
export function detectLogVersion(rawContent: string): LogVersion | null {
  if (!rawContent.includes('<RaceResults>') && !rawContent.includes('rFactorXML')) {
    return null;
  }

  const hasStream = rawContent.includes('<Stream>');
  const hasUnixDateTime = /<DateTime>\d+<\/DateTime>/.test(rawContent);

  if (hasStream && hasUnixDateTime) return '2.0';
  if (hasStream) return '1.1';
  return '1.0';
}

/**
 * Проверяет, поддерживается ли версия лога.
 * Бросает ошибку с кодом UNSUPPORTED_LOG_VERSION если нет.
 */
export function assertSupportedVersion(version: LogVersion | null, rawContent: string): LogVersion {
  if (version === null) {
    const err = new Error(
      'Не удалось определить версию формата лога. ' +
      'Убедитесь, что файл является результатом сессии LMU/rFactor (ожидается тег <RaceResults>).'
    );
    (err as any).code = 'UNSUPPORTED_LOG_VERSION';
    throw err;
  }

  if (!(SUPPORTED_LOG_VERSIONS as readonly string[]).includes(version)) {
    const err = new Error(
      `Неподдерживаемая версия формата лога: '${version}'. ` +
      `Поддерживаются: ${SUPPORTED_LOG_VERSIONS.join(', ')}.`
    );
    (err as any).code = 'UNSUPPORTED_LOG_VERSION';
    throw err;
  }

  return version;
}

/**
 * Интерфейс парсера с привязкой к версии формата.
 * Используется для реестра парсеров.
 */
export interface Parser<TRaw, TDomain> {
  version: LogVersion;
  parse(raw: TRaw): TDomain;
}

/**
 * Реестр парсеров: маппинг version -> parser.
 * Позволяет в будущем регистрировать разные парсеры для разных версий формата.
 */
const parserRegistry = new Map<LogVersion, Parser<any, any>>();

export function registerParser<TRaw, TDomain>(parser: Parser<TRaw, TDomain>): void {
  parserRegistry.set(parser.version, parser);
}

export function getParser<TRaw, TDomain>(version: LogVersion): Parser<TRaw, TDomain> | undefined {
  return parserRegistry.get(version) as Parser<TRaw, TDomain> | undefined;
}
