# LMU Lap Times Dashboard

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Vite](https://img.shields.io/badge/Vite-7-646cff)
![Vitest](https://img.shields.io/badge/Vitest-2-6E9F18)
![License](https://img.shields.io/badge/license-MIT-green)

Дашборд для мониторинга и анализа времён прохождения трасс в симуляторе **Le Mans Ultimate (LMU)**. Тёмный геймерский интерфейс в рейсинг-эстетике с поддержкой светлой темы. Данные импортируются из XML-логов rFactor2/LMU через встроенный парсер.

---

## Возможности

### 📊 Основные разделы

- **Overview** — сводные KPI (заезды, трассы, пилоты, лучший круг) и график рекордов по трассам.
- **Sessions** — табличный список сессий с фильтрацией по типу (`Все` / `Тренировка` / `Квалификация` / `Гонка`), сохранением фильтра в URL и навигацией по кнопке «Назад» с возвратом в отфильтрованный список. Строки полностью кликабельны.
- **Session Detail** — детальный вид сессии: заголовок + badge типа, KPI-карточки (победитель, fastest lap, количество кругов), таблица результатов с медалями топ‑3 и выделением игрока, вкладки results / laps / sectors, график прогрессии кругов, сводка по секторам и accordion с детальными кругами по пилотам.
- **Laps** — полная таблица заездов с расширенными фильтрами (трасса / конфигурация / пилот / класс машины / условия), сортировкой по колонкам, дельтами к лучшему кругу, данными по секторам и экспортом в CSV.
- **Leaderboards** — топ‑5 пилотов по каждой трассе + конфигурации с медалями и отставаниями; дата и время рекорда. Поддерживает полный рейтинг по выбранной трассе. Группировка по `trackName + course`.
- **Tracks** — каталог трасс с рекордами, детальные страницы (статистика, блок «Интересно», график по пилотам, рейтинг).
- **Import** — страница загрузки XML-логов rFactor2/LMU с прогресс-индикатором и отображением результата импорта.
- **Events** — разделён на две вкладки: **Daily Races** и **Special Events** с корректным форматом дат (DD.MM.YYYY).

### 🏁 Ключевые функции

- **Парсер XML-логов** (`server/logParser.ts`) с поддержкой поля `sessionCourse` (конфигурация трассы) во всех слоях — от хранилища до UI.
- **Нормализатор данных** (`server/normalizer.ts`) — очистка и унификация распознанных полей перед записью в БД.
- **Import Worker** (`server/importWorker.ts`) — фоновая обработка загруженных файлов с передачей прогресса через WebSocket.
- **Session Detail — компонентная архитектура (view-model слой):**
  - Barrel-файл типов `session-detail/types.ts`
  - Доменная view-model `SessionDetailViewModel`
  - Селекторы: `normalizeSessionType`, `buildHeroStats`, `buildResultRows`, `buildLapProgressSeries`, `buildSectorSummary`, `buildDriverLapGroups`
  - Компоненты: `SessionHeader`, `SessionHeroStats`, `SessionResultsTable`, `SessionTabs`, `SessionLoadingSkeleton`, `SessionEmptyState`, `SessionSectorsSummary`, `DriverLapsAccordion`, `SessionLapProgressChart`
- **Чек-бокс «Скрыть ИИ игроков»** рядом с фильтром пилотов.
- **Компонент `DriverName`** с AI-бейджем — метки ИИ-пилотов в SessionDetail, Leaderboards, Laps и DriverFilterBar.
- **Searchable multi-select dropdown** для выбора нескольких пилотов одновременно.
- **Общий модуль `classStyles.ts`** — стили бейджей классов машин (LMP3, GT3, GT4) без дублирования.
- Адаптивная вёрстка: на мобильных — выпадающее меню навигации.
- Светлая и тёмная темы.

---

## Технологический стек

| Слой | Технологии |
|------|------------|
| **Frontend** | React 18, Vite 7, TypeScript 5.6, Tailwind CSS 3, shadcn/ui, wouter, TanStack Query, Recharts, Framer Motion |
| **Backend** | Express 5 (TypeScript), WebSocket (ws) |
| **База данных** | SQLite (better-sqlite3) + Drizzle ORM / опционально Supabase |
| **Тестирование** | Vitest 2 + coverage-v8 |

---

## Структура проекта

```
.
├── client/              # Frontend (React)
│   └── src/
│       ├── pages/       # Overview, Sessions, SessionDetail, Laps, Leaderboards,
│       │                #   Tracks, TrackDetail, Events, Import, not-found
│       ├── components/  # AppLayout, Logo, DriverName, DriverFilterBar,
│       │                #   session-detail/* (компонентная архитектура), UI
│       ├── hooks/       # Кастомные React-хуки
│       └── lib/         # API-хуки, форматирование времён, classStyles.ts,
│                        #   sessionDetail.ts, sessionDetailSelectors.ts
├── server/              # Backend (Express)
│   ├── index.ts         # Точка входа, инициализация Express + WebSocket
│   ├── routes.ts        # REST API маршруты
│   ├── storage.ts       # Слой работы с БД (Drizzle ORM + сидинг)
│   ├── logParser.ts     # Парсер XML-логов rFactor2/LMU
│   ├── importWorker.ts  # Фоновый воркер импорта с прогресс-стримингом
│   ├── normalizer.ts    # Нормализация и валидация распознанных данных
│   ├── eventsParser.ts  # Парсер данных Events (Daily Races / Special Events)
│   ├── logger.ts        # Утилита логирования
│   ├── static.ts        # Раздача статики (продакшен)
│   └── vite.ts          # Интеграция Vite Dev Server (разработка)
├── shared/              # Общая схема данных (Drizzle + Zod)
├── script/              # Скрипты сборки (build.ts)
├── tests/               # Тесты (Vitest): routes, schema, eventsParser
├── docs/                # Дополнительная документация
├── drizzle.config.ts    # Конфигурация Drizzle ORM
├── vite.config.ts       # Конфигурация Vite
├── tailwind.config.ts   # Конфигурация Tailwind CSS
└── tsconfig.json        # Конфигурация TypeScript
```

---

## Модель данных

- **tracks** — трассы (название, страна, длина, повороты, конфигурация)
- **drivers** — пилоты (имя, команда, страна, флаг `isPlayer`)
- **sessions** — сессии с полем `sessionCourse` (конфигурация трассы) и типом сессии
- **lap_times** — заезды (время круга, секторы, класс машины, шины, условия, дата)

---

## Быстрый старт

Требуется **Node.js 18+**.

```bash
# Установить зависимости
npm install

# Создать таблицы базы данных
npm run db:push

# Запустить в режиме разработки (Express + Vite на порту 5000)
npm run dev
```

Приложение будет доступно на `http://localhost:5000`.

При первом запуске база автоматически заполняется демо‑данными: 8 трасс, 8 пилотов и заезды сезона 2026 (файл `data.db` в `.gitignore` и не коммитится).

---

## Доступные скрипты

| Скрипт | Описание |
|--------|----------|
| `npm run dev` | Запуск в режиме разработки (Express + Vite) |
| `npm run build` | Сборка для продакшена |
| `npm start` | Запуск продакшен-сборки |
| `npm run check` | Проверка типов TypeScript |
| `npm run db:push` | Применение схемы Drizzle к БД |
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

По умолчанию приложение работает на локальной SQLite-базе. Для подключения к Supabase создайте файл `.env` в корне проекта:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
```

---

## Импорт данных

Загрузите XML-лог rFactor2/LMU через раздел **Import** в интерфейсе. Сервер разберёт файл (`logParser.ts`), нормализует данные (`normalizer.ts`) и запишет их в БД через фоновый воркер (`importWorker.ts`) с отображением прогресса в реальном времени.

---

> ⚠️ **Примечание:** LMU не предоставляет публичный API для Daily Races, поэтому данные о текущей ротации добавлены статически. Рекомендую проверить актуальную ротацию на [lemansultimate.com](https://www.lemansultimate.com) и при необходимости обновить массив `DAILY_RACES_STATIC` в коде.

> Демо‑данные носят иллюстративный характер и не связаны с официальной статистикой игры Le Mans Ultimate.
