# 어르신용 QR 송금 결제 시스템 — 구현 명세서 v2 (Codex 전달용)

> **Codex에게:** 이 문서 전체를 읽고 §12 "작업 순서"의 마일스톤 순서대로 구현하세요.
> 실제 계좌·예금주·상품 가격은 이 문서에 넣지 않았습니다. 환경변수/설정 파일의 `TODO` 자리로 남겨 두세요.
> 불확실하다고 표시된 항목(`확인 필요`)은 추측으로 채우지 말고 설정값·피처 플래그로 빼 두세요.

### v2 변경 사항
- **판매자 2명(장인어른·장모님), 각자 다른 은행 계좌.** QR을 만들기 전에 **누가 판매하는지(= 누구 통장으로 받을지) 반드시 선택**합니다.
  - 이유 ① 선택한 사람의 휴대폰으로 **입금 문자/알림**이 와서 그 자리에서 입금을 확인할 수 있어야 함.
  - 이유 ② 두 분 중 한 분이 자리를 비워도 남은 분이 **자기 계좌로** 받을 수 있어야 함.
- 반영 위치: §0, §2.1, §3(3.1 상황별 사용 신규), §4.1~4.5(4.5 로컬 저장 신규), §5.0(신규 판매자 선택 화면), §5.1~5.6, §6~§13 전반.

---

## 0. 한눈에 보기

| 항목 | 내용 |
|---|---|
| 판매자(사용자) | 60대 자영업 부부 **2명** — 판매자1(장인어른), 판매자2(장모님). **각자 다른 은행 계좌** 보유. 행사장에서 꿀·화분·로얄제리·치약 판매 |
| 고객(이용자) | 불특정 다수. 국내 아무 은행 앱이나 사용 |
| 목표 | 판매자가 **본인을 선택** → 상품을 누르면 → **본인 계좌 + 금액이 담긴 QR**이 뜨고 → 고객이 **기본 카메라로 찍으면** 송금 안내 페이지가 열리고 → 은행 앱으로 바로 이어짐 → **선택한 판매자 휴대폰으로 입금 문자**가 와서 확인 |
| 참고 서비스 | AQR (aqr.aplx.link) — 계좌 송금 QR 페이지 서비스 |
| AQR 대비 개선점 | AQR은 **페이지 1개 = 계좌 1개 = 고정 금액 1개**. 우리는 **판매자(계좌) 선택 + 판매할 때마다 금액이 바뀌는 동적 QR** + 어르신용 큰 버튼 UI |
| 구조 | **서버 없는 정적 웹사이트(PWA)**. 돈은 고객 은행 → 선택된 판매자 계좌로 직접 이동하고, 우리 시스템은 돈을 만지지 않음 |
| 배포 | Cloudflare Pages(무료, 비공개 저장소 가능). 대안: Vercel |

---

## 1. 현실 점검 — 무엇이 가능하고 무엇이 불가능한가 (중요)

개인 개발자는 은행 앱 안에 **금액을 강제로 채워 넣는 공식 API를 쓸 수 없습니다.** 은행·PG·제로페이 같은 정식 결제사업자만 가능합니다. 그래서 AQR도 "클립보드 복사 + 은행 앱 열기" 방식입니다.

| 송금 경로 | 계좌 자동 입력 | **금액 자동 입력** | 근거 / 상태 |
|---|---|---|---|
| **토스 딥링크** `supertoss://send?bank=&accountNo=&amount=` | ✅ | ✅ | 비공식이지만 오픈소스 여러 곳에서 사용 중. 금액은 정수만(`62500`, 소수점·콤마 금지). **실기기 테스트 필수** |
| 카카오페이 송금 QR 링크 `qr.kakaopay.com/{코드}` | ✅ (해당 판매자 카카오페이로) | ⚠️ 비공식 해킹(코드 뒤에 `(금액<<19)`의 16진수를 붙임) | 공식 명세가 아님. **기본값 OFF** 피처 플래그. 판매자별로 따로 설정 |
| 일반 은행 앱 (KB·신한·농협·우리·하나 등) | ⚠️ 클립보드에 복사된 계좌를 앱이 인식하면 "복사한 계좌로 보내기" 제안 | ❌ 고객이 직접 입력 | 화면에 금액을 **아주 크게** 보여줘서 보고 입력하게 함 |
| (참고) 제로페이 가맹 QR | ✅ | 고객 입력 | 정식 소상공인 결제 QR. 사업자 등록·가맹 신청 필요. 이 프로젝트 범위 밖이지만 대안으로 안내 |

**결론:** "찍으면 금액까지 자동 입력 → 송금 버튼" 경험은 **토스**에서만 확실하게 됩니다. 나머지 은행은 "계좌 자동 복사 + 큰 금액 표시 + 앱 바로 열기"까지가 현실적 최선입니다. 어떤 경로든 마지막 **송금 확정(비밀번호·생체인증)은 고객 은행 앱에서 고객이** 합니다. 이건 막을 수 없고, 막아서도 안 됩니다.

### 1.1 제미나이 답변에서 바로잡을 점
- "클립보드 허용 시 이체 화면에 계좌와 **금액**이 자동으로 붙여넣어진다" → 대부분의 은행 앱은 **계좌번호만** 인식합니다. 금액은 직접 입력합니다.
- "URL의 계좌 정보를 암호화/토큰화해야 한다" → 고객 화면에 어차피 계좌가 보여야 하므로 암호화의 의미가 적습니다. 대신 **계좌를 URL에 넣지 않고 사이트 설정에 고정**하고, URL에는 판매자 번호(`s=1`/`s=2`)만 넣습니다. 이렇게 하면 누가 URL을 조작해도 두 분 계좌 외의 다른 계좌로 바꿀 수 없습니다.
- Python 백엔드는 필요 없습니다. QR 생성까지 전부 브라우저에서 처리합니다.

---

## 2. AQR 분석 결과

### 2.1 관리자 화면 (`aplx.link/square/manager`) 구성

| 영역 | 필드 / 기능 | 입력 형태 | 우리 구현 반영 |
|---|---|---|---|
| 페이지 목록 | 검색, 페이지당 개수(10/20/50/100), 전체 선택, `+` 새 페이지 | — | ❌ 대신 **판매자 2명 설정**으로 대체 (AQR이라면 페이지 2개·QR 2세트를 따로 만들어야 하는 구조) |
| 페이지 정보 | **제목**(상호, 예: "김선비 벌꿀") | text | ✅ `SHOP_NAME` (두 판매자 공통) |
| 입금 계좌 | **표시 토글** | switch | ✅ 항상 표시 |
| | **은행** (은행·증권사 60여 곳 select + 은행 아이콘) | select | ✅ **판매자별** 설정 |
| | **예금주** | text | ✅ **판매자별** `S{n}_HOLDER` |
| | **계좌번호** (숫자만) | number | ✅ **판매자별** `S{n}_ACCOUNT_NO` |
| | 경고문: "예금주명이 실 계좌와 일치하지 않으면 페이지 삭제" | 안내 | 참고 |
| 추가설정 › 페이지 화면 | 아이콘 이미지 | file | ✅ 선택(가게 로고) |
| | **예금주명 마스킹**: 감추지 않기 / 일부 감추기 | select | ✅ `MASK_HOLDER` (예: 김*집) |
| | **입금요청 금액** (고정값, 숫자만) | text | ✅ **동적으로 확장** (판매마다 다른 금액) |
| | 표시기한 날짜 / 시각 | date / time | ⏸ P3 (선택) |
| | 현금(기부)영수증 요청 버튼: 감춤/표시, 이메일 or 요청 폼 URL | select | ⏸ P3 (전화/문자 링크로 단순화) |
| 추가설정 › 버튼 | 커스텀 버튼: 링크/텍스트/유튜브/이메일/전화번호/좋아요, 제목, 순서 변경 | 반복 입력 | ⏸ P3 (판매자 전화 버튼 정도만) |
| 추가설정 › 페이앱 | 카카오페이·네이버페이·지역화폐 등 선택 + 송금 URL 입력(QR 스캔으로 URL 입력 가능) | 반복 입력 | ✅ **판매자별** 카카오페이 1개 + 확장 가능한 목록 |
| 추가설정 › 암호화폐 | MetaMask / OKX / Phantom | — | ❌ 불필요 |
| 고유 QR 코드 | 인쇄, 내려받기, 가운데 로고 넣기, 격자색, 배경색, 격자모양(동그라미/사각형/약간둥글게), 초기화 | — | ✅ 인쇄·내려받기 / 디자인은 단순하게(인식률 우선) / **판매자별 색 테두리** |
| | 경고: "카메라 앱으로 반드시 테스트 후 사용" | 안내 | ✅ 그대로 반영 |
| 고유 URL | 단축 URL `aq.gy/f/{5자리 토큰}` + 복사·공유 | — | ✅ 짧은 URL 설계 (§4.3) |
| 위젯 코드 | `<script src="https://aq.gy/widget">` 임베드 | — | ❌ |
| 페이지 사용 집계 | 연/월/주 단위 통계 | — | ⏸ 판매자 기기 안의 "오늘 판매 합계(판매자별)"로 대체 |
| 유료 부가기능 | "입금 알림 — 직원에게 전달" | — | ❌ 대신 **판매자 각자 휴대폰의 은행 입출금 알림(문자/앱 푸시)** 사용 |

