# Dog Rehabilitation Dashboard

강아지 수중 러닝머신 재활치료 실시간 분석 대시보드

## 주요 기능

- **실시간 라이브 카메라 분석**: WebRTC를 통한 카메라 스트리밍
- **AI 포즈 추적**: YOLOv8 Dog-Pose 모델로 24개 관절 자동 추적
- **관절 각도 분석**: 어깨, 팔꿈치, 고관절, 무릎 각도 실시간 측정
- **보행 분석**: 속도, 보폭, 케이던스, 대칭성, 부드러움 지표
- **움직임 궤적**: 발 위치 경로 시각화
- **세션 비교**: 과거 세션과 진행 상황 비교

## 기술 스택

| 구성요소 | 기술 |
|---------|------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Charts | Recharts |
| Backend | FastAPI (Python) |
| AI Model | YOLOv8 Pose |
| Database | Supabase (PostgreSQL) |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

## 프로젝트 구조

```
wonju/
├── frontend/           # Next.js 앱
│   ├── src/
│   │   ├── app/        # 페이지
│   │   ├── components/ # UI 컴포넌트
│   │   ├── hooks/      # React hooks
│   │   ├── lib/        # 유틸리티
│   │   └── utils/      # 계산 함수
│   └── package.json
│
├── backend/            # FastAPI 앱
│   ├── app/
│   │   ├── main.py         # 엔트리포인트
│   │   ├── websocket.py    # WebSocket 핸들러
│   │   ├── pose_detector.py # YOLO 포즈 추론
│   │   └── metrics.py      # 지표 계산
│   ├── requirements.txt
│   └── Dockerfile
│
└── supabase/
    └── schema.sql      # 데이터베이스 스키마
```

## 로컬 개발 환경 설정

### 1. Backend 설정

```bash
cd backend

# 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 패키지 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env

# 서버 실행
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend 설정

```bash
cd frontend

# 패키지 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 Supabase 설정 추가

# 개발 서버 실행
npm run dev
```

### 3. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Project Settings > API에서 URL과 anon key 복사
4. Frontend `.env.local`에 추가:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
   ```

## 배포

### Backend (Railway)

1. [Railway](https://railway.app) 계정 생성
2. New Project > Deploy from GitHub repo
3. `backend/` 폴더 선택
4. 환경변수 설정:
   - `PORT`: 8000
5. 배포 완료 후 URL 복사

### Frontend (Vercel)

1. [Vercel](https://vercel.com)에서 Import Git Repository
2. Root Directory: `frontend`
3. 환경변수 설정:
   - `NEXT_PUBLIC_WS_URL`: Railway WebSocket URL (wss://your-backend.railway.app/ws)
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
4. Deploy

## 사용 방법

1. 웹 브라우저에서 대시보드 열기
2. **Connect** 버튼으로 백엔드 연결
3. Dog ID 입력 (예: "buddy-001")
4. 카메라 선택 후 **Start** 클릭
5. **Start Analysis Session** 클릭
6. 실시간으로 분석 결과 확인
7. 세션 종료 시 **End Session** 클릭

## 대시보드 구성

| 패널 | 설명 |
|------|------|
| Live Camera | 카메라 영상 + 관절 오버레이 |
| Joint Angles | 8개 관절 각도 실시간 차트 |
| Movement Trajectory | 4개 발 움직임 궤적 |
| Session Control | 연결 및 세션 관리 |
| Gait Analysis | 보행 지표 게이지 |
| Session Progress | 세션별 진행 비교 |

## API 엔드포인트

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /` | 헬스 체크 |
| `GET /health` | 상세 상태 확인 |
| `WS /ws` | 프레임 분석 WebSocket |

## 성능 지표

| 항목 | 목표값 |
|------|--------|
| 프레임 처리 | 8-10 FPS |
| 엔드투엔드 지연 | < 500ms |
| 모델 추론 | < 100ms/프레임 |

## 주의사항

- 동영상은 저장되지 않음 (프레임 처리 후 즉시 폐기)
- 수중 환경의 반사/왜곡으로 정확도가 낮아질 수 있음
- Railway 무료 티어는 월 $5 크레딧 제한

## 라이선스

MIT License
