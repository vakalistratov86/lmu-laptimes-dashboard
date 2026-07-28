# Contributing to LMU Lap Times Dashboard

Спасибо, что хотите внести вклад в проект! Этот документ описывает процесс разработки, соглашения и правила оформления изменений.

---

## Содержание

- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Структура проекта](#структура-проекта)
- [Процесс разработки](#процесс-разработки)
- [Соглашения по коммитам](#соглашения-по-коммитам)
- [Версионирование и релизы](#версионирование-и-релизы)
- [Тестирование](#тестирование)
- [Линтинг и форматирование](#линтинг-и-форматирование)
- [Отправка Pull Request](#отправка-pull-request)
- [Сообщение об ошибках](#сообщение-об-ошибках)

---

## Требования

- **Node.js** 18+
- **npm** 9+
- Git

## Быстрый старт

```bash
# 1. Форкните репозиторий и клонируйте свой форк
git clone https://github.com/<your-username>/lmu-laptimes-dashboard.git
cd lmu-laptimes-dashboard

# 2. Установите зависимости
npm install

# 3. Создайте таблицы базы данных
npm run db:push

# 4. Запустите в режиме разработки
npm run dev
```

Приложение запустится на `http://localhost:5000`.

---

## Структура проекта

```text
.
├── client/              # Frontend (React 18, Vite, Tailwind, shadcn/ui)
│   └── src/
│       ├── pages/       # Страницы: Overview, Laps, Leaderboards, Reports, Tracks, TrackDetail
│       ├── components/  # Общие компоненты (AppLayout, DriverName, UI-kit)
│       └── lib/         # API-хуки (TanStack Query), форматирование, classStyles
├── server/              # Backend (Express 5): routes.ts, storage.ts, logParser, eventsParser
├── shared/              # Общая схема данных (Drizzle + Zod)
├── script/              # Вспомогательные скрипты сборки
├── tests/               # Тесты (Vitest)
├── eslint.config.js     # Конфигурация ESLint
├── .prettierrc.json     # Конфигурация Prettier
├── .markdownlint.jsonc  # Конфигурация markdownlint (docs-lint CI)
└── drizzle.config.ts    # Конфигурация Drizzle ORM
```

---

## Процесс разработки

### Ветки

Используйте следующую схему именования веток:

| Тип                  | Шаблон                          | Пример                                  |
|----------------------|---------------------------------|-----------------------------------------|
| Новая функция        | `feature/<короткое-описание>`   | `feature/track-course-support`          |
| Исправление ошибки   | `fix/<короткое-описание>`       | `fix/formatdate-timezone`               |
| Рефакторинг          | `refactor/<короткое-описание>`  | `refactor/class-styles-module`          |
| Документация         | `docs/<короткое-описание>`      | `docs/update-readme`                    |
| Тесты                | `test/<короткое-описание>`      | `test/events-parser`                    |

### Workflow

1. Создайте ветку от `main`
2. Внесите изменения небольшими логическими коммитами
3. Убедитесь, что все тесты проходят (`npm test`)
4. Проверьте типы TypeScript (`npm run check`)
5. Проверьте линтер (`npm run lint`) и форматирование (`npm run format:check`) — оба проверяются в CI (`.github/workflows/lint.yml`)
6. Откройте Pull Request в `main`

---

## Соглашения по коммитам

Проект следует спецификации [Conventional Commits](https://www.conventionalcommits.org/ru/).

### Формат

```text
<тип>[(область)]: <краткое описание>

[тело — необязательно]

[подвал — необязательно]
```

### Типы коммитов

| Тип        | Описание                                              |
|------------|-------------------------------------------------------|
| `feat`     | Новая функциональность                                |
| `fix`      | Исправление ошибки                                    |
| `docs`     | Изменения только в документации                       |
| `refactor` | Рефакторинг без изменения поведения                   |
| `perf`     | Улучшение производительности                          |
| `revert`   | Откат предыдущего коммита                             |
| `test`     | Добавление или исправление тестов                     |
| `chore`    | Обслуживание: обновление зависимостей, конфиги и т.п. |
| `style`    | Форматирование кода (без изменения логики)            |
| `build`    | Сборка, зависимости, упаковка                         |
| `ci`       | Конфигурация CI (GitHub Actions и т.п.)               |

`feat`, `fix`, `perf`, `refactor` и `revert` в `main` напрямую влияют на
версию и CHANGELOG (см. [«Версионирование и релизы»](#версионирование-и-релизы)
ниже) — остальные типы релиз не создают.

Ломающее изменение помечается `!` после типа/области или футером
`BREAKING CHANGE: <описание>` — это всегда даёт major-версию:

```text
feat(api)!: убрать устаревший эндпоинт GET /api/laps

BREAKING CHANGE: используйте GET /api/sessions/:id/laps
```

### Примеры

```text
feat(leaderboards): добавить группировку по trackName + course
fix(ui): исправить формат даты в Special Events tab
docs: обновить README — добавить секцию Supabase
refactor: вынести стили классов машин в classStyles.ts
test(routes): добавить тесты для getLaps JOIN-поведения
```

При наличии связанного issue укажите его в подвале:

```text
feat(#3): enrich getLaps() with sessionCourse via JOIN with sessions

Closes #3
```

---

## Версионирование и релизы

Проект использует [Semantic Versioning](https://semver.org/lang/ru/)
(`MAJOR.MINOR.PATCH`). Версия, git-теги (`vX.Y.Z`), [CHANGELOG.md](CHANGELOG.md)
и GitHub Release с версии `1.0.0` формируются автоматически при пуше в `main`
через [semantic-release](https://semantic-release.gitbook.io/) — вручную
версию нигде менять не нужно, `package.json`/`CHANGELOG.md` правит только
CI (job `release` в `.github/workflows/deploy.yml`).

Версия следующего релиза определяется типом коммитов с прошлого тега
(см. [«Соглашения по коммитам»](#соглашения-по-коммитам) выше):

| Коммиты с прошлого релиза                           | Бамп версии |
|-----------------------------------------------------|-------------|
| `fix`, `perf`, `refactor`                           | `PATCH`     |
| `feat`                                              | `MINOR`     |
| `!` после типа/области или футер `BREAKING CHANGE:` | `MAJOR`     |
| только `docs`/`test`/`chore`/`style`/`build`/`ci`   | релиза нет  |

После публикации релиза CI дополнительно собирает и пушит Docker-образ
в GHCR с тегами `:latest` и `:vX.Y.Z`
(`ghcr.io/vakalistratov86/lmu-laptimes-dashboard`), затем деплоит его на
сервер — см. `build-and-push`/`deploy` в `.github/workflows/deploy.yml`.

---

## Тестирование

```bash
# Запуск всех тестов
npm test

# Режим watch (при разработке)
npm run test:watch

# Отчёт о покрытии
npm run test:coverage
```

### Правила

- Новая функциональность должна сопровождаться тестами
- Исправления ошибок должны включать регрессионный тест
- Тесты размещаются в директории `tests/`
- Фреймворк: **Vitest**; для моков используйте `vi.mock()`

---

## Линтинг и форматирование

```bash
# Проверка ESLint
npm run lint

# Проверка ESLint с автоисправлением
npm run lint:fix

# Форматирование Prettier
npm run format

# Проверка форматирования без изменения файлов (как в CI)
npm run format:check
```

- Конфигурация: `eslint.config.js` (flat config) и `.prettierrc.json` в корне репозитория
- Правила для клиента (React + `react-hooks`) и сервера/shared (Node globals) заданы отдельно в `eslint.config.js`
- Оба шага (`lint`, `format:check`) — обязательные проверки CI (`.github/workflows/lint.yml`) на каждый push/PR

### Markdown

- `.md`-файлы (README, CHANGELOG, docs/) проверяются `markdownlint-cli2` в CI (`.github/workflows/docs-lint.yml`)
- Конфигурация — `.markdownlint.jsonc`: `MD013` (лимит длины строки) и `MD024` (дублирующиеся заголовки) отключены осознанно — документация проекта написана длинными строками-абзацами, а `CHANGELOG.md` намеренно повторяет заголовки `### Added`/`### Fixed`/`### Removed` в каждом рабочем блоке (формат Keep a Changelog)
- Остальные правила (пустые строки вокруг заголовков/списков, язык у code-блоков и т.п.) — действующие, при добавлении .md-файлов проверяйте их локально: `npx markdownlint-cli2 "**/*.md" "!node_modules/**/*.md"`

---

## Отправка Pull Request

1. Убедитесь, что ветка актуальна относительно `main`
2. Заполните описание PR: что изменено и почему
3. Укажите связанные issues (`Closes #N`)
4. Все проверки (типы, тесты, линтер, форматирование) должны быть зелёными
5. Коммиты должны следовать соглашению Conventional Commits

---

## Сообщение об ошибках

При создании issue укажите:

- **Версию** Node.js и ОС
- **Шаги** для воспроизведения ошибки
- **Ожидаемое** и **фактическое** поведение
- При необходимости — логи из консоли или скриншот

---

> ⚠️ **Примечание:** LMU не предоставляет публичный API для Daily Races.  
> Данные о текущей ротации добавляются статически в `DAILY_RACES_STATIC`.  
> Проверяйте актуальную ротацию на [lemansultimate.com](https://www.lemansultimate.com).
