import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  EXPIRATION_RECOGNIZER,
  ExpirationRecognizer,
  ImageInput,
} from './expiration-recognizer.port';

@Injectable()
export class ExpirationScansService {
  constructor(
    @Inject(EXPIRATION_RECOGNIZER)
    private readonly recognizer: ExpirationRecognizer,
  ) {}

  async scan(image?: ImageInput) {
    if (!image) {
      throw new BadRequestException('image 파일이 필요합니다.');
    }

    const result = await this.recognizer.recognize(image);

    return {
      scanId: randomUUID(),
      status: 'needs_review' as const,
      candidates: result.candidates,
    };
  }
}
