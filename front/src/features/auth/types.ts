export type AuthUser = {
  id: string;
  loginId: string;
  nickname: string;
  createdAt: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type RegisterInput = {
  loginId: string;
  password: string;
  nickname: string;
};

export type LoginInput = {
  loginId: string;
  password: string;
};
