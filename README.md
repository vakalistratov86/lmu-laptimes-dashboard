# LMU Lap Times Dashboard

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

Дашборд для мониторинга и анализа времён прохождения трасс в симуляторе **Le Mans Ultimate (LMU)**. Тёмный геймерский интерфейс в рейсинг-эстетике с поддержкой светлой темы.

## Возможности

- **Обзор** — сводные KPI (заезды, трассы, пилоты, лучший круг) и график рекордов по трассам.
- **Таблица времён** — все заезды с фильтрами (трасса / пилот / класс машины / условия), сортировкой по колонкам, дельтами к лучшему кругу, секторами и экспортом в CSV.
- **Лидерборды** — топ‑5 пилотов по каждой трассе с медалями и отставаниями, либо полный рейтинг по выбранной трассе.
- **Конструктор отчётов** — настраиваемое измерение (трасса / пилот / класс / условия), метрика (лучший круг, средний круг, количество заездов) и тип графика (столбцы / линия) с таблицей данных и экспортом.
- **Трассы** — каталог трасс с рекордами и детальные страницы (статистика, график по пилотам, рейтинг).
- Адаптивная вёрстка (на мобильных — выпадающее меню), светлая и тёмная темы.

## Технологический стек

| Слой | Технологии |
|------|------------|
| **Frontend** | React 18, Vite 7, TypeScript 5.6, Tailwind CSS 3, shadcn/ui, wouter, TanStack Query, Recharts, Framer Motion |
| **Backend** | Express 5 (TypeScript) |
| **База данных** | SQLite (better-sqlite3) + Drizzle ORM / опционально Supabase |
| **Тестирование** | Vitest + coverage-v8 |

## Структура проекта

```
.
├── client/              # Frontend (React)
│   └── src/
│       ├── pages/       # Overview, Laps, Leaderboards, Reports, Tracks, TrackDetail
│       ├── components/  # Общие компоненты (AppLayout, Logo, UI)
│       └── lib/         # API-хуки, форматирование времён
├── server/              # Backend (Express): routes.ts, storage.ts (+ сидинг)
├── shared/              # Общая схема данных (Drizzle + Zod)
├── script/              # Скрипты сборки
├── tests/               # Тесты (Vitest)
└── drizzle.config.ts    # Конфигурация Drizzle ORM
```

## Модель данных

- **tracks** — трассы (название, страна, длина, повороты, конфигурация)
- **drivers** — пилоты (имя, команда, страна)
- **lap_times** — заезды (время круга, секторы, класс машины, шины, условия, дата)

## Запуск

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

## Сборка для продакшена

```bash
npm run build
NODE_ENV=production npm start
```

## Переменные окружения

Для подключения к Supabase создайте файл `.env` в корне проекта:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
```

Без этих переменных приложение работает в режиме локальной SQLite-базы данных.

---

> ⚠️ **Примечание:** LMU не предоставляет публичный API для Daily Races, поэтому данные о текущей ротации добавлены статически. Рекомендую проверить актуальную ротацию на [lemansultimate.com](https://www.lemansultimate.com) и при необходимости обновить массив `DAILY_RACES_STATIC` в коде.

> Демо‑данные носят иллюстративный характер и не связаны с официальной статистикой игры Le Mans Ultimate.
