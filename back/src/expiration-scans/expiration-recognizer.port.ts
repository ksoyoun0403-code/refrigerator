export type ExpirationCandidate = {
  rawText: string;
  expirationDate: string;
  confidence: number;
  requiresConfirmation: boolean;
};

export type RecognitionResult = {
  candidates: ExpirationCandidate[];
  recognizedText: string;
  confidence: number;
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
