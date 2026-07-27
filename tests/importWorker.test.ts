/**
 * Тесты для runImport() — ветка ZERO_LAPS (#122 follow-up).
 *
 * Раньше файл, в котором парсер не нашёл ни одного <Driver> (parseRaceResults
 * вернул null), считался "ошибкой" ("Не похоже на лог результатов LMU/rFactor"),
 * а не пропуском — хотя семантически это тот же случай "нечего импортировать",
 * что и файл с участниками, но без единого круга. Оба случая должны throw'ить
 * ошибку с code === 'ZERO_LAPS' ДО открытия транзакции БД.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { findSupersedeCandidate, deleteSupersededSessionData, decideSupersedeAction, fetchLapTelemetryForSession } =
  vi.hoisted(() => ({
    findSupersedeCandidate: vi.fn(),
    deleteSupersededSessionData: vi.fn(),
    decideSupersedeAction: vi.fn(),
    fetchLapTelemetryForSession: vi.fn(async () => new Map()),
  }));
vi.mock("../server/sessionSupersede", () => ({
  findSupersedeCandidate,
  deleteSupersededSessionData,
  decideSupersedeAction,
  fetchLapTelemetryForSession,
}));

import { runImport } from "../server/importWorker";
import { sessionLaps as sessionLapsTable, sessionResults as sessionResultsTable } from "@shared/schema";

/**
 * tx-мок для командных гонок: в отличие от makeTxWithExistingTrack(), каждый
 * insert() получает СВОЙ уникальный id (а не всегда id:999) — иначе нельзя
 * проверить, что круги разных реальных пилотов одной машины привязаны к
 * РАЗНЫМ driverId. Захватывает вставленные session_results/session_laps.
 */
function makeTeamRaceTx() {
  const existingTrack = {
    id: 42,
    name: "Bahrain",
    country: "Бахрейн",
    lengthKm: 5.4,
    turns: 15,
    layout: "Bahrain International Circuit",
  };
  let nextId = 1000;
  const capturedSessionResults: any[] = [];
  const capturedSessionLaps: any[] = [];

  function chain(rows: any[]): any {
    const p = Promise.resolve(rows);
    return Object.assign(p, { from: vi.fn(() => chain(rows)), where: vi.fn(() => chain(rows)) });
  }

  const tx: any = {
    select: vi.fn(() => chain([existingTrack])),
    insert: vi.fn((table: any) => ({
      values: vi.fn((payload: any) => {
        const rowsIn = Array.isArray(payload) ? payload : [payload];
        const rowsOut = rowsIn.map((p: any) => ({ id: nextId++, ...p }));
        if (table === sessionResultsTable) capturedSessionResults.push(...rowsOut);
        if (table === sessionLapsTable) capturedSessionLaps.push(...rowsOut);
        return { returning: vi.fn(() => Promise.resolve(rowsOut)) };
      }),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(undefined)) })) })),
  };
  return { tx, capturedSessionResults, capturedSessionLaps };
}

/** Минимальный, но структурно валидный ParsedSession для тестов, идущих внутрь транзакции. */
function makeParsedSession() {
  return {
    venue: "Bahrain International Circuit",
    course: "Bahrain International Circuit",
    event: "8 Hours of Bahrain",
    sessionType: "Гонка (Race)",
    trackLengthM: 5386.8,
    gameVersion: "1.3000",
    dateTimeIso: "2026-02-08T18:14:43.000Z",
    dateTimeUnix: 1770563683,
    logFormatVersion: "1.1",
    setting: "Multiplayer",
    raceLaps: 0,
    raceTimeMin: 130,
    mechFailRate: null,
    damageMult: null,
    fuelMult: null,
    tireMult: null,
    vehiclesAllowed: null,
    parcFerme: null,
    fixedSetups: null,
    freeSettings: null,
    fixedUpgrades: null,
    tireWarmers: null,
    dedicated: null,
    sessionDurationMin: 130,
    sessionMaxLaps: null,
    mostLapsCompleted: 71,
    drivers: [
      {
        name: "Driver A",
        lapList: [{ num: 1, lapMs: 100000 }],
        stints: [{ driverName: "Driver A", startLap: 1, endLap: 1, startSec: null, endSec: null }],
      },
      {
        name: "Driver B",
        lapList: [{ num: 1, lapMs: 101000 }],
        stints: [{ driverName: "Driver B", startLap: 1, endLap: 1, startSec: null, endSec: null }],
      },
    ],
    incidents: [],
    sectorBests: [],
    trackLimits: [],
    driverChanges: [],
  } as any;
}

