# Структура базы данных LMU Laptimes Dashboard

## Обзор

Проект использует **SQLite** в качестве СУБД и **Drizzle ORM** для декларативного описания схемы и выполнения запросов. Файл схемы расположен в `shared/schema.ts` — он является единым источником истины как для сервера, так и для клиента.

База данных содержит **15 таблиц**, объединённых в логические группы:

| Группа | Таблицы | Назначение |
|--------|---------|------------|
| Справочники | `tracks`, `drivers` | Статические данные о трассах и пилотах |
| Сессии | `sessions`, `session_results`, `session_laps`, `session_incidents`, `session_sector_bests`, `session_track_limits` | Данные, импортированные из XML-логов игры rFactor2 / LMU |
| Ручные замеры | `lap_times` | «Плоские» времена кругов, импортированные из XML-логов |
| Импорт XML | `import_jobs`, `import_errors` | Журнал импортированных файлов и DLQ невалидных записей |
| Телеметрия | `telemetry_import_jobs`, `telemetry_sessions`, `telemetry_channels`, `telemetry_samples` | Данные, импортированные из `.duckdb`-файлов записи телеметрии LMU |

> ⚠️ Начиная с версии 0.1.0 проект использует **PostgreSQL**, а не SQLite — вводный абзац и раздел «Технологический стек БД» ниже описывают исходную SQLite-редакцию и требуют актуализации отдельно от этого изменения; типы колонок в таблицах ниже соответствуют исходной схеме и не всегда совпадают с реальными типами Postgres в `shared/schema.ts`.

---

## Таблицы-справочники

### `tracks` — Трассы

Справочник трасс игры Le Mans Ultimate (LMU).

| Колонка | Тип | Ограничение | Описание |
|---------|-----|-------------|----------|
| `id` | INTEGER | PK, autoincrement | Первичный ключ |
| `name` | TEXT | NOT NULL | Название трассы |
| `country` | TEXT | NOT NULL | Страна проведения |
| `length_km` | REAL | NOT NULL | Длина трассы в километрах |
| `turns` | INTEGER | NOT NULL | Количество поворотов |
| `layout` | TEXT | NOT NULL | Конфигурация: `"Full"`, `"GP"`, `"National"` и т.д. |

---

### `drivers` — Пилоты

Справочник пилотов (реальных игроков и ИИ-соперников).

| Колонка | Тип | Ограничение | Описание |
|---------|-----|-------------|----------|
| `id` | INTEGER | PK, autoincrement | Первичный ключ |
| `name` | TEXT | NOT NULL | Имя пилота |
| `team` | TEXT | NOT NULL | Название команды |
| `country` | TEXT | NOT NULL | Страна пилота |

---

## Ручные замеры

### `lap_times` — Времена кругов

Основная таблица для хранения замеров времени кругов, импортированных из XML-лога. Используется на Overview/Leaderboards/Tracks независимо от таблиц сессий ниже.

| Колонка | Тип | Ограничение | Описание |
|---------|-----|-------------|----------|
| `id` | INTEGER | PK, autoincrement | Первичный ключ |
| `track_id` | INTEGER | NOT NULL, FK → `tracks.id` | Трасса |
| `driver_id` | INTEGER | NOT NULL, FK → `drivers.id` | Пилот |
| `car_class` | TEXT | NOT NULL | Класс машины: `Hypercar`, `LMP2`, `GTE`, `GT3` |
| `car` | TEXT | NOT NULL | Название автомобиля |
| `lap_ms` | INTEGER | NOT NULL | Время круга в миллисекундах |
| `sector1_ms` | INTEGER | NOT NULL | Время сектора 1, мс |
| `sector2_ms` | INTEGER | NOT NULL | Время сектора 2, мс |
| `sector3_ms` | INTEGER | NOT NULL | Время сектора 3, мс |
| `conditions` | TEXT | NOT NULL | Условия: `"Сухо"`, `"Дождь"`, `"Смешанно"` |
| `tyre` | TEXT | NOT NULL | Тип шин: `Soft`, `Medium`, `Hard`, `Wet` |
| `date` | TEXT | NOT NULL | Дата заезда (ISO 8601) |
| `session_id` | INTEGER | nullable, FK → `sessions.id` | Ссылка на сессию, из импорта которой получен круг |

