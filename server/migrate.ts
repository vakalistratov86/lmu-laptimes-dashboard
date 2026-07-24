import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, "..", "migrations");
// Совпадает с дефолтами drizzle-orm (server/pg-core/dialect.ts) — не менять
// без синхронной правки baselineExistingDatabase() ниже.
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

/**
 * Runs DB migrations on startup.
 * Применяет SQL-файлы из migrations/ (сгенерированы `drizzle-kit generate` из
 * shared/schema.ts) через drizzle-orm migrator — учёт применённых миграций
 * ведётся в служебной таблице drizzle.__drizzle_migrations, поэтому повторный
 * запуск на каждом старте сервера безопасен и идемпотентен.
 */
export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Отдельное соединение для миграций (max 1, без idle timeout)
  const migrationClient = postgres(url, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    console.log("[migrate] Running database migrations...");
    await baselineExistingDatabase(migrationClient);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[migrate] All migrations applied.");
  } finally {
    await migrationClient.end();
  }
}

/**
 * До перехода на drizzle-kit-миграции таблицы создавались вручную (CREATE
 * TABLE IF NOT EXISTS в этом же файле). У уже развёрнутых баз данных все
 * таблицы приложения уже существуют, но служебной таблицы
 * drizzle.__drizzle_migrations ещё нет — если просто запустить migrate(),
 * он попытается выполнить CREATE TABLE из начальной миграции и упадёт с
 * "relation already exists".
 *
 * Здесь такой случай определяется один раз: если таблицы приложения (напр.
 * tracks) уже есть, а таблицы учёта миграций ещё нет — начальная миграция
 * помечается как уже применённая (создаём ту же служебную таблицу, что и
 * drizzle, и вставляем в неё запись с хэшем и timestamp начальной миграции)
 * вместо повторного выполнения её SQL. Дальше migrate() увидит эту запись и
 * само ничего не сделает — таблицы уже соответствуют схеме от старого
 * ручного CREATE TABLE, который вручную поддерживался в синхроне с
 * shared/schema.ts.
 *
 * На полностью новой БД (нет ни tracks, ни __drizzle_migrations) — функция
 * ничего не делает, migrate() создаёт все таблицы штатно из миграции.
 */
async function baselineExistingDatabase(sql: postgres.Sql): Promise<void> {
  const [migrationsTableRow] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = ${MIGRATIONS_SCHEMA} AND table_name = ${MIGRATIONS_TABLE}
    ) AS "exists"
  `;
  if (migrationsTableRow.exists) return;

  const [appTablesRow] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tracks'
    ) AS "exists"
  `;
  if (!appTablesRow.exists) return;

  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: { tag: string; when: number }[];
  };
  const initialEntry = journal.entries[0];
  if (!initialEntry) return;

  const migrationSql = readFileSync(path.join(MIGRATIONS_FOLDER, `${initialEntry.tag}.sql`), "utf-8");
  const hash = createHash("sha256").update(migrationSql).digest("hex");

  console.log("[migrate] Existing pre-drizzle-kit database detected — baselining without re-running CREATE TABLE");
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${MIGRATIONS_SCHEMA}`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  await sql.unsafe(`INSERT INTO ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE} (hash, created_at) VALUES ($1, $2)`, [
    hash,
    initialEntry.when,
  ]);
}
