from datetime import datetime, timedelta, timezone
import copy
import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

from aws.credit_policy import assess
from aws.event_contract import validate_event
from tools.aws_ops import ReadOnlyAWS, audit

ROOT = Path(__file__).resolve().parents[2]
NOW = datetime(2026, 10, 30, tzinfo=timezone.utc)


def plan(amount=130, days=90):
    return {"accountId": "123456789012", "accountPlanType": "FREE", "accountPlanStatus": "ACTIVE",
            "accountPlanRemainingCredits": {"amount": amount, "unit": "USD"},
            "accountPlanExpirationDate": NOW + timedelta(days=days)}


def load_lambda(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "aws/lambda" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class PolicyTests(unittest.TestCase):
    def test_ample_active_credit_allows_a_future_reviewed_start(self):
        report = assess(plan(), now=NOW)
        self.assertEqual(report["alerts"], [])
        self.assertTrue(report["hosting_allowed"])

    def test_exact_threshold_alert_and_reserve(self):
        report = assess(plan(25), now=NOW)
        self.assertIn("credits-at-or-below-25", report["alerts"])
        self.assertIn("credit-reserve-reached", report["alerts"])
        self.assertFalse(report["hosting_allowed"])

    def test_near_expiry_blocks_hosting_independently_of_balance(self):
        report = assess(plan(130, days=6), now=NOW)
        self.assertIn("plan-expires-within-7-days", report["alerts"])
        self.assertFalse(report["hosting_allowed"])

    def test_expired_or_paid_plan_is_not_silently_upgraded(self):
        for key, value in [("accountPlanStatus", "EXPIRED"), ("accountPlanType", "PAID")]:
            fixture = plan(); fixture[key] = value
            self.assertFalse(assess(fixture, now=NOW)["hosting_allowed"])

    def test_unknown_nonfinite_negative_or_wrong_currency_balance_is_an_error(self):
        for value in [None, "NaN", "Infinity", -1]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                assess(plan(value), now=NOW)
        fixture = plan(); fixture["accountPlanRemainingCredits"]["unit"] = "INR"
        with self.assertRaises(ValueError): assess(fixture, now=NOW)
        fixture = plan(); del fixture["accountPlanRemainingCredits"]
        with self.assertRaises(ValueError): assess(fixture, now=NOW)

    def test_cli_cannot_issue_mutations(self):
        client = ReadOnlyAWS("example", "123456789012")
        for operation in ["start-instances", "run-instances", "terminate-instances", "stop-instances"]:
            with patch("tools.aws_ops.subprocess.run") as run, self.assertRaises(ValueError):
                client.call("ap-south-1", "ec2", operation)
            run.assert_not_called()

    def test_failed_region_never_reports_all_instances_off(self):
        class Client:
            def check_account(self): return "123456789012"
            def call(self, region, service, operation):
                if operation == "describe-regions": return {"Regions": [{"RegionName": "ap-south-1"}]}
                raise RuntimeError("AccessDenied")
        result = audit(Client())
        self.assertFalse(result["all_instances_stopped"])
        self.assertEqual(len(result["errors"]), 1)


class Fake:
    def __init__(self, reply=None, fail=None):
        self.reply = reply or {}; self.fail = fail; self.calls = []
    def __getattr__(self, method):
        def call(**kwargs):
            self.calls.append((method, kwargs))
            if self.fail: raise self.fail
            return copy.deepcopy(self.reply)
        return call


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.module = load_lambda("credit_monitor")
        self.env = patch.dict(os.environ, {"EXPECTED_ACCOUNT_ID": "123456789012", "STATE_TABLE": "test-state",
            "ALERT_TOPIC_ARN": "arn:aws:sns:ap-south-1:123456789012:test", "THRESHOLDS_USD": "100,50,25,10", "RESERVE_USD": "25"})
        self.env.start(); self.addCleanup(self.env.stop)

    def clients(self, amount=20, previous=None):
        fixture = plan(amount); fixture["accountPlanExpirationDate"] = datetime.now(timezone.utc) + timedelta(days=90)
        return {"freetier": Fake(fixture), "sns": Fake(), "cloudwatch": Fake(),
                "dynamodb": Fake({"Item": {"alert_keys": {"S": json.dumps(previous or [])}}})}

    def test_crossing_alert_is_delivered_then_persisted(self):
        clients = self.clients()
        result = self.module.handler({}, None, clients=clients)
        self.assertTrue(result["new_alerts"])
        self.assertEqual(len(clients["sns"].calls), 1)
        self.assertEqual([c[0] for c in clients["dynamodb"].calls], ["get_item", "put_item"])

    def test_repeat_sample_does_not_repeat_an_alert(self):
        previous = assess(plan(20), now=NOW)["alerts"]
        clients = self.clients(previous=previous)
        result = self.module.handler({}, None, clients=clients)
        self.assertEqual(result["new_alerts"], [])
        self.assertEqual(clients["sns"].calls, [])

    def test_sns_failure_does_not_mark_an_unsent_alert_delivered(self):
        clients = self.clients(); clients["sns"] = Fake(fail=RuntimeError("SNS unavailable"))
        with self.assertRaises(RuntimeError): self.module.handler({}, None, clients=clients)
        self.assertFalse(any(c[0] == "put_item" for c in clients["dynamodb"].calls))

    def test_wrong_account_is_rejected_before_any_notification_or_state_write(self):
        clients = self.clients(); clients["freetier"].reply["accountId"] = "000000000000"
        with self.assertRaises(ValueError): self.module.handler({}, None, clients=clients)
        self.assertEqual(clients["sns"].calls, [])
        self.assertEqual(clients["dynamodb"].calls, [])

    def test_a_recovered_balance_rearms_alerts(self):
        clients = self.clients(amount=130, previous=["credits-at-or-below-100"])
        self.module.handler({}, None, clients=clients)
        written = clients["dynamodb"].calls[-1][1]["Item"]["alert_keys"]["S"]
        self.assertEqual(json.loads(written), [])


EVENT = {"schema_version": 1, "event_id": "00000000-0000-4000-8000-000000000001", "event_type": "application.submitted",
         "occurred_at": "2026-10-30T00:00:00Z", "job_id": 1, "application_id": 2, "status": "applied"}


class EventTests(unittest.TestCase):
    def test_contract_rejects_pii_and_boolean_ids(self):
        for extra in [{"email": "demo@example.invalid"}, {"job_id": True}, {"status": "unknown"}]:
            with self.assertRaises(ValueError): validate_event({**EVENT, **extra})

    def test_redelivery_has_identical_execution_name_and_input(self):
        module = load_lambda("event_starter"); fake = Fake()
        records = [{"messageId": "message-a", "body": json.dumps(EVENT)}]
        with patch.dict(os.environ, {"STATE_MACHINE_ARN": "test"}):
            module.handler({"Records": records}, None, client=fake)
            module.handler({"Records": records}, None, client=fake)
        self.assertEqual(fake.calls[0], fake.calls[1])

    def test_partial_batch_reports_only_poison_record(self):
        module = load_lambda("event_starter"); fake = Fake()
        with patch.dict(os.environ, {"STATE_MACHINE_ARN": "test"}):
            result = module.handler({"Records": [{"messageId": "good", "body": json.dumps(EVENT)},
                {"messageId": "poison", "body": '{"email":"demo@example.invalid"}'}]}, None, client=fake)
        self.assertEqual(result, {"batchItemFailures": [{"itemIdentifier": "poison"}]})
        self.assertEqual(len(fake.calls), 1)

    def test_previously_started_standard_execution_is_acked(self):
        class Duplicate(Exception): response = {"Error": {"Code": "ExecutionAlreadyExists"}}
        module = load_lambda("event_starter")
        with patch.dict(os.environ, {"STATE_MACHINE_ARN": "test"}):
            result = module.handler({"Records": [{"messageId": "old", "body": json.dumps(EVENT)}]},
                                    None, client=Fake(fail=Duplicate()))
        self.assertEqual(result, {"batchItemFailures": []})
