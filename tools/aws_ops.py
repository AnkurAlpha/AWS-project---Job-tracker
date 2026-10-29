#!/usr/bin/env python3
"""Read-only AWS account checks. No deploy, start, stop, upgrade or delete operation exists."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aws.credit_policy import assess

READS = {
    ("sts", "get-caller-identity"), ("freetier", "get-account-plan-state"),
    ("ec2", "describe-regions"), ("ec2", "describe-instances"),
    ("ec2", "describe-volumes"), ("ec2", "describe-addresses"),
    ("ec2", "describe-security-groups"),
}


class ReadOnlyAWS:
    def __init__(self, profile, expected_account):
        if not re.fullmatch(r"\d{12}", expected_account):
            raise ValueError("Supply --expected-account with your 12-digit AWS account ID")
        self.profile = profile
        self.expected_account = expected_account

    def call(self, region, service, operation, *args):
        if (service, operation) not in READS:
            raise ValueError("This tool permits only the enumerated read-only AWS APIs")
        command = ["aws", "--profile", self.profile, "--region", region,
                   "--output", "json", "--no-cli-pager", "--no-cli-auto-prompt",
                   "--cli-connect-timeout", "10", "--cli-read-timeout", "30",
                   service, operation, *args]
        result = subprocess.run(command, capture_output=True, text=True, timeout=180)
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or "AWS read failed")
        return json.loads(result.stdout)

    def check_account(self):
        account = self.call("us-east-1", "sts", "get-caller-identity")["Account"]
        if account != self.expected_account:
            raise ValueError("Wrong AWS account; no further API calls were made")
        return account


def audit(client):
    result = {"checked_at_utc": datetime.now(timezone.utc).isoformat(),
              "account": client.check_account(), "regions": [], "instances": [],
              "volumes": [], "elastic_ips": [], "findings": [], "errors": []}
    regions = client.call("ap-south-1", "ec2", "describe-regions")["Regions"]
    if not regions:
        raise ValueError("Region inventory is empty; shutdown cannot be verified")
    result["regions"] = sorted(r["RegionName"] for r in regions)
    for region in result["regions"]:
        try:
            reservations = client.call(region, "ec2", "describe-instances")["Reservations"]
            for reservation in reservations:
                for item in reservation.get("Instances", []):
                    state = item["State"]["Name"]
                    if state == "terminated":
                        continue
                    entry = {"region": region, "instance_id": item["InstanceId"],
                             "state": state, "type": item["InstanceType"]}
                    result["instances"].append(entry)
                    if state != "stopped":
                        result["findings"].append({**entry, "issue": "instance-is-not-stopped"})
                    if item.get("MetadataOptions", {}).get("HttpTokens") != "required":
                        result["findings"].append({**entry, "issue": "IMDSv2-not-required"})
            for item in client.call(region, "ec2", "describe-volumes")["Volumes"]:
                entry = {"region": region, "volume_id": item["VolumeId"],
                         "size_gib": item["Size"], "encrypted": item["Encrypted"]}
                result["volumes"].append(entry)
                if not entry["encrypted"]:
                    result["findings"].append({**entry, "issue": "unencrypted-EBS"})
            for item in client.call(region, "ec2", "describe-addresses")["Addresses"]:
                result["elastic_ips"].append({"region": region, "public_ip": item["PublicIp"],
                                               "issue": "retained-IPv4-may-incur-charges"})
            groups = client.call(region, "ec2", "describe-security-groups")["SecurityGroups"]
            for group in groups:
                for rule in group.get("IpPermissions", []):
                    public = any(v.get("CidrIp") == "0.0.0.0/0" for v in rule.get("IpRanges", []))
                    public |= any(v.get("CidrIpv6") == "::/0" for v in rule.get("Ipv6Ranges", []))
                    if public and (rule.get("IpProtocol") == "-1" or any(
                            rule.get("FromPort", 0) <= port <= rule.get("ToPort", 65535)
                            for port in (22, 5432, 5000))):
                        result["findings"].append({"region": region, "security_group": group["GroupId"],
                                                   "issue": "public-administration-or-database-port"})
        except (RuntimeError, KeyError, subprocess.TimeoutExpired) as error:
            result["errors"].append({"region": region, "error": str(error)})
    result["all_instances_stopped"] = not result["errors"] and all(
        i["state"] == "stopped" for i in result["instances"])
    result["note"] = "Read-only point-in-time check. Retained disks/backups can consume credits; this is not an all-services bill audit."
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["plan", "credits", "audit-off"])
    parser.add_argument("--profile", default="jobtracker-deploy")
    parser.add_argument("--expected-account", default="")
    parser.add_argument("--reserve-usd", type=float, default=25)
    parser.add_argument("--thresholds", default="100,50,25,10")
    options = parser.parse_args()
    if options.command == "plan":
        print((Path(__file__).resolve().parents[1] / "aws/config.example.json").read_text())
        return 0
    client = ReadOnlyAWS(options.profile, options.expected_account)
    if options.command == "credits":
        client.check_account()
        plan = client.call("us-east-1", "freetier", "get-account-plan-state")
        result = assess(plan, options.thresholds.split(","), options.reserve_usd)
        print(json.dumps(result, indent=2))
        return 2 if result["alerts"] else 0
    result = audit(client)
    print(json.dumps(result, indent=2))
    return 0 if result["all_instances_stopped"] and not result["findings"] else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired, KeyError) as error:
        print("UNVERIFIED: " + str(error), file=sys.stderr)
        sys.exit(1)
