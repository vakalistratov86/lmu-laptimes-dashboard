// Парсер логов результатов rFactor 2 / Le Mans Ultimate (<rFactorXML><RaceResults>)
// Формат хорошо структурирован; используем лёгкий разбор без внешних XML-зависимостей.

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

function tagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

function attrValue(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
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

function parseDriverBlock(block: string): ParsedDriver | null {
  const name = tagValue(block, "Name");
  if (!name) return null;

  const isPlayer = tagValue(block, "isPlayer") === "1";
  const position = parseInt(tagValue(block, "Position") ?? "0", 10) || 0;
  const classPosition = parseInt(tagValue(block, "ClassPosition") ?? "0", 10) || 0;
  const lapRankIncludingDiscos = toInt(tagValue(block, "LapRankIncludingDiscos")); // #48
  const carClass = tagValue(block, "CarClass") ?? "—";
  const carType = tagValue(block, "CarType") ?? tagValue(block, "VehName") ?? "—";
  const vehFile = tagValue(block, "VehFile");                                      // #48
  const vehName = tagValue(block, "VehName");                                      // #48
  const category = tagValue(block, "Category");                                    // #48
  const controlAndAids = tagValue(block, "ControlAndAids");                        // #48
  const connectedStr = tagValue(block, "Connected");                               // #48
  const connected = connectedStr != null ? (connectedStr === "1" ? 1 : 0) : null;
  const teamName = tagValue(block, "TeamName") ?? "—";
  const carNumber = tagValue(block, "CarNumber");
  const laps = parseInt(tagValue(block, "Laps") ?? "0", 10) || 0;
  const pitstops = parseInt(tagValue(block, "Pitstops") ?? "0", 10) || 0;
  const bestLapMs = secToMs(tagValue(block, "BestLapTime"));
  const finishStatus = tagValue(block, "FinishStatus");

  // Круги: <Lap num="2" ... s1="27.44" s2="51.67" s3="22.78" ... pit="1">101.9073</Lap>
  const lapList: ParsedLap[] = [];
  const lapRe = /<Lap\b([^>]*)>([\s\S]*?)<\/Lap>/g;
  let lm: RegExpExecArray | null;
  while ((lm = lapRe.exec(block)) !== null) {
    const attrs = lm[1];
    const inner = lm[2];
    const attr = (a: string): string | null => attrValue(attrs, a);
    const num = parseInt(attr("num") ?? "0", 10) || 0;
    // #63 — читаем conditions и frontCompound из атрибутов тега <Lap>
    const conditions = attr("wet") === "1" ? "Дождь" : (attr("conditions") ?? null);
    const frontCompound = attr("frontCompound") ?? attr("compound") ?? null;
    lapList.push({
      num,
      lapMs: secToMs(inner),
      s1Ms: secToMs(attr("s1")),
      s2Ms: secToMs(attr("s2")),
      s3Ms: secToMs(attr("s3")),
      isPit: attr("pit") === "1",
      conditions,
      frontCompound,
      // Телеметрия из XML-атрибутов <Lap>
      topSpeedKph: toFloat(attr("topspeed")),
      fuelLevel: toFloat(attr("fuel")),
      fuelUsed: toFloat(attr("fuelUsed")),
      tyreFLCondition: toFloat(attr("twfl")),
      tyreFRCondition: toFloat(attr("twfr")),
      tyreRLCondition: toFloat(attr("twrl")),
      tyreRRCondition: toFloat(attr("twrr")),
      rearCompound: attr("rcompound") ?? null,
      tyreFL: attr("FL") ?? null,
      tyreFR: attr("FR") ?? null,
      tyreRL: attr("RL") ?? null,
      tyreRR: attr("RR") ?? null,
    });
  }

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

// #49 — парсинг Stream-блока
function parseStream(
  streamXml: string,
  driverNameByBlock?: (block: string) => string | null,
): {
  incidents: ParsedIncident[];
  sectorBests: ParsedSectorBest[];
  trackLimits: ParsedTrackLimit[];
} {
  const incidents: ParsedIncident[] = [];
  const sectorBests: ParsedSectorBest[] = [];
  const trackLimits: ParsedTrackLimit[] = [];

  // --- Incidents ---
  const incidentRe = /<Incident\b([^>]*)>([\s\S]*?)<\/Incident>/g;
  let im: RegExpExecArray | null;
  while ((im = incidentRe.exec(streamXml)) !== null) {
    const attrs = im[1];
    const inner = im[2];
    const et = toFloat(attrValue(attrs, "et")) ?? 0;
    // fix(#64): severity — атрибут тега <Incident>, а не текст в скобках
    const severity = parseFloat(attrValue(attrs, "severity") ?? "0") || 0;
    const names = [...inner.matchAll(/<Name>([\s\S]*?)<\/Name>/g)].map((m) => m[1].trim());
    const isImmovable = inner.includes("<Immovable>") || inner.includes("Immovable");
    incidents.push({
      driverName: names[0] ?? "Unknown",
      targetDriverName: isImmovable ? null : (names[1] ?? null),
      elapsedTimeSec: et,
      severity,
      isImmovable,
    });
  }

  // --- SectorBests ---
  const sectorRe = /<Sector\b([^>]*)>([\s\S]*?)<\/Sector>/g;
  let sm: RegExpExecArray | null;
  while ((sm = sectorRe.exec(streamXml)) !== null) {
    const attrs = sm[1];
    const inner = sm[2];
    const et = toFloat(attrValue(attrs, "et")) ?? 0;
    const lapNum = toInt(attrValue(attrs, "lap"));
    const sector = toInt(attrValue(attrs, "s")) ?? 0;
    const driverName = tagValue(inner, "Name") ?? "Unknown";
    const carClass = tagValue(inner, "CarClass") ?? "—";
    sectorBests.push({ driverName, carClass, sector, elapsedTimeSec: et, lapNum });
  }

  // --- TrackLimits ---
  const tlRe = /<TrackLimits\b([^>]*)>([\s\S]*?)<\/TrackLimits>/g;
  let tm: RegExpExecArray | null;
  while ((tm = tlRe.exec(streamXml)) !== null) {
    const attrs = tm[1];
    const inner = tm[2];
    const et = toFloat(attrValue(attrs, "et")) ?? 0;
    const lapNum = toInt(attrValue(attrs, "lap")) ?? 0;
    const driverName = tagValue(inner, "Name") ?? "Unknown";
    const warningPoints = toInt(tagValue(inner, "WarningPoints"));
    const currentPoints = toInt(tagValue(inner, "CurrentPoints"));
    const resolution = toInt(attrValue(attrs, "Resolution") ?? tagValue(inner, "Resolution") ?? null);
    const decision = tagValue(inner, "Decision");
    trackLimits.push({ driverName, lapNum, elapsedTimeSec: et, warningPoints, currentPoints, resolution, decision });
  }

  return { incidents, sectorBests, trackLimits };
}

// Определяем тип сессии по имени секции-обёртки (<Practice1>, <Qualify>, <Race> и т.п.)
function detectSessionType(xml: string): { type: string; block: string } {
  const known = [
    "TestDay",
    "Practice1",
    "Practice2",
    "Practice3",
    "Practice4",
    "Practice",
    "Warmup",
    "Qualify1",
    "Qualify2",
    "Qualify",
    "Race1",
    "Race2",
    "Race",
  ];
  for (const t of known) {
    const m = xml.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));
    if (m) {
      const label =
        t.startsWith("Practice") ? "Практика" :
        t.startsWith("Qualify") ? "Квалификация" :
        t.startsWith("Race") ? "Гонка" :
        t === "Warmup" ? "Прогрев" :
        t === "TestDay" ? "Тесты" : t;
      return { type: `${label} (${t})`, block: m[1] };
    }
  }
  // Фолбэк: вся секция RaceResults
  return { type: "Сессия", block: xml };
}

