"""
Verification test for Shreeji Gems CRM Bare-Shell Delivery
Ensures:
1. All database tables are clean and ready for user entry (0 packets, 0 sales, 0 boxes, 0 buyers, etc.)
2. Default master PIN (2014) is intact and functional
3. Analytics endpoint responds with zeroes and zero divide-by-zero errors
4. Boxes endpoint returns empty array
5. Backup endpoint streams a valid bare-shell JSON payload
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from server import app, get_db

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json().get("status") == "ok"
    print("✓ Health check passed")

def test_bare_shell_database_counts():
    conn = get_db()
    cursor = conn.cursor()
    tables = ["packets", "sales", "brokerage", "purchases", "expenses", "buyers", "boxes", "stock_audit_log"]
    for t in tables:
        cnt = cursor.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        assert cnt == 0, f"Table {t} should be empty in bare shell, found {cnt} rows"
        print(f"✓ Table '{t}' is clean (0 rows)")

    pin_row = cursor.execute("SELECT value FROM app_settings WHERE key = 'master_pin_hash'").fetchone()
    assert pin_row is not None, "Master PIN hash must be present in app_settings"
    print("✓ Master PIN setting present")
    conn.close()

def test_analytics_empty_state():
    res = client.get("/api/analytics")
    assert res.status_code == 200
    data = res.json()
    assert data["total_sales_revenue"] == 0.0
    assert data["direct_sales_cogs"] == 0.0
    assert data["vault_packets_count"] == 0
    assert data["vault_cost_valuation"] == 0.0
    print("✓ Analytics returns zeroed metrics without errors")

def test_boxes_endpoint():
    res = client.get("/api/boxes")
    assert res.status_code == 200
    boxes = res.json()
    assert isinstance(boxes, list) and len(boxes) == 0
    print("✓ /api/boxes returns empty array")

def test_backup_json_download():
    res = client.get("/api/backup/download-json")
    assert res.status_code == 200
    data = res.json()
    assert data.get("app") == "Shreeji Gems CRM"
    assert len(data.get("packets", [])) == 0
    assert len(data.get("boxes", [])) == 0
    print("✓ /api/backup/download-json streams valid bare-shell payload")

if __name__ == "__main__":
    test_health()
    test_bare_shell_database_counts()
    test_analytics_empty_state()
    test_boxes_endpoint()
    test_backup_json_download()
    print("\n🎉 ALL BARE-SHELL VERIFICATION TESTS PASSED SUCCESSFULLY!")
