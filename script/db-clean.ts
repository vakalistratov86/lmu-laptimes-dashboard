/**
 * db-clean.ts — Скрипт очистки БД проекта LMU Lap Times Dashboard
 *
 * Режимы запуска:
 *   npx tsx script/db-clean.ts           — интерактивный выбор через меню
 *   npx tsx script/db-clean.ts --all     — удалить ВСЕ данные (с подтверждением)
 *   npx tsx script/db-clean.ts --demo    — удалить только demo-данные (source=demo)
 *   npx tsx script/db-clean.ts --sessions — удалить только импортированные сессии и связанные данные
 *   npx tsx script/db-clean.ts --yes     — пропустить подтверждение (использовать с осторожностью!)
 */

import Database from "better-sqlite3";
import path from "path";
import readline from "readline";

// ───── Путь к БД (берём из переменной окружения или по умолчанию) ─────
const DB_PATH = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace("file:", "")
  : path.resolve(process.cwd(), "data", "lmu.db");

// ───── Парсинг аргументов ─────
const args = process.argv.slice(2);
const MODE_ALL = args.includes("--all");
const MODE_DEMO = args.includes("--demo");
const MODE_SESSIONS = args.includes("--sessions");
const SKIP_CONFIRM = args.includes("--yes");

// ───── Утилиты ─────
function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function printTable(label: string, count: number) {
  const status = count > 0 ? `✓ удалено ${count} строк` : "— пусто";
  console.log(`  ${label.padEnd(30)} ${status}`);
}

// ───── Операции очистки ─────

/** Удаляет ВСЕ данные из всех таблиц, сбрасывает autoincrement. */
function cleanAll(db: Database.Database) {
  console.log("\n🗑️  Полная очистка всех таблиц...\n");

  // Порядок важен: сначала зависимые таблицы
  const tables = [
    "session_laps",
    "session_incidents",
    "session_sector_bests",
    "session_track_limits",
    "session_results",
    "lap_times",
    "sessions",
    "drivers",
    "tracks",
  ];

  for (const table of tables) {
    const result = db.prepare(`DELETE FROM ${table}`).run();
    db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
    printTable(table, result.changes);
  }
}

/** Удаляет только demo-данные (lap_times.source = 'demo' и связанных пилотов/трассы без сессий). */
function cleanDemo(db: Database.Database) {
  console.log("\n🧹 Удаление demo-данных...\n");

  // Удалить demo круги
  const laps = db.prepare(`DELETE FROM lap_times WHERE source = 'demo'`).run();
  printTable("lap_times (demo)", laps.changes);

  // Пилоты, которые не используются ни в lap_times, ни в session_results
  const drivers = db.prepare(`
    DELETE FROM drivers
    WHERE id NOT IN (SELECT DISTINCT driver_id FROM lap_times)
      AND id NOT IN (SELECT DISTINCT driver_id FROM session_results)
  `).run();
  printTable("drivers (осиротевшие)", drivers.changes);

  // Трассы без привязанных данных
  const tracks = db.prepare(`
    DELETE FROM tracks
    WHERE id NOT IN (SELECT DISTINCT track_id FROM lap_times)
      AND id NOT IN (SELECT DISTINCT track_id FROM sessions)
  `).run();
  printTable("tracks (осиротевшие)", tracks.changes);
}

