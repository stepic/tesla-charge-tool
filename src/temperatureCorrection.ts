export type BatteryChemistry = 'LFP' | 'NMC' | 'NCA' | 'UNKNOWN';

type TemperatureBreakpoint = {
  tempC: number;
  multiplier: number;
};

const chemistryCurves: Record<BatteryChemistry, TemperatureBreakpoint[]> = {
  NMC: [
    { tempC: 0, multiplier: 0.45 },
    { tempC: 10, multiplier: 0.70 },
    { tempC: 20, multiplier: 0.95 },
    { tempC: 25, multiplier: 1.0 }
  ],
  NCA: [
    { tempC: 0, multiplier: 0.45 },
    { tempC: 10, multiplier: 0.70 },
    { tempC: 20, multiplier: 0.95 },
    { tempC: 25, multiplier: 1.0 }
  ],
  LFP: [
    { tempC: 0, multiplier: 0.35 },
    { tempC: 10, multiplier: 0.60 },
    { tempC: 20, multiplier: 0.93 },
    { tempC: 25, multiplier: 1.0 }
  ],
  UNKNOWN: [
    { tempC: 0, multiplier: 0.40 },
    { tempC: 10, multiplier: 0.65 },
    { tempC: 20, multiplier: 0.94 },
    { tempC: 25, multiplier: 1.0 }
  ]
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const interpolateMultiplier = (tempC: number, curve: TemperatureBreakpoint[]) => {
  if (curve.length === 0) return 1;
  if (tempC <= curve[0].tempC) return curve[0].multiplier;
  const last = curve[curve.length - 1];
  if (tempC >= last.tempC) return last.multiplier;

  for (let i = 0; i < curve.length - 1; i += 1) {
    const lower = curve[i];
    const upper = curve[i + 1];
    if (tempC >= lower.tempC && tempC <= upper.tempC) {
      const ratio = (tempC - lower.tempC) / (upper.tempC - lower.tempC);
      return lower.multiplier + ratio * (upper.multiplier - lower.multiplier);
    }
  }

  return last.multiplier;
};

export const getTemperatureMultiplier = (
  tempC: number,
  chemistry: BatteryChemistry,
  isPreheated = false
) => {
  if (isPreheated) return 1;
  const curve = chemistryCurves[chemistry] ?? chemistryCurves.UNKNOWN;
  const raw = interpolateMultiplier(tempC, curve);
  return clamp(raw, 0, 1);
};

export const applyTemperatureCorrection = (
  powerKw: number,
  tempC: number,
  chemistry: BatteryChemistry,
  isPreheated = false
) => {
  const multiplier = getTemperatureMultiplier(tempC, chemistry, isPreheated);
  return powerKw * multiplier;
};
