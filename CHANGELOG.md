# Changelog

Все значимые изменения в этом проекте документируются в данном файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

Начиная с версии после 1.0.0 версия и этот файл формируются автоматически
через [semantic-release](https://semantic-release.gitbook.io/) на основе
[Conventional Commits](https://www.conventionalcommits.org/ru/) — см. раздел
«Версионирование и релизы» в [CONTRIBUTING.md](CONTRIBUTING.md).

---

## [1.9.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.8.1...v1.9.0) (2026-08-05)

### Added

* показать какие DLC уже входят в подписку Season Pass/Track Pass ([#197](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/197)) ([b7a9a5c](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/b7a9a5c00b1e3fc5978556678efce106346d2d08))

## [1.8.1](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.8.0...v1.8.1) (2026-08-05)

### Fixed

* Season Pass/Track Pass — это подписка на DLC сезона, а не отдельный контент ([#196](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/196)) ([c9d66f0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/c9d66f0c492dd062973b294b57fd5e029e66f897))

## [1.8.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.7.0...v1.8.0) (2026-08-05)

### Added

* заполнить состав игры и DLC LMU Steam реальными данными из открытых источников ([#195](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/195)) ([24b7150](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/24b71509b9ce0b6a2dda5b773fa4b249e1cca7cf))

## [1.7.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.6.0...v1.7.0) (2026-08-04)

### Added

* добавить вкладку LMU Steam с игрой и DLC из Steam Store API ([#194](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/194)) ([4573dc6](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/4573dc64b344ec2292c7343f74c1202f81bdc92c))

## [1.6.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.5.0...v1.6.0) (2026-07-30)

### Added

* полноэкранный макет страницы телеметрии по мокапу вместо стека карточек ([#193](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/193)) ([4139cb4](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/4139cb49d5f23564a77c3fefc6ac7e2d5b98a786))

## [1.5.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.4.2...v1.5.0) (2026-07-30)

### Added

* переключатель схема/спутник и сравнение с эталонным кругом на телеметрии ([#192](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/192)) ([989cf82](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/989cf820045d6932bab979b88378393d9639e0e6))

## [1.4.2](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.4.1...v1.4.2) (2026-07-30)

### Fixed

* исправить некорректный YAML frontmatter в файлах правил ([#191](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/191)) ([2b63e90](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/2b63e901b36b614ad1849cf426652f56de5c5dc9))

## [1.4.1](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.4.0...v1.4.1) (2026-07-30)

### Fixed

* **ci:** собирать Docker-образ из коммита релиза, а не из pre-release SHA ([#190](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/190)) ([b2e922e](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/b2e922e9a3311adad5b5e1979d37c32a5fee99c1))

## [1.4.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.3.2...v1.4.0) (2026-07-30)

### Added

* показать версию приложения в подвале бокового меню ([#189](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/189)) ([747a99c](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/747a99c4084b1938b5661f1c34cb3a4bff1c80b3))

## [1.3.2](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.3.1...v1.3.2) (2026-07-30)

### Fixed

* **sessions:** колонка «Классы» подстраивается под контент, не шире 170px ([#187](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/187)) ([f25acf4](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/f25acf41bc0c581ea364f03467721c9980a30486))

## [1.3.1](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.3.0...v1.3.1) (2026-07-30)

### Fixed

* **session-detail:** оптимизировать ширину колонок таблицы «Результаты» ([#186](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/186)) ([0620e57](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/0620e5749f9bbd9b6f3e64bb148a767928e4f54d))

## [1.3.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.2.2...v1.3.0) (2026-07-30)

### Added

* **session-detail:** добавить колонку «Время на треке» в таблицу результатов ([#185](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/185)) ([f9bb34b](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/f9bb34b14648479b6cf9f5c75b04dd23d6af1821))

### Changed

* **events:** вынести запросы Special Events в lib/api.ts ([004e0f6](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/004e0f64cc58b9c67697347118fb7bb27f6f026b))

### Docs

* fix stale demo-data note and broken doc links ([eedd212](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/eedd2129ebda64a79352a7c269f2aa3d66848e65))
* fix stale demo-data note and remove superseded docs ([889a157](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/889a1571e63218d5db2f3db4afe5132f12a01eef))
* remove demo-data explanatory line from README ([d80c0f3](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/d80c0f317ca778fce3507ecc4951fec1b403643a))
* rename demo link to live instance in README ([bb43de3](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/bb43de39dc01f8088c00e375fd646909ad92d0c0))
* обновить REQUIREMENTS.md — устаревшая информация о бейджах классов ([0a5f3c9](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/0a5f3c9b2860b9e0c367d331b42531cd68584740)), closes [#179](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/179) [-#181](https://github.com/-/issues/181)

## [1.2.2](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.2.1...v1.2.2) (2026-07-29)

### Fixed

* **events:** унифицировать текст LMP2-бейджей на Events, как и везде ([653f25b](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/653f25b1dbb3a5a96f6aafec2f5ca39d9df5f02d))

## [1.2.1](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.2.0...v1.2.1) (2026-07-29)

### Changed

* **classStyles:** вынести бейдж класса машины в один компонент CarClassBadge ([8760084](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/8760084c84e40a02738a188b72f00049d436806c))

### Fixed

* **classStyles:** унифицировать и текст бейджей классов, не только цвет ([5e06b48](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/5e06b4831c298386677e749d769549c66ef11644))

## [1.2.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.1.2...v1.2.0) (2026-07-29)

### Added

* **classStyles:** унифицировать бейджи классов авто по стандарту FIA WEC ([745fc1e](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/745fc1e34d98c16cc6a7336130b79de88a0b9b29))

### Docs

* закрепить в CLAUDE.md обязательное форматирование Prettier перед коммитом ([d8f4050](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/d8f405081d8e1ae4ecc86bb7a9e7fb960ebfce9b))

## [1.1.2](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.1.1...v1.1.2) (2026-07-29)

### Fixed

* применить форматирование Prettier к DriverFilterBar ([0d13798](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/0d137984330daac64e4152dfd03bd0af4496c388)), closes [#176](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/176)

## [1.1.1](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.1.0...v1.1.1) (2026-07-29)

### Fixed

* **activity-tile:** не давать плиткам активности сливаться на мобильных ([67916fc](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/67916fc49fd770c3ed72dc60e357d251dca233a3))
* **driver-filter:** не давать выпадашке выбора пилота улетать за экран на мобильных ([369511c](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/369511c9cece7245091502e3a153cd2cfe04a5bc))

## [1.1.0](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.0.4...v1.1.0) (2026-07-29)

### Added

* добавить трассу Daytona International Speedway ([#174](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/174)) ([2eed6cb](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/2eed6cb84c51bd3bfbf3e4e1b60a9335d591d2d8))

### Fixed

* **release:** не давать angular-пресету рендерить H1 для minor/major-релизов ([#175](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/175)) ([c296290](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/c29629052b1c7bab4abf07be361d9aa379d649c4)), closes [#174](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/174)

## [1.0.4](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.0.3...v1.0.4) (2026-07-28)

### Fixed

* **events:** не переносить недавно прошедшее событие на год вперёд ([afc9264](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/afc9264a01b57ecffd9dfceb9037628249dccb0b))

## [1.0.3](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.0.2...v1.0.3) (2026-07-28)

### Fixed

* **docs:** добавить ссылку на демо и нормализовать CHANGELOG.md ([4f8a942](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/4f8a9427629dd6a8578c4731484a389ef1f18558))

## [1.0.2](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.0.1...v1.0.2) (2026-07-28)

### Fixed

* **release:** починить содержимое release notes и позицию секции в CHANGELOG ([#169](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/169)) ([3cb4dca](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/3cb4dcab7c00bae94776e585a7ea9dbab867444d))

## [1.0.1](https://github.com/vakalistratov86/lmu-laptimes-dashboard/compare/v1.0.0...v1.0.1) (2026-07-28)

### Fixed

* **events:** распознавать Special Events по видимому тексту, а не сырому HTML ([#168](https://github.com/vakalistratov86/lmu-laptimes-dashboard/issues/168)) ([8fa4d33](https://github.com/vakalistratov86/lmu-laptimes-dashboard/commit/8fa4d33301abff2a16d4415f78d03690af28cd61))

## [Unreleased]

## [1.0.0] — 2026-07-28

Первый версионированный релиз: фиксирует фактическое состояние проекта на
момент введения версионирования (semantic-release + git-теги). Ниже —
всё, что было сделано после `0.1.0` и до сих пор копилось в `Unreleased`.

### Added

* **Командные гонки со сменой пилота** — LMU пишет `<Swap>`/`<DriverChange>` в лог при смене пилота за рулём общей машины (эндуранс-заезды); теперь это парсится и корректно атрибутируется по реальным людям, а не по одному "зачётному" пилоту машины
  * `server/logParser.ts`: `<Swap startLap endLap>Имя</Swap>` → список стинтов на машину (синтетический единственный стинт для машин без свопа, чтобы downstream-код не знал отдельной ветки); `<DriverChange et="...">` из `Stream` сопоставляется с границами стинтов по именам Old/New, даёт точное время смены в секундах
  * `server/importWorker.ts`: на каждого реального пилота машины — своя строка `session_results` с пересчитанными по факту `laps`/`pitstops`/`best_lap_ms` (машинные `<Laps>`/`<Pitstops>`/`<BestLapTime>` — агрегаты по машине целиком, включая круги со-пилота, им не доверяем); `session_laps`/`lap_times` резолвятся по `driverId` нужного стинта конкретного круга, а не одного credited-пилота на всю машину
  * Схема: `sessions.has_co_drivers` (флаг командной гонки), `session_results.stint_start_lap`/`stint_end_lap`/`stint_start_sec`/`stint_end_sec` (диапазон стинта пилота, `null` для сольной машины) — новые nullable-колонки без миграций
  * `sessions.driver_count` теперь считает различных реальных пилотов, а не число машин (блоков `<Driver>`) в логе
  * Список **Sessions**: новая колонка «Тип гонки» (бейдж «Соло»/«Команда» по `has_co_drivers`), сразу после переименованной «Тип сессии»
  * **Session Detail**: для командных гонок таблица «Результаты» группируется по машине (не по пилоту) с суммарной статистикой (Σ кругов, Σ пит-стопов, минимальный лучший круг среди пилотов машины); карточка деталей показывает только лучший результат команды в целом; вкладка «Круги» — новый столбец «Пилот», показывающий, кто вёл машину на каждом конкретном круге (только когда у машины больше одного реального пилота за сессию); вкладка «Прогресс» — одна линия на машину вместо нескольких перекрывающихся отрезков по пилотам
  * Таблица «Результаты»: колонка «Команда / машина» разделена на отдельные «Команда» и «Авто», добавлены в порядок Поз. → Пилот → Команда → Класс → Авто → Статус → Кругов → Пит → Лучший круг → Отставание
* **Спутниковая карта трассы с зумом** на странице Telemetry Detail (`client/src/components/telemetry-detail/SatelliteTrackMap.tsx`) — для откалиброванных трасс (пока только Spa-Francorchamps) траектория круга рисуется поверх реального спутникового снимка (мозаика тайлов Esri World Imagery) вместо схематичной SVG-проекции, с зумом (колесо/кнопки, потолок 24x) и паном. Калибровка (`client/src/lib/trackMapCalibration.ts`) двухэтапная: аффинное преобразование «fake GPS» канала телеметрии (координаты вне реального местоположения трассы) в настоящие GPS, подобранное сопоставлением реального круга с осевой линией трассы из OSM, затем точная проекция Web Mercator в пиксели снимка. Трассы без калибровки используют прежний SVG-фолбэк (`telemetryGeo.ts`), поведение не изменилось
  * Траектория красится по скорости в каждой точке (зелёный → жёлтый → красный, от медленного к быстрому); для каждого поворота — подписи максимальной скорости перед поворотом и минимальной в апексе, найденные zig-zag-детектором экстремумов по сглаженному (по дистанции круга) профилю скорости (`client/src/lib/telemetrySpeed.ts`); близкие метки (< 40м по дистанции) дедуплицируются, остаётся более выраженная
  * Курсор — зелёная треугольная стрелка по направлению движения; старт/финиш — черта поперёк полотна трассы; направление стрелки/старт-финиша считается по широкому окну соседних GPS-точек, а не по одному соседнему сэмплу (убирает шум и неточный угол)

### Fixed

* **Импорт логов падал в проде после деплоя командных гонок** — `Build & Deploy` (`.github/workflows/deploy.yml`) пересобирает и перезапускает контейнер `lmu-dashboard`, но никогда не применял изменения `shared/schema.ts` к продовой БД (в репозитории нет versioned-миграций, только `drizzle-kit push`, который раньше нужно было катить вручную — см. комментарий в `Dockerfile`). После мержа команды-гонок в проде не оказалось колонок `sessions.has_co_drivers`/`session_results.stint_*`, и любой `POST /api/import` падал на первом же запросе к `sessions` с `PostgresError: column "has_co_drivers" does not exist`. Данные в проде дочинены вручную (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, аддитивные nullable-колонки, без потери данных); сам workflow теперь шагом `docker compose run --rm dashboard npx drizzle-kit push --force` применяет схему нового образа к БД **до** переключения на него — окно 500-к по новым колонкам больше не возникает
* **Кривой формат времени сектора/круга из-за погрешности float** — `sessionDetailSelectors.ts` парсил время в секунды (мс/1000), а перед форматированием умножал обратно на 1000; на части значений round-trip даёт нецелый мс (`51669.999999999996` вместо `51670`), из-за чего сектор мог отрисоваться как «439.99999999999994» вместо «440». Файл переведён на хранение времени в миллисекундах от парсинга до форматирования (`parseLapMs`/`parseSectorMs`) — round-trip как класс бага больше невозможен. Заодно `formatLap`/`formatSector` (`client/src/lib/format.ts`) теперь сами проверяют невалidное значение (`NaN`/`Infinity`/`<=0`) и рисуют «—», а не полагаются на каждое место вызова — голый вызов с `Infinity` (сектор, который пилот ни разу не проехал) раньше рисовал «Infinity.NaN»
* **Круги на вкладке Телеметрии показывались как «123.2s»** вместо привычного формата времени — `TelemetryLapPicker.tsx` использовал собственный форматтер (`lap.durationSec.toFixed(1) + "s"`), не связанный с логом сессии; переведён на общий `formatLap`. Круги на этой вкладке также нумеровались с 0 (аутлап) — теперь отображаются с 1, как и на вкладке Сессии (сырой `lapNumber`-идентификатор для API-запросов/сравнения не менялся)
* **Личные рекорды/лидерборды портились чужими кругами в командных гонках** — до этого фикса весь заезд (включая лучший круг) приписывался одному "зачётному" пилоту машины; на реальном логе подтверждено: чужой лучший круг был записан как личный рекорд другого человека, а сам со-пилот не существовал в БД ни как пилот, ни как круги — его `<TrackLimits>`/`<Incident>` в Stream молча падали в DLQ как «неизвестный пилот» (чинится тем же фиксом, что и основная атрибуция, — все реальные имена стинтов теперь заранее регистрируются как пилоты)
* **Со-пилот в командной гонке всегда показывался ИИ** — при разбиении на реальных пилотов машинный `<isPlayer>` (один флаг на всю машину, относится только к "зачётному" пилоту) присваивался только ему, остальным со-пилотам жёстко проставлялся `0`. Участие в `<Swap>` само по себе доказательство реального человека (ИИ не "сменяют" по имени) — подтверждено на логе: `<ControlAndAids>` машины содержит `PlayerControl` на весь диапазон кругов, включая стинт со-пилота. Теперь все реальные со-пилоты машины со сменой получают `isPlayer=1`; сольные машины не затронуты
  * Уточнение атрибуции: изначально "машина со сменой" определялась в `importWorker.ts` по количеству стинтов (`stints.length === 1`) — этот подсчёт неотличим от машины с ровно ОДНИМ реальным `<Swap>`-тегом (стинтов тоже 1), из-за чего со-пилот с единственным `<Swap>`, чьё имя не совпадало с "зачётным" `<Name>` машины, всё ещё мог получить `isPlayer=0`. `server/logParser.ts` теперь явно возвращает флаг `hasExplicitSwap` (был ли в XML хотя бы один валидный `<Swap>`, вычисляется ДО синтеза fallback-стинта для сольных машин) — `importWorker.ts` использует его вместо подсчёта стинтов, что устраняет и этот пограничный случай
  * Добавлена defensive-проверка: если для сольной машины (`hasExplicitSwap=false`) `<isPlayer>` говорит "ИИ", а `control_and_aids` содержит `PlayerControl` — те же самые признаки ненадёжности машинного `<isPlayer>`, что уже подтверждены на командных гонках, — в лог сервера пишется предупреждение (`[importWorker] isPlayer=0 из <isPlayer>, но ControlAndAids содержит PlayerControl`) без автоматического переопределения значения
* **`docs-lint` (markdownlint) падал в CI на каждом прогоне** — линтер работал без конфига, на чистых дефолтах: `MD013` (лимит строки 80 символов) и `MD024` (дубли заголовков) конфликтовали с осознанным стилем документации проекта (длинные строки-абзацы, повторяющиеся `### Added`/`### Fixed` в каждом блоке CHANGELOG.md). Добавлен `.markdownlint.jsonc`, отключающий именно эти два правила; остальные ~30 настоящих огрехов разметки (пропущенные пустые строки вокруг заголовков/списков, code-блоки без языка, пустая строка в blockquote) исправлены точечно
* **`server/vite.ts`: HMR-конфигурация и `allowedHosts` дев-сервера Vite не применялись** — переменная `serverOptions` (с `hmr: { server, path: "/vite-hmr" }` и `allowedHosts: true`) была объявлена, но ни разу не передавалась в `createViteServer()`; вместо неё использовался отдельный неполный инлайн-объект `{ middlewareMode: true }`. Обнаружено при чистке ESLint-предупреждений (`serverOptions` числился неиспользуемым) — теперь `createViteServer()` реально получает `serverOptions`

### Changed

* Форматирование кругового/секторного времени унифицировано на всё приложение — `sessionDetailSelectors.ts` убрал собственный дубль `formatLapMs`/`formatLapTime` (отличался выводом для времени короче минуты) в пользу общих `formatLap`/`formatSector` из `client/src/lib/format.ts`
* Устранена вся ESLint-задолженность (26 предупреждений → 0): удалён мёртвый код (`TrackMap.tsx#PATHS`, неиспользуемые импорты в `server/migrate.ts`/`importWorker.ts`/тестах), убран неиспользуемый параметр `rawContent` из `assertSupportedVersion()` в `shared/validators.ts`, устаревшие `eslint-disable`-комментарии на уже глобально выключенном `no-explicit-any` заменены/убраны, намеренно отброшенные поля в `tests/schema.test.ts` (паттерн `const { x, ...rest } = obj`) переименованы в `x: _x`
* `server/migrate.ts` — убраны мёртвые импорты drizzle-orm migrator (`drizzle`, `migrate`): функция `runMigrations()` никогда не использовала миграционный путь, только фолбэк `CREATE TABLE IF NOT EXISTS`; докстрока, заявлявшая обратное, приведена в соответствие с фактическим поведением

### Added

* **ESLint + Prettier** — `eslint.config.js` (flat config, `typescript-eslint` + `eslint-plugin-react`/`react-hooks`) и `.prettierrc.json`; npm-скрипты `lint`/`lint:fix`/`format`/`format:check`; отдельные джобы ESLint/Prettier в CI (`.github/workflows/lint.yml`); весь репозиторий приведён к единому формату (#125)
* Серверная валидация query/path-параметров REST API через Zod-схемы (`IdParamSchema`, `LapNumberParamSchema`, `PaginationQuerySchema`, `LapsQuerySchema`, `BestLapsQuerySchema` в `shared/validators.ts`) — невалидный `trackId`/`:id`/`limit` и т.п. теперь возвращает `400` с описанием ошибки вместо тихого превращения в `NaN` в SQL-фильтре (#124)

### Changed

* `GET /api/sessions/:id/laps` — обогащение `driverName`/`carNumber`/`isPlayer` перенесено с трёх отдельных запросов + склейки через JS `Map` на один JOIN-запрос (`storage.getSessionLapsEnriched()`), устраняя последнее оставшееся место дублирования enrich-логики кругов/пилотов (#126)
* `server/importWorker.ts` — insert-массивы (`lapTimeRows`/`sessionLapRows`/`dlqRows`/`streamDlqRows`) типизированы через `InsertLapTime`/`InsertSessionLap`/`InsertImportError` из `shared/schema.ts` вместо `any[]`, чтобы рассинхрон со схемой Drizzle ловился на этапе компиляции, а не в рантайме на пути импорта заездов (#127)

### Added

* **Раздел «Телеметрия»** — импорт и просмотр записей телеметрии LMU (`.duckdb`-файлы игры)
  * Страница **Telemetry** — список импортированных записей (пилот, трасса, дата)
  * Страница **Telemetry Detail** — карта трассы по GPS-треку круга (`TelemetryTrackMap`) + график каналов телеметрии с выбором круга, зумом и легендой (`TelemetryChart`, `TelemetryLapPicker`)
  * Загрузка `.duckdb`-файла (до 150 МБ) через раздел **Import**: `POST /api/import/telemetry`, идемпотентность по SHA-256 хэшу содержимого — `server/telemetryImportWorker.ts`, `server/telemetryParser.ts`
  * REST: `GET /api/telemetry/sessions`, `GET /api/telemetry/sessions/:id`, `GET /api/telemetry/sessions/:id/laps`, `GET /api/telemetry/sessions/:id/laps/:lapNumber/series`, `DELETE /api/import/telemetry/all` — `server/telemetryQuery.ts`
  * Новые таблицы БД: `telemetry_import_jobs`, `telemetry_sessions`, `telemetry_channels`, `telemetry_samples`

### Removed

* **Автозаполнение демо-данными убрано** — при пустой БД приложение больше не создаёт фейковые трассы/пилотов/заезды (`seedIfEmpty()` удалена вместе с вызовом при старте сервера). При старте с пустой БД все разделы (Overview/Leaderboards/Tracks/Sessions) показывают пустое состояние с призывом импортировать логи через **Import**
  * Убрана колонка `lap_times.source` (`demo`/`import`) и эндпоинт `DELETE /api/demo` — источник данных теперь всегда «импорт», различать было нечего
  * Убрана статичная плашка «Демо-данные · сезон 2026» из сайдбара
  * Удалён нерабочий legacy-скрипт `script/db-clean.ts` (работал через `better-sqlite3`, был несовместим с текущей БД на PostgreSQL)
  * `README.md`/`docs/database-schema.md` приведены в соответствие: больше не описывают демо-заполнение как поведение по умолчанию

### Added

* **Мультиязычность (i18n): русская и английская версии приложения**
  * Переключатель языка RU/EN в правом верхнем углу шапки (`AppLayout.tsx`), рядом с переключателем темы
  * Собственная (без внешних библиотек) инфраструктура перевода `client/src/lib/i18n.tsx`: React-контекст `LanguageProvider`/`useLanguage()`, плоские dot-path ключи (`t("namespace.key")`) с подстановкой переменных `{{var}}`, склонение числительных для русского языка (`tn()` — 1/2-4/5+), typescript-проверка соответствия ключей между `ru` и `en` словарями на этапе компиляции
  * Определение языка по умолчанию: сохранённый выбор в `localStorage`, иначе — язык браузера
  * Переведены все страницы и общие компоненты: Overview, Sessions, Tracks, TrackDetail (включая трек-факты), Leaderboards, Events, Import, SessionDetail и все его подкомпоненты, `DriverFilterBar`, `SessionTypeBadge`, навигация и шапка
  * Даты и время форматируются через `Intl`/`toLocaleDateString` с учётом текущей локали (в том числе русские родительные падежи месяцев) вместо захардкоженных русских массивов месяцев/дней недели
  * Названия стран трасс переводятся на лету (`translateCountry()`) без изменения серверных данных

### Fixed

* **Импорт телеметрии ронял весь сервер на больших `.duckdb`-файлах** (`FATAL ERROR: JavaScript heap out of memory`, весь Node-процесс падал и перезапускался, остальные пользователи получали `502`). Причина — `telemetryParser.ts`/`telemetryImportWorker.ts` дважды материализовали весь набор сэмплов в JS-памяти перед записью в Postgres. Переписано на потоковое чтение через `conn.stream()`/`yieldRowObjectJs()` (`@duckdb/node-api`) с батч-вставкой по `CHUNK_SIZE` — пиковая память процесса больше не зависит от размера файла. Проверено на реальном файле, ронявшем прод (98 каналов, 2 637 082 сэмпла): импорт проходит и локально, и на боевом сервере (961 МБ RAM) без падения, память держится в пределах ~130 МБ
* **`/api/telemetry/sessions/:id/laps` и `/laps/:lapNumber/series` отдавали `499`/`502` на больших сессиях** — `getRecordingEndTs()` в `telemetryQuery.ts` вычитывал в Node `ts` вообще всех сэмплов сессии, чтобы найти максимум вручную; для сессий с миллионами сэмплов это было медленно и памятиёмко. Заменено на `SELECT MAX(ts)` силами Postgres
* **Дедупликация сессий при реконнекте** — при разрыве соединения выделенный сервер LMU пишет НОВЫЙ файл `RaceResults.xml` вместо дополнения старого; при повторной загрузке такого «продолжения» той же сессии (совпадают событие + тип сессии + трасса + пересечение состава пилотов, в пределах ±24ч) более полный дамп теперь заменяет менее полный вместо задвоения строки в `sessions` — новый модуль `server/sessionSupersede.ts`, интегрирован в транзакцию `runImport()`. В журнале импорта на `/import` появился новый уровень «предупреждение» (амбер, иконка треугольника) для случая замены — отличим от обычного зелёного «ok»
* Длительность сессий практики/квалификации (`session_duration_min`, `session_max_laps`, `most_laps_completed`) всегда парсилась как `null` — теги `Minutes`/`Laps`/`MostLapsCompleted` в реальных логах LMU лежат ВНУТРИ тега конкретной сессии (`<Practice1><Minutes>`), а не на верхнем уровне `<RaceResults>`, как ошибочно читал `server/logParser.ts`. Для гонок баг не проявлялся, т.к. `RaceLaps`/`RaceTime` действительно лежат на верхнем уровне
* Суммарное время на плитках «Гонка» (`/sessions`, `/overview`) всегда показывало 0 — для гонок в сумму по ошибке шло `session_duration_min` (заполняется только для практики/квалификации) вместо `race_time_min`
* Инциденты и нарушения трек-лимитов в карточке пилота включали практику/квалификацию наравне с гонкой — теперь показываются только по гоночным сессиям
* Импорт логов мог «обрываться» (переставали обновляться журнал/счётчики, останавливался авто-скан папки), если во время загрузки многих файлов пользователь переходил на другую вкладку приложения — движок импорта (папка, журнал, счётчики, авто-скан, сам цикл импорта) вынесен из компонентов страниц `Import.tsx`/`TelemetryImportPanel.tsx` в провайдеры уровня приложения (`client/src/lib/logImportEngine.tsx`, `client/src/lib/telemetryImportEngine.tsx`), не размонтируемые при навигации между страницами
* Мобильная таблица сессий: колонка «Трек» с чистым `1fr` в контейнере, чья `min-width` была ровно равна сумме остальных фиксированных колонок, схлопывалась в 0 и текст наезжал на соседний заголовок «Классы» — исправлено на `minmax(180px, 1fr)` с пересчитанной `min-width`
* Дата рекорда на странице Leaderboards показывала бессмысленное «12:00 AM»/«00:00» (данные хранятся без времени) — убрано время из форматирования, остаётся только дата
* **Session Detail — полный рефакторинг архитектуры компонентов (SD-1 – SD-14)**
  * Barrel-файл типов `client/src/components/session-detail/types.ts` (SD-1, #32, #46)
  * Доменная view-model `SessionDetailViewModel` в `client/src/lib/sessionDetail.types.ts` (SD-2, #33) — ⚠️ этот файл и `sessionDetail.ts` (SD-4) больше не используются страницей `SessionDetail.tsx` и являются кандидатами на удаление, см. секцию SD-15–SD-21 ниже
  * Селекторы `normalizeSessionType`, `buildHeroStats`, `buildResultRows`, `buildLapProgressSeries`, `buildSectorSummary`, `buildDriverLapGroups` в `sessionDetailSelectors.ts` (SD-3, #34)
  * Функция-агрегатор `buildSessionDetailViewModel` в `client/src/lib/sessionDetail.ts` (SD-4, #35)
  * Компонент `SessionHeader` с кнопкой назад, badge типа сессии, трассой, датой (SD-5, #36) — заменён на `SessionInfoCard` в SD-20
  * Компонент `SessionHeroStats` с KPI-карточками (победитель, fastest lap, круги и т.д.) (SD-6, #37) — заменён на `SessionInfoCard` в SD-20
  * Компонент `SessionResultsTable` + `SessionResultsRow` с медалями топ-3, выделением игрока и управляемыми колонками (SD-7, #38)
  * Компонент `SessionTabs` с поддержкой вкладок results / laps / sectors (SD-8, #39) — набор вкладок сокращён до results / laps / lapProgress в SD-20
  * Компонент `SessionLoadingSkeleton` со скелет-строками и флагами hero/tabs (SD-9, #40)
  * Компонент `SessionEmptyState` для сценариев 404, no laps, no chart data (SD-10, #41)
  * Рефакторинг страницы `pages/SessionDetail.tsx` под новую архитектуру и view-model (SD-11, #42)
  * Компонент `SessionSectorsSummary` со сводкой best-секторов и theoretical best (SD-12, #43) — вкладка «Секторы» окончательно удалена в SD-20, данные по секторам перенесены в карточку пилота
  * Компоненты `DriverLapsAccordion` и `DriverLapTable` для детальных кругов по пилотам (SD-13, #44) — `DriverLapsAccordion` упразднён в SD-20 (аккордеон по всем пилотам стал не нужен), остался только `DriverLapTable`
  * Компонент `SessionLapProgressChart` — график прогрессии кругов по нескольким пилотам (SD-14, #45)
* **Session Detail — дальнейшее развитие и редизайн (SD-15 – SD-21)**
  * Клик по строке в таблице результатов выбирает пилота; вкладки «Круги» и «Секторы» фильтровались по нему (SD-15)
  * Вкладка «Круги» показывает таблицу выбранного пилота напрямую, без раскрытия аккордеона (SD-17)
  * Дополнительные столбцы таблицы кругов: макс. скорость, остаток топлива, износ шин FL/FR/RL/RR, тип шин, отметка пит-лапа (SD-18)
  * Компонент `SessionDriverDetailCard` — вся информация о выбранном пилоте за сессию (результат, класс, команда, лучший/средний/худший круг, отставание, интервал, пит-стопы, макс. скорость, топливо, шины, все три сектора, теоретически лучший круг) плиткой шириной с таблицу результатов (SD-19)
  * Редизайн страницы Session Detail (SD-20): вкладка «Секторы» удалена (данные перенесены в `SessionDriverDetailCard`); вкладки «Результаты / Круги / Прогресс» встроены в шапку общей карточки результатов вместо статичного заголовка «Итоговые результаты»; `SessionDriverDetailCard` больше не закрывается — по умолчанию выбрана позиция 1, карточка видна на всех вкладках постоянно; `SessionHeader` + `SessionHeroStats` заменены единой статичной плиткой `SessionInfoCard` с информацией только о трассе и сессии (без данных пилотов)
  * Раскраска секторов на вкладке «Круги» и в `SessionDriverDetailCard` (SD-21): зелёный — личный лучший сектор пилота за сессию, фиолетовый — абсолютный лучший сектор среди всех пилотов сессии (приоритетнее зелёного); та же логика применена к плитке «Теор. лучший круг»
* Единая нормализация типа сессии `normalizeSessionCategory()` в `classStyles.ts` (тренировка / квалификация / гонка — прогрев, тесты и superpole сведены к этим трём), заменяющая два расходившихся алгоритма; общий компонент `SessionTypeBadge` — одинаковые текст, цвет и фиксированная ширина плашки типа сессии везде, где она отображается (список сессий, карточка сессии)
* Страница Sessions: фильтр по типу сессии объединён в одну сегментированную кнопку вместо отдельных pill-кнопок; добавлена колонка «Классы» (бейджи классов машин, участвовавших в сессии); сводная плитка сверху (количество и суммарное время тренировок/квалификаций/гонок) вместо статичной подписи, оформленная в цветах фильтра
* Общий переиспользуемый компонент `StatTile` для мини-плиток статистики (`SessionInfoCard`, `SessionDriverDetailCard`, сводка на Sessions)
* Единая иконка пилота в компоненте `DriverName`: зелёный человечек — реальный игрок, жёлтый робот — ИИ (вместо текстового бейджа «ИИ»)
* `DriverFilterBar` переработан: список группируется на «Выбрано / Игроки / ИИ», чек-бокс «Скрыть ИИ» заменён на компактный зелёный переключатель «Показать ИИ», добавлен переключатель «Выбрать все» — массовый выбор/снятие всего видимого списка пилотов (`setManyDrivers()` в `driverFilter.tsx`)
* Разные цвета медалей для 1/2/3 места (`getMedalColorClass()`: золото/серебро/бронза)
* Тематизированный скроллбар во всём приложении (тонкий, в цвет темы, вместо системного белого) — light/dark, WebKit и Firefox
* Import: File System Access API для выбора папки логов (с fallback для браузеров без поддержки), автоимпорт новых файлов по таймеру, персистентный журнал импорта и список уже обработанных файлов (localStorage/IndexedDB), пропуск файлов без кругов (ZERO_LAPS) с предупреждением вместо ошибки, кнопка полной очистки БД, эндпоинт `DELETE /api/import/all`
* Overview: KPI-плитки «Пройдено расстояния» и «Кругов пройдено» вместо «Заездов»; всего 8 плиток в две строки
* Sessions: колонка «Кругов» в таблице списка
* Leaderboards: редизайн в вертикальный список полноширинных карточек по трассе с разбивкой по классам машин внутри каждой
* Tracks: карточка трассы расширена — широкий контур карты с амбер-подсветкой
* Страница Sessions переработана в табличный layout (#21)
* Фильтры по типу сессии над таблицей (`Все`, `Тренировка`, `Квалификация`, `Гонка`, ...) (#22)
* Стилизованные badge-и для типов сессий с цветовой схемой (#23, #17)
* Таблица сессий приведена к 4 колонкам: Тип, Трек, Лучший круг, Дата (#24)
* Строки таблицы сессий полностью кликабельны (hover, cursor:pointer, keyboard nav) (#25)
* Сохранение активного фильтра в URL; кнопка «Назад» возвращает в отфильтрованный список (#26)
* Детальный вид сессии: заголовок + таблица результатов как главный блок (#27)
* Финальный набор колонок таблицы результатов с выделением fastest lap и игрока (#28)
* Блок «Круги по пилотам» перенесён ниже основной таблицы как вторичный раздел (#29)
* Loading / empty / no-results состояния для страниц списка и деталей сессий (#30)
* Блок «Интересно» в карточку трассы (`TrackDetail`)
* Раздел Daily Races и Special Events в отдельные секции вкладки Events
* Поле `sessionCourse` в тип `LapTimeEnriched`; обогащение через JOIN с таблицей `sessions` (#3)
* Группировка лидерборда по `trackName + course`
* Измерение `track` в Reports использует `trackName + course`
* Фильтр `sessionCourse` в интерфейс `LapFilter`
* Тесты для JOIN-поведения `getLaps()` в `tests/routes.test.ts`
* Поддержка `TrackCourse` во всех слоях: парсер логов, хранилище, UI (Sessions, SessionDetail, Leaderboards, Reports)
* Чек-бокс «Скрыть ИИ игроков» рядом с выпадающим списком пилотов
* Компонент `DriverName` с AI-бейджем; поле `isPlayer` в `LapTimeEnriched`
* Метка AI для имён пилотов в SessionDetail, Leaderboards, Laps, DriverFilterBar
* Расширена схема БД для хранения всех извлекаемых полей rFactor XML
* Дата и время рекорда в лидерборде
* Замена чипов пилотов на searchable multi-select dropdown
* Общий модуль `classStyles.ts` для стилей классов машин (вынесен из Leaderboards и Laps)
* Стили бейджей LMP3, GT3, GT4 в Laps.tsx

### Changed

* Migrated primary storage from SQLite (better-sqlite3) to PostgreSQL с использованием drizzle-orm + postgres-js.
* Обновлён `server/storage.ts` под асинхронные операции PostgreSQL.
* `server/routes.ts` переведён на async/await и работу с PostgreSQL.
* Добавлен `server/migrate.ts` и авто-запуск миграций при старте сервера.
* Обновлён `drizzle.config.ts` под PostgreSQL.
* Обновлён `docker-compose.yml`: сервис PostgreSQL, healthcheck и проброс портов 3000→5000.
* Доработан `Dockerfile`: генерация миграций drizzle-kit на этапе сборки, использование `app.listen` и привязка к `0.0.0.0`.
* `TrackMap.tsx`: 11 контуров трасс (Spa, Monza, Bahrain, Portimão, Imola, Interlagos, COTA, Silverstone, Barcelona, Paul Ricard, Lusail) переоцифрованы напрямую из GPS-данных (bacinger/f1-circuits) вместо ручной трассировки — устранены неточности контуров; ориентация сменена с «на север» на каноническую (положение минимального ограничивающего прямоугольника, старт/финиш внизу — как на большинстве официальных карт и в анонсах гонок) для всех 14 трасс.
* `Sessions.tsx`: на мобильном (ниже `sm`) текстовая подпись в плитках сводки (Тренировок/Квалификаций/Гонок и время по каждой) скрыта — остаются только иконка и значение; подпись по-прежнему доступна скринридерам (`sr-only`) и полностью видна от `sm` и на десктопе.

### Fixed

* Унификация стилей badge класса машины в `SessionDetail` и `TrackDetail` через `getClassBadgeClass` (#14)
* `SessionDetail.tsx`: захардкоженный GTE-цвет заменён на динамический `getClassBadgeClass` (#14)
* `TrackDetail.tsx`: удалены локальные `CLASS_BADGE` / `getClassBadge()`, дублировавшие `classStyles.ts` (#14)
* Формат даты в Special Events tab (DD.MM.YYYY)
* `formatDate` — убрано время из `toLocaleString`, т.к. дата хранится без временной зоны
* Синтаксические ошибки в тестах (`routes.test.ts`, `schema.test.ts`, `eventsParser.test.ts`)
* Добавлены недостающие тесты для schema и eventsParser
* Исправлено переполнение PostgreSQL integer (22003) для Unix timestamp в миллисекундах: поля `created_at` и `finished_at` таблицы `import_jobs` мигрированы на тип `BIGINT`.
* Упрощена генерация `.env` в CI: использование `printf` вместо heredoc.
* Добавлены проверки docker-compose-конфига и уборка контейнеров в CI.
* Клик по фильтру «Все» на странице Sessions переставал работать после выбора другого фильтра: `navigate()` в hash-роутере wouter не очищал `location.search`, если в целевом URL не было своего query-параметра — исправлено явной очисткой перед навигацией
* Плашка типа сессии в карточке Session Detail красилась неверно и почти всегда попадала в цвет «тренировки»: `normalizeSessionType()` делал точное сравнение строк и не совпадал с реальным форматом бэкенда `«Гонка (Race1)»` — заменено на единый `normalizeSessionCategory()` с подстроковым сравнением
* Красный фон строки реального игрока в таблице результатов сессии убран — строки реальных игроков и ИИ оформлены одинаково, кроме активного выделения выбранной строки
* 1/2/3 место в таблице результатов и в карточке пилота подсвечивались одинаковым цветом медали — исправлено (`getMedalColorClass()`)
* Класс машины «Hyper» (реальные данные сокращают «Hypercar» до «Hyper») не попадал в цветовую карту и отображался серым — добавлен алиас в `classStyles.ts`
* Импорт: файлы без кругов (`ZERO_LAPS`) считались ошибкой импорта, а не пропуском
* Импорт: `NULL`-значения секторов вызывали ошибку записи в `lap_times`
* `TrackMap.tsx`: контур Bahrain Outer Circuit давал неверное положение старт/финиша (маркер стоял в произвольной точке хордовой связки, не совпадающей с реальной линией старта) — контур переоцифрован из тех же GPS-точек, что и Bahrain Grand Prix Circuit, с общим для обеих конфигураций стартом на пит-стрейте
* `TrackMap.tsx`: связка поворотов 4-13 у Bahrain Outer Circuit была нарисована одним неестественно прямым перегоном — заменена стилизованной кривой (левая дуга → правый свип → шикана), как трасса описана в официальном анонсе дебютного заезда на этой конфигурации; итоговая длина ~3547 м по-прежнему совпадает с паспортной (3511-3543 м) в пределах ~1%
* `Overview.tsx`: плашка «Гонок» считала сессии по точному сравнению `sessionType.toLowerCase() === "race"`, а реальное значение в БД — составная строка вида `«Гонка (Race1)»` — счётчик фактически никогда не совпадал; заменено на общий `normalizeSessionCategory()` (тот же нормализатор, что уже используется в Sessions и SessionTypeBadge)
* Мобильная вёрстка — три страницы теряли данные или ломали разметку на узких экранах (проверено на 390px):
  * `Sessions.tsx`: таблица сессий использовала CSS-grid с колонками фиксированной ширины (160+170+140+80+110+24px) без горизонтальной прокрутки — на мобильном она просто обрезалась, и колонки «Трек», «Лучший круг», «Кругов», «Дата» были не видны и недоступны вообще. Контейнер сделан `overflow-x-auto` (таблица по-прежнему таблица на всех экранах, просто листается свайпом вбок на мобильном); сегментированный фильтр типов сессий (Все/Тренировка/Квалификация/Гонка) не помещался по ширине и обрезал последнюю секцию — сделан горизонтально прокручиваемым
  * `Sessions.tsx`: у плиток сводки (Тренировок/Квалификаций/Гонок и время по каждой) иконка была без `shrink-0` — во флекс-строке с длинной подписью («Тренировок», «Квалификаций») она сжималась до нулевой ширины и пропадала, а у короткой «Гонок» — нет, из-за чего плитки выглядели вразнобой (то с иконкой, то без)
  * `Tracks.tsx`: в блоке статистики карточки трассы (Рекорд/Сессий/Кругов) у значения рекорда круга не было `min-w-0`/`truncate` — на узких экранах длинное время круга наезжало текстом поверх соседней ячейки «Сессий»; схема трассы имела фиксированную ширину 144px (`shrink-0`), что на телефоне оставляло критически мало места для текста — уменьшена до 96px на мобильных
  * `Leaderboards.tsx`: колонки «Команда» и «Автомобиль» не были ограничены по ширине — длинные названия команд переносились на 2-3 строки в каждой строке таблицы, раздувая высоту и вытесняя время круга/отставание за пределы экрана; колонки «Команда»/«Автомобиль»/«Дата» скрыты на узких экранах (как уже сделано в `SessionResultsTable`), остальные обрезаются по `max-width` с `truncate`

### Removed

* Вкладки/страницы **Laps** и **Reports** удалены из навигации и роутинга (функциональность заездов доступна через Sessions / Session Detail); часть более старых записей этого CHANGELOG всё ещё упоминает эти страницы как исторический контекст.

### Refactored

* `SessionDetail.tsx` разбит на компонентную архитектуру с view-model слоем (SD-11, #42)
* Вкладка Events разделена на Daily Races и Special Events
* Стили классов машин вынесены в `client/src/lib/classStyles.ts`

### Docs

* README: добавлены бейджи, описание тестов, секция Supabase, полный список скриптов
* README: добавлено примечание об ограничениях LMU Daily Races API
* README: все примечания перемещены в конец документа
* README: обновлён стек БД на PostgreSQL, добавлены секции Docker и DATABASE_URL
* CHANGELOG: задокументирована миграция на PostgreSQL, BIGINT-фикс, CI/Docker изменения
* README: удалена нерелевантная заметка про автодеплой; описаны Overview (8 KPI-плиток), Sessions (сводная плитка, сегментированный фильтр, колонка «Классы»), Session Detail (SD-15–SD-21), Import (FSA, автоимпорт, журнал), актуализирован стек (убран неиспользуемый WebSocket), структура проекта и модель данных (все 11 таблиц PostgreSQL вместо 4)
* CHANGELOG: задокументированы SD-15–SD-21 и вся сопутствующая доработка Sessions/Import/Overview/Leaderboards/Tracks, отмечены устаревшие/заменённые записи в блоке SD-1–SD-14

---

## [0.1.0] — 2026-07-14

### Added

* Первоначальная настройка проекта под Windows
* Базовые страницы: Overview, Laps, Leaderboards, Reports, Tracks, TrackDetail
* Тёмная/светлая тема, адаптивная вёрстка
* Backend: Express 5 + TypeScript, REST API
* База данных: SQLite (better-sqlite3) + Drizzle ORM
* Автоматическое заполнение демо-данными при первом запуске
* Опциональная поддержка Supabase через переменные окружения
* Тестирование: Vitest + coverage-v8
* Конфигурация Vite 7, Tailwind CSS 3, shadcn/ui
