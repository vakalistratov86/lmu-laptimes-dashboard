// Парсер логов результатов rFactor 2 / Le Mans Ultimate (<rFactorXML><RaceResults>)
// #123 — построен на fast-xml-parser (реальное дерево XML вместо ad-hoc regex),
// что корректно обрабатывает CDATA, экранированные спецсимволы и вложенные
// одноимённые теги в разных ветках дерева.

import { XMLParser } from 'fast-xml-parser';
import { detectLogVersion, assertSupportedVersion, type LogVersion } from '@shared/parserContracts';

export interface ParsedLap {
  num: number;
  lapMs: number | null; // null для незачтённых (пит, out-lap)
  s1Ms: number | null;
  s2Ms: number | null;
  s3Ms: number | null;
  isPit: boolean;
  conditions: string | null;      // #63 — из атрибута Lap или Stream
  frontCompound: string | null;   // #63 — из атрибута Lap (компаунд)
  // Телеметрия круга из XML-атрибутов <Lap>
  topSpeedKph: number | null;       // topspeed="252.25"
  fuelLevel: number | null;         // fuel="0.690"
  fuelUsed: number | null;          // fuelUsed="0.027"
  tyreFLCondition: number | null;   // twfl="0.988"
  tyreFRCondition: number | null;   // twfr="0.992"
  tyreRLCondition: number | null;   // twrl="0.965"
  tyreRRCondition: number | null;   // twrr="0.980"
  rearCompound: string | null;      // rcompound="0,Medium"
  tyreFL: string | null;            // FL="0,Medium"
  tyreFR: string | null;            // FR="0,Medium"
  tyreRL: string | null;            // RL="0,Medium"
  tyreRR: string | null;            // RR="0,Medium"
}

export interface ParsedDriver {
  name: string;
  isPlayer: boolean;
  position: number;
  classPosition: number;
  lapRankIncludingDiscos: number | null; // #48
  carClass: string;
  carType: string;
  vehFile: string | null;               // #48
  vehName: string | null;               // #48
  category: string | null;              // #48
  controlAndAids: string | null;        // #48
  connected: number | null;             // #48 (1/0)
  teamName: string;
  carNumber: string | null;
  laps: number;
  pitstops: number;
  bestLapMs: number | null;
  finishStatus: string | null;
  lapList: ParsedLap[];
}

// #49 — инциденты из Stream
export interface ParsedIncident {
  driverName: string;
  targetDriverName: string | null;
  elapsedTimeSec: number;
  severity: number;
  isImmovable: boolean;
}

// #49 — лучшие времена по секторам из Stream
export interface ParsedSectorBest {
  driverName: string;
  carClass: string;
  sector: number;           // 1, 2 или 3
  elapsedTimeSec: number;
  lapNum: number | null;
}

// #49 — нарушения трассы из Stream
export interface ParsedTrackLimit {
  driverName: string;
  lapNum: number;
  elapsedTimeSec: number;
  warningPoints: number | null;
  currentPoints: number | null;
  resolution: number | null;
  decision: string | null;
}

export interface ParsedSession {
  venue: string;
  course: string | null;        // TrackCourse из XML
  event: string;
  sessionType: string;
  trackLengthM: number | null;  // #50
  gameVersion: string | null;
  dateTimeIso: string;          // ISO 8601
  dateTimeUnix: number | null;  // #48 — DateTime (Unix секунды)
  logFormatVersion: LogVersion; // #7 — детектированная версия формата
  // #48 — настройки сессии
  setting: string | null;
  raceLaps: number | null;
  raceTimeMin: number | null;
  mechFailRate: number | null;
  damageMult: number | null;
  fuelMult: number | null;
  tireMult: number | null;
  vehiclesAllowed: string | null;
  parcFerme: number | null;
  fixedSetups: number | null;
  freeSettings: number | null;
  fixedUpgrades: number | null;
  tireWarmers: number | null;
  dedicated: number | null;
  sessionDurationMin: number | null;
  sessionMaxLaps: number | null;
  mostLapsCompleted: number | null;
  drivers: ParsedDriver[];
  // #49 — данные из Stream
  incidents: ParsedIncident[];
  sectorBests: ParsedSectorBest[];
  trackLimits: ParsedTrackLimit[];
}

