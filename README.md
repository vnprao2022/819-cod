# Call of Dragons Stats

Website thống kê người chơi Call of Dragons cho nhóm nhỏ. Dữ liệu lưu bằng JSON, không cần database.

## Kiến trúc

```
Excel (.xlsx) → Import → JSON → Website
```

```
data/
  datasets/
    819/
      2026-08-01_2026-08-10.json
  custom/
    819.json

public/
  css/
  js/
  index.html
  players.html
  player.html
  rewards.html
  settings.html
  import.html
  tuan.html
```

## Yêu cầu

- Python 3.10+

## Cài đặt

```bash
pip install -r requirements.txt
```

## Chạy server

```bash
python server.py
```

Mở trình duyệt: http://localhost:5000

## Import Excel

### Qua website

1. Vào `/import.html`
2. Upload file `.xlsx` (format: `SERVER_STARTDATE_ENDDATE.xlsx`)
3. Xem preview → Import

### Qua command line

```bash
python scripts/import_excel.py "819_2026-08-01_2026-08-10.xlsx"
```

## Vercel

- Sign in to `tuan.html` with the configured admin account to import, replace,
  or delete Excel datasets on Vercel. Excel uploads are limited to 4 MB.
- Imported dataset JSON and custom player fields are saved in the connected
  private Vercel Blob store. Local development continues to use `data/` files.
- Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in Vercel
  Environment Variables to override the local defaults.

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/servers` | Danh sách server |
| GET | `/api/servers/{id}/datasets` | Danh sách dataset |
| GET | `/api/servers/{id}/dataset/{key}` | Dataset + custom merged |
| GET | `/api/servers/{id}/dashboard/{key}` | Thống kê dashboard |
| GET | `/api/servers/{id}/player/{role_id}` | Chi tiết player |
| GET | `/api/servers/{id}/player/{role_id}/history` | Lịch sử player |
| GET | `/api/servers/{id}/custom` | Custom data |
| PUT | `/api/servers/{id}/custom/{role_id}` | Cập nhật custom data |
| POST | `/api/import/preview` | Preview import |
| POST | `/api/import/confirm` | Xác nhận import |

## Tính năng

- Dashboard với thống kê tổng hợp
- Bảng ranking: search, sort, filter, pagination, chọn cột
- Chi tiết player + biểu đồ lịch sử (Power, Rank, Deaths, Merit, Healing, Gathering)
- Custom data editor (Deco, Red Artifact, Main, Note) — không bị ghi đè khi import Excel mới
- Multi-server support
- Dark theme, responsive

## Player ID (role_id)

`role_id` là khóa chính duy nhất. Tên player có thể thay đổi mà vẫn được nhận diện đúng.

## Filename format

```
{SERVER_ID}_{START_DATE}_{END_DATE}.xlsx
```

Ví dụ: `819_2026-08-01_2026-08-10.xlsx`
