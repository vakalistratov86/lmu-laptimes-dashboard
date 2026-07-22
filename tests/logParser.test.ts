import { describe, it, expect } from 'vitest';
import { parseRaceResults } from '../server/logParser';

// ---------------------------------------------------------------------------
// Вспомогательная функция для генерации минимального валидного XML
// ---------------------------------------------------------------------------
function makeXml(overrides: Partial<{
  venue: string;
  dateTime: string;
  sessionTag: string;
  drivers: string;
  stream: string;
}> = {}): string {
  const {
    venue = 'Le Mans',
    dateTime = '1752505200',
    sessionTag = 'Race',
    drivers = `<Driver>
  <Name>Max Verstappen</Name>
  <isPlayer>1</isPlayer>
  <Position>1</Position>
  <ClassPosition>1</ClassPosition>
  <CarClass>Hypercar</CarClass>
  <CarType>Toyota GR010</CarType>
  <TeamName>Toyota</TeamName>
  <CarNumber>7</CarNumber>
  <Laps>30</Laps>
  <Pitstops>2</Pitstops>
  <BestLapTime>101.9073</BestLapTime>
  <FinishStatus>Finished</FinishStatus>
  <Lap num="1" s1="27.44" s2="51.67" s3="22.78">101.890</Lap>
  <Lap num="2" s1="27.10" s2="51.20" s3="22.60" pit="1">100.900</Lap>
</Driver>`,
    stream = '',
  } = overrides;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rFactorXML>
  <RaceResults>
    <TrackVenue>${venue}</TrackVenue>
    <TrackEvent>6 Hours of Le Mans</TrackEvent>
    <DateTime>${dateTime}</DateTime>
    <GameVersion>2.00</GameVersion>
    <TrackLength>13626.0</TrackLength>
    <${sessionTag}>
      ${drivers}
    </${sessionTag}>
    ${stream}
  </RaceResults>
</rFactorXML>`;
}

describe('parseRaceResults', () => {

  // -------------------------------------------------------------------------
  // Базовый happy-path
  // -------------------------------------------------------------------------
  describe('корректный XML', () => {
    it('возвращает не-null для валидного XML', () => {
      expect(parseRaceResults(makeXml())).not.toBeNull();
    });

    it('правильно парсит venue', () => {
      const result = parseRaceResults(makeXml({ venue: 'Interlagos' }))!;
      expect(result.venue).toBe('Interlagos');
    });

    it('правильно декодирует Unix timestamp в ISO-дату', () => {
      const result = parseRaceResults(makeXml({ dateTime: '0' }))!;
      expect(result.dateTimeIso).toBe('1970-01-01T00:00:00.000Z');
    });

    it('парсит TimeString если DateTime отсутствует', () => {
      const xml = makeXml().replace('<DateTime>1752505200</DateTime>', '<TimeString>2026/07/14 15:00:00</TimeString>');
      const result = parseRaceResults(xml)!;
      expect(result.dateTimeIso).toContain('2026-07-14');
    });

    it('trackLengthM парсится корректно', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.trackLengthM).toBe(13626.0);
    });

    it('gameVersion передаётся из XML', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.gameVersion).toBe('2.00');
    });
  });

  // -------------------------------------------------------------------------
  // Пилоты
  // -------------------------------------------------------------------------
  describe('парсинг пилотов', () => {
    it('возвращает одного пилота', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.drivers).toHaveLength(1);
    });

    it('isPlayer = true для тега isPlayer=1', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.drivers[0].isPlayer).toBe(true);
    });

    it('парсит имя пилота', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.drivers[0].name).toBe('Max Verstappen');
    });

    it('парсит carClass', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.drivers[0].carClass).toBe('Hypercar');
    });

    it('bestLapMs конвертируется в миллисекунды', () => {
      const result = parseRaceResults(makeXml())!;
      // 101.9073 секунды -> Math.round(101.9073 * 1000) = 101907
      expect(result.drivers[0].bestLapMs).toBe(101907);
    });

    it('pitstops считается правильно', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.drivers[0].pitstops).toBe(2);
    });

    it('пустой Name возвращает null из parseDriverBlock (driver не добавляется)', () => {
      const driversXml = `<Driver><Position>1</Position><CarClass>LMP2</CarClass></Driver>`;
      const result = parseRaceResults(makeXml({ drivers: driversXml }));
      expect(result).toBeNull(); // нет пилотов => null
    });
  });

  // -------------------------------------------------------------------------
  // Круги
  // -------------------------------------------------------------------------
  describe('парсинг кругов (lapList)', () => {
    it('два круга возвращаются в lapList', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.drivers[0].lapList).toHaveLength(2);
    });

    it('первый круг: правильные секторы', () => {
      const result = parseRaceResults(makeXml())!;
      const lap = result.drivers[0].lapList[0];
      expect(lap.s1Ms).toBe(27440); // 27.44 * 1000
      expect(lap.s2Ms).toBe(51670);
      expect(lap.s3Ms).toBe(22780);
    });

    it('первый круг: lapMs правильно конвертирован', () => {
      const result = parseRaceResults(makeXml())!;
      const lap = result.drivers[0].lapList[0];
      expect(lap.lapMs).toBe(101890);
    });

    it('второй круг помечен как питстоп', () => {
      const result = parseRaceResults(makeXml())!;
      const lap = result.drivers[0].lapList[1];
      expect(lap.isPit).toBe(true);
    });

    it('первый круг НЕ помечен как питстоп', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.drivers[0].lapList[0].isPit).toBe(false);
    });

    it('служебный тег «--» конвертируется в null', () => {
      const driversXml = `<Driver>
  <Name>Test Driver</Name>
  <isPlayer>0</isPlayer>
  <Position>2</Position>
  <ClassPosition>2</ClassPosition>
  <CarClass>LMP2</CarClass>
  <CarType>Oreca 07</CarType>
  <TeamName>Team B</TeamName>
  <Laps>1</Laps>
  <Pitstops>0</Pitstops>
  <BestLapTime>--.----</BestLapTime>
  <Lap num="1" s1="--.----" s2="51.00" s3="22.00">--.----</Lap>
</Driver>`;
      const result = parseRaceResults(makeXml({ drivers: driversXml }))!;
      const driver = result.drivers[0];
      expect(driver.bestLapMs).toBeNull();
      expect(driver.lapList[0].lapMs).toBeNull();
      expect(driver.lapList[0].s1Ms).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Определение типа сессии
  // -------------------------------------------------------------------------
  describe('detectSessionType', () => {
    it('Race -> sessionType содержит «Гонка»', () => {
      const result = parseRaceResults(makeXml({ sessionTag: 'Race' }))!;
      expect(result.sessionType).toContain('Гонка');
    });

    it('Practice1 -> sessionType содержит «Практика»', () => {
      const result = parseRaceResults(makeXml({ sessionTag: 'Practice1' }))!;
      expect(result.sessionType).toContain('Практика');
    });

    it('Qualify -> sessionType содержит «Квалификация»', () => {
      const result = parseRaceResults(makeXml({ sessionTag: 'Qualify' }))!;
      expect(result.sessionType).toContain('Квалификация');
    });

    it('Warmup -> sessionType содержит «Прогрев»', () => {
      const result = parseRaceResults(makeXml({ sessionTag: 'Warmup' }))!;
      expect(result.sessionType).toContain('Прогрев');
    });
  });

  // -------------------------------------------------------------------------
  // Граничные случаи / невалидный ввод
  // -------------------------------------------------------------------------
  describe('граничные случаи', () => {
    it('бросает UNSUPPORTED_LOG_VERSION для пустой строки (#7 — версия не определена)', () => {
      expect(() => parseRaceResults('')).toThrow();
      let error: (Error & { code?: string }) | undefined;
      try {
        parseRaceResults('');
      } catch (e) {
        error = e as Error & { code?: string };
      }
      expect(error?.code).toBe('UNSUPPORTED_LOG_VERSION');
    });

    it('бросает UNSUPPORTED_LOG_VERSION для произвольного текста без маркеров LMU/rFactor', () => {
      expect(() => parseRaceResults('<html><body>Hello</body></html>')).toThrow();
      let error: (Error & { code?: string }) | undefined;
      try {
        parseRaceResults('<html><body>Hello</body></html>');
      } catch (e) {
        error = e as Error & { code?: string };
      }
      expect(error?.code).toBe('UNSUPPORTED_LOG_VERSION');
    });

    it('возвращает null если нет ни одного валидного <Driver>', () => {
      const xml = makeXml({ drivers: '' });
      expect(parseRaceResults(xml)).toBeNull();
    });

    it('TrackVenue fallback — берётся TrackCourse если нет TrackVenue', () => {
      const xml = makeXml().replace('<TrackVenue>Le Mans</TrackVenue>', '<TrackCourse>Spa-Francorchamps</TrackCourse>');
      const result = parseRaceResults(xml)!;
      expect(result.venue).toBe('Spa-Francorchamps');
    });

    it('trackLengthM = null при отсутствии TrackLength', () => {
      const xml = makeXml().replace('<TrackLength>13626.0</TrackLength>', '');
      const result = parseRaceResults(xml)!;
      expect(result.trackLengthM).toBeNull();
    });

    it('event — берётся значение TrackEvent, если оно задано', () => {
      const result = parseRaceResults(makeXml())!;
      expect(result.event).toBe('6 Hours of Le Mans');
    });

    it('event fallback — берётся venue, если тега TrackEvent нет вовсе', () => {
      const xml = makeXml().replace('<TrackEvent>6 Hours of Le Mans</TrackEvent>', '');
      const result = parseRaceResults(xml)!;
      expect(result.event).toBe(result.venue);
    });

    it('event fallback — берётся venue, если TrackEvent присутствует, но пуст', () => {
      const xml = makeXml().replace('<TrackEvent>6 Hours of Le Mans</TrackEvent>', '<TrackEvent></TrackEvent>');
      const result = parseRaceResults(xml)!;
      expect(result.event).toBe(result.venue);
    });
  });

  // -------------------------------------------------------------------------
  // Несколько пилотов
  // -------------------------------------------------------------------------
  describe('несколько пилотов', () => {
    it('парсит двух пилотов', () => {
      const driversXml = `<Driver>
  <Name>Пилот Альфа</Name><isPlayer>1</isPlayer><Position>1</Position>
  <ClassPosition>1</ClassPosition><CarClass>Hypercar</CarClass>
  <CarType>Ferrari 499P</CarType><TeamName>Ferrari</TeamName>
  <Laps>10</Laps><Pitstops>0</Pitstops><BestLapTime>101.000</BestLapTime>
  <Lap num="1" s1="25.0" s2="50.0" s3="26.0">101.000</Lap>
</Driver>
<Driver>
  <Name>Пилот Бета</Name><isPlayer>0</isPlayer><Position>2</Position>
  <ClassPosition>2</ClassPosition><CarClass>Hypercar</CarClass>
  <CarType>Porsche 963</CarType><TeamName>Porsche</TeamName>
  <Laps>10</Laps><Pitstops>1</Pitstops><BestLapTime>102.500</BestLapTime>
  <Lap num="1" s1="26.0" s2="51.5" s3="25.0">102.500</Lap>
</Driver>`;
      const result = parseRaceResults(makeXml({ drivers: driversXml }))!;
      expect(result.drivers).toHaveLength(2);
      expect(result.drivers[0].name).toBe('Пилот Альфа');
      expect(result.drivers[1].name).toBe('Пилот Бета');
    });
  });

  // -------------------------------------------------------------------------
  // #123 — миграция на fast-xml-parser: CDATA, экранированные символы,
  // вложенные одноимённые теги
  // -------------------------------------------------------------------------
  describe('fast-xml-parser: граничные случаи (#123)', () => {
    it('поддерживает CDATA в имени пилота', () => {
      const driversXml = `<Driver>
  <Name><![CDATA[Team & Racing "Alpha"]]></Name>
  <isPlayer>0</isPlayer><Position>1</Position><ClassPosition>1</ClassPosition>
  <CarClass>LMP2</CarClass><CarType>Oreca 07</CarType><TeamName>Team B</TeamName>
  <Laps>1</Laps><Pitstops>0</Pitstops><BestLapTime>101.000</BestLapTime>
  <Lap num="1" s1="25.0" s2="50.0" s3="26.0">101.000</Lap>
</Driver>`;
      const result = parseRaceResults(makeXml({ drivers: driversXml }))!;
      expect(result.drivers[0].name).toBe('Team & Racing "Alpha"');
    });

    it('корректно декодирует экранированные спецсимволы (&amp; &lt; &gt; &quot; &apos;)', () => {
      const driversXml = `<Driver>
  <Name>Test Driver</Name>
  <isPlayer>0</isPlayer><Position>1</Position><ClassPosition>1</ClassPosition>
  <CarClass>LMP2</CarClass><CarType>Oreca 07</CarType>
  <TeamName>M&amp;M Racing &lt;Pro&gt; &quot;Team&quot; &apos;X&apos;</TeamName>
  <Laps>1</Laps><Pitstops>0</Pitstops><BestLapTime>101.000</BestLapTime>
  <Lap num="1" s1="25.0" s2="50.0" s3="26.0">101.000</Lap>
</Driver>`;
      const result = parseRaceResults(makeXml({ drivers: driversXml }))!;
      expect(result.drivers[0].teamName).toBe(`M&M Racing <Pro> "Team" 'X'`);
    });

    it('различает <Name> во вложенных одноимённых тегах <Sector>, не смешивая их', () => {
      const stream = `<Stream>
    <Sector et="10" lap="1" s="1"><Name>Пилот А</Name><CarClass>Hypercar</CarClass></Sector>
    <Sector et="20" lap="1" s="2"><Name>Пилот Б</Name><CarClass>LMP2</CarClass></Sector>
  </Stream>`;
      const result = parseRaceResults(makeXml({ stream }))!;
      expect(result.sectorBests).toHaveLength(2);
      expect(result.sectorBests[0].driverName).toBe('Пилот А');
      expect(result.sectorBests[0].carClass).toBe('Hypercar');
      expect(result.sectorBests[1].driverName).toBe('Пилот Б');
      expect(result.sectorBests[1].carClass).toBe('LMP2');
    });

    it('парсит два вложенных <Name> в <Incident> как driverName/targetDriverName', () => {
      const stream = `<Stream>
    <Incident et="15.5" severity="3"><Name>Пилот А</Name><Name>Пилот Б</Name></Incident>
  </Stream>`;
      const result = parseRaceResults(makeXml({ stream }))!;
      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0].driverName).toBe('Пилот А');
      expect(result.incidents[0].targetDriverName).toBe('Пилот Б');
      expect(result.incidents[0].severity).toBe(3);
      expect(result.incidents[0].isImmovable).toBe(false);
    });

    it('находит <Stream>, даже если он вложен внутрь тега сессии, а не является прямым потомком <RaceResults>', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rFactorXML>
  <RaceResults>
    <TrackVenue>Le Mans</TrackVenue>
    <DateTime>1752505200</DateTime>
    <Practice1>
      <Stream>
        <Incident et="15.5" severity="3"><Name>Пилот А</Name><Name>Пилот Б</Name></Incident>
      </Stream>
      <Driver>
        <Name>Пилот А</Name>
        <isPlayer>1</isPlayer><Position>1</Position><ClassPosition>1</ClassPosition>
        <CarClass>GT3</CarClass><CarType>Porsche 911</CarType><TeamName>Team A</TeamName>
        <Laps>1</Laps><Pitstops>0</Pitstops><BestLapTime>101.000</BestLapTime>
        <Lap num="1" s1="25.0" s2="50.0" s3="26.0">101.000</Lap>
      </Driver>
    </Practice1>
  </RaceResults>
</rFactorXML>`;
      const result = parseRaceResults(xml)!;
      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0].driverName).toBe('Пилот А');
      expect(result.incidents[0].targetDriverName).toBe('Пилот Б');
    });

    it('инцидент с <Immovable/> не имеет targetDriverName', () => {
      const stream = `<Stream>
    <Incident et="5" severity="1"><Name>Пилот В</Name><Immovable/></Incident>
  </Stream>`;
      const result = parseRaceResults(makeXml({ stream }))!;
      expect(result.incidents[0].isImmovable).toBe(true);
      expect(result.incidents[0].targetDriverName).toBeNull();
    });

    it('не путает несколько разных <Driver> с одинаковыми вложенными тегами', () => {
      const driversXml = `<Driver>
  <Name>Alpha</Name><isPlayer>1</isPlayer><Position>1</Position><ClassPosition>1</ClassPosition>
  <CarClass>Hypercar</CarClass><CarType>Ferrari 499P</CarType><TeamName>Ferrari</TeamName>
  <Laps>5</Laps><Pitstops>0</Pitstops><BestLapTime>101.000</BestLapTime>
  <Lap num="1" s1="25.0" s2="50.0" s3="26.0">101.000</Lap>
</Driver>
<Driver>
  <Name>Beta</Name><isPlayer>0</isPlayer><Position>2</Position><ClassPosition>2</ClassPosition>
  <CarClass>Hypercar</CarClass><CarType>Porsche 963</CarType><TeamName>Porsche</TeamName>
  <Laps>5</Laps><Pitstops>1</Pitstops><BestLapTime>102.500</BestLapTime>
  <Lap num="1" s1="26.0" s2="51.5" s3="25.0">102.500</Lap>
</Driver>`;
      const result = parseRaceResults(makeXml({ drivers: driversXml }))!;
      expect(result.drivers[0].lapList[0].s1Ms).toBe(25000);
      expect(result.drivers[1].lapList[0].s1Ms).toBe(26000);
    });
  });
});