// Теги, которые всегда должны становиться массивом, даже если в документе
// встретился только один экземпляр (иначе fast-xml-parser даст голый объект).
// <Name> внутри <Incident> — особый случай: там их обычно два (виновник/жертва),
// а в <Sector>/<TrackLimits> — Name всегда один, поэтому масштабируем по jPath.
const ALWAYS_ARRAY_TAGS = new Set(['Driver', 'Lap', 'Incident', 'Sector', 'TrackLimits']);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (tagName, jPath) => {
    if (ALWAYS_ARRAY_TAGS.has(tagName)) return true;
    if (tagName === 'Name' && typeof jPath === 'string' && jPath.endsWith('.Incident.Name')) return true;
    return false;
  },
});

type XmlNode = Record<string, unknown>;

// Рекурсивно ищет первый узел с ключом `tag` где угодно в дереве (аналог
// ненаправленного regex-поиска по всему тексту в старой реализации).
function findFirst(node: unknown, tag: string): unknown {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirst(item, tag);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (node && typeof node === 'object') {
    const obj = node as XmlNode;
    if (Object.prototype.hasOwnProperty.call(obj, tag)) {
      const v = obj[tag];
      return Array.isArray(v) ? v[0] : v;
    }
    for (const key of Object.keys(obj)) {
      const found = findFirst(obj[key], tag);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

// Рекурсивно собирает все узлы с ключом `tag` в дереве, в порядке документа.
function collectAll(node: unknown, tag: string): XmlNode[] {
  const out: XmlNode[] = [];
  function walk(n: unknown) {
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
      return;
    }
    if (n && typeof n === 'object') {
      const obj = n as XmlNode;
      for (const key of Object.keys(obj)) {
        if (key === tag) {
          const v = obj[key];
          if (Array.isArray(v)) out.push(...(v as XmlNode[]));
          else out.push(v as XmlNode);
        } else {
          walk(obj[key]);
        }
      }
    }
  }
  walk(node);
  return out;
}

// Скалярное значение тега-потомка. null — тег отсутствует; "" — тег присутствует, но пуст.
function scalar(node: unknown, tag: string): string | null {
  if (!node || typeof node !== 'object') return null;
  const v = (node as XmlNode)[tag];
  if (v === undefined || v === null) return null;
  if (typeof v === 'object') {
    // Тег с атрибутами и текстом одновременно — текст лежит в #text.
    const inner = (v as XmlNode)['#text'];
    return inner === undefined || inner === null ? null : String(inner);
  }
  return String(v);
}

function attr(node: unknown, name: string): string | null {
  if (!node || typeof node !== 'object') return null;
  const v = (node as XmlNode)[`@_${name}`];
  return v === undefined || v === null ? null : String(v);
}

// Секунды (строка вида "101.9073") -> целые миллисекунды. Возвращает null для служебных значений.
function secToMs(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = v.trim();
  if (!s || s === "--.----" || s === "--.---" || s.startsWith("--")) return null;
  const num = parseFloat(s);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 1000);
}

function toInt(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function parseDriverBlock(driverNode: XmlNode): ParsedDriver | null {
  const name = scalar(driverNode, "Name");
  if (!name) return null;

  const isPlayer = scalar(driverNode, "isPlayer") === "1";
  const position = parseInt(scalar(driverNode, "Position") ?? "0", 10) || 0;
  const classPosition = parseInt(scalar(driverNode, "ClassPosition") ?? "0", 10) || 0;
  const lapRankIncludingDiscos = toInt(scalar(driverNode, "LapRankIncludingDiscos")); // #48
  const carClass = scalar(driverNode, "CarClass") ?? "—";
  const carType = scalar(driverNode, "CarType") ?? scalar(driverNode, "VehName") ?? "—";
  const vehFile = scalar(driverNode, "VehFile");                                      // #48
  const vehName = scalar(driverNode, "VehName");                                      // #48
  const category = scalar(driverNode, "Category");                                    // #48
  const controlAndAids = scalar(driverNode, "ControlAndAids");                        // #48
  const connectedStr = scalar(driverNode, "Connected");                               // #48
  const connected = connectedStr != null ? (connectedStr === "1" ? 1 : 0) : null;
  const teamName = scalar(driverNode, "TeamName") ?? "—";
  const carNumber = scalar(driverNode, "CarNumber");
  const laps = parseInt(scalar(driverNode, "Laps") ?? "0", 10) || 0;
  const pitstops = parseInt(scalar(driverNode, "Pitstops") ?? "0", 10) || 0;
  const bestLapMs = secToMs(scalar(driverNode, "BestLapTime"));
  const finishStatus = scalar(driverNode, "FinishStatus");

  // Круги: <Lap num="2" ... s1="27.44" s2="51.67" s3="22.78" ... pit="1">101.9073</Lap>
  const lapNodes = (driverNode.Lap as XmlNode[] | undefined) ?? [];
  const lapList: ParsedLap[] = lapNodes.map((lapNode) => {
    const num = parseInt(attr(lapNode, "num") ?? "0", 10) || 0;
    // #63 — читаем conditions и frontCompound из атрибутов тега <Lap>
    const conditions = attr(lapNode, "wet") === "1" ? "Дождь" : (attr(lapNode, "conditions") ?? null);
    const frontCompound = attr(lapNode, "frontCompound") ?? attr(lapNode, "compound") ?? null;
    return {
      num,
      lapMs: secToMs((lapNode['#text'] as string | undefined) ?? null),
      s1Ms: secToMs(attr(lapNode, "s1")),
      s2Ms: secToMs(attr(lapNode, "s2")),
      s3Ms: secToMs(attr(lapNode, "s3")),
      isPit: attr(lapNode, "pit") === "1",
      conditions,
      frontCompound,
      // Телеметрия из XML-атрибутов <Lap>
      topSpeedKph: toFloat(attr(lapNode, "topspeed")),
      fuelLevel: toFloat(attr(lapNode, "fuel")),
      fuelUsed: toFloat(attr(lapNode, "fuelUsed")),
      tyreFLCondition: toFloat(attr(lapNode, "twfl")),
      tyreFRCondition: toFloat(attr(lapNode, "twfr")),
      tyreRLCondition: toFloat(attr(lapNode, "twrl")),
      tyreRRCondition: toFloat(attr(lapNode, "twrr")),
      rearCompound: attr(lapNode, "rcompound") ?? null,
      tyreFL: attr(lapNode, "FL") ?? null,
      tyreFR: attr(lapNode, "FR") ?? null,
      tyreRL: attr(lapNode, "RL") ?? null,
      tyreRR: attr(lapNode, "RR") ?? null,
    };
  });

  return {
    name,
    isPlayer,
    position,
    classPosition,
    lapRankIncludingDiscos,
    carClass,
    carType,
    vehFile,
    vehName,
    category,
    controlAndAids,
    connected,
    teamName,
    carNumber,
    laps,
    pitstops,
    bestLapMs,
    finishStatus,
    lapList,
  };
}

// #49 — парсинг Stream-узла
function parseStream(streamNode: XmlNode): {
  incidents: ParsedIncident[];
  sectorBests: ParsedSectorBest[];
  trackLimits: ParsedTrackLimit[];
} {
  const incidents: ParsedIncident[] = [];
  const sectorBests: ParsedSectorBest[] = [];
  const trackLimits: ParsedTrackLimit[] = [];

  // --- Incidents ---
  const incidentNodes = (streamNode.Incident as XmlNode[] | undefined) ?? [];
  for (const incNode of incidentNodes) {
    const et = toFloat(attr(incNode, "et")) ?? 0;
    // fix(#64): severity — атрибут тега <Incident>, а не текст в скобках
    const severity = parseFloat(attr(incNode, "severity") ?? "0") || 0;
    const namesRaw = incNode.Name;
    const names: string[] = Array.isArray(namesRaw)
      ? namesRaw.map((n) => String(n).trim())
      : namesRaw != null ? [String(namesRaw).trim()] : [];
    const isImmovable = Object.prototype.hasOwnProperty.call(incNode, "Immovable");
    incidents.push({
      driverName: names[0] ?? "Unknown",
      targetDriverName: isImmovable ? null : (names[1] ?? null),
      elapsedTimeSec: et,
      severity,
      isImmovable,
    });
  }

  // --- SectorBests ---
  const sectorNodes = (streamNode.Sector as XmlNode[] | undefined) ?? [];
  for (const secNode of sectorNodes) {
    const et = toFloat(attr(secNode, "et")) ?? 0;
    const lapNum = toInt(attr(secNode, "lap"));
    const sector = toInt(attr(secNode, "s")) ?? 0;
    const driverName = scalar(secNode, "Name") ?? "Unknown";
    const carClass = scalar(secNode, "CarClass") ?? "—";
    sectorBests.push({ driverName, carClass, sector, elapsedTimeSec: et, lapNum });
  }

  // --- TrackLimits ---
  const tlNodes = (streamNode.TrackLimits as XmlNode[] | undefined) ?? [];
  for (const tlNode of tlNodes) {
    const et = toFloat(attr(tlNode, "et")) ?? 0;
    const lapNum = toInt(attr(tlNode, "lap")) ?? 0;
    const driverName = scalar(tlNode, "Name") ?? "Unknown";
    const warningPoints = toInt(scalar(tlNode, "WarningPoints"));
    const currentPoints = toInt(scalar(tlNode, "CurrentPoints"));
    const resolution = toInt(attr(tlNode, "Resolution") ?? scalar(tlNode, "Resolution"));
    const decision = scalar(tlNode, "Decision");
    trackLimits.push({ driverName, lapNum, elapsedTimeSec: et, warningPoints, currentPoints, resolution, decision });
  }

  return { incidents, sectorBests, trackLimits };
}

// Определяем тип сессии по имени секции-обёртки (<Practice1>, <Qualify>, <Race> и т.п.)
const SESSION_TAGS: Array<[tag: string, label: string]> = [
  ["TestDay", "Тесты"],
  ["Practice1", "Практика"],
  ["Practice2", "Практика"],
  ["Practice3", "Практика"],
  ["Practice4", "Практика"],
  ["Practice", "Практика"],
  ["Warmup", "Прогрев"],
  ["Qualify1", "Квалификация"],
  ["Qualify2", "Квалификация"],
  ["Qualify", "Квалификация"],
  ["Race1", "Гонка"],
  ["Race2", "Гонка"],
  ["Race", "Гонка"],
];

function detectSessionType(raceResults: XmlNode): { type: string; node: unknown } {
  for (const [tag, label] of SESSION_TAGS) {
    if (Object.prototype.hasOwnProperty.call(raceResults, tag)) {
      const node = raceResults[tag];
      return { type: `${label} (${tag})`, node: Array.isArray(node) ? node[0] : node };
    }
  }
  // Фолбэк: вся секция RaceResults
  return { type: "Сессия", node: raceResults };
}

export function parseRaceResults(xml: string): ParsedSession | null {
  // #7 — Детекция версии формата перед парсингом
  const detectedVersion = detectLogVersion(xml);
  const logFormatVersion = assertSupportedVersion(detectedVersion, xml);

  const root = xmlParser.parse(xml);
  const raceResults = (findFirst(root, "RaceResults") as XmlNode | undefined) ?? (root as XmlNode);

  const venue = scalar(raceResults, "TrackVenue") ?? scalar(raceResults, "TrackCourse") ?? "Неизвестная трасса";
  const course = scalar(raceResults, "TrackCourse");  // null если тег отсутствует
  // fix: "||" (not "??") — a present-but-empty <TrackEvent></TrackEvent> must also fall back to venue
  const event = scalar(raceResults, "TrackEvent") || venue;
  const gameVersion = scalar(raceResults, "GameVersion");

  // #50 — trackLengthM
  const trackLenStr = scalar(raceResults, "TrackLength");
  const trackLengthM = trackLenStr ? parseFloat(trackLenStr) : null;

  // Дата: предпочитаем Unix DateTime верхнего уровня; иначе TimeString
  let dateTimeIso: string;
  let dateTimeUnix: number | null = null; // #48
  const unixStr = scalar(raceResults, "DateTime");
  if (unixStr && /^\d+$/.test(unixStr)) {
    dateTimeUnix = parseInt(unixStr, 10); // #48
    dateTimeIso = new Date(dateTimeUnix * 1000).toISOString();
  } else {
    const ts = scalar(raceResults, "TimeString"); // "2026/07/10 20:54:44"
    if (ts) {
      const iso = ts.replace(/\//g, "-").replace(" ", "T");
      const d = new Date(iso);
      dateTimeIso = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } else {
      dateTimeIso = new Date().toISOString();
    }
  }

  // #48 — настройки сессии
  const setting = scalar(raceResults, "Setting");
  const raceLaps = toInt(scalar(raceResults, "RaceLaps"));
  const raceTimeMin = toInt(scalar(raceResults, "RaceTime"));
  const mechFailRate = toInt(scalar(raceResults, "MechFailRate"));
  const damageMult = toInt(scalar(raceResults, "DamageMult"));
  const fuelMult = toFloat(scalar(raceResults, "FuelMult"));
  const tireMult = toFloat(scalar(raceResults, "TireMult"));
  const vehiclesAllowed = scalar(raceResults, "VehiclesAllowed");
  const parcFerme = toInt(scalar(raceResults, "ParcFerme"));
  const fixedSetups = toInt(scalar(raceResults, "FixedSetups"));
  const freeSettings = toInt(scalar(raceResults, "FreeSettings"));
  const fixedUpgrades = toInt(scalar(raceResults, "FixedUpgrades"));
  const tireWarmers = toInt(scalar(raceResults, "TireWarmers"));
  const dedicated = toInt(scalar(raceResults, "Dedicated"));
  const sessionDurationMin = toInt(scalar(raceResults, "Minutes"));
  const sessionMaxLaps = toInt(scalar(raceResults, "Laps"));
  const mostLapsCompleted = toInt(scalar(raceResults, "MostLapsCompleted"));

  const { type: sessionType, node: sessionNode } = detectSessionType(raceResults);

  // Блоки <Driver>...</Driver> ищем внутри секции сессии
  const drivers: ParsedDriver[] = [];
  for (const driverNode of collectAll(sessionNode, "Driver")) {
    const parsed = parseDriverBlock(driverNode);
    if (parsed) drivers.push(parsed);
  }

  if (drivers.length === 0) return null;

  // #49 — парсим Stream-блок (если есть)
  const streamNode = raceResults.Stream as XmlNode | undefined;
  const { incidents, sectorBests, trackLimits } = streamNode
    ? parseStream(streamNode)
    : { incidents: [], sectorBests: [], trackLimits: [] };

  return {
    venue,
    course,
    event,
    sessionType,
    trackLengthM: Number.isFinite(trackLengthM as number) ? (trackLengthM as number) : null,
    gameVersion,
    dateTimeIso,
    dateTimeUnix,
    logFormatVersion, // #7
    setting,
    raceLaps,
    raceTimeMin,
    mechFailRate,
    damageMult,
    fuelMult,
    tireMult,
    vehiclesAllowed,
    parcFerme,
    fixedSetups,
    freeSettings,
    fixedUpgrades,
    tireWarmers,
    dedicated,
    sessionDurationMin,
    sessionMaxLaps,
    mostLapsCompleted,
    drivers,
    incidents,
    sectorBests,
    trackLimits,
  };
}
