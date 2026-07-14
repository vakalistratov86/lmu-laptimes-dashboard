// Стилизованные контуры реальных конфигураций трасс LMU (SVG, без внешних зависимостей).
// Каждый path нарисован в системе координат 0..420 x 0..250 и рисуется через currentColor.

interface TrackData {
  d: string;
  // Точка старта/финиша [x, y] и угол поворота маркера
  startX: number;
  startY: number;
  startAngle?: number;
}

const TRACKS: Record<string, TrackData> = {
  // Circuit de la Sarthe — длинные прямые Мюльсанн, характерная вытянутая форма
  "Le Mans": {
    d: "M60 180 C40 150 55 120 90 118 L200 112 C230 110 250 95 245 70 C242 52 220 48 200 60 L150 88 C120 104 92 96 96 70 C100 48 130 40 170 44 L320 60 C360 66 378 92 360 120 C346 142 315 148 285 150 L150 162 C110 166 82 210 60 180 Z",
    startX: 170, startY: 44, startAngle: 0,
  },
  // Spa-Francorchamps — с длинной петлёй и Eau Rouge
  "Spa-Francorchamps": {
    d: "M70 200 C50 180 58 150 85 148 L140 145 C165 143 175 120 160 104 C148 90 130 96 128 116 L124 150 C120 190 150 200 190 196 L300 186 C345 182 372 150 355 120 C342 98 312 92 288 104 L200 148 C160 168 120 158 100 130 C86 110 100 88 130 86 L250 80 C300 76 330 110 310 148 C296 174 90 220 70 200 Z",
    startX: 250, startY: 80, startAngle: 0,
  },
  // Monza — быстрая с шиканами и параболикой
  "Monza": {
    d: "M60 190 L300 130 C340 121 360 140 350 168 C342 190 318 196 296 190 L120 150 C90 143 88 118 112 108 L280 68 C320 59 342 82 330 110 C322 128 300 132 282 124 L90 150 C64 158 50 200 60 190 Z",
    startX: 170, startY: 128, startAngle: -10,
  },
  // Fuji Speedway — очень длинная стартовая прямая + технический последний сектор
  "Fuji Speedway": {
    d: "M70 60 L330 60 C360 60 372 84 356 106 C344 122 322 124 306 112 L250 90 C220 78 196 96 200 122 C203 142 224 150 244 142 L300 120 C336 106 360 132 346 160 C336 180 312 186 292 178 L120 140 C82 131 74 96 70 60 Z",
    startX: 200, startY: 60, startAngle: 0,
  },
  // Sebring — прямоугольный аэродром с длинными прямыми и разворотом
  "Sebring": {
    d: "M60 70 L330 70 C356 70 366 92 352 112 L300 176 C288 192 268 196 252 186 C238 177 238 158 252 150 L296 122 C312 111 308 88 288 88 L120 88 C98 88 92 116 112 124 L250 172 C270 180 268 208 246 208 L90 208 C64 208 54 184 68 164 L110 104 C122 87 74 96 60 70 Z",
    startX: 190, startY: 70, startAngle: 0,
  },
  // Bahrain — техничный первый сектор + длинная прямая
  "Bahrain": {
    d: "M70 180 C52 158 62 130 90 130 L180 130 C205 130 214 108 198 94 C185 82 166 90 166 110 L162 154 C158 186 188 196 220 190 L320 174 C356 168 372 138 352 114 C338 97 310 96 290 108 L180 168 C150 184 100 208 70 180 Z",
    startX: 250, startY: 174, startAngle: 0,
  },
  // Imola — обратное направление, извилистая с шиканами
  "Imola": {
    d: "M70 150 C55 128 66 100 94 102 L150 106 C176 108 188 88 172 74 C160 63 140 70 140 90 L138 130 C135 168 168 178 200 172 L246 162 C266 158 270 136 254 128 C240 121 222 128 224 146 L228 176 C232 208 200 216 172 208 L110 190 C80 181 84 172 70 150 Z",
    startX: 120, startY: 104, startAngle: 0,
  },
  // Portimão — «американские горки» с перепадами высот
  "Portimão": {
    d: "M64 168 C48 146 58 118 86 118 L150 118 C176 118 186 96 170 82 C158 71 138 78 138 98 L136 138 C133 172 164 184 196 178 L268 164 C300 158 312 128 292 106 C278 90 250 92 234 108 L150 176 C118 200 80 190 64 168 Z",
    startX: 120, startY: 118, startAngle: 0,
  },
  // Interlagos — против часовой, знаменитый «Senna S»
  "Interlagos": {
    d: "M74 170 C56 148 66 118 96 118 L156 120 C182 121 194 100 178 86 C165 74 146 82 148 102 L152 140 C155 176 190 186 222 178 L282 162 C316 153 330 122 308 100 C293 85 264 90 250 108 L150 180 C120 200 92 192 74 170 Z",
    startX: 130, startY: 118, startAngle: 0,
  },

  // --- Новые трассы LMU ---

  // Circuit de Catalunya (Barcelona) — средние скорости, длинная прямая, медленные шиканы
  "Circuit de Catalunya": {
    d: "M70 170 C52 150 60 122 88 120 L180 116 C206 114 218 94 202 78 C188 64 166 72 168 94 L166 136 C163 170 196 182 228 174 L300 158 C338 150 356 120 336 96 C320 78 292 78 274 94 L180 178 C148 196 88 192 70 170 Z",
    startX: 130, startY: 118, startAngle: 0,
  },

  // Watkins Glen — знаменитый американский классик, длинные прямые и скоростные повороты
  "Watkins Glen": {
    d: "M65 80 L310 80 C345 80 360 104 342 128 C328 148 302 152 280 140 L220 114 C194 102 178 118 186 146 C192 166 216 172 238 162 L296 138 C330 124 352 150 336 178 C322 200 292 204 270 192 L110 150 C78 140 68 112 65 80 Z",
    startX: 188, startY: 80, startAngle: 0,
  },

  // Daytona International Speedway — овал + роуд-корс
  "Daytona": {
    d: "M60 80 L340 80 C366 80 374 106 356 124 C342 138 318 138 306 124 L250 90 C230 78 210 88 214 110 C217 128 238 134 256 124 L308 100 C330 89 350 108 336 130 C323 150 297 152 282 140 L100 100 C72 89 56 118 60 80 Z",
    startX: 195, startY: 80, startAngle: 0,
  },

  // Road Atlanta — техничная американская трасса с прыжком на 12-м повороте
  "Road Atlanta": {
    d: "M68 160 C50 138 60 108 90 108 L160 110 C186 110 196 90 178 76 C164 64 144 72 146 94 L144 134 C142 166 174 176 206 168 L270 152 C304 144 318 114 296 92 C280 76 252 80 240 98 L168 178 C136 196 86 184 68 160 Z",
    startX: 130, startY: 110, startAngle: 0,
  },

  // Laguna Seca — культовый «штопор» (Corkscrew)
  "Laguna Seca": {
    d: "M72 148 C56 126 68 98 98 100 L162 104 C188 105 198 84 180 70 C166 58 146 66 148 88 L146 128 C144 162 178 172 210 164 L264 150 C296 142 308 112 286 90 C270 74 242 78 232 98 L160 168 C128 184 90 170 72 148 Z",
    startX: 128, startY: 102, startAngle: 0,
  },

  // Circuit des 24 Heures du Mans (Bugatti layout — короткая версия)
  "Le Mans Bugatti": {
    d: "M80 160 C62 138 74 110 104 110 L180 112 C206 112 214 92 196 78 C182 66 162 74 164 96 L162 138 C160 170 192 180 222 172 L292 156 C326 148 340 118 318 96 C302 80 274 82 262 100 L160 172 C128 188 98 184 80 160 Z",
    startX: 132, startY: 112, startAngle: 0,
  },

  // Silverstone GP — широкие высокоскоростные повороты
  "Silverstone": {
    d: "M66 164 C48 142 58 114 88 114 L160 114 C186 114 196 94 178 80 C164 68 144 76 146 98 L144 140 C142 174 174 186 206 178 L290 160 C326 152 342 120 320 96 C304 78 276 80 264 98 L160 178 C126 196 86 186 66 164 Z",
    startX: 128, startY: 114, startAngle: 0,
  },

  // Le Mans Circuit de la Sarthe (ночная/wet вариация - алиас)
  "Circuit de la Sarthe": {
    d: "M60 180 C40 150 55 120 90 118 L200 112 C230 110 250 95 245 70 C242 52 220 48 200 60 L150 88 C120 104 92 96 96 70 C100 48 130 40 170 44 L320 60 C360 66 378 92 360 120 C346 142 315 148 285 150 L150 162 C110 166 82 210 60 180 Z",
    startX: 170, startY: 44, startAngle: 0,
  },
};

