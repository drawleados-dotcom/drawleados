"""
Backend tests for Finance Clients module (+ invoice client_id linkage).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://drawlead-docs.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("session_token")
    assert token, "No session_token in login response"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def created_client(session):
    tag = uuid.uuid4().hex[:6].upper()
    payload = {
        "customer_type": "Business",
        "salutation": "Mr.",
        "first_name": "John",
        "last_name": "Doe",
        "company_name": f"TEST_Acme_{tag}",
        "display_name": f"TEST_Acme_{tag}",
        "currency": "INR",
        "email": f"acme_{tag}@test.com",
        "work_phone": "+91-9999999999",
        "mobile": "+91-8888888888",
        "gst_treatment": "Registered Business - Regular",
        "place_of_supply": "Tamil Nadu",
        "gstin": "33AAAAA0000A1Z5",
        "pan": "AAAAA0000A",
        "tax_preference": "Taxable",
        "payment_terms": "Net 30",
        "enable_portal": False,
        "billing_address": "123 Street",
        "billing_city": "Chennai",
        "billing_state": "Tamil Nadu",
        "billing_pincode": "600001",
        "remarks": "Created from automated test",
    }
    r = session.post(f"{API}/finance/clients", json=payload, timeout=30)
    assert r.status_code == 200, f"Create client failed: {r.status_code} {r.text}"
    data = r.json()
    assert "client_id" in data
    assert data["display_name"] == payload["display_name"]
    assert data["email"] == payload["email"]
    assert data["gstin"] == payload["gstin"]
    yield data
    # cleanup
    try:
        session.delete(f"{API}/finance/clients/{data['client_id']}", timeout=30)
    except Exception:
        pass


def test_login_and_clients_list(session):
    r = session.get(f"{API}/finance/clients", timeout=30)
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    if arr:
        c = arr[0]
        assert "client_id" in c
        assert "display_name" in c
        assert "summary" in c
        for key in ("total_invoiced", "total_paid", "outstanding", "invoice_count"):
            assert key in c["summary"]


def test_create_client_persists(session, created_client):
    cid = created_client["client_id"]
    r = session.get(f"{API}/finance/clients/{cid}", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["client_id"] == cid
    assert "summary" in body
    assert body["summary"]["invoice_count"] == 0
    assert body["summary"]["total_invoiced"] == 0


def test_duplicate_display_name_returns_400(session, created_client):
    payload = {"display_name": created_client["display_name"]}
    r = session.post(f"{API}/finance/clients", json=payload, timeout=30)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_update_client(session, created_client):
    cid = created_client["client_id"]
    new_email = f"updated_{uuid.uuid4().hex[:5]}@test.com"
    r = session.put(f"{API}/finance/clients/{cid}", json={"email": new_email}, timeout=30)
    assert r.status_code == 200
    assert r.json()["email"] == new_email
    # verify
    r2 = session.get(f"{API}/finance/clients/{cid}", timeout=30)
    assert r2.json()["email"] == new_email


def test_migrate_idempotent(session):
    r1 = session.post(f"{API}/finance/clients/migrate-from-invoices", timeout=60)
    assert r1.status_code == 200
    body1 = r1.json()
    assert "created_clients" in body1
    # Run again - should not create any new clients
    r2 = session.post(f"{API}/finance/clients/migrate-from-invoices", timeout=60)
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2["created_clients"] == 0, f"Migration not idempotent: {body2}"


def test_invoice_with_client_id(session, created_client):
    cid = created_client["client_id"]
    # Create invoice linked to this client
    invoice_payload = {
        "client_id": cid,
        "client_name": created_client["display_name"],
        "client_email": created_client["email"],
        "client_state": "Tamil Nadu",
        "invoice_date": "2026-01-15",
        "due_date": "2026-02-14",
        "payment_terms": "Net 30",
        "items": [
            {
                "service_name": "Web Development",
                "description": "TEST",
                "quantity": 2,
                "rate": 5000,
                "discount_percentage": 10,
                "tax_rate": 18,
            }
        ],
        "currency": "INR",
        "status": "draft",
        "notes": "Test invoice",
    }
    r = session.post(f"{API}/finance/invoices", json=invoice_payload, timeout=30)
    assert r.status_code in (200, 201), f"Create invoice failed: {r.status_code} {r.text}"
    inv = r.json()
    inv_id = inv.get("invoice_id") or inv.get("id")
    assert inv.get("client_id") == cid, f"client_id not stored on invoice: {inv}"

    # Verify client summary reflects invoice
    r2 = session.get(f"{API}/finance/clients/{cid}/summary", timeout=30)
    assert r2.status_code == 200
    s = r2.json()
    assert s["summary"]["invoice_count"] >= 1
    assert s["summary"]["total_invoiced"] > 0
    assert len(s["invoices"]) >= 1

    # Delete should now be blocked (client has invoices)
    rd = session.delete(f"{API}/finance/clients/{cid}", timeout=30)
    assert rd.status_code == 400, f"Expected 400 (has invoices), got {rd.status_code}"

    # Cleanup the invoice
    if inv_id:
        session.delete(f"{API}/finance/invoices/{inv_id}", timeout=30)


def test_delete_client_with_no_invoices(session):
    # Create a fresh client and delete it
    name = f"TEST_DeleteMe_{uuid.uuid4().hex[:6]}"
    r = session.post(f"{API}/finance/clients", json={"display_name": name}, timeout=30)
    assert r.status_code == 200
    cid = r.json()["client_id"]
    rd = session.delete(f"{API}/finance/clients/{cid}", timeout=30)
    assert rd.status_code == 200
    # Verify gone
    rg = session.get(f"{API}/finance/clients/{cid}", timeout=30)
    assert rg.status_code == 404