### 2.2 고객 공개 페이지 (`aq.gy/f/{token}`) 구성

```
┌───────────────────────────────┐
│ [AQR 로고]                 ☰  │  ← 초록 상단바 (#1e8a7a 계열)
├───────────────────────────────┤
│   (아이콘) 김선비 벌꿀          │  ← 상호 카드
│                               │
│  송금에 사용할 내 은행을 선택하세요.│
│              ⌄                │
│ ┌ 개인용 | 기업용 | (기타)  🔍 ┐ │  ← 탭 + 검색
│ │ ── 페이 ──                  │ │
│ │ (로고) 인천e음 / 코나아이      │ │
│ │ ── 은행 ──                  │ │
│ │ (로고) 카카오뱅크   (로고) 토스  │ │  ← 2열 그리드: 앱 이름 + 은행명
│ │ (로고) 신한SOL     (로고) 우리WON│ │
│ │ (로고) KB스타뱅킹  (로고) 하나원큐│ │
│ │ ... 40여 개 ...              │ │
│ └─────────────────────────────┘ │
│  나만의 QR을 만들면 ... →        │  ← 자사 광고
└───────────────────────────────┘
```

- 각 은행 항목은 `div#runbutton_area_{id}` + `data-clipboard-text` 속성(clipboard.js 사용) → **탭하면 계좌 정보를 클립보드에 복사하고 해당 은행 앱을 실행**하는 구조. 알림은 toastr 토스트.
- 페이지 내부 데이터 키로 `fm_price`(요청 금액), `b_name`(은행), `b_owner`(예금주), `ac_visi`(계좌 표시), `receipt_req`/`receipt_url`(영수증 요청)가 쓰임.
- 모바일 미리보기 기준 은행 앱 노출 순서: 카카오뱅크, 토스, 신한SOL, 우리WON뱅킹, KB스타뱅킹, 하나원큐, NH콕뱅크, NH스마트뱅킹, i-ONE뱅크, MG더뱅킹, 신한슈퍼SOL, NH올원뱅크, SC제일은행, 씨티모바일, 광주WA뱅크, 케이뱅크, 우체국뱅킹, BNK부산은행, iM뱅크, 신협ON뱅크, J뱅크, 헤이뱅크, 스마트KDB, 쏙뱅크, BNK경남은행, (구버전 앱들)…
- PC에서 열면 앱 이름 대신 은행명 목록만 보임(모바일 전용 동작).
- AQR은 **페이지 하나에 계좌 하나**뿐이라, 두 분이 각자 계좌로 받으려면 페이지·QR을 두 개 만들어 관리해야 함 → 우리는 앱 안에서 판매자를 고르는 방식으로 해결.

### 2.3 AQR에서 **따라 하지 말 것**
- 은행 40여 개를 한 번에 나열 → 고객이 찾기 힘듦. **상위 8개 + "다른 은행" 펼치기**로 줄임.
- 작은 글씨(12~14px), 광고 배너, 개발자도구 감지·봇 차단 스크립트 → 전부 제외.
- 금액이 페이지에 고정 → 우리는 **QR마다 금액이 다름**.

---

## 3. 사용 흐름

```
[판매자 폰: 판매 앱(PWA)]                              [고객 폰: 기본 카메라]
 ⓪ 앱 열기 → "누가 판매하시나요?"
    [장인어른] / [장모님] 중 본인 선택  ← 입금 문자를 받아 확인할 사람
 ① 상품 버튼 탭 (꿀 ×2, 치약 ×1)
 ② 합계 "45,000원" 확인 (상단에 "장모님 통장으로 받아요" 표시)
 ③ [QR 보여주기] 탭
 ④ 화면 가득 QR + "45,000원" + "받는 분: 장모님"  ── 촬영 ──▶ ⑤ 송금 페이지 열림 (/p/?s=2&a=45000&i=H2T1)
                                                          "김선비 벌꿀(받는 분 김*○)에 45,000원 보내기"
                                                          ⑥-A [토스로 보내기] → 토스 앱, 장모님 계좌+금액 자동 입력
                                                          ⑥-B [다른 은행 앱] → 장모님 계좌 복사됨 → 은행 앱 열림
                                                               → 금액 직접 입력
                                                          ⑦ 고객이 은행 앱에서 비밀번호/생체인증 → 송금
 ⑧ 장모님 휴대폰으로 "입금 45,000원" 문자/알림 도착 → 확인
 ⑨ [받았어요] 탭 → 처음 화면으로 + 오늘 판매 합계(장모님)에 기록
```

### 3.1 상황별 사용
| 상황 | 하는 일 |
|---|---|
| 두 분이 같이 판매, 각자 휴대폰 | 각자 자기 휴대폰에서 **자기 이름** 선택 → 각자 통장으로 받고 각자 문자 확인 |
| 두 분이 같이 판매, 휴대폰 1대 | 지금 **입금 문자를 확인할 분**을 선택. 손님마다 바꿔도 됨(상단 [판매자 바꾸기]) |
| **한 분이 자리 비움** | 남은 분이 **본인 이름** 선택 → 남은 분 통장으로 입금 → 남은 분 휴대폰으로 문자 확인. 자리 비운 분 통장으로 받으면 문자를 확인할 수 없으므로 피함 |
| 인쇄 QR 카드 사용 | 판매자별로 **색이 다른 카드 세트**를 미리 인쇄. 자리에 있는 분의 카드 세트만 진열 (§5.5) |

**판매자 폰 없이 쓰는 모드(가장 쉬움):** 가격이 정해진 상품별로 **QR 카드를 판매자별로 인쇄**해서 진열대에 세워 둠 (예: 파란 테두리 = 장인어른 통장, 주황 테두리 = 장모님 통장). → §5.5

---

## 4. 시스템 설계