// Backward-compatible: просто достаём path из новой структуры
const PATHS: Record<string, string> = Object.fromEntries(
  Object.entries(TRACKS).map(([k, v]) => [k, v.d])
);

export function TrackMap({
  name,
  className = "",
  showStartFinish = true,
}: {
  name: string;
  className?: string;
  showStartFinish?: boolean;
}) {
  const track = TRACKS[name];
  if (!track) return null;
  const { d, startX, startY, startAngle = 0 } = track;

  return (
    <svg
      viewBox="0 0 420 250"
      className={className}
      fill="none"
      aria-label={`Схема трассы ${name}`}
      role="img"
      data-testid="track-map"
    >
      {/* фоновая «тень» контура */}
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-10"
      />
      {/* основная линия трассы */}
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* штрихпунктир осевой */}
      <path
        d={d}
        stroke="hsl(var(--background))"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 8"
      />

      {/* Маркер старт/финиш */}
      {showStartFinish && (
        <g transform={`translate(${startX}, ${startY}) rotate(${startAngle})`}>
          {/* Линия старта/финиша */}
          <line
            x1={0} y1={-10}
            x2={0} y2={10}
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* Шашечный паттерн (2 клетки) */}
          <rect x={-5} y={-10} width={5} height={5} fill="hsl(var(--primary))" opacity={0.9} />
          <rect x={0}  y={-10} width={5} height={5} fill="hsl(var(--background))" opacity={0.9} />
          <rect x={-5} y={-5}  width={5} height={5} fill="hsl(var(--background))" opacity={0.9} />
          <rect x={0}  y={-5}  width={5} height={5} fill="hsl(var(--primary))" opacity={0.9} />
          {/* Подпись S/F */}
          <text
            x={8}
            y={4}
            fontSize={8}
            fill="hsl(var(--primary))"
            fontFamily="monospace"
            fontWeight="bold"
          >
            S/F
          </text>
        </g>
      )}
    </svg>
  );
}

export function hasTrackMap(name: string): boolean {
  return name in TRACKS;
}

/** Список всех трасс, для которых есть схема */
export function listTracksWithMap(): string[] {
  return Object.keys(TRACKS);
}
