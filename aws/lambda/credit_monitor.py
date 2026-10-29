"""Optional daily credit alert. Disabled in CloudFormation defaults; does not control EC2."""
import json
import os
from datetime import datetime, timezone
from decimal import Decimal
import boto3
from aws.credit_policy import assess


def handler(event, context, *, clients=None):
    clients = clients or {
        "freetier": boto3.client("freetier", region_name="us-east-1"),
        "sns": boto3.client("sns"), "dynamodb": boto3.client("dynamodb"),
        "cloudwatch": boto3.client("cloudwatch"),
    }
    plan = clients["freetier"].get_account_plan_state()
    if plan.get("accountId") != os.environ["EXPECTED_ACCOUNT_ID"]:
        raise ValueError("Wrong AWS account; notification and state writes refused")
    report = assess(plan, os.environ.get("THRESHOLDS_USD", "100,50,25,10").split(","),
                    os.environ.get("RESERVE_USD", "25"))
    response = clients["dynamodb"].get_item(
        TableName=os.environ["STATE_TABLE"], Key={"monitor_id": {"S": "credit-plan"}},
        ConsistentRead=True)
    previous = json.loads(response.get("Item", {}).get("alert_keys", {}).get("S", "[]"))
    new_alerts = sorted(set(report["alerts"]) - set(previous))
    if new_alerts:
        clients["sns"].publish(TopicArn=os.environ["ALERT_TOPIC_ARN"],
            Subject="JobTracker AWS credit or Free plan alert",
            Message=json.dumps({"new_alerts": new_alerts, **report}, sort_keys=True))
    # Persist only after SNS accepts the publish. A failed state write may duplicate an
    # alert; it cannot silently suppress an unsent notification. Recovery re-arms alerts.
    clients["dynamodb"].put_item(TableName=os.environ["STATE_TABLE"], Item={
        "monitor_id": {"S": "credit-plan"}, "alert_keys": {"S": json.dumps(report["alerts"])},
        "remaining_usd": {"N": str(Decimal(str(report["remaining_usd"])))},
        "checked_at": {"S": datetime.now(timezone.utc).isoformat()},
    })
    clients["cloudwatch"].put_metric_data(Namespace="JobTracker/Cost", MetricData=[{
        "MetricName": "RemainingCreditsUSD", "Value": report["remaining_usd"], "Unit": "None"}])
    return {"remaining_usd": report["remaining_usd"], "new_alerts": new_alerts}
