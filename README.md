# Backend Fact Checker

## Chạy PostgreSQL bằng Docker

```bash
docker compose up -d postgres
copy .env.example .env
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

Swagger: `http://localhost:3000/docs`.

PostgreSQL được publish ở cổng `55433` để không xung đột với database khác đang dùng cổng `5432`.

## Chạy toàn bộ backend bằng Docker

```bash
docker compose up --build
```

Lệnh Docker tự áp dụng migration và seed 20 nhiệm vụ mẫu trước khi API chạy.

API sử dụng `x-player-token` sau khi người chơi gọi `POST /api/v1/sessions/join`.
