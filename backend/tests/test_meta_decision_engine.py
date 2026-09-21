"""
Unit tests for the Meta Ads decision engine (pure functions — no server, no DB).
The cases are the worked examples of the KEEP/SCALE/WATCH/OPTIMIZE/KILL
framework, all with a target CPL of ₹400.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import meta_decision_engine as engine  # noqa: E402

T = 400


def row(spend, leads, day="2026-09-20", **extra):
    return {"date": day, "total_spend": spend, "total_leads": leads, **extra}


def call(rows, prev_rows=None, age=10, min_q=30, target=T):
    cur = engine.aggregate(rows)
    prev = engine.aggregate(prev_rows) if prev_rows else None
    return engine.decide(cur, prev, target, min_q, age)


# ------------------------------------------------------------ aggregate

def test_aggregate_ratios_ignore_rows_that_did_not_report_them():
    rows = [
        row(1000, 5, impressions=10000, link_clicks=100, reach=8000, qualified_leads=4, appointments=2),
        row(1000, 5, day="2026-09-19"),  # second day: only leads + spend
    ]
    a = engine.aggregate(rows)
    assert a["spend"] == 2000 and a["leads"] == 10 and a["cpl"] == 200
    assert a["ctr"] == 1.0                       # 100 / 10,000 — the bare day is left out
    assert a["cpc"] == 10.0                      # 1000 / 100 clicks
    assert a["frequency"] == 1.25                # 10,000 / 8,000
    assert a["qualified_pct"] == 80.0            # 4 of the 5 leads that reported quality
    assert a["cost_per_qualified"] == 250.0
    assert a["cost_per_appointment"] == 500.0
    assert a["reported_days"] == 2


def test_aggregate_leaves_unreported_optionals_empty():
    a = engine.aggregate([row(500, 2)])
    assert a["ctr"] is None and a["frequency"] is None and a["qualified"] is None and a["appointments"] is None
    assert engine.aggregate([])["cpl"] is None


def test_window_bounds():
    b = engine.window_bounds("2026-09-20", 7)
    assert b == {"cur_from": "2026-09-14", "cur_to": "2026-09-20", "prev_from": "2026-09-07", "prev_to": "2026-09-13"}


# ---------------------------------------------------------------- WATCH

def test_low_spend_is_watch_even_with_no_leads():
    assert call([row(180, 0)])["status"] == engine.WATCH
    assert call([row(350, 0)])["status"] == engine.WATCH


def test_low_spend_with_an_early_lead_is_still_watch():
    res = call([row(300, 1)])
    assert res["status"] == engine.WATCH and "Early CPL" in res["reason"]


# ------------------------------------------------------------- OPTIMIZE

def test_no_leads_between_1x_and_1_5x_is_optimize():
    assert call([row(500, 0)])["status"] == engine.OPTIMIZE


def test_high_ctr_but_poor_cpl_is_a_funnel_problem_not_a_kill():
    res = call([row(900, 1, impressions=10000, link_clicks=180)])  # CTR 1.8%, CPL 900
    assert res["status"] == engine.OPTIMIZE and not res["replace"]
    assert "landing page" in res["action"]


def test_no_leads_with_good_ctr_is_a_funnel_problem():
    res = call([row(700, 0, impressions=8000, link_clicks=120)])  # CTR 1.5%
    assert res["status"] == engine.OPTIMIZE


def test_warning_zone_is_optimize():
    res = call([row(1300, 2)])  # CPL 650, 1.5x–2x
    assert res["status"] == engine.OPTIMIZE and "warning" in res["reason"]


def test_good_cpl_but_poor_quality_is_optimize():
    rows = [row(1000, 10, qualified_leads=1)]  # CPL 100, 10% qualify
    res = call(rows, min_q=30)
    assert res["status"] == engine.OPTIMIZE and "qualify" in res["reason"]


def test_quality_is_ignored_until_there_are_enough_leads():
    assert call([row(800, 2, qualified_leads=0)])["status"] != engine.OPTIMIZE


def test_fatigue_needs_cpl_up_plus_another_signal():
    prev = [row(1200, 4, impressions=10000, link_clicks=200, reach=8000)]   # CPL 300, CTR 2%, freq 1.25
    cur = [row(1500, 4, impressions=10000, link_clicks=120, reach=5000)]    # CPL 375, CTR 1.2%, freq 2
    res = call(cur, prev)
    assert res["status"] == engine.OPTIMIZE and res["fatigue"]
    # CPL alone rising is not fatigue
    plain = call([row(1500, 4)], [row(1200, 4)])
    assert plain["status"] == engine.KEEP and not plain["fatigue"]


# ----------------------------------------------------------------- KILL

def test_spend_over_1_5x_with_no_leads_is_kill_and_replace():
    res = call([row(600, 0)])
    assert res["status"] == engine.KILL and res["replace"]


def test_2x_cpl_is_kill():
    assert call([row(900, 1)])["status"] == engine.KILL   # ₹900 on one lead
    assert call([row(800, 1)])["status"] == engine.KILL   # exactly 2x


def test_weak_ctr_with_no_leads_is_kill():
    res = call([row(500, 0, impressions=10000, link_clicks=25)])  # CTR 0.25%
    assert res["status"] == engine.KILL and "CTR" in res["reason"]


def test_weak_ctr_in_the_warning_zone_is_kill():
    res = call([row(1300, 2, impressions=20000, link_clicks=60)])  # CTR 0.3%, CPL 650
    assert res["status"] == engine.KILL


def test_ctr_is_not_trusted_on_tiny_impression_counts():
    res = call([row(500, 0, impressions=200, link_clicks=0)])
    assert res["status"] == engine.OPTIMIZE  # 0% CTR on 200 impressions is noise


# ---------------------------------------------------------- KEEP / SCALE

def test_cpl_around_target_is_keep():
    assert call([row(1500, 4)])["status"] == engine.KEEP  # CPL 375
    assert call([row(1900, 4)])["status"] == engine.KEEP  # CPL 475 — inside the 1.2x band


def test_slightly_above_target_is_watch():
    assert call([row(2200, 4)])["status"] == engine.WATCH  # CPL 550, under the 600 warning


def test_scale_on_good_cpl_and_quality():
    res = call([row(2000, 8, qualified_leads=6, appointments=4)])  # CPL 250
    assert res["status"] == engine.SCALE and res["level"] is None
    assert "+20–30%" in res["action"]


def test_strong_scale_at_half_the_target():
    res = call([row(2000, 10, qualified_leads=8)])  # CPL 200
    assert res["status"] == engine.SCALE and res["level"] == "strong_scale"


def test_scale_without_quality_data_is_conservative_and_says_so():
    res = call([row(2000, 8)])
    assert res["status"] == engine.SCALE
    assert "+10–20%" in res["action"] and res["hints"]


def test_good_cpl_on_too_few_leads_waits():
    assert call([row(600, 2)])["status"] == engine.WATCH  # CPL 300 on 2 leads


def test_a_new_ad_is_watch_not_scale():
    res = call([row(2000, 8, qualified_leads=6)], age=1)
    assert res["status"] == engine.WATCH and "SCALE" in res["reason"]


def test_a_new_ad_can_still_be_killed_on_spend():
    assert call([row(700, 0)], age=0)["status"] == engine.KILL


# --------------------------------------------------------------- groups

def test_group_health_never_kills():
    poor = engine.judge_group(engine.aggregate([row(5000, 7)]), T)  # CPL 714
    assert poor["health"] == engine.OPTIMIZE and "audience" in poor["note"]
    good = engine.judge_group(engine.aggregate([row(5000, 20)]), T)  # CPL 250
    assert good["health"] == engine.KEEP
    assert engine.judge_group(engine.aggregate([]), T)["health"] == engine.NO_DATA
    assert engine.judge_group(engine.aggregate([row(100, 0)]), T)["health"] == engine.WATCH


def test_thresholds():
    assert engine.thresholds(400) == {"scale_cpl": 320.0, "keep_cpl": 480.0, "warn_cpl": 600.0, "kill_cpl": 800.0}
