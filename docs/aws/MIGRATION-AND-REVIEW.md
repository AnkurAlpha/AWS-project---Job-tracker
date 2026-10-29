# Migration decisions and professor review

## A practical migration for this small app

The PostgreSQL container remains the minimum-cost choice on the retained host.
RDS/Aurora/DMS templates demonstrate the service boundaries without starting
managed database capacity. A future migration should use this order:

1. Record the current revision, schema version, roles, database row counts and
   private backup key. Create a consistent protected database dump and verify it
   can be restored to an isolated disposable database before any cutover.
2. Select the target and current price. RDS Multi-AZ adds failover capability;
   read replicas add eventually consistent read capacity; Aurora is a different
   managed cluster alternative. Do not enable all three to demonstrate a list.
3. For a small maintenance-window migration, use `pg_dump`/`pg_restore` with
   verified TLS or a local protected connection, a private service/password file,
   and the application's existing protected backup tools. Do not place a database
   password in a shell command, repository, slide or AWS template parameter.
4. For genuine low-downtime needs, review DMS prerequisites: PostgreSQL logical
   replication/WAL retention, source/target grants, private routing, secrets role,
   trusted root certificates and task capacity. The template defines full-load/CDC
   but does not start the task or validate those account-specific prerequisites.
5. Keep secrets in the existing private runtime or a reviewed SSM/Secrets Manager
   configuration. Change `DATABASE_URL` through the private deployment procedure,
   never the public frontend build. The app already uses `pg` against PostgreSQL.
6. Freeze writes briefly for final cutover; verify row counts, relationships,
   readiness, login, application submission, status updates and event backlog.
   Preserve a rollback database and configuration. Do not delete the source as
   proof that migration succeeded.

Cloud event IDs survive redelivery. A restored old outbox can replay messages;
Standard workflow names/conditional audit writes prevent ordinary duplicates,
but execution-name retention and audit TTL are finite. Review replay windows and
workflow redrive rather than assuming all historical replays are harmless.
Restoring old runtime secrets can also reinstate an old admin password/JWT key.

An actual restore exercise, migration, load test or failover is **not** part of
this offline smoke result. RPO/RTO and availability have not been measured.

## Why some syllabus services are not deployed

- AWS lists SMS and Snowmobile as fully shut down. They are historical review
  topics. The current rehosting path is the MGN service (currently described by
  AWS as AWS Transform MGN / formerly Application Migration Service).
- Snow Family hardware is not available for new customer ordering; service and
  variant availability notices are changing. Consult AWS's current notice for an
  actual estate. This new student account does not order a device or truck.
- Direct Connect requires a real private connectivity need, provider setup and
  ongoing charges. Internet HTTPS plus managed SSM access fits this app better.
- SWF requires a custom coordination/worker model. The implemented workflow is
  Step Functions, so adding an idle SWF polling worker would duplicate function
  and operational cost. Explain the contrast without calling SWF implemented.
- Trusted Advisor checks depend on support-plan access. Do not purchase a paid
  support plan just to make an inspection API succeed.
- WAF, Config, EFS, custom KMS keys, ALB/ASG, managed databases and DMS are genuine
  AWS capabilities, but idle resources can still cost money. Their reviewed
  reference templates require deliberate activation/cost acceptance.

## Review questions and concise answers

