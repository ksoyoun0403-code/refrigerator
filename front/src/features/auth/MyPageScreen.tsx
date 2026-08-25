import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../design-system/Button';
import { colors, radii, spacing, typography } from '../../design-system/tokens';
import { AuthUser } from './types';

const editIcon = require('../../../assets/icons/edit.png');

export function MyPageScreen({ onChangePassword, onDeleteAccount, onLogout, onUpdateNickname, user }: {
  onChangePassword(): void;
  onDeleteAccount(): Promise<void>;
  onLogout(): Promise<void>;
  onUpdateNickname(nickname: string): Promise<void>;
  user: AuthUser;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(user.nickname);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => { if (!isEditing) setNickname(user.nickname); }, [isEditing, user.nickname]);

  const save = async () => {
    const value = nickname.trim();
    if (isSaving || value === user.nickname) { setIsEditing(false); return; }
    setIsSaving(true);
    setErrorMessage(undefined);
    try {
      await onUpdateNickname(value);
      setIsEditing(false);
      Alert.alert('닉네임 변경 완료', '새 닉네임이 저장됐습니다.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '닉네임을 변경하지 못했습니다.');
    } finally { setIsSaving(false); }
  };

  const confirmLogout = () => Alert.alert('로그아웃할까요?', undefined, [
    { text: '취소', style: 'cancel' },
    { text: '로그아웃', style: 'destructive', onPress: () => void onLogout() },
  ]);

  const confirmDeleteAccount = () => Alert.alert(
    '정말로 탈퇴하시겠습니까?',
    '냉장고와 계정 정보는 삭제되며, 공유한 레시피는 익명으로 남습니다.',
    [
      { text: '아니오', style: 'cancel' },
      {
        text: '네',
        style: 'destructive',
        onPress: async () => {
          if (isDeletingAccount) return;
          setIsDeletingAccount(true);
          try {
            await onDeleteAccount();
          } catch (error) {
            setIsDeletingAccount(false);
            Alert.alert('회원 탈퇴를 완료하지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
          }
        },
      },
    ],
  );

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>My Page</Text>
      <Text style={styles.description}>계정 정보와 보안 설정을 관리할 수 있어요.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>닉네임</Text>
        {isEditing ? (
          <>
            <TextInput autoCorrect={false} editable={!isSaving} maxLength={20} onChangeText={setNickname} selectionColor={colors.brand.primary} style={styles.input} value={nickname} />
            <Text style={styles.counter}>{nickname.length}/20</Text>
            {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            <View style={styles.actions}>
              <Button disabled={isSaving} label="취소" onPress={() => { setNickname(user.nickname); setErrorMessage(undefined); setIsEditing(false); }} style={styles.actionButton} variant="secondary" />
              <Button disabled={nickname.trim().length < 2} label="저장" loading={isSaving} onPress={() => void save()} style={styles.actionButton} />
            </View>
          </>
        ) : (
          <View style={styles.valueRow}>
            <Text style={styles.nickname}>{user.nickname}</Text>
            <Pressable accessibilityLabel="닉네임 수정" accessibilityRole="button" onPress={() => setIsEditing(true)} style={styles.editButton}>
              <Image resizeMode="contain" source={editIcon} style={styles.editIcon} />
              <Text style={styles.editText}>수정</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.divider} />
        <Text style={styles.label}>아이디</Text>
        <Text style={styles.loginId}>{user.loginId}</Text>
      </View>

      <View style={styles.optionCard}>
        <Pressable accessibilityRole="button" onPress={onChangePassword} style={styles.optionRow}>
          <View><Text style={styles.optionTitle}>비밀번호 변경</Text><Text style={styles.optionDescription}>변경 후 모든 기기에서 로그아웃됩니다.</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <View style={styles.optionDivider} />
        <Pressable accessibilityRole="button" onPress={confirmLogout} style={styles.optionRow}>
          <Text style={styles.logout}>로그아웃</Text><Text style={styles.chevron}>›</Text>
        </Pressable>
        <View style={styles.optionDivider} />
        <Pressable accessibilityRole="button" disabled={isDeletingAccount} onPress={confirmDeleteAccount} style={styles.optionRow}>
          <View>
            <Text style={styles.deleteAccount}>회원 탈퇴</Text>
            <Text style={styles.optionDescription}>계정과 냉장고 정보를 영구 삭제합니다.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xxl, paddingBottom: spacing.giant },
  title: { color: colors.text.primary, ...typography.heading1 },
  description: { color: colors.text.secondary, ...typography.body, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xlarge, borderWidth: 1, marginTop: spacing.xxl, padding: spacing.xl },
  label: { color: colors.text.muted, ...typography.caption, fontWeight: '700' },
  valueRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  nickname: { color: colors.text.primary, ...typography.title },
  editButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm },
  editIcon: { height: 15, tintColor: colors.brand.action, width: 15 },
  editText: { color: colors.brand.action, ...typography.label },
  input: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderRadius: radii.medium, borderWidth: 1, color: colors.text.primary, marginTop: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, ...typography.body },
  counter: { color: colors.text.muted, ...typography.caption, marginTop: spacing.xs, textAlign: 'right' },
  error: { color: colors.danger, ...typography.caption, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: { flex: 1 },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.xl },
  loginId: { color: colors.text.primary, ...typography.bodyStrong, marginTop: spacing.sm },
  optionCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xlarge, borderWidth: 1, marginTop: spacing.lg, overflow: 'hidden' },
  optionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 68, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  optionTitle: { color: colors.text.primary, ...typography.bodyStrong },
  optionDescription: { color: colors.text.muted, ...typography.caption, marginTop: spacing.xs },
  optionDivider: { backgroundColor: colors.border, height: 1, marginHorizontal: spacing.xl },
  logout: { color: colors.danger, ...typography.bodyStrong },
  deleteAccount: { color: colors.danger, ...typography.bodyStrong },
  chevron: { color: colors.text.muted, fontSize: 28 },
});
