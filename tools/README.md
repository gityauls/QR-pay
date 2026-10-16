# 도구

앱 화면 크기를 정하고 사용법 그림을 다시 만드는 도구입니다. 사이트에는 배포되지 않습니다.

## size-mockup — 글자 크기 시안

- `qr-size-tuner.html`: 슬라이더로 판매자·QR·고객 화면의 글자와 버튼 크기를 조절하는 시안입니다. Claude 아티팩트로 게시되어 있습니다: <https://claude.ai/artifact/LSSBaEkHskD2ebdtYfZ5TU>
  - 아티팩트에서 **이 크기로 확정**을 누르면 값이 저장되고, Claude가 그 값을 읽어 옵니다.
  - 파일을 PC에서 그냥 열어도 됩니다. 이때는 저장이 안 되므로 **코드 복사하기**로 값을 복사해 Claude에게 붙여넣으세요.
- `confirmed-sizes.json`: 2026-10-16에 확정한 값입니다 (폭 360 휴대폰 기준). 그 뒤에 생긴 버튼(voice, countdown, replay)은 시안의 기본값이 곧 앱 값입니다.
- 시안 속 이름·계좌번호는 예시입니다. 실제 계좌를 넣지 마세요 (이 저장소는 공개입니다).
- 값과 `src/styles.css` 맨 위 `:root` 크기 이름의 대응:

| 시안 값 | CSS 이름 |
| --- | --- |
| hdrName | `--seller-name-size` |
| hdrAcct | `--seller-account-size` |
| amount | `--amount-size` |
| hint | `--amount-hint-size` |
| quick / quickH | `--quick-size` / `--quick-height` |
| digit | `--digit-ratio` (키 높이 대비 %) |
| util | `--utility-size` |
| gap | `--key-gap` |
| qr / qrH | `--qr-button-size` / `--qr-button-height` |
| voice / voiceH | `--voice-size` / `--voice-height` |
| countdown | `--countdown-size` |
| replay / replayH | `--replay-size` / `--replay-height` |
| payAmt | `--pay-amount-size` |
| acct | `--pay-account-size` |
| bank / bankH | `--bank-size` / `--bank-height` |
| text | `--pay-text-size` |

## guide-shots — 사용법 그림

`public/guide/img`의 화면 사진, `public/guide/cards`의 카카오톡용 그림 4장, `public/icons/qr-pay-share.png`(카톡 미리보기)를 실제 앱으로 다시 찍습니다. 앱 화면을 바꾼 뒤에 실행하세요.

```bash
npm --prefix tools/guide-shots install
node tools/guide-shots/run.mjs
```

- Windows의 Microsoft Edge를 사용합니다. 크롬을 쓰려면 `BROWSER_CHANNEL=chrome`을 붙이세요.
- 앱 밖의 화면(카톡 대화방, 설치 창, 홈 화면, 아이폰 공유 메뉴)은 `mocks.html`에 그린 그림입니다.
- 그림 속 이름과 계좌번호는 예시값(홍길동, 123-4567-8901-23)입니다.
