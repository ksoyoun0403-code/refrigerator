const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createFallbackLineVariants,
  findDateLikeRegions,
} = require('../dist/expiration-scans/expiration-image-preprocessor.js');
const sharp = require('sharp');

const TSV_HEADER =
  'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';

test('숫자와 날짜 구분자가 충분한 OCR 줄을 후보 영역으로 선택한다', () => {
  const tsv = [
    TSV_HEADER,
    '5\t1\t1\t1\t1\t1\t768\t1049\t229\t131\t93\t202',
    '5\t1\t1\t1\t1\t2\t1014\t1035\t898\t155\t59\t12.01',
    '5\t1\t2\t1\t1\t1\t100\t100\t40\t20\t90\t제품',
  ].join('\n');

  const regions = findDateLikeRegions(tsv, { width: 2879, height: 2879 });

  assert.equal(regions.length, 1);
  assert.ok(regions[0].left < 768);
  assert.ok(regions[0].top < 1035);
  assert.ok(regions[0].left + regions[0].width > 1912);
  assert.ok(regions[0].top + regions[0].height > 1190);
});

test('날짜 가능성이 낮은 OCR 줄은 후보 영역에서 제외한다', () => {
  const tsv = [
    TSV_HEADER,
    '5\t1\t1\t1\t1\t1\t10\t10\t40\t20\t80\t123',
    '5\t1\t2\t1\t1\t1\t10\t40\t40\t20\t80\t제품명',
  ].join('\n');

  assert.deepEqual(
    findDateLikeRegions(tsv, { width: 1000, height: 1000 }),
    [],
  );
});

test('구분자와 월 앞자리 0이 누락된 OCR 줄도 재인식 영역으로 선택한다', () => {
  const tsv = [
    TSV_HEADER,
    '5\t1\t5\t1\t1\t1\t1057\t1303\t260\t231\t85\t2027',
    '5\t1\t5\t1\t1\t2\t1385\t1299\t389\t247\t73\t311',
  ].join('\n');

  const regions = findDateLikeRegions(tsv, { width: 3024, height: 4032 });

  assert.equal(regions.length, 1);
  assert.ok(regions[0].left < 1057);
  assert.ok(regions[0].left + regions[0].width > 1774);
});

test('날짜 영역을 못 찾을 때 전체 높이를 겹치는 줄 이미지로 분할한다', async () => {
  const bytes = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: 'white',
    },
  })
    .png()
    .toBuffer();

  const variants = await createFallbackLineVariants({
    bytes,
    width: 100,
    height: 100,
  });

  assert.equal(variants.length, 13);
  assert.ok(variants.every((variant) => variant.length > 0));
});
