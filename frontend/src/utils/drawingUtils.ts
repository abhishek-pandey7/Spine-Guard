/**
 * Drawing utilities for canvas skeleton rendering.
 * These are helper functions used by SkeletonCanvas.
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Draw a glowing line between two points on a canvas
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  a: Point2D,
  b: Point2D,
  color: string,
  glowColor: string,
  lineWidth = 3
): void {
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/**
 * Draw a glowing circle (landmark dot)
 */
export function drawDot(
  ctx: CanvasRenderingContext2D,
  point: Point2D,
  color: string,
  glowColor: string,
  radius = 5,
  outlined = false
): void {
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  if (outlined) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
}

/**
 * Draw a dashed spine center line
 */
export function drawSpineLine(
  ctx: CanvasRenderingContext2D,
  from: Point2D,
  to: Point2D,
  color: string
): void {
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Draw a semi-transparent warning overlay on entire canvas
 */
export function drawViolationFlash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alpha = 0.15
): void {
  ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
  ctx.fillRect(0, 0, width, height);
}
