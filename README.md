# CallUp (콜업) — AI 리크루터 전화 연습

취업준비생이 **면접 일정 콜백·리크루터 전화**를 AI와 음성으로 연습하고 피드백받는 모바일 웹앱.
"면접 답변 코칭"이 아니라 **"전화를 받는 연습"**에 집중 — 얼어붙음·회피를 안전하게 반복 연습으로 극복.

- 음성 출력: **ElevenLabs 실시간 TTS** (통화마다 난이도별 보이스 랜덤)
- 음성 입력: 브라우저 음성인식 (Chrome/Edge 권장, 미지원 시 텍스트 입력 폴백)
- 리포트: 과업 체크카드(첫마디·일시·방식·마무리) + 점수 + 부담감 변화

## 구조
```
index.html / app.js   프론트(앱 뷰, 정적)
api/tts.js            Vercel 서버리스 — ElevenLabs TTS 프록시 (키는 서버 env)
assets/               마스코트 이미지
```

## 배포 (GitHub → Vercel)
1. 이 폴더를 GitHub 저장소로 push.
2. [vercel.com](https://vercel.com) → **Add New → Project → GitHub 저장소 import**.
3. **Environment Variables**에 추가:
   - `ELEVENLABS_API_KEY` = (ElevenLabs API 키)
4. **Deploy** → 공개 URL 발급. 끝.

> ⚠️ API 키는 **Vercel 환경변수(서버)**에만. 코드/깃/프론트에 넣지 말 것.
> Voice ID 6개는 `app.js`의 `VOICES` 상수(비밀 아님).

## 로컬 개발
```
npm i -g vercel
vercel dev        # http://localhost:3000, /api/tts 포함
```
(환경변수 `ELEVENLABS_API_KEY`를 vercel env 또는 .env.local에 설정)

## 심사 포인트 (Hello World AI 해커톤)
- 열림: 공개 URL, 설치 없이 폰/노트북에서 즉시 실행
- 문제발견: 취준생이 리크루터 전화에서 얼어붙어 회피 (번지 검증)
- AI활용: ElevenLabs 음성이 통화의 핵심
- 차별성: 경쟁사는 답변 코칭, CallUp은 전화 연습
