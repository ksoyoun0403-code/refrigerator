export type ExpirationCandidate = {
  name: string;
  expirationDate: string | null;
  confidence: number;
};

export type RecognitionResult = {
  candidates: ExpirationCandidate[];
};

export type ImageInput = {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
};

export const EXPIRATION_RECOGNIZER = Symbol('EXPIRATION_RECOGNIZER');

export interface ExpirationRecognizer {
  recognize(image: ImageInput): Promise<RecognitionResult>;
}
