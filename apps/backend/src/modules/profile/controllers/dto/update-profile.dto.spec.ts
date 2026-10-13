import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

const valid = {
  username: 'duck.name_1',
  name: 'Duck',
  bio: '',
  defaultMood: 'none',
};
describe('Profile validation', () => {
  it.each(['abc', 'a'.repeat(30), 'Duck_123.name'])(
    'accepts username %s',
    async (username) => {
      expect(
        await validate(
          plainToInstance(UpdateProfileDto, { ...valid, username }),
        ),
      ).toEqual([]);
    },
  );
  it.each(['ab', 'a'.repeat(31), 'duck name', 'duck-name', 'duck@name'])(
    'rejects username %s',
    async (username) => {
      expect(
        (
          await validate(
            plainToInstance(UpdateProfileDto, { ...valid, username }),
          )
        ).map((e) => e.property),
      ).toContain('username');
    },
  );
  it.each([
    { name: '   ' },
    { bio: 'a'.repeat(161) },
    { defaultMood: 'unknown' },
  ])('rejects invalid profile %s', async (data) => {
    expect(
      await validate(plainToInstance(UpdateProfileDto, { ...valid, ...data })),
    ).not.toEqual([]);
  });
  it('accepts a 160-character bio and trims the display name', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      ...valid,
      name: ' Duck ',
      bio: 'a'.repeat(160),
      defaultMood: 'silly',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.name).toBe('Duck');
  });
});
