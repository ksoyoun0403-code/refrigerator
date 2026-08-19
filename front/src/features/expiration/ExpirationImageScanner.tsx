import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { scanExpirationImage } from './expirationApi';
import { ExpirationRegistrationForm } from './ExpirationRegistrationForm';
import { ExpirationItem, ExpirationScanResult, LocalImage } from './types';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

type Props = {
  onRegistered(item: ExpirationItem): void | Promise<void>;
};

export function ExpirationImageScanner({ onRegistered }: Props) {
  const [image, setImage] = useState<LocalImage>();
  const [result, setResult] = useState<ExpirationScanResult>();
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const openImageSource = () => {
    if (isScanning) return;
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
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('카메라 권한이 필요해요', '설정에서 카메라 권한을 허용해주세요.');
      return;
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

  const scanImage = async () => {
    if (!image || isScanning) return;
    setIsScanning(true);
    setResult(undefined);
    setErrorMessage(undefined);
    try {
      setResult(await scanExpirationImage(image));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '이미지를 스캔하지 못했습니다.',
      );
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
    await onRegistered(item);
    reset();
    Alert.alert('등록 완료', `${item.name}을(를) 냉장고 목록에 저장했습니다.`);
  };

  if (!image) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={openImageSource}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>사진으로 추가</Text>
      </Pressable>
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
        <Pressable
          accessibilityRole="button"
          disabled={isScanning}
          onPress={() => void scanImage()}
          style={({ pressed }) => [
            styles.primaryButton,
            isScanning && styles.disabledButton,
            pressed && !isScanning && styles.pressed,
          ]}
        >
          {isScanning ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.primaryButtonText}>유통기한 스캔 중</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>이 사진 스캔하기</Text>
          )}
        </Pressable>
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
    </View>
  );
}

function RecognitionFailure({
  reason,
}: {
  reason: NonNullable<ExpirationScanResult['failureReason']>;
}) {
  const messages = {
    NO_TEXT_DETECTED: {
      title: '사진에서 글자를 찾지 못했어요',
      description:
        '유통기한이 화면에 크게 보이도록 가까이에서 다시 촬영하거나 아래에서 직접 입력해주세요.',
    },
    LOW_QUALITY_TEXT: {
      title: '글자가 흐리거나 너무 작아요',
      description:
        '빛 반사를 피하고 날짜 부분에 초점을 맞춰 다시 촬영하거나 아래에서 직접 입력해주세요.',
    },
    NO_DATE_DETECTED: {
      title: '유통기한 날짜를 찾지 못했어요',
      description:
        '유통기한, 소비기한 또는 “까지” 문구가 보이는지 확인하고 아래에서 날짜를 직접 입력해주세요.',
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

const styles = StyleSheet.create({
  scannerCard: { marginTop: 26 },
  preview: { backgroundColor: '#ebe6dc', borderRadius: 18, height: 260, width: '100%' },
  imageActions: { flexDirection: 'row', gap: 20, justifyContent: 'flex-end', marginTop: 12 },
  secondaryAction: { color: '#2f6b45', fontSize: 14, fontWeight: '700' },
  removeAction: { color: '#a54d42', fontSize: 14, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: '#2f6b45', borderRadius: 16, marginTop: 18, padding: 17 },
  primaryButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  disabledButton: { opacity: 0.65 },
  pressed: { opacity: 0.8 },
  errorCard: { backgroundColor: '#fff0ed', borderColor: '#f2c4bc', borderRadius: 16, borderWidth: 1, marginTop: 16, padding: 16 },
  errorTitle: { color: '#873d33', fontSize: 16, fontWeight: '700' },
  errorDescription: { color: '#8d554d', fontSize: 14, lineHeight: 20, marginTop: 5 },
  warningCard: { backgroundColor: '#fff8df', borderColor: '#ead794', borderRadius: 16, borderWidth: 1, marginTop: 16, padding: 16 },
  warningTitle: { color: '#705614', fontSize: 16, fontWeight: '800' },
  warningDescription: { color: '#756738', fontSize: 14, lineHeight: 20, marginTop: 5 },
});
