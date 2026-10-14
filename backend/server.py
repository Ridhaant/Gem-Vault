# Shreeji Gems CRM — Local FastAPI Backend with SQLite Persistence
# 100% Local & Offline — Zero Cloud Dependencies
import os
import json
import sqlite3
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
DB_PATH = ROOT_DIR / "gemvault_local.db"

app = FastAPI(title="Shreeji Gems CRM Local API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Database Initialization (SQLite)
# ---------------------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Packets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS packets (
        id TEXT PRIMARY KEY,
        packet_number TEXT UNIQUE NOT NULL,
        particulars TEXT NOT NULL,
        shape TEXT NOT NULL,
        weight REAL NOT NULL,
        pieces INTEGER NOT NULL,
        mm_size TEXT,
        purchase_price REAL NOT NULL,
        purchase_rate_per_ct REAL,
        purchase_date TEXT NOT NULL,
        supplier_name TEXT,
        sale_price REAL NOT NULL,
        sale_rate_per_ct REAL,
        min_sale_price REAL,
        status TEXT NOT NULL DEFAULT 'in_stock',
        buyer_name TEXT,
        sale_date TEXT,
        sold_price REAL,
        sold_rate_per_ct REAL,
        sale_invoice_id TEXT,
        memo_party TEXT,
        memo_date TEXT,
        memo_notes TEXT,
        is_approval INTEGER DEFAULT 0,
        approval_status TEXT,
        box_name TEXT,
        stone_details TEXT,
        origin TEXT,
        treatment TEXT,
        cert_lab TEXT,
        cert_no TEXT,
        color_grade TEXT,
        clarity TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # Sales
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        invoice_no TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        buyer_phone TEXT,
        buyer_city TEXT,
        buyer_address TEXT,
        items_json TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL NOT NULL,
        paid_amount REAL NOT NULL,
        balance REAL NOT NULL,
        payment_status TEXT NOT NULL,
        payment_mode TEXT,
        payments_json TEXT NOT NULL,
        credit_days INTEGER DEFAULT 0,
        due_date TEXT,
        notes TEXT,
        approval_status TEXT,
        approval_billed_date TEXT,
        returned_items_json TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Run safe column migrations for existing SQLite databases
    packet_cols = [c[1] for c in cursor.execute("PRAGMA table_info(packets)").fetchall()]
    for col, ctype in [("is_approval", "INTEGER DEFAULT 0"), ("approval_status", "TEXT"), ("box_name", "TEXT"), ("stone_details", "TEXT")]:
        if col not in packet_cols:
            try:
                cursor.execute(f"ALTER TABLE packets ADD COLUMN {col} {ctype}")
            except Exception:
                pass

    sales_cols = [c[1] for c in cursor.execute("PRAGMA table_info(sales)").fetchall()]
    for col, ctype in [("approval_status", "TEXT"), ("approval_billed_date", "TEXT"), ("returned_items_json", "TEXT")]:
        if col not in sales_cols:
            try:
                cursor.execute(f"ALTER TABLE sales ADD COLUMN {col} {ctype}")
            except Exception:
                pass

    # Brokerage (Not in inventory)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS brokerage (
        id TEXT PRIMARY KEY,
        deal_no TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        seller_name TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        particulars TEXT NOT NULL,
        shape TEXT,
        weight REAL,
        pieces INTEGER,
        mm_size TEXT,
        cert_lab TEXT,
        deal_value REAL NOT NULL,
        brokerage_percent REAL NOT NULL,
        commission_amount REAL NOT NULL,
        commission_from TEXT DEFAULT 'both',
        settlement_status TEXT NOT NULL DEFAULT 'received',
        received_amount REAL NOT NULL,
        balance_receivable REAL NOT NULL,
        settlement_date TEXT,
        payment_mode TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Purchases
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        purchase_no TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        supplier_name TEXT NOT NULL,
        supplier_phone TEXT,
        supplier_city TEXT,
        lot_ref TEXT,
        items_json TEXT NOT NULL,
        total_cost REAL NOT NULL,
        paid_amount REAL NOT NULL,
        balance_payable REAL NOT NULL,
        payment_status TEXT NOT NULL,
        payment_mode TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Expenses
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        payee TEXT NOT NULL,
        packet_ref TEXT,
        payment_mode TEXT,
        note TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Buyers
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS buyers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT,
        phone TEXT,
        whatsapp TEXT,
        city TEXT,
        address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
    )
    """)

    conn.commit()
    conn.close()

init_db()

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class PacketIn(BaseModel):
    packet_number: str
    particulars: str
    shape: str
    weight: float
    pieces: int = 1
    mm_size: Optional[str] = ""
    purchase_price: float
    purchase_date: Optional[str] = None
    supplier_name: Optional[str] = ""
    sale_price: float
    status: Optional[str] = "in_stock"
    buyer_name: Optional[str] = ""
    sale_date: Optional[str] = ""
    sold_price: Optional[float] = None
    origin: Optional[str] = ""
    treatment: Optional[str] = "None / Natural"
    cert_lab: Optional[str] = "Self / None"
    cert_no: Optional[str] = ""
    notes: Optional[str] = ""

class SaleItemIn(BaseModel):
    packet_id: Optional[str] = None
    packet_number: str
    particulars: str
    shape: str
    weight: float
    pieces: int = 1
    unit: Optional[str] = "cts"
    mm_size: Optional[str] = ""
    cost_price: float
    rate_per_ct: Optional[float] = 0.0
    rate_per_unit: Optional[float] = 0.0
    total_price: float
    stone_id: Optional[str] = None
    sub_gem_id: Optional[str] = None
    hsn_code: Optional[str] = ""
    gst_rate: Optional[float] = 0.0
    gst_amount: Optional[float] = 0.0
    making_charges: Optional[float] = 0.0
    diamond_weight: Optional[float] = 0.0
    metal_weight: Optional[float] = 0.0

    class Config:
        extra = "allow"

class SaleIn(BaseModel):
    invoice_no: str
    date: str
    buyer_name: str
    buyer_phone: Optional[str] = ""
    buyer_city: Optional[str] = ""
    buyer_address: Optional[str] = ""
    items: List[SaleItemIn]
    subtotal: float
    discount: Optional[float] = 0
    tax_amount: Optional[float] = 0
    total: float
    initial_payment: Optional[float] = 0
    payment_mode: Optional[str] = "Bank Wire / NEFT"
    credit_days: Optional[int] = 0
    notes: Optional[str] = ""
    is_approval: Optional[bool] = False
    approval_status: Optional[str] = "pending"

class SettleApprovalIn(BaseModel):
    items: List[Dict[str, Any]]
    options: Optional[Dict[str, Any]] = None

class BrokerageIn(BaseModel):
    deal_no: str
    date: str
    seller_name: str
    buyer_name: str
    particulars: str
    shape: Optional[str] = "Cushion"
    weight: Optional[float] = 1.0
    pieces: Optional[int] = 1
    mm_size: Optional[str] = ""
    cert_lab: Optional[str] = ""
    deal_value: float
    brokerage_percent: float = 1.5
    commission_amount: float
    commission_from: Optional[str] = "both"
    settlement_status: Optional[str] = "received"
    received_amount: Optional[float] = 0
    balance_receivable: Optional[float] = 0
    payment_mode: Optional[str] = "Bank Wire / NEFT"
    notes: Optional[str] = ""

class PurchaseItemIn(BaseModel):
    packet_number: str
    particulars: str
    shape: str
    weight: float
    pieces: int = 1
    mm_size: Optional[str] = ""
    cost_price: float
    target_sale_price: float

class PurchaseIn(BaseModel):
    purchase_no: str
    date: str
    supplier_name: str
    supplier_phone: Optional[str] = ""
    supplier_city: Optional[str] = ""
    lot_ref: Optional[str] = ""
    items: List[PurchaseItemIn]
    total_cost: float
    paid_amount: Optional[float] = 0
    payment_mode: Optional[str] = "Bank Wire"
    notes: Optional[str] = ""

class ExpenseIn(BaseModel):
    date: str
    category: str
    amount: float
    payee: str
    packet_ref: Optional[str] = ""
    payment_mode: Optional[str] = "Bank Wire / NEFT"
    note: Optional[str] = ""

class BuyerIn(BaseModel):
    name: str
    company: Optional[str] = ""
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    city: Optional[str] = "Mumbai"
    address: Optional[str] = ""
    notes: Optional[str] = ""

# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/login")
def login(payload: dict):
    return {
        "access_token": "gemvault-local-token-" + str(uuid.uuid4()),
        "user": {
            "id": "u_owner",
            "email": payload.get("email", "admin@shreejigems.com"),
            "name": "Shreeji Gems",
            "role": "owner",
            "active": True,
        },
    }

@api_router.get("/auth/me")
def me():
    return {
        "id": "u_owner",
        "email": "admin@shreejigems.com",
        "name": "Shreeji Gems",
        "role": "owner",
        "active": True,
    }

# Packets (Inventory)
@api_router.get("/packets")
def list_packets():
    conn = get_db()
    rows = conn.execute("SELECT * FROM packets ORDER BY packet_number ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@api_router.post("/packets")
def create_packet(pkt: PacketIn):
    conn = get_db()
    pid = "pkt-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    pdate = pkt.purchase_date or now[:10]
    rate_cost = round(pkt.purchase_price / pkt.weight, 2) if pkt.weight else 0
    rate_sale = round(pkt.sale_price / pkt.weight, 2) if pkt.weight else 0

    conn.execute("""
    INSERT INTO packets (
        id, packet_number, particulars, shape, weight, pieces, mm_size,
        purchase_price, purchase_rate_per_ct, purchase_date, supplier_name,
        sale_price, sale_rate_per_ct, status, buyer_name, sale_date,
        sold_price, origin, treatment, cert_lab, cert_no, notes,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pid, pkt.packet_number, pkt.particulars, pkt.shape, pkt.weight, pkt.pieces, pkt.mm_size,
        pkt.purchase_price, rate_cost, pdate, pkt.supplier_name,
        pkt.sale_price, rate_sale, pkt.status or "in_stock", pkt.buyer_name, pkt.sale_date,
        pkt.sold_price, pkt.origin, pkt.treatment, pkt.cert_lab, pkt.cert_no, pkt.notes,
        now, now
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM packets WHERE id = ?", (pid,)).fetchone()
    conn.close()
    return dict(row)

@api_router.delete("/packets/{packet_id}")
def delete_packet(packet_id: str):
    conn = get_db()
    conn.execute("DELETE FROM packets WHERE id = ? OR packet_number = ?", (packet_id, packet_id))
    conn.commit()
    conn.close()
    return {"success": True}

class PacketRenameIn(BaseModel):
    new_packet_number: str

@api_router.post("/packets/{packet_id}/rename")
def rename_packet(packet_id: str, payload: PacketRenameIn):
    conn = get_db()
    clean_new = payload.new_packet_number.strip()
    if not clean_new:
        conn.close()
        raise HTTPException(status_code=400, detail="New packet number cannot be empty")

    dup = conn.execute("SELECT id FROM packets WHERE LOWER(packet_number) = LOWER(?) AND id != ? AND packet_number != ?", (clean_new, packet_id, packet_id)).fetchone()
    if dup:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Packet number '{clean_new}' already exists")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute("UPDATE packets SET packet_number = ?, updated_at = ? WHERE id = ? OR packet_number = ?", (clean_new, now, packet_id, packet_id))
    conn.commit()
    row = conn.execute("SELECT * FROM packets WHERE packet_number = ? OR id = ?", (clean_new, packet_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Packet not found")
    return dict(row)

# Sales
@api_router.get("/sales")
def list_sales():
    conn = get_db()
    rows = conn.execute("SELECT * FROM sales ORDER BY date DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["items"] = json.loads(d.pop("items_json", "[]"))
        d["payments"] = json.loads(d.pop("payments_json", "[]"))
        result.append(d)
    return result

@api_router.post("/sales")
def create_sale(sale: SaleIn):
    conn = get_db()
    sid = "inv-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    paid = sale.initial_payment or 0
    balance = max(0.0, sale.total - paid)
    pay_status = "cleared" if balance <= 0 else ("partial" if paid > 0 else "unpaid")

    payments = []
    if paid > 0:
        payments.append({
            "id": "pm-" + str(uuid.uuid4())[:8],
            "date": sale.date,
            "amount": paid,
            "mode": sale.payment_mode or "Bank Wire / NEFT",
            "note": "Initial payment",
        })

    conn.execute("""
    INSERT INTO sales (
        id, invoice_no, date, buyer_name, buyer_phone, buyer_city, buyer_address,
        items_json, subtotal, discount, tax_amount, total, paid_amount, balance,
        payment_status, payment_mode, payments_json, credit_days, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        sid, sale.invoice_no, sale.date, sale.buyer_name, sale.buyer_phone, sale.buyer_city, sale.buyer_address,
        json.dumps([it.model_dump() for it in sale.items]),
        sale.subtotal, sale.discount, sale.tax_amount, sale.total, paid, balance,
        pay_status, sale.payment_mode, json.dumps(payments), sale.credit_days, sale.notes, now
    ))

    # Auto update packet status: on_approval if approval voucher, sold if confirmed sale
    for it in sale.items:
        pkt_row = conn.execute("SELECT * FROM packets WHERE packet_number = ? OR id = ?", (it.packet_number, it.packet_id or "")).fetchone()
        if pkt_row:
            p_pcs = int(pkt_row["pieces"] or 1)
            p_wt = float(pkt_row["weight"] or 0.0)
            alloc_pcs = int(it.pieces or 1)
            alloc_wt = float(it.weight or 0.0)
            rem_pcs = max(0, p_pcs - alloc_pcs)
            rem_wt = max(0.0, round(p_wt - alloc_wt, 2))

            if rem_pcs > 0 and rem_wt > 0:
                conn.execute("""
                UPDATE packets SET pieces = ?, weight = ?, updated_at = ?
                WHERE id = ?
                """, (rem_pcs, rem_wt, now, pkt_row["id"]))
            else:
                if sale.is_approval:
                    conn.execute("""
                    UPDATE packets SET status = 'on_approval', memo_party = ?, memo_date = ?, pieces = 0, weight = 0, updated_at = ?
                    WHERE id = ?
                    """, (sale.buyer_name, sale.date, now, pkt_row["id"]))
                else:
                    conn.execute("""
                    UPDATE packets SET status = 'sold', buyer_name = ?, sale_date = ?, sold_price = ?, sale_invoice_id = ?, pieces = 0, weight = 0, updated_at = ?
                    WHERE id = ?
                    """, (sale.buyer_name, sale.date, it.total_price, sid, now, pkt_row["id"]))

    conn.commit()
    row = conn.execute("SELECT * FROM sales WHERE id = ?", (sid,)).fetchone()
    conn.close()
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    d["payments"] = json.loads(d.pop("payments_json", "[]"))
    return d

@api_router.put("/sales/{sale_id}")
def update_sale(sale_id: str, sale: SaleIn):
    conn = get_db()
    paid = sale.initial_payment or 0
    balance = max(0.0, sale.total - paid)
    pay_status = "cleared" if balance <= 0 else ("partial" if paid > 0 else "unpaid")
    conn.execute("""
    UPDATE sales SET
        invoice_no = ?, date = ?, buyer_name = ?, buyer_phone = ?, buyer_city = ?, buyer_address = ?,
        items_json = ?, subtotal = ?, discount = ?, tax_amount = ?, total = ?, paid_amount = ?, balance = ?,
        payment_status = ?, payment_mode = ?, credit_days = ?, notes = ?
    WHERE id = ?
    """, (
        sale.invoice_no, sale.date, sale.buyer_name, sale.buyer_phone, sale.buyer_city, sale.buyer_address,
        json.dumps([it.model_dump() for it in sale.items]),
        sale.subtotal, sale.discount, sale.tax_amount, sale.total, paid, balance,
        pay_status, sale.payment_mode, sale.credit_days, sale.notes, sale_id
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM sales WHERE id = ?", (sale_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Sale not found")
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    d["payments"] = json.loads(d.pop("payments_json", "[]"))
    return d

@api_router.delete("/sales/{sale_id}")
def delete_sale(sale_id: str):
    conn = get_db()
    row = conn.execute("SELECT items_json FROM sales WHERE id = ?", (sale_id,)).fetchone()
    if row:
        items = json.loads(row["items_json"])
        for it in items:
            conn.execute("""
            UPDATE packets SET status = 'in_stock', buyer_name = NULL, sale_date = NULL, sold_price = NULL, sale_invoice_id = NULL
            WHERE packet_number = ? OR id = ?
            """, (it.get("packet_number"), it.get("packet_id")))
    conn.execute("DELETE FROM sales WHERE id = ?", (sale_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@api_router.post("/sales/{sale_id}/settle-approval")
def settle_approval(sale_id: str, payload: SettleApprovalIn):
    conn = get_db()
    row = conn.execute("SELECT * FROM sales WHERE id = ?", (sale_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Sale voucher not found")

    sale_data = dict(row)
    orig_items = json.loads(sale_data.get("items_json") or "[]")
    now_str = datetime.now(timezone.utc).isoformat()

    updated_items = []
    total_taken = 0
    total_returned = 0
    new_subtotal = 0.0

    for st in payload.items:
        p_taken = int(st.get("pieces_taken", 0))
        w_taken = float(st.get("weight_taken", 0.0))
        p_ret = int(st.get("pieces_returned", 0))
        w_ret = float(st.get("weight_returned", 0.0))
        rate = float(st.get("rate_per_unit", 0.0))

        total_taken += p_taken
        total_returned += p_ret
        line_total = round(rate * w_taken) if p_taken > 0 else 0
        new_subtotal += line_total

        orig_it = next((it for it in orig_items if it.get("packet_id") == st.get("packet_id") or it.get("packet_number") == st.get("packet_number")), None)
        orig_w = float(orig_it.get("weight", w_taken + w_ret)) if orig_it else (w_taken + w_ret)
        orig_p = int(orig_it.get("pieces", p_taken + p_ret)) if orig_it else (p_taken + p_ret)
        if rate <= 0 and orig_it:
            rate = float(orig_it.get("rate_per_unit") or orig_it.get("rate_per_ct") or 0.0)
            line_total = round(rate * w_taken) if p_taken > 0 else 0

        cost_orig = float(orig_it.get("cost_price", 0)) if orig_it else 0.0
        line_cost = round((cost_orig / orig_w) * w_taken) if orig_w > 0 else 0

        it_dict = {
            **(orig_it or {}),
            "packet_id": st.get("packet_id"),
            "packet_number": st.get("packet_number"),
            "particulars": st.get("particulars", "Gemstone"),
            "shape": st.get("shape", "Oval"),
            "pieces": p_taken,
            "weight": w_taken,
            "rate_per_unit": rate,
            "rate_per_ct": rate,
            "total_price": line_total,
            "cost_price": line_cost,
            "original_weight": orig_w,
            "original_pieces": orig_p,
            "weight_taken": w_taken,
            "pieces_taken": p_taken,
            "weight_returned": w_ret,
            "pieces_returned": p_ret,
            "is_returned": p_taken == 0 and p_ret > 0,
        }
        if p_taken > 0:
            updated_items.append(it_dict)

        pkt_num = st.get("packet_number")
        pkt_id = st.get("packet_id")
        pkt_row = conn.execute("SELECT * FROM packets WHERE packet_number = ? OR id = ?", (pkt_num, pkt_id or "")).fetchone()
        cur_p = int(pkt_row["pieces"] or 0) if pkt_row else 0
        cur_w = float(pkt_row["weight"] or 0.0) if pkt_row else 0.0

        if p_taken > 0 and p_ret == 0:
            if cur_p > 0:
                conn.execute("""
                UPDATE packets SET status = 'in_stock', memo_party = '', is_approval = 0
                WHERE packet_number = ? OR id = ?
                """, (pkt_num, pkt_id))
            else:
                conn.execute("""
                UPDATE packets SET status = 'sold', buyer_name = ?, sale_date = ?, sold_price = ?, pieces = 0, weight = 0
                WHERE packet_number = ? OR id = ?
                """, (sale_data["buyer_name"], now_str[:10], line_total, pkt_num, pkt_id))
        elif p_ret > 0 and p_taken == 0:
            conn.execute("""
            UPDATE packets SET status = 'in_stock', memo_party = '', is_approval = 0, approval_status = 'returned', pieces = ?, weight = ?
            WHERE packet_number = ? OR id = ?
            """, (cur_p + p_ret, round(cur_w + w_ret, 2), pkt_num, pkt_id))
        elif p_taken > 0 and p_ret > 0:
            conn.execute("""
            UPDATE packets SET status = 'in_stock', memo_party = '', is_approval = 0, pieces = ?, weight = ?
            WHERE packet_number = ? OR id = ?
            """, (cur_p + p_ret, round(cur_w + w_ret, 2), pkt_num, pkt_id))

    if total_taken == 0:
        final_status = "returned"
        billed_date = None
        new_subtotal = 0.0
        tax_amt = 0.0
        final_total = 0.0
        bal = 0.0
        pay_st = "cleared"
    else:
        final_status = "approved_billed"
        billed_date = now_str[:10]
        tax_amt = round(new_subtotal * 0.0025, 2)
        discount = float(sale_data.get("discount") or 0.0)
        final_total = max(0.0, round(new_subtotal + tax_amt - discount))
        paid = float(sale_data.get("paid_amount") or 0.0)
        bal = max(0.0, final_total - paid)
        pay_st = "cleared" if bal <= 0 else ("partial" if paid > 0 else "unpaid")

    user_notes = (payload.options or {}).get("notes") or f"Settlement: {total_taken} pcs taken, {total_returned} pcs returned to vault."

    conn.execute("""
    UPDATE sales SET
        items_json = ?, subtotal = ?, tax_amount = ?, total = ?, balance = ?,
        payment_status = ?, notes = ?, approval_status = ?, approval_billed_date = ?
    WHERE id = ?
    """, (
        json.dumps(updated_items), new_subtotal, tax_amt, final_total, bal,
        pay_st, user_notes, final_status, billed_date, sale_id
    ))
    conn.commit()
    res_row = conn.execute("SELECT * FROM sales WHERE id = ?", (sale_id,)).fetchone()
    conn.close()
    d = dict(res_row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    d["payments"] = json.loads(d.pop("payments_json", "[]"))
    return {"success": True, "sale": d}

# Brokerage (Not in inventory)
@api_router.get("/brokerage")
def list_brokerage():
    conn = get_db()
    rows = conn.execute("SELECT * FROM brokerage ORDER BY date DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@api_router.post("/brokerage")
def create_brokerage(b: BrokerageIn):
    conn = get_db()
    bid = "brk-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    received = b.received_amount if b.settlement_status == "received" else (b.received_amount or 0)
    bal = max(0.0, b.commission_amount - received)
    st = "received" if bal <= 0 else ("partial" if received > 0 else "pending")

    conn.execute("""
    INSERT INTO brokerage (
        id, deal_no, date, seller_name, buyer_name, particulars, shape, weight, pieces, mm_size,
        cert_lab, deal_value, brokerage_percent, commission_amount, commission_from,
        settlement_status, received_amount, balance_receivable, payment_mode, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        bid, b.deal_no, b.date, b.seller_name, b.buyer_name, b.particulars, b.shape, b.weight, b.pieces, b.mm_size,
        b.cert_lab, b.deal_value, b.brokerage_percent, b.commission_amount, b.commission_from,
        st, received, bal, b.payment_mode, b.notes, now
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    conn.close()
    return dict(row)

# Purchases
@api_router.get("/purchases")
def list_purchases():
    conn = get_db()
    rows = conn.execute("SELECT * FROM purchases ORDER BY date DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["items"] = json.loads(d.pop("items_json", "[]"))
        result.append(d)
    return result

@api_router.post("/purchases")
def create_purchase(p: PurchaseIn):
    conn = get_db()
    pur_id = "pur-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    paid = p.paid_amount or p.total_cost
    bal = max(0.0, p.total_cost - paid)
    st = "cleared" if bal <= 0 else ("partial" if paid > 0 else "unpaid")

    conn.execute("""
    INSERT INTO purchases (
        id, purchase_no, date, supplier_name, supplier_phone, supplier_city, lot_ref,
        items_json, total_cost, paid_amount, balance_payable, payment_status, payment_mode, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pur_id, p.purchase_no, p.date, p.supplier_name, p.supplier_phone, p.supplier_city, p.lot_ref,
        json.dumps([it.model_dump() for it in p.items]),
        p.total_cost, paid, bal, st, p.payment_mode, p.notes, now
    ))

    # Auto intake new packets into inventory
    for it in p.items:
        pid = "pkt-" + str(uuid.uuid4())[:8]
        rcost = round(it.cost_price / it.weight, 2) if it.weight else 0
        rsale = round(it.target_sale_price / it.weight, 2) if it.weight else 0
        conn.execute("""
        INSERT INTO packets (
            id, packet_number, particulars, shape, weight, pieces, mm_size,
            purchase_price, purchase_rate_per_ct, purchase_date, supplier_name,
            sale_price, sale_rate_per_ct, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_stock', ?, ?)
        """, (
            pid, it.packet_number, it.particulars, it.shape, it.weight, it.pieces, it.mm_size,
            it.cost_price, rcost, p.date, p.supplier_name, it.target_sale_price, rsale, now, now
        ))

    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    return d

@api_router.put("/purchases/{pur_id}")
def update_purchase(pur_id: str, p: PurchaseIn):
    conn = get_db()
    paid = p.paid_amount or p.total_cost
    bal = max(0.0, p.total_cost - paid)
    st = "cleared" if bal <= 0 else ("partial" if paid > 0 else "unpaid")
    conn.execute("""
    UPDATE purchases SET
        purchase_no = ?, date = ?, supplier_name = ?, supplier_phone = ?, supplier_city = ?, lot_ref = ?,
        items_json = ?, total_cost = ?, paid_amount = ?, balance_payable = ?, payment_status = ?, payment_mode = ?, notes = ?
    WHERE id = ?
    """, (
        p.purchase_no, p.date, p.supplier_name, p.supplier_phone, p.supplier_city, p.lot_ref,
        json.dumps([it.model_dump() for it in p.items]),
        p.total_cost, paid, bal, st, p.payment_mode, p.notes, pur_id
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    return d

# Expenses
@api_router.get("/expenses")
def list_expenses():
    conn = get_db()
    rows = conn.execute("SELECT * FROM expenses ORDER BY date DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@api_router.post("/expenses")
def create_expense(e: ExpenseIn):
    conn = get_db()
    eid = "exp-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("""
    INSERT INTO expenses (id, date, category, amount, payee, packet_ref, payment_mode, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (eid, e.date, e.category, e.amount, e.payee, e.packet_ref, e.payment_mode, e.note, now))
    conn.commit()
    row = conn.execute("SELECT * FROM expenses WHERE id = ?", (eid,)).fetchone()
    conn.close()
    return dict(row)

@api_router.put("/expenses/{eid}")
def update_expense(eid: str, e: ExpenseIn):
    conn = get_db()
    conn.execute("""
    UPDATE expenses SET date = ?, category = ?, amount = ?, payee = ?, packet_ref = ?, payment_mode = ?, note = ?
    WHERE id = ?
    """, (e.date, e.category, e.amount, e.payee, e.packet_ref, e.payment_mode, e.note, eid))
    conn.commit()
    row = conn.execute("SELECT * FROM expenses WHERE id = ?", (eid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    return dict(row)

# Buyers
@api_router.get("/buyers")
def list_buyers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM buyers ORDER BY name ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@api_router.post("/buyers")
def create_buyer(b: BuyerIn):
    conn = get_db()
    bid = "buy-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("""
    INSERT INTO buyers (id, name, company, phone, whatsapp, city, address, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (bid, b.name, b.company, b.phone, b.whatsapp, b.city, b.address, b.notes, now))
    conn.commit()
    row = conn.execute("SELECT * FROM buyers WHERE id = ?", (bid,)).fetchone()
    conn.close()
    return dict(row)

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
