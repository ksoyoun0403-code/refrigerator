import { PublicUser } from '../users/user';

export type AuthenticatedUser = {
  id: string;
  loginId: string;
};

export type AuthResponse = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

export type RegisterRequest = {
  loginId?: unknown;
  password?: unknown;
  nickname?: unknown;
};

export type LoginRequest = {
  loginId?: unknown;
  password?: unknown;
};

export type RefreshRequest = {
  refreshToken?: unknown;
};

export type ChangePasswordRequest = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

export type UpdateNicknameRequest = {
  nickname?: unknown;
};