| Professor's question | Evidence-based answer |
|---|---|
| Why did you not enable every service from the syllabus? | Architectural selection considers workload, cost and availability. The coverage map accounts for every topic; expensive/inapplicable/retired services are not misrepresented as live features. |
| What changed in the real app? | Additive migrations, a transactional outbox, optional SQS dispatcher, admin event counts, input/security headers, login throttling, safe container boundaries and local/CI smoke checks. |
| What is deployed now? | This upgrade deployed nothing. The owner's last shutdown record showed EC2 stopped; the new AWS definitions and alerts are prepared/off. A later read-only inventory is needed for current account proof. |
| How is application data protected from a queue outage? | The business change and outbox insert commit in one database transaction. A failed send is retried later; a failed outbox insert rolls the business mutation back. The real embedded PostgreSQL smoke test exercises both. |
| Is event processing exactly once? | No. SQS and SNS may redeliver. Stable event UUIDs, deterministic Standard workflow inputs/names and conditional audit writes provide idempotent processing boundaries; email can duplicate. |
| Why Standard Step Functions rather than Express? | Durable orchestration/execution-name semantics fit this low-volume demo, and the listed Standard free allowance is useful. Retries and every state transition still count. |
| Why not put candidate information in DynamoDB/SNS? | The event consumer needs IDs/status, not resumes or personal contact information. The contract rejects extra fields before cloud processing. PostgreSQL still holds personal data and requires appropriate controls. |
| What do DynamoDB Streams do? | A keys-only change stream feeds a bounded logger. It demonstrates event-driven auditing without copying the candidate record or recursively updating the source table. |
| Why role credentials and IMDSv2? | Temporary instance/service credentials avoid static access keys. IMDSv2 requires session tokens; scoped IAM and controlled container access are still needed. |
| Why no SSH or public database port? | SSM provides managed operations. The host publishes API/PostgreSQL to loopback; reference SGs allow only the required web/tier paths. |
| Does the application rate limiter replace WAF? | No. It is per-process, bounded login protection. WAF is a separate optional edge control with pricing and false-positive testing. |
| Does SSE-S3 mean we did not use encryption? | No. It encrypts storage without a customer-managed-key fee. A separate rotating KMS customer key is prepared where its access/control benefits justify its cost. |
| Is a backup high availability? | No. The present low-cost choice has a single-host failure domain. Backups improve recovery; ALB/ASG with stateless nodes and managed multi-AZ data are a more expensive separate design. |
| Multi-AZ versus read replica? | Multi-AZ addresses availability/failover; replicas primarily serve read scaling and may lag. Application routing/consistency decisions are separate. |
| Can we scale a Compose stack's local PostgreSQL horizontally by cloning it? | No. Independent database volumes diverge. The HA reference requires an external shared database and stateless app AMIs; its desired/min/max are zero. |
| Why does CloudFront not cache API responses? | Admin/candidate data and auth semantics must be preserved. The API behavior has zero TTL and forwards request/auth data; static assets use a separate cache policy and private S3 OAC. |
| What does the credit monitor do when balance is low? | It samples the Free plan API, validates account/status/expiry, publishes crossing alerts and persists accepted state. It cannot start/stop instances or upgrade a plan. It is not active yet. |
| Are Budgets a spending cap? | No. Billing data and notifications lag. Gross warnings exclude credits so usage is visible, and a separate remaining-credit reserve warns before exhaustion. |
| Is everything free while EC2 is off? | No. Retained disks, backups, snapshots, addresses and existing services can still consume credits. This upgrade has not measured the live bill. |
| How do you know the templates are valid? | cfn-lint checks current resource schemas in ap-south-1 and us-east-1; tests check generated-source consistency, disabled defaults, consumer/schedule gates, cache boundaries and cost acknowledgements. That is not an AWS deployment/permission/quota test. |
| What did the smoke test actually run? | Loopback Express HTTP against embedded PostgreSQL, synthetic hiring data, transaction/retry/retention tests, fake AWS handler tests, template checks and a frontend build. No live AWS endpoint was called. |
| Which Well-Architected pillars are covered? | Operational excellence, security, reliability, performance efficiency, cost optimization and sustainability. The evidence is described in the coverage map; a passed smoke suite is not a certified Well-Architected Review. |

## A truthful demonstration while cloud hosting remains off

Show the syllabus coverage map, run the offline smoke command, inspect its receipt,
and explain one queue-failure/rollback case. Show default template conditions and
the credit tests. State that real AWS delivery, restore, browser access and HA
testing are future work rather than opening a previously shut-down website and
claiming the upgrade is live.
