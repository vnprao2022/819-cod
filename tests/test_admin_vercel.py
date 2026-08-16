import unittest
from io import BytesIO
from unittest.mock import patch

from openpyxl import Workbook

from lib.auth import is_valid_token, login
from lib import data_store
from server import app


class AdminAuthTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_stateless_admin_token(self):
        token = login("admin", "admin123")
        self.assertIsNotNone(token)
        self.assertTrue(is_valid_token(token))
        self.assertFalse(is_valid_token(f"{token}x"))
        self.assertIsNone(login("admin", "wrong"))

    def test_login_and_protected_mutations(self):
        response = self.client.post(
            "/api/admin/login",
            json={"username": "admin", "password": "admin123"},
        )
        self.assertEqual(response.status_code, 200)
        token = response.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        check = self.client.get("/api/admin/check", headers=headers)
        self.assertEqual(check.status_code, 200)
        self.assertTrue(check.get_json()["admin"])

        unauthorized = self.client.post("/api/import/preview")
        self.assertEqual(unauthorized.status_code, 403)
        authorized = self.client.post("/api/import/preview", headers=headers)
        self.assertEqual(authorized.status_code, 400)
        self.assertEqual(authorized.get_json()["error"], "No file uploaded")

    def test_authenticated_excel_preview_and_confirm(self):
        token = login("admin", "admin123")
        headers = {"Authorization": f"Bearer {token}"}

        def excel_file():
            workbook = Workbook()
            sheet = workbook.active
            sheet.append(["ID Nhân Vật", "Tên Nhân Vật", "Lực Chiến Hiện Tại"])
            sheet.append(["12345678", "Test Player", 25_000_000])
            output = BytesIO()
            workbook.save(output)
            output.seek(0)
            return output

        filename = "819_2099-01-01_2099-01-01.xlsx"
        preview = self.client.post(
            "/api/import/preview",
            data={"file": (excel_file(), filename)},
            headers=headers,
            content_type="multipart/form-data",
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.get_json()["player_count"], 1)

        with patch("server.save_dataset", return_value="cod-stat/datasets/819/test.json"):
            confirm = self.client.post(
                "/api/import/confirm",
                data={"file": (excel_file(), filename)},
                headers=headers,
                content_type="multipart/form-data",
            )
        self.assertEqual(confirm.status_code, 200)
        self.assertEqual(confirm.get_json()["dataset_key"], "2099-01-01_2099-01-01")


class VercelDatasetStoreTests(unittest.TestCase):
    def test_save_dataset_writes_json_and_index_to_blob(self):
        dataset = {
            "server_id": "819",
            "dataset_key": "2026-08-17_2026-08-17",
            "date_from": "2026-08-17",
            "date_to": "2026-08-17",
            "source_file": "819_2026-08-17_2026-08-17.xlsx",
            "players": [{"role_id": "1", "power": 25_000_000}],
        }
        existing = [{
            "key": "2026-08-15_2026-08-15",
            "date_from": "2026-08-15",
            "date_to": "2026-08-15",
            "source_file": "old.xlsx",
            "player_count": 1,
        }]

        with (
            patch.object(data_store, "is_vercel", return_value=True),
            patch.object(data_store, "list_datasets", return_value=existing),
            patch.object(data_store, "read_blob_dataset_index", return_value={"deleted": []}),
            patch.object(data_store, "write_blob_dataset", return_value="cod-stat/test.json") as write_data,
            patch.object(data_store, "write_blob_dataset_index") as write_index,
        ):
            path = data_store.save_dataset(dataset)

        self.assertEqual(path, "cod-stat/test.json")
        write_data.assert_called_once()
        index = write_index.call_args.args[1]
        self.assertEqual([item["key"] for item in index["datasets"]], [
            "2026-08-15_2026-08-15",
            "2026-08-17_2026-08-17",
        ])

    def test_delete_bundled_dataset_creates_tombstone(self):
        datasets = [{"key": "2026-08-15_2026-08-15"}]
        with (
            patch.object(data_store, "is_vercel", return_value=True),
            patch.object(data_store, "list_datasets", return_value=datasets),
            patch.object(data_store, "read_blob_dataset_index", return_value=None),
            patch.object(data_store, "delete_blob_dataset"),
            patch.object(data_store, "write_blob_dataset_index") as write_index,
        ):
            deleted = data_store.delete_dataset("819", "2026-08-15_2026-08-15")

        self.assertTrue(deleted)
        self.assertEqual(write_index.call_args.args[1], {
            "datasets": [],
            "deleted": ["2026-08-15_2026-08-15"],
        })


if __name__ == "__main__":
    unittest.main()
