import { BadRequestException } from '@nestjs/common';
import { normalizePollOptions } from './poll-validation';

describe('Poll answer validation', () => {
  it('trims answers and preserves order', () =>
    expect(normalizePollOptions([' Pizza ', 'Soup'])).toEqual([
      'Pizza',
      'Soup',
    ]));
  it('allows six 100-character answers', () =>
    expect(
      normalizePollOptions(
        Array.from({ length: 6 }, (_, index) => `${index}${'a'.repeat(99)}`),
      ),
    ).toHaveLength(6));
  it.each([
    ['Only'],
    Array.from({ length: 7 }, (_, i) => `${i}`),
    [' ', 'Soup'],
    ['Pizza', ' pizza '],
    ['a'.repeat(101), 'Soup'],
  ])('rejects invalid choices %s', (...options) => {
    expect(() => normalizePollOptions(options)).toThrow(BadRequestException);
  });
  it('identifies the duplicate answer field', () => {
    try {
      normalizePollOptions(['Pizza', ' PIZZA ']);
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          fieldErrors: [
            { field: 'poll.options.1', message: 'Answers must be different' },
          ],
        }),
      );
    }
  });
});
