import { Profile } from '@/modules/profile/domain/profile';
import { ProfileService } from '@/modules/profile/services/profile.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('profile')
@ApiCookieAuth()
@Controller('profile')
@UseGuards(AuthenticatedUserGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  get(@User() user: Identity): Promise<Profile> {
    return this.profiles.get(user.id);
  }

  @Put()
  update(
    @User() user: Identity,
    @Body() body: UpdateProfileDto,
  ): Promise<Profile> {
    return this.profiles.update(user.id, body);
  }
}
