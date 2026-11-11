/** Utilidades de geometría para los gráficos SVG. */

export type Point = { x: number; y: number };

/** Redondea hacia arriba a un valor «bonito» para el eje (1, 2, 2,5, 5 × 10^n). */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * exponent;
}

/** Curva monótona (Fritsch–Carlson): suave y sin picos falsos entre puntos. */
export function monotonePath(points: Point[]): string {
  const n = points.length;
  const first = points[0];
  if (!first) return '';
  if (n === 1) return `M${first.x},${first.y}`;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const at = (list: number[], i: number) => list[i] ?? 0;
  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(at(xs, i + 1) - at(xs, i));
    slopes.push((at(ys, i + 1) - at(ys, i)) / (at(dx, i) || 1));
  }
  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = at(slopes, 0);
  tangents[n - 1] = at(slopes, n - 2);
  for (let i = 1; i < n - 1; i += 1) {
    const a = at(slopes, i - 1);
    const b = at(slopes, i);
    if (a * b <= 0) {
      tangents[i] = 0;
    } else {
      const d0 = at(dx, i - 1);
      const d1 = at(dx, i);
      tangents[i] = (3 * (d0 + d1)) / ((2 * d1 + d0) / a + (d1 + 2 * d0) / b);
    }
  }
  let path = `M${at(xs, 0)},${at(ys, 0)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const step = at(dx, i) / 3;
    path += ` C${at(xs, i) + step},${at(ys, i) + at(tangents, i) * step} ${at(xs, i + 1) - step},${
      at(ys, i + 1) - at(tangents, i + 1) * step
    } ${at(xs, i + 1)},${at(ys, i + 1)}`;
  }
  return path;
}

/** Barra con esquinas superiores redondeadas. */
export function roundedTopBar(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0 || width <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${
    x + width
  },${y + r} V${y + height} Z`;
}

/** Arco sobre la circunferencia media de un anillo (ángulos en radianes, 0 = arriba). */
export function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const point = (angle: number) => ({
    x: cx + radius * Math.sin(angle),
    y: cy - radius * Math.cos(angle),
  });
  const a = point(start);
  const b = point(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M${a.x},${a.y} A${radius},${radius} 0 ${large} 1 ${b.x},${b.y}`;
}
