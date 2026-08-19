const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const {
  GoogleCloudVisionExpirationRecognizer,
} = require('../dist/expiration-scans/google-cloud-vision-expiration-recognizer.js');

const FIXTURE_DIRECTORY = path.join(__dirname, '..', 'test', 'fixtures', 'ocr');
const EXPECTED_DATES = new Map([
  [1, '2026-12-01'],
  [2, '2027-03-11'],
  [3, '2026-12-01'],
  [4, '2027-06-25'],
  [5, '2027-08-04'],
  [6, '2027-05-16'],
  [7, '2027-12-12'],
  [8, '2026-08-30'],
  [9, '2027-04-23'],
  [10, '2027-04-23'],
  [11, '2027-06-09'],
  [12, '2027-06-09'],
  [13, '2026-12-24'],
  [14, '2026-12-24'],
  [15, '2026-12-24'],
  [16, '2026-12-01'],
]);

async function main() {
  const recognizer = new GoogleCloudVisionExpirationRecognizer();
  const files = (await readdir(FIXTURE_DIRECTORY))
    .map((fileName) => ({
      fileName,
      number: Number(fileName.match(/^미디어 \((\d+)\)\.jpg$/)?.[1]),
    }))
    .filter(({ number }) => EXPECTED_DATES.has(number))
    .sort((a, b) => a.number - b.number);

  let correct = 0;
  let totalDuration = 0;
  for (const { fileName, number } of files) {
    const startedAt = Date.now();
    const result = await recognizer.recognize({
      bytes: await readFile(path.join(FIXTURE_DIRECTORY, fileName)),
      fileName,
      mimeType: 'image/jpeg',
    });
    const duration = Date.now() - startedAt;
    const expected = EXPECTED_DATES.get(number);
    const dates = result.candidates.map((candidate) => candidate.expirationDate);
    const passed = dates.includes(expected);
    correct += passed ? 1 : 0;
    totalDuration += duration;
    console.log(JSON.stringify({ number, expected, dates, passed, duration }));
  }

  console.log(
    JSON.stringify({
      correct,
      total: files.length,
      accuracy: files.length === 0 ? 0 : correct / files.length,
      averageDuration: files.length === 0 ? 0 : totalDuration / files.length,
    }),
  );

  if (files.length !== EXPECTED_DATES.size) {
    throw new Error(
      `검증 이미지가 ${EXPECTED_DATES.size}장이어야 하지만 ${files.length}장입니다.`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
