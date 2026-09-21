"""
Daily decision engine for Meta Ads — pure functions, no database access.

Every ad gets one call from its recent daily numbers and the project's target
CPL: SCALE · KEEP · WATCH · OPTIMIZE · KILL (a KILL always comes with REPLACE:
launch a new variation). Ad sets and campaigns only get a health note — they
are never auto-killed.

The thresholds below are operational rules of thumb, not Meta benchmarks.
Reach and impressions are never used to judge an ad: a low-spend ad is not
automatically a bad ad. CTR / CPC / frequency are diagnostics, not verdicts.
"""
from datetime import date, timedelta
from typing import Optional

SCALE, KEEP, WATCH, OPTIMIZE, KILL = "scale", "keep", "watch", "optimize", "kill"
NO_DATA, INACTIVE, NO_TARGET = "no_data", "inactive", "no_target"

WINDOWS = (3, 7, 14)
DEFAULT_WINDOW = 7
DEFAULT_MIN_QUALIFIED_PCT = 30.0

# Multiples of the target CPL.
STRONG_SCALE_AT = 0.5   # CPL at or under this → strong scale
SCALE_AT = 0.8          # CPL at or under this → scale
KEEP_UP_TO = 1.2        # CPL up to this is "around target"
WARN_AT = 1.5           # warning threshold (also: spend with 0 leads)
KILL_AT = 2.0           # kill threshold

# Link CTR diagnostics (%).
WEAK_CTR = 0.5
GOOD_CTR = 1.2
MIN_IMPRESSIONS_FOR_CTR = 1000

MIN_SCALE_LEADS = 3          # "enough conversion data" before scaling
CONSERVATIVE_SCALE_LEADS = 5  # fewer leads than this → suggest the small raise
MIN_QUALITY_LEADS = 3        # leads needed before a qualified-% is trusted
YOUNG_AD_DAYS = 2            # first days of spend: judge after 24–72h of data
INACTIVE_AFTER_DAYS = 2      # no spend this long while others report → paused

FATIGUE_MIN_LEADS = 3
FATIGUE_CPL_RISE = 1.25
FATIGUE_SIGNAL_CHANGE = 0.10


def _div(a: float, b: float) -> Optional[float]:
    return a / b if b and b > 0 else None


def _r2(v: Optional[float]) -> Optional[float]:
    return None if v is None else round(v, 2)


def _inr(v: float) -> str:
    return f"₹{v:,.0f}"


def _pct(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".") + "%"


def _sum(rows: list, key: str) -> float:
    return sum(float(r.get(key) or 0) for r in rows)


def _opt_sum(rows: list, key: str) -> Optional[float]:
    have = [r for r in rows if r.get(key) is not None]
    return _sum(have, key) if have else None


def window_bounds(day: str, n: int) -> dict:
    """The n-day window ending on `day`, and the n days before it."""
    end = date.fromisoformat(day)
    cur_from = end - timedelta(days=n - 1)
    prev_to = cur_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=n - 1)
    return {
        "cur_from": cur_from.isoformat(), "cur_to": day,
        "prev_from": prev_from.isoformat(), "prev_to": prev_to.isoformat(),
    }


def aggregate(rows: list) -> dict:
    """Roll daily ad rows up. Each row: an entry dict plus its "date". An
    optional number a row didn't report is left out of that ratio entirely, so
    a half-filled report never distorts CTR, quality or cost per appointment."""
    spend, leads = _sum(rows, "total_spend"), _sum(rows, "total_leads")
    ic = [r for r in rows if r.get("impressions") is not None and r.get("link_clicks") is not None]
    ir = [r for r in rows if r.get("impressions") is not None and r.get("reach") is not None]
    clicks = [r for r in rows if r.get("link_clicks") is not None]
    qual = [r for r in rows if r.get("qualified_leads") is not None]
    appt = [r for r in rows if r.get("appointments") is not None]
    ctr_impressions = _sum(ic, "impressions")
    ctr = _div(_sum(ic, "link_clicks") * 100, ctr_impressions)
    qualified, qualified_base = _sum(qual, "qualified_leads"), _sum(qual, "total_leads")
    appointments = _sum(appt, "appointments")
    return {
        "reported_days": len({r["date"] for r in rows}),
        "spend": _r2(spend), "leads": _r2(leads), "cpl": _r2(_div(spend, leads)),
        "reach": _r2(_opt_sum(rows, "reach")), "impressions": _r2(_opt_sum(rows, "impressions")),
        "link_clicks": _r2(_opt_sum(rows, "link_clicks")),
        "ctr": _r2(ctr), "ctr_impressions": ctr_impressions,
        "cpc": _r2(_div(_sum(clicks, "total_spend"), _sum(clicks, "link_clicks"))),
        "frequency": _r2(_div(_sum(ir, "impressions"), _sum(ir, "reach"))),
        "qualified": _r2(qualified) if qual else None,
        "qualified_pct": _r2(_div(qualified * 100, qualified_base)),
        "qualified_base": qualified_base,
        "cost_per_qualified": _r2(_div(_sum(qual, "total_spend"), qualified)),
        "appointments": _r2(appointments) if appt else None,
        "cost_per_appointment": _r2(_div(_sum(appt, "total_spend"), appointments)),
    }


