import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { BackHandler, Image, ImageSourcePropType, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, interaction, spacing } from '../design-system/tokens';
import { ExpirationHomeScreen } from '../features/expiration/ExpirationHomeScreen';
import { CommunityScreen } from '../features/recipes/CommunityScreen';
import { RecipeSuggestionScreen } from '../features/recipes/RecipeSuggestionScreen';
import { AuthUser } from '../features/auth/types';
import { MyPageScreen } from '../features/auth/MyPageScreen';

type MainTab = 'refrigerator' | 'recipes' | 'community';
type Destination = { tab: MainTab; communityView: 'feed' | 'cookbook' };
const mydishWordmark = require('../../assets/splash/mydish-wordmark-chef.png');
const backIcon = require('../../assets/icons/back.png');
const refrigeratorIcon = require('../../assets/icons/refrigerator.png');
const recipeGenerateIcon = require('../../assets/icons/recipe-generate.png');
const sharedRecipesIcon = require('../../assets/icons/shared-recipes.png');

export function MainTabNavigator({ onChangePassword, onLogout, onUpdateNickname, user }: {
  onChangePassword(currentPassword: string, newPassword: string): Promise<void>;
  onLogout(): Promise<void>;
  onUpdateNickname(nickname: string): Promise<void>;
  user: AuthUser;
}) {
  const { width } = useWindowDimensions();
  const isCompactWidth = width < 480;
  const [activeTab, setActiveTab] = useState<MainTab>('refrigerator');
  const [communityView, setCommunityView] = useState<'feed' | 'cookbook'>('feed');
  const [history, setHistory] = useState<Destination[]>([]);
  const [isCommunityDetailOpen, setIsCommunityDetailOpen] = useState(false);
  const [communityBackSignal, setCommunityBackSignal] = useState(0);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [requestedExpirationItemId, setRequestedExpirationItemId] = useState<string>();
  const [isMyPageOpen, setIsMyPageOpen] = useState(false);

  useEffect(() => {
    const openNotification = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (data?.type !== 'mydish.expiration-reminder' || data.userId !== user.id) return;
      setActiveTab('refrigerator');
      if (typeof data.itemId === 'string') setRequestedExpirationItemId(data.itemId);
    };
    void Notifications.getLastNotificationResponseAsync().then(openNotification);
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    return () => subscription.remove();
  }, [user.id]);

  const navigate = (next: Destination) => {
    if (next.tab === activeTab && next.communityView === communityView) return;
    setHistory((current) => [...current, { tab: activeTab, communityView }]);
    setActiveTab(next.tab);
    setCommunityView(next.communityView);
  };

  const goBack = () => {
    if (isPasswordModalOpen) {
      setIsPasswordModalOpen(false);
      return true;
    }
    if (isMyPageOpen) {
      setIsMyPageOpen(false);
      return true;
    }
    if (activeTab === 'community' && isCommunityDetailOpen) {
      setCommunityBackSignal((current) => current + 1);
      return true;
    }
    if (history.length === 0) return false;
    const previous = history[history.length - 1];
    setHistory((current) => current.slice(0, -1));
    setActiveTab(previous.tab);
    setCommunityView(previous.communityView);
    return true;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  });

  const canGoBack = isMyPageOpen || history.length > 0 || isCommunityDetailOpen;

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.accountBar, isCompactWidth && styles.compactAccountBar]}>
        <Pressable
          accessibilityLabel="이전 화면으로"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={goBack}
          style={[styles.backButton, isCompactWidth && styles.compactSideButton, !canGoBack && styles.backButtonDisabled]}
        >
          <Image resizeMode="contain" source={backIcon} style={styles.backIcon} />
          <Text style={styles.backText}>뒤로</Text>
        </Pressable>
        <View pointerEvents="box-none" style={styles.headerLogoContainer}>
          <Pressable
            accessibilityLabel="냉장고 탭으로 이동"
            accessibilityRole="button"
            onPress={() => {
              setIsMyPageOpen(false);
              navigate({ tab: 'refrigerator', communityView });
            }}
            style={({ pressed }) => [styles.headerLogoFrame, isCompactWidth && styles.compactHeaderLogoFrame, pressed && styles.pressed]}
          >
            <Image accessibilityLabel="MYDISH" resizeMode="contain" source={mydishWordmark} style={[styles.headerLogo, isCompactWidth && styles.compactHeaderLogo]} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" disabled={isMyPageOpen} onPress={() => setIsMyPageOpen(true)} style={[styles.myPageButton, isCompactWidth && styles.compactSideButton, isMyPageOpen && styles.backButtonDisabled]}>
          <Text style={styles.myPageText}>My Page</Text>
        </Pressable>
      </View>
      {!isMyPageOpen && <View accessibilityRole="tablist" style={styles.tabBar}>
        <TabButton
          active={activeTab === 'refrigerator'}
          compact={isCompactWidth}
          label="냉장고"
          iconSource={refrigeratorIcon}
          onPress={() => navigate({ tab: 'refrigerator', communityView })}
        />
        <TabButton
          active={activeTab === 'recipes'}
          compact={isCompactWidth}
          label="AI 레시피 생성"
          iconSource={recipeGenerateIcon}
          onPress={() => navigate({ tab: 'recipes', communityView })}
        />
        <TabButton
          active={activeTab === 'community' && communityView === 'feed'}
          compact={isCompactWidth}
          label="공유 레시피"
          iconSource={sharedRecipesIcon}
          onPress={() => {
            navigate({ tab: 'community', communityView: 'feed' });
          }}
        />
      </View>}

      {isMyPageOpen ? (
        <MyPageScreen
          onChangePassword={() => setIsPasswordModalOpen(true)}
          onLogout={onLogout}
          onUpdateNickname={onUpdateNickname}
          user={user}
        />
      ) : (
      <>

      <View
        accessibilityElementsHidden={activeTab !== 'refrigerator'}
        importantForAccessibility={
          activeTab === 'refrigerator' ? 'auto' : 'no-hide-descendants'
        }
        style={[styles.screen, activeTab !== 'refrigerator' && styles.hiddenScreen]}
      >
        <ExpirationHomeScreen
          isActive={activeTab === 'refrigerator'}
          onRequestedItemHandled={() => setRequestedExpirationItemId(undefined)}
          requestedItemId={requestedExpirationItemId}
          userId={user.id}
        />
      </View>
      <View
        accessibilityElementsHidden={activeTab !== 'recipes'}
        importantForAccessibility={activeTab === 'recipes' ? 'auto' : 'no-hide-descendants'}
        style={[styles.screen, activeTab !== 'recipes' && styles.hiddenScreen]}
      >
        <RecipeSuggestionScreen isActive={activeTab === 'recipes'} nickname={user.nickname} />
      </View>
      <View
        accessibilityElementsHidden={activeTab !== 'community'}
        importantForAccessibility={
          activeTab === 'community' ? 'auto' : 'no-hide-descendants'
        }
        style={[styles.screen, activeTab !== 'community' && styles.hiddenScreen]}
      >
        <CommunityScreen
          backSignal={communityBackSignal}
          isActive={activeTab === 'community'}
          onDetailStateChange={setIsCommunityDetailOpen}
          onOpenCookbook={() => navigate({ tab: 'community', communityView: 'cookbook' })}
          view={communityView}
        />
      </View>
      </>
      )}
      <PasswordChangeModal
        onChangePassword={onChangePassword}
        onClose={() => setIsPasswordModalOpen(false)}
        visible={isPasswordModalOpen}
      />
    </SafeAreaView>
  );
}

