import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button } from '../../design-system/Button';
import { colors, interaction, radii, spacing, typography } from '../../design-system/tokens';
import {
  deleteExpirationItem,
  getExpirationItems,
  updateExpirationItem,
} from './expirationApi';
import { ExpirationImageScanner } from './ExpirationImageScanner';
import { ExpirationRegistrationForm } from './ExpirationRegistrationForm';
import {
  DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS,
  ExpirationNotificationSettings,
  ExpirationReminderDay,
  ExpirationNotificationStatus,
  getExpirationReminderDate,
  hasShownExpirationNotificationPermissionOnboarding,
  loadExpirationNotificationSettings,
  markExpirationNotificationPermissionOnboardingShown,
  requestExpirationNotificationAccess,
  saveExpirationNotificationSettings,
  syncExpirationNotifications,
} from './expirationNotifications';
import { ExpirationItem } from './types';

const notificationSettingsIcon = require('../../../assets/icons/notification-settings.png');
const checkIcon = require('../../../assets/icons/check.png');

type ManageMode = 'idle' | 'editing' | 'deleting';

type PreviousPlacement = {
  id: string;
  section: ExpirationItem['section'];
};

type RegistrationFeedback = {
  excludedDays: ExpirationReminderDay[];
  itemName: string;
  notificationStatus: ExpirationNotificationStatus;
  remainingDays?: number;
  scheduledDays: ExpirationReminderDay[];
  settings: ExpirationNotificationSettings;
};

