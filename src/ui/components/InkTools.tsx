import { INK_COLORS, INK_SIZES, type InkTool } from '../../media/ink';
import { Icon, type IconName } from '../icons';

const TOOLS: { id: InkTool; label: string; icon: IconName }[] = [
  { id: 'pen', label: 'Pena', icon: 'pen' },
  { id: 'marker', label: 'Spidol', icon: 'marker' },
  { id: 'eraser', label: 'Hapus', icon: 'eraser' }
];

export interface InkSettings {
  tool: InkTool;
  color: string;
  size: number;
}

export const DEFAULT_INK: InkSettings = { tool: 'pen', color: INK_COLORS[0], size: INK_SIZES[1].size };

/** Tool, thickness and colour pickers shared by the drawing pad and the scrapbook pen. */
export function InkTools({ value, onChange }: { value: InkSettings; onChange: (v: InkSettings) => void }) {
  const set = (patch: Partial<InkSettings>) => onChange({ ...value, ...patch });
  return (
    <div class="ink-tools">
      <div class="ink-row">
        {TOOLS.map((t) => (
          <button key={t.id} class={`ink-tool ${value.tool === t.id ? 'on' : ''}`} onClick={() => set({ tool: t.id })} aria-pressed={value.tool === t.id}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </button>
        ))}
        <span class="ink-sep" />
        {INK_SIZES.map((s) => (
          <button key={s.id} class={`ink-size ${value.size === s.size ? 'on' : ''}`} onClick={() => set({ size: s.size })} aria-label={s.label} aria-pressed={value.size === s.size}>
            <i style={{ width: `${6 + s.size * 600}px`, height: `${6 + s.size * 600}px`, background: value.tool === 'eraser' ? 'var(--text-3)' : value.color }} />
          </button>
        ))}
      </div>
      {value.tool !== 'eraser' && (
        <div class="ink-colors" role="radiogroup" aria-label="Warna">
          {INK_COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={value.color === c}
              aria-label={`Warna ${c}`}
              class={`ink-color ${value.color === c ? 'on' : ''}`}
              style={{ background: c }}
              onClick={() => set({ color: c })}
            />
          ))}
          <label class="ink-color custom" aria-label="Warna lain">
            <input type="color" value={value.color} onInput={(e) => set({ color: e.currentTarget.value })} />
          </label>
        </div>
      )}
    </div>
  );
}
