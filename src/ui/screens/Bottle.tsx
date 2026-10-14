import { useEffect, useRef, useState } from 'preact/hooks';
import { drawSlip } from '../../domain/bottle';
import { MOOD_BY_ID, MOODS } from '../../domain/catalog';
import type { MoodId, Slip } from '../../domain/types';
import { Icon } from '../icons';
import { go } from '../router';
import { useVault } from '../services';
import { TopBar } from '../components/common';
import { Jar, PaperRoll, SlipCard } from '../components/Paper';

type Phase = 'idle' | 'shake' | 'rise' | 'open';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The feelings bottle: pick the colour that matches how you feel, the jar shakes, one rolled
 * paper of that colour comes out and unrolls into an affirmation, question or small step.
 */
export function Bottle() {
  const vault = useVault();
  const [phase, setPhase] = useState<Phase>('idle');
  const [pick, setPick] = useState<MoodId | null>(null);
  const [slip, setSlip] = useState<Slip | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, reducedMotion() ? 0 : ms));

  const draw = (emotion: MoodId) => {
    if (phase === 'shake' || phase === 'rise') return;
    const { slip: s, recent } = drawSlip(emotion, vault.settings.drawnSlips ?? []);
    void vault.saveSettings({ drawnSlips: recent });
    setPick(emotion);
    setSlip(s);
    setPhase('shake');
    navigator.vibrate?.(30);
    later(650, () => setPhase('rise'));
    later(1500, () => setPhase('open'));
  };

  const m = pick ? MOOD_BY_ID[pick] : null;

  return (
    <main class="screen no-nav bottle-screen">
      <TopBar title="Botol perasaan" />
      <div class="stack-lg">
        <p class="muted center">Apa yang sedang kamu rasakan? Pilih warnanya, lalu ambil satu gulungan kertas dari botol.</p>

        <div class="jar-stage">
          <Jar shaking={phase === 'shake'} dim={phase === 'idle' ? null : pick} />
          {m && (phase === 'rise' || phase === 'open') && (
            <span class={`rising-roll ${phase === 'open' ? 'gone' : ''}`} style={{ '--paper': m.paper, '--edge': m.edge }} />
          )}
        </div>

        <div class="feel-grid" role="group" aria-label="Pilih perasaan">
          {MOODS.map((md) => (
            <button key={md.id} class={`feel-btn ${pick === md.id ? 'on' : ''}`} onClick={() => draw(md.id)} style={{ '--paper': md.paper, '--edge': md.edge }}>
              <PaperRoll emotion={md.id} />
              <span class="feel-label">{md.label}</span>
              <span class="feel-hint">{md.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {phase === 'open' && slip && (
        <div class="backdrop slip-backdrop" onClick={(e) => e.target === e.currentTarget && setPhase('idle')}>
          <div class="slip-reveal">
            <SlipCard slip={slip}>
              <div class="stack" style={{ marginTop: '18px' }}>
                <button class="btn block" onClick={() => go(`new?slip=${encodeURIComponent(slip.id)}`, { replace: true })}>
                  <Icon name="edit" size={18} /> Tulis jurnal dari kertas ini
                </button>
                <div class="row">
                  <button class="btn secondary grow" onClick={() => draw(slip.emotion)}>
                    Ambil lagi
                  </button>
                  <button class="btn secondary grow" onClick={() => setPhase('idle')}>
                    Kembalikan
                  </button>
                </div>
              </div>
            </SlipCard>
          </div>
        </div>
      )}
    </main>
  );
}
