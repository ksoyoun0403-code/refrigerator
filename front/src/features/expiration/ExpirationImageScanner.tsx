import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../design-system/Button';
import { colors, radii, spacing, typography } from '../../design-system/tokens';
import { scanExpirationImage } from './expirationApi';
import { ExpirationRegistrationForm } from './ExpirationRegistrationForm';
import { ExpirationWebcamCapture } from './ExpirationWebcamCapture';
import { ExpirationItem, ExpirationScanResult, LocalImage } from './types';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const expirationCameraIcon = require('../../../assets/icons/expiration-camera.png');

type Props = {
  onRegistered(item: ExpirationItem): void | Promise<void>;
};

export function ExpirationImageScanner({ onRegistered }: Props) {
  const [image, setImage] = useState<LocalImage>();
  const [result, setResult] = useState<ExpirationScanResult>();
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isWebSourceOpen, setIsWebSourceOpen] = useState(false);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);

  const openImageSource = () => {
    if (isScanning) return;
    if (Platform.OS === 'web') {
      setIsWebSourceOpen(true);
      return;
    }
    Alert.alert('식품 사진 선택', '이미지를 가져올 방법을 선택해주세요.', [
      { text: '취소', style: 'cancel' },
      { text: '앨범에서 선택', onPress: () => void pickFromLibrary() },
      { text: '카메라로 촬영', onPress: () => void takePhoto() },
    ]);
  };

  const pickFromLibrary = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    });
    selectPickerResult(pickerResult);
  };

  const takePhoto = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('카메라 권한이 필요해요', '설정에서 카메라 권한을 허용해주세요.');
        return;
      }
    }
    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
      quality: 0.9,
    });
    selectPickerResult(pickerResult);
  };

  const selectPickerResult = (pickerResult: ImagePicker.ImagePickerResult) => {
    if (pickerResult.canceled) return;
    const asset = pickerResult.assets[0];
    const mimeType = asset.mimeType ?? inferMimeType(asset.fileName);
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      Alert.alert('지원하지 않는 이미지예요', 'JPEG 또는 PNG 이미지를 선택해주세요.');
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      Alert.alert('이미지가 너무 커요', '10MB 이하 이미지를 선택해주세요.');
      return;
    }
    setImage({
      uri: asset.uri,
      fileName: asset.fileName ?? `expiration-${Date.now()}.jpg`,
      mimeType,
    });
    setResult(undefined);
    setErrorMessage(undefined);
  };

  const selectImage = (nextImage: LocalImage) => {
    setImage(nextImage);
    setResult(undefined);
    setErrorMessage(undefined);
  };

  const scanImage = async () => {
    if (!image || isScanning) return;
    setIsScanning(true);
    setResult(undefined);
    setErrorMessage(undefined);
    try {
      setResult(await scanExpirationImage(image));
    } catch {
      setErrorMessage('사진을 서버로 보내지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsScanning(false);
    }
  };

  const reset = () => {
    if (isScanning) return;
    setImage(undefined);
    setResult(undefined);
    setErrorMessage(undefined);
  };

  const registered = async (item: ExpirationItem) => {
    reset();
    await onRegistered(item);
  };

  if (!image) {
    return (
      <>
        <Button
          accessibilityHint="카메라로 촬영하거나 앨범에서 유통기한 사진을 선택합니다."
          iconSource={expirationCameraIcon}
          iconTintColor={colors.text.inverse}
          label="유통기한 촬영"
          onPress={openImageSource}
          style={styles.captureButton}
        />
        <WebImageSourceModal
          onClose={() => setIsWebSourceOpen(false)}
          onPickLibrary={() => {
            setIsWebSourceOpen(false);
            void pickFromLibrary();
          }}
          onTakePhoto={() => {
            setIsWebSourceOpen(false);
            if (isDesktopWeb()) setIsWebcamOpen(true);
            else void takePhoto();
          }}
          visible={isWebSourceOpen}
        />
        <ExpirationWebcamCapture
          onCaptured={selectImage}
          onClose={() => setIsWebcamOpen(false)}
          visible={isWebcamOpen}
        />
      </>
    );
  }

  return (
    <View style={styles.scannerCard}>
      <Image source={{ uri: image.uri }} resizeMode="cover" style={styles.preview} />
      <View style={styles.imageActions}>
        <Pressable disabled={isScanning} onPress={openImageSource}>
          <Text style={styles.secondaryAction}>사진 바꾸기</Text>
        </Pressable>
        <Pressable disabled={isScanning} onPress={reset}>
          <Text style={styles.removeAction}>삭제</Text>
        </Pressable>
      </View>

      {!result && (
        <Button
          disabled={isScanning}
          label={isScanning ? '인식 중이에요' : '이 사진 스캔하기'}
          loading={isScanning}
          onPress={() => void scanImage()}
          style={styles.primaryButton}
        />
      )}

      {errorMessage && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>스캔하지 못했어요</Text>
          <Text style={styles.errorDescription}>{errorMessage}</Text>
        </View>
      )}

      {result && (
        <>
          {result.failureReason && (
            <RecognitionFailure reason={result.failureReason} />
          )}
          <ExpirationRegistrationForm
            key={result.scanId}
            onRegistered={registered}
            scan={result}
          />
        </>
      )}
      <WebImageSourceModal
        onClose={() => setIsWebSourceOpen(false)}
        onPickLibrary={() => {
          setIsWebSourceOpen(false);
          void pickFromLibrary();
        }}
        onTakePhoto={() => {
          setIsWebSourceOpen(false);
          if (isDesktopWeb()) setIsWebcamOpen(true);
          else void takePhoto();
        }}
        visible={isWebSourceOpen}
      />
      <ExpirationWebcamCapture
        onCaptured={selectImage}
        onClose={() => setIsWebcamOpen(false)}
        visible={isWebcamOpen}
      />
    </View>
  );
}

