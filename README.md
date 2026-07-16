# LMU Lap Times Dashboard

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Vite](https://img.shields.io/badge/Vite-7-646cff)
![License](https://img.shields.io/badge/license-MIT-green)

Дашборд для мониторинга и анализа времён прохождения трасс в симуляторе **Le Mans Ultimate (LMU)**. Тёмный геймерский интерфейс в рейсинг-эстетике с поддержкой светлой темы. Данные импортируются из XML-логов rFactor2/LMU.

---

## Возможности

### 📊 Основные разделы

- **Overview** — сводные KPI (заезды, трассы, пилоты, лучший круг) и график рекордов по трассам.
- **Laps** — полная таблица заездов с расширенными фильтрами (трасса / конфигурация / пилот / класс машины / условия), сортировкой по колонкам, дельтами к лучшему кругу, данными по секторам и экспортом в CSV.
- **Leaderboards** — топ‑5 пилотов по каждой трассе + конфигурации с медалями и отставаниями; дата и время рекорда. Поддерживает полный рейтинг по выбранной трассе.
- **Reports** — конструктор отчётов с настраиваемым измерением (трасса / пилот / класс / условия), метрикой (лучший круг, средний круг, количество заездов) и типом графика (столбцы / линия); таблица данных и экспорт.
- **Tracks** — каталог трасс с рекордами, детальные страницы (статистика, блок «Интересно», график по пилотам, рейтинг).
- **Events** — разделён на две вкладки: **Daily Races** и **Special Events** с корректным форматом дат (DD.MM.YYYY).

### 🏁 Ключевые функции

- Парсер XML-логов rFactor с поддержкой поля `sessionCourse` (конфигурация трассы) во всех слоях — от хранилища до UI.
- Группировка лидерборда по `trackName + course` для точного разделения конфигураций одной трассы.
- Чек-бокс **«Скрыть ИИ игроков»** рядом с фильтром пилотов.
- Компонент `DriverName` с **AI-бейджем** — метки ИИ-пилотов отображаются в SessionDetail, Leaderboards, Laps и DriverFilterBar.
- Searchable multi-select dropdown для выбора нескольких пилотов одновременно.
- Стили бейджей классов машин (LMP3, GT3, GT4) вынесены в общий модуль `classStyles.ts`.
- Адаптивная вёрстка: на мобильных — выпадающее меню навигации.
- Светлая и тёмная темы.

---

## Технологический стек

| Слой | Технологии |
|------|------------|
| **Frontend** | React 18, Vite 7, TypeScript 5.6, Tailwind CSS 3, shadcn/ui, wouter, TanStack Query, Recharts, Framer Motion |
| **Backend** | Express 5 (TypeScript) |
| **База данных** | SQLite (better-sqlite3) + Drizzle ORM / опционально Supabase |
| **Тестирование** | Vitest + coverage-v8 |

---

## Структура проекта

```
.
├── client/              # Frontend (React)
│   └── src/
│       ├── pages/       # Overview, Laps, Leaderboards, Reports, Tracks, TrackDetail, Events
│       ├── components/  # Общие компоненты (AppLayout, Logo, DriverName, DriverFilterBar, UI)
│       └── lib/         # API-хуки, форматирование времён, classStyles.ts
├── server/              # Backend (Express): routes.ts, storage.ts (+ сидинг), eventsParser
├── shared/              # Общая схема данных (Drizzle + Zod)
├── script/              # Скрипты сборки
├── tests/               # Тесты (Vitest): routes, schema, eventsParser
└── drizzle.config.ts    # Конфигурация Drizzle ORM
```

---

## Модель данных

- **tracks** — трассы (название, страна, длина, повороты, конфигурация)
- **drivers** — пилоты (имя, команда, страна, флаг `isPlayer`)
- **sessions** — сессии с полем `sessionCourse` (конфигурация трассы)
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

> ⚠️ **Примечание:** LMU не предоставляет публичный API для Daily Races, поэтому данные о текущей ротации добавлены статически. Рекомендую проверить актуальную ротацию на [lemansultimate.com](https://www.lemansultimate.com) и при необходимости обновить массив `DAILY_RACES_STATIC` в коде.

> Демо‑данные носят иллюстративный характер и не связаны с официальной статистикой игры Le Mans Ultimate.