---

## Таблицы сессий

Сессии импортируются из XML-файлов логов игры (rFactor2 / LMU). Одна сессия описывает конкретный заезд (практика, квалификация, гонка).

### `sessions` — Сессии

Мета-информация об игровой сессии. Полностью соответствует структуре XML-лога.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `track_id` | INTEGER NOT NULL | FK → `tracks.id` |
| `event` | TEXT NOT NULL | Название события (`TrackEvent`), напр. `"Rolex 6 Hours Of Sao Paulo"` |
| `session_type` | TEXT NOT NULL | Тип: `Practice`, `Qualify`, `Race`, `Practice1` и т.д. |
| `venue` | TEXT NOT NULL | `TrackVenue` |
| `course` | TEXT | `TrackCourse` (может отличаться от `venue`) |
| `track_length_m` | REAL | Длина трассы в метрах (`TrackLength`) |
| `game_version` | TEXT | Версия игры |
| `date_time` | TEXT NOT NULL | ISO дата/время сессии |
| `date_time_unix` | INTEGER | Unix timestamp из XML (`DateTime`) |
| `file_name` | TEXT NOT NULL | Имя загруженного XML-файла |
| `setting` | TEXT | `Setting`, напр. `"Race Weekend"` |
| `driver_count` | INTEGER NOT NULL | Количество пилотов в сессии |
| `lap_count` | INTEGER NOT NULL | Суммарное количество засчитанных кругов |
| `race_laps` | INTEGER | `RaceLaps` (0 = без ограничения по кругам) |
| `race_time_min` | INTEGER | `RaceTime` в минутах |
| `mech_fail_rate` | INTEGER | `MechFailRate` |
| `damage_mult` | INTEGER | `DamageMult` (75 = 75%) |
| `fuel_mult` | REAL | `FuelMult` |
| `tire_mult` | REAL | `TireMult` |
| `vehicles_allowed` | TEXT | `VehiclesAllowed` — список разрешённых классов/моделей |
| `parc_ferme` | INTEGER | `ParcFerme` (1/0) |
| `fixed_setups` | INTEGER | `FixedSetups` (1/0) |
| `free_settings` | INTEGER | `FreeSettings` |
| `fixed_upgrades` | INTEGER | `FixedUpgrades` (1/0) |
| `tire_warmers` | INTEGER | `TireWarmers` (1/0) |
| `dedicated` | INTEGER | Флаг выделенного сервера |
| `session_duration_min` | INTEGER | Длительность в минутах (для практики/квалификации) |
| `session_max_laps` | INTEGER | Лимит кругов для практики |
| `most_laps_completed` | INTEGER | `MostLapsCompleted` |

---

### `session_results` — Итоги пилотов в сессии

Результат каждого пилота в рамках конкретной сессии.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `session_id` | INTEGER NOT NULL | FK → `sessions.id` |
| `driver_id` | INTEGER NOT NULL | FK → `drivers.id` |
| `is_player` | INTEGER NOT NULL, default 0 | `1` = живой игрок, `0` = ИИ |
| `position` | INTEGER NOT NULL | Итоговая позиция (абсолютная) |
| `class_position` | INTEGER NOT NULL | Итоговая позиция в классе |
| `lap_rank_including_discos` | INTEGER | `LapRankIncludingDiscos` |
| `car_class` | TEXT NOT NULL | Класс машины |
| `car` | TEXT NOT NULL | Название автомобиля |
| `car_type` | TEXT | `CarType` — полное название модели |
| `team` | TEXT NOT NULL | Команда |
| `car_number` | TEXT | Номер машины |
| `veh_file` | TEXT | Имя `.VEH`-файла |
| `veh_name` | TEXT | Отображаемое имя машины |
| `category` | TEXT | Категория, напр. `"WEC 2026, GT3, Porsche 911 GT3 R LMGT3"` |
| `laps` | INTEGER NOT NULL | Количество пройденных кругов |
| `pitstops` | INTEGER NOT NULL | Количество пит-стопов |
| `best_lap_ms` | INTEGER | Лучший круг в миллисекундах |
| `finish_status` | TEXT | `FinishStatus` |
| `control_and_aids` | TEXT | Строка управления, напр. `"PlayerControl,TC=2,Clutch,AutoBlip"` |
| `connected` | INTEGER | Флаг подключения (1/0) |

