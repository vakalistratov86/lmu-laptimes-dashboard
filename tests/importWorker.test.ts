/**
 * Тесты для runImport() — ветка ZERO_LAPS (#122 follow-up).
 *
 * Раньше файл, в котором парсер не нашёл ни одного <Driver> (parseRaceResults
 * вернул null), считался "ошибкой" ("Не похоже на лог результатов LMU/rFactor"),
 * а не пропуском — хотя семантически это тот же случай "нечего импортировать",
 * что и файл с участниками, но без единого круга. Оба случая должны throw'ить
 * ошибку с code === 'ZERO_LAPS' ДО открытия транзакции БД.
 */
import { describe, it, expect, vi } from "vitest";

const { db } = vi.hoisted(() => {
  const db = {
    transaction: vi.fn(async () => {
      throw new Error("db.transaction() должна не вызываться для файла без участников/кругов");
    }),
  };
  return { db };
});
vi.mock("../server/storage", () => ({ db }));

const { parseRaceResults } = vi.hoisted(() => ({ parseRaceResults: vi.fn() }));
vi.mock("../server/logParser", () => ({ parseRaceResults }));

import { runImport } from "../server/importWorker";

describe("runImport — файлы без данных для импорта (ZERO_LAPS)", () => {
  it("бросает ZERO_LAPS, если parseRaceResults вернул null (0 участников в сессии)", async () => {
    parseRaceResults.mockReturnValueOnce(null);

    await expect(
      runImport({ id: "job-1", fileHash: "hash-1", fileName: "no-drivers.xml", content: "<x/>" })
    ).rejects.toMatchObject({ code: "ZERO_LAPS" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("бросает ZERO_LAPS, если участники есть, но ни у одного нет кругов", async () => {
    parseRaceResults.mockReturnValueOnce({
      drivers: [
        { name: "Driver A", lapList: [] },
        { name: "Driver B", lapList: [] },
      ],
    } as any);

    await expect(
      runImport({ id: "job-2", fileHash: "hash-2", fileName: "zero-laps.xml", content: "<x/>" })
    ).rejects.toMatchObject({ code: "ZERO_LAPS" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("сообщения для двух ZERO_LAPS-сценариев различаются (для читаемого журнала)", async () => {
    parseRaceResults.mockReturnValueOnce(null);
    let noDriversMessage = "";
    try {
      await runImport({ id: "job-3", fileHash: "hash-3", fileName: "a.xml", content: "<x/>" });
    } catch (e) {
      noDriversMessage = (e as Error).message;
    }

    parseRaceResults.mockReturnValueOnce({ drivers: [{ name: "Driver A", lapList: [] }] } as any);
    let zeroLapsMessage = "";
    try {
      await runImport({ id: "job-4", fileHash: "hash-4", fileName: "b.xml", content: "<x/>" });
    } catch (e) {
      zeroLapsMessage = (e as Error).message;
    }

    expect(noDriversMessage).not.toBe(zeroLapsMessage);
    expect(noDriversMessage).toContain("участни");
    expect(zeroLapsMessage).toContain("0 кругов");
  });
});
