import pytest
from fastapi.testclient import TestClient
import sqlite3
import os
from server import app, DB_PATH, get_db

client = TestClient(app)

@pytest.fixture
def test_inventory():
    """Ensure a temporary box and packet exist during test run, cleaned up after."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO boxes (id, name, description, color, created_at)
            VALUES ('test-box-1', 'Box 1 - Test Showcase', 'Automated Test Container', '#10b981', '2026-11-18T12:00:00Z')
        """)
        cursor.execute("""
            INSERT OR REPLACE INTO packets (id, packet_number, particulars, shape, weight, pieces, purchase_price, purchase_rate_per_ct, purchase_date, sale_price, sale_rate_per_ct, box_name, status, is_deleted, created_at, updated_at)
            VALUES ('test-pkt-1', 'ex/1-test', 'Emerald (Zambian)', 'Oval', 5.25, 1, 25000.0, 4761.9, '2026-11-18', 35000.0, 6666.6, 'Box 1 - Test Showcase', 'in_stock', 0, '2026-11-18T12:00:00Z', '2026-11-18T12:00:00Z')
        """)
        conn.commit()

    yield

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM packets WHERE id = 'test-pkt-1'")
        cursor.execute("DELETE FROM boxes WHERE id = 'test-box-1'")
        conn.commit()

def test_health_check():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["version"] == "2.0.0"

def test_cost_price_password_verification():
    # 1. Invalid PIN returns valid: False
    res_wrong = client.post("/api/cost-price-password/verify", json={"password": "wrong"})
    assert res_wrong.status_code == 200
    assert res_wrong.json().get("valid") is False

    # 2. Valid PIN '2014' returns token
    res_correct = client.post("/api/cost-price-password/verify", json={"password": "2014"})
    assert res_correct.status_code == 200
    token = res_correct.json().get("token")
    assert token is not None and len(token) > 10

    # 3. Verify token endpoint confirms validity
    res_verify = client.post("/api/cost-price-password/verify-token", json={"token": token})
    assert res_verify.status_code == 200
    assert res_verify.json().get("valid") is True

def test_cost_price_masking_without_token(test_inventory):
    # Boxes without token must mask cost_valuation to 0.0
    res_boxes = client.get("/api/boxes")
    assert res_boxes.status_code == 200
    boxes = res_boxes.json()
    assert len(boxes) > 0
    for b in boxes:
        assert b.get("cost_valuation") == 0.0, f"Cost valuation should be masked to 0.0, got {b.get('cost_valuation')}"

    # Packets without token must mask purchase_price and purchase rates to 0.0
    res_packets = client.get("/api/packets")
    assert res_packets.status_code == 200
    packets = res_packets.json()
    assert len(packets) > 0
    for p in packets:
        assert p.get("purchase_price") == 0.0 or p.get("purchase_price") is None
        rate = p.get("purchase_rate_per_unit") or p.get("purchase_rate_per_ct")
        assert rate == 0.0 or rate is None

def test_cost_price_reveal_with_token(test_inventory):
    # Get active token
    res_correct = client.post("/api/cost-price-password/verify", json={"password": "2014"})
    token = res_correct.json()["token"]
    headers = {"X-Cost-Token": token}

    # Boxes with token must reveal true cost valuation
    res_boxes = client.get("/api/boxes", headers=headers)
    assert res_boxes.status_code == 200
    boxes = res_boxes.json()
    assert len(boxes) > 0
    test_box = next((b for b in boxes if b["id"] == "test-box-1"), None)
    assert test_box is not None
    assert test_box["cost_valuation"] > 0.0, f"Cost valuation should be positive, got {test_box['cost_valuation']}"

    # Packets with token must reveal true purchase price and purchase rates
    res_packets = client.get("/api/packets", headers=headers)
    assert res_packets.status_code == 200
    packets = res_packets.json()
    test_pkt = next((p for p in packets if p["id"] == "test-pkt-1"), None)
    assert test_pkt is not None
    assert test_pkt.get("purchase_price", 0) > 0
    revealed_rate = test_pkt.get("purchase_rate_per_unit") or test_pkt.get("purchase_rate_per_ct") or 0
    assert revealed_rate > 0

def test_particulars_shapes_labs_endpoints():
    # 1. Custom particulars
    res_part1 = client.get("/api/custom-particulars")
    assert res_part1.status_code == 200
    parts1 = res_part1.json()
    assert len(parts1) >= 100
    assert "Emerald (Zambian)" in parts1
    assert "Ruby (Burmese Pigeon Blood)" in parts1
    assert "Tanzanite" in parts1

    # 2. Particulars alias
    res_part2 = client.get("/api/particulars")
    assert res_part2.status_code == 200
    parts2 = res_part2.json()
    assert len(parts2) == len(parts1)

    # 3. Shapes and alias
    res_shapes1 = client.get("/api/custom-shapes")
    res_shapes2 = client.get("/api/shapes")
    assert res_shapes1.status_code == 200
    assert res_shapes2.status_code == 200
    assert "Oval" in res_shapes1.json()
    assert "Cushion" in res_shapes2.json()

    # 4. Labs and alias
    res_labs1 = client.get("/api/custom-labs")
    res_labs2 = client.get("/api/labs")
    assert res_labs1.status_code == 200
    assert res_labs2.status_code == 200
    assert "GIA" in res_labs1.json()
    assert "Gübelin" in res_labs2.json()

def test_frontend_static_serving():
    res = client.get("/")
    assert res.status_code == 200
    assert "<html" in res.text.lower()
    assert "Shreeji Gems" in res.text or "GemVault" in res.text
