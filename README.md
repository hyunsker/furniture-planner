# 방 가구 배치 플래너

방 실측 치수를 입력하고 가구를 드래그 앤 드롭으로 배치할 수 있는 실시간 협업 웹 앱입니다.

## 기능

- 방 여러 개 추가 (이름, 가로/세로 cm 입력)
- 가구 라이브러리에서 드래그하여 배치
- 가구 회전 (90도씩)
- 10cm 그리드 스냅
- 공유 링크로 아내와 실시간 동시 편집

## 배포 방법

### 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 무료 프로젝트 생성
2. SQL Editor에서 `supabase-schema.sql` 내용 전체 실행
3. Project Settings → API에서 아래 두 값 복사:
   - `Project URL`
   - `anon public` key

### 2. 로컬 실행

```bash
cp .env.example .env.local
# .env.local 파일에 Supabase URL과 Key 입력
npm install
npm run dev
```

### 3. GitHub + Vercel 배포

```bash
# GitHub 레포 생성 후
git init
git add .
git commit -m "init: furniture planner"
git remote add origin https://github.com/your-username/furniture-planner.git
git push -u origin main
```

[vercel.com](https://vercel.com)에서 GitHub 레포 연결 후 환경변수 설정:
- `VITE_SUPABASE_URL` = Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` = Supabase anon key

## 기술 스택

- React + TypeScript + Vite
- Tailwind CSS
- @dnd-kit/core (드래그 앤 드롭)
- Supabase (DB + Realtime)
- Vercel (배포)