/** tx-мок для findOrCreateTrack: сразу отдаёт точное совпадение по названию/layout, без insert. */
function makeTxWithExistingTrack() {
  function chain(rows: any[]): any {
    const p = Promise.resolve(rows);
    return Object.assign(p, {
      from: vi.fn(() => chain(rows)),
      where: vi.fn(() => chain(rows)),
    });
  }
  const existingTrack = {
    id: 42,
    name: "Bahrain",
    country: "Бахрейн",
    lengthKm: 5.4,
    turns: 15,
    layout: "Bahrain International Circuit",
  };
  return {
    select: vi.fn(() => chain([existingTrack])),
    insert: vi.fn(() => {
      throw new Error("tx.insert не должен вызываться в этом сценарии");
    }),
    delete: vi.fn(() => {
      throw new Error("tx.delete не должен вызываться в этом сценарии");
    }),
  };
}

describe("runImport — файлы без данных для импорта (ZERO_LAPS)", () => {
  it("бросает ZERO_LAPS, если parseRaceResults вернул null (0 участников в сессии)", async () => {
    parseRaceResults.mockReturnValueOnce(null);

    await expect(
      runImport({ id: "job-1", fileHash: "hash-1", fileName: "no-drivers.xml", content: "<x/>" }),
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
      runImport({ id: "job-2", fileHash: "hash-2", fileName: "zero-laps.xml", content: "<x/>" }),
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

describe("runImport — реконнект: замена/пропуск сессии-продолжения (server/sessionSupersede.ts)", () => {
  beforeEach(() => {
    findSupersedeCandidate.mockReset();
    deleteSupersededSessionData.mockReset();
    decideSupersedeAction.mockReset();
    fetchLapTelemetryForSession.mockReset();
    fetchLapTelemetryForSession.mockResolvedValue(new Map());
  });

  it("SUPERSEDED: найден более полный кандидат -> бросает до вставки, tx.insert/delete не вызываются", async () => {
    parseRaceResults.mockReturnValueOnce(makeParsedSession());
    const candidateSession = { id: 7, lapCount: 71 };
    findSupersedeCandidate.mockResolvedValueOnce({ session: candidateSession, overlap: 1 });
    decideSupersedeAction.mockReturnValueOnce("SKIP");

    const tx = makeTxWithExistingTrack();
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    await expect(
      runImport({ id: "job-10", fileHash: "hash-10", fileName: "reconnect-early.xml", content: "<x/>" }),
    ).rejects.toMatchObject({
      code: "SUPERSEDED",
      existingSessionId: 7,
      existingLapCount: 71,
      newLapCount: 2,
    });

    expect(deleteSupersededSessionData).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("REPLACE: найден менее полный кандидат -> удаляет его данные внутри той же транзакции перед вставкой новой сессии", async () => {
    parseRaceResults.mockReturnValueOnce(makeParsedSession());
    const candidateSession = { id: 5, lapCount: 1 };
    findSupersedeCandidate.mockResolvedValueOnce({ session: candidateSession, overlap: 1 });
    decideSupersedeAction.mockReturnValueOnce("REPLACE");

    const tx = makeTxWithExistingTrack();
    // В REPLACE-сценарии tx.insert() вызывается — переопределяем "бросающий" insert
    // из общего хелпера на минимально работоспособный (сессия + пилоты + круги).
    let insertedSession: any = null;
    tx.insert = vi.fn((_table: any) => ({
      values: vi.fn((payload: any) => ({
        returning: vi.fn(() => {
          const row = { id: 999, lapCount: 0, ...(Array.isArray(payload) ? payload[0] : payload) };
          if (insertedSession === null) insertedSession = row;
          return Promise.resolve([row]);
        }),
      })),
    }));
    tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(undefined)) })) }));
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await runImport({
      id: "job-11",
      fileHash: "hash-11",
      fileName: "reconnect-full.xml",
      content: "<x/>",
    });

    expect(deleteSupersededSessionData).toHaveBeenCalledWith(tx, 5);
    expect(result.replacedSessionId).toBe(5);
    expect(result.replacedLapCount).toBe(1);
    expect(result.sessionId).toBe(999);
  });

  it("REPLACE: для перекрывающегося круга берёт живую телеметрию из заменяемого дампа, а не обнулённую из нового", async () => {
    parseRaceResults.mockReturnValueOnce({
      ...makeParsedSession(),
      drivers: [
        {
          name: "Driver A",
          stints: [{ driverName: "Driver A", startLap: 1, endLap: 2, startSec: null, endSec: null }],
          lapList: [
            // Круг 1 — уже был в старом дампе. Реконнект обнулил его телеметрию в новом файле.
            {
              num: 1,
              lapMs: 100000,
              topSpeedKph: 0,
              fuelLevel: 1,
              fuelUsed: 0,
              tyreFLCondition: 0,
              tyreFRCondition: 0,
              tyreRLCondition: 0,
              tyreRRCondition: 0,
            },
            // Круг 2 — проехан только после реконнекта, в старом дампе его нет.
            {
              num: 2,
              lapMs: 105000,
              topSpeedKph: 250,
              fuelLevel: 0.5,
              fuelUsed: 0.03,
              tyreFLCondition: 0.9,
              tyreFRCondition: 0.9,
              tyreRLCondition: 0.9,
              tyreRRCondition: 0.9,
            },
          ],
        },
      ],
    });
    const candidateSession = { id: 5, lapCount: 1 };
    findSupersedeCandidate.mockResolvedValueOnce({ session: candidateSession, overlap: 1 });
    decideSupersedeAction.mockReturnValueOnce("REPLACE");
    fetchLapTelemetryForSession.mockResolvedValueOnce(
      new Map([
        [
          "999:1",
          {
            topSpeedKph: 251.9,
            fuelLevel: 0.82,
            fuelUsed: 0.031,
            tyreFLCondition: 0.976,
            tyreFRCondition: 0.976,
            tyreRLCondition: 0.941,
            tyreRRCondition: 0.929,
          },
        ],
      ]),
    );

    const tx = makeTxWithExistingTrack();
    const capturedSessionLapRows: any[] = [];
    tx.insert = vi.fn((table: any) => ({
      values: vi.fn((payload: any) => {
        if (table === sessionLapsTable) {
          capturedSessionLapRows.push(...(Array.isArray(payload) ? payload : [payload]));
        }
        return {
          returning: vi.fn(() => {
            const row = { id: 999, lapCount: 0, ...(Array.isArray(payload) ? payload[0] : payload) };
            return Promise.resolve([row]);
          }),
        };
      }),
    }));
    tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(undefined)) })) }));
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    await runImport({ id: "job-12", fileHash: "hash-12", fileName: "reconnect-full-2.xml", content: "<x/>" });

    expect(fetchLapTelemetryForSession).toHaveBeenCalledWith(tx, 5);

    const lap1 = capturedSessionLapRows.find((r) => r.lapNum === 1);
    const lap2 = capturedSessionLapRows.find((r) => r.lapNum === 2);

    // Круг 1: телеметрия из старого дампа (достовернее), не обнулённая из нового.
    expect(lap1.topSpeedKph).toBe(251.9);
    expect(lap1.fuelLevel).toBe(0.82);
    expect(lap1.tyreFLCondition).toBe(0.976);
    expect(lap1.tyreRRCondition).toBe(0.929);

    // Круг 2: в старом дампе его не было — берём из нового файла как есть.
    expect(lap2.topSpeedKph).toBe(250);
    expect(lap2.tyreFLCondition).toBe(0.9);
  });
});

