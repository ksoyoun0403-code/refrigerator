import { Injectable } from '@nestjs/common';
import {
  ExpirationRecognizer,
  ImageInput,
  RecognitionResult,
} from './expiration-recognizer.port';

/** Replace this adapter with an OCR/vision provider without changing controllers. */
@Injectable()
export class PlaceholderExpirationRecognizer implements ExpirationRecognizer {
  async recognize(_image: ImageInput): Promise<RecognitionResult> {
    return { candidates: [], recognizedText: '', confidence: 0 };
  }
}