---

### `session_laps` — Данные по каждому кругу

Детализированная телеметрия по каждому кругу каждого пилота в сессии.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `session_result_id` | INTEGER NOT NULL | FK → `session_results.id` |
| `session_id` | INTEGER NOT NULL | FK → `sessions.id` (денормализация для удобства запросов) |
| `driver_id` | INTEGER NOT NULL | FK → `drivers.id` (денормализация) |
| `lap_num` | INTEGER NOT NULL | Номер круга |
| `position` | INTEGER | Позиция на момент круга |
| `lap_time_ms` | REAL | Время круга, мс (null если круг не засчитан — `"--.----"`) |
| `elapsed_time_sec` | REAL | Суммарное время от старта, сек (`et=`) |
| `sector1_ms` | REAL | Время сектора 1, мс |
| `sector2_ms` | REAL | Время сектора 2, мс |
| `sector3_ms` | REAL | Время сектора 3, мс |
| `top_speed_kph` | REAL | Максимальная скорость на круге, км/ч |
| `fuel_level` | REAL | Уровень топлива (0..1, доля бака) |
| `fuel_used` | REAL | Расход топлива за круг (отрицательное = пит-стоп с дозаправкой) |
| `vehicle_condition` | REAL | Состояние машины (0..1) |
| `vehicle_condition_used` | REAL | Износ машины за круг |
| `tyre_fl_condition` | REAL | Состояние шины FL |
| `tyre_fr_condition` | REAL | Состояние шины FR |
| `tyre_rl_condition` | REAL | Состояние шины RL |
| `tyre_rr_condition` | REAL | Состояние шины RR |
| `front_compound` | TEXT | Передний состав шин, напр. `"0,Medium"` |
| `rear_compound` | TEXT | Задний состав шин |
| `tyre_fl` | TEXT | Тип шины FL |
| `tyre_fr` | TEXT | Тип шины FR |
| `tyre_rl` | TEXT | Тип шины RL |
| `tyre_rr` | TEXT | Тип шины RR |
| `is_pit_lap` | INTEGER NOT NULL, default 0 | `1` если круг содержит пит-стоп |

---

### `session_incidents` — Инциденты

Контактные инциденты между пилотами, зафиксированные в `Stream`-секции XML-лога.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `session_id` | INTEGER NOT NULL | FK → `sessions.id` |
| `driver_id` | INTEGER NOT NULL | Виновник инцидента, FK → `drivers.id` |
| `target_driver_id` | INTEGER | Пострадавший пилот (null = контакт с неподвижным объектом) |
| `elapsed_time_sec` | REAL NOT NULL | Время инцидента от старта, сек |
| `severity` | REAL NOT NULL | Сила удара |
| `is_immovable` | INTEGER NOT NULL, default 0 | `1` = контакт с неподвижным объектом (`Immovable`) |

---

### `session_sector_bests` — Рекорды по секторам

Лучшие времена по каждому из трёх секторов в сессии (из `Stream → Sector`).

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `session_id` | INTEGER NOT NULL | FK → `sessions.id` |
| `driver_id` | INTEGER NOT NULL | FK → `drivers.id` |
| `car_class` | TEXT NOT NULL | Класс машины |
| `sector` | INTEGER NOT NULL | Номер сектора: `1`, `2` или `3` |
| `elapsed_time_sec` | REAL NOT NULL | Время от старта на момент установки рекорда |
| `lap_num` | INTEGER | Номер круга, на котором установлен рекорд |

