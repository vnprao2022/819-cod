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

    def test_latest_ranking_includes_players_from_migrated_store(self):
        dataset = {
            "server_id": "819",
            "date_from": "2026-08-17",
            "date_to": "2026-08-17",
            "players": [{"role_id": "1", "name": "Current"}],
        }
        migrated = [{"role_id": "2", "name": "Migrated", "migrated": True}]
        with (
            patch("server.get_dataset", return_value=dataset),
            patch("server.list_datasets", return_value=[{"key": "2026-08-17_2026-08-17"}]),
            patch("server.get_custom", return_value={}),
            patch("server.get_migrated_players", return_value=migrated),
        ):
            response = self.client.get(
                "/api/servers/819/dataset/2026-08-17_2026-08-17"
            )

        self.assertEqual(response.status_code, 200)
        players = response.get_json()["players"]
        self.assertEqual([player["role_id"] for player in players], ["1", "2"])
        self.assertFalse(players[0]["migrated"])
        self.assertTrue(players[1]["migrated"])


class VercelDatasetStoreTests(unittest.TestCase):
    def test_dashboard_counts_red_artifact_owners_in_selected_dataset(self):
        dataset = {
            "players": [
                {"role_id": "1", "power": 25_000_000},
                {"role_id": "2", "power": 30_000_000},
                {"role_id": "3", "power": 10_000_000},
            ]
        }
        custom = {
            "1": {"red_artifact": True},
            "2": {"red_artifact": "yes"},
            "3": {"red_artifact": False},
            "999": {"red_artifact": True},
        }
        with (
            patch.object(data_store, "get_dataset", return_value=dataset),
            patch.object(data_store, "get_custom", return_value=custom),
        ):
            stats = data_store.get_dashboard_stats("819", "test")

        self.assertEqual(stats["red_artifact_count"], 2)

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
            patch.object(data_store, "get_migrated", return_value={"server_id": "819", "players": {}}),
            patch.object(data_store, "save_migrated") as save_migrated,
        ):
            path = data_store.save_dataset(dataset)

        self.assertEqual(path, "cod-stat/test.json")
        write_data.assert_called_once()
        index = write_index.call_args.args[1]
        self.assertEqual([item["key"] for item in index["datasets"]], [
            "2026-08-15_2026-08-15",
            "2026-08-17_2026-08-17",
        ])
        save_migrated.assert_called_once()

    def test_migrated_store_keeps_last_snapshot_and_removes_returned_players(self):
        existing = [
            {"key": "2026-08-12_2026-08-12"},
            {"key": "2026-08-15_2026-08-15"},
        ]
        historical = {
            "2026-08-12_2026-08-12": {
                "players": [
                    {"role_id": "1", "name": "Old One"},
                    {"role_id": "2", "name": "Migrated Two"},
                ]
            },
            "2026-08-15_2026-08-15": {
                "players": [
                    {"role_id": "1", "name": "Latest One"},
                    {"role_id": "3", "name": "Migrated Three"},
                ]
            },
        }
        previous_store = {
            "server_id": "819",
            "players": {
                "4": {
                    "last_seen_dataset": "2026-08-01_2026-08-01",
                    "migrated_at": "2026-08-02T00:00:00+00:00",
                    "data": {"role_id": "4", "name": "Returned Four"},
                }
            },
        }

        with (
            patch.object(data_store, "get_migrated", return_value=previous_store),
            patch.object(
                data_store,
                "get_dataset",
                side_effect=lambda _server, key: historical[key],
            ),
        ):
            result = data_store._prepare_migrated_update(
                "819",
                "2026-08-17_2026-08-17",
                [
                    {"role_id": "1", "name": "Current One"},
                    {"role_id": "4", "name": "Returned Four"},
                ],
                existing,
            )

        self.assertEqual(set(result["players"]), {"2", "3"})
        self.assertEqual(
            result["players"]["3"]["last_seen_dataset"],
            "2026-08-15_2026-08-15",
        )
        self.assertEqual(result["players"]["2"]["data"]["name"], "Migrated Two")

    def test_delete_bundled_dataset_creates_tombstone(self):
        datasets = [{"key": "2026-08-15_2026-08-15"}]
        with (
            patch.object(data_store, "is_vercel", return_value=True),
            patch.object(data_store, "list_datasets", return_value=datasets),
            patch.object(data_store, "read_blob_dataset_index", return_value=None),
            patch.object(data_store, "delete_blob_dataset"),
            patch.object(data_store, "write_blob_dataset_index") as write_index,
            patch.object(data_store, "save_migrated") as save_migrated,
        ):
            deleted = data_store.delete_dataset("819", "2026-08-15_2026-08-15")

        self.assertTrue(deleted)
        self.assertEqual(write_index.call_args.args[1], {
            "datasets": [],
            "deleted": ["2026-08-15_2026-08-15"],
        })
        save_migrated.assert_not_called()

    def test_player_detail_uses_migrated_snapshot_after_datasets_are_deleted(self):
        migrated = {
            "server_id": "819",
            "players": {
                "9": {
                    "last_seen_dataset": "2026-08-12_2026-08-12",
                    "migrated_at": "2026-08-13T00:00:00+00:00",
                    "data": {"role_id": "9", "name": "Stored Player"},
                }
            },
        }
        with (
            patch.object(data_store, "get_dataset", return_value={"players": []}),
            patch.object(data_store, "get_custom", return_value={}),
            patch.object(data_store, "get_migrated", return_value=migrated),
        ):
            player = data_store.get_player("819", "9", "deleted-dataset")

        self.assertEqual(player["name"], "Stored Player")
        self.assertTrue(player["migrated"])


if __name__ == "__main__":
    unittest.main()
