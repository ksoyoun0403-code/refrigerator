import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from './auth.types';
import { PrismaService } from '../database/prisma.service';

type AuthenticatedRequest = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('로그인이 필요합니다.');

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        loginId?: unknown;
        type?: unknown;
        authVersion?: unknown;
      }>(token);
      if (
        payload.type !== 'access' ||
        typeof payload.sub !== 'string' ||
        typeof payload.loginId !== 'string'
      ) {
        throw new Error('Invalid access-token payload');
      }
      const tokenAuthVersion = payload.authVersion === undefined ? 0 : payload.authVersion;
      if (!Number.isInteger(tokenAuthVersion)) throw new Error('Invalid auth version');
      const user = await this.prisma.client.user.findUnique({
        where: { id: payload.sub },
        select: { authVersion: true },
      });
      if (!user || user.authVersion !== tokenAuthVersion) {
        throw new Error('Access token was revoked');
      }
      request.user = { id: payload.sub, loginId: payload.loginId };
      return true;
    } catch {
      throw new UnauthorizedException('로그인이 만료되었습니다.');
    }
  }
}

function extractBearerToken(authorization?: string) {
  const [type, token, extra] = authorization?.trim().split(/\s+/) ?? [];
  return type?.toLowerCase() === 'bearer' && token && !extra ? token : undefined;
}