---

### `session_track_limits` — Нарушения трассы

Фиксация событий нарушения границ трассы (Track Limits).

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `session_id` | INTEGER NOT NULL | FK → `sessions.id` |
| `driver_id` | INTEGER NOT NULL | FK → `drivers.id` |
| `lap_num` | INTEGER NOT NULL | Номер круга |
| `elapsed_time_sec` | REAL NOT NULL | Время от старта, сек |
| `warning_points` | INTEGER | `WarningPoints` — добавленные штрафные очки |
| `current_points` | INTEGER | `CurrentPoints` — текущее накопленное количество очков |
| `resolution` | INTEGER | `Resolution` |
| `decision` | TEXT | Решение, напр. `"No Further Action"` |

---

## Таблицы импорта XML-логов

### `import_jobs` — Журнал импорта

Одна запись на загруженный XML-файл. `file_hash` — SHA-256 сырого содержимого, обеспечивает идемпотентность повторной загрузки того же файла.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | TEXT PK | nanoid |
| `file_hash` | TEXT NOT NULL, UNIQUE | SHA-256 содержимого файла |
| `file_name` | TEXT NOT NULL | Имя файла |
| `status` | TEXT NOT NULL | `queued` \| `processing` \| `completed` \| `failed` |
| `session_id` | INTEGER | Заполняется после успешного импорта, FK → `sessions.id` |
| `total_laps` / `valid_laps` / `error_laps` | INTEGER | Счётчики кругов: всего / прошли валидацию / в DLQ |
| `error` | TEXT | Сообщение об ошибке при `failed` |
| `log_format_version` | TEXT | Версия формата лога (`1.0` \| `1.1` \| `2.0`) |
| `created_at` / `finished_at` | BIGINT | Unix ms |

### `import_errors` — DLQ невалидных записей

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `import_job_id` | TEXT NOT NULL | Ссылка на `import_jobs.id` |
| `raw_payload` | TEXT NOT NULL | Исходная запись (JSON) |
| `error_code` | TEXT NOT NULL | `VALIDATION_ERROR` \| `PARSE_ERROR` \| `SEMANTIC_ERROR` |
| `error_message` | TEXT NOT NULL | Текст ошибки |
| `occurred_at` | BIGINT NOT NULL | Unix ms |

---

## Таблицы телеметрии

Импортируются из бинарных `.duckdb`-файлов записи телеметрии Le Mans Ultimate (см. `server/telemetryParser.ts`). Каналы/события читаются из файла потоково и пишутся батчами — `telemetry_samples` может содержать миллионы строк на одну запись, поэтому запросы к ней (`server/telemetryQuery.ts`) всегда ограничены по времени (`ts`) или сводятся к SQL-агрегатам (`MAX(ts)`), а не читают таблицу целиком.

### `telemetry_import_jobs` — Журнал импорта телеметрии

Аналог `import_jobs` для `.duckdb`-файлов; `file_hash` — идемпотентность по SHA-256 сырых байт.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | TEXT PK | nanoid |
| `file_hash` | TEXT NOT NULL, UNIQUE | SHA-256 содержимого файла |
| `file_name` | TEXT NOT NULL | Имя файла |
| `status` | TEXT NOT NULL | `processing` \| `completed` \| `failed` |
| `telemetry_session_id` | INTEGER | FK → `telemetry_sessions.id`, заполняется после успеха |
| `channel_count` / `sample_count` | INTEGER | Число каналов / сэмплов, записанных импортом |
| `error` | TEXT | Сообщение об ошибке при `failed` |
| `created_at` / `finished_at` | BIGINT | Unix ms |

### `telemetry_sessions` — Метаданные записи

