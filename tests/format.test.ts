import { describe, it, expect } from "vitest";
import { formatLap, formatSector, formatDelta, countryFlag } from "../client/src/lib/format";

describe("formatLap", () => {
  it("форматирует время с минутами (1:41.907)", () => {
    expect(formatLap(101907)).toBe("1:41.907");
  });

  it("форматирует время без минут (59.999)", () => {
    expect(formatLap(59999)).toBe("59.999");
  });

  it("дополняет секунды нулём (1:07.000)", () => {
    expect(formatLap(67000)).toBe("1:07.000");
  });

  it("дополняет миллисекунды нулями (1:40.001)", () => {
    expect(formatLap(100001)).toBe("1:40.001");
  });

  it("нулевое время -> 0.000", () => {
    expect(formatLap(0)).toBe("0.000");
  });

  it("ровная минута (1:00.000)", () => {
    expect(formatLap(60000)).toBe("1:00.000");
  });

  it("2 минуты ровно (2:00.000)", () => {
    expect(formatLap(120000)).toBe("2:00.000");
  });

  it("3 цифры миллисекунд дополняются до 3 знаков", () => {
    // 61010 мс = 1 мин 01.010 сек
    expect(formatLap(61010)).toBe("1:01.010");
  });
});

describe("formatSector", () => {
  it("форматирует сектор в SS.mmm (27.440)", () => {
    expect(formatSector(27440)).toBe("27.440");
  });

  it("возвращает «—» для 0", () => {
    expect(formatSector(0)).toBe("—");
  });

  it("возвращает «—» для отрицательного значения", () => {
    expect(formatSector(-100)).toBe("—");
  });

  it("дополняет миллисекунды нулями", () => {
    expect(formatSector(51010)).toBe("51.010");
  });

  it("менее секунды (0.500)", () => {
    // 500 мс
    expect(formatSector(500)).toBe("0.500");
  });
});

describe("formatDelta", () => {
  it("возвращает «—» при равных временах", () => {
    expect(formatDelta(101907, 101907)).toBe("—");
  });

  it("добавляет «+» для худшего времени", () => {
    const delta = formatDelta(102000, 101907);
    expect(delta.startsWith("+")).toBe(true);
  });

  it("добавляет «-» для лучшего времени", () => {
    const delta = formatDelta(101000, 101907);
    expect(delta.startsWith("-")).toBe(true);
  });

  it("дельта +1 секунда форматируется корректно (+0.093 -> ms = 93)", () => {
    // 102000 - 101907 = 93 мс
    const delta = formatDelta(102000, 101907);
    expect(delta).toBe("+0.093");
  });

  it("дельта -1 минута форматируется корректно", () => {
    // bestMs = 161907, ms = 101907, diff = -60000
    const delta = formatDelta(101907, 161907);
    expect(delta).toBe("-1:00.000");
  });
});

describe("countryFlag", () => {
  it("возвращает флаг России", () => {
    expect(countryFlag("RU")).toBe("🇷🇺");
  });

  it("возвращает флаг Великобритании", () => {
    expect(countryFlag("GB")).toBe("🇬🇧");
  });

  it("возвращает 🏁 для неизвестного кода", () => {
    expect(countryFlag("XX")).toBe("🏁");
  });

  it("возвращает 🏁 для пустой строки", () => {
    expect(countryFlag("")).toBe("🏁");
  });
});