def thresholds(target_cpl: float) -> dict:
    return {
        "scale_cpl": round(target_cpl * SCALE_AT, 2), "keep_cpl": round(target_cpl * KEEP_UP_TO, 2),
        "warn_cpl": round(target_cpl * WARN_AT, 2), "kill_cpl": round(target_cpl * KILL_AT, 2),
    }


def _fatigue_signals(cur: dict, prev: Optional[dict]) -> Optional[list]:
    """CPL up, plus CTR down or frequency up, against the window before."""
    if not prev or cur["leads"] < FATIGUE_MIN_LEADS or prev["leads"] < FATIGUE_MIN_LEADS:
        return None
    if cur["cpl"] is None or prev["cpl"] is None or cur["cpl"] < prev["cpl"] * FATIGUE_CPL_RISE:
        return None
    signals = [f"CPL up {round((cur['cpl'] / prev['cpl'] - 1) * 100)}% ({_inr(prev['cpl'])} → {_inr(cur['cpl'])})"]
    if cur["ctr"] is not None and prev["ctr"] is not None and cur["ctr"] <= prev["ctr"] * (1 - FATIGUE_SIGNAL_CHANGE):
        signals.append(f"CTR down {_pct(prev['ctr'])} → {_pct(cur['ctr'])}")
    if cur["frequency"] is not None and prev["frequency"] is not None and cur["frequency"] >= prev["frequency"] * (1 + FATIGUE_SIGNAL_CHANGE):
        signals.append(f"frequency up {prev['frequency']:g} → {cur['frequency']:g}")
    return signals if len(signals) >= 2 else None


def _result(status: str, reason: str, action: str, *, level=None, replace=False, fatigue=False, hints=None) -> dict:
    return {"status": status, "level": level, "reason": reason, "action": action,
            "replace": replace, "fatigue": fatigue, "hints": hints or []}


