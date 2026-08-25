import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../design-system/Button';
import { colors, spacing, typography } from '../../design-system/tokens';
import { MainTabNavigator } from '../../navigation/MainTabNavigator';
import { AuthApiError, changePassword, getMe, logout, refresh, updateNickname } from './authApi';
import { AuthScreen } from './AuthScreen';
import { clearStoredSession, loadStoredSession, saveStoredSession } from './authStorage';
import { AuthSession } from './types';
import { configureAuthenticatedFetch } from './authenticatedFetch';
import { clearExpirationNotifications } from '../expiration/expirationNotifications';

type RestoreState = 'loading' | 'ready' | 'error';

export function AuthGate() {
  const [session, setSession] = useState<AuthSession>();
  const [restoreState, setRestoreState] = useState<RestoreState>('loading');
  const [restoreMessage, setRestoreMessage] = useState<string>();

  const restoreSession = useCallback(async () => {
    setRestoreState('loading');
    setRestoreMessage(undefined);
    try {
      const stored = await loadStoredSession();
      if (!stored) {
        setSession(undefined);
        setRestoreState('ready');
        return;
      }

      try {
        const user = await getMe(stored.accessToken);
        const restored = { ...stored, user };
        await saveStoredSession(restored);
        configureAuthenticatedFetch(restored);
        setSession(restored);
      } catch (error) {
        if (!(error instanceof AuthApiError) || error.status !== 401) throw error;
        try {
          const refreshed = await refresh(stored.refreshToken);
          await saveStoredSession(refreshed);
          configureAuthenticatedFetch(refreshed);
          setSession(refreshed);
        } catch (refreshError) {
          if (refreshError instanceof AuthApiError && refreshError.status === 401) {
            await clearStoredSession();
            setSession(undefined);
          } else {
            throw refreshError;
          }
        }
      }
      setRestoreState('ready');
    } catch (error) {
      setRestoreMessage(error instanceof Error ? error.message : '세션을 확인하지 못했습니다.');
      setRestoreState('error');
    }
  }, []);

  useEffect(() => { void restoreSession(); }, [restoreSession]);

  useEffect(() => {
    configureAuthenticatedFetch(session, {
      onSessionUpdated: async (nextSession) => {
        await saveStoredSession(nextSession);
        setSession(nextSession);
      },
      onSessionExpired: async () => {
        if (session) await clearExpirationNotifications(session.user.id).catch(() => undefined);
        await clearStoredSession();
        setSession(undefined);
      },
    });
  }, [session]);

  const authenticated = async (nextSession: AuthSession) => {
    await saveStoredSession(nextSession);
    configureAuthenticatedFetch(nextSession);
    setSession(nextSession);
  };

  const signOut = async () => {
    const current = session;
    if (current) await clearExpirationNotifications(current.user.id).catch(() => undefined);
    await clearStoredSession();
    configureAuthenticatedFetch(undefined);
    setSession(undefined);
    if (current) {
      try {
        await logout(current.refreshToken);
      } catch {
        // Local logout must succeed even if the backend is unavailable.
      }
    }
  };

  const changeCurrentPassword = async (currentPassword: string, newPassword: string) => {
    if (!session) return;
    await changePassword(session.accessToken, { currentPassword, newPassword });
    await clearExpirationNotifications(session.user.id).catch(() => undefined);
    await clearStoredSession();
    configureAuthenticatedFetch(undefined);
    setSession(undefined);
    Alert.alert('비밀번호 변경 완료', '보안을 위해 모든 기기에서 로그아웃했습니다. 새 비밀번호로 다시 로그인해주세요.');
  };

  const updateCurrentNickname = async (nickname: string) => {
    if (!session) throw new Error('다시 로그인해주세요.');
    const user = await updateNickname(session.accessToken, nickname);
    const nextSession = { ...session, user };
    await saveStoredSession(nextSession);
    configureAuthenticatedFetch(nextSession);
    setSession(nextSession);
  };

  if (restoreState === 'loading') {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.brand.action} />
        <Text style={styles.message}>로그인 정보를 확인하고 있어요.</Text>
      </SafeAreaView>
    );
  }

  if (restoreState === 'error') {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>로그인 정보를 확인하지 못했어요</Text>
        <Text style={styles.message}>{restoreMessage}</Text>
        <Button label="다시 시도" onPress={() => void restoreSession()} style={styles.retryButton} />
      </SafeAreaView>
    );
  }

  return session ? (
    <MainTabNavigator onChangePassword={changeCurrentPassword} onLogout={signOut} onUpdateNickname={updateCurrentNickname} user={session.user} />
  ) : (
    <AuthScreen onAuthenticated={authenticated} />
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center', padding: spacing.xxl },
  errorTitle: { color: colors.text.primary, ...typography.heading2, textAlign: 'center' },
  message: { color: colors.text.secondary, ...typography.body, marginTop: spacing.md, textAlign: 'center' },
  retryButton: { marginTop: spacing.xl, minWidth: 140 },
});
