# Shell Tank Prototype

이 프로젝트는 PRD를 기준으로 한 모바일 탱크 게임 데모를 HTML/CSS/JavaScript로 구현한 예시입니다.

## 포함 기능

- 모바일 UI 레이아웃
- 터치 기반 이동 버튼
- 무기 선택 카드
- 파이어 애니메이션
- Supabase 연결 준비
- 로컬 저장 + Supabase fallback

## 실행 방법

1. 로컬 서버 실행
   ```bash
   python -m http.server 8000
   ```
2. 브라우저에서 `http://localhost:8000` 접속

## Supabase 연결

1. `supabase-config.js`에서 프로젝트 URL과 anon key를 수정합니다.
2. Supabase에서 `game_sessions` 테이블을 생성합니다.

예시 SQL:

```sql
create table if not exists game_sessions (
  id text primary key,
  selected_weapon text,
  tank_x numeric,
  fuel numeric,
  shots_left numeric,
  turn numeric,
  updated_at timestamptz default now()
);
```

## 파일 구조

- `index.html` — 전체 화면 레이아웃
- `styles.css` — 게임 UI 스타일
- `app.js` — 상태 관리, 이동, 발사, Supabase sync
- `supabase-config.js` — Supabase 환경 설정 placeholder

## 참고

이 프로젝트는 완성형 게임이 아니라 PRD 기반의 프로토타입 UI와 구조를 보여주는 스켈레톤입니다. 실제 게임 로직은 이후 단계에서 탄도, 지형, 멀티플레이, 매칭 로직을 확장해 구현할 수 있습니다.
