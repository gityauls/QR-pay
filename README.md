# QR 송금

판매자가 휴대폰에서 금액을 입력해 QR을 만들고, 고객이 자기 은행 앱으로 송금할 수 있게 돕는 설치형 웹앱입니다.

## 특징

- 같은 공개 주소를 여러 자영업자가 사용
- 첫 실행에서 판매점 이름과 받을 계좌를 휴대폰에 직접 등록
- 받는 분 추가·수정·삭제와 자동 색상 구분
- 1,000원 단위 금액 입력과 빠른 금액 버튼
- 고객 QR에서 계좌·예금주·금액 확인
- 아이폰 토스 연결 및 일반 은행 계좌번호 복사 안내
- 휴대폰별 오늘 QR 건수와 합계 기록
- Chrome, 삼성 인터넷, Safari 홈 화면 설치

계좌 설정은 각 휴대폰의 브라우저 저장소에만 보관됩니다. GitHub와 서버에는 저장되지 않습니다. 브라우저 데이터나 앱 데이터를 지우면 다시 입력해야 합니다.

이 앱은 은행 입금 완료를 자동 확인하지 않습니다. 판매자는 은행 문자나 은행 앱 알림으로 실제 입금을 확인해야 합니다.

## 실행

탐색기에서 `run-dev.cmd`를 두 번 클릭하거나 다음 명령을 실행합니다.

```powershell
Set-Location -LiteralPath 'C:\QR-pay service'
npm.cmd install
npm.cmd run dev
```

검증:

```powershell
npm.cmd run test:run
npm.cmd run build
```

## GitHub Pages

`.github/workflows/pages.yml`은 `main` 브랜치가 바뀌면 시험·빌드·배포합니다. 계좌용 GitHub Variables나 Secrets는 필요하지 않습니다.

저장소의 `Settings → Pages → Build and deployment → Source`를 `GitHub Actions`로 선택하면 됩니다.

처음 사용하는 방법은 [처음 실행하기](docs/처음-실행하기.md)를 참고하세요.
