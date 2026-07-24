# Session Detail: дерево файлов и props

Ниже предложена структура для поэтапной реализации редизайна страницы `SessionDetail` в проекте `lmu-laptimes-dashboard`.

## Дерево файлов

```text
client/src/
├─ pages/
│  └─ SessionDetail.tsx
├─ components/
│  ├─ session-detail/
│  │  ├─ SessionHeader.tsx
│  │  ├─ SessionHeroStats.tsx
│  │  ├─ SessionTabs.tsx
│  │  ├─ SessionResultsTable.tsx
│  │  ├─ SessionResultsRow.tsx
│  │  ├─ SessionLapProgressChart.tsx
│  │  ├─ SessionSectorsSummary.tsx
│  │  ├─ DriverLapsAccordion.tsx
│  │  ├─ DriverLapTable.tsx
│  │  ├─ SessionEmptyState.tsx
│  │  ├─ SessionLoadingSkeleton.tsx
│  │  └─ types.ts
│  └─ ui/
│     └─ (используются существующие Card, Badge, Skeleton и др.)
├─ lib/
│  ├─ sessionDetail.ts
│  ├─ sessionDetail.types.ts
│  ├─ sessionDetailSelectors.ts
│  ├─ format.ts
│  └─ classStyles.ts
```

## Роли файлов

### `client/src/pages/SessionDetail.tsx`

Контейнер страницы.

**Ответственность:**

- Получение `id` из route.
- Загрузка `session` через `useSession(id)`.
- Загрузка `laps` через `useSessionLaps(id)`.
- Выбор активной вкладки.
- Сбор `viewModel` через helper из `lib/sessionDetail.ts`.
- Рендер loading / empty / content состояний.

**Минимальные зависимости:**

- `SessionHeader`
- `SessionHeroStats`
- `SessionTabs`
- `SessionResultsTable`
- `SessionLapProgressChart`
- `SessionSectorsSummary`
- `DriverLapsAccordion`
- `SessionEmptyState`
- `SessionLoadingSkeleton`

---

### `client/src/components/session-detail/SessionHeader.tsx`

Верхний блок страницы с breadcrumb и основной идентификацией сессии.

```ts
export interface SessionHeaderProps {
  backHref: string;
  backLabel?: string;
  sessionType: string;
  normalizedSessionType: "race" | "qualify" | "superpole" | "warmup" | "practice";
  trackName: string;
  courseLabel?: string | null;
  dateTimeLabel: string;
  eventName?: string | null;
  subtitle?: string | null;
}
```

**Что рендерит:**

- кнопка назад
- badge типа сессии
- название трассы
- optional course
- дата/время
- event/subtitle строка

---

### `client/src/components/session-detail/SessionHeroStats.tsx`

KPI-герой с набором карточек.

```ts
export interface SessionHeroStatItem {
  id: string;
  label: string;
  value: string;
  hint?: string | null;
  tone?: "default" | "primary" | "success" | "warning";
  icon?: React.ReactNode;
}

export interface SessionHeroStatsProps {
  items: SessionHeroStatItem[];
}
```

**Рекомендуемый состав items:**

- Победитель
- Fastest lap
- Total time / race duration
- Классы
- Пилоты
- Круги

---

### `client/src/components/session-detail/SessionTabs.tsx`

Переключатель секций экрана.

```ts
export type SessionTabKey = "results" | "laps" | "sectors";

export interface SessionTabItem {
  key: SessionTabKey;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface SessionTabsProps {
  items: SessionTabItem[];
  activeTab: SessionTabKey;
  onTabChange: (tab: SessionTabKey) => void;
}
```

---

### `client/src/components/session-detail/SessionResultsTable.tsx`

Основная таблица результатов.

```ts
export interface SessionResultRowView {
  id: number;
  position: number;
  medal?: "gold" | "silver" | "bronze" | null;
  driverName: string;
  isPlayer: boolean;
  team?: string | null;
  car?: string | null;
  carNumber?: string | number | null;
  carClass: string;
  laps: number;
  pitstops?: number | null;
  bestLapLabel: string;
  bestLapMs?: number | null;
  isFastestLap: boolean;
  gapLabel?: string;
  intervalLabel?: string;
}

export interface SessionResultsTableProps {
  rows: SessionResultRowView[];
  fastestLapMs?: number | null;
  showPitColumn?: boolean;
  showIntervalColumn?: boolean;
  showGapColumn?: boolean;
}
```