### 4.1 아키텍처
- **정적 사이트 1개**에 화면 3종: 판매자 앱 `/`, 고객 송금 페이지 `/p/`, 인쇄 페이지 `/print/`.
- 서버·DB·로그인 없음. 고객 개인정보를 수집하지 않음.
- 판매자 2명의 계좌 정보는 **빌드 시 환경변수로 주입**(Git 저장소에 커밋하지 않음). 단, 고객 화면에 표시되는 정보이므로 번들에 포함되는 건 정상입니다.
- 판매자 앱은 PWA(홈 화면 아이콘, 오프라인 동작). QR 생성은 기기 안에서 처리하므로 행사장 인터넷이 약해도 QR은 뜸. (고객은 송금하려면 어차피 인터넷이 필요)
- 판매자2 설정이 비어 있으면 판매자 1명 모드로 동작(선택 화면 생략) — 나중에 한 분만 쓰게 돼도 코드 수정 없이 대응.

### 4.2 기술 스택
| 영역 | 선택 | 이유 |
|---|---|---|
| 빌드 | Vite + **바닐라 TypeScript** (프레임워크 없음) | 고객 페이지를 가볍게(목표 gzip 50KB 이하), 행사장 약한 신호에서도 빨리 열리게 |
| QR | `qrcode` (npm) | 단순·안정. 오류정정 `M`, 여백 4모듈. 가운데 로고를 넣을 때만 `H` |
| PWA | `vite-plugin-pwa` | 홈 화면 설치, 오프라인 캐시 |
| 테스트 | Vitest(단위), Playwright(모바일 뷰포트 E2E) | |
| 배포 | Cloudflare Pages | 무료, 비공개 GitHub 저장소 연결, 환경변수 지원, `*.pages.dev` 짧은 도메인 |

### 4.3 고객 송금 페이지 URL 규격

```
https://{도메인}/p/?s=2&a=45000&i=H2T1
```

| 파라미터 | 필수 | 형식 | 설명 |
|---|---|---|---|
| `s` | **필수** | `1` 또는 `2` | **판매자(받는 계좌) 번호.** 설정에 없는 값이면 오류 화면 |
| `a` | 선택 | 정수, 100 ≤ a ≤ 500,000 | 요청 금액(원). 없으면 "금액 직접 입력" 모드 |
| `i` | 선택 | `([A-Z][0-9]{1,2})+` | 상품 코드+수량 (예: `H2T1` = 꿀 2, 치약 1). **표시용**일 뿐, 금액 계산 근거는 `a` |
| `v` | 선택 | 정수 | URL 규격 버전 (기본 1) |

규칙:
- **계좌번호·예금주·은행은 절대 URL에 넣지 않는다.** URL에는 판매자 번호 `s`만. 실제 계좌는 설정에서 `s`로 찾는다.
- `s`가 없거나 설정에 없는 번호면: "이 QR로는 송금할 수 없어요. 판매자에게 새 QR을 보여달라고 해주세요." (다른 판매자 계좌로 **임의로 대체하지 않음** — 엉뚱한 사람 통장으로 가는 것 방지)
- 한글을 URL에 넣지 않는다 → QR이 촘촘해져 오래된 폰 카메라에서 인식률이 떨어짐. 상품은 1글자 코드로.
- `a`가 범위를 벗어나거나 숫자가 아니면: "금액 정보가 올바르지 않아요. 판매자에게 QR을 다시 보여달라고 해주세요." + 직접 입력 모드.
- `i`의 상품 합계와 `a`가 다르면(가격 변경 등) 상품 목록은 숨기고 금액만 표시.
- 최종 URL 길이 목표: 60자 이내.

### 4.4 설정 (`.env` + `src/config.ts`)

`.env.example` (실제 값은 Cloudflare Pages 환경변수에 입력, 저장소엔 커밋 금지):
```dotenv
VITE_SHOP_NAME=김선비 벌꿀
VITE_MASK_HOLDER=true              # 고객 화면 예금주 일부 가림(김*집)
VITE_KAKAOPAY_AMOUNT_HACK=false    # 비공식 금액 인코딩. 테스트 전까지 false
VITE_SETTINGS_PIN=0000             # 판매자 설정 화면 잠금(실수 방지용일 뿐 보안 아님)
VITE_ASK_SELLER_ON_START=true      # 앱을 열 때마다 판매자 선택 화면 표시
VITE_PUBLIC_BASE_URL=https://TODO.pages.dev

# ── 판매자 1 (장인어른) ──
VITE_S1_LABEL=TODO                 # 선택 화면에 크게 보일 호칭/이름 (두 분이 바로 알아볼 말로)
VITE_S1_EMOJI=👨‍🦳                  # 선택 화면 그림 (사진 쓰면 public/img/s1.jpg)
VITE_S1_COLOR=#1D4ED8              # 판매자 구분색(파랑) — 선택 버튼·상단 띠·QR 테두리·인쇄 카드
VITE_S1_BANK_DISPLAY=TODO          # 화면 표시용 은행명, 예: 농협은행
VITE_S1_TOSS_BANK=TODO             # 토스 딥링크용 은행명. '은행' 접미사를 뺀 이름. 실기기 테스트로 확정
VITE_S1_ACCOUNT_NO=TODO            # 숫자만
VITE_S1_HOLDER=TODO                # 예금주
VITE_S1_KAKAOPAY_QR=               # 이 분 카카오페이 송금 QR의 코드 부분(없으면 비움)
VITE_S1_PHONE=                     # 선택: 고객 페이지 "판매자에게 전화" 버튼

# ── 판매자 2 (장모님) — 비워두면 1명 모드 ──
VITE_S2_LABEL=TODO
VITE_S2_EMOJI=👩‍🦳
VITE_S2_COLOR=#C2410C              # 판매자 구분색(주황)
VITE_S2_BANK_DISPLAY=TODO
VITE_S2_TOSS_BANK=TODO
VITE_S2_ACCOUNT_NO=TODO
VITE_S2_HOLDER=TODO
VITE_S2_KAKAOPAY_QR=
VITE_S2_PHONE=
```

`src/env.ts` — 환경변수를 판매자 배열로 변환하고 검증:
```ts
export type SellerId = '1' | '2';
export type Seller = {
  id: SellerId;
  label: string;          // 선택 화면 큰 글씨
  emoji: string;
  color: string;          // 구분색 (명도 대비 AA 이상 확인)
  bankDisplay: string;    // 예: 농협은행
  tossBank: string;       // 예: 농협
  accountNo: string;      // 숫자만
  holder: string;
  kakaopayQr?: string;
  phone?: string;
};

// 규칙
// - S1은 필수. S2는 ACCOUNT_NO가 비어 있으면 생략(1명 모드).
// - 'TODO'가 남아 있거나 accountNo에 숫자 외 문자가 있거나 holder가 비면 → 빌드 실패(throw).
// - 두 판매자의 color가 같으면 빌드 실패(구분이 안 되므로).
export const SELLERS: Seller[] = buildSellersFromEnv(import.meta.env);
export const getSeller = (id: string | null) => SELLERS.find(s => s.id === id) ?? null;
```

`src/config.ts` (상품 목록 — 비밀 아님, 저장소에 커밋):
```ts
export type Product = {
  code: string;      // 1글자 대문자, URL용 (H, P, R, T ...)
  name: string;      // 화면 표시명
  price: number;     // 원, 정수
  emoji: string;     // 사진 없을 때 큰 아이콘
  image?: string;    // /img/honey.jpg (선택)
  color: string;     // 버튼 배경색 (색+글자 함께 사용)
};

// TODO: 실제 상품명·가격으로 교체 (아래 가격은 화면 확인용 예시)
export const PRODUCTS: Product[] = [
  { code: 'H', name: '꿀',     price: 20000, emoji: '🍯', color: '#F6C343' },
  { code: 'P', name: '화분',   price: 15000, emoji: '🪴', color: '#7BC47F' },
  { code: 'R', name: '로얄제리', price: 50000, emoji: '👑', color: '#E8A0BF' },
  { code: 'T', name: '치약',   price: 5000,  emoji: '🪥', color: '#8EC5FC' },
];

// 금액 직접 입력 화면의 빠른 버튼
export const QUICK_AMOUNTS = [10000, 5000, 1000];
```
- 상품·가격은 **두 판매자 공통**(같은 가게).
- 판매자 설정 화면(PIN 보호)에서 가격을 바꾸면 `localStorage`에 덮어쓰기 저장 → 앱 재배포 없이 가격 수정 가능. 저장 실패 시 `config.ts` 기본값 사용.
- **계좌 정보는 앱 화면에서 수정 불가**(환경변수로만) → 실수로 다른 계좌가 들어가는 것을 방지.

