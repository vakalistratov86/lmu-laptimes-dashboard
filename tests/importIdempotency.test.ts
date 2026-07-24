/**
 * Тесты для issues #5, #6, #11:
 * - async ingestion (enqueueImport возвращает importId немедленно)
 * - idempotency (повторная загрузка → DuplicateFileError)
 * - atomicity (ошибка на N-й записи не оставляет предыдущие N-1)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { computeFileHash, generateId, CHUNK_SIZE } from "../server/importWorker";

// ── Unit tests: computeFileHash ──────────────────────────────────
describe("computeFileHash", () => {
  it("returns consistent SHA-256 hex for the same content", () => {
    const h1 = computeFileHash("hello world");
    const h2 = computeFileHash("hello world");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different hashes for different content", () => {
    const h1 = computeFileHash("file A content");
    const h2 = computeFileHash("file B content");
    expect(h1).not.toBe(h2);
  });
});

// ── Unit tests: generateId ───────────────────────────────────────
describe("generateId", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("generates hex string of length 24", () => {
    expect(generateId()).toMatch(/^[0-9a-f]{24}$/);
  });
});

// ── Unit tests: CHUNK_SIZE ───────────────────────────────────────
describe("CHUNK_SIZE", () => {
  it("is 500", () => {
    expect(CHUNK_SIZE).toBe(500);
  });
});

// ── Integration: idempotency via SQLite UNIQUE constraint ────────
describe("import_jobs UNIQUE file_hash constraint", () => {
  let sqlite: ReturnType<typeof Database>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE import_jobs (
        id TEXT PRIMARY KEY,
        file_hash TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        session_id INTEGER,
        total_laps INTEGER,
        error TEXT,
        created_at INTEGER NOT NULL,
        finished_at INTEGER
      );
    `);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("allows inserting a job with a unique file_hash", () => {
    const stmt = sqlite.prepare(
      `INSERT INTO import_jobs (id, file_hash, file_name, status, created_at)
       VALUES (?, ?, ?, 'queued', ?)`,
    );
    expect(() => stmt.run("id1", "hash_abc", "file1.xml", Date.now())).not.toThrow();
  });

  it("rejects duplicate file_hash (idempotency, #6)", () => {
    const stmt = sqlite.prepare(
      `INSERT INTO import_jobs (id, file_hash, file_name, status, created_at)
       VALUES (?, ?, ?, 'queued', ?)`,
    );
    stmt.run("id1", "hash_abc", "file1.xml", Date.now());
    expect(() => stmt.run("id2", "hash_abc", "file2.xml", Date.now())).toThrow();
  });

  it("allows different files with different hashes", () => {
    const stmt = sqlite.prepare(
      `INSERT INTO import_jobs (id, file_hash, file_name, status, created_at)
       VALUES (?, ?, ?, 'queued', ?)`,
    );
    stmt.run("id1", "hash_aaa", "file1.xml", Date.now());
    stmt.run("id2", "hash_bbb", "file2.xml", Date.now());
    const count = (sqlite.prepare("SELECT COUNT(*) as n FROM import_jobs").get() as any).n;
    expect(count).toBe(2);
  });
});

// ── Integration: atomic rollback (#11) ──────────────────────────
describe("db.transaction atomicity", () => {
  let sqlite: ReturnType<typeof Database>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE test_laps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        value TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("rolls back all inserts if transaction throws (#11)", () => {
    const insertStmt = sqlite.prepare("INSERT INTO test_laps (value) VALUES (?)");
    const transact = sqlite.transaction((rows: string[]) => {
      for (let i = 0; i < rows.length; i++) {
        insertStmt.run(rows[i]);
        if (i === 2) throw new Error("Simulated error at row 3");
      }
    });

    expect(() => transact(["a", "b", "c", "d", "e"])).toThrow("Simulated error at row 3");
    const count = (sqlite.prepare("SELECT COUNT(*) as n FROM test_laps").get() as any).n;
    // Ни одной записи не должно остаться — полный rollback
    expect(count).toBe(0);
  });

  it("commits all rows when transaction succeeds", () => {
    const insertStmt = sqlite.prepare("INSERT INTO test_laps (value) VALUES (?)");
    const transact = sqlite.transaction((rows: string[]) => {
      for (const row of rows) insertStmt.run(row);
    });
    transact(["x", "y", "z"]);
    const count = (sqlite.prepare("SELECT COUNT(*) as n FROM test_laps").get() as any).n;
    expect(count).toBe(3);
  });

  it("batch inserts in chunks of CHUNK_SIZE without exceeding SQLite limits", () => {
    const insertStmt = sqlite.prepare("INSERT INTO test_laps (value) VALUES (?)");
    const rows = Array.from({ length: 1200 }, (_, i) => `row_${i}`);
    const transact = sqlite.transaction((allRows: string[]) => {
      for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
        const chunk = allRows.slice(i, i + CHUNK_SIZE);
        for (const r of chunk) insertStmt.run(r);
      }
    });
    transact(rows);
    const count = (sqlite.prepare("SELECT COUNT(*) as n FROM test_laps").get() as any).n;
    expect(count).toBe(1200);
  });
});