function WebImageSourceModal({
  onClose,
  onPickLibrary,
  onTakePhoto,
  visible,
}: {
  onClose(): void;
  onPickLibrary(): void;
  onTakePhoto(): void;
  visible: boolean;
}) {
  if (Platform.OS !== 'web') return null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.sourceBackdrop}>
        <Pressable accessibilityRole="none" onPress={() => undefined} style={styles.sourceSheet}>
          <Text style={styles.sourceTitle}>사진 가져오기</Text>
          <Text style={styles.sourceDescription}>유통기한이 잘 보이는 사진을 선택해주세요.</Text>
          <Button label="카메라로 촬영" onPress={onTakePhoto} style={styles.sourceButton} />
          <Button label="사진 불러오기" onPress={onPickLibrary} style={styles.sourceButton} variant="secondary" />
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.sourceCancelButton}>
            <Text style={styles.sourceCancelText}>취소</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RecognitionFailure({
  reason,
}: {
  reason: NonNullable<ExpirationScanResult['failureReason']>;
}) {
  const messages = {
    NO_TEXT_DETECTED: {
      title: '사진에서 글자를 읽지 못했어요',
      description: '라벨이나 날짜가 더 잘 보이도록 가까이에서 다시 찍어주세요.',
    },
    LOW_QUALITY_TEXT: {
      title: '사진이 너무 흐려요',
      description: '흔들림이 없도록 다시 찍고, 글자가 가운데 오게 맞춰주세요.',
    },
    NO_DATE_DETECTED: {
      title: '유통기한 날짜를 찾지 못했어요',
      description: '날짜가 보이는 부분을 조금 더 가까이 찍어서 다시 시도해주세요.',
    },
  } as const;
  const message = messages[reason];

  return (
    <View style={styles.warningCard}>
      <Text style={styles.warningTitle}>{message.title}</Text>
      <Text style={styles.warningDescription}>{message.description}</Text>
    </View>
  );
}

function inferMimeType(fileName?: string | null) {
  const normalizedName = fileName?.toLowerCase() ?? '';
  if (normalizedName.endsWith('.png')) return 'image/png';
  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return 'application/octet-stream';
}

function isDesktopWeb() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 768;
}

const styles = StyleSheet.create({
  scannerCard: { marginTop: spacing.xxl },
  preview: { backgroundColor: colors.surfaceMuted, borderRadius: radii.xlarge, height: 260, width: '100%' },
  imageActions: { flexDirection: 'row', gap: spacing.xl, justifyContent: 'flex-end', marginTop: spacing.md },
  secondaryAction: { color: colors.brand.action, ...typography.label },
  removeAction: { color: colors.danger, ...typography.label },
  primaryButton: { marginTop: spacing.xl, minHeight: 56, width: '100%' },
  captureButton: { borderRadius: radii.large, marginTop: spacing.xl, minHeight: 64, width: '100%' },
  sourceBackdrop: { alignItems: 'center', backgroundColor: 'rgba(43, 27, 21, 0.5)', flex: 1, justifyContent: 'center', padding: spacing.xl },
  sourceSheet: { backgroundColor: colors.surface, borderRadius: radii.xlarge, maxWidth: 390, padding: spacing.xl, width: '100%' },
  sourceTitle: { color: colors.text.primary, ...typography.heading2 },
  sourceDescription: { color: colors.text.secondary, marginBottom: spacing.lg, marginTop: spacing.xs, ...typography.body },
  sourceButton: { marginTop: spacing.sm, width: '100%' },
  sourceCancelButton: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  sourceCancelText: { color: colors.text.secondary, ...typography.label },
  errorCard: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderRadius: radii.large, borderWidth: 1, marginTop: spacing.lg, padding: spacing.lg },
  errorTitle: { color: colors.danger, ...typography.bodyStrong },
  errorDescription: { color: colors.text.secondary, ...typography.label, fontWeight: '400', marginTop: spacing.xs },
  warningCard: { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder, borderRadius: radii.large, borderWidth: 1, marginTop: spacing.lg, padding: spacing.lg },
  warningTitle: { color: colors.warning, ...typography.bodyStrong, fontWeight: '800' },
  warningDescription: { color: colors.text.secondary, ...typography.label, fontWeight: '400', marginTop: spacing.xs },
});
