"""Pure credit policy shared by the CLI and the optional scheduled Lambda."""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import math

DEFAULT_THRESHOLDS = (100, 50, 25, 10)


def assess(plan, thresholds=DEFAULT_THRESHOLDS, reserve=25, now=None):
    now = now or datetime.now(timezone.utc)
    credits = plan.get("accountPlanRemainingCredits", {})
    try:
        remaining = Decimal(str(credits["amount"]))
        reserve = Decimal(str(reserve))
        levels = sorted({Decimal(str(t)) for t in thresholds}, reverse=True)
    except (KeyError, InvalidOperation, TypeError, ValueError) as error:
        raise ValueError("Credit balance or thresholds are missing/invalid; balance is unknown") from error
    if (not remaining.is_finite() or remaining < 0 or not reserve.is_finite() or reserve < 0
            or credits.get("unit") != "USD" or not levels
            or any(not t.is_finite() or t < 0 for t in levels)):
        raise ValueError("A finite nonnegative USD balance and thresholds are required")
    expiry = plan.get("accountPlanExpirationDate")
    if isinstance(expiry, str):
        expiry = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
    if not isinstance(expiry, datetime) or expiry.tzinfo is None:
        raise ValueError("Free plan expiry is missing or lacks a timezone")
    days = math.floor((expiry - now).total_seconds() / 86400)
    alerts = []
    for threshold in levels:
        if remaining <= threshold:
            alerts.append("credits-at-or-below-" + format(threshold.normalize(), "f"))
    for day in (14, 7, 1, 0):
        if days <= day:
            alerts.append("plan-expires-within-" + str(day) + "-days")
    if plan.get("accountPlanType") != "FREE" or plan.get("accountPlanStatus") != "ACTIVE":
        alerts.append("free-plan-not-active")
    if remaining <= reserve:
        alerts.append("credit-reserve-reached")
    return {
        "remaining_usd": float(remaining), "reserve_usd": float(reserve),
        "plan": plan.get("accountPlanType"), "status": plan.get("accountPlanStatus"),
        "plan_expires_utc": expiry.astimezone(timezone.utc).isoformat(),
        "days_until_plan_expiry": days, "alerts": alerts,
        "hosting_allowed": (plan.get("accountPlanType") == "FREE"
                            and plan.get("accountPlanStatus") == "ACTIVE"
                            and remaining > reserve and days >= 7),
        "note": "Credit alerts are advisory, not a spending cap. Plan expiry differs from individual credit expiry.",
    }
