# BCSE355L syllabus coverage

Source: supplied BCSE355L Cloud Architecture Design PDF, syllabus version 2.0,
modules 1-4 on page 1 and modules 4-8 on page 2. Review date: 30 October 2026.
The source is a course syllabus, not a requirement to buy every listed service.

Status meanings:
- **Implemented locally**: application/tool code runs in offline smoke tests.
- **Prepared/off**: reviewable CloudFormation or configuration; schema checked,
  not deployed or service-tested in AWS.
- **Design/study**: justified alternative or explanation; no claim of implementation.
- **Unavailable/legacy**: the current AWS service lifecycle does not support a new deployment.

## Module 1 - Foundations and IAM

| Syllabus topic | Project treatment | Status |
|---|---|---|
| Cloud concepts and AWS Global Infrastructure | Region/AZ/failure-domain explanation; two-AZ reference network; account inventory loops through enabled regions | Implemented locally / prepared/off |
| Shared Responsibility Model | AWS protects facilities/managed infrastructure; operators own IAM, application security, patching, data classification and recovery | Design/study |
| IAM users and groups | Preserve assigned Sohom access; human MFA/temporary sessions; avoid new IAM users/static keys in this upgrade | Design/study; existing access untouched |
| IAM policies and roles | `identity.json`, service roles scoped to project bucket prefix, queue, table/topic and log-group ARNs | Prepared/off |
| IAM best practices | No AdministratorAccess policy, no SSH key or IAM key creation, no root login automation, account-ID guard for account inspection; justify unavoidable wildcard channel/discovery APIs | Implemented locally / prepared/off |

## Module 2 - Compute and storage

| Syllabus topic | Project treatment | Status |
|---|---|---|
| EC2 services, instance types | Single-host reference with micro/small type allowlist, 16 GiB encrypted gp3, IMDSv2, instance profile | Prepared/off |
| Pricing models | On-Demand for short coursework runs; no reservation/Savings Plan/Marketplace purchase; Spot interruptions are inappropriate for the only PostgreSQL host | Design/study |
| Instance lifecycle | Preserve the already stopped host; no start API in upgrade/smoke; read-only all-region off-state audit | Implemented locally |
| Auto Scaling | `ha-lab.json`; every ASG capacity is zero; stateless AMI/shared database design required | Prepared/off; explicit cost gate |
| Elastic Load Balancing | Two-AZ ALB reference, valid ACM certificate input, HTTPS listener, HTTP redirect, readiness target check | Prepared/off; explicit cost gate |
| S3 | Public access blocked, owner enforcement, encryption, TLS-only access, versioning and retained recovery storage | Prepared/off |
| S3 storage classes and lifecycle | Short-lived backups stay Standard; `archives/` transitions after 90 days to Glacier class and expires after 365; abort incomplete uploads | Prepared/off; minimum size/duration costs reviewed before use |
| EBS | Encrypted gp3; existing disks are retained while host is stopped; compute reference retains data on termination | Prepared/off / existing state unchanged |
| Glacier | S3 Glacier storage-class archive alternative, not a second backup of every short-lived object; restoration is slower and can cost money | Prepared/off |
| EFS | Private encrypted NFS, TLS requirement, two mount targets and a non-root access point; not needed for the present single host | Prepared/off; explicit cost gate |

## Module 3 - Networking and content delivery

| Syllabus topic | Project treatment | Status |
|---|---|---|
| VPC, subnets and routes | Two-AZ public/private reference; Internet Gateway public routes; private routes have no NAT | Prepared/off |
| Security groups | Public web ports only; API from web SG; database from API SG; no internet-facing 22/5000/5432. Host-local API/database publications in Compose | Implemented locally / prepared/off |
| VPC Peering | Same-account peering with both explicit routes; requires non-overlapping CIDRs and scoped access | Prepared/off; transfer-cost gate |
| Direct Connect | Physical circuit/partner/port requirement is not useful or minimum-cost for this internet demo; public HTTPS/SSM is the practical baseline | Design/study; not provisioned |
| CloudFront | Private S3 + OAC, SPA route function, HTTPS API origin, zero-TTL API behavior that forwards auth; no global API error-to-200 rewrite | Prepared/off |

## Module 4 - Databases

| Syllabus topic | Project treatment | Status |
|---|---|---|
| RDS | Private encrypted PostgreSQL reference, managed secret, backups, IAM database auth option and deletion protection; application continues using PostgreSQL locally | Prepared/off; explicit cost gate |
| RDS Multi-AZ | Separate opt-in; failover standby is not application read scaling; failover test and measured recovery are still required | Prepared/off; additional instance cost |
| RDS read replicas | Separate opt-in replica; eventual/asynchronous replica data requires read routing and consistency decisions | Prepared/off; additional instance cost |
| Aurora | Private encrypted PostgreSQL-compatible cluster alternative; not a simultaneous dependency alongside RDS | Prepared/off; explicit cost gate |
| DynamoDB | Conditional event audit writes, seven-day TTL eligibility, 1 RCU/1 WCU provisioned table; the credit monitor uses a separate tiny state table | Implemented contract / prepared cloud resources |
| DynamoDB Streams | Keys-only stream and bounded audit logger; no candidate fields; no recursive write-back to the source table | Prepared/off |

