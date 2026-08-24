import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { validateUpdateNicknameRequest } from '../auth/auth-validation';
import { toPublicUser } from './user';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  findByLoginIdKey(loginIdKey: string) {
    return this.prisma.client.user.findUnique({ where: { loginIdKey } });
  }

  async updateNickname(userId: string, input: unknown) {
    const request = validateUpdateNicknameRequest(input);
    const current = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!current) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    if (current.nicknameKey === request.nicknameKey) {
      return toPublicUser(current);
    }
    try {
      const updated = await this.prisma.client.user.update({
        where: { id: userId },
        data: request,
      });
      return toPublicUser(updated);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('이미 사용 중인 닉네임입니다.');
      }
      throw error;
    }
  }
}
