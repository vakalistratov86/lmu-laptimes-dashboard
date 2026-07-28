---
paths: "server/**/*.ts", "script/**/*.ts"
---

# Правила БД

- Изменение схемы (sessions, laps, driver_metrics) — только через миграцию, без ручных ALTER
- Внешние ключи между sessions -> laps -> driver_metrics обязательны
- Запросы из нескольких таблиц — только через repository-функции
- Индексы обязательны на session_id, lap_number
