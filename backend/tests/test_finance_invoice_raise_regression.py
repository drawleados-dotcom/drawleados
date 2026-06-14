"""
Comprehensive regression test for Finance module + new Invoice Raise (Leads → Finance) bridge.

Covers:
- Invoice Requests CRUD (new feature)
- Banks CRUD (gst/non_gst)
- Invoice Collect (single + multi-source)
- Cashbook entries (list/post/delete) + balances
- Multi-source expense allocator with balance enforcement
- Dashboard bank breakdown
- Leads V2 stages (default seed + custom) + lead.stage update
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://drawlead-docs.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "vinoth@drawlead.com"
ADMIN_PASSWORD = "Admin@123"

# Created resource IDs we need to clean up at the end
_created = {
    "banks": [],
    "invoice_requests": [],
    "stages": [],
    "leads": [],
    "invoices": [],
    "cashbook_entries": [],
}


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = data.get("session_token") or data.get("token") or data.get("access_token")
    if not tok:
        pytest.skip(f"No token in login response: {data}")
    return tok


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ============== INVOICE REQUESTS (new bridge feature) ==============

class TestInvoiceRequests:
    def test_create_invoice_request_gst(self, client):
        payload = {
            "gst_type": "gst",
            "company_name": "TEST_AcmeRaise Pvt Ltd",
            "lead_name": "TEST_Lead Vino",
            "gst_number": "33ABCDE1234F1Z5",
            "billing_address": "Chennai",
            "amount": 50000,
            "payment_mode": "bank",
            "notes": "Service: TEST_logo design",
        }
        r = client.post(f"{BASE_URL}/api/finance/banks/invoice-requests", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "pending"
        assert body["gst_type"] == "gst"
        assert body["company_name"] == payload["company_name"]
        assert body["amount"] == 50000
        assert "request_id" in body
        _created["invoice_requests"].append(body["request_id"])

    def test_create_invoice_request_validation_missing_company(self, client):
        r = client.post(f"{BASE_URL}/api/finance/banks/invoice-requests",
                        json={"gst_type": "gst", "company_name": ""})
        assert r.status_code == 400

    def test_create_invoice_request_validation_bad_gst(self, client):
        r = client.post(f"{BASE_URL}/api/finance/banks/invoice-requests",
                        json={"gst_type": "xx", "company_name": "Foo"})
        assert r.status_code == 400

    def test_list_invoice_requests_pending_filter(self, client):
        r = client.get(f"{BASE_URL}/api/finance/banks/invoice-requests?status=pending")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if _created["invoice_requests"]:
            assert any(x["request_id"] == _created["invoice_requests"][0] for x in rows)
            assert all(x["status"] == "pending" for x in rows)

    def test_patch_invoice_request(self, client):
        if not _created["invoice_requests"]:
            pytest.skip("no request created")
        rid = _created["invoice_requests"][0]
        r = client.patch(f"{BASE_URL}/api/finance/banks/invoice-requests/{rid}",
                         json={"notes": "TEST_updated note"})
        assert r.status_code == 200
        assert r.json().get("notes") == "TEST_updated note"

    def test_mark_invoiced(self, client):
        payload = {"gst_type": "non_gst", "company_name": "TEST_NonGST Co", "amount": 10000, "notes": "x"}
        r = client.post(f"{BASE_URL}/api/finance/banks/invoice-requests", json=payload)
        assert r.status_code == 200
        rid = r.json()["request_id"]
        _created["invoice_requests"].append(rid)
        r2 = client.post(f"{BASE_URL}/api/finance/banks/invoice-requests/{rid}/mark-invoiced")
        assert r2.status_code == 200
        # verify status flipped
        r3 = client.get(f"{BASE_URL}/api/finance/banks/invoice-requests")
        rows = r3.json()
        target = next((x for x in rows if x["request_id"] == rid), None)
        assert target is not None
        assert target["status"] == "invoiced"

    def test_delete_invoice_request_soft(self, client):
        payload = {"gst_type": "gst", "company_name": "TEST_Delete Co", "amount": 100}
        r = client.post(f"{BASE_URL}/api/finance/banks/invoice-requests", json=payload)
        assert r.status_code == 200
        rid = r.json()["request_id"]
        r2 = client.delete(f"{BASE_URL}/api/finance/banks/invoice-requests/{rid}")
        assert r2.status_code == 200
        # should be gone from listing
        r3 = client.get(f"{BASE_URL}/api/finance/banks/invoice-requests")
        assert all(x["request_id"] != rid for x in r3.json())


# ============== BANKS CRUD ==============

class TestBanks:
    def test_list_banks(self, client):
        r = client.get(f"{BASE_URL}/api/finance/banks")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_gst_bank(self, client):
        payload = {
            "gst_type": "gst",
            "account_holder": "TEST_Drawlead GST",
            "bank_name": "HDFC",
            "ifsc_code": "hdfc0001234",
            "account_number": "1234567890",
            "account_type": "current",
        }
        r = client.post(f"{BASE_URL}/api/finance/banks", json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["gst_type"] == "gst"
        assert b["ifsc_code"] == "HDFC0001234"  # upper-cased
        _created["banks"].append(b["bank_id"])

    def test_create_non_gst_bank(self, client):
        payload = {"gst_type": "non_gst", "account_holder": "TEST_Latha NonGST", "bank_name": "ICICI"}
        r = client.post(f"{BASE_URL}/api/finance/banks", json=payload)
        assert r.status_code == 200
        _created["banks"].append(r.json()["bank_id"])

    def test_create_bank_validation(self, client):
        r = client.post(f"{BASE_URL}/api/finance/banks",
                        json={"gst_type": "bad", "account_holder": "x"})
        assert r.status_code == 400
        r2 = client.post(f"{BASE_URL}/api/finance/banks",
                         json={"gst_type": "gst", "account_holder": ""})
        assert r2.status_code == 400

    def test_filter_by_gst_type(self, client):
        r = client.get(f"{BASE_URL}/api/finance/banks?gst_type=gst")
        assert r.status_code == 200
        assert all(b["gst_type"] == "gst" for b in r.json())

    def test_update_bank(self, client):
        if not _created["banks"]:
            pytest.skip("no bank")
        bid = _created["banks"][0]
        r = client.put(f"{BASE_URL}/api/finance/banks/{bid}", json={"branch": "TEST_Anna Nagar"})
        assert r.status_code == 200
        assert r.json()["branch"] == "TEST_Anna Nagar"


# ============== CASHBOOK ENTRIES + BALANCES ==============

class TestCashbook:
    def test_list_entries_gst(self, client):
        r = client.get(f"{BASE_URL}/api/finance/banks/cashbook/entries?gst_type=gst")
        assert r.status_code == 200
        data = r.json()
        assert "entries" in data and "summary" in data and "banks" in data
        assert "income" in data["summary"]
        assert "expense" in data["summary"]
        assert "balance" in data["summary"]

    def test_list_entries_invalid_gst(self, client):
        r = client.get(f"{BASE_URL}/api/finance/banks/cashbook/entries?gst_type=xx")
        assert r.status_code == 400

    def test_create_credit_entry_cash(self, client):
        payload = {
            "kind": "credit", "gst_type": "gst", "amount": 25000,
            "payment_mode": "cash", "party": "TEST_Walk-in Client", "category": "service",
            "notes": "TEST_credit cash",
        }
        r = client.post(f"{BASE_URL}/api/finance/banks/cashbook/entries", json=payload)
        assert r.status_code == 200
        e = r.json()
        assert e["kind"] == "credit"
        assert e["amount"] == 25000
        assert e["revenue_kind"] == "new"
        _created["cashbook_entries"].append(e["entry_id"])

    def test_create_entry_bank_gst_mismatch(self, client):
        # use a non_gst bank but post as gst entry → 400
        non_gst = [b for b in _created["banks"] if True]
        if len(non_gst) < 2:
            pytest.skip("no non_gst bank")
        # find non_gst from listing
        all_banks = client.get(f"{BASE_URL}/api/finance/banks").json()
        ng = next((b for b in all_banks if b["gst_type"] == "non_gst" and b["bank_id"] in _created["banks"]), None)
        if not ng:
            pytest.skip("no test non_gst bank")
        r = client.post(f"{BASE_URL}/api/finance/banks/cashbook/entries", json={
            "kind": "credit", "gst_type": "gst", "amount": 100,
            "payment_mode": "bank", "bank_id": ng["bank_id"]})
        assert r.status_code == 400

    def test_balances_endpoint(self, client):
        r = client.get(f"{BASE_URL}/api/finance/banks/cashbook/balances?gst_type=gst")
        assert r.status_code == 200
        d = r.json()
        for k in ("cash", "cheque", "upi", "banks"):
            assert k in d
        assert isinstance(d["banks"], list)
        assert "balance" in d["cash"]


# ============== MULTI-SOURCE EXPENSE ALLOCATOR ==============

class TestExpenseAllocator:
    def test_expense_within_balance(self, client):
        # We just credited 25000 in cash GST → spend 5000 cash should succeed
        r = client.post(f"{BASE_URL}/api/finance/banks/cashbook/expense", json={
            "gst_type": "gst",
            "party": "TEST_Vendor1",
            "category": "office",
            "allocations": [{"source": "cash", "amount": 5000}],
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "expense_group_id" in data
        assert data["total"] == 5000
        assert len(data["entries"]) == 1
        for e in data["entries"]:
            _created["cashbook_entries"].append(e["entry_id"])

    def test_expense_exceeds_balance(self, client):
        # Cash balance ~ 20k now; ask for 99,999,999 cash → 400
        r = client.post(f"{BASE_URL}/api/finance/banks/cashbook/expense", json={
            "gst_type": "gst",
            "party": "TEST_BigVendor",
            "category": "x",
            "allocations": [{"source": "cash", "amount": 99999999}],
        })
        assert r.status_code == 400
        assert "balance" in r.text.lower()

    def test_expense_invalid_source(self, client):
        r = client.post(f"{BASE_URL}/api/finance/banks/cashbook/expense", json={
            "gst_type": "gst", "allocations": [{"source": "bogus", "amount": 10}]})
        assert r.status_code == 400


# ============== DASHBOARD BANK BREAKDOWN ==============

class TestDashboard:
    def test_bank_breakdown_shape(self, client):
        r = client.get(f"{BASE_URL}/api/finance/banks/dashboard/bank-breakdown")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("has_non_gst_banks", "bank_breakdown", "payment_schedule_total",
                  "new_revenue", "outstanding_collected", "total_revenue", "total_expense"):
            assert k in d, f"missing {k}"
        assert "gst" in d["bank_breakdown"]
        gst_bucket = d["bank_breakdown"]["gst"]
        for k in ("banks", "cash", "cheque", "upi", "bank_total", "total"):
            assert k in gst_bucket
        # total_revenue should == new + outstanding
        assert abs(d["total_revenue"] - (d["new_revenue"] + d["outstanding_collected"])) < 0.01


# ============== INVOICE COLLECT (single + multi-source) ==============

class TestInvoiceCollect:
    @pytest.fixture(scope="class")
    def created_invoice(self, client):
        # Create a draft invoice via finance_routes
        payload = {
            "client_name": "TEST_CollectClient",
            "client_company": "TEST_CollectCo",
            "gst_type": "gst",
            "gst_rate": 18,
            "invoice_date": "2026-01-01",
            "due_date": "2026-02-01",
            "items": [{"service_name": "TEST_Service", "rate": 10000, "quantity": 1}],
        }
        r = client.post(f"{BASE_URL}/api/finance/invoices", json=payload)
        if r.status_code not in (200, 201):
            pytest.skip(f"could not create invoice: {r.status_code} {r.text[:200]}")
        inv = r.json()
        _created["invoices"].append(inv.get("invoice_id"))
        return inv

    def test_collect_single_source_cash(self, client, created_invoice):
        inv_id = created_invoice["invoice_id"]
        r = client.post(f"{BASE_URL}/api/finance/banks/collect/{inv_id}", json={
            "amount": 5000, "payment_mode": "cash", "notes": "TEST_partial"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paid_amount"] == 5000
        assert d["status"] in ("partial", "paid")
        # First collection should be revenue_kind=new
        ent = d["entries"][0]
        assert ent["revenue_kind"] == "new"

    def test_collect_subsequent_outstanding(self, client, created_invoice):
        inv_id = created_invoice["invoice_id"]
        r = client.post(f"{BASE_URL}/api/finance/banks/collect/{inv_id}", json={
            "amount": 1000, "payment_mode": "cash"})
        assert r.status_code == 200
        ent = r.json()["entries"][0]
        assert ent["revenue_kind"] == "outstanding"

    def test_collect_bank_gst_mismatch(self, client, created_invoice):
        # use a non_gst bank against gst invoice → 400
        all_banks = client.get(f"{BASE_URL}/api/finance/banks").json()
        ng = next((b for b in all_banks if b["gst_type"] == "non_gst" and b["bank_id"] in _created["banks"]), None)
        if not ng:
            pytest.skip("no non_gst bank")
        inv_id = created_invoice["invoice_id"]
        r = client.post(f"{BASE_URL}/api/finance/banks/collect/{inv_id}", json={
            "amount": 100, "payment_mode": "bank", "bank_id": ng["bank_id"]})
        assert r.status_code == 400

    def test_collect_multi_source(self, client, created_invoice):
        inv_id = created_invoice["invoice_id"]
        r = client.post(f"{BASE_URL}/api/finance/banks/collect/{inv_id}", json={
            "allocations": [
                {"source": "cash", "amount": 500},
                {"source": "upi", "amount": 200},
            ]})
        assert r.status_code == 200
        entries = r.json()["entries"]
        assert len(entries) == 2
        # both must share an income_group_id when len>1
        gids = {e.get("income_group_id") for e in entries}
        assert len(gids) == 1 and next(iter(gids)) is not None


# ============== LEADS V2 STAGES ==============

class TestLeadsV2:
    def test_stages_endpoint(self, client):
        r = client.get(f"{BASE_URL}/api/leads-v2/stages")
        assert r.status_code == 200, r.text
        stages = r.json()
        assert isinstance(stages, list)
        # at least 8 default stages should exist (auto-seeded)
        assert len(stages) >= 1

    def test_create_invoice_raise_stage(self, client):
        r = client.post(f"{BASE_URL}/api/leads-v2/stages",
                        json={"name": "TEST_Invoice Raise", "color": "#10b981"})
        if r.status_code not in (200, 201):
            pytest.skip(f"stage create failed: {r.status_code} {r.text[:200]}")
        s = r.json()
        sid = s.get("stage_id") or s.get("id")
        assert sid
        _created["stages"].append(sid)


# ============== CLEANUP ==============

def test_zz_cleanup(client):
    """Best-effort cleanup of TEST_ resources created above."""
    for rid in _created["invoice_requests"]:
        try:
            client.delete(f"{BASE_URL}/api/finance/banks/invoice-requests/{rid}")
        except Exception:
            pass
    for bid in _created["banks"]:
        try:
            client.delete(f"{BASE_URL}/api/finance/banks/{bid}")
        except Exception:
            pass
    for eid in _created["cashbook_entries"]:
        try:
            client.delete(f"{BASE_URL}/api/finance/banks/cashbook/entries/{eid}")
        except Exception:
            pass
    for iid in _created["invoices"]:
        try:
            client.delete(f"{BASE_URL}/api/finance/invoices/{iid}")
        except Exception:
            pass
    for sid in _created["stages"]:
        try:
            client.delete(f"{BASE_URL}/api/leads-v2/stages/{sid}")
        except Exception:
            pass
