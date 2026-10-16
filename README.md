# dchoi09 전집 상담 챗봇

dchoi09.com의 **전집 153종**을 엑셀로 정리하고, 그 엑셀을 바탕으로 고객 질문에 답하는 챗봇이에요.
두뇌는 Anthropic의 **Claude Sonnet 5.5**(`claude-sonnet-5-5`)예요.

| 주소 | 누가 쓰나요 | 하는 일 |
|---|---|---|
| `/` | 고객 | 이름과 이메일을 남기고 챗봇과 대화해요 |
| `/admin` | 운영자 | 대화 기록 보기, 질의응답 고치기, 챗봇 규칙 고치기 |

---

## 🧸 처음부터 끝까지 순서대로 따라 하기

> 각 단계를 끝내면 ✅ 표시를 하면서 따라오세요. 모르는 게 나오면 Claude에게 "N단계에서 막혔어"라고 말하면 돼요.

### 1단계. GitHub 저장소 만들기 ✅ (이미 했어요)

GitHub에 "코드를 보관하는 상자(저장소)"를 만들어요. 이미 만드셨어요.

### 2단계. 디플로이 키 등록하기

이 맥이 그 상자에 코드를 넣을 수 있게 "열쇠"를 등록해요.

1. GitHub 저장소 → **Settings** → 왼쪽 **Deploy keys** → **Add deploy key**
2. [DEPLOY_KEY.txt](DEPLOY_KEY.txt) 파일에 적힌 대로 **Title**과 **Key**를 붙여넣어요.
3. **Allow write access**를 꼭 체크해요.
4. **Add key**를 눌러요.

### 3단계. Claude에게 저장소 주소 알려주기

`https://github.com/아이디/저장소이름` 같은 주소를 Claude에게 알려주면, Claude가 코드를 GitHub에 올려줘요.

### 4단계. Anthropic API 키 받기

API 키는 "챗봇이 Claude를 쓸 수 있게 해주는 비밀 카드"예요. **절대 다른 사람에게 보여주면 안 돼요.**

1. https://platform.claude.com 에 로그인
2. 왼쪽 메뉴 **API Keys** → **Create Key** → 이름은 `dchoi-chatbot`
3. `sk-ant-`로 시작하는 키가 나와요. **이때 한 번만 보이니까** 바로 복사해 두세요.
4. 결제 수단(**Billing**)이 등록되어 있어야 작동해요.

### 5단계. (선택) 내 컴퓨터에서 먼저 켜 보기

1. 프로젝트 폴더의 `.env` 파일을 열고 `ANTHROPIC_API_KEY=` 뒤에 키를 붙여넣고 저장해요.
   `ADMIN_PASSWORD=change-me`도 원하는 비밀번호로 바꾸세요.
2. 터미널에 아래 두 줄을 차례로 입력해요.

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

```bash
npm run dev
```

3. 브라우저에서 http://localhost:3000 (고객 화면), http://localhost:3000/admin (운영자 화면)을 열어요.
4. 끝낼 때는 터미널에서 `Ctrl + C`를 눌러요.

### 6단계. Vercel에 올리기 (인터넷 주소 만들기)

Vercel은 GitHub에 있는 코드를 가져가서 **누구나 들어올 수 있는 웹사이트**로 만들어줘요.
GitHub에 코드를 올릴 때마다 Vercel이 **자동으로** 새 버전을 만들어요.

1. https://vercel.com 접속 → **Sign Up** → **Continue with GitHub**로 가입해요.
2. **Add New… → Project**를 눌러요.
3. 저장소 목록에 내 저장소가 안 보이면 **Configure GitHub App**(또는 Adjust GitHub App Permissions)을 눌러서
   그 저장소에 접근을 허락해요.
4. 내 저장소 옆의 **Import**를 눌러요.
5. **Environment Variables**(환경 변수)를 펼쳐서 아래 3개를 하나씩 넣어요.

   | Key (이름) | Value (값) |
   |---|---|
   | `ANTHROPIC_API_KEY` | 4단계에서 받은 `sk-ant-…` 키 |
   | `ADMIN_PASSWORD` | 운영자 페이지 비밀번호 (길고 어렵게!) |
   | `SESSION_SECRET` | `.env` 파일의 `SESSION_SECRET=` 뒤에 있는 긴 글자를 그대로 복사 |

