#!/usr/bin/env python3
"""Offline smoke: PostgreSQL-in-WASM + loopback HTTP, fake AWS clients, IaC lint, frontend build.

No AWS CLI, credentials, containers, cloud deployment, or EC2 start is used.
Install dependencies first; see docs/aws/README.md.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def source_hash():
    listing = subprocess.check_output(["git", "ls-files", "-co", "--exclude-standard", "-z"], cwd=ROOT)
    digest = hashlib.sha256()
    for name in sorted(set(listing.split(b"\0")) - {b""}):
        path = ROOT / os.fsdecode(name)
        if path.is_file():
            digest.update(name + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=ROOT / "smoke-results.json")
    options = parser.parse_args()
    for executable in ["node", "cfn-lint", "git"]:
        if not shutil.which(executable):
            parser.error("Missing " + executable + "; use the documented Nix development shell")
    environment = {**os.environ, "AWS_EC2_METADATA_DISABLED": "true", "CI": "true"}
    commands = [
        ("backend-http-postgres-and-outbox", ["node", "--test", *[str(p) for p in sorted((ROOT / "backend/test").glob("*.test.js"))]], ROOT / "backend"),
        ("credit-alerts-events-and-safe-defaults", [sys.executable, "-m", "pytest", "aws/tests", "-q"], ROOT),
        ("cloudformation-schema", ["cfn-lint", "-t", *[str(p) for p in sorted((ROOT / "aws/templates").glob("*.json"))], "-r", "ap-south-1", "us-east-1"], ROOT),
        ("frontend-production-build", ["node", str(ROOT / "frontend/node_modules/vite/bin/vite.js"), "build"], ROOT / "frontend"),
        ("patch-whitespace", ["git", "diff", "--check"], ROOT),
    ]
    report = {"started_utc": datetime.now(timezone.utc).isoformat(), "mode": "offline-only",
              "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
              "source_sha256": source_hash(), "aws_mutations": 0, "aws_live_tests": "not run",
              "docker_build": "not run by this smoke suite", "checks": [], "passed": True}
    for label, command, directory in commands:
        print("SMOKE:", label, flush=True)
        start = time.monotonic()
        try:
            result = subprocess.run(command, cwd=directory, env=environment, timeout=300)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = 124
        report["checks"].append({"name": label, "exit_code": code, "seconds": round(time.monotonic() - start, 3)})
        report["passed"] &= code == 0
    report["completed_utc"] = datetime.now(timezone.utc).isoformat()
    report["source_unchanged_during_smoke"] = source_hash() == report["source_sha256"]
    report["passed"] &= report["source_unchanged_during_smoke"]
    options.report.parent.mkdir(parents=True, exist_ok=True)
    options.report.write_text(json.dumps(report, indent=2) + "\n")
    print("OFFLINE SMOKE PASSED" if report["passed"] else "OFFLINE SMOKE FAILED", flush=True)
    print("Receipt:", options.report)
    print("No AWS resources were created or started by this suite. Cloud permissions, delivery and live account state are unverified.")
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
