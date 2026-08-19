import { Injectable, Logger } from '@nestjs/common';
import { extractExpirationDateCandidates } from './expiration-date-parser';
import {
  ExpirationRecognizer,
  ImageInput,
  RecognitionResult,
} from './expiration-recognizer.port';

const GOOGLE_VISION_ENDPOINT =
  'https://vision.googleapis.com/v1/images:annotate';
const REQUEST_TIMEOUT_MS = 8_000;

type GoogleVisionWord = {
  confidence?: number;
};

type GoogleVisionParagraph = {
  words?: GoogleVisionWord[];
};

type GoogleVisionBlock = {
  paragraphs?: GoogleVisionParagraph[];
};

type GoogleVisionPage = {
  blocks?: GoogleVisionBlock[];
};

export type GoogleVisionResponse = {
  responses?: Array<{
    error?: {
      code?: number;
      message?: string;
    };
    fullTextAnnotation?: {
      pages?: GoogleVisionPage[];
      text?: string;
    };
    textAnnotations?: Array<{
      description?: string;
    }>;
  }>;
};

@Injectable()
export class GoogleCloudVisionExpirationRecognizer
  implements ExpirationRecognizer
{
  private readonly logger = new Logger(
    GoogleCloudVisionExpirationRecognizer.name,
  );
  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'GOOGLE_CLOUD_VISION_API_KEY Backend 환경변수가 필요합니다.',
      );
    }
    this.apiKey = apiKey;
  }

  async recognize(image: ImageInput): Promise<RecognitionResult> {
    const startedAt = Date.now();
    const response = await fetch(GOOGLE_VISION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: image.bytes.toString('base64'),
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Google Cloud Vision 요청 실패 (${response.status} ${response.statusText})`,
      );
    }

    const result = (await response.json()) as GoogleVisionResponse;
    const visionResult = result.responses?.[0];
    if (visionResult?.error?.message) {
      throw new Error(
        `Google Cloud Vision 인식 실패: ${visionResult.error.message}`,
      );
    }

    const recognizedText = extractGoogleVisionText(result);
    const confidence = extractGoogleVisionConfidence(result);
    const candidates = extractExpirationDateCandidates(
      recognizedText,
      confidence * 100,
    );

    this.logger.log(
      `Google Vision OCR completed in ${Date.now() - startedAt}ms, found ${candidates.length} date candidate(s)`,
    );

    return { candidates };
  }
}

export function extractGoogleVisionText(response: GoogleVisionResponse) {
  const result = response.responses?.[0];
  return (
    result?.fullTextAnnotation?.text ??
    result?.textAnnotations?.[0]?.description ??
    ''
  );
}

export function extractGoogleVisionConfidence(response: GoogleVisionResponse) {
  const pages = response.responses?.[0]?.fullTextAnnotation?.pages ?? [];
  const confidences = pages.flatMap((page) =>
    (page.blocks ?? []).flatMap((block) =>
      (block.paragraphs ?? []).flatMap((paragraph) =>
        (paragraph.words ?? [])
          .map((word) => word.confidence)
          .filter((confidence): confidence is number =>
            Number.isFinite(confidence),
          ),
      ),
    ),
  );

  if (confidences.length === 0) {
    return 0;
  }

  return (
    confidences.reduce((sum, confidence) => sum + confidence, 0) /
    confidences.length
  );
}
