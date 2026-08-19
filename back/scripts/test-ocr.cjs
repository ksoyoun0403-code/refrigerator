const { readFile } = require('node:fs/promises');
const path = require('node:path');
const {
  TesseractExpirationRecognizer,
} = require('../dist/expiration-scans/tesseract-expiration-recognizer.js');

const MIME_TYPES = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

async function main() {
  const imagePath = process.argv.slice(2).join(' ');
  if (!imagePath) {
    throw new Error(
      '사용법: npm run test:ocr -- <JPEG 또는 PNG 이미지 경로>',
    );
  }

  const extension = path.extname(imagePath).toLowerCase();
  const mimeType = MIME_TYPES[extension];
  if (!mimeType) {
    throw new Error('JPEG 또는 PNG 이미지만 테스트할 수 있습니다.');
  }

  const recognizer = new TesseractExpirationRecognizer();
  try {
    const result = await recognizer.recognize({
      bytes: await readFile(imagePath),
      fileName: path.basename(imagePath),
      mimeType,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await recognizer.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
