# Changelog

Все значимые изменения в этом проекте документируются в данном файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

---

## [Unreleased]

### Added
- Блок «Интересно» в карточку трассы (`TrackDetail`)
- Раздел Daily Races и Special Events в отдельные секции вкладки Events
- Поле `sessionCourse` в тип `LapTimeEnriched`; обогащение через JOIN с таблицей `sessions`
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

### Fixed
- Формат даты в Special Events tab (DD.MM.YYYY)
- `formatDate` — убрано время из `toLocaleString`, т.к. дата хранится без временной зоны
- Синтаксические ошибки в тестах (`routes.test.ts`, `schema.test.ts`, `eventsParser.test.ts`)
- Добавлены недостающие тесты для schema и eventsParser

### Refactored
- Вкладка Events разделена на Daily Races и Special Events
- Стили классов машин вынесены в `client/src/lib/classStyles.ts`

### Docs
- README: добавлены бейджи, описание тестов, секция Supabase, полный список скриптов
- README: добавлено примечание об ограничениях LMU Daily Races API
- README: все примечания перемещены в конец документа

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
