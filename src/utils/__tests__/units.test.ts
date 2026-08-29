import {
  formatBedArea,
  formatBedSize,
  formatFlowGph,
  formatLengthIn,
  formatTemp,
  formatWeightLbs,
  parseWeightToLbs,
} from '../units';

describe('formatTemp', () => {
  it('passes through imperial unchanged, rounded', () => {
    expect(formatTemp(72.4, 'imperial')).toBe('72°F');
    expect(formatTemp(72.6, 'imperial')).toBe('73°F');
  });

  it('converts to celsius', () => {
    expect(formatTemp(32, 'metric')).toBe('0°C');
    expect(formatTemp(212, 'metric')).toBe('100°C');
    expect(formatTemp(98.6, 'metric')).toBe('37°C');
  });
});

describe('formatLengthIn', () => {
  it('passes through imperial as inches', () => {
    expect(formatLengthIn(12, 'imperial')).toBe('12"');
  });

  it('converts the preset spacing options to whole centimeters', () => {
    expect(formatLengthIn(6, 'metric')).toBe('15 cm');
    expect(formatLengthIn(12, 'metric')).toBe('30 cm');
    expect(formatLengthIn(18, 'metric')).toBe('46 cm');
  });
});

describe('formatBedSize', () => {
  it('passes through imperial as feet', () => {
    expect(formatBedSize(4, 8, 'imperial')).toBe('4 × 8 ft');
  });

  it('converts to meters with one decimal', () => {
    expect(formatBedSize(4, 8, 'metric')).toBe('1.2 × 2.4 m');
  });
});

describe('formatBedArea', () => {
  it('passes through imperial as square feet', () => {
    expect(formatBedArea(4, 8, 'imperial')).toBe('32 sq ft');
  });

  it('converts to square meters', () => {
    expect(formatBedArea(4, 8, 'metric')).toBe('3.0 m²');
  });
});

describe('formatFlowGph', () => {
  it('passes through imperial as GPH', () => {
    expect(formatFlowGph(0.5, 'imperial')).toBe('0.5 GPH');
  });

  it('rounds to a whole number of liters per hour at or above 1 L/hr', () => {
    expect(formatFlowGph(0.5, 'metric')).toBe('2 L/hr');
    expect(formatFlowGph(1.0, 'metric')).toBe('4 L/hr');
  });

  it('keeps one decimal under 1 L/hr', () => {
    expect(formatFlowGph(0.2, 'metric')).toBe('0.8 L/hr');
  });
});

describe('formatWeightLbs', () => {
  it('drops the decimal for whole-number imperial values', () => {
    expect(formatWeightLbs(3, 'imperial')).toBe('3 lbs');
  });

  it('keeps one decimal for fractional imperial values', () => {
    expect(formatWeightLbs(3.5, 'imperial')).toBe('3.5 lbs');
  });

  it('converts to kilograms', () => {
    expect(formatWeightLbs(4.4, 'metric')).toBe('2.0 kg');
  });
});

describe('parseWeightToLbs', () => {
  it('passes through imperial input unchanged', () => {
    expect(parseWeightToLbs(5, 'imperial')).toBe(5);
  });

  it('converts metric kg input back to lbs', () => {
    expect(parseWeightToLbs(1, 'metric')).toBeCloseTo(2.2046, 3);
  });

  it('round-trips through format and parse without drifting', () => {
    const originalLbs = 10;
    const kg = originalLbs * 0.453592;
    expect(parseWeightToLbs(kg, 'metric')).toBeCloseTo(originalLbs, 6);
  });
});
