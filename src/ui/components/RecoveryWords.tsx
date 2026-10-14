export function RecoveryWords({ words }: { words: string[] }) {
  return (
    <ol class="words-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="24 kata recovery key">
      {words.map((w, i) => (
        <li key={i} class="word">
          <small>{i + 1}</small>
          {w}
        </li>
      ))}
    </ol>
  );
}
