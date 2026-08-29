// units.ts
// Every value stored on GardenProfile stays imperial (see types.ts) —
// scheduleEngine's watering-rate formulas are calibrated in inches/GPH and
// aren't touched by this. These are display/input-boundary conversions only:
// format*() turns a stored imperial number into the string a metric-
// preferring user sees; parse*() turns their metric input back into the
// imperial number that gets stored.

export type UnitSystem = 'imperial' | 'metric';

const CM_PER_IN = 2.54;
const M_PER_FT = 0.3048;
const L_PER_GAL = 3.78541;
const KG_PER_LB = 0.453592;

export function formatTemp(tempF: number, units: UnitSystem): string {
  if (units === 'imperial') return `${Math.round(tempF)}°F`;
  return `${Math.round(((tempF - 32) * 5) / 9)}°C`;
}

export function formatLengthIn(inches: number, units: UnitSystem): string {
  if (units === 'imperial') return `${inches}"`;
  return `${Math.round(inches * CM_PER_IN)} cm`;
}

export function formatBedSize(widthFt: number, lengthFt: number, units: UnitSystem): string {
  if (units === 'imperial') return `${widthFt} × ${lengthFt} ft`;
  const w = (widthFt * M_PER_FT).toFixed(1);
  const l = (lengthFt * M_PER_FT).toFixed(1);
  return `${w} × ${l} m`;
}

const SQFT_PER_SQM = M_PER_FT * M_PER_FT;

export function formatBedArea(widthFt: number, lengthFt: number, units: UnitSystem): string {
  const sqFt = widthFt * lengthFt;
  if (units === 'imperial') return `${sqFt} sq ft`;
  return `${(sqFt * SQFT_PER_SQM).toFixed(1)} m²`;
}

export function formatFlowGph(gph: number, units: UnitSystem): string {
  if (units === 'imperial') return `${gph} GPH`;
  const lph = gph * L_PER_GAL;
  return `${lph < 1 ? lph.toFixed(1) : Math.round(lph)} L/hr`;
}

export function formatWeightLbs(lbs: number, units: UnitSystem): string {
  if (units === 'imperial') return `${lbs.toFixed(lbs % 1 === 0 ? 0 : 1)} lbs`;
  const kg = lbs * KG_PER_LB;
  return `${kg.toFixed(kg % 1 === 0 ? 0 : 1)} kg`;
}

// AddHarvestScreen weight input: the number the user typed, in whatever
// unit their profile is set to, converted to the imperial lbs that gets
// stored on HarvestEntry.weightLbs.
export function parseWeightToLbs(value: number, units: UnitSystem): number {
  if (units === 'imperial') return value;
  return value / KG_PER_LB;
}