### 4.5 판매기기 로컬 저장 (`localStorage`, 모두 try/catch)

| 키 | 값 | 용도 |
|---|---|---|
| `qrpay.currentSeller` | `'1'` \| `'2'` | 마지막으로 선택한 판매자 (선택 화면에서 "지난번" 표시) |
| `qrpay.deviceOwner` | `'1'` \| `'2'` \| 없음 | 이 휴대폰 주인. 선택 화면에서 이 분 버튼을 위에 배치 (설정에서 지정) |
| `qrpay.priceOverrides` | `{H: 22000, ...}` | 가격 수정값 |
| `qrpay.sales` | `[{t, sellerId, amount, items}]` | 판매 기록 (최근 30일만 유지) |

- 판매 기록은 **기기별로 따로** 쌓입니다(서버가 없으므로). 두 분이 각자 휴대폰을 쓰면 각자 휴대폰에 각자 기록이 남습니다.

### 4.6 은행 앱 데이터 (`src/banks.ts`)

```ts
export type BankApp = {
  id: string;
  label: string;           // 버튼에 보일 앱 이름
  bank: string;            // 작은 글씨 은행명
  iosScheme?: string;      // 예: 'kbbank' → kbbank://
  androidPackage?: string; // 예: 'com.kbstar.kbbank'
  verified: boolean;       // 실기기에서 열림 확인했는지
  top: boolean;            // 첫 화면 8개에 노출할지
};
```

조사로 확인한 시드 데이터 (출처: NICEPAY 앱 연동 문서, PortOne 가이드, Google Play 상세 페이지 — 2026-10 기준). **앱 정보는 수시로 바뀌므로 `verified`는 실기기 테스트 후에만 true로.**

| id | label | bank | iOS scheme | Android package | 조사 상태 |
|---|---|---|---|---|---|
| toss | 토스 | 모든 은행 | `supertoss` | `viva.republica.toss` | 스킴·패키지 확인. 금액 자동 입력 지원 |
| kakaobank | 카카오뱅크 | 카카오뱅크 | `kakaobank` | `com.kakaobank.channel` | 확인 |
| kb | KB스타뱅킹 | 국민은행 | `kbbank` | `com.kbstar.kbbank` | 확인 |
| woori | 우리WON뱅킹 | 우리은행 | `NewSmartPib` | `com.wooribank.smart.npib` | 확인 |
| shinhan | 신한 SOL | 신한은행 | 확인 필요 | Play에서 `com.shinhan.sbanking` = "신한 슈퍼SOL" 확인 / NICEPAY 문서는 `com.shinhan.smartcaremgr` 표기 | **확인 필요** |
| nh_smart | NH스마트뱅킹 | 농협 | 확인 필요 | `nh.smart.banking` | 패키지 확인 |
| nh_allone | NH올원뱅크 | 농협 | 확인 필요 | 확인 필요 (iOS App Store id1641628055) | **확인 필요** |
| hana | 하나은행 앱 | 하나은행 | 확인 필요 | `com.kebhana.hanapush`는 "(구)하나원큐 – 종료 예정" → 신규 앱 확인 | **확인 필요** |
| ibk | i-ONE Bank | 기업은행 | 확인 필요 | `com.ibk.android.ionebank` | 패키지 확인 |
| kbank | 케이뱅크 | 케이뱅크 | 확인 필요 | `com.kbankwith.smartbank` | 패키지 확인 |
| post | 우체국뱅킹 | 우체국 | 확인 필요 | `com.epost.psf.sdsi` | 패키지 확인 |
| busan | BNK부산은행 | 부산은행 | 확인 필요 | `kr.co.busanbank.mbp` | 패키지 확인 |
| mg, im, suhyup, cu, sc, citi, kj, jb, kn, jeju, kdb | MG더뱅킹, iM뱅크, 헤이뱅크, 신협ON뱅크, SC제일, 씨티, 광주, 전북, 경남, 제주, KDB | — | 미조사 | 미조사 | 이름만 노출, 탭하면 "복사됐어요, 앱을 직접 열어주세요" 안내 |

첫 화면 8개(`top: true`): 토스, 카카오뱅크, KB스타뱅킹, 신한 SOL, NH(농협), 우리WON, 하나, IBK. 나머지는 "다른 은행 보기" 펼침.

---

## 5. 화면 상세 명세

### 5.0 판매자 선택 (`/` 첫 화면) — **신규**

```
┌──────────────────────────────┐
│   누가 판매하시나요?             │  ← 32px 굵게
│   입금 문자를 받아 확인할 분을     │
│   눌러 주세요                   │  ← 22px
│                               │
│ ┌───────────────────────────┐ │
│ │  👨‍🦳                        │ │
│ │  {S1_LABEL}                  │ │  ← 파랑(S1_COLOR) 배경, 흰 글씨 36px
│ │  {S1_BANK_DISPLAY} 통장으로 받기 │ │  ← 높이 180px 이상
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │  👩‍🦳                        │ │
│ │  {S2_LABEL}                  │ │  ← 주황(S2_COLOR) 배경
│ │  {S2_BANK_DISPLAY} 통장으로 받기 │ │
│ └───────────────────────────┘ │
│   ✔ 지난번에는 {S2_LABEL}         │  ← 마지막 선택 안내 (자동 선택은 안 함)
└──────────────────────────────┘
```

동작:
- `VITE_ASK_SELLER_ON_START=true`이면 **앱을 열 때마다** 이 화면부터 시작. 한 번 탭하면 홈(§5.1)으로.
- **자동으로 넘어가지 않음.** 반드시 본인이 탭해야 함 (요구사항: QR 생성 전 본인 선택).
- 계좌번호는 이 화면에 표시하지 않음(은행명만). 옆 사람이 볼 수 있으므로.
- `deviceOwner`가 설정돼 있으면 그 분 버튼을 위로 배치.
- 판매자가 1명뿐이면 이 화면 생략.
- 선택 결과는 `qrpay.currentSeller`에 저장하고 이후 모든 화면 상단 띠·QR 테두리·URL `s`에 반영.

### 5.1 판매자 홈 (`/`) — 상품 고르기

```
┌──────────────────────────────┐
│▓▓ 👩‍🦳 {S2_LABEL} 통장으로 받는 중 ▓│  ← 판매자 색 상단 띠, 24px 흰 글씨
│▓▓            [판매자 바꾸기]   ▓│  ← 64px 버튼 → §5.0으로
├──────────────────────────────┤
│  김선비 벌꿀        [⚙ 설정]   │  ← 설정은 작게, PIN 필요
│ ┌────────────┐ ┌────────────┐ │
│ │    🍯      │ │    🪴      │ │
│ │    꿀      │ │   화분      │ │  ← 상품 버튼 2×2, 최소 높이 140px
│ │  20,000원  │ │  15,000원   │ │
│ │  [ 2개 ]   │ │            │ │  ← 담긴 수량 배지(크게)
│ └────────────┘ └────────────┘ │
│ ┌────────────┐ ┌────────────┐ │
│ │    👑      │ │    🪥      │ │
│ │  로얄제리   │ │   치약      │ │
│ │  50,000원  │ │   5,000원   │ │
│ └────────────┘ └────────────┘ │
│                               │
│  꿀 2개   [ − ]  [ + ]          │  ← 담긴 상품 줄 (− + 버튼 64px)
│  치약 1개 [ − ]  [ + ]          │
│                               │
│  [ 금액 직접 입력 ]  [ 전부 지우기 ]│
├──────────────────────────────┤
│  합계  45,000원                 │  ← 48px 이상 굵게
│        (4만 5천원)              │  ← 한글 읽기 표기
│ ┌───────────────────────────┐ │
│ │      QR 보여주기  ▶         │ │  ← 초록, 높이 88px, 화면 하단 고정
│ └───────────────────────────┘ │
│  오늘: {S1} 5건 150,000원        │
│        {S2} 7건 234,000원        │  ← 판매자별 합계
└──────────────────────────────┘
```

