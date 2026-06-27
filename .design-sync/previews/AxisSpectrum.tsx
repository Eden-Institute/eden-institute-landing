import { AxisSpectrum } from "eden-institute";

export function BetweenPatterns() {
  return (
    <div style={{ maxWidth: 460, padding: 8 }}>
      <AxisSpectrum
        counts={{
          temperature: { hot: 4, cold: 2, total: 7 },
          fluid: { damp: 3, dry: 3, total: 7 },
          tone: { tense: 5, relaxed: 1, total: 7 },
        }}
      />
    </div>
  );
}

export function Balanced() {
  return (
    <div style={{ maxWidth: 460, padding: 8 }}>
      <AxisSpectrum
        counts={{
          temperature: { hot: 3, cold: 3, total: 7 },
          fluid: { damp: 2, dry: 4, total: 7 },
          tone: { tense: 3, relaxed: 3, total: 7 },
        }}
      />
    </div>
  );
}
