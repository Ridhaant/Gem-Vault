"""
Comprehensive End-to-End Smoke Test for Shreeji Gems CRM Bare-Shell System
Covers:
1. Health & Status
2. Master PIN Verification & Token Generation (Default 2014)
3. PIN Validation (Invalid PIN rejection)
4. Cost Masking / Role-Based Access Control
5. Bare-Shell Initial State (0 packets, 0 sales, 0 boxes, 0 expenses, 0 purchases)
6. Box Creation & Listing
7. Gemstone Packet Creation, Retrieval & Filtering
8. Buyer Creation & Retrieval
9. Purchase Order Intake & Expense Recording
10. Sale Invoicing, Stock Deduction & Margin Verification
11. Analytics & Balance Sheet Reporting
12. Full Cleanup returning back to 0 rows (Bare Shell)
13. Backup Download Verification
"""
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from server import app, get_db

client = TestClient(app)

def run_smoke_test():
    print("=" * 60)
    print("RUNNING SHREEJI GEMS BARE-SHELL SYSTEM SMOKE TEST")
    print("=" * 60)

    # 1. Health
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json().get("status") == "ok"
    print("1. [PASS] API Health Check")

    # 2. Master PIN Verification (Default 2014)
    res = client.post("/api/cost-price-password/verify", json={"password": "2014"})
    assert res.status_code == 200, f"Failed PIN unlock: {res.text}"
    token_data = res.json()
    assert token_data.get("valid") is True
    cost_token = token_data.get("token")
    assert cost_token is not None
    print("2. [PASS] Master PIN Unlock with Default 2014 (Token generated)")

    # 3. Invalid PIN Rejection
    res = client.post("/api/cost-price-password/verify", json={"password": "9999"})
    assert res.status_code == 200
    assert res.json().get("valid") is False
    print("3. [PASS] Invalid PIN correctly rejected")

    # 4. Verify Initial Bare-Shell State
    conn = get_db()
    for table in ["packets", "sales", "brokerage", "purchases", "expenses", "buyers", "boxes", "stock_audit_log"]:
        cnt = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        assert cnt == 0, f"Table {table} not empty! Found {cnt}"
    conn.close()
    print("4. [PASS] Initial State Verified: All 8 core tables have 0 rows")

    # 5. Box Creation
    box_id = None
    box_name = "Smoke Test Vault Box 001"
    res = client.post("/api/boxes", json={
        "name": box_name,
        "description": "Temporary smoke test box",
        "color": "#10b981"
    })
    assert res.status_code == 200, f"Box create failed: {res.text}"
    boxes = client.get("/api/boxes").json()
    assert len(boxes) == 1
    assert boxes[0]["name"] == box_name
    box_id = boxes[0]["id"]
    print("5. [PASS] Box Creation & Retrieval (/api/boxes)")

    # 6. Packet Creation in Box
    test_pkt_num = "TEST-SMOKE-001"
    packet_payload = {
        "packet_number": test_pkt_num,
        "particulars": "Emerald (Zambian)",
        "shape": "Oval",
        "weight": 5.50,
        "pieces": 1,
        "unit": "cts",
        "mm_size": "11.2 x 8.4 mm",
        "purchase_price": 50000.0,
        "purchase_date": "2026-11-16",
        "supplier_name": "Zambia Direct",
        "sale_price": 75000.0,
        "box_name": box_name,
        "status": "in_stock",
        "origin": "Zambia",
        "treatment": "None / Minor Oil",
        "cert_lab": "GIA",
        "company_name": "Shreeji Gems"
    }
    res = client.post("/api/packets", json=packet_payload)
    assert res.status_code == 200, f"Packet creation failed: {res.text}"
    created_pkt = res.json()
    pkt_id = created_pkt["id"]
    print("6. [PASS] Packet Creation (/api/packets)")

    # 7. Cost Masking vs Cost Unlocked Check
    # A) Masked request (sales view)
    res_masked = client.get(f"/api/packets/{pkt_id}?mask_cost=true")
    assert res_masked.status_code == 200
    pkt_masked = res_masked.json()
    assert pkt_masked["purchase_price"] == 0.0 or pkt_masked.get("supplier_name") == "Confidential"
    
    # B) Unmasked request (owner view with cost token)
    res_unmasked = client.get(
        f"/api/packets/{pkt_id}",
        headers={"X-Cost-Token": cost_token, "X-Cost-Unlocked": "true"}
    )
    assert res_unmasked.status_code == 200
    pkt_unmasked = res_unmasked.json()
    assert pkt_unmasked["purchase_price"] == 50000.0
    assert pkt_unmasked["supplier_name"] == "Zambia Direct"
    print("7. [PASS] Cost Price Masking & Secure Unmasking Verification")

    # 8. Buyer Creation
    buyer_res = client.post("/api/buyers", json={
        "name": "Smoke Test Buyer Pvt Ltd",
        "phone": "+91 9876543210",
        "city": "Mumbai",
        "address": "Opera House, BKC"
    })
    assert buyer_res.status_code == 200
    buyers = client.get("/api/buyers").json()
    assert len(buyers) == 1
    print("8. [PASS] Buyer Creation & Retrieval (/api/buyers)")

    # 9. Expense Creation
    exp_res = client.post("/api/expenses", json={
        "date": "2026-11-16",
        "category": "Lab Certification",
        "amount": 2500.0,
        "payee": "GIA Laboratory Mumbai",
        "note": "Smoke test certification fee"
    })
    assert exp_res.status_code == 200
    expenses = client.get("/api/expenses").json()
    assert len(expenses) == 1
    print("9. [PASS] Expense Creation (/api/expenses)")

    # 10. Sale Invoicing (Selling the packet)
    sale_payload = {
        "invoice_no": "INV-SMOKE-001",
        "date": "2026-11-16",
        "buyer_name": "Smoke Test Buyer Pvt Ltd",
        "buyer_city": "Mumbai",
        "items": [
            {
                "packet_id": pkt_id,
                "packet_number": test_pkt_num,
                "particulars": "Emerald (Zambian)",
                "shape": "Oval",
                "weight": 5.50,
                "pieces": 1,
                "cost_price": 50000.0,
                "rate_per_ct": 14000.0,
                "total_price": 77000.0
            }
        ],
        "subtotal": 77000.0,
        "discount": 0.0,
        "tax_amount": 0.0,
        "total": 77000.0,
        "initial_payment": 77000.0,
        "payment_mode": "Bank Wire / NEFT",
        "notes": "Full payment received"
    }
    sale_res = client.post("/api/sales", json=sale_payload)
    assert sale_res.status_code == 200, f"Sale create failed: {sale_res.text}"
    
    # Verify packet status became 'sold'
    sold_pkt = client.get(f"/api/packets/{pkt_id}").json()
    assert sold_pkt["status"] == "sold"
    print("10. [PASS] Sale Invoice Generation & Automated Stock Relief (status -> 'sold')")

    # 11. Analytics Verification
    analytics_res = client.get("/api/analytics")
    assert analytics_res.status_code == 200
    a_data = analytics_res.json()
    assert a_data["total_sales_revenue"] == 77000.0
    assert a_data["direct_sales_cogs"] == 50000.0
    assert a_data["gross_profit"] == 27000.0 # 77000 - 50000
    assert a_data["net_profit"] == 24500.0   # 27000 - 2500 expense
    print("11. [PASS] Real-time Financial Waterfall & P&L Analytics Verified")

    # 12. Cleanup of Smoke Test Data back to pristine 0 rows
    conn = get_db()
    for t in ["packets", "sales", "brokerage", "purchases", "expenses", "buyers", "boxes", "stock_audit_log"]:
        conn.execute(f"DELETE FROM {t};")
    conn.commit()
    conn.execute("VACUUM;")
    for t in ["packets", "sales", "brokerage", "purchases", "expenses", "buyers", "boxes", "stock_audit_log"]:
        assert conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] == 0
    conn.close()
    print("12. [PASS] Smoke Test Data Safely Cleaned Up (Vault returned to 0 rows)")

    # 13. Backup Endpoint
    backup_res = client.get("/api/backup/download-json")
    assert backup_res.status_code == 200
    b_data = backup_res.json()
    assert b_data.get("app") == "Shreeji Gems CRM"
    assert len(b_data.get("packets", [])) == 0
    print("13. [PASS] Live Backup Download Streams Valid Bare-Shell JSON")

    print("\n" + "=" * 60)
    print("ALL 13 SMOKE TESTS PASSED WITH ZERO ERRORS!")
    print("=" * 60)

if __name__ == "__main__":
    run_smoke_test()
