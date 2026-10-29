"""Minimal, versioned cloud events. Candidate data never belongs in these events."""
from datetime import datetime
import json
from uuid import UUID

TYPES = {"job.published", "job.deleted", "application.submitted",
         "application.status_changed", "application.deleted"}
ALLOWED = {"schema_version", "event_id", "event_type", "occurred_at",
           "job_id", "application_id", "status"}


def validate_event(raw):
    if isinstance(raw, str):
        if len(raw.encode("utf-8")) > 4096:
            raise ValueError("Event exceeds its size limit")
        raw = json.loads(raw)
    if not isinstance(raw, dict) or set(raw) - ALLOWED:
        raise ValueError("Unexpected event fields")
    if type(raw.get("schema_version")) is not int or raw["schema_version"] != 1:
        raise ValueError("Unsupported event schema")
    if raw.get("event_type") not in TYPES:
        raise ValueError("Unknown event type")
    event_id = str(UUID(raw["event_id"]))
    occurred_at = datetime.fromisoformat(raw["occurred_at"].replace("Z", "+00:00"))
    if occurred_at.tzinfo is None:
        raise ValueError("Event time must include timezone")
    required = ["job_id"]
    if raw["event_type"].startswith("application."):
        required.append("application_id")
    for key in required:
        if type(raw.get(key)) is not int or not 0 < raw[key] <= 9007199254740991:
            raise ValueError("Missing or invalid event ID")
    for key in ("job_id", "application_id"):
        if key in raw and (type(raw[key]) is not int or not 0 < raw[key] <= 9007199254740991):
            raise ValueError("Invalid event ID")
    if "status" in raw and raw["status"] not in {"applied", "interview", "passed"}:
        raise ValueError("Invalid application status")
    if raw["event_type"] in {"application.submitted", "application.status_changed"} and "status" not in raw:
        raise ValueError("Application status is missing")
    # Deterministic across SQS redelivery: Step Functions uses the same execution name/input.
    return {**raw, "event_id": event_id, "expires_at": str(int(occurred_at.timestamp()) + 7 * 86400)}
