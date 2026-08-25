import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../design-system/Button';
import { colors, radii, spacing, typography } from '../../design-system/tokens';
import { login, register } from './authApi';
import { AuthSession } from './types';
import { clearSavedLoginId, loadSavedLoginId, saveLoginId } from './authStorage';

const checkIcon = require('../../../assets/icons/check.png');

type AuthMode = 'login' | 'register';

export function AuthScreen({ onAuthenticated }: { onAuthenticated(session: AuthSession): Promise<void> }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [rememberLoginId, setRememberLoginId] = useState(true);

  useEffect(() => {
    void loadSavedLoginId().then((savedLoginId) => {
      if (savedLoginId) {
        setLoginId(savedLoginId);
        setRememberLoginId(true);
      }
    });
  }, []);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setPasswordConfirmation('');
    setErrorMessage(undefined);
  };

  const submit = async () => {
    if (isSubmitting) return;
    setErrorMessage(undefined);

    if (mode === 'register' && password !== passwordConfirmation) {
      setErrorMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const session = mode === 'register'
        ? await register({ loginId, password, nickname })
        : await login({ loginId, password });
      if (rememberLoginId) await saveLoginId(session.user.loginId);
      else await clearSavedLoginId();
      await onAuthenticated(session);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>MYDISH</Text>
          <Text style={styles.title}>냉장고에서 시작하는 나만의 요리</Text>
          <Text style={styles.description}>
            로그인하고 내 냉장고와 레시피를 안전하게 관리해보세요.
          </Text>

          <View accessibilityRole="tablist" style={styles.modeTabs}>
            <ModeTab active={mode === 'login'} label="로그인" onPress={() => changeMode('login')} />
            <ModeTab active={mode === 'register'} label="회원가입" onPress={() => changeMode('register')} />
          </View>

          <View style={styles.formCard}>
            {mode === 'register' && (
              <Field
                autoCapitalize="none"
                label="닉네임"
                maxLength={20}
                onChangeText={setNickname}
                placeholder="커뮤니티에 표시할 닉네임"
                value={nickname}
              />
            )}

            {mode === 'login' && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberLoginId }}
                onPress={() => setRememberLoginId((current) => !current)}
                style={styles.rememberRow}
              >
                <View style={[styles.rememberBox, rememberLoginId && styles.rememberBoxChecked]}>
                  {rememberLoginId && <Image resizeMode="contain" source={checkIcon} style={styles.rememberCheck} />}
                </View>
                <Text style={styles.rememberText}>아이디 저장</Text>
              </Pressable>
            )}

            {mode === 'register' && (
              <View style={styles.recoveryNotice}>
                <Text style={styles.recoveryTitle}>계정 정보를 꼭 보관해주세요</Text>
                <Text style={styles.recoveryText}>이메일을 받지 않기 때문에 아이디나 비밀번호를 잊으면 계정을 복구할 수 없습니다.</Text>
              </View>
            )}
            <Field
              autoCapitalize="none"
              label="아이디"
              maxLength={30}
              onChangeText={setLoginId}
              placeholder="영문·숫자 4~30자"
              value={loginId}
            />
            <Field
              label="비밀번호"
              maxLength={128}
              onChangeText={setPassword}
              placeholder="8자 이상"
              secureTextEntry
              value={password}
            />
            {mode === 'register' && (
              <Field
                label="비밀번호 확인"
                maxLength={128}
                onChangeText={setPasswordConfirmation}
                placeholder="비밀번호를 다시 입력해주세요"
                secureTextEntry
                value={passwordConfirmation}
              />
            )}

            {errorMessage && (
              <View accessibilityLiveRegion="polite" style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Button
              label={mode === 'register' ? '회원가입하고 시작하기' : '로그인'}
              loading={isSubmitting}
              onPress={() => void submit()}
              style={styles.submitButton}
            />
          </View>

          <Text style={styles.notice}>
            아이디는 로그인에만 사용하고 커뮤니티에는 닉네임만 공개합니다.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...inputProps }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCorrect={false}
        placeholderTextColor={colors.text.muted}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

function ModeTab({ active, label, onPress }: { active: boolean; label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.modeTab, active && styles.modeTabActive]}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl, paddingVertical: spacing.huge },
  eyebrow: { color: colors.brand.action, ...typography.caption, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: colors.text.primary, ...typography.heading1, marginTop: spacing.xs },
  description: { color: colors.text.secondary, ...typography.body, marginTop: spacing.sm },
  modeTabs: { backgroundColor: colors.surfaceMuted, borderRadius: radii.full, flexDirection: 'row', marginTop: spacing.xxxl, padding: spacing.xs },
  modeTab: { alignItems: 'center', borderRadius: radii.full, flex: 1, minHeight: 44, justifyContent: 'center' },
  modeTabActive: { backgroundColor: colors.surface },
  modeTabText: { color: colors.text.muted, ...typography.label },
  modeTabTextActive: { color: colors.brand.action },
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xlarge, borderWidth: 1, gap: spacing.lg, marginTop: spacing.lg, padding: spacing.xl },
  field: { gap: spacing.sm },
  fieldLabel: { color: colors.text.primary, ...typography.label },
  input: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, color: colors.text.primary, fontSize: 16, minHeight: 50, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  errorCard: { backgroundColor: colors.dangerSoft, borderRadius: radii.medium, padding: spacing.md },
  errorText: { color: colors.danger, ...typography.caption },
  submitButton: { marginTop: spacing.xs },
  notice: { color: colors.text.muted, ...typography.caption, marginTop: spacing.lg, textAlign: 'center' },
  rememberRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  rememberBox: { alignItems: 'center', borderColor: colors.borderStrong, borderRadius: 6, borderWidth: 1.5, height: 24, justifyContent: 'center', width: 24 },
  rememberBoxChecked: { backgroundColor: colors.brand.action, borderColor: colors.brand.action },
  rememberCheck: { height: 15, tintColor: colors.text.inverse, width: 15 },
  rememberText: { color: colors.text.secondary, ...typography.label },
  recoveryNotice: { backgroundColor: colors.warningSoft, borderRadius: radii.medium, padding: spacing.md },
  recoveryTitle: { color: colors.warning, ...typography.label },
  recoveryText: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.xs },
});