**Дополнительно:** можно вынести строку в `SessionResultsRow.tsx`, если логика className и responsive-поведения станет объёмной.

---

### `client/src/components/session-detail/SessionResultsRow.tsx`

Опциональный дочерний компонент для одной строки результатов.

```ts
export interface SessionResultsRowProps {
  row: SessionResultRowView;
  showPitColumn?: boolean;
  showIntervalColumn?: boolean;
  showGapColumn?: boolean;
}
```

---

### `client/src/components/session-detail/SessionLapProgressChart.tsx`

График прогрессии кругов.

```ts
export interface LapProgressPoint {
  lapNumber: number;
  lapTimeMs: number;
  lapTimeLabel: string;
  sector1Ms?: number | null;
  sector2Ms?: number | null;
  sector3Ms?: number | null;
}

export interface LapProgressSeries {
  driverName: string;
  carClass: string;
  color: string;
  points: LapProgressPoint[];
  isPlayer?: boolean;
}

export interface SessionLapProgressChartProps {
  series: LapProgressSeries[];
  height?: number;
  highlightedDrivers?: string[];
  onToggleDriver?: (driverName: string) => void;
  emptyLabel?: string;
}
```

**Примечание:** если на первом этапе фильтрация не нужна, `highlightedDrivers` и `onToggleDriver` можно отложить.

---

### `client/src/components/session-detail/SessionSectorsSummary.tsx`

Сводка по лучшим секторам и theoretical best.

```ts
export interface DriverSectorSummary {
  driverName: string;
  carClass: string;
  bestSector1Label: string;
  bestSector2Label: string;
  bestSector3Label: string;
  bestSector1Ms?: number | null;
  bestSector2Ms?: number | null;
  bestSector3Ms?: number | null;
  theoreticalBestLabel: string;
  theoreticalBestMs?: number | null;
  bestLapLabel?: string;
}

export interface AbsoluteSectorBest {
  sector1Ms?: number | null;
  sector2Ms?: number | null;
  sector3Ms?: number | null;
  theoreticalBestMs?: number | null;
}

export interface SessionSectorsSummaryProps {
  rows: DriverSectorSummary[];
  absoluteBest?: AbsoluteSectorBest;
}
```

---

### `client/src/components/session-detail/DriverLapsAccordion.tsx`

Контейнер подробных кругов по пилотам.

```ts
export interface DriverLapRowView {
  id: number;
  lapNumber: number;
  sector1Label: string;
  sector2Label: string;
  sector3Label: string;
  lapLabel: string;
  deltaLabel: string;
  lapMs: number;
  isBestLap: boolean;
}

export interface DriverLapsGroupView {
  driverName: string;
  carClass?: string | null;
  lapsCount: number;
  bestLapLabel: string;
  bestLapMs?: number | null;
  rows: DriverLapRowView[];
}

export interface DriverLapsAccordionProps {
  groups: DriverLapsGroupView[];
  defaultExpandedDriver?: string | null;
}
```

---

### `client/src/components/session-detail/DriverLapTable.tsx`

Таблица кругов одного пилота.

```ts
export interface DriverLapTableProps {
  driverName: string;
  lapsCount: number;
  bestLapLabel: string;
  rows: DriverLapRowView[];
}
```

---

### `client/src/components/session-detail/SessionEmptyState.tsx`

Переиспользуемый empty/error блок.

```ts
export interface SessionEmptyStateProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  tone?: "default" | "warning" | "muted";
}
```

Использование:

- сессия не найдена
- нет lap data
- нет данных для графика

---

### `client/src/components/session-detail/SessionLoadingSkeleton.tsx`

Скелетон для всей страницы.

```ts
export interface SessionLoadingSkeletonProps {
  showHero?: boolean;
  showTabs?: boolean;
  rows?: number;
}
```

---

### `client/src/components/session-detail/types.ts`

Локальный barrel/types-файл для props и view-моделей компонентов.

Имеет смысл экспортировать отсюда:

- `SessionTabKey`
- `SessionHeroStatItem`
- `SessionResultRowView`
- `DriverLapsGroupView`
- `DriverSectorSummary`
- `LapProgressSeries`

Это упростит импорты внутри feature-папки.

## Файлы логики

### `client/src/lib/sessionDetail.types.ts`

Типы доменной view-model.