export function ExpirationHomeScreen({ isActive, onRequestedItemHandled, requestedItemId, userId }: {
  isActive: boolean;
  onRequestedItemHandled(): void;
  requestedItemId?: string;
  userId: string;
}) {
  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ExpirationItem>();
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string>();
  const [manageMode, setManageMode] = useState<ManageMode>('idle');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMovingSelection, setIsMovingSelection] = useState(false);
  const [previousPlacement, setPreviousPlacement] = useState<PreviousPlacement[]>();
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<ExpirationNotificationStatus>();
  const [notificationSettings, setNotificationSettings] = useState<ExpirationNotificationSettings>(DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS);
  const [notificationSettingsDraft, setNotificationSettingsDraft] = useState<ExpirationNotificationSettings>(DEFAULT_EXPIRATION_NOTIFICATION_SETTINGS);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isSavingNotificationSettings, setIsSavingNotificationSettings] = useState(false);
  const [registrationFeedback, setRegistrationFeedback] = useState<RegistrationFeedback>();

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedItems = await getExpirationItems();
      setItems(loadedItems);
      const status = await syncExpirationNotifications(userId, loadedItems);
      setNotificationStatus(status);
      return status;
    } catch {
      return 'error' as const;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const requestNotificationAccess = useCallback(async () => {
    const status = await requestExpirationNotificationAccess();
    setNotificationStatus(status);
    if (status === 'enabled') await loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (isActive) void loadItems();
  }, [isActive, loadItems]);

  useEffect(() => {
    if (!isActive) return;
    void hasShownExpirationNotificationPermissionOnboarding().then(async (shown) => {
      if (shown) return;
      await markExpirationNotificationPermissionOnboardingShown();
      Alert.alert(
        '유통기한 알림을 받아보세요',
        'MYDISH가 설정한 날짜와 시간에 냉장고 재료의 유통기한을 알려드려요. 권한은 나중에 알림 설정에서도 변경할 수 있습니다.',
        [
          { text: '나중에', style: 'cancel' },
          { text: '권한 설정', onPress: () => void requestNotificationAccess() },
        ],
      );
    }).catch(() => undefined);
  }, [isActive, requestNotificationAccess]);

  useEffect(() => {
    void loadExpirationNotificationSettings(userId).then(setNotificationSettings);
  }, [userId]);

  useEffect(() => {
    if (!requestedItemId || isLoading) return;
    const requested = items.find(({ id }) => id === requestedItemId);
    if (requested) setSelectedItem(requested);
    onRequestedItemHandled();
  }, [isLoading, items, onRequestedItemHandled, requestedItemId]);

  const openNotificationSettings = () => {
    setNotificationSettingsDraft(notificationSettings);
    setIsNotificationSettingsOpen(true);
  };

  const closeNotificationSettings = () => {
    if (isSavingNotificationSettings) return;
    setNotificationSettingsDraft(notificationSettings);
    setIsNotificationSettingsOpen(false);
  };

  const confirmNotificationSettings = async () => {
    if (isSavingNotificationSettings) return;
    setIsSavingNotificationSettings(true);
    try {
      await saveExpirationNotificationSettings(userId, notificationSettingsDraft);
      setNotificationStatus(await syncExpirationNotifications(userId, items, notificationSettingsDraft));
      setNotificationSettings(notificationSettingsDraft);
      setIsNotificationSettingsOpen(false);
      Alert.alert('알림 설정 저장 완료', '변경한 알림 설정이 저장되었습니다.');
    } catch (error) {
      Alert.alert('알림 설정을 저장하지 못했어요', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setIsSavingNotificationSettings(false);
    }
  };

  const openNotificationTimePicker = () => {
    const value = new Date();
    value.setHours(notificationSettingsDraft.hour, notificationSettingsDraft.minute, 0, 0);
    DateTimePickerAndroid.open({
      display: 'clock',
      is24Hour: false,
      minuteInterval: 5,
      mode: 'time',
      onChange: (_event, selectedDate) => {
        if (!selectedDate) return;
        const totalMinutes = Math.round((selectedDate.getHours() * 60 + selectedDate.getMinutes()) / 5) * 5;
        setNotificationSettingsDraft((current) => ({
          ...current,
          hour: Math.floor(totalMinutes / 60) % 24,
          minute: totalMinutes % 60,
        }));
      },
      value,
    });
  };

  const toggleNotificationDay = (day: ExpirationReminderDay) => {
    setNotificationSettingsDraft((current) => {
      const selected = current.daysBefore.includes(day);
      if (selected && current.daysBefore.length === 1) return current;
      const daysBefore = selected
        ? current.daysBefore.filter((value) => value !== day)
        : [...current.daysBefore, day].sort((left, right) => right - left);
      return { ...current, daysBefore };
    });
  };

  const itemRegistered = async (item: ExpirationItem) => {
    setIsManualFormOpen(false);
    setItems((current) => sortItemsForDisplay([...current, item]));
    const status = await loadItems();
    setRegistrationFeedback(createRegistrationFeedback(item, notificationSettings, status));
  };

  const removeItem = async (item: ExpirationItem) => {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      await deleteExpirationItem(item.id);
      await loadItems();
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    } catch (error) {
      Alert.alert(
        '삭제하지 못했어요',
        error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setDeletingId(undefined);
    }
  };

  const confirmDelete = (item: ExpirationItem) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${item.name}을(를) 삭제하면 연결된 스캔 기록도 함께 사라져요.\n\n삭제할까요?`)) {
        void removeItem(item);
      }
      return;
    }

    Alert.alert(
      '재료를 삭제할까요?',
      `${item.name}을(를) 삭제하면 연결된 스캔 기록도 함께 사라져요.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => void removeItem(item) },
      ],
    );
  };

  const deleteSelectedItems = async () => {
    if (deletingId || selectedIds.size === 0) return;
    const selectedItems = items.filter(({ id }) => selectedIds.has(id));
    setDeletingId('selection');
    const deletedIds = new Set<string>();
    const failedIds = new Set<string>();
    for (const item of selectedItems) {
      try {
        await deleteExpirationItem(item.id);
        deletedIds.add(item.id);
      } catch {
        failedIds.add(item.id);
      }
    }
    const remainingItems = items.filter(({ id }) => !deletedIds.has(id));
    setItems(remainingItems);
    setSelectedIds(failedIds);
    setDeletingId(undefined);
    void syncExpirationNotifications(userId, remainingItems).then(setNotificationStatus);

    if (failedIds.size === 0) {
      setManageMode('idle');
    } else {
      Alert.alert(
        '일부 재료를 삭제하지 못했어요',
        `${deletedIds.size}개는 삭제했고 ${failedIds.size}개는 삭제하지 못했습니다. 다시 시도해주세요.`,
      );
    }
  };

  const confirmDeleteSelection = () => {
    if (selectedIds.size === 0) return;
    if (Platform.OS === 'web') {
      if (window.confirm(`${selectedIds.size}개 재료를 삭제하면 연결된 스캔 기록도 함께 사라집니다.\n\n삭제할까요?`)) {
        void deleteSelectedItems();
      }
      return;
    }

    Alert.alert(
      '선택한 재료를 삭제할까요?',
      `${selectedIds.size}개 재료를 삭제하면 연결된 스캔 기록도 함께 사라집니다.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => void deleteSelectedItems() },
      ],
    );
  };

  const enterManageMode = (mode: Exclude<ManageMode, 'idle'>) => {
    setManageMode(mode);
    setSelectedIds(new Set());
    setPreviousPlacement(undefined);
  };

  const exitManageMode = () => {
    if (isMovingSelection || deletingId) return;
    setManageMode('idle');
    setSelectedIds(new Set());
    setPreviousPlacement(undefined);
  };

  const toggleSelection = (item: ExpirationItem) => {
    if (isMovingSelection || deletingId) return;
    if (manageMode === 'editing' && !selectedIds.has(item.id)) {
      const firstSelectedItem = items.find(({ id }) => selectedIds.has(id));
      if (firstSelectedItem && firstSelectedItem.section !== item.section) {
        Alert.alert(
          '같은 영역의 재료만 선택할 수 있어요',
          '현재 선택을 취소한 뒤 다른 영역의 재료를 선택해주세요.',
        );
        return;
      }
    }
    setPreviousPlacement(undefined);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const clearSelection = () => {
    if (isMovingSelection || deletingId) return;
    setSelectedIds(new Set());
    setPreviousPlacement(undefined);
  };

  const moveSelection = async (section: ExpirationItem['section']) => {
    if (isMovingSelection || selectedIds.size === 0) return;
    const movingItems = items.filter(
      (item) => selectedIds.has(item.id) && item.section !== section,
    );
    if (movingItems.length === 0) {
      Alert.alert('이동할 재료가 없어요', '선택한 재료가 이미 해당 영역에 있습니다.');
      return;
    }

    setIsMovingSelection(true);
    const updatedItems: ExpirationItem[] = [];
    const failedItems: ExpirationItem[] = [];
    for (const item of movingItems) {
      try {
        updatedItems.push(await updateExpirationItem(item.id, { section }));
      } catch {
        failedItems.push(item);
      }
    }

    const updatedById = new Map(updatedItems.map((item) => [item.id, item]));
    setItems((current) => sortItemsForDisplay(
      current.map((item) => updatedById.get(item.id) ?? item),
    ));
    setSelectedIds(new Set(failedItems.map((item) => item.id)));
    setPreviousPlacement(
      updatedItems.length > 0
        ? updatedItems.map((item) => ({
            id: item.id,
            section: movingItems.find(({ id }) => id === item.id)!.section,
          }))
        : undefined,
    );
    setIsMovingSelection(false);

    if (failedItems.length > 0) {
      Alert.alert(
        '일부 재료를 이동하지 못했어요',
        `${updatedItems.length}개는 이동했고 ${failedItems.length}개는 이동하지 못했습니다. 다시 시도해주세요.`,
      );
    }
  };

  const undoMove = async () => {
    if (!previousPlacement || isMovingSelection) return;
    const placement = previousPlacement;
    setPreviousPlacement(undefined);
    setIsMovingSelection(true);
    const restoredItems: ExpirationItem[] = [];
    let failureCount = 0;
    for (const previous of placement) {
      try {
        restoredItems.push(
          await updateExpirationItem(previous.id, { section: previous.section }),
        );
      } catch {
        failureCount += 1;
      }
    }
    const restoredById = new Map(restoredItems.map((item) => [item.id, item]));
    setItems((current) => sortItemsForDisplay(
      current.map((item) => restoredById.get(item.id) ?? item),
    ));
    setIsMovingSelection(false);
    if (failureCount > 0) {
      Alert.alert('일부 이동을 되돌리지 못했어요', '목록을 새로 불러와 상태를 확인해주세요.');
      await loadItems();
    }
  };

  const itemUpdated = async (updatedItem: ExpirationItem) => {
    setSelectedItem(undefined);
    setItems((current) =>
      current.map((item) => item.id === updatedItem.id ? updatedItem : item),
    );
    await loadItems();
    Alert.alert('수정 완료', `${updatedItem.name} 정보를 수정했습니다.`);
  };

  if (selectedItem) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
          <ScrollView contentContainerStyle={styles.editContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.editPageTitle}>식재료 정보</Text>
            <ExpirationRegistrationForm
              item={selectedItem}
              onCancel={() => setSelectedItem(undefined)}
              onUpdated={itemUpdated}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const useSoonItems = items.filter((item) => item.section === 'USE_SOON');
  const defaultItems = items.filter((item) => item.section === 'DEFAULT');
  const selectedSection = items.find((item) => selectedIds.has(item.id))?.section;
  const targetSection = selectedSection === 'DEFAULT' ? 'USE_SOON' : 'DEFAULT';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isManualFormOpen && styles.containerWithRegistrationForm,
          manageMode !== 'idle' && styles.containerWithSelectionBar,
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>재료 추가</Text>

        {notificationStatus === 'denied' && (
          <View style={styles.notificationNotice}>
            <Text style={styles.notificationNoticeTitle}>유통기한 알림이 꺼져 있어요</Text>
            <Text style={styles.notificationNoticeText}>
              휴대폰 설정에서 MYDISH 알림을 허용하면 선택한 시점과 시간에 알려드려요.
            </Text>
            <Pressable onPress={() => void requestNotificationAccess()}>
              <Text style={styles.notificationRetry}>알림 권한 설정</Text>
            </Pressable>
          </View>
        )}
        {notificationStatus === 'error' && (
          <View style={styles.notificationNotice}>
            <Text style={styles.notificationNoticeTitle}>알림 예약을 확인하지 못했어요</Text>
            <Pressable onPress={() => void loadItems()}>
              <Text style={styles.notificationRetry}>다시 시도</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.notificationSettingsToggle}>
          <Pressable accessibilityRole="button" onPress={isNotificationSettingsOpen ? closeNotificationSettings : openNotificationSettings} style={styles.notificationSettingsButton}>
            <Image resizeMode="contain" source={notificationSettingsIcon} style={styles.notificationSettingsIcon} />
            <Text style={styles.notificationSettingsToggleText}>알림 설정</Text>
          </Pressable>
          <Text style={styles.notificationSettingsSummary}>
            {notificationSettings.enabled ? `${formatReminderDays(notificationSettings.daysBefore)} · ${formatNotificationTime(notificationSettings.hour, notificationSettings.minute)}` : '사용 안 함'}
          </Text>
        </View>
        {isNotificationSettingsOpen && (
          <View style={styles.notificationSettingsCard}>
            <View style={styles.notificationSettingsCardHeader}>
              <Text style={styles.notificationSettingsCardTitle}>알림 설정 변경</Text>
              <Pressable
                accessibilityLabel="알림 설정 닫기"
                accessibilityRole="button"
                disabled={isSavingNotificationSettings}
                onPress={closeNotificationSettings}
                style={({ pressed }) => [styles.notificationSettingsCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.notificationSettingsCloseText}>×</Text>
              </Pressable>
            </View>
          <SettingChoices
              label="알림"
              options={[{ label: '사용', value: true }, { label: '끄기', value: false }]}
              selected={notificationSettingsDraft.enabled}
              onSelect={(enabled) => setNotificationSettingsDraft((current) => ({ ...current, enabled }))}
            />
            <MultipleSettingChoices
              label="알림 시점"
              options={[{ label: '2일 전', value: 2 }, { label: '1일 전', value: 1 }, { label: '당일', value: 0 }]}
              selected={notificationSettingsDraft.daysBefore}
              onToggle={toggleNotificationDay}
            />
            <View>
              <Text style={styles.settingLabel}>알림 시간</Text>
              <Pressable
                accessibilityLabel={`알림 시간 ${formatNotificationTime(notificationSettingsDraft.hour, notificationSettingsDraft.minute)}`}
                accessibilityRole="button"
                onPress={openNotificationTimePicker}
                style={({ pressed }) => [styles.notificationTimeButton, pressed && styles.pressed]}
              >
                <Text style={styles.notificationTimeValue}>{formatNotificationTime(notificationSettingsDraft.hour, notificationSettingsDraft.minute)}</Text>
                <Text style={styles.notificationTimeAction}>시간 변경</Text>
              </Pressable>
            </View>
            {Platform.OS === 'android' && (
              <Button
                label="Android 알림 권한 확인"
                onPress={() => void requestNotificationAccess()}
                variant="secondary"
              />
            )}
            <Button label="저장" loading={isSavingNotificationSettings} onPress={() => void confirmNotificationSettings()} style={styles.notificationSettingsSaveButton} />
          </View>
        )}

        <ExpirationImageScanner onRegistered={itemRegistered} />
        {isManualFormOpen ? (
          <ExpirationRegistrationForm
            manual
            onCancel={() => setIsManualFormOpen(false)}
            onRegistered={itemRegistered}
          />
        ) : (
          <Button
            label="직접 입력"
            onPress={() => setIsManualFormOpen(true)}
            style={styles.manualButton}
            variant="secondary"
          />
        )}

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>보관 중인 식재료</Text>
          {manageMode === 'idle' ? (
            <View style={styles.manageActions}>
              {items.length > 0 && (
                <>
                  <Pressable onPress={() => enterManageMode('editing')} style={styles.manageButton}>
                    <Text style={styles.manageButtonText}>재료 이동</Text>
                  </Pressable>
                  <Pressable onPress={() => enterManageMode('deleting')} style={styles.deleteModeButton}>
                    <Text style={styles.deleteModeButtonText}>삭제</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : manageMode === 'deleting' ? (
            <Pressable disabled={isMovingSelection || Boolean(deletingId)} onPress={exitManageMode}>
              <Text style={styles.doneAction}>완료</Text>
            </Pressable>
          ) : null}
        </View>

        {manageMode === 'editing' && (
          <Text style={styles.modeDescription}>
            옮길 재료를 선택한 뒤 이동할 영역을 눌러주세요.
          </Text>
        )}
        {manageMode === 'deleting' && (
          <Text style={styles.modeDescription}>
            삭제할 재료를 여러 개 선택한 뒤 아래 삭제 버튼을 눌러주세요.
          </Text>
        )}

        {isLoading ? (
          <ActivityIndicator color={colors.brand.action} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 등록한 식품이 없어요</Text>
            <Text style={styles.emptyDescription}>첫 번째 사진을 찍어서 재료를 추가해보세요.</Text>
          </View>
        ) : (
          <View style={styles.itemGroups}>
            <View>
              <Text style={styles.groupTitle}>사용 임박</Text>
              {useSoonItems.length > 0 ? (
                <ItemGroup
                  deletingId={deletingId}
                  items={useSoonItems}
                  manageMode={manageMode}
                  onDelete={confirmDelete}
                  onEdit={setSelectedItem}
                  onSelect={toggleSelection}
                  selectedIds={selectedIds}
                />
              ) : (
                <View style={styles.emptyDropZone}>
                  <Text style={styles.emptyDropText}>사용 임박 재료가 없어요</Text>
                </View>
              )}
            </View>

            {defaultItems.length > 0 && (
              <View>
                <Text style={styles.groupTitle}>일반 냉장고</Text>
                <ItemGroup
                  deletingId={deletingId}
                  items={defaultItems}
                  manageMode={manageMode}
                  onDelete={confirmDelete}
                  onEdit={setSelectedItem}
                  onSelect={toggleSelection}
                  selectedIds={selectedIds}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {manageMode === 'editing' && (
        <View style={styles.selectionBar}>
          <View style={styles.undoRow}>
            <Text style={previousPlacement && previousPlacement.length > 0 ? styles.undoMessage : styles.selectionCount}>
              {previousPlacement && previousPlacement.length > 0
                ? `${previousPlacement.length}개 재료를 이동했어요.`
                : `선택 ${selectedIds.size}개`}
            </Text>
            <View style={styles.editingFinishActions}>
              {previousPlacement && previousPlacement.length > 0 && (
                <Pressable disabled={isMovingSelection} onPress={() => void undoMove()}>
                  <Text style={[styles.editingAction, styles.undoAction]}>되돌리기</Text>
                </Pressable>
              )}
              <Pressable disabled={isMovingSelection} onPress={exitManageMode}>
                <Text style={[styles.editingAction, styles.finishEditingAction]}>완료</Text>
              </Pressable>
            </View>
          </View>
          {selectedSection && (
            <View style={styles.placementActions}>
              <Button
                disabled={isMovingSelection}
                label="선택 취소"
                onPress={clearSelection}
                style={styles.cancelSelectionButton}
                variant="secondary"
              />
              <Button
                disabled={isMovingSelection}
                label={targetSection === 'USE_SOON'
                  ? '사용 임박으로 이동'
                  : '일반 냉장고로 이동'}
                loading={isMovingSelection}
                onPress={() => void moveSelection(targetSection)}
                style={styles.placementButton}
              />
            </View>
          )}
        </View>
      )}
      {manageMode === 'deleting' && (
        <View style={styles.selectionBar}>
          <Text style={styles.deleteSelectionCount}>선택 {selectedIds.size}개</Text>
          <View style={styles.placementActions}>
            <Button
              disabled={Boolean(deletingId) || selectedIds.size === 0}
              label="선택 취소"
              onPress={clearSelection}
              style={styles.cancelSelectionButton}
              variant="secondary"
            />
            <Button
              disabled={selectedIds.size === 0}
              label={`${selectedIds.size}개 삭제`}
              loading={Boolean(deletingId)}
              onPress={confirmDeleteSelection}
              style={styles.placementButton}
              variant="danger"
            />
          </View>
        </View>
      )}
      <RegistrationCompleteSheet
        feedback={registrationFeedback}
        onClose={() => setRegistrationFeedback(undefined)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createRegistrationFeedback(
  item: ExpirationItem,
  settings: ExpirationNotificationSettings,
  notificationStatus: ExpirationNotificationStatus,
  now = new Date(),
) : RegistrationFeedback {
  const remainingDays = getCalendarDaysUntil(item.expirationDate, now);
  const scheduledDays = remainingDays === undefined || !settings.enabled || notificationStatus !== 'enabled'
    ? []
    : settings.daysBefore.filter((daysBefore) =>
    Boolean(getExpirationReminderDate(item.expirationDate, now, settings, daysBefore)),
  );
  const excludedDays = settings.daysBefore.filter((daysBefore) => !scheduledDays.includes(daysBefore));
  return { excludedDays, itemName: item.name, notificationStatus, remainingDays, scheduledDays, settings };
}

function RegistrationCompleteSheet({ feedback, onClose }: {
  feedback?: RegistrationFeedback;
  onClose(): void;
}) {
  if (!feedback) return null;
  const { excludedDays, itemName, notificationStatus, remainingDays, scheduledDays, settings } = feedback;
  const dDay = remainingDays === undefined ? '기한 미입력' : remainingDays === 0 ? 'D-DAY' : `D-${remainingDays}`;
  const consumptionMessage = remainingDays === undefined
    ? '유통기한을 입력하면 소비 시점을 안내해드려요.'
    : remainingDays === 0
      ? '오늘 안에 소비해주세요.'
      : `${remainingDays}일 이내에 소비해주세요.`;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <View style={styles.registrationBackdrop}>
        <SafeAreaView edges={['bottom']} style={styles.registrationSheet}>
          <View style={styles.registrationHandle} />
          <Text style={styles.registrationEyebrow}>냉장고에 추가했어요</Text>
          <View style={styles.registrationTitleRow}>
            <Text numberOfLines={2} style={styles.registrationItemName}>{itemName}</Text>
            <Text style={styles.registrationDDay}>{dDay}</Text>
          </View>
          <Text style={styles.registrationConsumption}>{consumptionMessage}</Text>

          <View style={styles.registrationNotificationBox}>
            <Text style={styles.registrationSectionTitle}>알림 예정</Text>
            {remainingDays === undefined ? (
              <Text style={styles.registrationMuted}>유통기한이 없어 알림이 예약되지 않았습니다.</Text>
            ) : !settings.enabled ? (
              <Text style={styles.registrationMuted}>유통기한 알림을 사용하지 않고 있습니다.</Text>
            ) : notificationStatus === 'denied' ? (
              <Text style={styles.registrationWarning}>휴대폰 알림 권한이 꺼져 있어 예약되지 않았습니다.</Text>
            ) : notificationStatus === 'error' ? (
              <Text style={styles.registrationWarning}>알림 예약 상태를 확인하지 못했습니다.</Text>
            ) : scheduledDays.length === 0 ? (
              <Text style={styles.registrationWarning}>선택한 알림 시점이 모두 지나 예약되지 않았습니다.</Text>
            ) : (
              <>
                <View style={styles.registrationReminderRow}>
                  {scheduledDays.map((day) => <Text key={day} style={styles.registrationReminderChip}>{day === 0 ? '당일' : `${day}일 전`}</Text>)}
                </View>
                <Text style={styles.registrationTime}>{formatNotificationTime(settings.hour, settings.minute)}</Text>
                {excludedDays.length > 0 && (
                  <Text style={styles.registrationWarning}>{formatReminderDays(excludedDays)} 알림은 이미 지나 제외됐습니다.</Text>
                )}
              </>
            )}
          </View>
          {notificationStatus === 'denied' && settings.enabled && (
            <Button label="휴대폰 설정 열기" onPress={() => void Linking.openSettings()} style={styles.registrationSettingsButton} variant="secondary" />
          )}
          <Button label="확인" onPress={onClose} style={styles.registrationConfirmButton} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function getCalendarDaysUntil(expirationDate: string | null, now: Date) {
  if (!expirationDate) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expirationDate);
  if (!match) return undefined;
  const expirationDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((expirationDay - today) / 86_400_000));
}

function formatNotificationTime(hour: number, minute: number) {
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
}

function formatReminderDays(days: ExpirationReminderDay[]) {
  return [...days]
    .sort((left, right) => right - left)
    .map((day) => day === 0 ? '당일' : `${day}일 전`)
    .join(', ');
}

function SettingChoices<T extends string | number | boolean>({ label, onSelect, options, selected }: {
  label: string;
  onSelect(value: T): void;
  options: { label: string; value: T }[];
  selected: T;
}) {
  return (
    <View>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingChoices}>
        {options.map((option) => (
          <Pressable key={String(option.value)} onPress={() => onSelect(option.value)} style={[styles.settingChoice, option.value === selected && styles.settingChoiceSelected]}>
            <Text style={[styles.settingChoiceText, option.value === selected && styles.settingChoiceTextSelected]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MultipleSettingChoices({ label, onToggle, options, selected }: {
  label: string;
  onToggle(value: ExpirationReminderDay): void;
  options: { label: string; value: ExpirationReminderDay }[];
  selected: ExpirationReminderDay[];
}) {
  return (
    <View>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingChoices}>
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              key={option.value}
              onPress={() => onToggle(option.value)}
              style={[styles.settingChoice, isSelected && styles.settingChoiceSelected]}
            >
              <Text style={[styles.settingChoiceText, isSelected && styles.settingChoiceTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ItemGroup({
  deletingId,
  items,
  manageMode,
  onDelete,
  onEdit,
  onSelect,
  selectedIds,
}: {
  deletingId?: string;
  items: ExpirationItem[];
  manageMode: ManageMode;
  onDelete(item: ExpirationItem): void;
  onEdit(item: ExpirationItem): void;
  onSelect(item: ExpirationItem): void;
  selectedIds: Set<string>;
}) {
  return (
    <View style={styles.cardGrid}>
      {items.map((item) => (
        <ItemCard
          deleting={deletingId === item.id}
          item={item}
          key={item.id}
          manageMode={manageMode}
          onDelete={() => onDelete(item)}
          onEdit={() => onEdit(item)}
          onSelect={() => onSelect(item)}
          selected={selectedIds.has(item.id)}
        />
      ))}
    </View>
  );
}

function ItemCard({
  deleting,
  item,
  manageMode,
  onDelete,
  onEdit,
  onSelect,
  selected,
}: {
  deleting: boolean;
  item: ExpirationItem;
  manageMode: ManageMode;
  onDelete(): void;
  onEdit(): void;
  onSelect(): void;
  selected: boolean;
}) {
  const onPress = manageMode === 'idle' ? onEdit : onSelect;
  const expired = isExpirationDatePast(item.expirationDate);

  return (
    <Pressable
      accessibilityHint={
        manageMode !== 'idle'
          ? manageMode === 'editing' ? '이동할 식재료로 선택합니다' : '삭제할 식재료로 선택합니다'
          : manageMode === 'idle'
            ? '식재료 정보를 수정합니다'
            : undefined
      }
      accessibilityRole="button"
      accessibilityState={{ selected: manageMode !== 'idle' ? selected : undefined }}
      disabled={deleting}
      onPress={Platform.OS === 'web' && manageMode !== 'idle' ? undefined : onPress}
      onPressIn={Platform.OS === 'web' && manageMode !== 'idle' ? onSelect : undefined}
      style={({ pressed }) => [
        styles.itemCard,
        expired && styles.expiredItemCard,
        selected && styles.itemCardSelected,
        pressed && styles.itemCardPressed,
      ]}
    >
      {manageMode !== 'idle' && (
        <View style={[styles.selectionIndicator, selected && styles.selectionIndicatorSelected]}>
          {selected && <Image resizeMode="contain" source={checkIcon} style={styles.selectionCheck} />}
        </View>
      )}
      {expired && manageMode === 'idle' && (
        <Pressable accessibilityLabel={`${item.name} 버리기`} onPress={onDelete} style={styles.discardBadge}>
          <Text style={styles.discardBadgeText}>버리기</Text>
        </Pressable>
      )}
      <Text numberOfLines={2} style={[styles.itemName, expired && styles.expiredItemText]}>{item.name}</Text>
      <Text style={[styles.itemDate, !item.expirationDate && styles.missingDate, expired && styles.expiredItemText]}>
        {item.expirationDate?.replaceAll('-', '.') ?? '기한 미입력'}
      </Text>
    </Pressable>
  );
}

function isExpirationDatePast(expirationDate: string | null) {
  if (!expirationDate) return false;
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return expirationDate < today;
}

function sortItemsForDisplay(items: ExpirationItem[]) {
  return [...items].sort((left, right) => {
    if (left.section !== right.section) {
      return left.section === 'USE_SOON' ? -1 : 1;
    }
    if (left.expirationDate !== right.expirationDate) {
      if (!left.expirationDate) return 1;
      if (!right.expirationDate) return -1;
      return left.expirationDate.localeCompare(right.expirationDate);
    }
    return left.purchasedAt.localeCompare(right.purchasedAt) ||
      left.createdAt.localeCompare(right.createdAt);
  });
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.canvas, flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  container: { padding: spacing.xl, paddingBottom: spacing.giant },
  containerWithRegistrationForm: { paddingBottom: 280 },
  containerWithSelectionBar: { paddingBottom: 160 },
  editContainer: { padding: spacing.xxl, paddingBottom: spacing.giant },
  title: { color: colors.text.primary, ...typography.heading1, marginTop: spacing.xs },
  editPageTitle: { color: colors.text.primary, ...typography.heading1, marginTop: spacing.xl },
  notificationNotice: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder, borderRadius: radii.large, borderWidth: 1, marginTop: spacing.lg, padding: spacing.lg },
  notificationNoticeTitle: { color: colors.warning, ...typography.bodyStrong },
  notificationNoticeText: { color: colors.text.secondary, ...typography.caption, marginTop: spacing.xs },
  notificationRetry: { color: colors.brand.action, ...typography.label, marginTop: spacing.sm, paddingVertical: spacing.xs },
  notificationSettingsToggle: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.sm },
  notificationSettingsButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: interaction.minimumTouchSize, paddingRight: spacing.md },
  notificationSettingsIcon: { height: 22, tintColor: colors.brand.action, width: 22 },
  notificationSettingsToggleText: { color: colors.text.primary, ...typography.label },
  notificationSettingsSummary: { color: colors.brand.action, ...typography.caption, fontWeight: '700' },
  notificationSettingsCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  notificationSettingsCardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  notificationSettingsCardTitle: { color: colors.text.primary, ...typography.bodyStrong },
  notificationSettingsCloseButton: { alignItems: 'center', borderRadius: radii.full, height: interaction.minimumTouchSize, justifyContent: 'center', width: interaction.minimumTouchSize },
  notificationSettingsCloseText: { color: colors.text.secondary, fontSize: 28, fontWeight: '400', lineHeight: 30 },
  notificationSettingsSaveButton: { marginTop: spacing.sm },
  notificationTimeButton: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderRadius: radii.medium, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.md },
  notificationTimeValue: { color: colors.text.primary, ...typography.bodyStrong },
  notificationTimeAction: { color: colors.brand.action, ...typography.caption, fontWeight: '800' },
  pressed: { opacity: interaction.pressedOpacity },
  settingLabel: { color: colors.text.secondary, ...typography.caption, fontWeight: '700', marginBottom: spacing.xs },
  settingChoices: { flexDirection: 'row', gap: spacing.sm },
  settingChoice: { backgroundColor: colors.surfaceMuted, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  settingChoiceSelected: { backgroundColor: colors.brand.action },
  settingChoiceText: { color: colors.text.secondary, ...typography.caption, fontWeight: '700' },
  settingChoiceTextSelected: { color: colors.text.inverse },
  registrationBackdrop: { alignItems: 'center', backgroundColor: 'rgba(43, 27, 21, 0.45)', flex: 1, justifyContent: 'flex-end' },
  registrationSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xlarge, borderTopRightRadius: radii.xlarge, maxWidth: 560, padding: spacing.xxl, width: '100%' },
  registrationHandle: { alignSelf: 'center', backgroundColor: colors.borderStrong, borderRadius: radii.full, height: 4, marginBottom: spacing.xl, width: 44 },
  registrationEyebrow: { color: colors.brand.action, ...typography.label },
  registrationTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', marginTop: spacing.sm },
  registrationItemName: { color: colors.text.primary, flex: 1, ...typography.heading1 },
  registrationDDay: { backgroundColor: colors.brand.soft, borderRadius: radii.full, color: colors.brand.action, overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.label },
  registrationConsumption: { color: colors.text.primary, marginTop: spacing.lg, ...typography.title },
  registrationNotificationBox: { backgroundColor: colors.surfaceMuted, borderRadius: radii.large, marginTop: spacing.xl, padding: spacing.lg },
  registrationSectionTitle: { color: colors.text.secondary, ...typography.label },
  registrationReminderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  registrationReminderChip: { backgroundColor: colors.brand.soft, borderRadius: radii.full, color: colors.brand.action, overflow: 'hidden', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.caption, fontWeight: '800' },
  registrationTime: { color: colors.text.primary, marginTop: spacing.md, ...typography.bodyStrong },
  registrationMuted: { color: colors.text.muted, marginTop: spacing.sm, ...typography.caption },
  registrationWarning: { color: colors.warning, marginTop: spacing.sm, ...typography.caption, fontWeight: '700' },
  registrationSettingsButton: { marginTop: spacing.lg },
  registrationConfirmButton: { marginTop: spacing.md },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.xxxl },
  sectionTitle: { color: colors.text.primary, ...typography.heading2 },
  manageActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  manageButton: { alignItems: 'center', backgroundColor: colors.brand.soft, borderRadius: radii.medium, justifyContent: 'center', minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.md },
  manageButtonText: { color: colors.brand.action, ...typography.caption, fontWeight: '800' },
  deleteModeButton: { alignItems: 'center', backgroundColor: colors.dangerSoft, borderRadius: radii.medium, justifyContent: 'center', minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.md },
  deleteModeButtonText: { color: colors.danger, ...typography.caption, fontWeight: '800' },
  doneAction: { color: colors.brand.action, ...typography.label, fontWeight: '800', minHeight: interaction.minimumTouchSize, paddingHorizontal: spacing.xs, paddingVertical: spacing.md },
  manualButton: { borderRadius: radii.medium, marginTop: spacing.md },
  modeDescription: { color: colors.text.muted, ...typography.caption, marginBottom: spacing.lg, marginTop: -spacing.xs },
  emptyCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.large, borderWidth: 1, padding: spacing.xxxl },
  emptyTitle: { color: colors.text.primary, ...typography.bodyStrong },
  emptyDescription: { color: colors.text.muted, ...typography.label, fontWeight: '400', marginTop: spacing.sm, textAlign: 'center' },
  itemGroups: { gap: spacing.xxl },
  groupTitle: { color: colors.text.secondary, ...typography.label, fontWeight: '800', marginBottom: spacing.xs },
  emptyDropZone: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, borderRadius: radii.large, borderStyle: 'dashed', borderWidth: 1, padding: spacing.xl },
  emptyDropText: { color: colors.text.muted, ...typography.caption, fontWeight: '600' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  itemCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.medium, borderWidth: 1, justifyContent: 'space-between', minHeight: 88, padding: spacing.md, width: '48.5%' },
  expiredItemCard: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
  itemCardSelected: { backgroundColor: colors.brand.soft, borderColor: colors.brand.primary, borderWidth: 2, padding: 11 },
  itemCardPressed: { opacity: interaction.pressedOpacity },
  itemName: { color: colors.text.primary, fontSize: 15, fontWeight: '800', lineHeight: 20, paddingRight: spacing.xxl },
  expiredItemText: { color: colors.text.muted },
  discardBadge: { alignSelf: 'flex-start', backgroundColor: colors.border, borderRadius: radii.full, marginBottom: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  discardBadgeText: { color: colors.text.secondary, fontSize: 12, fontWeight: '800' },
  itemDate: { color: colors.text.secondary, ...typography.caption, fontWeight: '700', marginTop: spacing.sm },
  missingDate: { color: colors.text.muted, fontWeight: '600' },
  selectionIndicator: { alignItems: 'center', borderColor: colors.borderStrong, borderRadius: radii.full, borderWidth: 1.5, height: 24, justifyContent: 'center', position: 'absolute', right: spacing.sm, top: spacing.sm, width: 24 },
  selectionIndicatorSelected: { backgroundColor: colors.brand.action, borderColor: colors.brand.action },
  selectionCheck: { height: 15, tintColor: colors.text.inverse, width: 15 },
  selectionBar: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, left: 0, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, position: 'absolute', right: 0 },
  selectionCount: { color: colors.text.secondary, ...typography.caption, fontWeight: '700' },
  placementActions: { flexDirection: 'row', gap: spacing.sm },
  cancelSelectionButton: { borderRadius: radii.medium, flex: 1 },
  placementButton: { borderRadius: radii.medium, flex: 1 },
  undoRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  editingFinishActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  undoMessage: { color: colors.text.secondary, flex: 1, ...typography.bodyStrong },
  editingAction: { ...typography.bodyStrong, fontWeight: '800', minHeight: interaction.minimumTouchSize, paddingVertical: spacing.md },
  undoAction: { color: colors.text.muted },
  finishEditingAction: { color: colors.brand.action },
  deleteSelectionCount: { color: colors.text.secondary, ...typography.bodyStrong, marginBottom: spacing.sm },
});