6. **Deploy**를 눌러요. 1~2분 기다리면 `https://프로젝트이름.vercel.app` 주소가 생겨요. 🎉

### 7단계. 저장소(데이터베이스) 연결하기 — 꼭 해야 해요!

Vercel 서버는 잠깐씩 꺼졌다 켜져서, 그대로 두면 **대화 기록과 수정한 규칙이 사라져요.**
그래서 기록을 영구 보관할 Redis(레디스)라는 저장 공간을 연결해요. 무료 플랜으로 충분해요.

1. Vercel에서 내 프로젝트 → 위쪽 **Storage** 탭
2. **Create Database** → **Upstash** 항목의 **Redis** 고르기 → **Continue**
3. 이름은 `dchoi-chatbot-db`, 지역은 미국 서부(예: `us-west-1`) → **Create**
4. **Connect Project**에서 내 프로젝트를 고르고 **Connect**
   (그러면 `KV_REST_API_URL`, `KV_REST_API_TOKEN` 환경 변수가 자동으로 들어가요.)
5. 프로젝트 → **Deployments** 탭 → 맨 위 배포의 `⋯` → **Redeploy** 를 눌러요.
6. `/admin`의 대화 기록 화면에 노란 경고 띠가 **안 보이면** 연결 성공이에요.

### 8단계. 확인하기

- `https://프로젝트이름.vercel.app` → 이름/이메일 넣고 "3살 아이 전집 추천해줘"라고 물어보기
- `https://프로젝트이름.vercel.app/admin` → 비밀번호 넣고, 방금 대화가 보이는지 확인

---

## 운영자 페이지에서 할 수 있는 일

- **대화 기록**: 사용자별 대화, 메시지마다 챗봇이 판단한 **기분**과 **이상 행동**이 보여요. 차단하기 / 차단 해제 / 경고 초기화 / 삭제.
- **질의응답**: 엑셀에서 만든 423개의 기본 답변을 검색, 추가, 수정, 삭제하고 엑셀로 내려받을 수 있어요. 고친 답변은 **다음 질문부터 바로** 적용돼요.
- **챗봇 규칙**: 응대 규칙, 기분 파악 규칙, 이상 사용자 판별·경고 규칙, 차단 규칙을 쉬운 한국어로 고쳐요. 경고 몇 번이면 차단할지, 1분에 몇 개까지 보낼 수 있는지 같은 숫자도 바꿀 수 있어요.
- **전집 상품**: 챗봇이 알고 있는 상품 목록이에요.

## 상품 다시 수집하기 (가격이나 상품이 바뀌었을 때)

```bash
npm run build-excel
```

`data/dchoi09_전집.xlsx`가 새로 만들어져요. 이걸 GitHub에 올리면 Vercel이 자동으로 반영해요.
운영자 페이지 질의응답에 새 엑셀 내용을 넣으려면 **엑셀 원본으로 초기화**를 누르세요. 운영자가 직접 고친 답변은 이때 사라져요.

## 알아두면 좋은 점

- 많은 상세페이지가 **글자 대신 이미지**로 되어 있어요. 그래서 챗봇은 이미지 속 글자는 아직 몰라요. 엑셀에는 상품명, 구성, 연령, 가격, 할인, 태그, 글로 된 설명이 들어 있어요.
- 비용: 질문 1개에 대략 1~3센트예요. 상품 목록을 캐시(재사용)해서 비용을 줄였어요. 사용량은 platform.claude.com의 **Usage**에서 볼 수 있어요.
- 모델이 답을 거절하면 Anthropic 서버가 자동으로 다른 모델로 다시 시도해요(server-side fallback).
- `.env` 파일은 비밀이라 GitHub에 올라가지 않아요(`.gitignore`에 들어 있어요).

## 폴더 구조 (참고용)

```
data/dchoi09_전집.xlsx   ← 상품 + 질의응답 엑셀 (챗봇의 지식)
scripts/build-excel.ts    ← dchoi09.com에서 상품을 모아 엑셀을 만드는 프로그램
src/app/page.tsx          ← 고객 채팅 화면
src/app/admin/            ← 운영자 화면
src/app/api/              ← 서버 기능 (채팅, 로그인, 관리)
src/lib/claude.ts         ← Claude에게 질문을 보내는 부분
src/lib/rules.ts          ← 처음 기본 규칙
src/lib/store.ts          ← 저장소 (Redis 또는 내 컴퓨터 파일)
```
