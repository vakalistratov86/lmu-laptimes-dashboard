# Changelog

Все значимые изменения в этом проекте документируются в данном файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

---

## [Unreleased]

### Added
- **Session Detail — полный рефакторинг архитектуры компонентов (SD-1 – SD-14)**
  - Barrel-файл типов `client/src/components/session-detail/types.ts` (SD-1, #32, #46)
  - Доменная view-model `SessionDetailViewModel` в `client/src/lib/sessionDetail.types.ts` (SD-2, #33)
  - Селекторы `normalizeSessionType`, `buildHeroStats`, `buildResultRows`, `buildLapProgressSeries`, `buildSectorSummary`, `buildDriverLapGroups` в `sessionDetailSelectors.ts` (SD-3, #34)
  - Функция-агрегатор `buildSessionDetailViewModel` в `client/src/lib/sessionDetail.ts` (SD-4, #35)
  - Компонент `SessionHeader` с кнопкой назад, badge типа сессии, трассой, датой (SD-5, #36)
  - Компонент `SessionHeroStats` с KPI-карточками (победитель, fastest lap, круги и т.д.) (SD-6, #37)
  - Компонент `SessionResultsTable` + `SessionResultsRow` с медалями топ-3, выделением игрока и управляемыми колонками (SD-7, #38)
  - Компонент `SessionTabs` с поддержкой вкладок results / laps / sectors (SD-8, #39)
  - Компонент `SessionLoadingSkeleton` со скелет-строками и флагами hero/tabs (SD-9, #40)
  - Компонент `SessionEmptyState` для сценариев 404, no laps, no chart data (SD-10, #41)
  - Рефакторинг страницы `pages/SessionDetail.tsx` под новую архитектуру и view-model (SD-11, #42)
  - Компонент `SessionSectorsSummary` со сводкой best-секторов и theoretical best (SD-12, #43)
  - Компоненты `DriverLapsAccordion` и `DriverLapTable` для детальных кругов по пилотам (SD-13, #44)
  - Компонент `SessionLapProgressChart` — график прогрессии кругов по нескольким пилотам (SD-14, #45)
- Страница Sessions переработана в табличный layout (#21)
- Фильтры по типу сессии над таблицей (`Все`, `Тренировка`, `Квалификация`, `Гонка`, ...) (#22)
- Стилизованные badge-и для типов сессий с цветовой схемой (#23, #17)
- Таблица сессий приведена к 4 колонкам: Тип, Трек, Лучший круг, Дата (#24)
- Строки таблицы сессий полностью кликабельны (hover, cursor:pointer, keyboard nav) (#25)
- Сохранение активного фильтра в URL; кнопка «Назад» возвращает в отфильтрованный список (#26)
- Детальный вид сессии: заголовок + таблица результатов как главный блок (#27)
- Финальный набор колонок таблицы результатов с выделением fastest lap и игрока (#28)
- Блок «Круги по пилотам» перенесён ниже основной таблицы как вторичный раздел (#29)
- Loading / empty / no-results состояния для страниц списка и деталей сессий (#30)
- Блок «Интересно» в карточку трассы (`TrackDetail`)
- Раздел Daily Races и Special Events в отдельные секции вкладки Events
- Поле `sessionCourse` в тип `LapTimeEnriched`; обогащение через JOIN с таблицей `sessions` (#3)
- Группировка лидерборда по `trackName + course`
- Измерение `track` в Reports использует `trackName + course`
- Фильтр `sessionCourse` в интерфейс `LapFilter`
- Тесты для JOIN-поведения `getLaps()` в `tests/routes.test.ts`
- Поддержка `TrackCourse` во всех слоях: парсер логов, хранилище, UI (Sessions, SessionDetail, Leaderboards, Reports)
- Чек-бокс «Скрыть ИИ игроков» рядом с выпадающим списком пилотов
- Компонент `DriverName` с AI-бейджем; поле `isPlayer` в `LapTimeEnriched`
- Метка AI для имён пилотов в SessionDetail, Leaderboards, Laps, DriverFilterBar
- Расширена схема БД для хранения всех извлекаемых полей rFactor XML
- Дата и время рекорда в лидерборде
- Замена чипов пилотов на searchable multi-select dropdown
- Общий модуль `classStyles.ts` для стилей классов машин (вынесен из Leaderboards и Laps)
- Стили бейджей LMP3, GT3, GT4 в Laps.tsx

### Changed
- Migrated primary storage from SQLite (better-sqlite3) to PostgreSQL с использованием drizzle-orm + postgres-js.
- Обновлён `server/storage.ts` под асинхронные операции PostgreSQL.
- `server/routes.ts` переведён на async/await и работу с PostgreSQL.
- Добавлен `server/migrate.ts` и авто-запуск миграций при старте сервера.
- Обновлён `drizzle.config.ts` под PostgreSQL.
- Обновлён `docker-compose.yml`: сервис PostgreSQL, healthcheck и проброс портов 3000→5000.
- Доработан `Dockerfile`: генерация миграций drizzle-kit на этапе сборки, использование `app.listen` и привязка к `0.0.0.0`.

### Fixed
- Унификация стилей badge класса машины в `SessionDetail` и `TrackDetail` через `getClassBadgeClass` (#14)
- `SessionDetail.tsx`: захардкоженный GTE-цвет заменён на динамический `getClassBadgeClass` (#14)
- `TrackDetail.tsx`: удалены локальные `CLASS_BADGE` / `getClassBadge()`, дублировавшие `classStyles.ts` (#14)
- Формат даты в Special Events tab (DD.MM.YYYY)
- `formatDate` — убрано время из `toLocaleString`, т.к. дата хранится без временной зоны
- Синтаксические ошибки в тестах (`routes.test.ts`, `schema.test.ts`, `eventsParser.test.ts`)
- Добавлены недостающие тесты для schema и eventsParser
- Исправлено переполнение PostgreSQL integer (22003) для Unix timestamp в миллисекундах: поля `created_at` и `finished_at` таблицы `import_jobs` мигрированы на тип `BIGINT`.
- Упрощена генерация `.env` в CI: использование `printf` вместо heredoc.
- Добавлены проверки docker-compose-конфига и уборка контейнеров в CI.

### Refactored
- `SessionDetail.tsx` разбит на компонентную архитектуру с view-model слоем (SD-11, #42)
- Вкладка Events разделена на Daily Races и Special Events
- Стили классов машин вынесены в `client/src/lib/classStyles.ts`

### Docs
- README: добавлены бейджи, описание тестов, секция Supabase, полный список скриптов
- README: добавлено примечание об ограничениях LMU Daily Races API
- README: все примечания перемещены в конец документа
- README: обновлён стек БД на PostgreSQL, добавлены секции Docker и DATABASE_URL
- CHANGELOG: задокументирована миграция на PostgreSQL, BIGINT-фикс, CI/Docker изменения

---

## [0.1.0] — 2026-07-14

### Added
- Первоначальная настройка проекта под Windows
- Базовые страницы: Overview, Laps, Leaderboards, Reports, Tracks, TrackDetail
- Тёмная/светлая тема, адаптивная вёрстка
- Backend: Express 5 + TypeScript, REST API
- База данных: SQLite (better-sqlite3) + Drizzle ORM
- Автоматическое заполнение демо-данными при первом запуске
- Опциональная поддержка Supabase через переменные окружения
- Тестирование: Vitest + coverage-v8
- Конфигурация Vite 7, Tailwind CSS 3, shadcn/ui