동작:
- 상품 버튼 탭 = 수량 +1 (진동 30ms, 지원 기기만). 길게 누르기 같은 숨은 동작 금지.
- 합계 0원이면 [QR 보여주기] 비활성 + "상품을 먼저 눌러주세요" 문구.
- [전부 지우기]는 바로 지우고 5초간 "되돌리기" 버튼 표시 (확인 팝업 대신).
- [판매자 바꾸기]를 눌러도 **담아 둔 상품은 유지**.
- 판매자가 선택되지 않은 상태(저장값 없음/손상)에서는 홈 진입 불가 → §5.0으로.

### 5.2 금액 직접 입력

```
┌──────────────────────────────┐
│▓▓ 👩‍🦳 {S2_LABEL} 통장으로 받는 중 ▓│
│  받을 금액                     │
│       45,000원                 │  ← 56px
│      (4만 5천원)               │
│ [+1만원] [+5천원] [+1천원]       │  ← 빠른 버튼
│ ┌────┬────┬────┐              │
│ │ 1  │ 2  │ 3  │              │  ← 키패드 버튼 80px 정사각
│ │ 4  │ 5  │ 6  │              │
│ │ 7  │ 8  │ 9  │              │
│ │ 00 │ 0  │ ⌫  │              │
│ └────┴────┴────┘              │
│ [ 처음으로 ]   [ QR 보여주기 ▶ ] │
└──────────────────────────────┘
```
- 최대 500,000원. 넘으면 입력 무시 + 안내.

### 5.3 QR 표시 화면

```
┌──────────────────────────────┐
│▓▓▓▓▓▓▓ 판매자 색 띠 ▓▓▓▓▓▓▓▓▓▓│
│  받는 분: 👩‍🦳 {S2_LABEL}         │  ← 32px, 가장 먼저 눈에 띄게
│  ({S2_BANK_DISPLAY} 통장)        │
│   45,000원                     │  ← 64px
│   꿀 2 · 치약 1                 │
│  ╔════════════════════════╗   │  ← 판매자 색 두꺼운 테두리(12px)
│  ║  ┌──────────────────┐  ║   │     (QR 여백 바깥쪽에만, QR 자체는 흑백)
│  ║  │     [  Q R  ]    │  ║   │  ← 화면 짧은 변의 80% 이상
│  ║  └──────────────────┘  ║   │
│  ╚════════════════════════╝   │
│  손님 휴대폰 카메라로 찍어주세요     │
│  입금 문자는 {S2_LABEL} 휴대폰으로 와요│
│                               │
│ [ ← 처음으로 ]  [ ✔ 받았어요 ]    │  ← 각 88px
└──────────────────────────────┘
```
- 진입 시 Wake Lock(화면 꺼짐 방지) 요청, 나갈 때 해제. 앱이 백그라운드에서 돌아오면 다시 요청.
- 순수 흑백, 사각 모듈, 오류정정 M. 가운데 로고는 기본 OFF. 판매자 색은 **QR 여백 바깥 테두리**에만 사용(인식률 유지).
- QR URL에는 반드시 현재 판매자 `s`가 들어감.
- [받았어요]: 버튼 위에 작은 글씨 "**{판매자} 휴대폰에 입금 문자가 왔는지 확인한 뒤 누르세요**" → 판매 기록(시각, 판매자, 금액, 상품)을 저장 → 홈으로, 장바구니 비움. 판매자는 그대로 유지.
- [처음으로]: 기록 없이 홈으로 (장바구니는 유지).

### 5.4 고객 송금 페이지 (`/p/`)

```
┌──────────────────────────────┐
│  김선비 벌꿀                    │
│  에 보낼 금액                   │
│  45,000원                      │  ← 가장 크게 (56px)
│  꿀 2 · 치약 1                  │
│ ┌───────────────────────────┐ │
│ │ 받는 분  김*○                │ │  ← s 번호의 판매자 예금주(마스킹)
│ │ 은행    ○○은행               │ │
│ │ 계좌    000-0000-0000-00 [복사]│ │
│ └───────────────────────────┘ │
│                               │
│ ┌───────────────────────────┐ │
│ │ 토스로 보내기                 │ │  ← 1순위, 파랑, 높이 72px
│ │ 금액까지 자동으로 입력돼요       │ │
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ 카카오페이로 보내기            │ │  ← 해당 판매자 설정 있을 때만
│ └───────────────────────────┘ │
│ ┌───────────────────────────┐ │
│ │ 다른 은행 앱으로 보내기         │ │  ← 탭하면 계좌 복사 + 아래 시트 열림
│ └───────────────────────────┘ │
│                               │
│  [📞 판매자에게 전화]  (선택)     │
└──────────────────────────────┘

[다른 은행 앱] 탭 후 바텀시트:
┌──────────────────────────────┐
│ ✔ 계좌번호가 복사됐어요           │
│ 은행 앱에서 붙여넣고               │
│ 금액 45,000원 을 입력하세요        │  ← 금액 다시 강조
│ ┌──────┐┌──────┐┌──────┐┌──────┐│
│ │카카오뱅크││KB스타 ││신한SOL ││ NH   ││ ← 2~4열 그리드, 각 64px
│ └──────┘└──────┘└──────┘└──────┘│
│ ...  [다른 은행 보기 ▾]          │
└──────────────────────────────┘
```

동작 규칙:
0. 페이지 로드 시 `getSeller(s)`로 판매자 결정. 없으면 오류 화면(§4.3). **고객 화면에는 "장인어른/장모님" 같은 내부 호칭을 쓰지 않고 마스킹된 예금주·은행명만** 표시.
1. **토스로 보내기**: 탭하는 즉시(같은 사용자 제스처 안에서, `await` 없이) 해당 판매자의 `tossBank`·`accountNo`로 딥링크 이동.
   - iOS: `supertoss://send?...`
   - Android: `intent://send?...#Intent;scheme=supertoss;package=viva.republica.toss;S.browser_fallback_url={현재URL#notoss};end`
   - 1.6초 뒤에도 페이지가 보이면(앱 미설치 추정) "토스 앱이 없으신가요? 아래 '다른 은행 앱으로 보내기'를 눌러주세요" 표시. `#notoss`로 돌아온 경우도 동일.
2. **다른 은행 앱으로 보내기**: 탭 = 클립보드에 `"{판매자 bankDisplay} {판매자 accountNo}"` 복사 + 바텀시트 오픈. (복사와 앱 열기를 **두 번의 탭으로 분리** → iOS에서 비동기 클립보드 후 앱 이동이 막히는 문제 회피)
   - 은행 버튼 탭: iOS는 `iosScheme://`, Android는 `intent://#Intent;scheme={iosScheme};package={androidPackage};S.browser_fallback_url={현재URL#noapp};end`(스킴을 아는 경우). 정보가 없는 앱은 이동하지 않고 "복사됐어요. 은행 앱을 직접 열어 붙여넣어 주세요" 토스트.
