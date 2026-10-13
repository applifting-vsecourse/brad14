import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { Profile, ProfileUpdate } from '@/modules/profile/domain/profile';
import { ConflictException, Injectable } from '@nestjs/common';

const select = {
  id: true,
  username: true,
  name: true,
  bio: true,
  defaultMood: true,
} as const;

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  get(id: string): Promise<Profile> {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select });
  }

  async update(id: string, data: ProfileUpdate): Promise<Profile> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...data,
          username: data.username.toLowerCase(),
          displayUsername: data.username.toLowerCase(),
          defaultMood: data.defaultMood === 'none' ? null : data.defaultMood,
        },
        select,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This username is already taken');
      }
      throw error;
    }
  }
}
