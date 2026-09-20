# Triển khai production

Backend chạy bằng Docker Compose trên VPS; PostgreSQL chỉ nằm trong mạng Docker, không mở cổng ra Internet. Nginx trên VPS nhận HTTPS và chuyển tiếp vào API NestJS ở cổng nội bộ 3100.

## GitHub Actions

Tại repository GitHub, thêm các secrets sau trong **Settings → Secrets and variables → Actions**:

- `VPS_HOST`: `180.93.37.237`
- `VPS_USERNAME`: `root`
- `VPS_PASSWORD`: mật khẩu VPS

Mỗi lần đẩy nhánh `main`, workflow sẽ cập nhật mã nguồn trong `/opt/fact-checker-backend` và chạy lại Docker Compose.

## Biến môi trường trên VPS

Sao chép `.env.production.example` thành `/opt/fact-checker-backend/.env`. `POSTGRES_PASSWORD` và mật khẩu trong `DATABASE_URL` phải giống nhau. Thay `FRONTEND_URL` bằng URL production của Vercel sau khi frontend đã được deploy.

Lần triển khai đầu tiên cần cấp chứng chỉ cho `180.93.37.237.nip.io` bằng Certbot. Các lần deploy sau workflow chỉ cập nhật Docker và cấu hình Nginx.

## Vercel

Import repository `duyanh-se/fast-checker-frontend` và đặt các biến môi trường Production:

```
NEXT_PUBLIC_API_URL=https://180.93.37.237.nip.io/api/v1
NEXT_PUBLIC_SOCKET_URL=https://180.93.37.237.nip.io
```

Sau khi Vercel cấp URL, cập nhật `FRONTEND_URL` trong VPS rồi chạy `docker compose up -d` để API chấp nhận CORS từ frontend đó.
