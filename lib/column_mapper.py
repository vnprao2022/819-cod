"""Map Excel column headers to JSON field names."""

import re
import unicodedata

# Known column mappings (Vietnamese header -> JSON field)
KNOWN_COLUMNS = {
    "Hạng": "rank",
    "ID Nhân Vật": "role_id",
    "Tên Nhân Vật": "name",
    "Lực Chiến Hiện Tại": "power",
    "Lực Chiến Cao Nhất Theo Lịch Sử": "highest_power",
    "Tử Vong (T4/T5)": "deaths",
    "Tổng Công Trạng": "merit",
    "Thu Thập": "gathering",
    "Chỉ Bộ Binh": "merit_infantry",
    "Chỉ Kỵ Binh": "merit_cavalry",
    "Chỉ Thiện Xạ": "merit_archer",
    "Chỉ Phép Thuật": "merit_mage",
    "Công Trạng Khác": "merit_other",
    "Trị Liệu (T4/T5)": "healing",
    "Đóng Góp Liên Minh": "alliance_donation",
    "Thời Gian Xây Dựng": "build_time",
    "Thời Gian Phá Hủy": "destroy_time",
    "Viện Trợ Tài Nguyên": "resource_aid",
    "Thắng Đột Kích Behemoth": "behemoth_wins",
    "Trợ Giúp Liên Minh": "alliance_help",
}

REQUIRED_COLUMN = "ID Nhân Vật"

# Display labels for UI
FIELD_LABELS = {
    "rank": "Rank",
    "role_id": "Player ID",
    "name": "Name",
    "power": "Power",
    "highest_power": "Highest Power",
    "deaths": "Deaths",
    "merit": "Merit",
    "gathering": "Gathering",
    "merit_infantry": "Infantry Merit",
    "merit_cavalry": "Cavalry Merit",
    "merit_archer": "Archer Merit",
    "merit_mage": "Mage Merit",
    "merit_other": "Other Merit",
    "healing": "Healing",
    "alliance_donation": "Alliance Donation",
    "build_time": "Build Time",
    "destroy_time": "Destroy Time",
    "resource_aid": "Resource Aid",
    "behemoth_wins": "Behemoth Wins",
    "alliance_help": "Alliance Help",
    "deco": "Deco",
    "red_artifact": "Red Artifact",
    "main": "Main",
    "note": "Note",
    "team": "Team",
    "status": "Status",
}

NUMERIC_FIELDS = {
    "rank", "power", "highest_power", "deaths", "merit", "gathering",
    "merit_infantry", "merit_cavalry", "merit_archer", "merit_mage",
    "merit_other", "healing", "alliance_donation", "build_time",
    "destroy_time", "resource_aid", "behemoth_wins", "alliance_help",
}

HISTORY_FIELDS = ["power", "rank", "deaths", "merit", "healing", "gathering"]


def slugify(text: str) -> str:
    """Convert unknown column header to a safe JSON key."""
    if not text:
        return "unknown"
    text = unicodedata.normalize("NFKD", str(text))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[\s_-]+", "_", text).strip("_")
    return text or "unknown"


def get_field_name(header: str) -> str:
    """Get JSON field name for an Excel column header."""
    header = str(header).strip() if header else ""
    if header in KNOWN_COLUMNS:
        return KNOWN_COLUMNS[header]
    return slugify(header)


def build_column_map(headers: list) -> dict:
    """Build mapping from column index to field name."""
    col_map = {}
    for idx, header in enumerate(headers):
        if header is None or str(header).strip() == "":
            continue
        field = get_field_name(str(header).strip())
        col_map[idx] = {"header": str(header).strip(), "field": field}
    return col_map


def parse_value(field: str, value):
    """Parse cell value to appropriate type."""
    if value is None or value == "":
        return 0 if field in NUMERIC_FIELDS else ""
    if field in NUMERIC_FIELDS:
        try:
            if isinstance(value, (int, float)):
                return int(value) if value == int(value) else float(value)
            s = str(value).replace(",", "").strip()
            if s == "":
                return 0
            return int(float(s))
        except (ValueError, TypeError):
            return 0
    if field == "role_id":
        return str(value).strip()
    return str(value).strip() if value is not None else ""
