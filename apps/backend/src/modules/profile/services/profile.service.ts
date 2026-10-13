import { Profile, ProfileUpdate } from '@/modules/profile/domain/profile';
import { ProfileRepository } from '@/modules/profile/repositories/profile.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProfileService {
  constructor(private readonly profiles: ProfileRepository) {}
  get(id: string): Promise<Profile> {
    return this.profiles.get(id);
  }
  update(id: string, data: ProfileUpdate): Promise<Profile> {
    return this.profiles.update(id, data);
  }
}
