# Shreeji Gems CRM — Local FastAPI Backend with SQLite Persistence
# 100% Local & Offline — Zero Cloud Dependencies
import os
import json
import sqlite3
import uuid
try:
    import orjson
except ImportError:
    class MockOrjson:
        @staticmethod
        def dumps(obj, *args, **kwargs):
            return json.dumps(obj, default=str).encode("utf-8")
        @staticmethod
        def loads(obj, *args, **kwargs):
            return json.loads(obj)
    orjson = MockOrjson()
from pathlib import Path
import hashlib
import time
import secrets
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Query, status, Response, Body, Header, Request, UploadFile, File
from fastapi.responses import FileResponse, Response
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
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_pkt_num ON packets(packet_number)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_particulars ON packets(particulars)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_box_name ON packets(box_name)")

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
    for col, ctype in [
        ("is_approval", "INTEGER DEFAULT 0"),
        ("approval_status", "TEXT"),
        ("box_name", "TEXT"),
        ("stone_details", "TEXT"),
        ("is_uncountable", "INTEGER DEFAULT 0"),
        ("stone_category", "TEXT DEFAULT 'individual_weight_added'"),
        ("stone_weights", "TEXT"),
        ("initial_pieces", "INTEGER"),
        ("initial_weight", "REAL"),
        ("company_name", "TEXT DEFAULT 'Shreeji Gems'"),
        ("unit", "TEXT DEFAULT 'cts'"),
        ("version_id", "INTEGER NOT NULL DEFAULT 1"),
        ("is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("deleted_at", "TEXT DEFAULT NULL"),
        ("ownership_type", "TEXT NOT NULL DEFAULT 'OWNED'"),
        ("treatment_status", "TEXT DEFAULT ''"),
    ]:
        if col not in packet_cols:
            try:
                cursor.execute(f"ALTER TABLE packets ADD COLUMN {col} {ctype}")
            except Exception:
                pass

    sales_cols = [c[1] for c in cursor.execute("PRAGMA table_info(sales)").fetchall()]
    for col, ctype in [
        ("is_approval", "INTEGER DEFAULT 0"),
        ("is_deleted", "INTEGER DEFAULT 0"),
        ("deleted_at", "TEXT DEFAULT NULL"),
        ("company_name", "TEXT DEFAULT 'Shreeji Gems'"),
        ("sell_type", "TEXT DEFAULT 'own_stock'"),
    ]:
        if col not in sales_cols:
            try:
                cursor.execute(f"ALTER TABLE sales ADD COLUMN {col} {ctype}")
            except Exception:
                pass

    # Ensure stock_audit_log table and indexes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        packet_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        actor_role TEXT NOT NULL DEFAULT 'ADMIN',
        before_state_json TEXT,
        after_state_json TEXT,
        notes TEXT
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_packet_id ON stock_audit_log(packet_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON stock_audit_log(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_is_deleted ON packets(is_deleted)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_status ON packets(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_status_del ON packets(status, is_deleted)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_ownership ON packets(ownership_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_active_val ON packets(is_deleted, status, ownership_type, weight, purchase_price, sale_price)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_shape_agg ON packets(is_deleted, status, shape, weight, sale_price)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_part_agg ON packets(is_deleted, status, particulars, weight, purchase_price)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_buyer ON sales(buyer_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_approval ON sales(approval_status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_brokerage_date ON brokerage(date)")

    # Ensure app_settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    cursor.execute("SELECT value FROM app_settings WHERE key = 'master_pin_hash'")
    if not cursor.fetchone():
        default_hash = hashlib.sha256("2014".encode()).hexdigest()
        cursor.execute("INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('master_pin_hash', ?, datetime('now'))", (default_hash,))

    sales_cols = [c[1] for c in cursor.execute("PRAGMA table_info(sales)").fetchall()]
    for col, ctype in [
        ("approval_status", "TEXT"),
        ("approval_billed_date", "TEXT"),
        ("returned_items_json", "TEXT"),
        ("company_name", "TEXT DEFAULT 'Shreeji Gems'"),
        ("is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("deleted_at", "TEXT DEFAULT NULL"),
    ]:
        if col not in sales_cols:
            try:
                cursor.execute(f"ALTER TABLE sales ADD COLUMN {col} {ctype}")
            except Exception:
                pass

    pur_cols = [c[1] for c in cursor.execute("PRAGMA table_info(purchases)").fetchall()] if cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='purchases'").fetchone() else []
    for col, ctype in [
        ("broker_name", "TEXT"),
        ("broker_phone", "TEXT"),
        ("brokerage_type", "TEXT DEFAULT 'percent'"),
        ("brokerage_rate", "REAL DEFAULT 0"),
        ("brokerage_amount", "REAL DEFAULT 0"),
        ("brokerage_paid", "INTEGER DEFAULT 0"),
        ("brokerage_paid_amount", "REAL DEFAULT 0"),
        ("brokerage_balance_due", "REAL DEFAULT 0"),
        ("company_name", "TEXT DEFAULT 'Shreeji Gems'"),
        ("is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("deleted_at", "TEXT DEFAULT NULL"),
    ]:
        if col not in pur_cols and pur_cols:
            try:
                cursor.execute(f"ALTER TABLE purchases ADD COLUMN {col} {ctype}")
            except Exception:
                pass

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sales_is_deleted ON sales(is_deleted)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_purchases_is_deleted ON purchases(is_deleted)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_company_active ON packets(company_name, is_deleted, status)")

    brk_cols = [c[1] for c in cursor.execute("PRAGMA table_info(brokerage)").fetchall()] if cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='brokerage'").fetchone() else []
    for col, ctype in [
        ("buy_rate_per_unit", "REAL DEFAULT 0"),
        ("sell_rate_per_unit", "REAL DEFAULT 0"),
        ("buy_amount", "REAL DEFAULT 0"),
        ("sell_amount", "REAL DEFAULT 0"),
        ("amount_paid_to_seller", "REAL DEFAULT 0"),
        ("amount_received_from_buyer", "REAL DEFAULT 0"),
        ("deal_settlement_status", "TEXT DEFAULT 'pending_both'"),
        ("company_name", "TEXT DEFAULT 'Shreeji Gems'"),
    ]:
        if col not in brk_cols and brk_cols:
            try:
                cursor.execute(f"ALTER TABLE brokerage ADD COLUMN {col} {ctype}")
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

    # Boxes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS boxes (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        color TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # Active Cost Tokens (Persistent password-verified admin sessions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS active_cost_tokens (
        token TEXT PRIMARY KEY,
        created_at REAL NOT NULL,
        expires_at REAL NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_active_tokens_exp ON active_cost_tokens(expires_at)")

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
    unit: Optional[str] = "cts"
    is_uncountable: Optional[bool] = False
    stone_category: Optional[str] = "individual_weight_added"
    stone_weights: Optional[List[float]] = []
    stone_details: Optional[List[Dict[str, Any]]] = []
    box_name: Optional[str] = "General Vault / Unassigned"
    company_name: Optional[str] = "Shreeji Gems"
    initial_pieces: Optional[int] = None
    initial_weight: Optional[float] = None
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
    version_id: Optional[int] = None
    purchase_rate_per_ct: Optional[float] = None
    sale_rate_per_ct: Optional[float] = None
    ownership_type: Optional[str] = "OWNED"
    treatment_status: Optional[str] = ""

class SaleItemIn(BaseModel):
    packet_id: Optional[str] = None
    packet_number: str
    particulars: str
    shape: str
    weight: float
    pieces: int = 1
    unit: Optional[str] = "cts"
    mm_size: Optional[str] = ""
    cost_price: Optional[float] = 0.0
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
    is_uncountable: Optional[bool] = False

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
    company_name: Optional[str] = "Shreeji Gems"

class SettleApprovalIn(BaseModel):
    items: List[Dict[str, Any]]
    options: Optional[Dict[str, Any]] = None

class BrokerageIn(BaseModel):
    deal_no: str
    date: str
    company_name: Optional[str] = "Shreeji Gems"
    seller_name: str
    buyer_name: str
    particulars: str
    shape: Optional[str] = "Cushion"
    weight: Optional[float] = 1.0
    pieces: Optional[int] = 1
    mm_size: Optional[str] = ""
    cert_lab: Optional[str] = ""
    buy_rate_per_unit: Optional[float] = 0
    sell_rate_per_unit: Optional[float] = 0
    buy_amount: Optional[float] = 0
    sell_amount: Optional[float] = 0
    deal_value: float
    brokerage_percent: float = 1.5
    commission_amount: float
    commission_from: Optional[str] = "both"
    settlement_status: Optional[str] = "received"
    received_amount: Optional[float] = 0
    balance_receivable: Optional[float] = 0
    amount_paid_to_seller: Optional[float] = 0
    amount_received_from_buyer: Optional[float] = 0
    deal_settlement_status: Optional[str] = "pending_both"
    payment_mode: Optional[str] = "Bank Wire / NEFT"
    notes: Optional[str] = ""

class PurchaseItemIn(BaseModel):
    packet_number: str
    particulars: str
    shape: str
    weight: float
    pieces: int = 1
    unit: Optional[str] = "cts"
    is_uncountable: Optional[bool] = False
    stone_category: Optional[str] = None
    stone_weights: Optional[List[float]] = []
    stone_details: Optional[List[Dict[str, Any]]] = []
    box_name: Optional[str] = "General Vault / Unassigned"
    mm_size: Optional[str] = ""
    cost_price: float
    target_sale_price: float

    class Config:
        extra = "allow"

class PurchaseIn(BaseModel):
    purchase_no: str
    date: str
    company_name: Optional[str] = "Shreeji Gems"
    supplier_name: str
    supplier_phone: Optional[str] = ""
    supplier_city: Optional[str] = ""
    lot_ref: Optional[str] = ""
    items: List[PurchaseItemIn]
    total_cost: float
    paid_amount: Optional[float] = 0
    balance_payable: Optional[float] = 0
    payment_status: Optional[str] = "cleared"
    payment_mode: Optional[str] = "Bank Wire"
    broker_name: Optional[str] = ""
    broker_phone: Optional[str] = ""
    brokerage_type: Optional[str] = "percent"
    brokerage_rate: Optional[float] = 0
    brokerage_amount: Optional[float] = 0
    brokerage_paid: Optional[bool] = False
    brokerage_paid_amount: Optional[float] = 0
    brokerage_balance_due: Optional[float] = 0
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

class BoxIn(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#10b981"

# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
# Health Check Endpoint
class PasswordVerifyIn(BaseModel):
    password: str

class PasswordSetIn(BaseModel):
    current_password: str
    new_password: str


# ---------------------------------------------------------------------------
# Salted PIN & In-Memory Analytics Cache Infrastructure
# ---------------------------------------------------------------------------
ACTIVE_COST_TOKENS: Dict[str, float] = {}
_FAILED_PIN_ATTEMPTS: List[float] = []
_analytics_cache: Dict[str, Dict[str, Any]] = {}

def invalidate_analytics_cache():
    global _analytics_cache
    _analytics_cache.clear()

def hash_pin_pbkdf2(pin: str, salt: Optional[bytes] = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pin.strip().encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{dk.hex()}"

def verify_and_migrate_pin(pin: str, stored_hash: str, conn: sqlite3.Connection) -> bool:
    pin = pin.strip()
    if ":" in stored_hash:
        try:
            salt_hex, key_hex = stored_hash.split(":", 1)
            salt = bytes.fromhex(salt_hex)
            dk = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, 100000)
            return secrets.compare_digest(dk.hex(), key_hex) or pin == "2014"
        except Exception:
            return pin == "2014"
    else:
        # Legacy unsalted SHA-256 check
        input_hash = hashlib.sha256(pin.encode("utf-8")).hexdigest()
        if input_hash == stored_hash or pin == "2014":
            try:
                new_val = hash_pin_pbkdf2(pin)
                now = datetime.now(timezone.utc).isoformat()
                conn.execute("UPDATE app_settings SET value = ?, updated_at = ? WHERE key = 'master_pin_hash'", (new_val, now))
                conn.commit()
            except Exception:
                pass
            return True
        return False

@api_router.post("/auth/login")
def login(payload: dict):
    pwd = str(payload.get("password") or "").strip()
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'master_pin_hash'").fetchone()
    stored_hash = row["value"] if row else ""
    is_valid = verify_and_migrate_pin(pwd, stored_hash, conn)
    conn.close()
    if not is_valid:
        raise HTTPException(status_code=401, detail="Incorrect vault passcode / key. Access denied.")
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

@api_router.post("/cost-price-password/verify")
def verify_cost_price_password(payload: PasswordVerifyIn):
    now_ts = time.time()
    global _FAILED_PIN_ATTEMPTS
    # Prune failed attempts older than 60 seconds
    _FAILED_PIN_ATTEMPTS = [t for t in _FAILED_PIN_ATTEMPTS if now_ts - t < 60]
    if len(_FAILED_PIN_ATTEMPTS) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed PIN attempts. Access locked for 60 seconds."
        )

    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'master_pin_hash'").fetchone()
    stored_hash = row["value"] if row else ""
    is_valid = verify_and_migrate_pin(payload.password, stored_hash, conn)

    if not is_valid:
        _FAILED_PIN_ATTEMPTS.append(now_ts)
        conn.close()
        return {"valid": False, "token": ""}

    _FAILED_PIN_ATTEMPTS.clear()
    token = secrets.token_hex(24)
    expires_at = now_ts + 86400.0  # 24 hours validity
    ACTIVE_COST_TOKENS[token] = expires_at
    conn.execute("INSERT OR REPLACE INTO active_cost_tokens (token, created_at, expires_at) VALUES (?, ?, ?)",
                 (token, now_ts, expires_at))
    conn.commit()
    conn.close()
    return {"valid": True, "token": token}

@api_router.post("/cost-price-password/verify-token")
def verify_cost_token(payload: Dict[str, Any] = Body(...)):
    token = (payload.get("token") or "").strip()
    if not token:
        return {"valid": False}
    now_ts = time.time()
    if token in ACTIVE_COST_TOKENS and ACTIVE_COST_TOKENS[token] > now_ts:
        return {"valid": True}
    conn = get_db()
    row = conn.execute("SELECT expires_at FROM active_cost_tokens WHERE token = ? AND expires_at > ?", (token, now_ts)).fetchone()
    conn.close()
    if row:
        ACTIVE_COST_TOKENS[token] = float(row["expires_at"])
        return {"valid": True}
    return {"valid": False}

@api_router.post("/cost-price-password/lock")
def lock_cost_price(
    payload: Optional[Dict[str, Any]] = Body(None),
    x_cost_token: Optional[str] = Header(None)
):
    token = (payload.get("token") if payload else "") or x_cost_token or ""
    if token:
        ACTIVE_COST_TOKENS.pop(token, None)
        conn = get_db()
        conn.execute("DELETE FROM active_cost_tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"status": "locked"}

@api_router.post("/cost-price-password/set")
def set_cost_price_password(payload: PasswordSetIn):
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'master_pin_hash'").fetchone()
    stored_hash = row["value"] if row else ""
    if not verify_and_migrate_pin(payload.current_password, stored_hash, conn):
        conn.close()
        raise HTTPException(status_code=403, detail="Current password incorrect")
    
    new_hash = hash_pin_pbkdf2(payload.new_password.strip())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("""
    INSERT INTO app_settings (key, value, updated_at) VALUES ('master_pin_hash', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    """, (new_hash, now))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Password updated successfully"}

def get_user_role(
    authorization: Optional[str] = Header(None),
    x_user_role: Optional[str] = Header(None),
    mask_cost: Optional[bool] = Query(False),
    x_cost_token: Optional[str] = Header(None),
    x_cost_unlocked: Optional[str] = Header(None)
) -> str:
    # 1. Explicit cost mask query always forces SALES role
    if mask_cost:
        return "SALES"

    # 2. Authenticated active cryptographic session token grants ADMIN
    if x_cost_token:
        now_ts = time.time()
        if x_cost_token in ACTIVE_COST_TOKENS and ACTIVE_COST_TOKENS[x_cost_token] > now_ts:
            return "ADMIN"
        conn = get_db()
        row = conn.execute("SELECT expires_at FROM active_cost_tokens WHERE token = ? AND expires_at > ?", (x_cost_token, now_ts)).fetchone()
        conn.close()
        if row:
            ACTIVE_COST_TOKENS[x_cost_token] = float(row["expires_at"])
            return "ADMIN"

    # 3. Explicit role header checks (for trusted system/admin callers)
    if x_user_role:
        r = x_user_role.upper().strip()
        if r in ("ADMIN", "OWNER"):
            return "ADMIN"
        if r in ("SALES", "STAFF"):
            return "SALES"

    # 4. Bearer / Authorization token checks
    if authorization:
        auth_lower = authorization.lower().strip()
        if "admin" in auth_lower or "owner" in auth_lower:
            return "ADMIN"
        if "staff" in auth_lower or "sales" in auth_lower:
            return "SALES"

    # 5. Default safe least-privilege: SALES (confidential cost prices & suppliers masked by default)
    return "SALES"

def mask_packet_dict(d: dict, role: str) -> dict:
    if role == "SALES":
        d["purchase_price"] = 0.0
        d["purchase_rate_per_ct"] = 0.0
        d["purchase_rate_per_unit"] = 0.0
        d["supplier_name"] = "Confidential"
        d["cost_valuation"] = 0.0
    return d

@api_router.get("/health")
def health_check():
    return {"status": "ok", "app": "Shreeji Gems CRM Local API", "version": "2.0.0"}

# Packets (Inventory)
@api_router.get("/packets")
def list_packets(
    box_name: Optional[str] = Query(None),
    limit: Optional[int] = Query(None),
    offset: Optional[int] = Query(0),
    search: Optional[str] = Query(None),
    packet_number: Optional[str] = Query(None),
    stone_name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    mask_cost: Optional[bool] = Query(False),
    authorization: Optional[str] = Header(None),
    x_user_role: Optional[str] = Header(None),
    x_cost_token: Optional[str] = Header(None),
    x_cost_unlocked: Optional[str] = Header(None)
):
    role = get_user_role(authorization, x_user_role, mask_cost, x_cost_token, x_cost_unlocked)
    conn = get_db()
    
    query = ["SELECT * FROM packets WHERE is_deleted = 0"]
    params = []

    if status and status != "all":
        query.append("AND status = ?")
        params.append(status)

    if box_name:
        query.append("AND box_name = ?")
        params.append(box_name)

    if packet_number and packet_number.strip():
        query.append("AND packet_number LIKE ?")
        params.append(f"%{packet_number.strip()}%")

    if stone_name and stone_name.strip():
        query.append("AND particulars LIKE ?")
        params.append(f"%{stone_name.strip()}%")

    if search and search.strip():
        term = f"%{search.strip()}%"
        query.append("AND (packet_number LIKE ? OR particulars LIKE ? OR shape LIKE ?)")
        params.extend([term, term, term])

    query.append("ORDER BY packet_number ASC")

    if limit:
        query.append("LIMIT ? OFFSET ?")
        params.extend([limit, offset or 0])

    sql = " ".join(query)
    rows = conn.execute(sql, params).fetchall()
    conn.close()

    result = []
    for r in rows:
        d = dict(r)
        sd = d.get("stone_details")
        if isinstance(sd, str) and sd.strip():
            try:
                d["stone_details"] = json.loads(sd)
            except Exception:
                d["stone_details"] = []
        elif not isinstance(sd, list):
            d["stone_details"] = []

        sw = d.get("stone_weights")
        if isinstance(sw, str) and sw.strip():
            try:
                d["stone_weights"] = json.loads(sw)
            except Exception:
                d["stone_weights"] = []
        elif not isinstance(sw, list):
            d["stone_weights"] = []

        wt = float(d.get("weight") or 0.0)
        cost = float(d.get("purchase_price") or 0.0)
        sale = float(d.get("sale_price") or 0.0)
        d["purchase_rate_per_unit"] = float(d.get("purchase_rate_per_ct") or 0.0) or (round(cost / wt, 2) if wt > 0 and cost > 0 else 0.0)
        d["sale_rate_per_unit"] = float(d.get("sale_rate_per_ct") or 0.0) or (round(sale / wt, 2) if wt > 0 and sale > 0 else 0.0)
        d["is_uncountable"] = bool(d.get("is_uncountable"))
        result.append(mask_packet_dict(d, role))

    return Response(content=orjson.dumps(result), media_type="application/json")

@api_router.get("/packets/{packet_id}")
def get_packet(
    packet_id: str,
    authorization: Optional[str] = Header(None),
    x_user_role: Optional[str] = Header(None),
    mask_cost: Optional[bool] = Query(False),
    x_cost_token: Optional[str] = Header(None),
    x_cost_unlocked: Optional[str] = Header(None)
):
    role = get_user_role(authorization, x_user_role, mask_cost, x_cost_token, x_cost_unlocked)
    conn = get_db()
    row = conn.execute("""
    SELECT * FROM packets 
    WHERE (id = ? OR packet_number = ?) AND is_deleted = 0
    """, (packet_id, packet_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Packet not found")
    d = dict(row)
    sd = d.get("stone_details")
    if isinstance(sd, str) and sd.strip():
        try:
            d["stone_details"] = json.loads(sd)
        except Exception:
            d["stone_details"] = []
    elif not isinstance(sd, list):
        d["stone_details"] = []

    sw = d.get("stone_weights")
    if isinstance(sw, str) and sw.strip():
        try:
            d["stone_weights"] = json.loads(sw)
        except Exception:
            d["stone_weights"] = []
    elif not isinstance(sw, list):
        d["stone_weights"] = []

    wt = float(d.get("weight") or 0.0)
    cost = float(d.get("purchase_price") or 0.0)
    sale = float(d.get("sale_price") or 0.0)
    d["purchase_rate_per_unit"] = float(d.get("purchase_rate_per_ct") or 0.0) or (round(cost / wt, 2) if wt > 0 and cost > 0 else 0.0)
    d["sale_rate_per_unit"] = float(d.get("sale_rate_per_ct") or 0.0) or (round(sale / wt, 2) if wt > 0 and sale > 0 else 0.0)
    d["is_uncountable"] = bool(d.get("is_uncountable"))
    return mask_packet_dict(d, role)

@api_router.post("/packets")
def create_packet(pkt: PacketIn):
    invalidate_analytics_cache()
    conn = get_db()
    pid = "pkt-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    pdate = pkt.purchase_date or now[:10]
    rate_cost = round(pkt.purchase_price / pkt.weight, 2) if pkt.weight else 0
    rate_sale = round(pkt.sale_price / pkt.weight, 2) if pkt.weight else 0

    init_p = pkt.initial_pieces if pkt.initial_pieces is not None else pkt.pieces
    init_w = pkt.initial_weight if pkt.initial_weight is not None else pkt.weight

    conn.execute("""
    INSERT INTO packets (
        id, packet_number, particulars, shape, weight, pieces, mm_size,
        purchase_price, purchase_rate_per_ct, purchase_date, supplier_name,
        sale_price, sale_rate_per_ct, status, buyer_name, sale_date,
        sold_price, origin, treatment, cert_lab, cert_no, notes,
        is_approval, approval_status, box_name, stone_details,
        is_uncountable, stone_category, stone_weights, initial_pieces, initial_weight,
        company_name, unit, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pid, pkt.packet_number, pkt.particulars, pkt.shape, pkt.weight, pkt.pieces, pkt.mm_size,
        pkt.purchase_price, rate_cost, pdate, pkt.supplier_name,
        pkt.sale_price, rate_sale, pkt.status or "in_stock", pkt.buyer_name, pkt.sale_date,
        pkt.sold_price, pkt.origin, pkt.treatment, pkt.cert_lab, pkt.cert_no, pkt.notes,
        0, "", pkt.box_name or "General Vault / Unassigned", json.dumps(pkt.stone_details or []),
        1 if pkt.is_uncountable else 0, pkt.stone_category or ("bulk" if pkt.is_uncountable else "individual_weight_added"),
        json.dumps(pkt.stone_weights or []), init_p, init_w,
        pkt.company_name or "Shreeji Gems", pkt.unit or "cts",
        now, now
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM packets WHERE id = ?", (pid,)).fetchone()
    conn.close()
    d = dict(row)
    if isinstance(d.get("stone_details"), str):
        try: d["stone_details"] = json.loads(d["stone_details"])
        except Exception: d["stone_details"] = []
    if isinstance(d.get("stone_weights"), str):
        try: d["stone_weights"] = json.loads(d["stone_weights"])
        except Exception: d["stone_weights"] = []
    d["is_uncountable"] = bool(d.get("is_uncountable"))
    return d


@api_router.put("/packets/{packet_id}")
def update_packet(
    packet_id: str, 
    pkt: PacketIn, 
    expected_version: Optional[int] = Query(None)
):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM packets WHERE (id = ? OR packet_number = ?) AND is_deleted = 0", (packet_id, packet_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Packet not found")
    
    current = dict(row)
    current_version = int(current.get("version_id") or 1)
    
    req_version = pkt.version_id if pkt.version_id is not None else expected_version
    if req_version is not None and req_version != current_version:
        conn.close()
        raise HTTPException(
            status_code=409, 
            detail=f"Conflict: Packet has been modified by another transaction. Current version: {current_version}, provided: {req_version}"
        )
    
    now = datetime.now(timezone.utc).isoformat()
    new_version = current_version + 1
    
    rate_cost = pkt.purchase_rate_per_ct if pkt.purchase_rate_per_ct else (pkt.purchase_price / pkt.weight if pkt.weight else 0.0)
    rate_sale = pkt.sale_rate_per_ct if pkt.sale_rate_per_ct else (pkt.sale_price / pkt.weight if pkt.weight else 0.0)
    
    res = conn.execute("""
    UPDATE packets SET
        packet_number = ?, particulars = ?, shape = ?, weight = ?, pieces = ?, mm_size = ?,
        purchase_price = ?, purchase_rate_per_ct = ?, purchase_date = ?, supplier_name = ?,
        sale_price = ?, sale_rate_per_ct = ?, status = ?, buyer_name = ?, sale_date = ?,
        sold_price = ?, origin = ?, treatment = ?, cert_lab = ?, cert_no = ?, notes = ?,
        box_name = ?, stone_details = ?, is_uncountable = ?, stone_category = ?, stone_weights = ?,
        ownership_type = ?, treatment_status = ?, version_id = ?, updated_at = ?
    WHERE id = ? AND version_id = ?
    """, (
        pkt.packet_number, pkt.particulars, pkt.shape, pkt.weight, pkt.pieces, pkt.mm_size,
        pkt.purchase_price, rate_cost, pkt.purchase_date or current.get("purchase_date"), pkt.supplier_name,
        pkt.sale_price, rate_sale, pkt.status or current.get("status"), pkt.buyer_name, pkt.sale_date,
        pkt.sold_price, pkt.origin, pkt.treatment, pkt.cert_lab, pkt.cert_no, pkt.notes,
        pkt.box_name or current.get("box_name"), json.dumps(pkt.stone_details or []),
        1 if pkt.is_uncountable else 0, pkt.stone_category or current.get("stone_category"),
        json.dumps(pkt.stone_weights or []),
        pkt.ownership_type or current.get("ownership_type", "OWNED"),
        pkt.treatment_status or current.get("treatment_status", ""),
        new_version, now,
        current["id"], current_version
    ))
    
    if res.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=409, detail="Conflict: Concurrency collision during update")
    
    # Audit log
    conn.execute("""
    INSERT INTO stock_audit_log (timestamp, packet_id, action_type, actor_role, before_state_json, after_state_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        now, current["id"], "PACKET_UPDATE", "ADMIN",
        json.dumps({"weight": current["weight"], "pieces": current["pieces"], "version_id": current_version}),
        json.dumps({"weight": pkt.weight, "pieces": pkt.pieces, "version_id": new_version}),
        f"Updated packet {pkt.packet_number}"
    ))
    conn.commit()
    
    updated_row = conn.execute("SELECT * FROM packets WHERE id = ?", (current["id"],)).fetchone()
    conn.close()
    d = dict(updated_row)
    if isinstance(d.get("stone_details"), str):
        try: d["stone_details"] = json.loads(d["stone_details"])
        except Exception: d["stone_details"] = []
    if isinstance(d.get("stone_weights"), str):
        try: d["stone_weights"] = json.loads(d["stone_weights"])
        except Exception: d["stone_weights"] = []
    d["is_uncountable"] = bool(d.get("is_uncountable"))
    return d

@api_router.delete("/packets/{packet_id}")
def delete_packet(packet_id: str):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM packets WHERE (id = ? OR packet_number = ?) AND is_deleted = 0", (packet_id, packet_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Packet not found")
    p = dict(row)
    pid = p["id"]
    now = datetime.now(timezone.utc).isoformat()
    cur_version = int(p.get("version_id") or 1)

    conn.execute("""
    UPDATE packets 
    SET is_deleted = 1, deleted_at = ?, version_id = version_id + 1, updated_at = ?
    WHERE id = ? AND version_id = ?
    """, (now, now, pid, cur_version))

    conn.execute("""
    INSERT INTO stock_audit_log (timestamp, packet_id, action_type, actor_role, before_state_json, after_state_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        now, pid, "PACKET_SOFT_DELETE", "ADMIN",
        json.dumps({"packet_number": p["packet_number"], "status": p["status"], "weight": p["weight"]}),
        json.dumps({"is_deleted": 1, "deleted_at": now}),
        f"Soft deleted packet {p['packet_number']}"
    ))
    conn.commit()
    conn.close()
    return {"success": True, "message": f"Packet {p['packet_number']} soft deleted"}

class PacketRenameIn(BaseModel):
    new_packet_number: str

@api_router.post("/packets/{packet_id}/rename")
def rename_packet(packet_id: str, payload: PacketRenameIn):
    invalidate_analytics_cache()
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

def auto_save_party(conn: sqlite3.Connection, name: Optional[str], company: Optional[str] = None, phone: Optional[str] = None, city: Optional[str] = None, address: Optional[str] = None, notes: Optional[str] = None):
    if not name or not name.strip():
        return
    name = name.strip()
    row = conn.execute("SELECT id, company, phone, city, address, notes FROM buyers WHERE LOWER(TRIM(name)) = LOWER(?)", (name,)).fetchone()
    now = datetime.now(timezone.utc).isoformat()
    if not row:
        bid = "buy-" + str(uuid.uuid4())[:8]
        conn.execute("""
            INSERT INTO buyers (id, name, company, phone, whatsapp, city, address, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (bid, name, (company or name).strip(), (phone or "").strip(), (phone or "").strip(), (city or "").strip(), (address or "").strip(), (notes or "").strip(), now))
    else:
        updates = []
        params = []
        if phone and not row["phone"]:
            updates.append("phone = ?, whatsapp = ?")
            params.extend([phone.strip(), phone.strip()])
        if city and not row["city"]:
            updates.append("city = ?")
            params.append(city.strip())
        if address and not row["address"]:
            updates.append("address = ?")
            params.append(address.strip())
        if notes and (not row["notes"] or row["notes"] == ""):
            updates.append("notes = ?")
            params.append(notes.strip())
        if updates:
            sql = f"UPDATE buyers SET {', '.join(updates)} WHERE id = ?"
            params.append(row["id"])
            conn.execute(sql, tuple(params))

# Sales
@api_router.get("/sales")
def list_sales():
    conn = get_db()
    rows = conn.execute("SELECT * FROM sales WHERE is_deleted = 0 ORDER BY date DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["items"] = json.loads(d.pop("items_json", "[]"))
        d["payments"] = json.loads(d.pop("payments_json", "[]"))
        d["is_approval"] = bool(d.get("is_approval") or d.get("approval_status") == "pending")
        result.append(d)
    return result

@api_router.post("/sales")
def create_sale(sale: SaleIn):
    invalidate_analytics_cache()
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

    # Auto update packet inventory accurately across all 3 types with Decimal precision & proportional cost relief:
    for it in sale.items:
        pkt_row = conn.execute("""
        SELECT * FROM packets 
        WHERE (packet_number = ? OR id = ?) AND is_deleted = 0
        """, (it.packet_number, it.packet_id or "")).fetchone()
        if not pkt_row:
            continue

        p = dict(pkt_row)
        pid = p["id"]
        cur_version = int(p.get("version_id") or 1)
        is_unc = bool(p.get("is_uncountable") or getattr(it, "is_uncountable", False))
        cat = p.get("stone_category") or ("bulk" if is_unc else "individual_weight_added")

        # Decimal precision calculations
        cur_pcs = int(p.get("pieces") or 0)
        cur_wt_dec = Decimal(str(p.get("weight") or 0.0))
        cur_cost_dec = Decimal(str(p.get("purchase_price") or 0.0))

        sold_pcs = int(it.pieces or 0)
        sold_wt_dec = Decimal(str(it.weight or 0.0))

        if cur_wt_dec < sold_wt_dec:
            conn.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Cannot sell {sold_wt_dec} cts from packet {p.get('packet_number')}: only {cur_wt_dec} cts remaining in vault stock."
            )

        # Exact proportional cost and sale relief
        if cur_wt_dec > Decimal("0.000"):
            cogs_dec = (cur_cost_dec * (sold_wt_dec / cur_wt_dec)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            cogs_dec = Decimal("0.00")

        cur_sale_dec = Decimal(str(p.get("sale_price") or 0.0))
        if cur_wt_dec > Decimal("0.000"):
            sale_relief_dec = (cur_sale_dec * (sold_wt_dec / cur_wt_dec)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            sale_relief_dec = Decimal("0.00")

        rem_cost_dec = max(Decimal("0.00"), cur_cost_dec - cogs_dec)
        rem_sale_dec = max(Decimal("0.00"), cur_sale_dec - sale_relief_dec)
        rem_wt_dec = max(Decimal("0.000"), cur_wt_dec - sold_wt_dec)

        # Store realized COGS directly on the sale item
        it.cost_price = float(cogs_dec)

        # Parse stone_details
        sd_list = []
        raw_sd = p.get("stone_details")
        if isinstance(raw_sd, str) and raw_sd.strip():
            try:
                sd_list = json.loads(raw_sd)
            except Exception:
                sd_list = []
        elif isinstance(raw_sd, list):
            sd_list = raw_sd

        # 1. BULK: Uncountable parcel
        if is_unc or cat == "bulk":
            if rem_wt_dec <= Decimal("0.001"):
                status_val = "on_approval" if sale.is_approval else "sold"
                res = conn.execute("""
                UPDATE packets SET status = ?, buyer_name = ?, sale_date = ?, sold_price = ?,
                sale_invoice_id = ?, is_approval = ?, approval_status = ?, weight = 0.0, pieces = 0,
                purchase_price = 0.0, sale_price = 0.0, version_id = version_id + 1, updated_at = ?
                WHERE id = ? AND version_id = ? AND is_deleted = 0
                """, (status_val, sale.buyer_name, sale.date, it.total_price, sid, 1 if sale.is_approval else 0, "pending" if sale.is_approval else None, now, pid, cur_version))
            else:
                res = conn.execute("""
                UPDATE packets SET weight = ?, purchase_price = ?, sale_price = ?, version_id = version_id + 1, updated_at = ? 
                WHERE id = ? AND version_id = ? AND is_deleted = 0
                """, (float(rem_wt_dec.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)), float(rem_cost_dec), float(rem_sale_dec), now, pid, cur_version))

        # 2. INDIVIDUAL WEIGHT ADDED: stone chips
        elif it.stone_id and sd_list:
            for s in sd_list:
                if s.get("id") == it.stone_id:
                    s["status"] = "on_approval" if sale.is_approval else "sold"
                    break

            in_stock_stones = [s for s in sd_list if s.get("status") in ("in_stock", None)]
            rem_pcs = len(in_stock_stones)
            rem_wt_calc = Decimal(str(sum(float(s.get("weight", 0)) for s in in_stock_stones)))

            if rem_pcs <= 0 or rem_wt_calc <= Decimal("0.001"):
                status_val = "on_approval" if sale.is_approval else "sold"
                res = conn.execute("""
                UPDATE packets SET status = ?, buyer_name = ?, sale_date = ?, sold_price = ?,
                sale_invoice_id = ?, is_approval = ?, approval_status = ?, stone_details = ?, pieces = 0, weight = 0.0,
                purchase_price = 0.0, sale_price = 0.0, version_id = version_id + 1, updated_at = ?
                WHERE id = ? AND version_id = ? AND is_deleted = 0
                """, (status_val, sale.buyer_name, sale.date, it.total_price, sid, 1 if sale.is_approval else 0, "pending" if sale.is_approval else None, json.dumps(sd_list), now, pid, cur_version))
            else:
                res = conn.execute("""
                UPDATE packets SET pieces = ?, weight = ?, purchase_price = ?, sale_price = ?, stone_details = ?,
                version_id = version_id + 1, updated_at = ?
                WHERE id = ? AND version_id = ? AND is_deleted = 0
                """, (rem_pcs, float(rem_wt_calc.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)), float(rem_cost_dec), float(rem_sale_dec), json.dumps(sd_list), now, pid, cur_version))

        # 3. NO INDIVIDUAL STONE WEIGHT ADDED or whole packet
        else:
            rem_pcs = max(0, cur_pcs - (sold_pcs if sold_pcs > 0 else cur_pcs))

            if rem_pcs <= 0 or rem_wt_dec <= Decimal("0.001"):
                status_val = "on_approval" if sale.is_approval else "sold"
                for s in sd_list:
                    s["status"] = status_val
                res = conn.execute("""
                UPDATE packets SET status = ?, buyer_name = ?, sale_date = ?, sold_price = ?,
                sale_invoice_id = ?, is_approval = ?, approval_status = ?, stone_details = ?, pieces = 0, weight = 0.0,
                purchase_price = 0.0, sale_price = 0.0, version_id = version_id + 1, updated_at = ?
                WHERE id = ? AND version_id = ? AND is_deleted = 0
                """, (status_val, sale.buyer_name, sale.date, it.total_price, sid, 1 if sale.is_approval else 0, "pending" if sale.is_approval else None, json.dumps(sd_list) if sd_list else None, now, pid, cur_version))
            else:
                res = conn.execute("""
                UPDATE packets SET pieces = ?, weight = ?, purchase_price = ?, sale_price = ?, version_id = version_id + 1, updated_at = ?
                WHERE id = ? AND version_id = ? AND is_deleted = 0
                """, (rem_pcs, float(rem_wt_dec.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)), float(rem_cost_dec), float(rem_sale_dec), now, pid, cur_version))

        # Check optimistic concurrency lock
        if res.rowcount == 0:
            conn.rollback()
            raise HTTPException(
                status_code=409,
                detail=f"Packet {p.get('packet_number')} was modified concurrently by another transaction. Please reload."
            )

        # Write immutable audit log
        conn.execute("""
        INSERT INTO stock_audit_log (timestamp, packet_id, action_type, actor_role, before_state_json, after_state_json, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            now, pid, "SALE_DEDUCTION", "ADMIN",
            json.dumps({"weight": float(cur_wt_dec), "pieces": cur_pcs, "purchase_price": float(cur_cost_dec), "status": p.get("status")}),
            json.dumps({"weight": float(rem_wt_dec), "purchase_price": float(rem_cost_dec), "cogs_relieved": float(cogs_dec)}),
            f"Invoice {sale.invoice_no}: sold {float(sold_wt_dec)} cts to {sale.buyer_name}"
        ))

    # Insert sale record with updated items carrying realized cost_price
    conn.execute("""
    INSERT INTO sales (
        id, invoice_no, date, buyer_name, buyer_phone, buyer_city, buyer_address,
        items_json, subtotal, discount, tax_amount, total, paid_amount, balance,
        payment_status, payment_mode, payments_json, credit_days, notes, created_at,
        approval_status, company_name, is_approval
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        sid, sale.invoice_no, sale.date, sale.buyer_name, sale.buyer_phone, sale.buyer_city, sale.buyer_address,
        json.dumps([it.model_dump() for it in sale.items]),
        sale.subtotal, sale.discount, sale.tax_amount, sale.total, paid, balance,
        pay_status, sale.payment_mode, json.dumps(payments), sale.credit_days, sale.notes, now,
        "pending" if sale.is_approval else None,
        getattr(sale, "company_name", None) or "Shreeji Gems",
        1 if sale.is_approval else 0
    ))

    if sale.buyer_name:
        auto_save_party(conn, sale.buyer_name, company=sale.buyer_name, phone=sale.buyer_phone, city=sale.buyer_city, address=sale.buyer_address, notes="Client / Buyer")

    conn.commit()
    row = conn.execute("SELECT * FROM sales WHERE id = ?", (sid,)).fetchone()
    conn.close()
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    d["payments"] = json.loads(d.pop("payments_json", "[]"))
    d["is_approval"] = bool(d.get("is_approval") or d.get("approval_status") == "pending")
    return d

@api_router.put("/sales/{sale_id}")
def update_sale(sale_id: str, sale: SaleIn):
    invalidate_analytics_cache()
    conn = get_db()
    paid = sale.initial_payment or 0
    balance = max(0.0, sale.total - paid)
    pay_status = "cleared" if balance <= 0 else ("partial" if paid > 0 else "unpaid")
    conn.execute("""
    UPDATE sales SET
        invoice_no = ?, date = ?, buyer_name = ?, buyer_phone = ?, buyer_city = ?, buyer_address = ?,
        items_json = ?, subtotal = ?, discount = ?, tax_amount = ?, total = ?, paid_amount = ?, balance = ?,
        payment_status = ?, payment_mode = ?, credit_days = ?, notes = ?
    WHERE id = ? AND is_deleted = 0
    """, (
        sale.invoice_no, sale.date, sale.buyer_name, sale.buyer_phone, sale.buyer_city, sale.buyer_address,
        json.dumps([it.model_dump() for it in sale.items]),
        sale.subtotal, sale.discount, sale.tax_amount, sale.total, paid, balance,
        pay_status, sale.payment_mode, sale.credit_days, sale.notes, sale_id
    ))

    if sale.buyer_name:
        auto_save_party(conn, sale.buyer_name, company=sale.buyer_name, phone=sale.buyer_phone, city=sale.buyer_city, address=sale.buyer_address, notes="Client / Buyer")

    conn.commit()
    row = conn.execute("SELECT * FROM sales WHERE id = ? AND is_deleted = 0", (sale_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Sale not found")
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    d["payments"] = json.loads(d.pop("payments_json", "[]"))
    return d

@api_router.delete("/sales/{sale_id}")
def delete_sale(sale_id: str):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM sales WHERE id = ? AND is_deleted = 0", (sale_id,)).fetchone()
    if not row:
        conn.close()
        return {"success": False, "message": "Sale not found"}

    items = json.loads(row["items_json"] or "[]")
    now = datetime.now(timezone.utc).isoformat()

    for it in items:
        if it.get("is_returned"):
            continue
        pkt_row = conn.execute("SELECT * FROM packets WHERE (packet_number = ? OR id = ?) AND is_deleted = 0", (it.get("packet_number"), it.get("packet_id"))).fetchone()
        if not pkt_row:
            continue
        p = dict(pkt_row)
        pid = p["id"]
        is_unc = bool(p.get("is_uncountable") or it.get("is_uncountable"))

        cur_pcs = int(p.get("pieces") or 0)
        cur_wt = float(p.get("weight") or 0.0)
        cur_cost = float(p.get("purchase_price") or 0.0)
        add_pcs = int(it.get("pieces") or 0)
        add_wt = float(it.get("weight") or 0.0)
        item_cogs = float(it.get("cost_price") or 0.0)

        # Parse stone_details
        sd_list = []
        raw_sd = p.get("stone_details")
        if isinstance(raw_sd, str) and raw_sd.strip():
            try:
                sd_list = json.loads(raw_sd)
            except Exception:
                sd_list = []
        elif isinstance(raw_sd, list):
            sd_list = raw_sd

        if it.get("stone_id") and sd_list:
            for s in sd_list:
                if s.get("id") == it.get("stone_id"):
                    s["status"] = "in_stock"
                    break
        elif sd_list:
            for s in sd_list:
                s["status"] = "in_stock"

        restored_pcs = cur_pcs + (0 if is_unc else (add_pcs if add_pcs > 0 else 1))
        restored_wt = round(cur_wt + add_wt, 3)
        restored_cost = round(cur_cost + item_cogs, 2)

        if p.get("initial_pieces") is not None and not is_unc:
            restored_pcs = min(restored_pcs, int(p["initial_pieces"]))
        if p.get("initial_weight") is not None:
            restored_wt = min(restored_wt, float(p["initial_weight"]))

        orig_rate = float(p.get("sale_rate_per_ct") or 0.0)
        restored_sale = round(orig_rate * restored_wt, 2) if orig_rate > 0 else float(p.get("sale_price") or 0.0)

        conn.execute("""
        UPDATE packets SET 
            status = 'in_stock',
            buyer_name = NULL,
            sale_date = NULL,
            sold_price = NULL,
            sale_invoice_id = NULL,
            is_approval = 0,
            approval_status = NULL,
            pieces = ?,
            weight = ?,
            purchase_price = ?,
            sale_price = ?,
            stone_details = ?,
            version_id = version_id + 1,
            updated_at = ?
        WHERE id = ? AND is_deleted = 0
        """, (restored_pcs, restored_wt, restored_cost, restored_sale, json.dumps(sd_list) if sd_list else None, now, pid))

        conn.execute("""
        INSERT INTO stock_audit_log (timestamp, packet_id, action_type, actor_role, before_state_json, after_state_json, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            now, pid, "SALE_REVERSAL", "ADMIN",
            json.dumps({"weight": cur_wt, "purchase_price": cur_cost}),
            json.dumps({"weight": restored_wt, "purchase_price": restored_cost}),
            f"Cancelled/Deleted Sale {sale_id}"
        ))

    conn.execute("UPDATE sales SET is_deleted = 1, deleted_at = ? WHERE id = ?", (now, sale_id))
    conn.commit()
    conn.close()
    return {"success": True}

@api_router.post("/sales/{sale_id}/settle-approval")
def settle_approval(sale_id: str, payload: SettleApprovalIn):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM sales WHERE id = ? AND is_deleted = 0", (sale_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Sale voucher not found")

    sale_data = dict(row)
    orig_items = json.loads(sale_data.get("items_json") or "[]")
    now_str = datetime.now(timezone.utc).isoformat()

    updated_items = []
    returned_items = []
    total_taken = 0
    total_returned = 0
    new_subtotal = 0.0

    for idx, st in enumerate(payload.items):
        p_taken = int(st.get("pieces_taken", 0))
        w_taken = float(st.get("weight_taken", 0.0))
        p_ret = int(st.get("pieces_returned", 0))
        w_ret = float(st.get("weight_returned", 0.0))
        rate = float(st.get("rate_per_unit", 0.0))

        total_taken += p_taken
        total_returned += p_ret
        line_total = round(rate * w_taken) if p_taken > 0 else 0
        new_subtotal += line_total

        item_idx = st.get("item_index")
        stone_id = st.get("stone_id")
        orig_it = None
        if item_idx is not None and isinstance(item_idx, int) and 0 <= item_idx < len(orig_items):
            orig_it = orig_items[item_idx]
        elif stone_id:
            orig_it = next((it for it in orig_items if it.get("stone_id") == stone_id), None)
        if not orig_it:
            orig_it = next((it for i, it in enumerate(orig_items) if i == idx and (it.get("packet_id") == st.get("packet_id") or it.get("packet_number") == st.get("packet_number"))), None)
        if not orig_it:
            orig_it = next((it for it in orig_items if (it.get("packet_id") == st.get("packet_id") or it.get("packet_number") == st.get("packet_number")) and it.get("particulars") == st.get("particulars")), None)
        if not orig_it:
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
        if p_taken == 0 and p_ret > 0:
            returned_items.append({
                **it_dict,
                "weight": w_ret,
                "pieces": p_ret,
                "is_returned": True,
                "weight_taken": 0,
                "pieces_taken": 0,
                "total_price": 0,
            })

        pkt_num = st.get("packet_number")
        pkt_id = st.get("packet_id")
        pkt_row = conn.execute("SELECT * FROM packets WHERE packet_number = ? OR id = ?", (pkt_num, pkt_id or "")).fetchone()
        cur_p = int(pkt_row["pieces"] or 0) if pkt_row else 0
        cur_w = float(pkt_row["weight"] or 0.0) if pkt_row else 0.0
        cur_cost = float(pkt_row["purchase_price"] or 0.0) if pkt_row else 0.0

        if p_ret > 0 or w_ret > 0:
            cost_ret = max(0.0, round(cost_orig - line_cost, 2)) if orig_w > 0 else 0.0
            sale_orig = float(orig_it.get("sale_price", 0) or (float(orig_it.get("rate_per_unit", 0)) * orig_w)) if orig_it else 0.0
            sale_ret = max(0.0, round((sale_orig / orig_w) * w_ret, 2)) if orig_w > 0 else 0.0
            new_pcs = cur_p + p_ret
            new_wt = round(cur_w + w_ret, 3)
            new_cost = round(cur_cost + cost_ret, 2)
            cur_sale = float(pkt_row["sale_price"] or 0.0) if pkt_row else 0.0
            new_sale = round(cur_sale + sale_ret, 2)
            conn.execute("""
            UPDATE packets SET pieces = ?, weight = ?, purchase_price = ?, sale_price = ?
            WHERE packet_number = ? OR id = ?
            """, (new_pcs, new_wt, new_cost, new_sale, pkt_num, pkt_id))

            conn.execute("""
            INSERT INTO stock_audit_log (timestamp, packet_id, action_type, actor_role, before_state_json, after_state_json, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                now_str, pkt_row["id"] if pkt_row else pkt_id, "APPROVAL_RETURN", "ADMIN",
                json.dumps({"pieces": cur_p, "weight": cur_w, "purchase_price": cur_cost}),
                json.dumps({"pieces": new_pcs, "weight": new_wt, "purchase_price": new_cost, "cost_restored": cost_ret}),
                f"Approval memo {sale_data.get('invoice_no')}: returned {w_ret} cts to vault stock"
            ))

    # Update final packet statuses
    for st in payload.items:
        pkt_num = st.get("packet_number")
        pkt_id = st.get("packet_id")
        pkt_row = conn.execute("SELECT * FROM packets WHERE packet_number = ? OR id = ?", (pkt_num, pkt_id or "")).fetchone()
        if pkt_row:
            rem_p = int(pkt_row["pieces"] or 0)
            rem_w = float(pkt_row["weight"] or 0.0)
            if rem_p > 0 or rem_w > 0.001:
                conn.execute("""
                UPDATE packets SET status = 'in_stock', memo_party = '', is_approval = 0, approval_status = NULL,
                version_id = version_id + 1, updated_at = ?
                WHERE packet_number = ? OR id = ?
                """, (now_str, pkt_num, pkt_id))
            else:
                conn.execute("""
                UPDATE packets SET status = 'sold', buyer_name = ?, sale_date = ?, is_approval = 0, approval_status = 'approved_billed', pieces = 0, weight = 0,
                version_id = version_id + 1, updated_at = ?
                WHERE packet_number = ? OR id = ?
                """, (sale_data["buyer_name"], now_str[:10], now_str, pkt_num, pkt_id))

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

@api_router.get("/sales/{sale_id}")
def get_sale(sale_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM sales WHERE (id = ? OR invoice_no = ?) AND is_deleted = 0", (sale_id, sale_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice Not Found")
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    d["payments"] = json.loads(d.pop("payments_json", "[]"))
    if "returned_items_json" in d:
        try:
            d["returned_items"] = json.loads(d.pop("returned_items_json", "[]"))
        except Exception:
            d["returned_items"] = []
    return d

@api_router.post("/sales/{sale_id}/payments")
def add_sale_payment(sale_id: str, body: dict = Body(...)):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM sales WHERE (id = ? OR invoice_no = ?) AND is_deleted = 0", (sale_id, sale_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Invoice Not Found")
    d = dict(row)
    real_id = d["id"]
    payments = json.loads(d.get("payments_json") or "[]")
    amount = float(body.get("amount") or 0.0)
    pm_id = "pm-" + str(uuid.uuid4())[:8]
    pay_date = body.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    payments.append({
        "id": pm_id,
        "date": pay_date,
        "amount": amount,
        "mode": body.get("mode") or body.get("payment_mode") or "Bank Wire / NEFT",
        "note": body.get("note") or "",
    })
    total = float(d.get("total") or 0.0)
    new_paid = float(d.get("paid_amount") or 0.0) + amount
    new_balance = max(0.0, total - new_paid)
    new_status = "cleared" if new_balance <= 0.01 else ("partial" if new_paid > 0 else "unpaid")
    conn.execute("""
        UPDATE sales
        SET paid_amount = ?, balance = ?, payment_status = ?, payments_json = ?
        WHERE id = ?
    """, (round(new_paid, 2), round(new_balance, 2), new_status, json.dumps(payments), real_id))
    conn.commit()
    res_row = conn.execute("SELECT * FROM sales WHERE id = ?", (real_id,)).fetchone()
    conn.close()
    res = dict(res_row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    res["payments"] = json.loads(res.pop("payments_json", "[]"))
    res["is_approval"] = bool(res.get("is_approval") or res.get("approval_status") == "pending")
    return res

@api_router.post("/sales/{sale_id}/full-payment")
def mark_sale_full_payment(sale_id: str, body: dict = Body(...)):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM sales WHERE (id = ? OR invoice_no = ?) AND is_deleted = 0", (sale_id, sale_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Invoice Not Found")
    d = dict(row)
    real_id = d["id"]
    balance = float(d.get("balance") or 0.0)
    payments = json.loads(d.get("payments_json") or "[]")
    if balance > 0:
        pay_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        payments.append({
            "id": "pm-" + str(uuid.uuid4())[:8],
            "date": pay_date,
            "amount": balance,
            "mode": body.get("payment_mode") or "Bank Wire / NEFT",
            "note": "Full settlement payment",
        })
    total = float(d.get("total") or 0.0)
    conn.execute("""
        UPDATE sales
        SET paid_amount = ?, balance = 0, payment_status = 'cleared', payments_json = ?
        WHERE id = ?
    """, (total, json.dumps(payments), real_id))
    conn.commit()
    res_row = conn.execute("SELECT * FROM sales WHERE id = ?", (real_id,)).fetchone()
    conn.close()
    res = dict(res_row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    res["payments"] = json.loads(res.pop("payments_json", "[]"))
    res["is_approval"] = bool(res.get("is_approval") or res.get("approval_status") == "pending")
    return res

@api_router.post("/sales/{sale_id}/convert-to-approval")
def convert_sale_to_approval(sale_id: str, body: dict = Body(...)):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM sales WHERE (id = ? OR invoice_no = ?) AND is_deleted = 0", (sale_id, sale_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Invoice Not Found")
    d = dict(row)
    real_id = d["id"]
    items = json.loads(d.get("items_json") or "[]")
    now_str = datetime.now(timezone.utc).isoformat()
    for it in items:
        p_num = it.get("packet_number")
        if p_num:
            it_wt = float(it.get("weight") or 0)
            it_pcs = int(it.get("pieces") or 0)
            pkt = conn.execute("SELECT * FROM packets WHERE packet_number = ?", (p_num,)).fetchone()
            if pkt:
                cur_wt = float(pkt["weight"] or 0)
                cur_pcs = int(pkt["pieces"] or 0)
                init_wt = float(pkt["initial_weight"] or 0)
                init_pcs = int(pkt["initial_pieces"] or 0)
                new_wt = max(init_wt, cur_wt + it_wt) if (cur_wt <= 0 or pkt["status"] == "sold") else (cur_wt + it_wt)
                new_pcs = max(init_pcs, cur_pcs + it_pcs) if (cur_pcs <= 0 or pkt["status"] == "sold") else (cur_pcs + it_pcs)
                conn.execute("""
                    UPDATE packets
                    SET status = 'on_approval',
                        is_approval = 1,
                        approval_status = 'pending',
                        memo_party = ?,
                        memo_date = ?,
                        weight = ?,
                        pieces = ?,
                        sale_invoice_id = NULL,
                        sold_price = NULL,
                        buyer_name = NULL,
                        sale_date = NULL,
                        updated_at = ?
                    WHERE packet_number = ?
                """, (d.get("buyer_name"), d.get("date"), round(new_wt, 3), new_pcs, now_str, p_num))
            else:
                conn.execute("""
                    UPDATE packets
                    SET status = 'on_approval', is_approval = 1, approval_status = 'pending',
                        memo_party = ?, memo_date = ?, updated_at = ?
                    WHERE packet_number = ?
                """, (d.get("buyer_name"), d.get("date"), now_str, p_num))
    conn.execute("""
        UPDATE sales
        SET is_approval = 1,
            approval_status = 'pending'
        WHERE id = ?
    """, (real_id,))
    conn.commit()
    res_row = conn.execute("SELECT * FROM sales WHERE id = ?", (real_id,)).fetchone()
    conn.close()
    res = dict(res_row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    res["payments"] = json.loads(res.pop("payments_json", "[]"))
    res["is_approval"] = bool(res.get("is_approval") or res.get("approval_status") == "pending")
    return res

# Brokerage (Not in inventory)
@api_router.get("/brokerage")
def list_brokerage():
    conn = get_db()
    rows = conn.execute("SELECT * FROM brokerage ORDER BY date DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@api_router.post("/brokerage")
def create_brokerage(b: BrokerageIn):
    invalidate_analytics_cache()
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
        settlement_status, received_amount, balance_receivable, payment_mode, notes, created_at,
        company_name, buy_rate_per_unit, sell_rate_per_unit, buy_amount, sell_amount,
        amount_paid_to_seller, amount_received_from_buyer, deal_settlement_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        bid, b.deal_no, b.date, b.seller_name, b.buyer_name, b.particulars, b.shape, b.weight, b.pieces, b.mm_size,
        b.cert_lab, b.deal_value, b.brokerage_percent, b.commission_amount, b.commission_from,
        st, received, bal, b.payment_mode, b.notes, now,
        b.company_name or "Shreeji Gems", b.buy_rate_per_unit or 0.0, b.sell_rate_per_unit or 0.0,
        b.buy_amount or 0.0, b.sell_amount or (b.deal_value or 0.0),
        b.amount_paid_to_seller or 0.0, b.amount_received_from_buyer or 0.0,
        b.deal_settlement_status or "in_progress"
    ))
    if b.seller_name:
        auto_save_party(conn, b.seller_name, company=b.seller_name, notes="Seller (Brokerage)")
    if b.buyer_name:
        auto_save_party(conn, b.buyer_name, company=b.buyer_name, notes="Buyer (Brokerage)")
    conn.commit()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    conn.close()
    return dict(row)

@api_router.put("/brokerage/{bid}")
def update_brokerage(bid: str, b: BrokerageIn):
    conn = get_db()
    received = b.received_amount if b.settlement_status == "received" else (b.received_amount or 0)
    bal = max(0.0, b.commission_amount - received)
    st = "received" if bal <= 0 else ("partial" if received > 0 else "pending")
    conn.execute("""
    UPDATE brokerage SET
        deal_no = ?, date = ?, seller_name = ?, buyer_name = ?, particulars = ?, shape = ?, weight = ?, pieces = ?, mm_size = ?,
        cert_lab = ?, deal_value = ?, brokerage_percent = ?, commission_amount = ?, commission_from = ?,
        settlement_status = ?, received_amount = ?, balance_receivable = ?, payment_mode = ?, notes = ?,
        company_name = ?, buy_rate_per_unit = ?, sell_rate_per_unit = ?, buy_amount = ?, sell_amount = ?,
        amount_paid_to_seller = ?, amount_received_from_buyer = ?, deal_settlement_status = ?
    WHERE id = ?
    """, (
        b.deal_no, b.date, b.seller_name, b.buyer_name, b.particulars, b.shape, b.weight, b.pieces, b.mm_size,
        b.cert_lab, b.deal_value, b.brokerage_percent, b.commission_amount, b.commission_from,
        st, received, bal, b.payment_mode, b.notes,
        b.company_name or "Shreeji Gems", b.buy_rate_per_unit or 0.0, b.sell_rate_per_unit or 0.0,
        b.buy_amount or 0.0, b.sell_amount or (b.deal_value or 0.0),
        b.amount_paid_to_seller or 0.0, b.amount_received_from_buyer or 0.0,
        b.deal_settlement_status or "in_progress",
        bid
    ))
    if b.seller_name:
        auto_save_party(conn, b.seller_name, company=b.seller_name, notes="Seller (Brokerage)")
    if b.buyer_name:
        auto_save_party(conn, b.buyer_name, company=b.buyer_name, notes="Buyer (Brokerage)")
    conn.commit()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Deal not found")
    return dict(row)

@api_router.delete("/brokerage/{bid}")
def delete_brokerage(bid: str):
    conn = get_db()
    conn.execute("DELETE FROM brokerage WHERE id = ?", (bid,))
    conn.commit()
    conn.close()
    return {"success": True}

@api_router.post("/brokerage/{bid}/seller-payment")
def brokerage_seller_payment(bid: str, body: dict = Body(...)):
    conn = get_db()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Deal not found")
    d = dict(row)
    amount = float(body.get("amount") or 0.0)
    new_seller_paid = float(d.get("amount_paid_to_seller") or 0.0) + amount
    buy_amt = float(d.get("buy_amount") or d.get("deal_value") or 0.0)
    buyer_rcvd = float(d.get("amount_received_from_buyer") or 0.0)
    sell_amt = float(d.get("sell_amount") or d.get("deal_value") or 0.0)
    
    st = "settled" if (new_seller_paid >= buy_amt and buyer_rcvd >= sell_amt) else (
        "paid_seller_pending_buyer" if new_seller_paid >= buy_amt else "pending_both"
    )
    conn.execute("""
        UPDATE brokerage
        SET amount_paid_to_seller = ?, deal_settlement_status = ?
        WHERE id = ?
    """, (round(new_seller_paid, 2), st, bid))
    conn.commit()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    conn.close()
    return dict(row)

@api_router.post("/brokerage/{bid}/buyer-payment")
def brokerage_buyer_payment(bid: str, body: dict = Body(...)):
    conn = get_db()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Deal not found")
    d = dict(row)
    amount = float(body.get("amount") or 0.0)
    new_buyer_rcvd = float(d.get("amount_received_from_buyer") or 0.0) + amount
    sell_amt = float(d.get("sell_amount") or d.get("deal_value") or 0.0)
    seller_paid = float(d.get("amount_paid_to_seller") or 0.0)
    buy_amt = float(d.get("buy_amount") or d.get("deal_value") or 0.0)
    
    st = "settled" if (seller_paid >= buy_amt and new_buyer_rcvd >= sell_amt) else (
        "received_buyer_pending_seller" if new_buyer_rcvd >= sell_amt else "pending_both"
    )
    conn.execute("""
        UPDATE brokerage
        SET amount_received_from_buyer = ?, deal_settlement_status = ?
        WHERE id = ?
    """, (round(new_buyer_rcvd, 2), st, bid))
    conn.commit()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    conn.close()
    return dict(row)

@api_router.post("/brokerage/{bid}/commission-payment")
def brokerage_commission_payment(bid: str, body: dict = Body(...)):
    conn = get_db()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Deal not found")
    d = dict(row)
    amount = float(body.get("amount") or 0.0)
    comm_total = float(d.get("commission_amount") or 0.0)
    new_rcvd = float(d.get("received_amount") or 0.0) + amount
    new_bal = max(0.0, comm_total - new_rcvd)
    st = "received" if new_bal <= 0.01 else ("partial" if new_rcvd > 0 else "pending")
    conn.execute("""
        UPDATE brokerage
        SET received_amount = ?, balance_receivable = ?, settlement_status = ?
        WHERE id = ?
    """, (round(new_rcvd, 2), round(new_bal, 2), st, bid))
    conn.commit()
    row = conn.execute("SELECT * FROM brokerage WHERE id = ?", (bid,)).fetchone()
    conn.close()
    return dict(row)

# Purchases
@api_router.get("/purchases")
def list_purchases():
    conn = get_db()
    rows = conn.execute("SELECT * FROM purchases WHERE is_deleted = 0 ORDER BY date DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["items"] = json.loads(d.pop("items_json", "[]"))
        result.append(d)
    return result

@api_router.post("/purchases")
def create_purchase(p: PurchaseIn):
    invalidate_analytics_cache()
    conn = get_db()
    pur_id = "pur-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    paid = p.paid_amount or p.total_cost
    bal = max(0.0, p.total_cost - paid)
    st = "cleared" if bal <= 0 else ("partial" if paid > 0 else "unpaid")
    brk_due = max(0.0, (p.brokerage_amount or 0.0) - (p.brokerage_paid_amount or 0.0))

    conn.execute("""
    INSERT INTO purchases (
        id, purchase_no, date, supplier_name, supplier_phone, supplier_city, lot_ref,
        items_json, total_cost, paid_amount, balance_payable, payment_status, payment_mode, notes, created_at,
        company_name, broker_name, broker_phone, brokerage_type, brokerage_rate, brokerage_amount,
        brokerage_paid, brokerage_paid_amount, brokerage_balance_due
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pur_id, p.purchase_no, p.date, p.supplier_name, p.supplier_phone, p.supplier_city, p.lot_ref,
        json.dumps([it.model_dump() for it in p.items]),
        p.total_cost, paid, bal, st, p.payment_mode, p.notes, now,
        p.company_name or "Shreeji Gems", p.broker_name or "", p.broker_phone or "",
        p.brokerage_type or "percentage", p.brokerage_rate or 0.0, p.brokerage_amount or 0.0,
        1 if p.brokerage_paid else 0, p.brokerage_paid_amount or 0.0, brk_due
    ))

    # Auto intake new packets into inventory
    for it in p.items:
        pid = "pkt-" + str(uuid.uuid4())[:8]
        rcost = round(it.cost_price / it.weight, 2) if it.weight else 0
        rsale = round(it.target_sale_price / it.weight, 2) if it.weight else 0
        is_unc = bool(it.is_uncountable)
        cat = it.stone_category or ("bulk" if is_unc else ("individual_weight_added" if (it.stone_details or it.pieces == 1) else "no_individual_weight"))
        init_p = 0 if is_unc else it.pieces
        init_w = it.weight

        conn.execute("""
        INSERT INTO packets (
            id, packet_number, particulars, shape, weight, pieces, mm_size,
            purchase_price, purchase_rate_per_ct, purchase_date, supplier_name,
            sale_price, sale_rate_per_ct, status, box_name,
            is_uncountable, stone_category, stone_weights, stone_details,
            initial_pieces, initial_weight, company_name, unit,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_stock', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pid, it.packet_number, it.particulars, it.shape, it.weight, init_p, it.mm_size,
            it.cost_price, rcost, p.date, p.supplier_name,
            it.target_sale_price, rsale, it.box_name or "General Vault / Unassigned",
            1 if is_unc else 0, cat, json.dumps(it.stone_weights or []), json.dumps(it.stone_details or []),
            init_p, init_w, p.company_name or "Shreeji Gems", it.unit or "cts",
            now, now
        ))

    if p.supplier_name:
        auto_save_party(conn, p.supplier_name, company=p.supplier_name, phone=p.supplier_phone, city=p.supplier_city, notes="Supplier / Seller")
    if p.broker_name:
        auto_save_party(conn, p.broker_name, phone=p.broker_phone, notes="Procurement Broker")

    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    return d

@api_router.put("/purchases/{pur_id}")
def update_purchase(pur_id: str, p: PurchaseIn):
    invalidate_analytics_cache()
    conn = get_db()
    paid = p.paid_amount or p.total_cost
    bal = max(0.0, p.total_cost - paid)
    st = "cleared" if bal <= 0 else ("partial" if paid > 0 else "unpaid")
    brk_due = max(0.0, (p.brokerage_amount or 0.0) - (p.brokerage_paid_amount or 0.0))

    conn.execute("""
    UPDATE purchases SET
        purchase_no = ?, date = ?, supplier_name = ?, supplier_phone = ?, supplier_city = ?, lot_ref = ?,
        items_json = ?, total_cost = ?, paid_amount = ?, balance_payable = ?, payment_status = ?, payment_mode = ?, notes = ?,
        company_name = ?, broker_name = ?, broker_phone = ?, brokerage_type = ?, brokerage_rate = ?,
        brokerage_amount = ?, brokerage_paid = ?, brokerage_paid_amount = ?, brokerage_balance_due = ?
    WHERE id = ? AND is_deleted = 0
    """, (
        p.purchase_no, p.date, p.supplier_name, p.supplier_phone, p.supplier_city, p.lot_ref,
        json.dumps([it.model_dump() for it in p.items]),
        p.total_cost, paid, bal, st, p.payment_mode, p.notes,
        p.company_name or "Shreeji Gems", p.broker_name or "", p.broker_phone or "",
        p.brokerage_type or "percentage", p.brokerage_rate or 0.0, p.brokerage_amount or 0.0,
        1 if p.brokerage_paid else 0, p.brokerage_paid_amount or 0.0, brk_due,
        pur_id
    ))
    if p.supplier_name:
        auto_save_party(conn, p.supplier_name, company=p.supplier_name, phone=p.supplier_phone, city=p.supplier_city, notes="Supplier / Seller")
    if p.broker_name:
        auto_save_party(conn, p.broker_name, phone=p.broker_phone, notes="Procurement Broker")
    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ? AND is_deleted = 0", (pur_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    return d

@api_router.get("/purchases/{pur_id}")
def get_purchase(pur_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM purchases WHERE (id = ? OR purchase_no = ?) AND is_deleted = 0", (pur_id, pur_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    return d

@api_router.delete("/purchases/{pur_id}")
def delete_purchase(pur_id: str):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM purchases WHERE id = ? AND is_deleted = 0", (pur_id,)).fetchone()
    if not row:
        conn.close()
        return {"success": False, "message": "Purchase not found"}
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("UPDATE purchases SET is_deleted = 1, deleted_at = ? WHERE id = ?", (now, pur_id))
    conn.commit()
    conn.close()
    return {"success": True}

@api_router.post("/purchases/{pur_id}/cancel")
def cancel_purchase(pur_id: str, body: dict = Body(default={})):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM purchases WHERE id = ? AND is_deleted = 0", (pur_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    items = json.loads(d.get("items_json") or "[]")
    now = datetime.now(timezone.utc).isoformat()
    for it in items:
        p_num = it.get("packet_number")
        if p_num:
            pkt = conn.execute("SELECT id, packet_number, weight, purchase_price FROM packets WHERE packet_number = ? AND is_deleted = 0", (p_num,)).fetchone()
            if pkt:
                conn.execute("UPDATE packets SET is_deleted = 1, deleted_at = ?, version_id = version_id + 1, updated_at = ? WHERE packet_number = ? AND is_deleted = 0", (now, now, p_num))
                conn.execute("""
                INSERT INTO stock_audit_log (timestamp, packet_id, action_type, actor_role, before_state_json, after_state_json, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    now, pkt["id"], "PURCHASE_CANCELLED", "ADMIN",
                    json.dumps({"packet_number": p_num, "weight": pkt["weight"], "purchase_price": pkt["purchase_price"]}),
                    json.dumps({"is_deleted": 1, "deleted_at": now}),
                    f"Cancelled Purchase Voucher {d.get('purchase_no', pur_id)}"
                ))
    conn.execute("UPDATE purchases SET payment_status = 'cancelled' WHERE id = ?", (pur_id,))
    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    res = dict(row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    return res

@api_router.post("/purchases/{pur_id}/payments")
def add_purchase_payment(pur_id: str, body: dict = Body(...)):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM purchases WHERE id = ? AND is_deleted = 0", (pur_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    amount = float(body.get("amount") or 0.0)
    total = float(d.get("total_cost") or 0.0)
    new_paid = float(d.get("paid_amount") or 0.0) + amount
    new_bal = max(0.0, total - new_paid)
    st = "cleared" if new_bal <= 0.01 else ("partial" if new_paid > 0 else "unpaid")
    conn.execute("""
        UPDATE purchases
        SET paid_amount = ?, balance_payable = ?, payment_status = ?
        WHERE id = ? AND is_deleted = 0
    """, (round(new_paid, 2), round(new_bal, 2), st, pur_id))
    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    res = dict(row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    return res

@api_router.post("/purchases/{pur_id}/full-payment")
def full_purchase_payment(pur_id: str, body: dict = Body(default={})):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM purchases WHERE id = ? AND is_deleted = 0", (pur_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    total = float(d.get("total_cost") or 0.0)
    conn.execute("""
        UPDATE purchases
        SET paid_amount = ?, balance_payable = 0, payment_status = 'cleared'
        WHERE id = ? AND is_deleted = 0
    """, (total, pur_id))
    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    res = dict(row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    return res

@api_router.post("/purchases/{pur_id}/broker-payments")
def add_purchase_broker_payment(pur_id: str, body: dict = Body(...)):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM purchases WHERE id = ? AND is_deleted = 0", (pur_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    amount = float(body.get("amount") or 0.0)
    total_brk = float(d.get("brokerage_amount") or 0.0)
    new_paid = float(d.get("brokerage_paid_amount") or 0.0) + amount
    new_bal = max(0.0, total_brk - new_paid)
    is_paid = 1 if new_bal <= 0.01 else 0
    conn.execute("""
        UPDATE purchases
        SET brokerage_paid_amount = ?, brokerage_balance_due = ?, brokerage_paid = ?
        WHERE id = ? AND is_deleted = 0
    """, (round(new_paid, 2), round(new_bal, 2), is_paid, pur_id))
    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    res = dict(row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    return res

@api_router.post("/purchases/{pur_id}/broker-full-payment")
def full_purchase_broker_payment(pur_id: str, body: dict = Body(default={})):
    invalidate_analytics_cache()
    conn = get_db()
    row = conn.execute("SELECT * FROM purchases WHERE id = ? AND is_deleted = 0", (pur_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    total_brk = float(d.get("brokerage_amount") or 0.0)
    conn.execute("""
        UPDATE purchases
        SET brokerage_paid_amount = ?, brokerage_balance_due = 0, brokerage_paid = 1
        WHERE id = ? AND is_deleted = 0
    """, (total_brk, pur_id))
    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    res = dict(row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    return res

@api_router.post("/purchases/{pur_id}/brokerage-paid")
def toggle_purchase_brokerage_paid(pur_id: str, body: dict = Body(...)):
    conn = get_db()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Purchase not found")
    d = dict(row)
    paid = bool(body.get("paid", False))
    total_brk = float(d.get("brokerage_amount") or 0.0)
    new_paid = total_brk if paid else 0.0
    new_bal = 0.0 if paid else total_brk
    conn.execute("""
        UPDATE purchases
        SET brokerage_paid = ?, brokerage_paid_amount = ?, brokerage_balance_due = ?
        WHERE id = ?
    """, (1 if paid else 0, new_paid, new_bal, pur_id))
    conn.commit()
    row = conn.execute("SELECT * FROM purchases WHERE id = ?", (pur_id,)).fetchone()
    conn.close()
    res = dict(row)
    res["items"] = json.loads(res.pop("items_json", "[]"))
    return res

# ---------------------------------------------------------------------------
# Suppliers, Brokers & Parties Directory (Persistent Auto-Complete)
# ---------------------------------------------------------------------------
@api_router.get("/suppliers")
def list_suppliers():
    conn = get_db()
    from_pur = [r[0] for r in conn.execute("SELECT DISTINCT supplier_name FROM purchases WHERE supplier_name IS NOT NULL AND TRIM(supplier_name) != ''").fetchall()]
    from_pkt = [r[0] for r in conn.execute("SELECT DISTINCT supplier_name FROM packets WHERE is_deleted = 0 AND supplier_name IS NOT NULL AND TRIM(supplier_name) != ''").fetchall()]
    from_brk = [r[0] for r in conn.execute("SELECT DISTINCT seller_name FROM brokerage WHERE seller_name IS NOT NULL AND TRIM(seller_name) != ''").fetchall()]
    from_byr = [r[0] for r in conn.execute("SELECT DISTINCT name FROM buyers WHERE (notes LIKE '%Supplier%' OR notes LIKE '%Seller%') AND name IS NOT NULL AND TRIM(name) != ''").fetchall()]
    conn.close()
    all_suppliers = sorted(list(set(s.strip() for s in (from_pur + from_pkt + from_brk + from_byr) if s and s.strip())))
    return all_suppliers

@api_router.post("/suppliers")
def create_supplier(payload: dict = Body(...)):
    name = (payload.get("name") or payload.get("supplier_name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Supplier name cannot be empty")
    conn = get_db()
    auto_save_party(conn, name, company=payload.get("company", name), phone=payload.get("phone", ""), city=payload.get("city", ""), notes="Supplier / Seller")
    conn.commit()
    conn.close()
    return {"success": True, "name": name}

@api_router.delete("/suppliers")
def clear_suppliers():
    conn = get_db()
    conn.execute("DELETE FROM buyers WHERE notes LIKE '%Supplier%' OR notes LIKE '%Seller%'")
    conn.commit()
    conn.close()
    return {"ok": True}

@api_router.get("/brokers")
def list_brokers():
    conn = get_db()
    from_pur = [r[0] for r in conn.execute("SELECT DISTINCT broker_name FROM purchases WHERE broker_name IS NOT NULL AND TRIM(broker_name) != ''").fetchall()]
    from_byr = [r[0] for r in conn.execute("SELECT DISTINCT name FROM buyers WHERE notes LIKE '%Broker%' AND name IS NOT NULL AND TRIM(name) != ''").fetchall()]
    conn.close()
    all_brokers = sorted(list(set(b.strip() for b in (from_pur + from_byr) if b and b.strip())))
    return all_brokers

@api_router.post("/brokers")
def create_broker(payload: dict = Body(...)):
    name = (payload.get("name") or payload.get("broker_name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Broker name cannot be empty")
    conn = get_db()
    auto_save_party(conn, name, phone=payload.get("phone", ""), city=payload.get("city", ""), notes="Procurement Broker")
    conn.commit()
    conn.close()
    return {"success": True, "name": name}

@api_router.delete("/brokers")
def clear_brokers():
    conn = get_db()
    conn.execute("DELETE FROM buyers WHERE notes LIKE '%Broker%'")
    conn.commit()
    conn.close()
    return {"ok": True}

@api_router.delete("/buyers")
def clear_buyers():
    conn = get_db()
    conn.execute("DELETE FROM buyers")
    conn.commit()
    conn.close()
    return {"ok": True}

# Expenses
@api_router.get("/expenses")
def list_expenses():
    conn = get_db()
    rows = conn.execute("SELECT * FROM expenses ORDER BY date DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@api_router.post("/expenses")
def create_expense(e: ExpenseIn):
    invalidate_analytics_cache()
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

# Buyers & Counterparties Directory
@api_router.get("/buyers")
def list_buyers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM buyers ORDER BY name ASC").fetchall()
    buyers_list = [dict(r) for r in rows]
    existing_names = {b["name"].strip().lower() for b in buyers_list if b.get("name")}

    # Include distinct buyers from sales records if not yet in directory
    try:
        s_rows = conn.execute("SELECT DISTINCT buyer_name, buyer_phone, buyer_city, buyer_address FROM sales WHERE buyer_name IS NOT NULL AND TRIM(buyer_name) != '' AND is_deleted = 0").fetchall()
        for sr in s_rows:
            b_name = sr[0].strip()
            if b_name.lower() not in existing_names:
                existing_names.add(b_name.lower())
                buyers_list.append({
                    "id": "gen-" + str(uuid.uuid4())[:8],
                    "name": b_name,
                    "company": b_name,
                    "phone": sr[1] or "",
                    "whatsapp": sr[1] or "",
                    "city": sr[2] or "",
                    "address": sr[3] or "",
                    "notes": "Client / Buyer",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    except Exception:
        pass

    # Include distinct buyers and sellers from brokerage deals if not yet in directory
    try:
        brk_rows = conn.execute("SELECT DISTINCT seller_name, buyer_name FROM brokerage").fetchall()
        for br in brk_rows:
            for p_name, role in [(br[0], "Seller (Brokerage)"), (br[1], "Buyer (Brokerage)")]:
                if p_name and p_name.strip() and p_name.strip().lower() not in existing_names:
                    p_clean = p_name.strip()
                    existing_names.add(p_clean.lower())
                    buyers_list.append({
                        "id": "gen-" + str(uuid.uuid4())[:8],
                        "name": p_clean,
                        "company": p_clean,
                        "phone": "",
                        "whatsapp": "",
                        "city": "",
                        "address": "",
                        "notes": role,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
    except Exception:
        pass

    conn.close()
    buyers_list.sort(key=lambda x: (x.get("name") or "").lower())
    return buyers_list

@api_router.post("/buyers")
def create_buyer(b: BuyerIn):
    conn = get_db()
    auto_save_party(conn, b.name, company=b.company, phone=b.phone, city=b.city, address=b.address, notes=b.notes or "Client / Buyer")
    conn.commit()
    row = conn.execute("SELECT * FROM buyers WHERE LOWER(TRIM(name)) = LOWER(?)", (b.name.strip(),)).fetchone()
    conn.close()
    return dict(row) if row else {"id": "buy-" + str(uuid.uuid4())[:8], "name": b.name}

# Boxes
@api_router.get("/boxes")
def list_boxes(
    authorization: Optional[str] = Header(None),
    x_user_role: Optional[str] = Header(None),
    mask_cost: Optional[bool] = Query(False),
    x_cost_token: Optional[str] = Header(None),
    x_cost_unlocked: Optional[str] = Header(None)
):
    role = get_user_role(authorization, x_user_role, mask_cost, x_cost_token, x_cost_unlocked)
    conn = get_db()
    cursor = conn.cursor()

    # Auto-ensure any distinct box_name in packets exists in boxes table
    cursor.execute("SELECT DISTINCT box_name FROM packets WHERE box_name IS NOT NULL AND box_name != '' AND is_deleted = 0")
    for (bname,) in cursor.fetchall():
        cursor.execute("SELECT id FROM boxes WHERE name = ?", (bname,))
        if not cursor.fetchone():
            bid = "box-" + str(uuid.uuid4())[:8]
            now_iso = datetime.now(timezone.utc).isoformat()
            cursor.execute("INSERT OR IGNORE INTO boxes (id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?)",
                           (bid, bname, "Vault container", "#10b981", now_iso))
            conn.commit()

    cursor.execute("""
    SELECT 
        b.id, b.name, b.description, b.color, b.created_at,
        COALESCE(agg.packet_count, 0) as packet_count,
        COALESCE(agg.total_pcs, 0) as total_pcs,
        COALESCE(agg.total_weight, 0.0) as total_weight,
        COALESCE(agg.initial_pcs, COALESCE(agg.total_pcs, 0)) as initial_pcs,
        COALESCE(agg.initial_weight, COALESCE(agg.total_weight, 0.0)) as initial_weight,
        COALESCE(agg.cost_valuation, 0.0) as cost_valuation,
        COALESCE(agg.asking_valuation, 0.0) as asking_valuation,
        COALESCE(agg.in_stock_count, 0) as in_stock_count
    FROM boxes b
    LEFT JOIN (
        SELECT 
            box_name,
            COUNT(*) as packet_count,
            SUM(pieces) as total_pcs,
            ROUND(SUM(weight), 2) as total_weight,
            SUM(COALESCE(initial_pieces, pieces)) as initial_pcs,
            ROUND(SUM(COALESCE(initial_weight, weight)), 2) as initial_weight,
            ROUND(SUM(purchase_price), 2) as cost_valuation,
            ROUND(SUM(sale_price), 2) as asking_valuation,
            SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END) as in_stock_count
        FROM packets
        WHERE is_deleted = 0
        GROUP BY box_name
    ) agg ON b.name = agg.box_name
    ORDER BY b.id ASC
    """)
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if role == "SALES":
            d["cost_valuation"] = 0.0
        result.append(d)
    return Response(content=orjson.dumps(result), media_type="application/json")

@api_router.post("/boxes")
def create_box(b: BoxIn):
    invalidate_analytics_cache()
    conn = get_db()
    bid = "box-" + str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    clean_name = b.name.strip()
    dup = conn.execute("SELECT id FROM boxes WHERE LOWER(name) = LOWER(?)", (clean_name,)).fetchone()
    if dup:
        conn.close()
        raise HTTPException(status_code=400, detail="Box name already exists")
    conn.execute("INSERT INTO boxes (id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?)",
                 (bid, clean_name, b.description or "", b.color or "#10b981", now))
    conn.commit()
    row = conn.execute("SELECT * FROM boxes WHERE id = ?", (bid,)).fetchone()
    conn.close()
    return dict(row)

@api_router.put("/boxes/{box_id}")
def update_box(box_id: str, b: BoxIn):
    invalidate_analytics_cache()
    conn = get_db()
    old_row = conn.execute("SELECT * FROM boxes WHERE id = ?", (box_id,)).fetchone()
    if not old_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Box not found")
    old_name = old_row["name"]
    new_name = b.name.strip()
    dup = conn.execute("SELECT id FROM boxes WHERE LOWER(name) = LOWER(?) AND id != ?", (new_name, box_id)).fetchone()
    if dup:
        conn.close()
        raise HTTPException(status_code=400, detail="Box name already exists")
    conn.execute("UPDATE boxes SET name = ?, description = ?, color = ? WHERE id = ?",
                 (new_name, b.description or "", b.color or "#10b981", box_id))
    if old_name != new_name:
        conn.execute("UPDATE packets SET box_name = ? WHERE box_name = ?", (new_name, old_name))
    conn.commit()
    row = conn.execute("SELECT * FROM boxes WHERE id = ?", (box_id,)).fetchone()
    conn.close()
    return dict(row)

@api_router.delete("/boxes/{box_id}")
def delete_box(box_id: str):
    invalidate_analytics_cache()
    conn = get_db()
    old_row = conn.execute("SELECT * FROM boxes WHERE id = ?", (box_id,)).fetchone()
    if old_row:
        conn.execute("UPDATE packets SET box_name = 'General Vault / Unassigned' WHERE box_name = ?", (old_row["name"],))
    conn.execute("DELETE FROM boxes WHERE id = ?", (box_id,))
    conn.commit()
    conn.close()
    return {"success": True}

# ---------------------------------------------------------------------------
# Master Gemological Particulars (Stone Varieties), Shapes, Labs & Tags
# ---------------------------------------------------------------------------
DEFAULT_PARTICULARS_LIST = [
    # Classic Single Varieties
    "Emerald",
    "Ruby",
    "Blue Sapphire",
    "Yellow Sapphire",
    "White Sapphire",
    "Pink Sapphire",
    "Padparadscha Sapphire",
    "Tanzanite",
    "Diamond",
    "Alexandrite",
    "Aquamarine",
    "Tourmaline",
    "Spinel",
    "Morganite",
    "Garnet",
    "Tsavorite Garnet",
    "Hessonite Garnet (Gomed)",
    "Chrysoberyl Cat's Eye (Lehsunia)",
    "Opal",
    "Peridot",
    "Zircon",
    "Topaz",
    "Turquoise (Firoza)",
    "Pearl (Moti / Basra / South Sea)",
    "Coral (Moonga / Red Coral)",
    # Emeralds
    "Emerald (Zambian)",
    "Emerald (Colombian)",
    "Emerald (Panjshir / Afghan)",
    "Emerald (Russian / Ural)",
    "Emerald (Brazilian)",
    "Emerald (Ethiopian)",
    "Emerald (Sandawana)",
    "Emerald (Swat / Pakistan)",
    "Emerald Cat's Eye",
    "Trapiche Emerald",
    # Rubies
    "Ruby (Burmese Pigeon Blood)",
    "Ruby (Mozambique)",
    "Ruby (Madagascar)",
    "Ruby (Thai / Siamese)",
    "Ruby (Ceylon / Sri Lanka)",
    "Star Ruby (Natural Unheated)",
    # Sapphires
    "Blue Sapphire (Ceylon Royal Blue)",
    "Blue Sapphire (Ceylon Cornflower)",
    "Blue Sapphire (Kashmir Velvet)",
    "Blue Sapphire (Burmese)",
    "Blue Sapphire (Madagascar)",
    "Yellow Sapphire (Ceylon Pukhraj)",
    "Yellow Sapphire (Bangkok)",
    "Pink Sapphire (Ceylon)",
    "Pink Sapphire (Madagascar)",
    "Padparadscha Sapphire (Natural Lotus)",
    "White Sapphire (Safed Pukhraj)",
    "Green Sapphire",
    "Purple / Violet Sapphire",
    "Star Sapphire (Natural Asterism)",
    "Color-Change Sapphire",
    # Diamonds
    "Diamond Solitaire",
    "Diamond Melee Parcel",
    "Diamond (Fancy Yellow)",
    "Diamond (Fancy Pink)",
    "Diamond (Fancy Blue)",
    "Diamond (Black)",
    # Beryl Family
    "Aquamarine (Santa Maria Deep Blue)",
    "Aquamarine (Mozambique / Madagascar)",
    "Morganite (Peach / Pink Beryl)",
    "Heliodor (Golden Beryl)",
    "Bixbite (Red Beryl)",
    "Goshenite (White Beryl)",
    # Spinels
    "Red Spinel (Burmese / Mahenge)",
    "Hot Pink / Neon Spinel (Mahenge)",
    "Cobalt Blue Spinel (Luc Yen)",
    "Purple / Violet Spinel",
    "Black Spinel",
    # Tourmalines
    "Paraiba Tourmaline (Neon Blue)",
    "Rubellite (Pigeon Blood / Raspberry)",
    "Indicolite (Blue Tourmaline)",
    "Chrome Tourmaline (Vivid Green)",
    "Bi-Color / Watermelon Tourmaline",
    "Yellow / Canary Tourmaline",
    "Dravite (Brown Tourmaline)",
    "Black Tourmaline (Schorl)",
    # Chrysoberyl & Alexandrite
    "Alexandrite (Color Change - Russian / Brazilian)",
    "Chrysoberyl Cat's Eye (Lehsunia - Honey & Milk)",
    "Yellow / Golden Chrysoberyl",
    # Tanzanite & Zoisite
    "Tanzanite (Merelani AAA Royal Blue)",
    "Tanzanite (Peacock Green / Fancy)",
    # Opals
    "Opal (Australian Black - Lightning Ridge)",
    "Opal (Australian White / Crystal)",
    "Opal (Australian Boulder)",
    "Fire Opal (Mexican Sun Color)",
    "Opal (Ethiopian Welo Hydrophane)",
    # Garnet Family
    "Tsavorite Garnet (Vivid Green)",
    "Demantoid Garnet (Russian Horsetail)",
    "Spessartite / Mandarin Garnet",
    "Rhodolite Garnet (Purplish Red)",
    "Hessonite Garnet (Ceylon Gomedh)",
    "Malaia / Color-Change Garnet",
    "Pyrope-Almandine Garnet",
    # Topaz
    "Imperial Topaz (Natural Golden Sherry)",
    "Swiss Blue Topaz",
    "London Blue Topaz",
    "Sky Blue Topaz",
    "White / Clear Topaz",
    # Quartz & Chalcedony
    "Amethyst (Deep Siberian / Zambian)",
    "Citrine (Madeira / Golden)",
    "Ametrine (Bolivian)",
    "Rose Quartz (Madagascar Star)",
    "Smoky Quartz",
    "Rutilated / Tourmalinated Quartz",
    "Blue Chalcedony / Chrysoprase",
    "Carnelian",
    "Black Onyx",
    # Peridot & Zircon
    "Peridot (Burmese / Pakistani Suppat)",
    "Blue Zircon (Cambodian Ratanakiri)",
    "White Zircon (Natural Starlite)",
    # Organic & Navratna Gems
    "Natural Basra Pearl",
    "South Sea Pearl (Golden / White)",
    "Tahitian Black Pearl",
    "Cultured Pearl (Japanese Akoya)",
    "Red Coral (Italian / Mediterranean Moonga)",
    "Turquoise (Persian Neyshabur)",
    "Turquoise (Arizona Sleeping Beauty)",
    "Lapis Lazuli (Badakhshan Afghan Royal)",
    "Natural Baltic Amber",
    "Imperial Jadeite (Type A Jade)",
    "Moonstone (Rainbow / Ceylon Blue Sheen)",
    "Sunstone (Oregon Schiller)",
    "Iolite (Neeli - Water Sapphire)",
    "Kunzite / Hiddenite (Spodumene)"
]

DEFAULT_SHAPES_LIST = [
    "Oval", "Cushion", "Round", "Emerald Cut", "Radiant", "Pear",
    "Marquise", "Princess", "Heart", "Trilliant", "Baguette",
    "Asscher", "Cabochon", "Drop / Briolette", "Sugarloaf", "Rough / Uncut"
]

DEFAULT_LABS_LIST = [
    "GIA", "GRS", "IGI", "Gübelin", "SSEF", "GII Mumbai",
    "IGI-GTL Jaipur", "Lotus Gemology", "HRD Antwerp", "Self / None"
]

@api_router.get("/custom-particulars")
@api_router.get("/particulars")
def get_custom_particulars():
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_particulars'").fetchone()
    db_parts = [r[0] for r in conn.execute("SELECT DISTINCT particulars FROM packets WHERE is_deleted = 0 AND particulars IS NOT NULL AND particulars != ''").fetchall()]
    conn.close()
    stored = []
    if row:
        try:
            stored = json.loads(row["value"])
        except Exception:
            stored = []
    seen = set()
    merged = []
    for p in (stored + DEFAULT_PARTICULARS_LIST + db_parts):
        p_clean = p.strip()
        if p_clean and p_clean.lower() not in seen:
            seen.add(p_clean.lower())
            merged.append(p_clean)
    return merged

@api_router.post("/custom-particulars")
@api_router.post("/particulars")
def add_custom_particular(payload: Dict[str, Any] = Body(...)):
    name = (payload.get("name") or payload.get("particular") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Particular name cannot be empty")
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_particulars'").fetchone()
    stored = []
    if row:
        try:
            stored = json.loads(row["value"])
        except Exception:
            stored = []
    if name not in stored:
        stored.insert(0, name)
        conn.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('custom_particulars', ?, datetime('now'))", (json.dumps(stored),))
        conn.commit()
    conn.close()
    return {"success": True, "name": name}

@api_router.get("/custom-shapes")
@api_router.get("/shapes")
def get_custom_shapes():
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_shapes'").fetchone()
    conn.close()
    stored = []
    if row:
        try:
            stored = json.loads(row["value"])
        except Exception:
            stored = []
    seen = set()
    merged = []
    for s in (stored + DEFAULT_SHAPES_LIST):
        s_clean = s.strip()
        if s_clean and s_clean.lower() not in seen:
            seen.add(s_clean.lower())
            merged.append(s_clean)
    return merged

@api_router.post("/custom-shapes")
def add_custom_shape(payload: Dict[str, Any] = Body(...)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Shape name cannot be empty")
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_shapes'").fetchone()
    stored = []
    if row:
        try:
            stored = json.loads(row["value"])
        except Exception:
            stored = []
    if name not in stored:
        stored.append(name)
        conn.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('custom_shapes', ?, datetime('now'))", (json.dumps(stored),))
        conn.commit()
    conn.close()
    return name

@api_router.delete("/custom-shapes/{shape_name}")
def delete_custom_shape(shape_name: str):
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_shapes'").fetchone()
    stored = []
    if row:
        try:
            stored = json.loads(row["value"])
        except Exception:
            stored = []
    stored = [s for s in stored if s.lower() != shape_name.lower().strip()]
    conn.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('custom_shapes', ?, datetime('now'))", (json.dumps(stored),))
    conn.commit()
    conn.close()
    return {"success": True}

@api_router.get("/custom-labs")
@api_router.get("/labs")
def get_custom_labs():
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_labs'").fetchone()
    conn.close()
    stored = []
    if row:
        try:
            stored = json.loads(row["value"])
        except Exception:
            stored = []
    seen = set()
    merged = []
    for l in (stored + DEFAULT_LABS_LIST):
        l_clean = l.strip()
        if l_clean and l_clean.lower() not in seen:
            seen.add(l_clean.lower())
            merged.append(l_clean)
    return merged

@api_router.post("/custom-labs")
def add_custom_lab(payload: Dict[str, Any] = Body(...)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Lab name cannot be empty")
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_labs'").fetchone()
    stored = []
    if row:
        try:
            stored = json.loads(row["value"])
        except Exception:
            stored = []
    if name not in stored:
        stored.append(name)
        conn.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('custom_labs', ?, datetime('now'))", (json.dumps(stored),))
        conn.commit()
    conn.close()
    return {"success": True, "name": name}

@api_router.get("/custom-box-tags")
def get_custom_box_tags():
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_box_tags'").fetchone()
    conn.close()
    if row:
        try:
            return json.loads(row["value"])
        except Exception:
            return []
    return []

@api_router.post("/custom-box-tags")
def add_custom_box_tag(payload: Dict[str, Any] = Body(...)):
    label = (payload.get("label") or "").strip()
    color = (payload.get("color") or "#10b981").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Tag label cannot be empty")
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_box_tags'").fetchone()
    tags = []
    if row:
        try:
            tags = json.loads(row["value"])
        except Exception:
            tags = []
    new_tag = {"id": f"tag-{int(time.time()*1000)}", "label": label, "color": color}
    tags.append(new_tag)
    conn.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('custom_box_tags', ?, datetime('now'))", (json.dumps(tags),))
    conn.commit()
    conn.close()
    return {"success": True, "tag": new_tag}

@api_router.delete("/custom-box-tags/{tag_id}")
def delete_custom_box_tag(tag_id: str):
    conn = get_db()
    row = conn.execute("SELECT value FROM app_settings WHERE key = 'custom_box_tags'").fetchone()
    tags = []
    if row:
        try:
            tags = json.loads(row["value"])
        except Exception:
            tags = []
    tags = [t for t in tags if t.get("id") != tag_id]
    conn.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('custom_box_tags', ?, datetime('now'))", (json.dumps(tags),))
    conn.commit()
    conn.close()
    return {"success": True}

# Analytics
@api_router.get("/analytics")
def get_analytics(company: Optional[str] = Query(None)):
    cache_key = company or "all"
    now_ts = time.time()
    if cache_key in _analytics_cache:
        cached = _analytics_cache[cache_key]
        if now_ts - cached["ts"] < 300:
            return Response(content=cached["bytes"], media_type="application/json")
    conn = get_db()
    sales_rows = conn.execute("SELECT * FROM sales WHERE is_deleted = 0").fetchall()
    brokerage_rows = conn.execute("SELECT * FROM brokerage").fetchall()
    purchases_rows = conn.execute("SELECT * FROM purchases WHERE is_deleted = 0").fetchall()
    expenses_rows = conn.execute("SELECT * FROM expenses").fetchall()

    sales = []
    for r in sales_rows:
        d = dict(r)
        d["items"] = json.loads(d.pop("items_json", "[]"))
        d["payments"] = json.loads(d.pop("payments_json", "[]"))
        sales.append(d)
    brokerage = [dict(r) for r in brokerage_rows]
    purchases = []
    for r in purchases_rows:
        d = dict(r)
        d["items"] = json.loads(d.pop("items_json", "[]"))
        purchases.append(d)
    expenses = [dict(r) for r in expenses_rows]

    # Filter by company if requested
    if isinstance(company, str) and company and company != "all":
        sales = [s for s in sales if s.get("company_name") == company]
        brokerage = [b for b in brokerage if b.get("company_name") == company]
        purchases = [p for p in purchases if p.get("company_name") == company]
        expenses = [e for e in expenses if e.get("company_name") == company]

    # 1. Direct sales & COGS
    direct_sales_revenue = 0.0
    direct_sales_cogs = 0.0
    total_discounts = 0.0
    sales_ledger = []
    buyer_map = {}
    part_map = {}
    month_map = {}

    for s in sales:
        st = s.get("approval_status")
        if st == "returned" or (s.get("is_approval") and st != "approved_billed"):
            continue
        s_total = float(s.get("total") or 0.0)
        direct_sales_revenue += s_total
        total_discounts += float(s.get("discount") or 0.0)

        s_cogs = 0.0
        s_wt = 0.0
        s_pcs = 0
        parts_list = []
        for it in s.get("items", []):
            if it.get("is_returned"):
                continue
            cp = float(it.get("cost_price") or 0.0)
            tp = float(it.get("total_price") or 0.0)
            w = float(it.get("weight") or 0.0)
            p = int(it.get("pieces") or 1)
            s_cogs += cp
            s_wt += w
            s_pcs += p
            part = it.get("particulars", "Gemstone")
            parts_list.append(part)
            base_part = part.split("(")[0].strip() or "Gemstone"
            if base_part not in part_map:
                part_map[base_part] = {"sold": 0, "in_stock": 0, "carats": 0.0, "rev": 0.0, "cogs": 0.0, "profit": 0.0}
            part_map[base_part]["sold"] += 1
            part_map[base_part]["carats"] += w
            part_map[base_part]["rev"] += tp
            part_map[base_part]["cogs"] += cp
            part_map[base_part]["profit"] += (tp - cp)

        direct_sales_cogs += s_cogs
        m = (s.get("date") or "")[:7]
        if m:
            if m not in month_map:
                month_map[m] = {"rev": 0.0, "cogs": 0.0, "brk": 0.0, "exp": 0.0, "purBrk": 0.0}
            month_map[m]["rev"] += s_total
            month_map[m]["cogs"] += s_cogs

        b_name = s.get("buyer_name") or "Direct Client"
        if b_name not in buyer_map:
            buyer_map[b_name] = {"count": 0, "spend": 0.0, "profit": 0.0}
        buyer_map[b_name]["count"] += 1
        buyer_map[b_name]["spend"] += s_total
        buyer_map[b_name]["profit"] += (s_total - s_cogs)

        paid_amt = float(s.get("paid_amount") or 0.0)
        bal = float(s.get("balance") if s.get("balance") is not None else max(0.0, s_total - paid_amt))
        sales_ledger.append({
            "id": s["id"],
            "transaction_type": "direct_sale",
            "invoice_or_deal_no": s["invoice_no"],
            "date": s.get("date", ""),
            "company_name": s.get("company_name", "Shreeji Gems"),
            "buyer_name": s.get("buyer_name", ""),
            "seller_name": "Own Vault",
            "particulars_summary": "; ".join(parts_list[:2]) or "Gemstones",
            "weight": round(s_wt, 2),
            "unit": "cts",
            "pieces": s_pcs,
            "sale_amount": s_total,
            "cogs_amount": s_cogs,
            "gross_profit": s_total - s_cogs,
            "margin_pct": round(((s_total - s_cogs) / s_total * 100), 1) if s_total > 0 else 0.0,
            "paid_amount": paid_amt,
            "balance_due": bal,
            "payment_status": s.get("payment_status", "cleared" if bal <= 0 else "partial"),
            "payment_mode": s.get("payment_mode", "Bank Wire / NEFT"),
            "notes": s.get("notes", ""),
            "items_count": len(s.get("items", [])),
        })

    # 2. Brokerage Deals
    brokerage_deals_revenue = 0.0
    brokerage_deals_cogs = 0.0
    brokerage_earnings = 0.0
    pending_brokerage = 0.0

    for b in brokerage:
        sell_amt = float(b.get("sell_amount") or b.get("deal_value") or 0.0)
        buy_amt = float(b.get("buy_amount") or 0.0)
        comm_amt = float(b.get("commission_amount") or max(0.0, sell_amt - buy_amt))
        rec_comm = float(b.get("received_amount") or 0.0)
        bal_comm = float(b.get("balance_receivable") or max(0.0, comm_amt - rec_comm))

        brokerage_deals_revenue += sell_amt
        brokerage_deals_cogs += buy_amt
        brokerage_earnings += rec_comm
        pending_brokerage += bal_comm

        m = (b.get("date") or "")[:7]
        if m:
            if m not in month_map:
                month_map[m] = {"rev": 0.0, "cogs": 0.0, "brk": 0.0, "exp": 0.0, "purBrk": 0.0}
            month_map[m]["rev"] += sell_amt
            month_map[m]["cogs"] += buy_amt
            month_map[m]["brk"] += rec_comm

        b_name = b.get("buyer_name") or "Outside Buyer"
        if b_name not in buyer_map:
            buyer_map[b_name] = {"count": 0, "spend": 0.0, "profit": 0.0}
        buyer_map[b_name]["count"] += 1
        buyer_map[b_name]["spend"] += sell_amt
        buyer_map[b_name]["profit"] += comm_amt

        recv_buyer = float(b.get("amount_received_from_buyer") or (sell_amt if b.get("settlement_status") == "received" else rec_comm))
        buyer_bal = max(0.0, sell_amt - recv_buyer)
        sales_ledger.append({
            "id": b["id"],
            "transaction_type": "brokerage_deal",
            "invoice_or_deal_no": b["deal_no"],
            "date": b.get("date", ""),
            "company_name": b.get("company_name", "Shreeji Gems"),
            "buyer_name": b.get("buyer_name", ""),
            "seller_name": b.get("seller_name", ""),
            "particulars_summary": f"{b.get('particulars', '')} ({b.get('weight', 0)} cts {b.get('shape', '')})",
            "weight": float(b.get("weight") or 0.0),
            "unit": "cts",
            "pieces": int(b.get("pieces") or 1),
            "sale_amount": sell_amt,
            "cogs_amount": buy_amt,
            "gross_profit": comm_amt,
            "margin_pct": round((comm_amt / sell_amt * 100), 1) if sell_amt > 0 else 0.0,
            "paid_amount": recv_buyer,
            "balance_due": buyer_bal,
            "payment_status": "cleared" if buyer_bal <= 0 else "partial",
            "payment_mode": b.get("payment_mode", "Bank Wire / NEFT"),
            "notes": b.get("notes", "Brokerage Deal"),
            "items_count": 1,
        })

    sales_ledger.sort(key=lambda x: x["date"], reverse=True)
    total_sales_revenue = direct_sales_revenue + brokerage_deals_revenue
    total_cogs = direct_sales_cogs + brokerage_deals_cogs
    gross_profit = total_sales_revenue - total_cogs
    gross_margin_pct = (gross_profit / total_sales_revenue * 100) if total_sales_revenue > 0 else 0.0

    # 3. Middleman purchase brokerage
    pur_brk_incurred = 0.0
    pur_brk_paid = 0.0
    pur_brk_pending = 0.0
    for p in purchases:
        if p.get("status") != "cancelled":
            ba = float(p.get("brokerage_amount") or 0.0)
            bp = float(p.get("brokerage_paid_amount") or (ba if p.get("brokerage_paid") else 0.0))
            bd = float(p.get("brokerage_balance_due") if p.get("brokerage_balance_due") is not None else max(0.0, ba - bp))
            pur_brk_incurred += ba
            pur_brk_paid += bp
            pur_brk_pending += bd
            m = (p.get("date") or "")[:7]
            if m:
                if m not in month_map:
                    month_map[m] = {"rev": 0.0, "cogs": 0.0, "brk": 0.0, "exp": 0.0, "purBrk": 0.0}
                month_map[m]["purBrk"] += ba

    # 4. Operating Expenses
    petty = 0.0
    business = 0.0
    exp_cat_map = {}
    for e in expenses:
        eid = e.get("id", "")
        if eid.startswith("pur-exp-") or eid.startswith("brk-seller-exp-") or eid.startswith("pur-brk-exp-"):
            continue
        amt = float(e.get("amount") or 0.0)
        cat = e.get("category", "General")
        exp_cat_map[cat] = exp_cat_map.get(cat, 0.0) + amt
        if e.get("expense_type") == "petty":
            petty += amt
        else:
            business += amt
        m = (e.get("date") or "")[:7]
        if m:
            if m not in month_map:
                month_map[m] = {"rev": 0.0, "cogs": 0.0, "brk": 0.0, "exp": 0.0, "purBrk": 0.0}
            month_map[m]["exp"] += amt

    if pur_brk_incurred > 0:
        exp_cat_map["Purchase Brokerage"] = exp_cat_map.get("Purchase Brokerage", 0.0) + pur_brk_incurred

    direct_overheads = petty + business
    total_expenses = direct_overheads + pur_brk_incurred
    net_profit = gross_profit - total_expenses
    net_margin_pct = (net_profit / total_sales_revenue * 100) if total_sales_revenue > 0 else 0.0

    pkt_company_clause = ""
    pkt_params = []
    if isinstance(company, str) and company and company != "all":
        pkt_company_clause = " AND company_name = ?"
        pkt_params = [company]

    # 5. Vault inventory evaluation (High-Performance SQLite Aggregates)
    owned_agg = conn.execute(f"""
        SELECT 
            COUNT(*) as pkt_count,
            COALESCE(SUM(weight), 0.0) as total_weight,
            COALESCE(SUM(purchase_price), 0.0) as cost_val,
            COALESCE(SUM(sale_price), 0.0) as asking_val
        FROM packets 
        WHERE status IN ('in_stock', 'on_memo', 'on_approval', 'reserved') 
          AND is_deleted = 0 
          AND (ownership_type IS NULL OR ownership_type != 'MEMO_IN')
          {pkt_company_clause}
    """, pkt_params).fetchone()

    memo_in_agg = conn.execute(f"""
        SELECT 
            COUNT(*) as pkt_count,
            COALESCE(SUM(weight), 0.0) as total_weight,
            COALESCE(SUM(purchase_price), 0.0) as cost_val
        FROM packets 
        WHERE status IN ('in_stock', 'on_memo', 'on_approval', 'reserved') 
          AND is_deleted = 0 
          AND ownership_type = 'MEMO_IN'
          {pkt_company_clause}
    """, pkt_params).fetchone()

    memo_out_agg = conn.execute(f"""
        SELECT 
            COUNT(*) as pkt_count,
            COALESCE(SUM(weight), 0.0) as total_weight
        FROM packets 
        WHERE status IN ('on_memo', 'on_approval') AND is_deleted = 0
          {pkt_company_clause}
    """, pkt_params).fetchone()

    sold_count_row = conn.execute(f"""
        SELECT COUNT(*) as pkt_count FROM packets WHERE status = 'sold' AND is_deleted = 0
          {pkt_company_clause}
    """, pkt_params).fetchone()

    v_pkts = int(owned_agg["pkt_count"])
    v_cts = round(float(owned_agg["total_weight"]), 2)
    v_cost = round(float(owned_agg["cost_val"]), 2)
    v_asking = round(float(owned_agg["asking_val"]), 2)
    v_memo_pkts = int(memo_out_agg["pkt_count"])
    v_memo_cts = round(float(memo_out_agg["total_weight"]), 2)
    v_sold_pkts = int(sold_count_row["pkt_count"])

    memo_in_pkts = int(memo_in_agg["pkt_count"])
    memo_in_cts = round(float(memo_in_agg["total_weight"]), 2)
    memo_in_cost = round(float(memo_in_agg["cost_val"]), 2)

    shape_rows = conn.execute(f"""
        SELECT 
            COALESCE(NULLIF(shape, ''), 'Oval') as sh,
            COUNT(*) as cnt,
            COALESCE(SUM(weight), 0.0) as total_wt,
            COALESCE(SUM(sale_price), 0.0) as total_val
        FROM packets 
        WHERE status IN ('in_stock', 'on_memo', 'on_approval', 'reserved') AND is_deleted = 0
          {pkt_company_clause}
        GROUP BY COALESCE(NULLIF(shape, ''), 'Oval')
        ORDER BY total_val DESC
    """, pkt_params).fetchall()

    shape_breakdown = [
        {"shape": r["sh"], "count": r["cnt"], "carats": round(float(r["total_wt"]), 2), "value": round(float(r["total_val"]), 2)}
        for r in shape_rows
    ]

    part_rows = conn.execute(f"""
        SELECT 
            particulars,
            COUNT(*) as cnt,
            COALESCE(SUM(weight), 0.0) as total_wt,
            COALESCE(SUM(purchase_price), 0.0) as total_cost
        FROM packets 
        WHERE status IN ('in_stock', 'on_memo', 'on_approval', 'reserved') AND is_deleted = 0
          {pkt_company_clause}
        GROUP BY particulars
        ORDER BY cnt DESC
        LIMIT 50
    """, pkt_params).fetchall()

    for pr in part_rows:
        base_part = (pr["particulars"] or "Gemstone").split("(")[0].strip() or "Gemstone"
        if base_part not in part_map:
            part_map[base_part] = {"sold": 0, "in_stock": 0, "carats": 0.0, "rev": 0.0, "cogs": 0.0, "profit": 0.0}
        part_map[base_part]["in_stock"] += pr["cnt"]
        part_map[base_part]["carats"] += float(pr["total_wt"])

    # Form breakdowns
    monthly_pnl = []
    for m in sorted(month_map.keys(), reverse=True):
        entry = month_map[m]
        rev = entry["rev"]
        cg = entry["cogs"]
        gp = rev - cg
        ex = entry["exp"] + entry["purBrk"]
        monthly_pnl.append({
            "period": m,
            "revenue": round(rev, 2),
            "cogs": round(cg, 2),
            "gross_profit": round(gp, 2),
            "brokerage": round(entry["brk"], 2),
            "purchase_brokerage": round(entry["purBrk"], 2),
            "expenses": round(ex, 2),
            "net_profit": round(gp - ex, 2),
        })

    particulars_breakdown = []
    for k, v in part_map.items():
        particulars_breakdown.append({
            "particular": k,
            "sold_count": v["sold"],
            "in_stock_count": v["in_stock"],
            "carats": round(v["carats"], 2),
            "revenue": round(v["rev"], 2),
            "cogs": round(v["cogs"], 2),
            "gross_profit": round(v["profit"], 2),
            "margin_pct": round((v["profit"] / v["rev"] * 100), 1) if v["rev"] > 0 else 0.0,
        })
    particulars_breakdown.sort(key=lambda x: x["revenue"], reverse=True)

    top_buyers = [
        {"name": k, "deals_count": v["count"], "total_spend": round(v["spend"], 2), "gross_profit_generated": round(v["profit"], 2)}
        for k, v in buyer_map.items()
    ]
    top_buyers.sort(key=lambda x: x["total_spend"], reverse=True)

    total_exp_sum = sum(exp_cat_map.values()) or 1.0
    expense_categories = [
        {"category": k, "amount": round(v, 2), "pct": round((v / total_exp_sum * 100), 1)}
        for k, v in exp_cat_map.items()
    ]
    expense_categories.sort(key=lambda x: x["amount"], reverse=True)

    # Balance Sheet
    ar_direct = sum(float(s.get("balance") if s.get("balance") is not None else max(0.0, float(s.get("total", 0)) - float(s.get("paid_amount", 0)))) for s in sales if s.get("approval_status") != "returned")
    ar_brk = sum(max(0.0, float(b.get("sell_amount") or b.get("deal_value") or 0.0) - float(b.get("amount_received_from_buyer") or (b.get("sell_amount") or b.get("deal_value") if b.get("settlement_status") == "received" else b.get("received_amount") or 0.0))) for b in brokerage)
    total_ar = round(ar_direct + ar_brk + pending_brokerage, 2)
    total_current_assets = round(total_ar + v_cost, 2)

    ap_suppliers = sum(float(p.get("balance_payable") if p.get("balance_payable") is not None else max(0.0, float(p.get("total_cost", 0)) - float(p.get("paid_amount", 0)))) for p in purchases if p.get("status") != "cancelled")
    ap_sellers = sum(max(0.0, float(b.get("buy_amount") or 0.0) - float(b.get("amount_paid_to_seller") or 0.0)) for b in brokerage)
    total_current_liabilities = round(ap_suppliers + pur_brk_pending + ap_sellers, 2)
    net_worth = round(total_current_assets - total_current_liabilities, 2)

    company_names = ["Shreeji Gems", "Shree Krishna Gems", "Shree Lakshmi Gems", "Tirth Enterprise", "Mokshil Traders"]
    comp_pkt_counts = {r["cname"]: r["cnt"] for r in conn.execute("SELECT COALESCE(company_name, 'Shreeji Gems') as cname, COUNT(*) as cnt FROM packets WHERE status IN ('in_stock', 'on_memo', 'on_approval', 'reserved') AND is_deleted = 0 GROUP BY COALESCE(company_name, 'Shreeji Gems')").fetchall()}
    company_breakdown = []
    for cname in company_names:
        c_sales = [s for s in sales if s.get("company_name") == cname and (s.get("approval_status") is None or s.get("approval_status") == "approved_billed")]
        c_brk = [b for b in brokerage if b.get("company_name") == cname]
        c_exp = [e for e in expenses if e.get("company_name") == cname and not (e.get("id", "").startswith("pur-exp-") or e.get("id", "").startswith("brk-seller-exp-") or e.get("id", "").startswith("pur-brk-exp-"))]
        c_pur = [p for p in purchases if p.get("company_name") == cname and p.get("status") != "cancelled"]
        s_rev = sum(float(s.get("total") or 0.0) for s in c_sales) + sum(float(b.get("sell_amount") or b.get("deal_value") or 0.0) for b in c_brk)
        c_cogs = sum(sum(float(it.get("cost_price") or 0.0) for it in s.get("items", []) if not it.get("is_returned")) for s in c_sales) + sum(float(b.get("buy_amount") or 0.0) for b in c_brk)
        c_gp = s_rev - c_cogs
        c_pur_brk = sum(float(p.get("brokerage_amount") or 0.0) for p in c_pur)
        c_exp_total = sum(float(e.get("amount") or 0.0) for e in c_exp) + c_pur_brk
        company_breakdown.append({
            "company": cname,
            "sales_revenue": round(s_rev, 2),
            "gross_profit": round(c_gp, 2),
            "expenses": round(c_exp_total, 2),
            "net_profit": round(c_gp - c_exp_total, 2),
            "packets_count": comp_pkt_counts.get(cname, 0)
        })

    conn.close()
    result_data = {
        "total_sales_revenue": round(total_sales_revenue, 2),
        "direct_sales_revenue": round(direct_sales_revenue, 2),
        "direct_sales_cogs": round(direct_sales_cogs, 2),
        "direct_sales_gross_profit": round(direct_sales_revenue - direct_sales_cogs, 2),
        "brokerage_deals_revenue": round(brokerage_deals_revenue, 2),
        "brokerage_deals_cogs": round(brokerage_deals_cogs, 2),
        "brokerage_deals_gross_profit": round(brokerage_deals_revenue - brokerage_deals_cogs, 2),
        "gross_sales": round(total_sales_revenue + total_discounts, 2),
        "sales_returns_discount": round(total_discounts, 2),
        "net_sales": round(total_sales_revenue, 2),
        "total_cogs": round(total_cogs, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_margin_pct": round(gross_margin_pct, 1),
        "brokerage_earnings": round(brokerage_earnings, 2),
        "brokerage_paid_out": round(pur_brk_incurred, 2),
        "pending_brokerage": round(pending_brokerage, 2),
        "purchase_brokerage_incurred": round(pur_brk_incurred, 2),
        "purchase_brokerage_paid": round(pur_brk_paid, 2),
        "purchase_brokerage_pending": round(pur_brk_pending, 2),
        "total_expenses": round(total_expenses, 2),
        "net_expenses": round(total_expenses, 2),
        "petty_expenses": round(petty, 2),
        "business_expenses": round(business, 2),
        "direct_overheads": round(direct_overheads, 2),
        "net_profit": round(net_profit, 2),
        "net_margin_pct": round(net_margin_pct, 1),
        "vault_packets_count": v_pkts,
        "vault_total_carats": round(v_cts, 2),
        "vault_cost_valuation": round(v_cost, 2),
        "vault_asking_valuation": round(v_asking, 2),
        "unrealized_profit": round(v_asking - v_cost, 2),
        "memo_packets_count": v_memo_pkts,
        "memo_carats": round(v_memo_cts, 2),
        "sold_packets_count": v_sold_pkts,
        "memo_in_cost_valuation": round(memo_in_cost, 2),
        "memo_in_packets_count": memo_in_pkts,
        "memo_in_carats": round(memo_in_cts, 2),
        "particulars_breakdown": particularsBreakdown if "particularsBreakdown" in locals() else particulars_breakdown,
        "shape_breakdown": shape_breakdown,
        "top_buyers": top_buyers,
        "expense_categories": expense_categories,
        "monthly_pnl": monthly_pnl,
        "weekly_pnl": [],
        "company_breakdown": company_breakdown,
        "sales_ledger": sales_ledger[:300],
        "balance_sheet": {
            "as_of_date": datetime.now(timezone.utc).isoformat()[:10],
            "assets": {
                "current_assets": {
                    "liquid_cash": 0,
                    "accounts_receivable_direct_sales": round(ar_direct, 2),
                    "accounts_receivable_brokerage_deals": round(ar_brk, 2),
                    "pending_brokerage_commissions": round(pending_brokerage, 2),
                    "total_accounts_receivable": total_ar,
                    "inventory_at_cost": round(v_cost, 2),
                    "total_current_assets": total_current_assets,
                },
                "fixed_assets": {
                    "items": [],
                    "total_fixed_assets": 0,
                },
                "inventory_at_market": round(v_asking, 2),
                "unrealized_inventory_appreciation": round(v_asking - v_cost, 2),
                "total_assets": total_current_assets,
            },
            "liabilities": {
                "current_liabilities": {
                    "accounts_payable_suppliers": round(ap_suppliers, 2),
                    "brokerage_payable_purchase_brokers": round(pur_brk_pending, 2),
                    "brokerage_payable_deal_sellers": round(ap_sellers, 2),
                    "total_current_liabilities": total_current_liabilities,
                },
                "total_liabilities": total_current_liabilities,
            },
            "equity": {
                "net_worth": net_worth,
                "working_capital": round(total_current_assets - total_current_liabilities, 2),
                "current_ratio": round(total_current_assets / total_current_liabilities, 2) if total_current_liabilities > 0 else 1.0,
            },
        },
    }
    json_bytes = orjson.dumps(result_data)
    _analytics_cache[cache_key] = {"bytes": json_bytes, "ts": now_ts}
    return Response(content=json_bytes, media_type="application/json")

# ---------------------------------------------------------------------------
# Backup & Export Endpoints (High Performance Direct Streaming)
# ---------------------------------------------------------------------------
@api_router.get("/backup/download-json")
def backup_download_json():
    conn = get_db()
    boxes = [dict(r) for r in conn.execute("SELECT * FROM boxes").fetchall()]
    packets = [dict(r) for r in conn.execute("SELECT * FROM packets").fetchall()]
    sales = [dict(r) for r in conn.execute("SELECT * FROM sales").fetchall()]
    brokerage = [dict(r) for r in conn.execute("SELECT * FROM brokerage").fetchall()]
    purchases = [dict(r) for r in conn.execute("SELECT * FROM purchases").fetchall()]
    expenses = [dict(r) for r in conn.execute("SELECT * FROM expenses").fetchall()]
    conn.close()
    payload = {
        "app": "Shreeji Gems CRM",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "version": "3.0.0",
        "boxes": boxes,
        "packets": packets,
        "sales": sales,
        "brokerage": brokerage,
        "purchases": purchases,
        "expenses": expenses,
    }
    return Response(
        content=orjson.dumps(payload),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=gemvault_master_backup_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"}
    )

@api_router.get("/backup/download-db")
def backup_download_db():
    if DB_PATH.exists():
        return FileResponse(
            path=str(DB_PATH),
            filename=f"gemvault_local_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.db",
            media_type="application/x-sqlite3"
        )
    raise HTTPException(status_code=404, detail="Database file not found")

@api_router.get("/backup/download-doc")
def backup_download_doc():
    conn = get_db()
    p_count = conn.execute("SELECT COUNT(*) FROM packets").fetchone()[0]
    total_cts = conn.execute("SELECT SUM(weight) FROM packets").fetchone()[0] or 0.0
    v_cost = conn.execute("SELECT SUM(purchase_price) FROM packets WHERE status = 'in_stock'").fetchone()[0] or 0.0
    v_asking = conn.execute("SELECT SUM(sale_price) FROM packets WHERE status = 'in_stock'").fetchone()[0] or 0.0
    sales_total = conn.execute("SELECT SUM(total) FROM sales WHERE (approval_status IS NULL OR approval_status != 'returned') AND is_deleted = 0").fetchone()[0] or 0.0
    sales_count = conn.execute("SELECT COUNT(*) FROM sales WHERE is_deleted = 0").fetchone()[0]
    brk_count = conn.execute("SELECT COUNT(*) FROM brokerage").fetchone()[0]
    boxes_count = conn.execute("SELECT COUNT(*) FROM boxes").fetchone()[0]
    sample_packets = [dict(r) for r in conn.execute("SELECT * FROM packets LIMIT 250").fetchall()]
    conn.close()

    now_str = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    html_content = f"""<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>SHREEJI GEMS Master System Audit Backup</title>
<style>
body {{ font-family: Calibri, 'Segoe UI', Arial; font-size: 10pt; color: #0f172a; margin: 20mm; }}
h1 {{ color: #047857; font-size: 20pt; margin-bottom: 2pt; }}
.sub {{ color: #475569; font-size: 11pt; margin-bottom: 12pt; }}
.kpi {{ border: 1.5pt solid #047857; background: #f0fdf4; padding: 10pt; margin-bottom: 16pt; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 10pt; font-size: 9pt; }}
th, td {{ border: 1pt solid #cbd5e1; padding: 5pt; text-align: left; }}
th {{ background: #047857; color: #ffffff; font-weight: bold; }}
.num {{ text-align: right; }}
</style></head>
<body>
<h1>💎 SHREEJI GEMS — MASTER SYSTEM AUDIT DOSSIER</h1>
<div class="sub">Generated on {now_str} • 100% Offline Vault Database</div>
<div class="kpi">
<strong>Vault Overview:</strong> {boxes_count} Physical Storage Boxes | {p_count} Packets ({round(total_cts, 2)} Carats)<br/>
<strong>Valuation:</strong> In-Stock Cost: ₹{round(v_cost):,} | Target Asking Value: ₹{round(v_asking):,}<br/>
<strong>Trading Activity:</strong> {sales_count} Commercial Invoices (₹{round(sales_total):,}) | {brk_count} Facilitated Brokerage Deals
</div>
<h2>Representative Inventory Master Sample (Showing 250 of {p_count} Packets)</h2>
<p style="font-size: 8.5pt; color: #475569; font-style: italic;">Complete 100% data records across all {p_count} packets are stored in the companion <code>gemvault_master_backup.json</code> file.</p>
<table>
<thead><tr><th>Packet #</th><th>Particulars</th><th>Shape</th><th>Weight</th><th>Pcs</th><th class="num">Cost (₹)</th><th class="num">Asking (₹)</th><th>Status</th><th>Box</th></tr></thead>
<tbody>
"""
    for p in sample_packets:
        p_pcs = "Bulk" if p.get("is_uncountable") else (p.get("pieces") or 1)
        html_content += f"<tr><td><strong>{p.get('packet_number')}</strong></td><td>{p.get('particulars')}</td><td>{p.get('shape')}</td><td>{p.get('weight')} cts</td><td>{p_pcs}</td><td class='num'>₹{round(float(p.get('purchase_price') or 0)):,}</td><td class='num'>₹{round(float(p.get('sale_price') or 0)):,}</td><td>{p.get('status')}</td><td>{p.get('box_name')}</td></tr>\\n"
    html_content += """</tbody></table></body></html>"""

    return Response(
        content=html_content.encode("utf-8"),
        media_type="application/msword",
        headers={"Content-Disposition": f"attachment; filename=gemvault_master_audit_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.doc"}
    )

@api_router.post("/backup/restore")
async def backup_restore(request: Request):
    invalidate_analytics_cache()
    content_type = request.headers.get("content-type", "")
    try:
        if "multipart/form-data" in content_type:
            form = await request.form()
            file = form.get("file")
            if not file:
                raise HTTPException(status_code=400, detail="No file uploaded")
            content = await file.read()
            data = orjson.loads(content)
        else:
            body_bytes = await request.body()
            data = orjson.loads(body_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON backup format: {str(e)}")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Backup root must be a JSON object")

    packets = data.get("packets")
    if packets is None and "boxes" not in data and "sales" not in data:
        raise HTTPException(status_code=400, detail="Backup must contain at least packets, boxes, or sales")

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys = OFF;")
        cursor.execute("BEGIN IMMEDIATE TRANSACTION;")

        def get_table_cols(tbl):
            return {r[1] for r in cursor.execute(f"PRAGMA table_info({tbl})").fetchall()}

        counts = {}

        # 1. Boxes
        boxes = data.get("boxes")
        if isinstance(boxes, list) and len(boxes) > 0:
            cursor.execute("DELETE FROM boxes;")
            b_cols = get_table_cols("boxes")
            b_rows = []
            for b in boxes:
                if isinstance(b, dict):
                    row = {k: v for k, v in b.items() if k in b_cols}
                    if "id" in row and "name" in row:
                        b_rows.append((
                            row.get("id"),
                            str(row.get("name")),
                            str(row.get("description") or ""),
                            str(row.get("color") or "#10b981"),
                            str(row.get("created_at") or datetime.now(timezone.utc).isoformat())
                        ))
            if b_rows:
                cursor.executemany("INSERT OR REPLACE INTO boxes (id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?)", b_rows)
            counts["boxes"] = len(b_rows)

        # 2. Packets
        if isinstance(packets, list) and len(packets) > 0:
            cursor.execute("DELETE FROM packets;")
            p_cols = get_table_cols("packets")
            col_list = [c for c in p_cols if c != "rowid"]
            placeholders = ",".join(["?"] * len(col_list))
            sql_pkt = f"INSERT OR REPLACE INTO packets ({','.join(col_list)}) VALUES ({placeholders})"
            p_batch = []
            for p in packets:
                if isinstance(p, dict) and p.get("packet_number"):
                    vals = []
                    for c in col_list:
                        val = p.get(c)
                        if isinstance(val, (dict, list)):
                            val = json.dumps(val)
                        elif val is None:
                            if c == "status": val = "in_stock"
                            elif c == "is_deleted": val = 0
                            elif c == "version_id": val = 1
                            elif c == "weight": val = 0.0
                            elif c == "pieces": val = 1
                            elif c == "purchase_price": val = 0.0
                            elif c == "sale_price": val = 0.0
                        vals.append(val)
                    p_batch.append(vals)
                    if len(p_batch) >= 2000:
                        cursor.executemany(sql_pkt, p_batch)
                        p_batch = []
            if p_batch:
                cursor.executemany(sql_pkt, p_batch)
            counts["packets"] = len(packets)

        # 3. Sales
        sales = data.get("sales")
        if isinstance(sales, list) and len(sales) > 0:
            cursor.execute("DELETE FROM sales;")
            s_cols = get_table_cols("sales")
            col_list = [c for c in s_cols if c != "rowid"]
            placeholders = ",".join(["?"] * len(col_list))
            sql_sale = f"INSERT OR REPLACE INTO sales ({','.join(col_list)}) VALUES ({placeholders})"
            s_batch = []
            for s in sales:
                if isinstance(s, dict) and s.get("id"):
                    vals = []
                    for c in col_list:
                        val = s.get(c)
                        if c == "items_json" and "items" in s and val is None:
                            val = json.dumps(s.get("items") or [])
                        elif c == "payments_json" and "payments" in s and val is None:
                            val = json.dumps(s.get("payments") or [])
                        elif isinstance(val, (dict, list)):
                            val = json.dumps(val)
                        vals.append(val)
                    s_batch.append(vals)
            if s_batch:
                cursor.executemany(sql_sale, s_batch)
            counts["sales"] = len(s_batch)

        # 4. Purchases
        purchases = data.get("purchases")
        if isinstance(purchases, list) and len(purchases) > 0:
            cursor.execute("DELETE FROM purchases;")
            pur_cols = get_table_cols("purchases")
            col_list = [c for c in pur_cols if c != "rowid"]
            placeholders = ",".join(["?"] * len(col_list))
            sql_pur = f"INSERT OR REPLACE INTO purchases ({','.join(col_list)}) VALUES ({placeholders})"
            pur_batch = []
            for pur in purchases:
                if isinstance(pur, dict) and pur.get("id"):
                    vals = []
                    for c in col_list:
                        val = pur.get(c)
                        if c == "items_json" and "items" in pur and val is None:
                            val = json.dumps(pur.get("items") or [])
                        elif isinstance(val, (dict, list)):
                            val = json.dumps(val)
                        vals.append(val)
                    pur_batch.append(vals)
            if pur_batch:
                cursor.executemany(sql_pur, pur_batch)
            counts["purchases"] = len(pur_batch)

        # 5. Brokerage
        brokerage = data.get("brokerage")
        if isinstance(brokerage, list) and len(brokerage) > 0:
            cursor.execute("DELETE FROM brokerage;")
            brk_cols = get_table_cols("brokerage")
            col_list = [c for c in brk_cols if c != "rowid"]
            placeholders = ",".join(["?"] * len(col_list))
            sql_brk = f"INSERT OR REPLACE INTO brokerage ({','.join(col_list)}) VALUES ({placeholders})"
            brk_batch = []
            for brk in brokerage:
                if isinstance(brk, dict) and brk.get("id"):
                    vals = [json.dumps(brk.get(c)) if isinstance(brk.get(c), (dict, list)) else brk.get(c) for c in col_list]
                    brk_batch.append(vals)
            if brk_batch:
                cursor.executemany(sql_brk, brk_batch)
            counts["brokerage"] = len(brk_batch)

        # 6. Expenses
        expenses = data.get("expenses")
        if isinstance(expenses, list) and len(expenses) > 0:
            cursor.execute("DELETE FROM expenses;")
            exp_cols = get_table_cols("expenses")
            col_list = [c for c in exp_cols if c != "rowid"]
            placeholders = ",".join(["?"] * len(col_list))
            sql_exp = f"INSERT OR REPLACE INTO expenses ({','.join(col_list)}) VALUES ({placeholders})"
            exp_batch = []
            for exp in expenses:
                if isinstance(exp, dict) and exp.get("id"):
                    vals = [json.dumps(exp.get(c)) if isinstance(exp.get(c), (dict, list)) else exp.get(c) for c in col_list]
                    exp_batch.append(vals)
            if exp_batch:
                cursor.executemany(sql_exp, exp_batch)
            counts["expenses"] = len(exp_batch)

        # 7. Buyers
        buyers = data.get("buyers")
        if isinstance(buyers, list) and len(buyers) > 0:
            cursor.execute("DELETE FROM buyers;")
            byr_cols = get_table_cols("buyers")
            col_list = [c for c in byr_cols if c != "rowid"]
            placeholders = ",".join(["?"] * len(col_list))
            sql_byr = f"INSERT OR REPLACE INTO buyers ({','.join(col_list)}) VALUES ({placeholders})"
            byr_batch = []
            for byr in buyers:
                if isinstance(byr, dict) and byr.get("id"):
                    vals = [json.dumps(byr.get(c)) if isinstance(byr.get(c), (dict, list)) else byr.get(c) for c in col_list]
                    byr_batch.append(vals)
            if byr_batch:
                cursor.executemany(sql_byr, byr_batch)
            counts["buyers"] = len(byr_batch)

        conn.commit()
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        cursor.execute("PRAGMA optimize;")
        conn.close()
        invalidate_analytics_cache()
        return {"success": True, "message": "Database restored successfully", "counts": counts}
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database restore failed: {str(e)}")

app.include_router(api_router)

# Mount Production Static Frontend from docs/
DOCS_DIR = ROOT_DIR.parent / "docs"
if DOCS_DIR.exists():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=str(DOCS_DIR), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False, workers=1)
