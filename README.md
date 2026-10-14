# 행사 QR 송금

행사장에서 판매자가 금액을 입력해 QR을 보여 주면, 고객이 자기 은행 앱으로 계좌 송금을 진행하는 휴대폰용 웹앱입니다.

처음 설치하는 분은 **[처음 실행하기](docs/처음-실행하기.md)**부터 순서대로 읽어 주세요. 컴퓨터 명령에 익숙하지 않아도 그대로 따라 할 수 있게 작성했습니다.

## 현재 제공하는 기능

- 현재 계좌가 있는 판매자 한 명만으로 바로 시작하고, 두 번째 계좌는 나중에 추가
- 판매자가 두 명이면 휴대폰마다 받을 사람 1명을 기억
- 1,000원부터 500,000원까지, 1,000원 단위 금액 입력
- 큰 숫자판과 숫자·한글 금액 동시 확인
- 고객용 QR 생성 후 15초 뒤 자동으로 다음 손님 화면 복귀
- 고객 화면에서 전체 계좌번호와 금액 확인
- 주요 은행 앱 열기: 계좌번호 자동 복사, 금액은 고객이 직접 입력
- 토스 열기: 계좌와 금액 자동 입력 시도, 실패해도 계좌번호 복사 유지
- 기기별 오늘 QR 생성 건수와 합계를 설정 안에 저장
- 삼성 안드로이드 홈 화면에 앱처럼 설치

이 앱은 결제대행 서비스가 아니며 실제 입금 완료를 자동 확인하지 않습니다. 판매자는 은행 문자나 은행 앱 알림으로 입금을 확인해야 합니다.

## 개발자용 빠른 실행

반드시 프로젝트 폴더에서 실행합니다.

```powershell
Set-Location -LiteralPath 'C:\QR-pay service'
Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
notepad '.env.local'
npm.cmd install
npm.cmd run dev
```

또는 탐색기에서 `C:\QR-pay service\run-dev.cmd`를 두 번 클릭합니다.

검증 명령:

```powershell
Set-Location -LiteralPath 'C:\QR-pay service'
npm.cmd run test:run
npm.cmd run build
```

## 설정 항목

로컬 실행은 `.env.local`을 사용합니다. 이 파일은 Git에 올라가지 않습니다.

| 키 | 용도 |
|---|---|
| `VITE_SHOP_NAME` | 화면 위에 표시할 행사 또는 판매점 이름 |
| `VITE_USER1_LABEL`, `VITE_USER1_COLOR`, `VITE_USER1_BANK`, `VITE_USER1_HOLDER`, `VITE_USER1_ACCOUNT` | 현재 사용할 판매자 1의 필수 정보 |
| `VITE_USER2_LABEL`, `VITE_USER2_COLOR`, `VITE_USER2_BANK`, `VITE_USER2_HOLDER`, `VITE_USER2_ACCOUNT` | 계좌가 준비된 뒤 추가할 판매자 2의 선택 정보 |

판매자 2는 다섯 항목을 모두 비우거나 모두 입력합니다. 비어 있으면 사용자 선택 화면 없이 판매자 1의 금액 입력 화면으로 바로 시작합니다.

계좌번호는 송금을 위해 고객 화면에 표시되므로 배포 후 완전한 비밀정보는 아닙니다. GitHub Secret을 사용하는 이유는 계좌번호가 공개 저장소의 파일과 커밋 기록에 남지 않도록 하기 위해서입니다.

## GitHub Pages 배포

`.github/workflows/pages.yml`이 `main` 브랜치 변경을 자동 배포합니다. 저장소의 `Settings → Secrets and variables → Actions`에서 다음 값을 따로 등록해야 합니다.

- Variables: `QR_PAY_SHOP_NAME`, 사용자 1의 `LABEL`, `COLOR`, `BANK`
- Secrets: 사용자 1의 `HOLDER`, `ACCOUNT`
- 사용자 2는 계좌가 준비된 뒤 `LABEL`, `COLOR`, `BANK`, `HOLDER`, `ACCOUNT`를 한꺼번에 추가

그다음 `Settings → Pages → Build and deployment → Source`를 `GitHub Actions`로 선택합니다. 자세한 화면 순서는 [처음 실행하기](docs/처음-실행하기.md)에 있습니다.

## 향후 기능

상품 선택과 합산, 서버 기반 실제 입금 확인, 기기 간 기록 동기화, 태블릿 전용 화면은 이번 MVP 범위에 포함하지 않았습니다.
