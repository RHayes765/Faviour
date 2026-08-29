import { barcodesMatch, normalizeBarcode } from '../src/utils/barcode';

describe('normalizeBarcode', () => {
  it('strips non-digits (then pads the remaining 12-digit UPC-A)', () => {
    expect(normalizeBarcode(' 0 12345-67890 5 ')).toBe('0012345678905');
    expect(normalizeBarcode('4006381333931')).toBe('4006381333931');
  });

  it('pads UPC-A (12 digits) to EAN-13 with a leading zero', () => {
    expect(normalizeBarcode('012345678905')).toBe('0012345678905');
  });

  it('leaves EAN-13, EAN-8, and UPC-E lengths alone', () => {
    expect(normalizeBarcode('4006381333931')).toBe('4006381333931');
    expect(normalizeBarcode('96385074')).toBe('96385074');
    expect(normalizeBarcode('01234565')).toBe('01234565');
  });

  it('returns null for empty input', () => {
    expect(normalizeBarcode('')).toBeNull();
    expect(normalizeBarcode('no digits here')).toBeNull();
  });

  it('rejects implausible lengths instead of passing junk through', () => {
    expect(normalizeBarcode('123')).toBeNull();
    expect(normalizeBarcode('12345')).toBeNull();
    expect(normalizeBarcode('123456789012345')).toBeNull();
  });
});

describe('barcodesMatch', () => {
  it('matches a UPC-A scan against an EAN-13 saved code', () => {
    expect(barcodesMatch('012345678905', '0012345678905')).toBe(true);
  });

  it('does not match different products or missing codes', () => {
    expect(barcodesMatch('4006381333931', '0012345678905')).toBe(false);
    expect(barcodesMatch(null, '0012345678905')).toBe(false);
    expect(barcodesMatch('4006381333931', null)).toBe(false);
  });
});
