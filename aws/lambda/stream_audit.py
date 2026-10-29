"""DynamoDB Streams demonstration; log event identifiers only, not item contents."""
import json


def handler(event, context):
    for record in event.get("Records", []):
        print(json.dumps({"event": "audit_stream_change", "change": record["eventName"],
                          "event_id": record.get("dynamodb", {}).get("Keys", {}).get("event_id", {}).get("S")}))
    return {"records": len(event.get("Records", []))}