3. 복사 실패 시: 계좌번호를 크게 선택 가능한 텍스트로 보여주고 "길게 눌러 복사하세요".
4. `a`가 없으면 금액 자리에 큰 숫자 입력칸 → 입력값으로 토스 링크 생성.
5. 예금주 마스킹: 3글자 `김*집`, 2글자 `김*`, 4글자 이상 `첫 글자 + * + 마지막 글자`.
6. [판매자에게 전화]는 해당 판매자 `phone`이 있을 때만.
7. 분석 스크립트·광고·외부 폰트 금지. 시스템 폰트 사용.

### 5.5 인쇄용 QR 카드 (`/print/`, PIN 필요)

- **먼저 판매자 선택** (§5.0과 같은 큰 버튼) → 그 판매자의 카드 세트 생성. "두 분 모두" 버튼으로 두 세트를 연달아 인쇄 가능.
- A4 한 장에 4장(2×2). 카드 구성: 상호 / 상품 이모지·이름 / **가격(큰 글씨)** / QR(최소 6cm) / "카메라로 찍어 송금하세요" / "토스는 금액까지 자동 입력" / 하단 "받는 분 김*○ · ○○은행".
- **판매자 구분:** 카드 전체에 판매자 색 두꺼운 테두리 + 오른쪽 위 모서리에 작은 글씨로 내부 호칭(예: "{S1_LABEL}용") — 어르신이 세트를 구분하는 용도. 색깔 있는 종이에 인쇄하는 것도 권장.
- "금액 미지정 QR" 카드 1장 추가 (고객이 금액 직접 입력, 수량이 여러 개일 때 사용).
- 수량 묶음 카드 옵션: 예) 꿀 2병 40,000원.
- 버튼: [인쇄하기](`window.print()`, 인쇄용 CSS로 UI 숨김), [PNG 내려받기](카드별).
- 하단 경고 문구: "인쇄 후 반드시 휴대폰 기본 카메라로 찍어 테스트하세요." (AQR과 동일 취지)
- 사용 안내: **자리에 있는 분의 카드 세트만 진열.** 한 분이 자리를 비우면 그 분 카드는 치움.

### 5.6 판매자 설정 (PIN 4자리)

- **이 휴대폰 주인** 지정: [{S1_LABEL}] [{S2_LABEL}] [같이 씀] → 선택 화면 버튼 순서에 반영.
- 상품 이름·가격·이모지 수정, 상품 추가/삭제(최대 8개), 순서 변경(위/아래 버튼 — 드래그 금지).
- 오늘 판매 기록 보기(**판매자별 소계 + 전체 합계**) / 기록 지우기(되돌리기 5초).
- "테스트 QR 만들기(100원)" — **판매자별로** 하나씩. 설치 직후 사위가 직접 송금해 각자 휴대폰에 입금 문자가 오는지 확인하는 용도.
- 계좌 정보는 **여기서 수정 불가** (환경변수로만 변경). 화면에는 은행명과 계좌 끝 4자리만 보여 확인용으로 사용.

---

## 6. 어르신 UX 규칙 (모든 판매자 화면 필수 체크리스트)

- [ ] 본문 글자 22px 이상, 금액 48px 이상, 굵은 글씨. 시스템 글자 크기 확대에도 레이아웃 안 깨짐
- [ ] 버튼 최소 높이 64px(주요 버튼 88px, 판매자 선택 버튼 180px), 버튼 사이 간격 16px 이상
- [ ] 한 화면에 한 가지 일. 주요 버튼은 화면 하단 고정(엄지 위치)
- [ ] **지금 누구 통장으로 받는지 모든 판매 화면 상단에 항상 표시**(판매자 색 띠 + 호칭)
- [ ] 판매자 구분은 **색 + 그림 + 이름** 3가지 동시 사용 (색맹·저시력 대비)
- [ ] 아이콘만 있는 버튼 금지 — 반드시 한글 글자 함께
- [ ] 색만으로 구분 금지 — 글자·모양도 함께. 명도 대비 WCAG AA 이상(가능하면 AAA)
- [ ] 스와이프·길게 누르기·더블탭 같은 숨은 제스처 금지
- [ ] 확인 팝업(`confirm`) 대신 "되돌리기" 버튼
- [ ] 영어·전문용어 금지: "QR 보여주기", "받았어요", "처음으로", "판매자 바꾸기"처럼 말하듯 쓰기
- [ ] 금액은 숫자 + 한글 읽기 동시 표기 (`45,000원 (4만 5천원)`)
- [ ] 탭하면 즉시 눈에 보이는 반응(눌림 색 변화 + 진동)
- [ ] 세로·가로 모두 지원, 360px 폭 안드로이드 기준으로 설계
- [ ] 화면 자동 꺼짐 방지(QR 화면), 오프라인에서도 선택·홈·QR 동작

---

## 7. 핵심 로직 (참고 구현)

```ts
// src/lib/money.ts
export const fmtWon = (n: number) => new Intl.NumberFormat('ko-KR').format(n) + '원';

// 45000 -> "4만 5천원", 1230000 -> "123만원"
export function koreanWon(n: number): string {
  if (!Number.isInteger(n) || n <= 0) return '';
  const man = Math.floor(n / 10000), rest = n % 10000;
  const cheon = Math.floor(rest / 1000), baek = Math.floor((rest % 1000) / 100), tail = rest % 100;
  const parts: string[] = [];
  if (man) parts.push(`${man}만`);
  if (cheon) parts.push(`${cheon}천`);
  if (baek) parts.push(`${baek}백`);
  if (tail) parts.push(`${tail}`);
  return parts.join(' ') + '원';
}

export const isValidAmount = (n: number) => Number.isInteger(n) && n >= 100 && n <= 500_000;
```

```ts
// src/lib/payUrl.ts
import type { SellerId } from '../env';

export function encodeItems(cart: Record<string, number>): string {
  return Object.entries(cart).filter(([, q]) => q > 0).map(([c, q]) => `${c}${q}`).join('');
}
export function decodeItems(s: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!s || !/^([A-Z]\d{1,2})+$/.test(s)) return out;
  for (const [, c, q] of s.matchAll(/([A-Z])(\d{1,2})/g)) out[c] = Number(q);
  return out;
}
// 판매자 번호 s는 필수 — 빠뜨리면 컴파일 에러가 나도록 첫 인자로
export function buildPayUrl(base: string, sellerId: SellerId, amount?: number, cart?: Record<string, number>) {
  const u = new URL('/p/', base);
  u.searchParams.set('s', sellerId);
  if (amount) u.searchParams.set('a', String(amount));
  const i = cart ? encodeItems(cart) : '';
  if (i) u.searchParams.set('i', i);
  return u.toString();
}
```

```ts
// src/lib/sellerState.ts
import { SELLERS, getSeller, type Seller } from '../env';
const KEY = 'qrpay.currentSeller';
export function loadCurrentSeller(): Seller | null {
  try { return getSeller(localStorage.getItem(KEY)); } catch { return null; }
}
export function saveCurrentSeller(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* 메모리 상태로만 유지 */ }
}
// 앱 시작 시: SELLERS.length === 1 이면 자동 선택, 아니면 ASK_SELLER_ON_START에 따라 선택 화면
export const needsSellerPick = (askOnStart: boolean, current: Seller | null) =>
  SELLERS.length > 1 && (askOnStart || !current);
```

