# 로컬 Docker로 LilPM 띄우기

Docker Compose로 **PostgreSQL, Redis, API 서버, Collab 서버, Frontend**를 한 번에 띄우는 방법입니다.

## 요구 사항

- Docker & Docker Compose
- (선택) 로컬에 Node 없어도 됨 — 모든 서비스가 컨테이너에서 실행됨

## 1. 환경 변수 설정

`docker-compose.yml`에서 API/인증에 필요한 값은 **프로젝트 루트의 `.env`**에서 읽습니다.

```bash
# 프로젝트 루트에서
cp .env.example .env
```

`.env`에 **JWT 시크릿**(32자 이상)을 반드시 넣어주세요. 없으면 API 서버가 기동 시 실패할 수 있습니다.

```env
JWT_SECRET=supersecretjwtkeyatleast32characterslong
JWT_REFRESH_SECRET=supersecretrefreshkeyatleast32characterslong
```

이미 루트 `.env`에 위 두 값이 있으면 그대로 사용하면 됩니다.

## 2. 인프라만 먼저 띄우기 (DB·Redis)

```bash
docker compose up -d postgres redis
```

헬스체크 통과할 때까지 잠시 기다립니다 (보통 10초 이내).

## 3. DB 마이그레이션 (최초 1회)

테이블을 만들기 위해 한 번만 실행합니다.

```bash
docker compose run --rm api-server npm run db:migrate
```

성공하면 `Ran X migrations` 같은 메시지가 나옵니다.

## 4. 전체 스택 띄우기

```bash
docker compose up -d
```

또는 **인프라만 띄운 상태**에서 나머지 서비스까지 띄우려면:

```bash
docker compose up -d api-server collab-server frontend adminer
```

## 5. 접속 주소

| 서비스      | URL                      |
|------------|---------------------------|
| **앱 (프론트)** | http://localhost:8080      |
| **Adminer (DB UI)** | http://localhost:8081 (서버: `postgres`, 사용자: `postgres`, 비밀번호: `postgres`) |

API는 프론트와 같은 호스트에서 `/api`로 프록시되므로 별도 포트는 없습니다.

## 6. 로그·중지·재시작

```bash
# 로그 보기 (전체)
docker compose logs -f

# 특정 서비스만
docker compose logs -f api-server
docker compose logs -f frontend

# 중지
docker compose down

# 볼륨까지 삭제 (DB 데이터 초기화)
docker compose down -v
```

## 7. 이미지 다시 빌드

코드나 Dockerfile을 수정한 뒤 다시 빌드할 때:

```bash
docker compose build
# 또는 특정 서비스만
docker compose build api-server frontend
docker compose up -d
```

## 8. 서비스 구성 요약

| 서비스        | 포트  | 비고 |
|---------------|-------|------|
| postgres      | 5432  | DB |
| redis         | 6379  | 세션/캐시 |
| api-server    | (내부 3000) | Nginx가 `/api`로 프록시 |
| collab-server | (내부 3001) | Nginx가 `/collab`으로 WebSocket 프록시 |
| frontend      | **8080** | Nginx로 SPA + API/Collab 프록시 |
| adminer       | 8081  | DB 웹 UI |

## 문제 해결

- **API 401 / 인증 오류**: `.env`의 `JWT_SECRET`, `JWT_REFRESH_SECRET`이 32자 이상인지 확인하세요.
- **DB 연결 실패**: `docker compose up -d postgres redis` 후 10초 정도 기다린 뒤 `db:migrate`와 `api-server`를 띄우세요.
- **마이그레이션 실패**: `docker compose run --rm api-server npm run db:migrate`가 `postgres`·`redis`가 올라온 상태에서 실행되는지 확인하세요. (같은 compose 네트워크에서 `DB_HOST=postgres`로 접속합니다.)
