"""SQS consumer: validate minimal events, start a durable workflow, report batch failures."""
import json
import os
import boto3
from aws.event_contract import validate_event


def handler(event, context, *, client=None):
    client = client or boto3.client("stepfunctions")
    failures = []
    for record in event.get("Records", []):
        try:
            payload = validate_event(record["body"])
            client.start_execution(stateMachineArn=os.environ["STATE_MACHINE_ARN"],
                name="event_" + payload["event_id"],
                input=json.dumps(payload, sort_keys=True, separators=(",", ":")))
        except Exception as error:
            # Standard workflow execution names remain unique for 90 days. Re-delivery
            # of a previously accepted event must not launch a duplicate workflow.
            code = getattr(error, "response", {}).get("Error", {}).get("Code")
            if code != "ExecutionAlreadyExists":
                failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
