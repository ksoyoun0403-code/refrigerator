# OCR 검증 이미지

직접 촬영했거나 사용할 권한이 있고 개인정보가 없는 JPEG/PNG 이미지만 이 디렉터리에 둡니다.

권장 검증 세트:

- 선명한 날짜 이미지 10장
- 빛 반사가 있는 이미지 5장
- 기울어진 이미지 5장
- 날짜가 없는 이미지 5장
- 날짜가 여러 개 있는 이미지 5장

개별 이미지는 다음 명령으로 확인합니다.

```bash
cd back
npm run test:ocr -- test/fixtures/ocr/example.jpg
```

Google Cloud Vision 개별 이미지와 전체 기준 세트는 다음 명령으로 검증합니다.

```bash
cd back
npm run test:vision -- test/fixtures/ocr/example.jpg
npm run test:vision-fixtures
```

실제 이미지 파일은 저장소에 커밋하기 전에 사용 권한과 개인정보 포함 여부를 확인합니다.

현재 Google Cloud Vision 검증 결과(2026-08-19): 실제 이미지 16장 중 15장에서 정답 날짜가 후보에 포함됐고(93.8%), 평균 처리시간은 약 0.55초였습니다. 기준 날짜는 사용자 확인값이며, 6번은 `2027-05-16`을 `2027-05-06`으로 읽어 실패했습니다.