```ts
export interface SessionDetailViewModel {
  header: {
    backHref: string;
    sessionType: string;
    normalizedSessionType: "race" | "qualify" | "superpole" | "warmup" | "practice";
    trackName: string;
    courseLabel?: string | null;
    dateTimeLabel: string;
    eventName?: string | null;
  };
  heroStats: import("@/components/session-detail/types").SessionHeroStatItem[];
  results: import("@/components/session-detail/types").SessionResultRowView[];
  tabs: import("@/components/session-detail/types").SessionTabItem[];
  lapProgress: import("@/components/session-detail/types").LapProgressSeries[];
  sectors: import("@/components/session-detail/types").DriverSectorSummary[];
  driverLaps: import("@/components/session-detail/types").DriverLapsGroupView[];
  hasLapData: boolean;
}
```

---

### `client/src/lib/sessionDetail.ts`

Главный builder view-model.

```ts
export interface BuildSessionDetailViewModelParams {
  session: unknown;
  laps: unknown[];
  backHref: string;
}

export function buildSessionDetailViewModel(
  params: BuildSessionDetailViewModelParams,
): SessionDetailViewModel
```

**Что делает:**

- нормализует тип сессии
- считает fastest lap
- определяет победителя / polesitter
- строит KPI
- вычисляет `gap` и `interval`
- агрегирует lap progression
- собирает best sectors и theoretical best
- строит groups для driver lap tables

---

### `client/src/lib/sessionDetailSelectors.ts`

Если не хочется один большой helper-файл, разложить вычисления по селекторам.

```ts
export function normalizeSessionType(raw: string): SessionHeaderProps["normalizedSessionType"]
export function buildHeroStats(session: unknown): SessionHeroStatItem[]
export function buildResultRows(session: unknown): SessionResultRowView[]
export function buildLapProgressSeries(laps: unknown[]): LapProgressSeries[]
export function buildSectorSummary(laps: unknown[]): DriverSectorSummary[]
export function buildDriverLapGroups(laps: unknown[]): DriverLapsGroupView[]
```

Это удобнее для unit-тестов и постепенной миграции.

## Пример структуры `SessionDetail.tsx`

```tsx
export default function SessionDetail() {
  const [, params] = useRoute("/sessions/:id");
  const searchString = useSearch();
  const backFilter = new URLSearchParams(searchString).get("from_filter");
  const backHref = backFilter ? `/sessions?filter=${encodeURIComponent(backFilter)}` : "/sessions";

  const id = params ? Number(params.id) : undefined;
  const { data: session, isLoading } = useSession(id);
  const { data: laps = [] } = useSessionLaps(id);

  const viewModel = useMemo(() => {
    if (!session) return null;
    return buildSessionDetailViewModel({ session, laps, backHref });
  }, [session, laps, backHref]);

  const [activeTab, setActiveTab] = useState<SessionTabKey>("results");

  if (isLoading) return <SessionLoadingSkeleton showHero showTabs rows={10} />;
  if (!session || !viewModel) return <SessionEmptyState title="Сессия не найдена" backHref={backHref} />;

  return (
    <div className="space-y-5">
      <SessionHeader {...viewModel.header} />
      <SessionHeroStats items={viewModel.heroStats} />
      <SessionTabs items={viewModel.tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "results" && <SessionResultsTable rows={viewModel.results} showPitColumn showGapColumn showIntervalColumn />}
      {activeTab === "laps" && <SessionLapProgressChart series={viewModel.lapProgress} emptyLabel="Нет данных по кругам" />}
      {activeTab === "sectors" && <SessionSectorsSummary rows={viewModel.sectors} />}

      <DriverLapsAccordion groups={viewModel.driverLaps} />
    </div>
  );
}
```

## Порядок создания файлов

1. `components/session-detail/types.ts`
2. `lib/sessionDetail.types.ts`
3. `lib/sessionDetailSelectors.ts`
4. `SessionHeader.tsx`
5. `SessionHeroStats.tsx`
6. `SessionResultsTable.tsx`
7. `SessionTabs.tsx`
8. `SessionLoadingSkeleton.tsx`
9. `SessionEmptyState.tsx`
10. интеграция в `pages/SessionDetail.tsx`
11. `SessionSectorsSummary.tsx`
12. `DriverLapTable.tsx`
13. `DriverLapsAccordion.tsx`
14. `SessionLapProgressChart.tsx`

## Что можно добавить позже

- `SessionClassLegend.tsx` — легенда цветов классов
- `SessionComparisonToolbar.tsx` — фильтр пилотов/классов
- `SessionHighlights.tsx` — блок fastest sectors, most consistent driver, longest stint
- `SessionMobileCards.tsx` — альтернативное мобильное представление результатов вместо широкой таблицы
