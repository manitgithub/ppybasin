type ChartPoint = { x: number; y: number | null };
type ValidPoint = { x: number; y: number };

/** Monotone cubic interpolation: passes through observations without adding peaks. */
export function smoothWaterPath(points: ChartPoint[]): string {
  const commands: string[] = [];
  let segment: ValidPoint[] = [];
  const coordinate = (value: number) => value.toFixed(2);

  function flush() {
    if (!segment.length) return;
    commands.push(`M${coordinate(segment[0].x)},${coordinate(segment[0].y)}`);
    const slopes = segment.slice(1).map((point, i) => (point.y - segment[i].y) / (point.x - segment[i].x));
    const tangents = segment.map((_, i) => {
      if (i === 0) return slopes[0] ?? 0;
      if (i === segment.length - 1) return slopes[i - 1];
      const before = slopes[i - 1], after = slopes[i];
      if (before * after <= 0) return 0;
      const previousWidth = segment[i].x - segment[i - 1].x;
      const nextWidth = segment[i + 1].x - segment[i].x;
      const a = 2 * nextWidth + previousWidth, b = nextWidth + 2 * previousWidth;
      return (a + b) / (a / before + b / after);
    });
    segment.slice(1).forEach((point, i) => {
      const previous = segment[i], third = (point.x - previous.x) / 3;
      commands.push(`C${coordinate(previous.x + third)},${coordinate(previous.y + third * tangents[i])} ${coordinate(point.x - third)},${coordinate(point.y - third * tangents[i + 1])} ${coordinate(point.x)},${coordinate(point.y)}`);
    });
    segment = [];
  }

  for (const point of points) {
    if (point.y === null || !Number.isFinite(point.y)) flush();
    else segment.push({ x: point.x, y: point.y });
  }
  flush();
  return commands.join(" ");
}