## Module 5 - Management and costs

| Syllabus topic | Project treatment | Status |
|---|---|---|
| CloudWatch | Queue/workflow/monitor/host failure alarms; namespace-scoped metrics; seven-day logs; optional two-metric host agent example | Prepared/off |
| CloudTrail | Prefer existing Event history/first management-event trail; optional log-integrity-validated trail without paid data-event capture | Prepared/off; no duplicate trail by default |
| AWS Config | Limited EC2/S3 scope and encrypted-EBS/private-S3 rules; recorder/evaluation costs mean it stays disabled | Prepared/off; explicit cost gate |
| Systems Manager | Scoped instance role and a read-only diagnostic Command document; no public SSH; no parameter values or environment dumps in diagnostics | Prepared/off |
| AWS Cost Management and Billing | Read-only credit command; account-ID check; costs and Free plan expiry reported separately from individual credit expiry | Implemented locally; live account not queried here |
| Free Tier | No automatic Paid-plan upgrade; finite reserve, minimum time-to-expiry check, usage/credit caveats | Implemented locally |
| Budgets | Optional account-wide gross $1/$5/$10 warnings excluding credits/refunds; existing budget should be reused, not duplicated | Prepared/off; `CreateNewBudget=false` |
| Trusted Advisor | Use checks available in the current support plan; do not purchase a support plan merely to enable an API/demo | Design/study; not provisioned |

## Module 6 - Security and compliance

| Syllabus topic | Project treatment | Status |
|---|---|---|
| Shared responsibility/compliance | Ownership checklist and minimal data flow; no certification/compliance claim from a template or smoke test | Design/study |
| KMS | Default AWS-managed/owned encryption for low cost; optional rotating customer key with retention and key-policy review | Prepared/off; customer key has cost gate |
| WAF | Common managed rules and IP rate limiting; attach to CloudFront/ALB deliberately, test false positives and current price | Prepared/off; explicit cost gate |
| Shield | Standard protection is included by AWS for supported services; no Shield Advanced subscription is created | Platform feature/design; no new AWS activation claimed |
| Security best practices | Assigned admin stays private, signup off, JWT algorithm/issuer/audience checks, parameterized SQL, transaction rollback, input bounds, login throttling, headers, loopback ports, non-root backend, secret-free images, locked dependencies, read-only CI permissions | Implemented locally; Docker image build not verified here |

## Module 7 - Integration and architectural practice

| Syllabus topic | Project treatment | Status |
|---|---|---|
| SQS | Durable outbox dispatcher, encrypted queue, visibility/retention controls, five-attempt queue DLQ, partial Lambda batch failures | Implemented locally / prepared/off |
| SNS | Minimal operator hiring events and separate credit/expiry alerts; no SMS, candidate mailing or broad fan-out | Prepared/off; email confirmation/delivery unverified |
| SWF | Long-running poll-worker alternative explained; Step Functions is used for this new workflow instead of maintaining a second orchestration stack | Design/study; not implemented |
| Step Functions | Standard workflow, event validation, conditional audit, retries and notification; deterministic execution name handles SQS redelivery | Implemented contract / prepared/off |
| Well-Architected Framework | Operational excellence (receipts/runbooks), security (roles/data limits), reliability (outbox/DLQ/recovery), performance (bounded workers), cost (all-off defaults/credit reserve), sustainability (no idle hosting) | Implemented practices / design review |
| Scalability and elasticity | Queue buffering, bounded consumers, stateless multi-AZ reference. Existing single-host PostgreSQL remains a scaling boundary | Prepared/design; no load-test claim |
| High availability and fault tolerance | HA templates kept separate from the single-host low-cost choice; no claim that backups alone make a single host highly available | Prepared/design; failover untested |
| Security and cost optimization | Explicit opt-ins, finite retained data, no custom key/NAT/ALB/RDS by default; credit alerts are warnings, not caps | Implemented locally / prepared/off |

## Module 8 - Migration and hybrid architectures

| Syllabus topic | Project treatment | Status |
|---|---|---|
| DMS | Private, certificate-verified PostgreSQL endpoints, secret references, full-load/CDC task template; a cheap dump/restore path is documented first | Prepared/off; explicit cost gate; task not run |
| Server Migration Service (SMS) | Listed in AWS full-shutdown documentation; use the current MGN rehosting service when a genuine server estate needs migration | Unavailable/legacy; no deprecated-service deployment |
| Snowball / Snowball Edge | Hardware/edge-transfer case study; closed to new customers and lifecycle/variant availability is changing; current AWS notices must control any real plan | Design/study / unavailable for this new account |
| Snowmobile | Listed in AWS full-shutdown documentation; transport hardware is unrelated to this small app | Unavailable/legacy |
| Hybrid architecture | Migration sequence, private database routes, secret boundaries, VPN/Direct Connect comparison and rollback/recovery notes | Design/study; no paid circuit created |

See [Migration and professor review](MIGRATION-AND-REVIEW.md) and [sources](SOURCES.md)
for the reasons behind substitutions and current service-lifecycle references.
