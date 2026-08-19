const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  extractGoogleVisionConfidence,
  extractGoogleVisionText,
} = require('../dist/expiration-scans/google-cloud-vision-expiration-recognizer.js');

test('Google Vision 전체 텍스트를 추출한다', () => {
  assert.equal(
    extractGoogleVisionText({
      responses: [{ fullTextAnnotation: { text: '유통기한 2027.06.25까지' } }],
    }),
    '유통기한 2027.06.25까지',
  );
});

test('전체 텍스트가 없으면 textAnnotations 첫 결과를 사용한다', () => {
  assert.equal(
    extractGoogleVisionText({
      responses: [{ textAnnotations: [{ description: '2026.12.01' }] }],
    }),
    '2026.12.01',
  );
});

test('인식 단어 신뢰도의 평균을 계산한다', () => {
  assert.equal(
    extractGoogleVisionConfidence({
      responses: [
        {
          fullTextAnnotation: {
            pages: [
              {
                blocks: [
                  {
                    paragraphs: [
                      { words: [{ confidence: 0.8 }, { confidence: 1 }] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    }),
    0.9,
  );
});
