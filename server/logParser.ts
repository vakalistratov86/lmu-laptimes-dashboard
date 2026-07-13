// Парсер логов результатов rFactor 2 / Le Mans Ultimate (<rFactorXML><RaceResults>)
// Формат хорошо структурирован; используем лёгкий разбор без внешних XML-зависимостей.

export interface ParsedLap {
  num: number;
  lapMs: number | null; // null для незачтённых (пит, out-lap)
  s1Ms: number | null;
  s2Ms: number | null;
  s3Ms: number | null;
  isPit: boolean;
}

export interface ParsedDriver {
  name: string;
  isPlayer: boolean;
  position: number;
  classPosition: number;
  carClass: string;
  carType: string;
  teamName: string;
  carNumber: string | null;
  laps: number;
  pitstops: number;
  bestLapMs: number | null;
  finishStatus: string | null;
  lapList: ParsedLap[];
}

export interface ParsedSession {
  venue: string;
  event: string;
  sessionType: string;
  trackLengthM: number | null;
  gameVersion: string | null;
  dateTimeIso: string; // ISO 8601
  drivers: ParsedDriver[];
}

function tagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
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

function parseDriverBlock(block: string): ParsedDriver | null {
  const name = tagValue(block, "Name");
  if (!name) return null;

  const isPlayer = tagValue(block, "isPlayer") === "1";
  const position = parseInt(tagValue(block, "Position") ?? "0", 10) || 0;
  const classPosition = parseInt(tagValue(block, "ClassPosition") ?? "0", 10) || 0;
  const carClass = tagValue(block, "CarClass") ?? "—";
  const carType = tagValue(block, "CarType") ?? tagValue(block, "VehName") ?? "—";
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
    const attr = (a: string): string | null => {
      const mm = attrs.match(new RegExp(`${a}="([^"]*)"`));
      return mm ? mm[1] : null;
    };
    const num = parseInt(attr("num") ?? "0", 10) || 0;
    lapList.push({
      num,
      lapMs: secToMs(inner),
      s1Ms: secToMs(attr("s1")),
      s2Ms: secToMs(attr("s2")),
      s3Ms: secToMs(attr("s3")),
      isPit: attr("pit") === "1",
    });
  }

  return {
    name,
    isPlayer,
    position,
    classPosition,
    carClass,
    carType,
    teamName,
    carNumber,
    laps,
    pitstops,
    bestLapMs,
    finishStatus,
    lapList,
  };
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
  if (!xml.includes("<RaceResults>") && !xml.includes("rFactorXML")) return null;

  const venue = tagValue(xml, "TrackVenue") ?? tagValue(xml, "TrackCourse") ?? "Неизвестная трасса";
  const event = tagValue(xml, "TrackEvent") ?? venue;
  const gameVersion = tagValue(xml, "GameVersion");
  const trackLenStr = tagValue(xml, "TrackLength");
  const trackLengthM = trackLenStr ? parseFloat(trackLenStr) : null;

  // Дата: предпочитаем Unix DateTime верхнего уровня; иначе TimeString
  let dateTimeIso: string;
  const unix = tagValue(xml, "DateTime");
  if (unix && /^\d+$/.test(unix)) {
    dateTimeIso = new Date(parseInt(unix, 10) * 1000).toISOString();
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

  return {
    venue,
    event,
    sessionType,
    trackLengthM: Number.isFinite(trackLengthM as number) ? (trackLengthM as number) : null,
    gameVersion,
    dateTimeIso,
    drivers,
  };
}
