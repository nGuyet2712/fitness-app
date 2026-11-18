import { decodeCursor, encodeCursor } from '@/utils/cursor';

describe('cursor', () => {
  it('should round-trip values', () => {
    const values = { performedAt: '2026-11-17T01:30:00.000Z', id: 'abc-123' };
    const cursor = encodeCursor(values);
    expect(decodeCursor(cursor)).toEqual(values);
  });

  it('should throw for a non-base64 string', () => {
    expect(() => decodeCursor('not!valid!base64!!!')).toThrow(
      'Malformed cursor',
    );
  });

  it('should throw for base64 that decodes to non-JSON', () => {
    const garbage = Buffer.from('not json').toString('base64url');
    expect(() => decodeCursor(garbage)).toThrow('Malformed cursor');
  });
});
