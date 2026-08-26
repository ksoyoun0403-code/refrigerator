import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../design-system/Button';
import { colors, radii, spacing, typography } from '../../design-system/tokens';
import { LocalImage } from './types';

type Props = {
  onCaptured(image: LocalImage): void;
  onClose(): void;
  visible: boolean;
};

export function ExpirationWebcamCapture({ onCaptured, onClose, visible }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isReady, setIsReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const startCamera = async () => {
      setErrorMessage(undefined);
      setIsReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('이 브라우저에서는 웹캠 촬영을 지원하지 않아요. 이미지 선택을 이용해주세요.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            ...(selectedCameraId ? { deviceId: { exact: selectedCameraId } } : {}),
            height: { ideal: 1080 },
            width: { ideal: 1920 },
          },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        setCameras((await navigator.mediaDevices.enumerateDevices()).filter(({ kind }) => kind === 'videoinput'));
        videoTrack.addEventListener('mute', () => {
          setIsReady(false);
          setErrorMessage('카메라는 연결됐지만 영상을 보내지 않고 있어요. 아래에서 다른 카메라를 선택하거나 카메라 덮개를 확인해주세요.');
        });
        videoTrack.addEventListener('unmute', () => {
          setErrorMessage(undefined);
        });
        videoTrack.addEventListener('ended', () => {
          setIsReady(false);
          setErrorMessage('카메라 연결이 중단됐어요. 다른 앱에서 카메라를 사용 중인지 확인해주세요.');
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          try {
            await videoRef.current.play();
          } catch {
            setErrorMessage('카메라 영상을 재생하지 못했어요. 브라우저를 새로고침한 뒤 다시 시도해주세요.');
          }
        }
      } catch {
        setErrorMessage('카메라를 열지 못했어요. 브라우저의 카메라 권한과 연결 상태를 확인해주세요.');
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) stopStream(streamRef.current);
      streamRef.current = undefined;
    };
  }, [selectedCameraId, visible]);

  const close = () => {
    if (streamRef.current) stopStream(streamRef.current);
    streamRef.current = undefined;
    onClose();
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1920 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const uri = canvas.toDataURL('image/jpeg', 0.9);
    close();
    onCaptured({ uri, fileName: `expiration-webcam-${Date.now()}.jpg`, mimeType: 'image/jpeg' });
  };

  return (
    <Modal animationType="fade" onRequestClose={close} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>웹캠으로 촬영</Text>
          <Text style={styles.description}>식품명과 유통기한이 화면 안에 선명하게 보이도록 맞춰주세요.</Text>
          <View style={styles.videoFrame}>
            <video
              autoPlay
              muted
              onCanPlay={() => {
                const videoTrack = streamRef.current?.getVideoTracks()[0];
                if (videoTrack?.muted) {
                  setIsReady(false);
                  setErrorMessage('카메라는 연결됐지만 영상을 보내지 않고 있어요. 아래에서 다른 카메라를 선택하거나 카메라 덮개를 확인해주세요.');
                  return;
                }
                setErrorMessage(undefined);
                setIsReady(true);
              }}
              onError={() => {
                setIsReady(false);
                setErrorMessage('선택된 카메라의 영상을 표시하지 못했어요. 카메라 권한과 장치 상태를 확인해주세요.');
              }}
              playsInline
              ref={videoRef}
              style={{ height: '100%', objectFit: 'cover', width: '100%' }}
            />
          </View>
          {cameras.length > 1 && (
            <View style={styles.cameraChoice}>
              <Text style={styles.cameraChoiceLabel}>사용할 카메라</Text>
              <select
                aria-label="사용할 카메라"
                onChange={(event) => setSelectedCameraId(event.currentTarget.value)}
                style={{ border: '1px solid #D8CFC4', borderRadius: 10, fontSize: 15, padding: 10, width: '100%' }}
                value={selectedCameraId}
              >
                <option value="">기본 카메라</option>
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `카메라 ${index + 1}`}
                  </option>
                ))}
              </select>
            </View>
          )}
          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          <Button disabled={!isReady || Boolean(errorMessage)} label="사진 촬영" onPress={capture} style={styles.action} />
          <Pressable accessibilityRole="button" onPress={close} style={styles.cancelButton}>
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(43, 27, 21, 0.65)', flex: 1, justifyContent: 'center', padding: spacing.xl },
  sheet: { backgroundColor: colors.surface, borderRadius: radii.xlarge, maxWidth: 640, padding: spacing.xl, width: '100%' },
  title: { color: colors.text.primary, ...typography.heading2 },
  description: { color: colors.text.secondary, marginBottom: spacing.lg, marginTop: spacing.xs, ...typography.body },
  videoFrame: { backgroundColor: '#1C1C1C', borderRadius: radii.large, height: 360, overflow: 'hidden', width: '100%' },
  error: { color: colors.danger, marginTop: spacing.md, ...typography.label },
  cameraChoice: { gap: spacing.xs, marginTop: spacing.md },
  cameraChoiceLabel: { color: colors.text.secondary, ...typography.label },
  action: { marginTop: spacing.lg, width: '100%' },
  cancelButton: { alignItems: 'center', marginTop: spacing.sm, padding: spacing.sm },
  cancelText: { color: colors.text.secondary, ...typography.label },
});