describe("runImport — командная гонка: несколько реальных пилотов в одной машине (<Swap>)", () => {
  beforeEach(() => {
    findSupersedeCandidate.mockReset();
    findSupersedeCandidate.mockResolvedValue(null);
  });

  it("создаёт свою строку session_results на каждого реального пилота с пересчитанными laps/bestLapMs/pitstops и верно привязывает круги по driverId", async () => {
    parseRaceResults.mockReturnValueOnce({
      ...makeParsedSession(),
      drivers: [
        {
          name: "Vasiliy Kalistratov", // "зачётный" (последний за рулём) пилот машины
          isPlayer: true,
          position: 5,
          classPosition: 3,
          lapRankIncludingDiscos: null,
          carClass: "GT3",
          carType: "Porsche 911 GT3 R",
          teamName: "Manthey",
          carNumber: "90",
          vehFile: null,
          vehName: null,
          category: null,
          controlAndAids: null,
          connected: 1,
          // Машинные агрегаты из XML — НЕ должны использоваться напрямую:
          // bestLapMs=100000 — на деле лучший круг Юрия, не должен попасть Василию.
          laps: 4,
          pitstops: 1,
          bestLapMs: 100000,
          finishStatus: "Finished",
          stints: [
            { driverName: "Yuriy Khoroshenkiy", startLap: 1, endLap: 2, startSec: null, endSec: 500 },
            { driverName: "Vasiliy Kalistratov", startLap: 3, endLap: 4, startSec: 500, endSec: null },
          ],
          lapList: [
            { num: 1, lapMs: 100000 }, // Юрий — его лучший круг
            { num: 2, lapMs: 110000, isPit: true },
            { num: 3, lapMs: 120000 },
            { num: 4, lapMs: 115000 }, // Василий — его лучший круг
          ],
        },
      ],
    });

    const { tx, capturedSessionResults, capturedSessionLaps } = makeTeamRaceTx();
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await runImport({ id: "job-20", fileHash: "hash-20", fileName: "team-race.xml", content: "<x/>" });

    expect(capturedSessionResults).toHaveLength(2);
    const yuriyRow = capturedSessionResults.find((r) => r.stintStartLap === 1);
    const vasiliyRow = capturedSessionResults.find((r) => r.stintStartLap === 3);
    expect(yuriyRow).toBeDefined();
    expect(vasiliyRow).toBeDefined();

    // Со-пилот тоже реальный человек (участие в <Swap> — само по себе
    // доказательство: ИИ не "сменяют" по имени), несмотря на то что машинный
    // <isPlayer> в XML относится только к "зачётному" (последнему) пилоту.
    expect(yuriyRow).toMatchObject({
      laps: 2,
      pitstops: 1,
      bestLapMs: 100000,
      stintStartLap: 1,
      stintEndLap: 2,
      stintStartSec: null,
      stintEndSec: 500,
      isPlayer: 1,
    });
    expect(vasiliyRow).toMatchObject({
      laps: 2,
      pitstops: 0,
      bestLapMs: 115000,
      stintStartLap: 3,
      stintEndLap: 4,
      stintStartSec: 500,
      stintEndSec: null,
      isPlayer: 1,
    });

    // Круги привязаны к реальному пилоту стинта, а не к одному "зачётному" на всю машину.
    const lap1 = capturedSessionLaps.find((l) => l.lapNum === 1);
    const lap4 = capturedSessionLaps.find((l) => l.lapNum === 4);
    expect(lap1.driverId).toBe(yuriyRow.driverId);
    expect(lap4.driverId).toBe(vasiliyRow.driverId);
    expect(lap1.driverId).not.toBe(lap4.driverId);
    expect(lap1.sessionResultId).toBe(yuriyRow.id);
    expect(lap4.sessionResultId).toBe(vasiliyRow.id);

    // "Пилотов" сессии — число реальных людей (2), а не число машин (1).
    expect(result.driverCount).toBe(2);
  });

  it("сольная машина без <Swap> — одна строка session_results на пилота, stint-поля пустые (регресс)", async () => {
    parseRaceResults.mockReturnValueOnce(makeParsedSession());
    const { tx, capturedSessionResults } = makeTeamRaceTx();
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await runImport({ id: "job-21", fileHash: "hash-21", fileName: "solo.xml", content: "<x/>" });

    // makeParsedSession() — два сольных пилота (Driver A, Driver B), у каждого своя машина.
    expect(capturedSessionResults).toHaveLength(2);
    for (const row of capturedSessionResults) {
      expect(row.stintStartLap).toBeNull();
      expect(row.stintEndLap).toBeNull();
      expect(row.stintStartSec).toBeNull();
      expect(row.stintEndSec).toBeNull();
    }
    expect(result.driverCount).toBe(2);
  });

  it("hasCoDrivers=1 в sessions, когда хотя бы у одной машины несколько реальных пилотов", async () => {
    parseRaceResults.mockReturnValueOnce({
      ...makeParsedSession(),
      drivers: [
        {
          name: "Vasiliy Kalistratov",
          isPlayer: true,
          position: 5,
          classPosition: 3,
          lapRankIncludingDiscos: null,
          carClass: "GT3",
          carType: "Porsche 911 GT3 R",
          teamName: "Manthey",
          carNumber: "90",
          vehFile: null,
          vehName: null,
          category: null,
          controlAndAids: null,
          connected: 1,
          laps: 2,
          pitstops: 0,
          bestLapMs: 115000,
          finishStatus: "Finished",
          stints: [
            { driverName: "Yuriy Khoroshenkiy", startLap: 1, endLap: 1, startSec: null, endSec: 500 },
            { driverName: "Vasiliy Kalistratov", startLap: 2, endLap: 2, startSec: 500, endSec: null },
          ],
          lapList: [
            { num: 1, lapMs: 100000 },
            { num: 2, lapMs: 115000 },
          ],
        },
      ],
    });

    const { tx } = makeTeamRaceTx();
    let insertedSessionPayload: any = null;
    const originalInsert = tx.insert;
    tx.insert = vi.fn((table: any) => {
      const built = originalInsert(table);
      return {
        values: vi.fn((payload: any) => {
          if (insertedSessionPayload === null && !Array.isArray(payload) && "sessionType" in payload) {
            insertedSessionPayload = payload;
          }
          return built.values(payload);
        }),
      };
    });
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    await runImport({ id: "job-22", fileHash: "hash-22", fileName: "team-race-2.xml", content: "<x/>" });

    expect(insertedSessionPayload).toMatchObject({ hasCoDrivers: 1 });
  });

  it("Stream-инцидент со-пилота резолвится по имени и не попадает в DLQ", async () => {
    parseRaceResults.mockReturnValueOnce({
      ...makeParsedSession(),
      drivers: [
        {
          name: "Vasiliy Kalistratov",
          isPlayer: true,
          position: 5,
          classPosition: 3,
          lapRankIncludingDiscos: null,
          carClass: "GT3",
          carType: "Porsche 911 GT3 R",
          teamName: "Manthey",
          carNumber: "90",
          vehFile: null,
          vehName: null,
          category: null,
          controlAndAids: null,
          connected: 1,
          laps: 2,
          pitstops: 0,
          bestLapMs: 100000,
          finishStatus: "Finished",
          stints: [
            { driverName: "Yuriy Khoroshenkiy", startLap: 1, endLap: 1, startSec: null, endSec: 500 },
            { driverName: "Vasiliy Kalistratov", startLap: 2, endLap: 2, startSec: 500, endSec: null },
          ],
          lapList: [
            { num: 1, lapMs: 100000 },
            { num: 2, lapMs: 115000 },
          ],
        },
      ],
      trackLimits: [
        {
          driverName: "Yuriy Khoroshenkiy",
          lapNum: 1,
          elapsedTimeSec: 100,
          warningPoints: 0,
          currentPoints: 0,
          resolution: 7,
          decision: "No Further Action",
        },
      ],
    });

    const { tx } = makeTeamRaceTx();
    const importErrorRows: any[] = [];
    const originalInsert = tx.insert;
    tx.insert = vi.fn((table: any) => {
      const built = originalInsert(table);
      return {
        values: vi.fn((payload: any) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          if (rows[0] && "errorCode" in rows[0]) importErrorRows.push(...rows);
          return built.values(payload);
        }),
      };
    });
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    await runImport({ id: "job-23", fileHash: "hash-23", fileName: "team-race-3.xml", content: "<x/>" });

    const unknownDriverDlq = importErrorRows.filter((r) => r.errorMessage?.includes("неизвестного пилота"));
    expect(unknownDriverDlq).toHaveLength(0);
  });
});
