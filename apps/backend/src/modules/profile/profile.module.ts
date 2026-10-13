import { PrismaModule } from '@/core/prisma/prisma.module';
import { ProfileService } from '@/modules/profile/services/profile.service';
import { AuthModule } from '@/shared/auth/auth.module';
import { Module } from '@nestjs/common';
import { ProfileController } from './controllers/profile.controller';
import { ProfileRepository } from './repositories/profile.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProfileController],
  providers: [ProfileRepository, ProfileService],
})
export class ProfileModule {}
