export type PublicUser = {
  id: string;
  loginId: string;
  nickname: string;
  createdAt: string;
};

export type UserRecord = {
  id: string;
  loginId: string;
  loginIdKey: string;
  nickname: string;
  nicknameKey: string;
  passwordHash: string;
  createdAt: Date;
};

export function toPublicUser(user: Pick<UserRecord, 'id' | 'loginId' | 'nickname' | 'createdAt'>): PublicUser {
  return {
    id: user.id,
    loginId: user.loginId,
    nickname: user.nickname,
    createdAt: user.createdAt.toISOString(),
  };
}
