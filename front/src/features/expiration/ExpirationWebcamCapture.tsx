import { LocalImage } from './types';

type Props = {
  onCaptured(image: LocalImage): void;
  onClose(): void;
  visible: boolean;
};

export function ExpirationWebcamCapture(_props: Props) {
  return null;
}
