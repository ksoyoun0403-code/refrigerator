import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { toPublicUser } from '../users/user';
import { UsersService } from '../users/users.service';
import {
  validateLoginRequest,
  validateChangePasswordRequest,
  validateRefreshRequest,
  validateRegisterRequest,
} from './auth-validation';
import { AuthResponse } from './auth.types';
import { PasswordHasher } from './password-hasher';

const REFRESH_TOKEN_DAYS = 30;
type SessionUser = Parameters<typeof toPublicUser>[0] & { authVersion: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: unknown): Promise<AuthResponse> {
    const request = validateRegisterRequest(input);
    const passwordHash = await this.passwordHasher.hash(request.password);
    const refreshToken = createRefreshToken();

    try {
      const user = await this.prisma.client.$transaction(async (transaction) => {
        const created = await transaction.user.create({
          data: {
            loginId: request.loginId,
            loginIdKey: request.loginIdKey,
            nickname: request.nickname,
            nicknameKey: request.nicknameKey,
            passwordHash,
          },
        });
        await transaction.authSession.create({
          data: {
            userId: created.id,
            refreshTokenHash: tokenHash(refreshToken),
            expiresAt: refreshExpiration(),
          },
        });
        return created;
      });
      return this.buildResponse(user, refreshToken);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('이미 사용 중인 아이디 또는 닉네임입니다.');
      }
      throw error;
    }
  }

  async login(input: unknown): Promise<AuthResponse> {
    const request = validateLoginRequest(input);
    const user = await this.users.findByLoginIdKey(request.loginIdKey);
    if (!user || !(await this.passwordHasher.verify(request.password, user.passwordHash))) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    return this.issueSession(user);
  }

  async refresh(input: unknown): Promise<AuthResponse> {
    const { refreshToken } = validateRefreshRequest(input);
    const refreshTokenHash = tokenHash(refreshToken);
    const session = await this.prisma.client.authSession.findUnique({
      where: { refreshTokenHash },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await this.prisma.client.authSession.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('다시 로그인해주세요.');
    }

    const nextRefreshToken = createRefreshToken();
    const rotated = await this.prisma.client.authSession.updateMany({
      where: { id: session.id, refreshTokenHash },
      data: {
        refreshTokenHash: tokenHash(nextRefreshToken),
        expiresAt: refreshExpiration(),
      },
    });
    if (rotated.count !== 1) {
      throw new UnauthorizedException('다시 로그인해주세요.');
    }
    return this.buildResponse(session.user, nextRefreshToken);
  }

  async logout(input: unknown) {
    const { refreshToken } = validateRefreshRequest(input);
    await this.prisma.client.authSession.deleteMany({
      where: { refreshTokenHash: tokenHash(refreshToken) },
    });
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    return toPublicUser(user);
  }

  async changePassword(userId: string, input: unknown) {
    const request = validateChangePasswordRequest(input);
    const user = await this.users.findById(userId);
    if (!user || !(await this.passwordHasher.verify(request.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');
    }
    const passwordHash = await this.passwordHasher.hash(request.newPassword);
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: userId },
        data: { passwordHash, authVersion: { increment: 1 } },
      }),
      this.prisma.client.authSession.deleteMany({ where: { userId } }),
    ]);
  }

  private async issueSession(user: SessionUser) {
    const refreshToken = createRefreshToken();
    await this.prisma.client.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: tokenHash(refreshToken),
        expiresAt: refreshExpiration(),
      },
    });
    return this.buildResponse(user, refreshToken);
  }

  private async buildResponse(
    user: SessionUser,
    refreshToken: string,
  ): Promise<AuthResponse> {
    return {
      user: toPublicUser(user),
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        loginId: user.loginId,
        type: 'access',
        authVersion: user.authVersion,
      }),
      refreshToken,
    };
  }
}

function createRefreshToken() {
  return randomBytes(48).toString('base64url');
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function refreshExpiration() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + REFRESH_TOKEN_DAYS);
  return date;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
