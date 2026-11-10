import { causeProduct, triageTree } from '../triageEngine';

describe('Holes in leaves', () => {
  const holes = triageTree.holes;
  it('points overnight ragged holes at slugs, once, with an iron phosphate bait', () => {
    const causes = holes.resolve({ q1: 'ragged', q2: 'overnight' });
    expect(causes.filter((c) => c.title === 'Slugs or snails')).toHaveLength(1);
    expect(causes[0].title).toBe('Slugs or snails');
    expect(causeProduct(causes[0])!.label).toBe('iron phosphate slug bait');
  });
  it('points pinholes at flea beetles and chewed edges at caterpillars', () => {
    expect(holes.resolve({ q1: 'pinholes', q2: 'daytime' })[0].title).toBe('Flea beetles');
    expect(holes.resolve({ q1: 'chewed', q2: 'daytime' })[0].title).toBe('Caterpillars');
  });
});

describe('causeProduct', () => {
  it('links pests and fungus to a product, and leaves watering problems alone', () => {
    const pests = triageTree.pests.resolve({ q1: 'underside', q2: 'clusters' });
    expect(causeProduct(pests[0])!.label).toBe('insecticidal soap');
    const wilting = triageTree.wilting.resolve({ q1: 'no', q2: 'soggy' });
    expect(wilting.every((c) => causeProduct(c) === null)).toBe(true);
  });
});
