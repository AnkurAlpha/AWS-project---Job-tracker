# Sources and review scope

The supplied BCSE355L Cloud Architecture Design PDF (version 2.0, pages 1-2)
determines the module/topic mapping. It is not copied into this public source
repository. These primary AWS/library references were consulted on 30 October
2026; check current pricing, plan eligibility and service lifecycle again before
any future activation.

1. [AWS Free Tier account plans](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html) - finite plans/credits, account eligibility and paid-feature boundaries.
2. [GetAccountPlanState API](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_freetier_GetAccountPlanState.html) - remaining-credit, status and account-plan expiry fields.
3. [AWS Billing endpoints](https://docs.aws.amazon.com/general/latest/gr/billing.html) - Free Tier API in us-east-1.
4. [AWS Budgets best practices](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html) - credits/refunds, warning behavior, daily billing refresh and forecast history.
5. [Serverless Free Tier offers](https://aws.amazon.com/free/serverless/) and [application integration offers](https://aws.amazon.com/free/application-integration/) - always-free allowance categories, not a blanket no-cost claim.
6. [DynamoDB conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html) - insert-if-absent idempotency boundary.
7. [AWS Step Functions concurrency example](https://github.com/aws-samples/aws-stepfunctions-examples/blob/main/sam/app-control-concurrency-with-dynamodb/statemachines/dynamodb-semaphore.asl.json) - DynamoDB integration error prefix/conditional failure handling.
8. [S3 lifecycle behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html) - current/noncurrent expiration and multipart upload handling.
9. [AWS Shield documentation](https://docs.aws.amazon.com/shield/) - included Standard protection versus separately charged Advanced protection.
10. [AWS services in full shutdown](https://docs.aws.amazon.com/general/latest/gr/full_shutdown_services.html) - SMS, Snowmobile and historical Snow variants.
11. [Snowball availability change](https://docs.aws.amazon.com/snowball/latest/developer-guide/snowball-edge-availability-change.html) and [Snowball product notice](https://aws.amazon.com/snowball/) - new-customer/variant lifecycle changes; availability must be rechecked.
12. [AWS rehosting service](https://aws.amazon.com/application-migration-service/) - current MGN migration alternative.
13. [PGlite API](https://pglite.dev/docs/api) - embedded PostgreSQL, SQL execution and transaction semantics used in local smoke.
14. [CloudFormation linter](https://github.com/aws-cloudformation/cfn-lint) - schema-based offline template checks; not proof of account-side eligibility/quotas.
15. [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) - architectural review principles and limits.

No operational or financial claim is based on third-party pricing posts. No
credentials, actual current credit balance, candidate data, existing private
state, login file, backup object or recovery dump is included in this upgrade.
