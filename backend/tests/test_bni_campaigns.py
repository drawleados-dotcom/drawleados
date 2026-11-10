"""
Unit tests for the BNI WhatsApp Campaigns helpers (pure functions — no
server, no DB, no Meta calls).
"""
import hashlib
import hmac
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import bni_campaign_routes as c  # noqa: E402


# ------------------------------------------------------------ normalize_phone

@pytest.mark.parametrize("raw,cc,expected", [
    ("971 55 840 8421", "971", "971558408421"),     # already has country code (12 digits)
    ("+971 55 840 8421", "91", "971558408421"),     # + wins over the default
    ("00971558408421", "91", "971558408421"),
    ("055 840 8421", "971", "971558408421"),        # local trunk 0
    ("558408421", "971", "971558408421"),           # bare UAE mobile
    ("98765 43210", "91", "919876543210"),          # bare Indian mobile
    ("09876543210", "91", "919876543210"),
    ("9876543210", "", ""),                         # no code to add -> unusable
    ("", "91", ""),
    ("12345", "91", ""),                            # too short even with code
])
def test_normalize_phone(raw, cc, expected):
    assert c.normalize_phone(raw, cc) == expected


# ------------------------------------------------------------ templates

def test_convert_tokens_numbers_by_first_appearance_and_dedupes():
    text, var_map = c.convert_tokens("Hi {{name}}, I saw {{company}} in {{ Category }}. Nice to meet you {{name}}!")
    assert text == "Hi {{1}}, I saw {{2}} in {{3}}. Nice to meet you {{1}}!"
    assert var_map == ["name", "brand_name", "category_name"]


def test_convert_tokens_rejects_unknown_and_positional():
    with pytest.raises(ValueError):
        c.convert_tokens("Hi {{nickname}} there")
    with pytest.raises(ValueError):
        c.convert_tokens("Hi {{1}} there")


def test_variable_values_and_render_with_fallbacks():
    entry = {"name": "Kartik  Karunakaran", "brand_name": "", "category_name": "Solar"}
    variables = [
        {"source": "name"},
        {"source": "brand_name", "fallback": "your business"},
        {"source": "custom", "value": "Drawlead"},
        {"source": "chapter_name"},  # blank, no fallback -> "there"
    ]
    vals = c.variable_values(entry, variables)
    assert vals == ["Kartik Karunakaran", "your business", "Drawlead", "there"]
    assert c.render_body("Hi {{1}} from {{3}} re {{2}} {{9}}", vals) == "Hi Kartik Karunakaran from Drawlead re your business {{9}}"


def test_count_variables():
    assert c.count_variables("Hi {{1}} and {{3}}") == 3
    assert c.count_variables("No vars") == 0


def test_parse_template_flags_media_header_unsupported():
    t = c._parse_template({"name": "x", "language": "en", "status": "APPROVED", "components": [
        {"type": "HEADER", "format": "IMAGE"}, {"type": "BODY", "text": "Hi {{1}}, hello"},
    ]})
    assert t["variable_count"] == 1 and t["supported"] is False


# ------------------------------------------------------------ statuses

def test_effective_response_follows_outreach_meeting_progress():
    assert c.effective_response("Replied", "Scheduled One to One") == "Scheduled One to One"
    assert c.effective_response("Scheduled One to One", "One to One Completed") == "One to One Completed"
    # Outreach status never drags a recipient backwards
    assert c.effective_response("One to One Completed", "Scheduled One to One") == "One to One Completed"
    assert c.effective_response("Interested", "Contacted") == "Interested"
    assert c.effective_response("Pending", "Not Interested") == "Not Interested"
    assert c.effective_response("Scheduled One to One", "Not Interested") == "Scheduled One to One"
    assert c.effective_response(None, "") == "Pending"


def test_classify_reply():
    assert c.classify_reply("STOP", False) == "Not Interested"
    assert c.classify_reply("Interested", True) == "Interested"
    assert c.classify_reply("Not now", True) == "Not Interested"
    # Free text is left for a human to judge
    assert c.classify_reply("yes interested, call me", False) is None


def test_inbound_text_types():
    assert c.inbound_text({"type": "text", "text": {"body": "hello"}}) == "hello"
    assert c.inbound_text({"type": "button", "button": {"text": "Interested", "payload": "x"}}) == "Interested"
    assert c.inbound_text({"type": "interactive", "interactive": {"button_reply": {"title": "Yes"}}}) == "Yes"
    assert c.inbound_text({"type": "image", "image": {"caption": "card"}}) == "[image] card"


def test_verify_signature():
    body = b'{"a":1}'
    sig = "sha256=" + hmac.new(b"secret", body, hashlib.sha256).hexdigest()
    assert c.verify_signature("secret", body, sig)
    assert not c.verify_signature("secret", body, "sha256=bad")
    assert c.verify_signature("", body, "")  # no secret configured -> not enforced


def test_stats_are_cumulative_and_rates():
    st = c._empty_stats()
    rows = [
        ({"send_status": "read", "replied_at": "t", "response_status": "Replied"}, "One to One Completed"),
        ({"send_status": "delivered", "replied_at": "t", "response_status": "Interested"}, "Contacted"),
        ({"send_status": "sent", "replied_at": None, "response_status": "Pending"}, "Contacted"),
        ({"send_status": "failed"}, ""),
        ({"send_status": "queued"}, ""),
    ]
    for r, os_ in rows:
        c._add_to_stats(st, r, os_)
    c._finish_stats(st)
    assert st["total"] == 5 and st["contacted"] == 3 and st["failed"] == 1 and st["queued"] == 1
    assert st["delivered"] == 2 and st["read"] == 1 and st["replied"] == 2 and st["not_replied"] == 1
    assert st["interested"] == 2 and st["scheduled"] == 1 and st["completed"] == 1
    assert st["reply_rate"] == 66.7 and st["meeting_rate"] == 33.3