```ts
// src/lib/deeplink.ts
export const isAndroid = () => /android/i.test(navigator.userAgent);
export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function tossQuery(bank: string, accountNo: string, amount?: number) {
  const q = new URLSearchParams({ bank, accountNo: accountNo.replace(/\D/g, '') });
  if (amount && amount > 0) q.set('amount', String(Math.floor(amount))); // 정수만, 콤마/소수점 금지
  return q.toString();
}
// seller.tossBank, seller.accountNo 를 넘겨서 호출
export function tossLink(bank: string, accountNo: string, amount: number | undefined, fallbackUrl: string) {
  const q = tossQuery(bank, accountNo, amount);
  return isAndroid()
    ? `intent://send?${q}#Intent;scheme=supertoss;package=viva.republica.toss;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
    : `supertoss://send?${q}`;
}

export function bankAppLink(app: { iosScheme?: string; androidPackage?: string }, fallbackUrl: string): string | null {
  if (isAndroid() && app.iosScheme && app.androidPackage)
    return `intent://#Intent;scheme=${app.iosScheme};package=${app.androidPackage};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
  if (isIOS() && app.iosScheme) return `${app.iosScheme}://`;
  return null; // 모르면 이동하지 않고 안내만
}

// 반드시 클릭 핸들러 안에서 동기적으로 호출
export function tryOpen(url: string, onFail: () => void, ms = 1600) {
  const timer = setTimeout(() => { if (document.visibilityState === 'visible') onFail(); }, ms);
  const clear = () => clearTimeout(timer);
  document.addEventListener('visibilitychange', clear, { once: true });
  window.addEventListener('pagehide', clear, { once: true });
  window.location.href = url;
}

// 비공식: 기본 OFF. 실기기에서 금액이 맞게 뜨는지 확인 후에만 켤 것. code는 판매자별
export function kakaoPayLink(code: string, amount?: number, useAmountHack = false) {
  const suffix = useAmountHack && amount ? (amount * 524288).toString(16) : ''; // amount << 19 (큰 금액 오버플로 방지 위해 곱셈)
  return `https://qr.kakaopay.com/${code}${suffix}`;
}
```

```ts
// src/lib/clipboard.ts
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove(); return ok;
}
```

```ts
// src/lib/wakeLock.ts
let lock: any = null;
export async function keepScreenOn() {
  try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { lock = null; }
}
export function releaseScreen() { lock?.release?.(); lock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash === '#qr') keepScreenOn();
});
```

```ts
// QR 렌더링 (테두리는 캔버스 바깥 래퍼 div에 판매자 색 border로)
import QRCode from 'qrcode';
await QRCode.toCanvas(canvas, url, { errorCorrectionLevel: 'M', margin: 4, width: size, color: { dark: '#000000', light: '#FFFFFF' } });
```

---

## 8. 보안·개인정보·법적 메모

- 고객 정보 수집 없음, 쿠키·분석 스크립트 없음. 판매 기록은 판매자 폰 `localStorage`에만 (try/catch로 감싸고 실패해도 앱 동작).
- 두 판매자의 계좌번호·예금주는 **환경변수 → 빌드 시 주입**. 저장소 `.gitignore`에 `.env*` (단 `.env.example` 제외).
- 계좌를 URL에 넣지 않으므로, 누가 URL을 조작해도 **받는 계좌는 두 분 계좌 중 하나**로만 바뀜. `s`를 바꾸면 다른 분 통장으로 가는데, 이 경우 **선택한 판매자에게 입금 문자가 오지 않으므로** 판매자가 바로 알아챔 → 사용법에 "문자 확인 전엔 물건을 건네지 않기" 명시.
- 금액 조작(`a`)도 마찬가지로 **입금 문자에 찍힌 실제 금액**으로 확인.
- QR 바꿔치기(스티커 덧붙이기) 방지: 인쇄 카드는 판매자 시야 안에 두기. 고객 페이지에 예금주(마스킹)·은행명을 표시해 은행 앱의 수취인 확인 화면과 대조 가능하게.
- 고객 화면에는 내부 호칭(장인어른/장모님)을 노출하지 않음.
- Cloudflare Pages `_headers`: `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- 이 시스템은 계좌이체 **안내 페이지**일 뿐 돈을 중개·보관하지 않습니다. 사업자 매출 신고(두 분 계좌로 나뉘어 들어오는 매출 포함)·현금영수증 발급 의무 업종 여부는 세무 담당자에게 확인 권장 (법률·세무 자문 아님).

---

## 9. 폴더 구조

```
qr-pay/
├─ index.html              # 판매자 앱 (판매자 선택 → 홈 → QR)
├─ p/index.html            # 고객 송금 페이지
├─ print/index.html        # 인쇄용 QR 카드
├─ src/
│  ├─ config.ts            # 상품 목록, 빠른 금액
│  ├─ env.ts               # import.meta.env → SELLERS 변환·검증 (TODO 값이면 빌드 실패)
│  ├─ banks.ts             # 은행 앱 데이터
│  ├─ lib/                 # money, payUrl, sellerState, deeplink, clipboard, wakeLock, storage
│  ├─ seller/              # pickSeller.ts, home.ts, keypad.ts, qrScreen.ts, settings.ts
│  ├─ pay/                 # main.ts, bankSheet.ts
│  ├─ print/               # main.ts
│  └─ styles/              # base.css(토큰, --seller-color), seller.css, pay.css, print.css
├─ public/
│  ├─ icons/               # PWA 아이콘 192/512, 은행 로고는 쓰지 않음(상표) → 글자 버튼
│  ├─ img/                 # (선택) s1.jpg, s2.jpg 판매자 사진
│  ├─ _headers
│  └─ manifest.webmanifest
├─ tests/                  # vitest 단위, playwright e2e
├─ docs/어르신-사용법.md     # 큰 글씨 1페이지 사용 설명서(인쇄용)
├─ .env.example
└─ README.md               # 설치·배포·테스트 방법
```

> 은행 로고 이미지는 상표 문제로 넣지 않습니다. 은행별 대표색 배경 + 앱 이름 글자 버튼으로 대신합니다.
> 판매자 색은 CSS 변수 `--seller-color`로 한 곳에서 바꿔 끼웁니다.

---

## 10. 배포 (Cloudflare Pages)

1. GitHub에 **비공개 저장소** 생성 후 푸시.
2. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git → 저장소 선택.
3. Build command `npm run build`, Output `dist`, Node 20.
4. Settings → Environment variables에 §4.4의 `VITE_*` 값 입력 (Production) — **판매자1·판매자2 계좌 모두**.
5. 배포 후 `https://{프로젝트}.pages.dev` 확인 → `VITE_PUBLIC_BASE_URL`을 이 주소로 맞추고 재배포.
6. (선택) 짧은 커스텀 도메인 연결 → QR이 더 단순해짐.
7. 장인어른·장모님 **각자 휴대폰**에서 판매자 앱 열기 → 크롬 "홈 화면에 추가"(아이폰은 공유 → 홈 화면에 추가). 아이콘 이름 "벌꿀 결제". 설정에서 **이 휴대폰 주인** 지정.
8. **두 분 각자** 자기 은행의 **입출금 알림(문자 또는 앱 푸시)** 을 자기 휴대폰에 켜기 — 입금 확인용. (은행마다 신청 방법·요금이 다르니 각 은행 앱/창구에서 확인)
9. 판매자별 100원 테스트 송금 → 각자 휴대폰에 알림이 오는지 확인.

---

## 11. 테스트 계획 & 수용 기준

### 11.1 단위 테스트 (Vitest)
- `koreanWon`: 45000→"4만 5천원", 10000→"1만원", 1230000→"123만원", 100→"1백원"
- `isValidAmount`: 99✗, 100✓, 500,000✓, 500,001✗, 1.5✗, NaN✗
- `encodeItems/decodeItems` 왕복, 잘못된 `i`는 빈 객체
- `buildPayUrl`: 항상 `s` 포함, 길이 60자 이내 (기본 도메인 기준)
- `env.ts`: S2 비면 1명 모드, `TODO` 남으면 throw, 두 판매자 색 같으면 throw, 계좌에 숫자 외 문자 있으면 throw
- `getSeller`: `'1'`/`'2'` 정상, `'3'`/`null`/`''` → null
- `tossLink`: 판매자별 은행·계좌가 들어감, 콤마·하이픈 제거, 소수점 금액 → 정수, Android는 intent 형식