export function parseRaceResults(xml: string): ParsedSession | null {
  // #7 — Детекция версии формата перед парсингом
  const detectedVersion = detectLogVersion(xml);
  const logFormatVersion = assertSupportedVersion(detectedVersion, xml);

  const venue = tagValue(xml, "TrackVenue") ?? tagValue(xml, "TrackCourse") ?? "Неизвестная трасса";
  const course = tagValue(xml, "TrackCourse");  // null если тег отсутствует
  // fix: "||" (not "??") — a present-but-empty <TrackEvent></TrackEvent> must also fall back to venue
  const event = tagValue(xml, "TrackEvent") || venue;
  const gameVersion = tagValue(xml, "GameVersion");

  // #50 — trackLengthM
  const trackLenStr = tagValue(xml, "TrackLength");
  const trackLengthM = trackLenStr ? parseFloat(trackLenStr) : null;

  // Дата: предпочитаем Unix DateTime верхнего уровня; иначе TimeString
  let dateTimeIso: string;
  let dateTimeUnix: number | null = null; // #48
  const unixStr = tagValue(xml, "DateTime");
  if (unixStr && /^\d+$/.test(unixStr)) {
    dateTimeUnix = parseInt(unixStr, 10); // #48
    dateTimeIso = new Date(dateTimeUnix * 1000).toISOString();
  } else {
    const ts = tagValue(xml, "TimeString"); // "2026/07/10 20:54:44"
    if (ts) {
      const iso = ts.replace(/\//g, "-").replace(" ", "T");
      const d = new Date(iso);
      dateTimeIso = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } else {
      dateTimeIso = new Date().toISOString();
    }
  }

  // #48 — настройки сессии
  const setting = tagValue(xml, "Setting");
  const raceLaps = toInt(tagValue(xml, "RaceLaps"));
  const raceTimeMin = toInt(tagValue(xml, "RaceTime"));
  const mechFailRate = toInt(tagValue(xml, "MechFailRate"));
  const damageMult = toInt(tagValue(xml, "DamageMult"));
  const fuelMult = toFloat(tagValue(xml, "FuelMult"));
  const tireMult = toFloat(tagValue(xml, "TireMult"));
  const vehiclesAllowed = tagValue(xml, "VehiclesAllowed");
  const parcFerme = toInt(tagValue(xml, "ParcFerme"));
  const fixedSetups = toInt(tagValue(xml, "FixedSetups"));
  const freeSettings = toInt(tagValue(xml, "FreeSettings"));
  const fixedUpgrades = toInt(tagValue(xml, "FixedUpgrades"));
  const tireWarmers = toInt(tagValue(xml, "TireWarmers"));
  const dedicated = toInt(tagValue(xml, "Dedicated"));
  const sessionDurationMin = toInt(tagValue(xml, "Minutes"));
  const sessionMaxLaps = toInt(tagValue(xml, "Laps"));
  const mostLapsCompleted = toInt(tagValue(xml, "MostLapsCompleted"));

  const { type: sessionType, block: sessionBlock } = detectSessionType(xml);

  // Блоки <Driver>...</Driver> ищем внутри секции сессии
  const drivers: ParsedDriver[] = [];
  const driverRe = /<Driver>([\s\S]*?)<\/Driver>/g;
  let dm: RegExpExecArray | null;
  while ((dm = driverRe.exec(sessionBlock)) !== null) {
    const parsed = parseDriverBlock(dm[1]);
    if (parsed) drivers.push(parsed);
  }

  if (drivers.length === 0) return null;

  // #49 — парсим Stream-блок (если есть)
  const streamMatch = xml.match(/<Stream>([\s\S]*?)<\/Stream>/);
  const { incidents, sectorBests, trackLimits } = streamMatch
    ? parseStream(streamMatch[1])
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