function PasswordChangeModal({ onChangePassword, onClose, visible }: {
  onChangePassword(currentPassword: string, newPassword: string): Promise<void>;
  onClose(): void;
  visible: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => {
    if (isSubmitting) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
    setErrorMessage(undefined);
    onClose();
  };

  const submit = async () => {
    setErrorMessage(undefined);
    if (newPassword !== confirmation) {
      setErrorMessage('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      close();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.passwordModal}>
          <Text style={styles.modalTitle}>비밀번호 변경</Text>
          <Text style={styles.modalDescription}>변경 후 보안을 위해 모든 기기에서 로그아웃됩니다.</Text>
          <PasswordField label="현재 비밀번호" onChangeText={setCurrentPassword} value={currentPassword} />
          <PasswordField label="새 비밀번호" onChangeText={setNewPassword} value={newPassword} />
          <PasswordField label="새 비밀번호 확인" onChangeText={setConfirmation} value={confirmation} />
          {errorMessage && <Text style={styles.modalError}>{errorMessage}</Text>}
          <View style={styles.modalActions}>
            <Pressable disabled={isSubmitting} onPress={close} style={styles.modalButton}><Text style={styles.modalCancelText}>취소</Text></Pressable>
            <Pressable disabled={isSubmitting} onPress={() => void submit()} style={[styles.modalButton, styles.modalPrimaryButton]}><Text style={styles.modalPrimaryText}>{isSubmitting ? '변경 중…' : '변경'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PasswordField({ label, onChangeText, value }: { label: string; onChangeText(value: string): void; value: string }) {
  return (
    <View style={styles.passwordField}>
      <Text style={styles.passwordLabel}>{label}</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} maxLength={128} onChangeText={onChangeText} secureTextEntry style={styles.passwordInput} value={value} />
    </View>
  );
}

function TabButton({
  active,
  compact,
  iconSource,
  label,
  onPress,
}: {
  active: boolean;
  compact: boolean;
  iconSource: ImageSourcePropType;
  label: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        compact && styles.compactTabButton,
        active && styles.activeTabButton,
        pressed && styles.pressed,
      ]}
    >
      <Image resizeMode="contain" source={iconSource} style={[styles.tabIcon, { tintColor: active ? colors.brand.action : colors.text.muted }]} />
      <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[styles.tabLabel, compact && styles.compactTabLabel, active && styles.activeTabText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.canvas, flex: 1 },
  accountBar: { alignItems: 'center', backgroundColor: colors.surface, flexDirection: 'row', minHeight: 64, paddingHorizontal: spacing.md, position: 'relative' },
  compactAccountBar: { paddingHorizontal: spacing.sm },
  headerLogoContainer: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  headerLogoFrame: { alignItems: 'center', height: 40, justifyContent: 'center', overflow: 'hidden', width: 140 },
  headerLogo: { height: 110, width: 220 },
  compactHeaderLogoFrame: { height: 36, width: 112 },
  compactHeaderLogo: { height: 88, width: 176 },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: 48, minWidth: 76 },
  backIcon: { height: 14, tintColor: colors.brand.action, width: 9 },
  backButtonDisabled: { opacity: 0.25 },
  backText: { color: colors.brand.action, fontSize: 14, fontWeight: '800' },
  myPageButton: { alignItems: 'flex-end', justifyContent: 'center', marginLeft: 'auto', minHeight: 48, minWidth: 76 },
  myPageText: { color: colors.brand.action, fontSize: 14, fontWeight: '800' },
  compactSideButton: { minWidth: 64 },
  screen: { flex: 1 },
  hiddenScreen: { display: 'none' },
  tabBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  compactTabButton: { flexDirection: 'column', gap: 0, minHeight: 56, paddingHorizontal: 2 },
  activeTabButton: { backgroundColor: colors.brand.soft },
  tabIcon: { height: 20, width: 20 },
  tabLabel: { color: colors.text.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  compactTabLabel: { fontSize: 11, lineHeight: 15, maxWidth: '100%', textAlign: 'center' },
  activeTabText: { color: colors.brand.action },
  pressed: { opacity: interaction.pressedOpacity },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(43, 27, 21, 0.5)', flex: 1, justifyContent: 'center', padding: spacing.xl },
  passwordModal: { backgroundColor: colors.surface, borderRadius: 24, gap: spacing.md, maxWidth: 500, padding: spacing.xl, width: '100%' },
  modalTitle: { color: colors.text.primary, fontSize: 20, fontWeight: '800' },
  modalDescription: { color: colors.text.secondary, fontSize: 14, lineHeight: 20 },
  passwordField: { gap: spacing.xs },
  passwordLabel: { color: colors.text.primary, fontSize: 13, fontWeight: '700' },
  passwordInput: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text.primary, minHeight: 48, paddingHorizontal: spacing.md },
  modalError: { color: colors.danger, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalButton: { alignItems: 'center', borderColor: colors.borderStrong, borderRadius: 999, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  modalPrimaryButton: { backgroundColor: colors.brand.action, borderColor: colors.brand.action },
  modalCancelText: { color: colors.text.secondary, fontSize: 15, fontWeight: '800' },
  modalPrimaryText: { color: colors.text.inverse, fontSize: 15, fontWeight: '800' },
});