### 11.2 E2E (Playwright, 390×844 / 360×800)
- 앱 시작 → 판매자 선택 화면이 반드시 뜸 → **선택 전에는 홈·QR 화면 접근 불가**
- 판매자2 선택 → 상단 띠에 판매자2 호칭·색 → 꿀 2 + 치약 1 → QR 화면 → QR 디코드 결과 URL이 `/p/?s=2&a=45000&i=H2T1` (예시 가격 기준: 꿀 20,000×2 + 치약 5,000)
- [판매자 바꾸기] → 판매자1 선택 → 장바구니 유지 → QR URL이 `s=1`로 바뀜
- [받았어요] → 판매 기록에 판매자 id 저장 → 홈 하단 판매자별 합계 갱신
- 고객 페이지 `s=1`/`s=2`: 각 판매자의 마스킹 예금주·은행명 표시, [다른 은행 앱] 탭 시 **해당 판매자 계좌**가 클립보드에 들어감
- 고객 페이지 `s` 없음/`s=3` → 오류 화면, 송금 버튼 없음
- 판매자 1명 모드(S2 미설정 빌드) → 선택 화면 생략, URL `s=1`
- 인쇄 페이지: 판매자 선택 후 해당 판매자 색 테두리 카드, PIN 없이 접근 불가

### 11.3 실기기 체크리스트 (사람이 직접 — README에 표로 제공)
| 시나리오 | 안드로이드(삼성 기본 카메라→삼성인터넷/크롬) | 아이폰(기본 카메라→사파리) |
|---|---|---|
| QR 인식 (밝은 곳/실내/화면 밝기 50%) | | |
| 토스 설치됨 → **판매자1** 계좌·금액 자동 입력 | | |
| 토스 설치됨 → **판매자2** 계좌·금액 자동 입력 | | |
| 토스 미설치 → 안내 문구 표시 | | |
| 카카오뱅크·KB·농협·신한 앱 열림 | | |
| 은행 앱이 복사한 계좌를 인식 | | |
| 카카오톡 QR 스캐너로 찍었을 때(인앱 브라우저) | | |
| **판매자1로 100원 송금 → 판매자1 휴대폰에만 알림** | | |
| **판매자2로 100원 송금 → 판매자2 휴대폰에만 알림** | | |
| 비행기 모드에서 판매자 앱·선택·QR 표시 | | |

### 11.4 수용 기준
- 판매자가 **앱 아이콘 탭부터 QR 표시까지 4번 이하 탭** (판매자 선택 1 + 상품 1~2 + QR 보여주기 1).
- QR 화면에서 **받는 판매자가 누구인지 1초 안에 알아볼 수 있음** (색 띠 + 호칭 + 테두리) — 두 분께 직접 보여 확인.
- 고객이 **QR 촬영부터 토스 송금 확인 화면까지 2번 이하 탭** (카메라 링크 탭 + 토스 버튼).
- 고객 페이지 첫 로딩 gzip 50KB 이하, Lighthouse 모바일 접근성 95점 이상.
- 실기기 체크리스트 전 항목 결과 기록 (실패 항목은 은행 데이터 `verified:false` 유지).

---

## 12. 작업 순서 (Codex 마일스톤)

1. **M1 기반**: Vite MPA 구성(3개 엔트리), `env.ts`(판매자 2명 변환·검증), `lib/*` 구현 + 단위 테스트 통과.
2. **M2 고객 송금 페이지**: `/p/` 화면(`s`로 판매자 결정), 토스·카카오페이·은행 시트, 오류 처리, CSP 헤더.
3. **M3 판매자 앱**: **판매자 선택 화면** → 홈(판매자 띠, 상품 그리드·수량, 판매자 바꾸기) → 금액 키패드 → QR 화면(판매자 테두리, Wake Lock) → 받았어요/판매자별 오늘 합계.
4. **M4 인쇄 페이지**: 판매자 선택 → 판매자별 색 카드 세트, 상품별·금액 미지정 QR, 인쇄 CSS, PNG 저장.
5. **M5 설정 & PWA**: PIN 설정 화면(이 휴대폰 주인, 가격 덮어쓰기, 판매자별 테스트 QR), manifest·서비스워커·오프라인.
6. **M6 배포·문서**: README(설치·배포·실기기 체크리스트), `docs/어르신-사용법.md`(글자 28px 이상, 그림 순서 6단계: ① 앱 열기 ② **내 이름 누르기** ③ 상품 누르기 ④ QR 보여주기 ⑤ 내 휴대폰 입금 문자 확인 ⑥ 받았어요), Cloudflare Pages 배포.

각 마일스톤 끝에 `npm test`와 `npm run build` 통과를 확인하고 커밋.

---

## 13. 사용자(사위)가 정해 줄 것

- [ ] 실제 상품명·가격·묶음 판매 단위
- [ ] **두 분 각각의 은행·계좌·예금주** (Cloudflare 환경변수에만 입력)
- [ ] **선택 화면에 보일 호칭/이름** (예: 두 분 성함, "할아버지/할머니" 등 — 두 분이 바로 알아보시는 말)과 구분색(기본: 파랑/주황)
- [ ] 토스 딥링크 은행명 표기: 두 분 은행 각각 어떤 값이어야 계좌가 맞게 채워지는지 (100원 테스트로 확정)
- [ ] 두 분 각자 입출금 알림(문자/앱 푸시) 신청 여부
- [ ] 휴대폰을 각자 쓰실지, 한 대를 같이 쓰실지 → "이 휴대폰 주인" 설정과 앱 시작 시 선택 화면 여부(`ASK_SELLER_ON_START`) 결정
- [ ] 카카오페이 송금 QR 코드 사용 여부 (판매자별 카카오페이 계정 필요)
- [ ] 두 분 휴대폰 기종 (안드로이드/아이폰) → 그 기종 위주로 UI 확인
- [ ] 도메인 (`*.pages.dev` 그대로 쓸지, 짧은 도메인 살지)
- [ ] 판매자에게 전화 버튼 노출 여부

---

## 14. 참고 자료

- AQR 관리 화면·공개 송금 페이지 직접 분석 (2026-10-13)
- 토스 송금 딥링크 생성기 오픈소스: https://github.com/nemokoala/TossMe , 개발기: https://velog.io/@nemokoala/Toy-Project-%ED%86%A0%EC%8A%A4-%EC%86%A1%EA%B8%88-URL-%EC%83%9D%EC%84%B1%EA%B8%B0-%EA%B0%9C%EB%B0%9C%EA%B8%B0
- 토스 딥링크 금액 소수점 이슈 사례: https://github.com/alskal1/split-link/pull/24 , 은행명 정규화(“~은행” 제거): https://github.com/alskal1/split-link/pull/19
- 카카오페이 송금 QR 금액 인코딩(비공식): https://moeun2.github.io/blog/kakaopay-qrcode-maker
- 은행·간편결제 앱 스킴/패키지 표: NICEPAY 앱 웹뷰 연동 https://developers.nicepay.co.kr/docs/pg/add/app-webview/ , PortOne 우리WON 스킴 https://guide.portone.io/27f1b149-2c4e-45a7-9e90-350d55938e1c
- 웹에서 앱 딥링크 여는 방법(Android intent / iOS scheme): https://docs.tosspayments.com/blog/android-ios-webview-deeplink