def decide(cur: dict, prev: Optional[dict], target_cpl: float,
           min_qualified_pct: float = DEFAULT_MIN_QUALIFIED_PCT, age_days: Optional[int] = None) -> dict:
    """The call for one ad. `cur` / `prev` come from aggregate(): the current
    window and the window before it. `age_days` is days since its first spend."""
    T = float(target_cpl)
    S, L, cpl = cur["spend"], cur["leads"], cur["cpl"]
    ctr = cur["ctr"] if cur["ctr"] is not None and cur["ctr_impressions"] >= MIN_IMPRESSIONS_FOR_CTR else None
    weak_ctr = ctr is not None and ctr < WEAK_CTR
    good_ctr = ctr is not None and ctr >= GOOD_CTR
    qual_pct = cur["qualified_pct"] if cur["qualified_base"] >= MIN_QUALITY_LEADS else None
    poor_quality = qual_pct is not None and qual_pct < min_qualified_pct

    def kill(reason: str) -> dict:
        return _result(KILL, reason, "Pause this ad and replace it with a new variation of a winning angle.",
                       replace=True, hints=[] if ctr is not None else ["Add impressions and link clicks to the daily report to check CTR before killing."])

    def funnel(reason: str) -> dict:
        return _result(OPTIMIZE, reason, "Don't kill the creative yet — check the lead form, landing page, offer, questions, tracking and how leads are qualified.")

    def decision() -> dict:
        if S < T:
            early = f" Early CPL {_inr(cpl)}." if cpl is not None else ""
            return _result(WATCH, f"Spent {_inr(S)} — under 1× the target CPL ({_inr(T)}), too little to judge.{early}",
                           "Wait for more data. Don't pause or edit it yet.")
        if L == 0:
            if weak_ctr:
                return kill(f"Spent {_inr(S)} with 0 leads and a link CTR of {_pct(ctr)} (under {_pct(WEAK_CTR)}) — the creative isn't earning attention.")
            if S >= T * WARN_AT:
                if good_ctr:
                    return funnel(f"Spent {_inr(S)} with 0 leads, but link CTR is {_pct(ctr)} — people click and don't convert.")
                return kill(f"Spent {_inr(S)} (over 1.5× the target CPL of {_inr(T)}) with 0 leads.")
            return _result(OPTIMIZE, f"Spent {_inr(S)} with 0 leads — nearing the kill line ({_inr(T * WARN_AT)}).",
                           "Check CTR and the funnel now; if no lead comes before the kill line, pause it.")
        if cpl >= T * KILL_AT:
            if good_ctr:
                return funnel(f"CPL {_inr(cpl)} is over 2× the target ({_inr(T)}), but link CTR is {_pct(ctr)} — the ad gets clicks, the click-to-lead step is failing.")
            return kill(f"CPL {_inr(cpl)} is over 2× the target ({_inr(T)}) after {_inr(S)} spent.")
        if cpl >= T * WARN_AT:
            if weak_ctr:
                return kill(f"CPL {_inr(cpl)} is over 1.5× the target and link CTR is only {_pct(ctr)}.")
            return _result(OPTIMIZE, f"CPL {_inr(cpl)} is over 1.5× the target ({_inr(T)}) — warning zone.",
                           "Fix what you can (creative hook, form, offer, audience). Pause it if it reaches 2× the target.")
        signals = _fatigue_signals(cur, prev)
        if signals:
            return _result(OPTIMIZE, "Fatigue warning: " + "; ".join(signals) + ".",
                           "Add fresh variations of this creative now; replace it if it keeps getting worse.", fatigue=True)
        if cpl > T * KEEP_UP_TO:
            return _result(WATCH, f"CPL {_inr(cpl)} is a little above target ({_inr(T)}) but under the warning line.",
                           "Leave it, and re-check tomorrow.")
        if poor_quality:
            return _result(OPTIMIZE, f"CPL {_inr(cpl)} is fine, but only {_pct(qual_pct)} of leads qualify (target {_pct(min_qualified_pct)}+).",
                           "Cheap leads that don't qualify aren't a win. Tighten the questions / offer before adding budget.")
        if cpl <= T * SCALE_AT:
            if L < MIN_SCALE_LEADS:
                return _result(WATCH, f"CPL {_inr(cpl)} looks good, but only {L:g} lead(s) so far.",
                               "Wait for more leads before scaling.")
            level = "strong_scale" if cpl <= T * STRONG_SCALE_AT else None
            hints = [] if qual_pct is not None else ["Qualified leads aren't reported — confirm lead quality before scaling."]
            small = L < CONSERVATIVE_SCALE_LEADS or qual_pct is None
            raise_by = "+10–20%" if small else "+20–30%"
            if level:
                action = f"Raise the budget carefully ({raise_by}, more if it holds) and build 5–10 variations around this angle."
            else:
                action = f"Raise the budget {raise_by}. Build variations of the winning angle rather than duplicating this ad."
            return _result(SCALE, f"CPL {_inr(cpl)} is {'well ' if level else ''}under the target ({_inr(T)}) on {L:g} leads.",
                           action, level=level, hints=hints)
        return _result(KEEP, f"CPL {_inr(cpl)} is around the target ({_inr(T)}).",
                       "Don't touch it — it's doing its job, even if another ad is cheaper.")

    res = decision()
    if age_days is not None and age_days < YOUNG_AD_DAYS and res["status"] in (SCALE, KEEP, OPTIMIZE):
        return _result(WATCH, f"Ad is in its first {YOUNG_AD_DAYS} days of spend — judge after 24–72 hours of data. (Numbers so far would read as {res['status'].upper()}.)",
                       "Wait. Don't edit or pause it yet.")
    return res


def judge_group(agg: dict, target_cpl: float) -> dict:
    """Health note for an ad set or campaign. Never a kill: check the audience,
    placement, creative mix, quality, overlap and delivery first."""
    T = float(target_cpl)
    if agg["reported_days"] == 0:
        return {"health": NO_DATA, "note": "No reports in this window."}
    S, cpl = agg["spend"], agg["cpl"]
    if S < T:
        return {"health": WATCH, "note": "Not enough spend to judge yet."}
    if cpl is None or cpl >= T * WARN_AT:
        return {"health": OPTIMIZE, "note": "Well above target. Before pausing anything, check audience, placement, creative distribution, lead quality, overlap and delivery."}
    if cpl > T * KEEP_UP_TO:
        return {"health": WATCH, "note": "A little above target."}
    return {"health": KEEP, "note": "On target."}
