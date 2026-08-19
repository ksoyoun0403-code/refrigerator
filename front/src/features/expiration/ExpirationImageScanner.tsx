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
import {
  ExpirationCandidate,
  ExpirationScanResult,
  LocalImage,
} from './types';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

export function ExpirationImageScanner() {
  const [image, setImage] = useState<LocalImage>();
  const [result, setResult] = useState<ExpirationScanResult>();
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const openImageSource = () => {
    if (isScanning) {
      return;
    }

    Alert.alert('식품 사진 선택', '이미지를 가져올 방법을 선택해 주세요.', [
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
      Alert.alert(
        '카메라 권한이 필요해요',
        '식품 사진을 촬영하려면 설정에서 카메라 권한을 허용해 주세요.',
      );
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
    if (pickerResult.canceled) {
      return;
    }

    const asset = pickerResult.assets[0];
    const mimeType = asset.mimeType ?? inferMimeType(asset.fileName);
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      Alert.alert(
        '지원하지 않는 이미지예요',
        '현재는 JPEG와 PNG 이미지만 선택할 수 있습니다.',
      );
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      Alert.alert('이미지가 너무 커요', '10MB 이하 이미지를 선택해 주세요.');
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
    if (!image || isScanning) {
      return;
    }

    setIsScanning(true);
    setResult(undefined);
    setErrorMessage(undefined);
    try {
      setResult(await scanExpirationImage(image));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '이미지를 스캔하지 못했습니다.',
      );
    } finally {
      setIsScanning(false);
    }
  };

  const removeImage = () => {
    if (isScanning) {
      return;
    }
    setImage(undefined);
    setResult(undefined);
    setErrorMessage(undefined);
  };

  if (!image) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={openImageSource}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.pressed,
        ]}
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
        <Pressable disabled={isScanning} onPress={removeImage}>
          <Text style={styles.removeAction}>삭제</Text>
        </Pressable>
      </View>

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

      {errorMessage && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>스캔하지 못했어요</Text>
          <Text style={styles.errorDescription}>{errorMessage}</Text>
        </View>
      )}

      {result && <ScanResult candidates={result.candidates} />}
    </View>
  );
}

function ScanResult({ candidates }: { candidates: ExpirationCandidate[] }) {
  if (candidates.length === 0) {
    return (
      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>날짜를 찾지 못했어요</Text>
        <Text style={styles.resultDescription}>
          다음 등록 단계에서 유통기한을 직접 입력하거나 비워둘 수 있습니다.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>
        {candidates.length === 1
          ? '인식된 유통기한 후보'
          : `${candidates.length}개의 날짜 후보를 찾았어요`}
      </Text>
      {candidates.length > 1 && (
        <Text style={styles.resultDescription}>
          제조일자 등이 포함될 수 있으니 실제 유통기한을 확인해 주세요.
        </Text>
      )}
      <View style={styles.candidateList}>
        {candidates.map((candidate) => (
          <View
            key={`${candidate.expirationDate}-${candidate.rawText}`}
            style={styles.candidateRow}
          >
            <View>
              <Text style={styles.candidateDate}>
                {candidate.expirationDate}
              </Text>
              <Text style={styles.candidateRaw}>인식값: {candidate.rawText}</Text>
            </View>
            {(candidate.requiresConfirmation || candidates.length > 1) && (
              <Text style={styles.confirmBadge}>확인 필요</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function inferMimeType(fileName?: string | null) {
  const normalizedName = fileName?.toLowerCase() ?? '';
  if (normalizedName.endsWith('.png')) {
    return 'image/png';
  }
  if (
    normalizedName.endsWith('.jpg') ||
    normalizedName.endsWith('.jpeg')
  ) {
    return 'image/jpeg';
  }
  return 'application/octet-stream';
}

const styles = StyleSheet.create({
  scannerCard: { marginTop: 26 },
  preview: { backgroundColor: '#ebe6dc', borderRadius: 18, height: 260, width: '100%' },
  imageActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 12 },
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
  resultCard: { backgroundColor: '#edf4ed', borderRadius: 18, marginTop: 16, padding: 18 },
  resultTitle: { color: '#253b2e', fontSize: 18, fontWeight: '800' },
  resultDescription: { color: '#5f6e64', fontSize: 14, lineHeight: 20, marginTop: 6 },
  candidateList: { gap: 10, marginTop: 14 },
  candidateRow: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  candidateDate: { color: '#1f3e2c', fontSize: 20, fontWeight: '800' },
  candidateRaw: { color: '#788178', fontSize: 12, marginTop: 4 },
  confirmBadge: { backgroundColor: '#fff0c7', borderRadius: 10, color: '#7a5a00', fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6 },
});
