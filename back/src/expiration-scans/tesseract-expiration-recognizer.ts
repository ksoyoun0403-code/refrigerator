import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Tesseract = require('tesseract.js');
import { extractExpirationDateCandidates } from './expiration-date-parser';
import {
  createFallbackLineVariants,
  createRegionVariants,
  findDateLikeRegions,
  prepareImage,
} from './expiration-image-preprocessor';
import {
  ExpirationRecognizer,
  ImageInput,
  RecognitionResult,
} from './expiration-recognizer.port';

type LanguageData = {
  gzip: boolean;
  langPath: string;
};

const englishLanguageData = require('@tesseract.js-data/eng') as LanguageData;
const koreanLanguageData = require('@tesseract.js-data/kor') as LanguageData;
const DATE_CHARACTERS = '0123456789.-/ ';

@Injectable()
export class TesseractExpirationRecognizer
  implements ExpirationRecognizer, OnModuleDestroy
{
  private readonly logger = new Logger(TesseractExpirationRecognizer.name);
  private englishWorkerPromise?: Promise<Tesseract.Worker>;
  private koreanWorkerPromise?: Promise<Tesseract.Worker>;
  private recognitionQueue: Promise<void> = Promise.resolve();

  recognize(image: ImageInput): Promise<RecognitionResult> {
    const recognition = this.recognitionQueue.then(() =>
      this.performRecognition(image),
    );

    this.recognitionQueue = recognition.then(
      () => undefined,
      () => undefined,
    );

    return recognition;
  }

  async onModuleDestroy() {
    await this.recognitionQueue;
    const workers = await Promise.all([
      this.englishWorkerPromise,
      this.koreanWorkerPromise,
    ]);
    await Promise.all(workers.filter(Boolean).map((worker) => worker?.terminate()));
  }

  private async performRecognition(
    image: ImageInput,
  ): Promise<RecognitionResult> {
    const startedAt = Date.now();
    const preparedImage = await prepareImage(image.bytes);
    const englishWorker = await this.getEnglishWorker();

    await englishWorker.setParameters({
      tessedit_char_whitelist: DATE_CHARACTERS,
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    });
    const firstPass = await englishWorker.recognize(
      preparedImage.bytes,
      {},
      { tsv: true },
    );
    const recognizedSegments = [firstPass.data.text];
    let bestConfidence = firstPass.data.confidence;
    let candidates = extractExpirationDateCandidates(
      recognizedSegments.join('\n'),
      bestConfidence,
    );

    const regions = findDateLikeRegions(firstPass.data.tsv, preparedImage);
    await englishWorker.setParameters({
      tessedit_char_whitelist: DATE_CHARACTERS,
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
      user_defined_dpi: '300',
    });

    for (const region of regions) {
      const variants = await createRegionVariants(preparedImage, region);
      let koreanContextCollected = false;
      for (const variant of variants) {
        const englishResult = await englishWorker.recognize(variant);
        recognizedSegments.push(englishResult.data.text);
        bestConfidence = Math.max(
          bestConfidence,
          englishResult.data.confidence,
        );

        const regionCandidates = extractExpirationDateCandidates(
          englishResult.data.text,
          englishResult.data.confidence,
        );
        if (regionCandidates.length === 0 || koreanContextCollected) {
          continue;
        }

        const koreanWorker = await this.getKoreanWorker();
        await koreanWorker.setParameters({
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
          user_defined_dpi: '300',
        });
        const koreanResult = await koreanWorker.recognize(variant);
        recognizedSegments.push(koreanResult.data.text);
        koreanContextCollected = true;
      }
    }

    candidates = extractExpirationDateCandidates(
      recognizedSegments.join('\n'),
      bestConfidence,
    );

    if (
      candidates.length === 0 ||
      candidates.every((candidate) => candidate.confidence < 0.6)
    ) {
      const candidatesBeforeFallback = candidates;
      const fallbackLines = await createFallbackLineVariants(preparedImage);
      for (const fallbackLine of fallbackLines) {
        const fallbackResult = await englishWorker.recognize(fallbackLine);
        recognizedSegments.push(fallbackResult.data.text);
        bestConfidence = Math.max(
          bestConfidence,
          fallbackResult.data.confidence,
        );
      }

      candidates = mergeFallbackCandidates(
        candidatesBeforeFallback,
        extractExpirationDateCandidates(
          recognizedSegments.join('\n'),
          bestConfidence,
        ),
      );
    }

    candidates = markConflictingCandidates(candidates);

    this.logger.log(
      `OCR completed in ${Date.now() - startedAt}ms across ${regions.length} candidate region(s), found ${candidates.length} date candidate(s)`,
    );

    return {
      candidates,
      recognizedText: recognizedSegments.join('\n'),
      confidence: Math.max(0, Math.min(1, bestConfidence / 100)),
    };
  }

  private getEnglishWorker() {
    if (!this.englishWorkerPromise) {
      this.englishWorkerPromise = this.createWorker(
        'eng',
        englishLanguageData,
        () => {
          this.englishWorkerPromise = undefined;
        },
      );
    }
    return this.englishWorkerPromise;
  }

  private getKoreanWorker() {
    if (!this.koreanWorkerPromise) {
      this.koreanWorkerPromise = this.createWorker(
        'kor',
        koreanLanguageData,
        () => {
          this.koreanWorkerPromise = undefined;
        },
      );
    }
    return this.koreanWorkerPromise;
  }

  private createWorker(
    language: string,
    languageData: LanguageData,
    reset: () => void,
  ) {
    return Tesseract.createWorker(language, Tesseract.OEM.LSTM_ONLY, {
      cacheMethod: 'none',
      gzip: languageData.gzip,
      langPath: languageData.langPath,
    }).catch((error: unknown) => {
      reset();
      throw error;
    });
  }
}

function mergeFallbackCandidates(
  existingCandidates: RecognitionResult['candidates'],
  combinedCandidates: RecognitionResult['candidates'],
) {
  if (existingCandidates.length === 0) {
    return combinedCandidates;
  }

  const existingDates = new Set(
    existingCandidates.map((candidate) => candidate.expirationDate),
  );
  const existingYearMonths = new Set(
    existingCandidates.map((candidate) => candidate.expirationDate.slice(0, 7)),
  );

  return combinedCandidates.filter((candidate) => {
    const date = candidate.expirationDate;
    return existingDates.has(date) || !existingYearMonths.has(date.slice(0, 7));
  });
}

function markConflictingCandidates(
  candidates: RecognitionResult['candidates'],
) {
  const countsByYearMonth = new Map<string, number>();
  for (const candidate of candidates) {
    const yearMonth = candidate.expirationDate.slice(0, 7);
    countsByYearMonth.set(yearMonth, (countsByYearMonth.get(yearMonth) ?? 0) + 1);
  }

  return candidates.map((candidate) => ({
    ...candidate,
    requiresConfirmation:
      candidate.requiresConfirmation ||
      (countsByYearMonth.get(candidate.expirationDate.slice(0, 7)) ?? 0) > 1,
  }));
}
