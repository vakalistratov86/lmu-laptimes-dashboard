# LMU Lap Times Dashboard

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Vite](https://img.shields.io/badge/Vite-7-646cff)
![Vitest](https://img.shields.io/badge/Vitest-2-6E9F18)
![Database](https://img.shields.io/badge/DB-PostgreSQL-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Deploy](https://img.shields.io/badge/autodeploy-✅_tested-brightgreen)

Дашборд для мониторинга и анализа времён прохождения трасс в симуляторе **Le Mans Ultimate (LMU)**. Тёмный геймерский интерфейс в рейсинг-эстетике с поддержкой светлой темы. Данные импортируются из XML-логов rFactor2/LMU через встроенный парсер и сохраняются в PostgreSQL.

---

## Возможности

### 📊 Основные разделы

- **Overview** — 8 KPI-плиток (пройдено расстояния, трасс, пилотов, лучший круг, гонок, реальных игроков, ИИ-игроков, кругов пройдено) и график лучшего времени по трассам.
- **Sessions** — сводная плитка с количеством и суммарным временем тренировок/квалификаций/гонок (в цветах категорий), сегментированный фильтр по типу сессии (`Все` / `Тренировка` / `Квалификация` / `Гонка`) с сохранением в URL, таблица сессий (тип, трек, классы машин, лучший круг, круги, дата). Кнопка «Назад» из деталей сессии возвращает в отфильтрованный список. Строки полностью кликабельны.
- **Session Detail** — статичная плитка трассы/сессии (не зависит от активной вкладки) + всегда видимая карточка выбранного пилота (по умолчанию — позиция 1, весь набор его статистики за сессию, включая раскраску секторов) + вкладки «Результаты / Круги / Прогресс», встроенные в шапку общей карточки. Сектора и медали топ‑3 подсвечиваются цветом (личный лучший / абсолютный лучший сессии; золото/серебро/бронза).
- **Leaderboards** — вертикальный список полноширинных карточек по трассе (группировка по `trackName + course`), внутри каждой — разбивка по классам машин, медали, отставания, дата и время рекорда, фильтр по конфигурации трассы.
- **Tracks** — каталог трасс с амбер-подсветкой контура на карте, рекордами, блоком «Интересно» и рейтингом по трассе.
- **Import** — загрузка XML-логов через выбор папки (File System Access API с fallback для браузеров без поддержки), автоимпорт новых файлов по таймеру, устойчивый к перезагрузке журнал импорта, определение дубликатов по хэшу файла, кнопка очистки БД.
- **Events** — разделён на две вкладки: **Daily Races** и **Special Events** с корректным форматом дат (DD.MM.YYYY).

### 🏁 Ключевые функции

- **Парсер XML-логов** (`server/logParser.ts`) с поддержкой поля `sessionCourse` (конфигурация трассы) во всех слоях — от хранилища до UI.
- **Нормализатор данных** (`server/normalizer.ts`) — очистка и унификация распознанных полей перед записью в БД.
- **Import** (`server/importWorker.ts` + `client/src/pages/Import.tsx`) — синхронная обработка файлов по одному, идемпотентность по SHA-256 хэшу содержимого, DLQ для битых записей (`import_errors`), журнал импорта в localStorage/IndexedDB, автоимпорт папки.
- **Session Detail — компонентная архитектура:**
  - Единый источник категорий/цветов/подписей типа сессии и медалей — `client/src/lib/classStyles.ts` (`normalizeSessionCategory`, `SESSION_TYPE_BADGE`, `getMedalColorClass`)
  - Общие компоненты `SessionTypeBadge` (плашка фиксированной ширины, одинаковая везде) и `StatTile` (переиспользуемая мини-плитка статистики)
  - Селекторы `sessionDetailSelectors.ts`: `buildResultRows`, `buildDriverLapGroups`, `buildSectorSummary`, `buildLapProgressSeries`, `buildTabs`
  - Компоненты `session-detail/*`: `SessionInfoCard`, `SessionDriverDetailCard`, `SessionResultsTable`, `SessionTabs`, `DriverLapTable`, `SessionLapProgressChart`, `SessionLoadingSkeleton`, `SessionEmptyState`
- **Единая иконка пилота** (`DriverName`) — зелёный человечек для реального игрока, жёлтый робот для ИИ; используется в Sessions, Session Detail, Leaderboards, Tracks и `DriverFilterBar`.
- **`DriverFilterBar`** — searchable multi-select с секциями «Выбрано / Игроки / ИИ», переключателями «Показать ИИ» и «Выбрать все» (массовый выбор видимого списка).
- Тематизированный скроллбар во всём приложении (не системный) — под цвет тёмной/светлой темы.
- Адаптивная вёрстка: на мобильных — выпадающее меню навигации.
- Светлая и тёмная темы.

---

## Технологический стек

| Слой | Технологии |
|------|------------|
| **Frontend** | React 18, Vite 7, TypeScript 5.6, Tailwind CSS 3, shadcn/ui, wouter, TanStack Query, Recharts |
| **Backend** | Express 5 (TypeScript) |
| **База данных** | PostgreSQL (drizzle-orm + postgres-js), миграции drizzle-kit |
| **Тестирование** | Vitest 2 + coverage-v8 |

---

## Структура проекта

```
.
├── client/              # Frontend (React)
│   └── src/
│       ├── pages/       # Overview, Sessions, SessionDetail, Leaderboards,
│       │                #   Tracks, TrackDetail, Events, Import, not-found
│       ├── components/  # AppLayout, Logo, DriverName, DriverFilterBar,
│       │                #   SessionTypeBadge, StatTile, TrackMap,
│       │                #   session-detail/* (SessionInfoCard, SessionDriverDetailCard,
│       │                #   SessionResultsTable, SessionTabs, DriverLapTable,
│       │                #   SessionLapProgressChart, ...), UI (shadcn)
│       ├── hooks/       # Кастомные React-хуки
│       └── lib/         # API-хуки, форматирование времён, classStyles.ts
│                        #   (единый источник цветов/подписей типов сессии, классов
│                        #   машин и медалей), sessionDetailSelectors.ts
├── server/              # Backend (Express)
│   ├── index.ts         # Точка входа, инициализация Express
│   ├── routes.ts        # REST API маршруты (async, PostgreSQL)
│   ├── storage.ts       # Слой работы с БД (Drizzle ORM + postgres-js)
│   ├── migrate.ts       # Авто-миграции БД при старте
│   ├── logParser.ts     # Парсер XML-логов rFactor2/LMU
│   ├── importWorker.ts  # Разбор и синхронная запись импортируемого файла в БД
│   ├── normalizer.ts    # Нормализация и валидация распознанных данных
│   ├── eventsParser.ts  # Парсер данных Events (Daily Races / Special Events)
│   ├── logger.ts        # Утилита логирования
│   ├── static.ts        # Раздача статики (продакшен)
│   └── vite.ts          # Интеграция Vite Dev Server (разработка)
├── shared/              # Общая схема данных (Drizzle + Zod), 11 таблиц PostgreSQL
├── script/              # Скрипты сборки (build.ts)
├── tests/               # Тесты (Vitest): routes, schema, storage, logParser,
│                        #   normalizer, validators, eventsParser, format,
│                        #   importIdempotency
├── docs/                # Дополнительная документация
├── drizzle.config.ts    # Конфигурация Drizzle ORM (PostgreSQL)
├── docker-compose.yml   # PostgreSQL + приложение, порты 3000→5000
├── Dockerfile           # Образ приложения с генерацией миграций
├── vite.config.ts       # Конфигурация Vite
├── tailwind.config.ts   # Конфигурация Tailwind CSS
└── tsconfig.json        # Конфигурация TypeScript
```

---

## Модель данных

- **tracks** — трассы (название, страна, длина, повороты, конфигурация)
- **drivers** — пилоты (имя, команда, страна, флаг `isPlayer`)
- **lap_times** — «плоские» заезды демо-сезона (время круга, секторы, класс машины, шины, условия, дата) — используются на Overview/Leaderboards/Tracks
- **sessions** — сессии, импортированные из XML-логов (тип, трасса, `sessionCourse`, событие, версия игры, длительность и др.)
- **session_results** — итоговый результат каждого пилота в сессии (позиция, класс, команда, лучший круг, пит-стопы, статус финиша)
- **session_laps** — данные по каждому кругу каждого пилота (время, 3 сектора, макс. скорость, топливо, износ и состав шин, пит-лап)
- **session_incidents** — инциденты сессии (участники, тяжесть, момент времени)
- **session_sector_bests** — лучшие времена по секторам в разрезе класса машины
- **session_track_limits** — нарушения трек-лимитов
- **import_jobs** — журнал импортированных файлов (статус, хэш содержимого для идемпотентности, счётчики кругов)
- **import_errors** — DLQ: записи, не прошедшие валидацию при импорте

> Демо-заполнение (`seedIfEmpty`) создаёт 8 трасс, 8 пилотов и заезды в `lap_times` — этого достаточно для Overview/Leaderboards/Tracks, но раздел **Sessions/Session Detail** показывает данные только после реального импорта XML-логов через **Import**.

---

## Быстрый старт

Требуется **Node.js 18+** и **PostgreSQL**.

Создайте `.env` в корне:

```env
DATABASE_URL=postgres://lmu:lmu_password@localhost:5432/lmu_laptimes
ADMIN_TOKEN=придумайте-свой-секретный-токен
```

`ADMIN_TOKEN` защищает деструктивные операции (полная очистка БД/демо-данных/телеметрии — кнопки «Очистить БД» и «Очистить телеметрию» на вкладке Import, а также прямые запросы к API). Без этой переменной такие запросы отклоняются с 503. При первом использовании кнопки очистки приложение один раз спросит токен и запомнит его в браузере.

```bash
# Установить зависимости
npm install

# Применить схему базы данных (PostgreSQL)
npm run db:push

# Запустить в режиме разработки (Express + Vite на порту 5000)
npm run dev
```

Приложение будет доступно на `http://localhost:5000`.

При первом запуске база автоматически заполняется демо‑данными: 8 трасс, 8 пилотов и заезды сезона 2026.

---

## Запуск через Docker

```bash
docker compose up --build
```

- Поднимает контейнер PostgreSQL.
- Собирает образ приложения, запускает миграции и сервер.
- Пробрасывает порт 3000 (хост) → 5000 (контейнер).

Приложение будет доступно на `http://localhost:3000`.

---

## Доступные скрипты

| Скрипт | Описание |
|--------|----------|
| `npm run dev` | Запуск в режиме разработки (Express + Vite) |
| `npm run build` | Сборка для продакшена |
| `npm start` | Запуск продакшен-сборки |
| `npm run check` | Проверка типов TypeScript |
| `npm run db:push` | Применение схемы Drizzle к БД (PostgreSQL) |
| `npm test` | Запуск тестов (Vitest) |
| `npm run test:watch` | Запуск тестов в watch-режиме |
| `npm run test:coverage` | Отчёт о покрытии кода тестами |

---

## Сборка для продакшена

```bash
npm run build
NODE_ENV=production npm start
```

---

## Переменные окружения

Приложение требует подключения к PostgreSQL через переменную `DATABASE_URL`:

```env
DATABASE_URL=postgres://lmu:lmu_password@localhost:5432/lmu_laptimes
```

---

## Импорт данных

Выберите папку с XML-логами rFactor2/LMU через раздел **Import** (File System Access API; для браузеров без поддержки — обычный выбор файлов). Каждый файл отправляется отдельным запросом `POST /api/import`, сервер разбирает его (`logParser.ts`), нормализует (`normalizer.ts`) и синхронно записывает в БД (`importWorker.ts`), возвращая результат сразу в ответе. Дубликаты определяются по SHA-256 хэшу содержимого, файлы без кругов пропускаются с предупреждением (не как ошибка), а невалидные записи попадают в DLQ (`import_errors`). Журнал импорта и список уже обработанных файлов сохраняются в localStorage/IndexedDB и переживают перезагрузку страницы; опционально можно включить автоимпорт — повторное сканирование папки по таймеру.

---

> ⚠️ **Примечание:** LMU не предоставляет публичный API для Daily Races, поэтому данные о текущей ротации добавлены статически. Рекомендую проверить актуальную ротацию на [lemansultimate.com](https://www.lemansultimate.com) и при необходимости обновить массив `DAILY_RACES_STATIC` в коде.

> Демо‑данные носят иллюстративный характер и не связаны с официальной статистикой игры Le Mans Ultimate.