Одна строка на импортированный `.duckdb`-файл — данные из его таблицы `metadata` (пилот, трасса, сетап и т.д.).

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `import_job_id` | TEXT NOT NULL | Ссылка на `telemetry_import_jobs.id` |
| `file_name` | TEXT NOT NULL | Имя файла |
| `driver_name` / `steam_id` | TEXT | Пилот |
| `recording_time` / `session_time` | TEXT | Момент записи / игровое время сессии |
| `session_type` | TEXT | Тип сессии |
| `track_name` / `track_layout` | TEXT | Трасса и конфигурация |
| `weather_conditions` | TEXT | Погода |
| `car_name` / `car_class` | TEXT | Машина и класс |
| `car_setup` | TEXT | Сырой JSON сетапа автомобиля |
| `created_at` | BIGINT NOT NULL | Unix ms |

### `telemetry_channels` — Реестр каналов/событий

Одна строка на каждый канал (`channel`, непрерывный, напр. GPS/скорость) или событие (`event`, напр. `Lap`), найденные в файле.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `telemetry_session_id` | INTEGER NOT NULL | FK → `telemetry_sessions.id` |
| `name` | TEXT NOT NULL | Имя канала/события |
| `kind` | TEXT NOT NULL | `channel` \| `event` |
| `frequency_hz` | INTEGER | Частота записи, только для `channel` |
| `unit` | TEXT | Единица измерения |
| `sample_count` | INTEGER NOT NULL | Число сэмплов (посчитано на импорте через `COUNT(*)`, без чтения строк) |

### `telemetry_samples` — Сэмплы

EAV-таблица: одна строка на сэмпл любого канала/события (вместо отдельной Postgres-таблицы на каждый канал, как в исходном `.duckdb`). Самая крупная таблица в БД.

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | INTEGER PK | Первичный ключ |
| `channel_id` | INTEGER NOT NULL, индекс | FK → `telemetry_channels.id` |
| `seq` | INTEGER NOT NULL | Порядковый номер строки в исходном файле |
| `ts` | REAL | Для `event` — реальное время (сек) из файла; для `channel` — `NULL` (потребитель восстанавливает как `recordingBaseTs + seq / frequencyHz`) |
| `value1..value4` | REAL | Значения сэмпла (1 для одноканальных, до 4 для составных, напр. GPS lat/lon) |

---

## Связи между таблицами

```
tracks ──────────────────────────────────────────────────────────┐
  │ 1                                                             │
  │ N                                                             │
lap_times ←── drivers                                            │
                                                                  │
sessions ←──────────────────────────────────────────────────────┘
  │ 1                 (track_id)
  │ N
  ├─→ session_results
  │       │ 1
  │       │ N
  │       └─→ session_laps  (session_result_id, + денорм. session_id, driver_id)
  │
  ├─→ session_incidents       (session_id, driver_id, target_driver_id)
  ├─→ session_sector_bests    (session_id, driver_id)
  └─→ session_track_limits    (session_id, driver_id)
```

> **Примечание о денормализации:** таблица `session_laps` хранит `session_id` и `driver_id` дублирующими колонками (помимо `session_result_id`) для упрощения аналитических запросов без лишних JOIN.

---

## Обогащённые типы (API-слой)

Файл `shared/schema.ts` помимо таблиц экспортирует составные TypeScript-типы, используемые в API-ответах:

| Тип | Базируется на | Добавляет |
|-----|--------------|----------|
| `DriverEnriched` | `Driver` | `isPlayer: number \| null` — флаг живого игрока |
| `LapTimeEnriched` | `LapTime` | `trackName`, `driverName`, `team`, `isPlayer`, `sessionCourse` |
| `SessionEnriched` | `Session` | `trackName`, `results: (SessionResult & { driverName })[]` |
| `SessionFull` | `SessionEnriched` | `laps`, `incidents`, `sectorBests`, `trackLimits` |

---

## Технологический стек БД

| Компонент | Технология |
|-----------|------------|
| СУБД | SQLite |
| ORM | Drizzle ORM |
| Валидация схемы | drizzle-zod + Zod |
| Конфигурация | `drizzle.config.ts` |
| Расположение схемы | `shared/schema.ts` |
