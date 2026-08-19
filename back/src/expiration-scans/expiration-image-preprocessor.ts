import sharp from 'sharp';

export type PreparedImage = {
  bytes: Buffer;
  height: number;
  width: number;
};

type OcrWord = {
  block: number;
  confidence: number;
  height: number;
  left: number;
  line: number;
  page: number;
  paragraph: number;
  text: string;
  top: number;
  width: number;
};

export type OcrRegion = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export async function prepareImage(bytes: Buffer): Promise<PreparedImage> {
  const prepared = await sharp(bytes)
    .rotate()
    .jpeg({ quality: 95 })
    .toBuffer({ resolveWithObject: true });

  return {
    bytes: prepared.data,
    width: prepared.info.width,
    height: prepared.info.height,
  };
}

export function findDateLikeRegions(
  tsv: string | null,
  image: Pick<PreparedImage, 'height' | 'width'>,
): OcrRegion[] {
  if (!tsv) {
    return [];
  }

  const lines = new Map<string, OcrWord[]>();
  for (const row of tsv.split(/\r?\n/)) {
    const columns = row.split('\t');
    if (columns.length < 12 || Number(columns[0]) !== 5) {
      continue;
    }

    const word: OcrWord = {
      page: Number(columns[1]),
      block: Number(columns[2]),
      paragraph: Number(columns[3]),
      line: Number(columns[4]),
      left: Number(columns[6]),
      top: Number(columns[7]),
      width: Number(columns[8]),
      height: Number(columns[9]),
      confidence: Number(columns[10]),
      text: columns.slice(11).join('\t').trim(),
    };
    if (!word.text) {
      continue;
    }

    const key = [word.page, word.block, word.paragraph, word.line].join(':');
    lines.set(key, [...(lines.get(key) ?? []), word]);
  }

  return [...lines.values()]
    .map((words) => ({ words, score: getDateLikelihood(words) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ words }) => expandToRegion(words, image));
}

export async function createRegionVariants(
  image: PreparedImage,
  region: OcrRegion,
) {
  const color = sharp(image.bytes).extract(region).resize({
    width: region.width * 2,
    kernel: sharp.kernel.lanczos3,
  });
  const grayscale = sharp(image.bytes)
    .extract(region)
    .resize({ width: region.width * 2, kernel: sharp.kernel.lanczos3 })
    .grayscale()
    .normalize()
    .sharpen();

  return Promise.all([
    color.jpeg({ quality: 95 }).toBuffer(),
    grayscale.png().toBuffer(),
  ]);
}

export async function createFallbackLineVariants(image: PreparedImage) {
  const horizontalMargin = Math.round(image.width * 0.15);
  const width = image.width - horizontalMargin * 2;
  const height = Math.max(1, Math.round(image.height * 0.1));
  const topRatios = [
    0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
    0.55, 0.6, 0.65, 0.7, 0.75, 0.8,
  ];

  return Promise.all(
    topRatios.map((topRatio) => {
      const top = Math.min(
        Math.round(image.height * topRatio),
        image.height - height,
      );

      return sharp(image.bytes)
        .extract({ left: horizontalMargin, top, width, height })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();
    }),
  );
}

function getDateLikelihood(words: OcrWord[]) {
  const text = words.map((word) => word.text).join(' ');
  const digitCount = (text.match(/\d/g) ?? []).length;
  const delimiterCount = (text.match(/[.\-/]/g) ?? []).length;
  const hasYearAndCompactTail = /(?:19|20)\d{2}\s+\d{3,4}\b/.test(text);
  const confidence = Math.max(...words.map((word) => word.confidence), 0);

  if (
    digitCount < 6 ||
    (delimiterCount === 0 && digitCount < 8 && !hasYearAndCompactTail)
  ) {
    return 0;
  }

  return digitCount * 10 + delimiterCount * 5 + confidence;
}

function expandToRegion(
  words: OcrWord[],
  image: Pick<PreparedImage, 'height' | 'width'>,
): OcrRegion {
  const left = Math.min(...words.map((word) => word.left));
  const top = Math.min(...words.map((word) => word.top));
  const right = Math.max(...words.map((word) => word.left + word.width));
  const bottom = Math.max(...words.map((word) => word.top + word.height));
  const lineWidth = right - left;
  const lineHeight = bottom - top;
  const horizontalPadding = Math.max(Math.round(lineWidth * 0.15), 24);
  const verticalPadding = Math.max(Math.round(lineHeight * 0.25), 20);
  const expandedLeft = Math.max(0, left - horizontalPadding);
  const expandedTop = Math.max(0, top - verticalPadding);
  const expandedRight = Math.min(image.width, right + horizontalPadding);
  const expandedBottom = Math.min(image.height, bottom + verticalPadding);

  return {
    left: expandedLeft,
    top: expandedTop,
    width: expandedRight - expandedLeft,
    height: expandedBottom - expandedTop,
  };
}
