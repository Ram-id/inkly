import { useEffect, useRef } from 'preact/hooks';
import { drawStroke, drawStrokes, pushPoint, type InkTool, type Stroke } from '../../media/ink';

/**
 * A transparent drawing layer that fills its parent. Committed strokes live on one canvas,
 * the stroke being drawn on another, so semi-transparent marker strokes stay even.
 */
export function InkSurface({
  strokes,
  onStroke,
  tool,
  color,
  size,
  enabled = true
}: {
  strokes: Stroke[];
  onStroke?: (s: Stroke) => void;
  tool: InkTool;
  color: string;
  size: number;
  enabled?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<{ id: number; stroke: Stroke } | null>(null);
  const widthPx = useRef(1);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const redraw = () => {
    const c = inkRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    drawStrokes(ctx, strokesRef.current, c.width);
  };

  useEffect(() => {
    const el = wrap.current!;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      for (const c of [inkRef.current!, liveRef.current!]) {
        c.width = Math.max(1, Math.round(r.width * dpr));
        c.height = Math.max(1, Math.round(r.height * dpr));
      }
      widthPx.current = r.width;
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(redraw, [strokes]);

  const point = (e: PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.width, p };
  };

  const down = (e: PointerEvent) => {
    if (!enabled || current.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const stroke: Stroke = { tool, color, size, points: [] };
    const { x, y, p } = point(e);
    pushPoint(stroke, x, y, p);
    current.current = { id: e.pointerId, stroke };
    paintLive();
  };

  const paintLive = () => {
    const cur = current.current;
    if (!cur) return;
    if (cur.stroke.tool === 'eraser') {
      // erase straight on the committed layer so the effect is visible immediately
      redraw();
      drawStroke(inkRef.current!.getContext('2d')!, cur.stroke, inkRef.current!.width);
      return;
    }
    const c = liveRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    drawStroke(ctx, cur.stroke, c.width);
  };

  const move = (e: PointerEvent) => {
    const cur = current.current;
    if (!cur || cur.id !== e.pointerId) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    let changed = false;
    for (const ev of events.length ? events : [e]) {
      const { x, y, p } = point(ev);
      changed = pushPoint(cur.stroke, x, y, p) || changed;
    }
    if (changed) paintLive();
  };

  const up = (e: PointerEvent) => {
    const cur = current.current;
    if (!cur || cur.id !== e.pointerId) return;
    current.current = null;
    const live = liveRef.current!;
    live.getContext('2d')!.clearRect(0, 0, live.width, live.height);
    onStroke?.(cur.stroke);
  };

  return (
    <div
      ref={wrap}
      class={`ink-surface ${enabled ? 'on' : ''}`}
      onPointerDown={(e) => down(e as PointerEvent)}
      onPointerMove={(e) => move(e as PointerEvent)}
      onPointerUp={(e) => up(e as PointerEvent)}
      onPointerCancel={(e) => up(e as PointerEvent)}
    >
      <canvas ref={inkRef} />
      <canvas ref={liveRef} />
    </div>
  );
}
