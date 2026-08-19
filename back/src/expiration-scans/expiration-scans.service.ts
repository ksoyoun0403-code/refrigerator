import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  EXPIRATION_RECOGNIZER,
  ExpirationRecognizer,
  ImageInput,
} from './expiration-recognizer.port';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function toDatabaseDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

@Injectable()
export class ExpirationScansService {
  constructor(
    @Inject(EXPIRATION_RECOGNIZER)
    private readonly recognizer: ExpirationRecognizer,
    private readonly prisma: PrismaService,
  ) {}

  async scan(image?: ImageInput) {
    if (!image) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(image.mimeType)) {
      throw new BadRequestException('JPEG 또는 PNG 이미지만 등록할 수 있습니다.');
    }
    if (image.bytes.length === 0 || image.bytes.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('이미지는 10MB 이하여야 합니다.');
    }

    const scan = await this.prisma.client.expirationScan.create({
      data: { status: 'PROCESSING' },
      select: { id: true },
    });

    try {
      const result = await this.recognizer.recognize(image);
      const representative = result.candidates[0];

      await this.prisma.client.expirationScan.update({
        where: { id: scan.id },
        data: {
          status: 'NEEDS_REVIEW',
          recognizedExpirationDate: toDatabaseDate(
            representative?.expirationDate,
          ),
          confidence: representative?.confidence,
        },
      });

      return {
        scanId: scan.id,
        status: 'needs_review' as const,
        candidates: result.candidates,
        failureReason: this.getFailureReason(result),
      };
    } catch (error) {
      await this.prisma.client.expirationScan.update({
        where: { id: scan.id },
        data: { status: 'FAILED' },
      });
      if (error instanceof HttpException) {
        throw error;
      }
      if (
        error instanceof TypeError ||
        (error instanceof Error && error.name === 'TimeoutError')
      ) {
        throw new ServiceUnavailableException(
          '이미지 분석 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.',
        );
      }
      throw new ServiceUnavailableException(
        '이미지를 분석하는 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
      );
    }
  }

  private getFailureReason(result: {
    candidates: unknown[];
    recognizedText: string;
    confidence: number;
  }) {
    if (result.candidates.length > 0) {
      return null;
    }
    if (!result.recognizedText.trim()) {
      return 'NO_TEXT_DETECTED' as const;
    }
    if (result.confidence > 0 && result.confidence < 0.55) {
      return 'LOW_QUALITY_TEXT' as const;
    }
    return 'NO_DATE_DETECTED' as const;
  }
}
