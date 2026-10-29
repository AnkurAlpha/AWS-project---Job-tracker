# Cost and credit controls

## While hosting stays off

The upgrade and offline smoke use no AWS deployment API. Compute, queues,
databases, schedules, consumers and optional labs are not activated. The existing
stopped instance and its retained resources are untouched. This is **not a claim
that the whole account costs zero**: EBS volumes, S3 recovery objects, snapshots,
retained Elastic IPs, existing logs and unrelated resources can consume credits.

Only the retained account inventory/billing can establish actual cost. The
last recorded credit value in an earlier owner log is not treated as a current
balance. No current credit balance or current live AWS bill was obtained here.

## Prepared controls

| Control | Default | Meaning |
|---|---|---|
| All template resources | Disabled | No template is deployed by this upgrade |
| Cloud event producer | `AWS_EVENTS_ENABLED=false` | No event table writes/queue calls from normal hiring actions |
| Outbox worker | Compose `cloud` profile off | No background publisher starts |
| AWS consumers | `EnableConsumers=false` | Even deliberately provisioned queues do not begin consuming automatically |
| Credit monitor / schedule | Resources off / schedule off | No daily invocation or new email subscription is active now |
| Credit thresholds | $100 / $50 / $25 / $10 remaining | Advisory crossing alerts when an enabled monitor samples the balance |
| Reserve | $25 | Future hosting policy refuses to recommend a start at or below reserve |
| Plan expiry | Warnings at 14 / 7 / 1 / 0 days | Seven full days required by the hosting policy; does not extend expiry |
| Gross monthly cost | Optional $1 / $5 / $10 warnings | Excludes credits/refunds so gross usage is visible before the net bill |
| New gross budget | Off | Avoids duplicating the existing account budget |
| Paid-feature labs | Disabled + separate acknowledgement | No ALB, RDS, Aurora, EFS, Config, DMS, WAF, custom KMS key or new host is enabled |
| T3 CPU credits | Standard in reference | Avoids Unlimited surplus-credit pricing; CPU throttling is possible |
| Capacity | ASG min/max/desired zero | No scaling instance starts from the teaching reference until separately changed |
| Retention | Seven-day logs/audit eligibility, 14-day recovery template | Avoids uncontrolled retention; retention changes require review before real use |

The `hosting_allowed` value from the credit policy is advisory. There is no
deploy/start command in this change, no IAM billing-deny trick that claims to cap
the account, and no automatic EC2 termination or data deletion on a credit alert.

## How the future credit monitor works

1. A separately enabled daily EventBridge rule invokes the 128 MiB Lambda.
2. The Lambda reads `GetAccountPlanState` in us-east-1 and checks its account ID,
   FREE/ACTIVE status, finite USD balance and account-plan expiry. Unknown/malformed
   balance is an error, never interpreted as $0 or as safe to continue.
3. Threshold/expiry crossings are published to the operator's SNS email topic.
   DynamoDB records only accepted alert states, so a failed SNS publish remains
   eligible on the next invocation. Recovery re-arms thresholds. Delivery is
   at-least-once; a failed state write can duplicate a notification.
4. A single custom credit metric, monitor-failure alarm and separately gated
   missing-sample alarm (two missed daily samples) help expose broken
   monitoring. The role has no EC2 start/stop, plan-upgrade or account-admin permission.

No real email has been supplied to the template or subscribed by this upgrade.
Before relying on alerts, deliberately provision the monitor, confirm the SNS
email, invoke a controlled test, inspect the message and enable its schedule.
These monitor resources can run independently of EC2; that is an optional future
choice, not a hidden part of the current smoke test.

The API plan expiry is the **Free account plan expiry**. It is not the expiry of
every promotional credit. Free plan access can end before unused credits do.
Never join Organizations, enable paid-only features or upgrade the plan as an
incidental step to make a coursework template succeed.

## Alerts are not a hard spending cap

AWS billing/Budgets data is refreshed periodically (at least daily, not a live
meter). A daily credit sample can also lag usage. AWS Budgets notifications are
warnings and forecasts require sufficient history. Additional notifications may
arrive after costs have accrued. An encrypted disk still exists while EC2 is off.
Real billing may change between an alert and an operator response.

Do not create a new monitoring stack until checking existing budgets, trails,
alarms and notification confirmations. Duplicate monitoring can add costs as
well as noise. A Paid-plan upgrade is outside this change.

## Low-volume service allowances are shared, not guaranteed free hosting

AWS currently lists monthly no-charge allowances for Lambda, SQS, SNS, Standard
Step Functions and provisioned DynamoDB. The small reference deliberately uses
Standard workflows, 1 RCU/1 WCU tables, small non-PII messages and low concurrency.
The account's other workloads and existing monitoring consume allowances too;
requests, retries, stream polling, transitions, storage and deliveries all count.
On-demand DynamoDB, Express workflows, custom KMS keys and paid support should
not be substituted assuming the same allowance applies.

S3/EBS/IPv4 and database/load-balancer runtime have usage prices even when credits
pay the bill. S3 archival has minimum size/duration and retrieval costs, so short
14-day backups remain in Standard; only selected long-lived archives transition.
DynamoDB TTL deletion is asynchronous. Local outbox cleanup runs only while its
worker is enabled, so a stopped host does not perform local retention cleanup.

Private subnets are not given a NAT gateway or hourly interface endpoints by
default. Avoiding those costs is also why the private HA reference needs an
explicitly reviewed management/egress design rather than claiming a complete
always-free deployment. RDS/Aurora and DMS are kept disabled; their storage and
service lifecycle costs cannot be treated like a parked local database.

Use the live AWS pricing pages and current account plan before a future
deployment. There is no fresh dollar/month quote in this upgrade and no
permanent-zero-cost promise. See [sources](SOURCES.md).
