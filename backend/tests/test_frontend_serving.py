import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_frontend_serving():
    res = client.get("/")
    assert res.status_code == 200
    content = res.text
    assert "Shreeji Gems" in content or "Gemstones CRM" in content
    print("✓ Frontend HTML served with status 200")