/** Удаляет все импортированные сессии и каскадно все связанные данные. */
function cleanSessions(db: Database.Database) {
  console.log("\n📂 Удаление импортированных сессий и связанных данных...\n");

  // Получаем ID всех сессий
  const sessionIds = db
    .prepare(`SELECT id FROM sessions`)
    .all()
    .map((r: any) => r.id);

  if (sessionIds.length === 0) {
    console.log("  Нет сессий для удаления.");
    return;
  }

  const placeholders = sessionIds.map(() => "?").join(",");

  const laps = db
    .prepare(`DELETE FROM session_laps WHERE session_id IN (${placeholders})`)
    .run(...sessionIds);
  printTable("session_laps", laps.changes);

  const incidents = db
    .prepare(`DELETE FROM session_incidents WHERE session_id IN (${placeholders})`)
    .run(...sessionIds);
  printTable("session_incidents", incidents.changes);

  const sectorBests = db
    .prepare(`DELETE FROM session_sector_bests WHERE session_id IN (${placeholders})`)
    .run(...sessionIds);
  printTable("session_sector_bests", sectorBests.changes);

  const trackLimits = db
    .prepare(`DELETE FROM session_track_limits WHERE session_id IN (${placeholders})`)
    .run(...sessionIds);
  printTable("session_track_limits", trackLimits.changes);

  const results = db
    .prepare(`DELETE FROM session_results WHERE session_id IN (${placeholders})`)
    .run(...sessionIds);
  printTable("session_results", results.changes);

  // Удалить lap_times, привязанные к этим сессиям
  const lapTimes = db
    .prepare(`DELETE FROM lap_times WHERE session_id IN (${placeholders})`)
    .run(...sessionIds);
  printTable("lap_times (import)", lapTimes.changes);

  const sessions = db.prepare(`DELETE FROM sessions`).run();
  db.prepare(`DELETE FROM sqlite_sequence WHERE name = 'sessions'`).run();
  printTable("sessions", sessions.changes);

  // Очистка осиротевших пилотов (нет ни в lap_times, ни в session_results)
  const drivers = db.prepare(`
    DELETE FROM drivers
    WHERE id NOT IN (SELECT DISTINCT driver_id FROM lap_times)
      AND id NOT IN (SELECT DISTINCT driver_id FROM session_results)
  `).run();
  printTable("drivers (осиротевшие)", drivers.changes);
}

// ───── Интерактивное меню ─────
async function interactiveMenu(db: Database.Database) {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   LMU Lap Times — Очистка БД         ║");
  console.log("╠══════════════════════════════════════╣");
  console.log("║  1. Удалить ВСЕ данные               ║");
  console.log("║  2. Удалить только demo-данные        ║");
  console.log("║  3. Удалить импортированные сессии    ║");
  console.log("║  q. Выход                            ║");
  console.log("╚══════════════════════════════════════╝");

  const choice = await ask("\nВыберите действие [1/2/3/q]: ");

  switch (choice) {
    case "1":
      return runWithConfirm("⚠️  Будут удалены ВСЕ данные из БД!", () => cleanAll(db));
    case "2":
      return runWithConfirm("Будут удалены все demo-данные.", () => cleanDemo(db));
    case "3":
      return runWithConfirm("Будут удалены все импортированные сессии и связанные данные.", () => cleanSessions(db));
    case "q":
      console.log("Выход.");
      return;
    default:
      console.log("Неверный выбор.");
  }
}

async function runWithConfirm(message: string, action: () => void) {
  console.log(`\n${message}`);
  const confirm = await ask("Продолжить? [y/N]: ");
  if (confirm === "y" || confirm === "yes" || confirm === "д" || confirm === "да") {
    action();
    console.log("\n✅ Готово!\n");
  } else {
    console.log("Отменено.");
  }
}

// ───── Точка входа ─────
async function main() {
  console.log(`\n📦 БД: ${DB_PATH}`);

  const db = new Database(DB_PATH);

  // Включаем поддержку внешних ключей
  db.pragma("foreign_keys = ON");

  if (MODE_ALL) {
    if (!SKIP_CONFIRM) {
      const confirm = await ask("⚠️  Удалить ВСЕ данные? [y/N]: ");
      if (confirm !== "y" && confirm !== "yes") {
        console.log("Отменено.");
        db.close();
        return;
      }
    }
    cleanAll(db);
    console.log("\n✅ Готово!\n");
  } else if (MODE_DEMO) {
    cleanDemo(db);
    console.log("\n✅ Готово!\n");
  } else if (MODE_SESSIONS) {
    cleanSessions(db);
    console.log("\n✅ Готово!\n");
  } else {
    await interactiveMenu(db);
  }

  db.close();
}

main().catch((err) => {
  console.error("❌ Ошибка:", err.message);
  process.exit(1);
});
