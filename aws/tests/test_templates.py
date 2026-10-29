import json
from pathlib import Path
import unittest
from tools.build_aws_templates import BUILDERS

ROOT = Path(__file__).resolve().parents[2]


def defaults_evaluator(template):
    parameters = {k: v.get("Default") for k, v in template["Parameters"].items()}
    def value(expression):
        if not isinstance(expression, dict): return expression
        if "Ref" in expression: return parameters[expression["Ref"]]
        if "Condition" in expression: return value(template["Conditions"][expression["Condition"]])
        if "Fn::Equals" in expression: return value(expression["Fn::Equals"][0]) == value(expression["Fn::Equals"][1])
        if "Fn::And" in expression: return all(value(v) for v in expression["Fn::And"])
        if "Fn::Or" in expression: return any(value(v) for v in expression["Fn::Or"])
        if "Fn::Not" in expression: return not value(expression["Fn::Not"][0])
        raise AssertionError("Unknown condition operator")
    return value


class TemplateTests(unittest.TestCase):
    def test_all_generated_templates_match_the_sources_and_default_to_no_resources(self):
        for name, build in BUILDERS.items():
            with self.subTest(template=name):
                generated = build()
                saved = json.loads((ROOT / "aws/templates" / (name + ".json")).read_text())
                self.assertEqual(generated, saved)
                evaluator = defaults_evaluator(saved)
                for resource in saved["Resources"].values():
                    self.assertIn("Condition", resource)
                    self.assertFalse(evaluator({"Condition": resource["Condition"]}))

    def test_no_nat_or_elastic_ip_is_hidden_in_the_default_architecture(self):
        for build in BUILDERS.values():
            self.assertFalse(any(r["Type"] in {"AWS::EC2::NatGateway", "AWS::EC2::EIP"}
                                 for r in build()["Resources"].values()))

    def test_all_schedules_and_consumers_require_explicit_opt_in(self):
        credit = BUILDERS["credit-monitor"]()
        self.assertEqual(credit["Parameters"]["EnableSchedule"]["Default"], "false")
        integration = BUILDERS["integration"]()
        self.assertEqual(integration["Parameters"]["EnableConsumers"]["Default"], "false")

    def test_costly_labs_have_a_second_cost_acknowledgement(self):
        for name in ["compute-reference", "ha-lab", "rds-lab", "aurora-lab", "efs-lab", "kms-lab", "peering-lab", "waf-lab", "config-lab", "dms-lab"]:
            self.assertEqual(BUILDERS[name]()["Parameters"]["AcknowledgeHourlyCharges"]["Default"], "no")

    def test_workflow_deduplication_and_api_caching_boundaries(self):
        workflow = BUILDERS["integration"]()["Resources"]["Workflow"]["Properties"]["Definition"]["States"]
        self.assertEqual(workflow["RecordEvent"]["Parameters"]["ConditionExpression"], "attribute_not_exists(event_id)")
        self.assertEqual(workflow["AlreadyRecorded"]["Type"], "Succeed")
        cf = BUILDERS["cloudfront"]()["Resources"]
        self.assertEqual(cf["NoApiCache"]["Properties"]["CachePolicyConfig"]["MaxTTL"], 0)
        self.assertNotIn("CustomErrorResponses", cf["Distribution"]["Properties"]["DistributionConfig"])

    def test_inline_lambda_sources_compile_without_external_repository_imports(self):
        for name in ["integration", "credit-monitor"]:
            for resource in BUILDERS[name]()["Resources"].values():
                if resource["Type"] == "AWS::Lambda::Function":
                    code = resource["Properties"]["Code"]["ZipFile"]
                    self.assertNotIn("from aws.", code)
                    compile(code, "lambda/index.py", "exec")

    def test_service_roles_have_no_compute_or_account_administration_actions(self):
        for name in ["integration", "credit-monitor", "identity"]:
            for resource in BUILDERS[name]()["Resources"].values():
                if resource["Type"] == "AWS::IAM::Role":
                    encoded = json.dumps(resource["Properties"])
                    for action in ["ec2:RunInstances", "ec2:StartInstances", "iam:*", "freetier:UpgradeAccountPlan", "AdministratorAccess"]:
                        self.assertNotIn(action, encoded)

    def test_compose_keeps_private_ports_on_loopback_and_cloud_worker_opt_in(self):
        import yaml
        compose = yaml.safe_load((ROOT / "docker-compose.yml").read_text())
        for service in ["db", "backend"]:
            self.assertTrue(all(port.startswith("127.0.0.1:") for port in compose["services"][service]["ports"]))
        self.assertEqual(compose["services"]["outbox"]["profiles"], ["cloud"])
        for directory in ["backend", "frontend"]:
            ignored = (ROOT / directory / ".dockerignore").read_text()
            self.assertIn(".env", ignored)
            self.assertIn("PRIVATE-", ignored)
