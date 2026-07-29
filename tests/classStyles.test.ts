import { describe, it, expect } from "vitest";
import {
  normalizeCarClass,
  getClassSortRank,
  compareCarClass,
  getClassBadgeClass,
  getClassAccentClass,
} from "../client/src/lib/classStyles";

describe("normalizeCarClass", () => {
  it("сводит прямые совпадения к каноническому классу", () => {
    expect(normalizeCarClass("Hypercar")).toBe("Hypercar");
    expect(normalizeCarClass("LMP2")).toBe("LMP2");
    expect(normalizeCarClass("LMP3")).toBe("LMP3");
    expect(normalizeCarClass("LMGT3")).toBe("LMGT3");
  });

  it("сводит алиасы Hypercar (Hyper, LMH) к Hypercar", () => {
    expect(normalizeCarClass("Hyper")).toBe("Hypercar");
    expect(normalizeCarClass("LMH")).toBe("Hypercar");
  });

  it("сводит GTE (прежнее имя) и GT3 (синоним/фолбэк парсера) к LMGT3", () => {
    expect(normalizeCarClass("GTE")).toBe("LMGT3");
    expect(normalizeCarClass("GT3")).toBe("LMGT3");
  });

  it("сводит серийные варианты с Events (WEC LMP2, ELMS LMP2) к LMP2 по подстроке", () => {
    expect(normalizeCarClass("WEC LMP2")).toBe("LMP2");
    expect(normalizeCarClass("ELMS LMP2")).toBe("LMP2");
  });

  it("не распознаёт регистр как проблему", () => {
    expect(normalizeCarClass("hypercar")).toBe("Hypercar");
    expect(normalizeCarClass("lmgt3")).toBe("LMGT3");
  });

  it("GT4 и прочие неизвестные классы не маппятся ни на что (null)", () => {
    expect(normalizeCarClass("GT4")).toBeNull();
    expect(normalizeCarClass("TCR")).toBeNull();
  });

  it("пустое/отсутствующее значение -> null", () => {
    expect(normalizeCarClass("")).toBeNull();
    expect(normalizeCarClass(undefined)).toBeNull();
    expect(normalizeCarClass(null)).toBeNull();
  });
});

describe("getClassBadgeClass / getClassAccentClass", () => {
  it("возвращают унифицированные цвета WEC для канонических классов", () => {
    expect(getClassBadgeClass("Hypercar")).toContain("red");
    expect(getClassBadgeClass("LMP2")).toContain("blue");
    expect(getClassBadgeClass("LMP3")).toContain("yellow");
    expect(getClassBadgeClass("LMGT3")).toContain("green");
  });

  it("GTE и GT3 окрашиваются как LMGT3 (зелёный)", () => {
    expect(getClassBadgeClass("GTE")).toBe(getClassBadgeClass("LMGT3"));
    expect(getClassBadgeClass("GT3")).toBe(getClassBadgeClass("LMGT3"));
  });

  it("неизвестный класс (GT4) получает нейтральный фолбэк, а не отдельный цвет", () => {
    expect(getClassBadgeClass("GT4")).toBe("bg-muted/40 text-muted-foreground border-border");
    expect(getClassAccentClass("GT4")).toBe("border-border");
  });
});

describe("compareCarClass / getClassSortRank", () => {
  it("сортирует по канонической категории Hypercar -> LMP2 -> LMP3 -> LMGT3", () => {
    const shuffled = ["LMGT3", "LMP3", "Hypercar", "LMP2"];
    expect([...shuffled].sort(compareCarClass)).toEqual(["Hypercar", "LMP2", "LMP3", "LMGT3"]);
  });

  it("алиасы сортируются рядом со своим каноническим классом", () => {
    const shuffled = ["GT3", "LMP2", "Hyper", "GTE"];
    // Hyper -> Hypercar (ранг 0), LMP2 (ранг 1), GT3/GTE -> LMGT3 (ранг 3, далее по алфавиту)
    expect([...shuffled].sort(compareCarClass)).toEqual(["Hyper", "LMP2", "GT3", "GTE"]);
  });

  it("неизвестные классы уходят в конец, по алфавиту", () => {
    const shuffled = ["TCR", "Hypercar", "GT4"];
    expect([...shuffled].sort(compareCarClass)).toEqual(["Hypercar", "GT4", "TCR"]);
  });

  it("getClassSortRank возвращает длину CANONICAL_CLASS_ORDER для неизвестного класса", () => {
    expect(getClassSortRank("GT4")).toBe(4);
    expect(getClassSortRank("Hypercar")).toBe(0);
  });
});
