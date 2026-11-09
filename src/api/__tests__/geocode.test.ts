import { usZip } from '../weather';

describe('usZip', () => {
  it('recognizes 5-digit and ZIP+4 US ZIPs', () => {
    expect(usZip('92101')).toBe('92101');
    expect(usZip(' 10001 ')).toBe('10001');
    expect(usZip('92101-1234')).toBe('92101');
  });

  it('leaves cities, addresses, and non-US postcodes to the free-text search', () => {
    expect(usZip('San Diego, CA')).toBeNull();
    expect(usZip('123 Main St 92101')).toBeNull();
    expect(usZip('SW1A 1AA')).toBeNull();
    expect(usZip('1234')).toBeNull();
  });
});
