#!/usr/bin/env python3
"""Generate reviewable CloudFormation JSON. Every template defaults to zero resources.

This is a file generator, not a deployment tool. Costly labs have a second explicit
acknowledgement. It never imports boto3, invokes AWS CLI, or changes an AWS account.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = lambda name: {"Ref": name}
SUB = lambda text: {"Fn::Sub": text}
GET = lambda name, attribute: {"Fn::GetAtt": [name, attribute]}
TAGS = [{"Key": "Project", "Value": REF("ProjectName")}, {"Key": "ManagedBy", "Value": "CloudFormation"}]


def template(description, paid=False):
    t = {"AWSTemplateFormatVersion": "2010-09-09", "Description": description,
         "Metadata": {"DeploymentStatus": "NOT DEPLOYED; offline smoke only",
                      "CostNotice": "Disabled defaults are not a promise of free operation when enabled."},
         "Parameters": {
             "EnableResources": {"Type": "String", "Default": "false", "AllowedValues": ["false", "true"]},
             "ProjectName": {"Type": "String", "Default": "jobtracker-lab", "MaxLength": 24,
                             "AllowedPattern": "[a-z][a-z0-9-]{2,23}"}},
         "Conditions": {"Enabled": {"Fn::Equals": [REF("EnableResources"), "true"]}},
         "Resources": {}, "Outputs": {}}
    if paid:
        t["Parameters"]["AcknowledgeHourlyCharges"] = {
            "Type": "String", "Default": "no", "AllowedValues": ["no", "yes"],
            "Description": "This lab has ongoing costs and may require a Paid plan. Never upgrade automatically."}
        t["Conditions"]["Enabled"] = {"Fn::And": [
            {"Fn::Equals": [REF("EnableResources"), "true"]},
            {"Fn::Equals": [REF("AcknowledgeHourlyCharges"), "yes"]}]}
        t["Rules"] = {"AcknowledgeCost": {"Assertions": [{"Assert": {"Fn::Or": [
            {"Fn::Equals": [REF("EnableResources"), "false"]},
            {"Fn::Equals": [REF("AcknowledgeHourlyCharges"), "yes"]}]},
            "AssertDescription": "Hourly or paid-feature costs must be acknowledged before enabling this lab."}]}}
    return t


def parameter(t, name, kind="String", **kwargs):
    t["Parameters"][name] = {"Type": kind, **kwargs}
    return REF(name)


def resource(t, name, kind, props, retain=False, condition="Enabled", depends=None):
    r = {"Type": kind, "Condition": condition, "Properties": props}
    if retain:
        r.update({"DeletionPolicy": "Retain", "UpdateReplacePolicy": "Retain"})
    if depends:
        r["DependsOn"] = depends
    t["Resources"][name] = r
    return REF(name)


def output(t, name, value, condition="Enabled"):
    t["Outputs"][name] = {"Value": value, "Condition": condition}


def role(t, name, service, statements):
    return resource(t, name, "AWS::IAM::Role", {
        "AssumeRolePolicyDocument": {"Version": "2012-10-17", "Statement": [{
            "Effect": "Allow", "Principal": {"Service": service}, "Action": "sts:AssumeRole"}]},
        "Policies": [{"PolicyName": "ProjectOnly", "PolicyDocument": {
            "Version": "2012-10-17", "Statement": statements}}], "Tags": TAGS})


def allow(actions, targets, **kwargs):
    return {"Effect": "Allow", "Action": actions, "Resource": targets, **kwargs}


def lambda_role(t, name, function_name, extra):
    return role(t, name, "lambda.amazonaws.com", [allow(
        ["logs:CreateLogStream", "logs:PutLogEvents"],
        SUB("arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${ProjectName}-"
            + function_name + ":*")), *extra])


def inline_source(name, helper=None):
    code = (ROOT / "aws/lambda" / (name + ".py")).read_text()
    if helper:
        module, symbol = helper
        header = (ROOT / "aws" / (module + ".py")).read_text()
        code = header + "\n" + code.replace("from aws." + module + " import " + symbol, "")
    return code


def function(t, name, suffix, code, environment):
    resource(t, name + "Log", "AWS::Logs::LogGroup", {
        "LogGroupName": SUB("/aws/lambda/${ProjectName}-" + suffix), "RetentionInDays": 7}, retain=True)
    return resource(t, name, "AWS::Lambda::Function", {
        "FunctionName": SUB("${ProjectName}-" + suffix), "Runtime": "python3.12",
        "Handler": "index.handler", "Role": GET(name + "Role", "Arn"),
        "MemorySize": 128, "Timeout": 30,
        "Code": {"ZipFile": code}, "Environment": {"Variables": environment}, "Tags": TAGS},
        depends=[name + "Log"])


def private_bucket(t, name, lifecycle):
    bucket = resource(t, name, "AWS::S3::Bucket", {
        "BucketEncryption": {"ServerSideEncryptionConfiguration": [{"ServerSideEncryptionByDefault": {
            "SSEAlgorithm": "AES256"}}]}, "VersioningConfiguration": {"Status": "Enabled"},
        "OwnershipControls": {"Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}]},
        "PublicAccessBlockConfiguration": {"BlockPublicAcls": True, "IgnorePublicAcls": True,
                                           "BlockPublicPolicy": True, "RestrictPublicBuckets": True},
        "LifecycleConfiguration": {"Rules": lifecycle}, "Tags": TAGS}, retain=True)
    resource(t, name + "Policy", "AWS::S3::BucketPolicy", {
        "Bucket": bucket, "PolicyDocument": {"Version": "2012-10-17", "Statement": [{
            "Effect": "Deny", "Principal": "*", "Action": "s3:*",
            "Resource": [GET(name, "Arn"), SUB("${" + name + ".Arn}/*")],
            "Condition": {"Bool": {"aws:SecureTransport": "false"}}}]}})
    return bucket


def network():
    t = template("JobTracker two-AZ network reference; no NAT, no host, no hourly endpoint.")
    vpc = resource(t, "Vpc", "AWS::EC2::VPC", {
        "CidrBlock": "10.42.0.0/16", "EnableDnsSupport": True, "EnableDnsHostnames": True, "Tags": TAGS})
    gateway = resource(t, "Gateway", "AWS::EC2::InternetGateway", {"Tags": TAGS})
    resource(t, "GatewayAttachment", "AWS::EC2::VPCGatewayAttachment", {"VpcId": vpc, "InternetGatewayId": gateway})
    public = resource(t, "PublicRoutes", "AWS::EC2::RouteTable", {"VpcId": vpc, "Tags": TAGS})
    private = resource(t, "PrivateRoutes", "AWS::EC2::RouteTable", {"VpcId": vpc, "Tags": TAGS})
    resource(t, "InternetRoute", "AWS::EC2::Route", {
        "RouteTableId": public, "DestinationCidrBlock": "0.0.0.0/0", "GatewayId": gateway}, depends=["GatewayAttachment"])
    for index, az in enumerate(["A", "B"]):
        for visibility, octet, routes in [("Public", 1, public), ("Private", 11, private)]:
            name = visibility + az
            subnet = resource(t, name, "AWS::EC2::Subnet", {
                "VpcId": vpc, "CidrBlock": f"10.42.{octet + index}.0/24",
                "AvailabilityZone": {"Fn::Select": [index, {"Fn::GetAZs": ""}]},
                "MapPublicIpOnLaunch": False, "Tags": TAGS})
            resource(t, name + "Route", "AWS::EC2::SubnetRouteTableAssociation", {"SubnetId": subnet, "RouteTableId": routes})
            output(t, name + "SubnetId", subnet)
    resource(t, "S3Gateway", "AWS::EC2::VPCEndpoint", {
        "VpcId": vpc, "ServiceName": SUB("com.amazonaws.${AWS::Region}.s3"),
        "VpcEndpointType": "Gateway", "RouteTableIds": [private],
        "PolicyDocument": {"Version": "2012-10-17", "Statement": [allow(
            ["s3:GetObject", "s3:PutObject", "s3:ListBucket"], "*", Principal="*",
            Condition={"StringEquals": {"s3:ResourceAccount": REF("AWS::AccountId")}})]}})
    edge = resource(t, "EdgeGroup", "AWS::EC2::SecurityGroup", {
        "VpcId": vpc, "GroupDescription": "Public web only; no SSH",
        "SecurityGroupIngress": [{"IpProtocol": "tcp", "FromPort": p, "ToPort": p, "CidrIp": "0.0.0.0/0"} for p in [80, 443]],
        "SecurityGroupEgress": [{"IpProtocol": "tcp", "FromPort": 5000, "ToPort": 5000, "CidrIp": "10.42.0.0/16"}], "Tags": TAGS})
    app = resource(t, "AppGroup", "AWS::EC2::SecurityGroup", {
        "VpcId": vpc, "GroupDescription": "API reachable only from the web tier",
        "SecurityGroupIngress": [{"IpProtocol": "tcp", "FromPort": 5000, "ToPort": 5000, "SourceSecurityGroupId": edge}],
        "SecurityGroupEgress": [{"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "CidrIp": "0.0.0.0/0"},
                                {"IpProtocol": "tcp", "FromPort": 5432, "ToPort": 5432, "CidrIp": "10.42.0.0/16"}], "Tags": TAGS})
    database = resource(t, "DatabaseGroup", "AWS::EC2::SecurityGroup", {
        "VpcId": vpc, "GroupDescription": "Database reachable only from the API tier",
        "SecurityGroupIngress": [{"IpProtocol": "tcp", "FromPort": 5432, "ToPort": 5432, "SourceSecurityGroupId": app}],
        "SecurityGroupEgress": [{"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "CidrIp": "127.0.0.1/32"}], "Tags": TAGS})
    single = resource(t, "SingleHostGroup", "AWS::EC2::SecurityGroup", {
        "VpcId": vpc, "GroupDescription": "Minimum-cost combined web host; only HTTP/HTTPS inbound",
        "SecurityGroupIngress": [{"IpProtocol": "tcp", "FromPort": p, "ToPort": p, "CidrIp": "0.0.0.0/0"} for p in [80, 443]],
        "SecurityGroupEgress": [{"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "CidrIp": "0.0.0.0/0"}], "Tags": TAGS})
    for name, value in [("VpcId", vpc), ("EdgeSecurityGroupId", edge), ("AppSecurityGroupId", app),
                        ("DatabaseSecurityGroupId", database), ("SingleHostSecurityGroupId", single)]:
        output(t, name, value)
    return t


def storage():
    t = template("Private versioned recovery storage. SSE-S3 avoids a customer KMS key fee. Lifecycle costs apply when used.")
    backup = private_bucket(t, "Backups", [
        {"Id": "RecoveryRetention", "Status": "Enabled", "Prefix": "backups/", "ExpirationInDays": 14,
         "NoncurrentVersionExpiration": {"NoncurrentDays": 14}, "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1}},
        {"Id": "DeleteMarkers", "Status": "Enabled", "ExpiredObjectDeleteMarker": True}])
    archive = private_bucket(t, "Archives", [
        {"Id": "LongLivedArchive", "Status": "Enabled", "Prefix": "archives/", "ExpirationInDays": 365,
         "Transitions": [{"StorageClass": "GLACIER", "TransitionInDays": 90}],
         "NoncurrentVersionExpiration": {"NoncurrentDays": 14}, "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1}}])
    output(t, "BackupBucket", backup)
    output(t, "ArchiveBucket", archive)
    return t


def identity():
    t = template("Instance role reference: SSM instead of SSH/static IAM keys. Supply existing project bucket/queue.")
    bucket = parameter(t, "BackupBucketName")
    queue = parameter(t, "EventQueueArn")
    role(t, "InstanceRole", "ec2.amazonaws.com", [
        # SSM's agent channel APIs do not support resource-level ARNs. Keep the
        # parameter reads separate; the broad managed Core policy would allow
        # GetParameter/GetParameters outside the project prefix as well.
        allow(["ssm:DescribeAssociation", "ssm:GetDeployablePatchSnapshotForInstance", "ssm:GetDocument", "ssm:DescribeDocument",
               "ssm:GetManifest", "ssm:ListAssociations", "ssm:ListInstanceAssociations", "ssm:PutInventory",
               "ssm:PutComplianceItems", "ssm:PutConfigurePackageResult", "ssm:UpdateAssociationStatus",
               "ssm:UpdateInstanceAssociationStatus", "ssm:UpdateInstanceInformation"], "*"),
        allow(["ssmmessages:CreateControlChannel", "ssmmessages:CreateDataChannel", "ssmmessages:OpenControlChannel", "ssmmessages:OpenDataChannel"], "*"),
        allow(["ec2messages:AcknowledgeMessage", "ec2messages:DeleteMessage", "ec2messages:FailMessage", "ec2messages:GetEndpoint",
               "ec2messages:GetMessages", "ec2messages:SendReply"], "*"),
        allow(["s3:ListBucket"], SUB("arn:${AWS::Partition}:s3:::${BackupBucketName}"),
              Condition={"StringLike": {"s3:prefix": ["backups/*"]}}),
        allow(["s3:GetObject", "s3:PutObject"], SUB("arn:${AWS::Partition}:s3:::${BackupBucketName}/backups/*")),
        allow(["sqs:SendMessage"], queue),
        allow(["ssm:GetParameter", "ssm:GetParameters"], SUB("arn:${AWS::Partition}:ssm:${AWS::Region}:${AWS::AccountId}:parameter/jobtracker/*")),
        allow(["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
              SUB("arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/jobtracker/*:*")),
        allow(["cloudwatch:PutMetricData"], "*", Condition={"StringEquals": {"cloudwatch:namespace": "JobTracker/App"}})])
    profile = resource(t, "Profile", "AWS::IAM::InstanceProfile", {"Roles": [REF("InstanceRole")]})
    output(t, "InstanceProfileName", profile)
    output(t, "RoleArn", GET("InstanceRole", "Arn"))
    return t


def integration():
    t = template("Dormant SQS -> Standard Step Functions -> DynamoDB -> SNS workflow, with DLQ and Streams.")
    parameter(t, "EnableConsumers", Default="false", AllowedValues=["false", "true"])
    t["Conditions"]["ConsumersEnabled"] = {"Fn::And": [{"Condition": "Enabled"}, {"Fn::Equals": [REF("EnableConsumers"), "true"]}]}
    dlq = resource(t, "DeadLetters", "AWS::SQS::Queue", {
        "QueueName": SUB("${ProjectName}-event-dlq"), "SqsManagedSseEnabled": True,
        "RedriveAllowPolicy": {"redrivePermission": "byQueue", "sourceQueueArns": [
            SUB("arn:${AWS::Partition}:sqs:${AWS::Region}:${AWS::AccountId}:${ProjectName}-events")]},
        "MessageRetentionPeriod": 1209600, "Tags": TAGS}, retain=True)
    queue = resource(t, "Events", "AWS::SQS::Queue", {
        "QueueName": SUB("${ProjectName}-events"), "SqsManagedSseEnabled": True, "VisibilityTimeout": 180, "MessageRetentionPeriod": 345600,
        "ReceiveMessageWaitTimeSeconds": 20, "MaximumMessageSize": 4096,
        "RedrivePolicy": {"deadLetterTargetArn": GET("DeadLetters", "Arn"), "maxReceiveCount": 5}, "Tags": TAGS}, retain=True)
    resource(t, "QueuePolicy", "AWS::SQS::QueuePolicy", {"Queues": [queue, dlq], "PolicyDocument": {
        "Version": "2012-10-17", "Statement": [{"Effect": "Deny", "Principal": "*", "Action": "sqs:*",
            "Resource": [GET("Events", "Arn"), GET("DeadLetters", "Arn")],
            "Condition": {"Bool": {"aws:SecureTransport": "false"}}}]}})
    table = resource(t, "Audit", "AWS::DynamoDB::Table", {
        "AttributeDefinitions": [{"AttributeName": "event_id", "AttributeType": "S"}],
        "KeySchema": [{"AttributeName": "event_id", "KeyType": "HASH"}],
        "BillingMode": "PROVISIONED", "ProvisionedThroughput": {"ReadCapacityUnits": 1, "WriteCapacityUnits": 1},
        "StreamSpecification": {"StreamViewType": "KEYS_ONLY"},
        "TimeToLiveSpecification": {"AttributeName": "expires_at", "Enabled": True},
        "DeletionProtectionEnabled": True, "Tags": TAGS}, retain=True)
    topic = resource(t, "Notifications", "AWS::SNS::Topic", {"Tags": TAGS})
    role(t, "WorkflowRole", "states.amazonaws.com", [allow(["dynamodb:PutItem"], GET("Audit", "Arn")),
                                                        allow(["sns:Publish"], topic)])
    definition = {"StartAt": "ValidateEvent", "TimeoutSeconds": 120, "States": {
        "ValidateEvent": {"Type": "Choice", "Choices": [{"And": [
            {"Variable": "$.event_id", "IsPresent": True},
            {"Variable": "$.schema_version", "NumericEquals": 1}], "Next": "RecordEvent"}], "Default": "InvalidEvent"},
        "InvalidEvent": {"Type": "Fail", "Error": "InvalidEvent"},
        "RecordEvent": {"Type": "Task", "Resource": "arn:aws:states:::dynamodb:putItem", "Parameters": {
            "TableName": table, "Item": {"event_id": {"S.$": "$.event_id"},
                "event_type": {"S.$": "$.event_type"}, "occurred_at": {"S.$": "$.occurred_at"},
                "expires_at": {"N.$": "$.expires_at"}, "detail": {"S.$": "States.JsonToString($)"}},
            "ConditionExpression": "attribute_not_exists(event_id)"}, "ResultPath": None,
            "Retry": [{"ErrorEquals": ["DynamoDB.ProvisionedThroughputExceededException", "DynamoDB.ThrottlingException", "DynamoDB.InternalServerError"],
                       "IntervalSeconds": 2, "BackoffRate": 2, "MaxAttempts": 4}],
            "Catch": [{"ErrorEquals": ["DynamoDB.ConditionalCheckFailedException"], "Next": "AlreadyRecorded", "ResultPath": None}],
            "Next": "NotifyAdmin"},
        "NotifyAdmin": {"Type": "Task", "Resource": "arn:aws:states:::sns:publish", "Parameters": {
            "TopicArn": topic, "Message.$": "States.JsonToString($)", "Subject": "JobTracker hiring activity"},
            "Retry": [{"ErrorEquals": ["States.TaskFailed"], "IntervalSeconds": 2, "BackoffRate": 2, "MaxAttempts": 4}],
            "End": True},
        "AlreadyRecorded": {"Type": "Succeed"}}}
    state_machine = resource(t, "Workflow", "AWS::StepFunctions::StateMachine", {
        "StateMachineType": "STANDARD", "RoleArn": GET("WorkflowRole", "Arn"), "Definition": definition, "Tags": TAGS})
    lambda_role(t, "StarterRole", "event-starter", [
        allow(["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"], GET("Events", "Arn")),
        allow(["states:StartExecution"], state_machine)])
    starter = function(t, "Starter", "event-starter", inline_source("event_starter", ("event_contract", "validate_event")),
                       {"STATE_MACHINE_ARN": state_machine})
    resource(t, "EventsMapping", "AWS::Lambda::EventSourceMapping", {
        "EventSourceArn": GET("Events", "Arn"), "FunctionName": starter, "BatchSize": 5,
        "Enabled": {"Fn::If": ["ConsumersEnabled", True, False]},
        "ScalingConfig": {"MaximumConcurrency": 2},
        "FunctionResponseTypes": ["ReportBatchItemFailures"]})
    lambda_role(t, "StreamRole", "stream-audit", [allow(
        ["dynamodb:DescribeStream", "dynamodb:GetRecords", "dynamodb:GetShardIterator"], GET("Audit", "StreamArn")),
        allow(["dynamodb:ListStreams"], "*")])
    stream = function(t, "Stream", "stream-audit", inline_source("stream_audit"), {})
    resource(t, "StreamMapping", "AWS::Lambda::EventSourceMapping", {
        "EventSourceArn": GET("Audit", "StreamArn"), "FunctionName": stream, "StartingPosition": "LATEST",
        "BatchSize": 10, "MaximumRetryAttempts": 3, "MaximumRecordAgeInSeconds": 3600,
        "BisectBatchOnFunctionError": True, "Enabled": {"Fn::If": ["ConsumersEnabled", True, False]}})
    resource(t, "FailedWorkflowAlarm", "AWS::CloudWatch::Alarm", {
        "Namespace": "AWS/States", "MetricName": "ExecutionsFailed", "Statistic": "Sum", "Period": 300,
        "EvaluationPeriods": 1, "Threshold": 1, "ComparisonOperator": "GreaterThanOrEqualToThreshold",
        "TreatMissingData": "notBreaching", "Dimensions": [{"Name": "StateMachineArn", "Value": state_machine}], "AlarmActions": [topic]})
    resource(t, "DeadLetterAlarm", "AWS::CloudWatch::Alarm", {
        "Namespace": "AWS/SQS", "MetricName": "ApproximateNumberOfMessagesVisible", "Statistic": "Maximum", "Period": 300,
        "EvaluationPeriods": 1, "Threshold": 1, "ComparisonOperator": "GreaterThanOrEqualToThreshold",
        "TreatMissingData": "notBreaching", "Dimensions": [{"Name": "QueueName", "Value": GET("DeadLetters", "QueueName")}], "AlarmActions": [topic]})
    resource(t, "AlarmTopicPolicy", "AWS::SNS::TopicPolicy", {"Topics": [topic], "PolicyDocument": {
        "Version": "2012-10-17", "Statement": [allow("sns:Publish", topic,
            Principal={"Service": "cloudwatch.amazonaws.com"}, Condition={"StringEquals": {"aws:SourceAccount": REF("AWS::AccountId")},
                "ArnLike": {"aws:SourceArn": SUB("arn:${AWS::Partition}:cloudwatch:${AWS::Region}:${AWS::AccountId}:alarm:*")}})]}})
    for name, value in [("QueueUrl", queue), ("QueueArn", GET("Events", "Arn")), ("AuditTable", table),
                        ("NotificationTopicArn", topic), ("StateMachineArn", state_machine)]:
        output(t, name, value)
    return t


def credit_monitor():
    t = template("Optional account-wide credit monitor and gross cost budget. All resources and scheduling disabled by default.")
    parameter(t, "EnableSchedule", Default="false", AllowedValues=["false", "true"])
    parameter(t, "CreateNewBudget", Default="false", AllowedValues=["false", "true"],
              Description="Keep false when the existing account-wide gross budget is already configured")
    t["Conditions"]["BudgetEnabled"] = {"Fn::And": [{"Condition": "Enabled"},
        {"Fn::Equals": [REF("CreateNewBudget"), "true"]}]}
    email = parameter(t, "AlertEmail", AllowedPattern=r"[^\s@]+@[^\s@]+\.[^\s@]+")
    parameter(t, "CreditReserveUSD", "Number", Default=25, MinValue=0)
    parameter(t, "ThresholdsUSD", Default="100,50,25,10", AllowedPattern=r"[0-9]+(\.[0-9]+)?(,[0-9]+(\.[0-9]+)?)*")
    topic = resource(t, "Alerts", "AWS::SNS::Topic", {"Tags": TAGS})
    resource(t, "EmailSubscription", "AWS::SNS::Subscription", {"TopicArn": topic, "Protocol": "email", "Endpoint": email})
    table = resource(t, "MonitorState", "AWS::DynamoDB::Table", {
        "AttributeDefinitions": [{"AttributeName": "monitor_id", "AttributeType": "S"}],
        "KeySchema": [{"AttributeName": "monitor_id", "KeyType": "HASH"}], "BillingMode": "PROVISIONED",
        "ProvisionedThroughput": {"ReadCapacityUnits": 1, "WriteCapacityUnits": 1},
        "DeletionProtectionEnabled": True, "Tags": TAGS}, retain=True)
    lambda_role(t, "MonitorRole", "credit-monitor", [
        allow(["freetier:GetAccountPlanState"], "*"), allow(["sns:Publish"], topic),
        allow(["dynamodb:GetItem", "dynamodb:PutItem"], GET("MonitorState", "Arn")),
        allow(["cloudwatch:PutMetricData"], "*", Condition={"StringEquals": {"cloudwatch:namespace": "JobTracker/Cost"}})])
    monitor = function(t, "Monitor", "credit-monitor", inline_source("credit_monitor", ("credit_policy", "assess")), {
        "EXPECTED_ACCOUNT_ID": REF("AWS::AccountId"), "STATE_TABLE": table, "ALERT_TOPIC_ARN": topic,
        "RESERVE_USD": REF("CreditReserveUSD"), "THRESHOLDS_USD": REF("ThresholdsUSD")})
    t["Conditions"]["ScheduleEnabled"] = {"Fn::And": [{"Condition": "Enabled"}, {"Fn::Equals": [REF("EnableSchedule"), "true"]}]}
    schedule = resource(t, "DailyCheck", "AWS::Events::Rule", {
        "ScheduleExpression": "rate(1 day)", "State": {"Fn::If": ["ScheduleEnabled", "ENABLED", "DISABLED"]},
        "Targets": [{"Id": "CreditMonitor", "Arn": GET("Monitor", "Arn"),
                     "RetryPolicy": {"MaximumEventAgeInSeconds": 3600, "MaximumRetryAttempts": 2}}]})
    resource(t, "SchedulePermission", "AWS::Lambda::Permission", {
        "Action": "lambda:InvokeFunction", "FunctionName": monitor,
        "Principal": "events.amazonaws.com", "SourceArn": GET("DailyCheck", "Arn"), "SourceAccount": REF("AWS::AccountId")})
    resource(t, "FailedMonitorAlarm", "AWS::CloudWatch::Alarm", {
        "Namespace": "AWS/Lambda", "MetricName": "Errors", "Statistic": "Sum", "Period": 86400,
        "EvaluationPeriods": 1, "Threshold": 1, "ComparisonOperator": "GreaterThanOrEqualToThreshold",
        "TreatMissingData": "notBreaching", "Dimensions": [{"Name": "FunctionName", "Value": REF("Monitor")}], "AlarmActions": [topic]})
    resource(t, "MissingCreditSamplesAlarm", "AWS::CloudWatch::Alarm", {
        "Namespace": "JobTracker/Cost", "MetricName": "RemainingCreditsUSD", "Statistic": "SampleCount", "Period": 86400,
        "EvaluationPeriods": 2, "DatapointsToAlarm": 2, "Threshold": 1, "ComparisonOperator": "LessThanThreshold",
        "TreatMissingData": "breaching", "AlarmDescription": "The enabled daily credit monitor has missed two daily samples",
        "AlarmActions": [topic]}, condition="ScheduleEnabled")
    resource(t, "AlertTopicPolicy", "AWS::SNS::TopicPolicy", {"Topics": [topic], "PolicyDocument": {
        "Version": "2012-10-17", "Statement": [allow("sns:Publish", topic,
            Principal={"Service": "cloudwatch.amazonaws.com"}, Condition={"StringEquals": {"aws:SourceAccount": REF("AWS::AccountId")},
                "ArnLike": {"aws:SourceArn": SUB("arn:${AWS::Partition}:cloudwatch:${AWS::Region}:${AWS::AccountId}:alarm:*")}})]}})
    notifications = []
    for amount in [1, 5, 10]:
        notifications.append({"Notification": {"NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN",
            "ThresholdType": "ABSOLUTE_VALUE", "Threshold": amount}, "Subscribers": [{"SubscriptionType": "EMAIL", "Address": email}]})
    resource(t, "GrossMonthlyBudget", "AWS::Budgets::Budget", {
        "Budget": {"BudgetName": SUB("${ProjectName}-gross-cost"), "BudgetType": "COST", "TimeUnit": "MONTHLY",
            "BudgetLimit": {"Amount": 10, "Unit": "USD"}, "CostTypes": {"IncludeCredit": False, "IncludeRefund": False,
            "IncludeTax": True, "UseBlended": False}}, "NotificationsWithSubscribers": notifications}, condition="BudgetEnabled")
    output(t, "CreditMonitorFunction", monitor)
    output(t, "AlertsTopicArn", topic)
    output(t, "ScheduleRule", schedule)
    return t


def compute():
    t = template("Optional single EC2 reference. Enabling creates a NEW host; do not apply beside the existing stopped host.", paid=True)
    image = parameter(t, "AmiId", "AWS::EC2::Image::Id")
    subnet = parameter(t, "PublicSubnetId", "AWS::EC2::Subnet::Id")
    security = parameter(t, "SecurityGroupId", "AWS::EC2::SecurityGroup::Id")
    profile = parameter(t, "InstanceProfileName")
    kind = parameter(t, "InstanceType", Default="t3.small", AllowedValues=["t3.micro", "t3.small"])
    instance = resource(t, "Instance", "AWS::EC2::Instance", {
        "ImageId": image, "InstanceType": kind, "IamInstanceProfile": profile,
        "NetworkInterfaces": [{"DeviceIndex": "0", "SubnetId": subnet, "GroupSet": [security], "AssociatePublicIpAddress": True}],
        "MetadataOptions": {"HttpTokens": "required", "HttpEndpoint": "enabled", "HttpPutResponseHopLimit": 2},
        "BlockDeviceMappings": [{"DeviceName": "/dev/xvda", "Ebs": {
            "VolumeSize": 16, "VolumeType": "gp3", "Encrypted": True, "DeleteOnTermination": False}}],
        "CreditSpecification": {"CPUCredits": "standard"}, "Monitoring": False,
        "DisableApiTermination": True, "InstanceInitiatedShutdownBehavior": "stop",
        "Tags": TAGS + [{"Key": "AutoStart", "Value": "false"}]}, retain=True)
    output(t, "InstanceId", instance)
    return t


def ha_lab():
    t = template("Cost-gated two-AZ ALB/Auto Scaling reference. Desired/min/max capacity all start at zero. Supply a prepared app AMI.", paid=True)
    image = parameter(t, "PreparedApplicationAmiId", "AWS::EC2::Image::Id")
    subnets = parameter(t, "PrivateSubnetIds", "List<AWS::EC2::Subnet::Id>")
    public = parameter(t, "PublicSubnetIds", "List<AWS::EC2::Subnet::Id>")
    vpc = parameter(t, "VpcId", "AWS::EC2::VPC::Id")
    app_group = parameter(t, "AppSecurityGroupId", "AWS::EC2::SecurityGroup::Id")
    edge_group = parameter(t, "EdgeSecurityGroupId", "AWS::EC2::SecurityGroup::Id")
    profile = parameter(t, "InstanceProfileName")
    cert = parameter(t, "CertificateArn", AllowedPattern="arn:aws[a-z-]*:acm:.*")
    lb = resource(t, "Balancer", "AWS::ElasticLoadBalancingV2::LoadBalancer", {
        "Scheme": "internet-facing", "Type": "application", "Subnets": public, "SecurityGroups": [edge_group],
        "LoadBalancerAttributes": [{"Key": "deletion_protection.enabled", "Value": "true"},
                                   {"Key": "routing.http.drop_invalid_header_fields.enabled", "Value": "true"}], "Tags": TAGS})
    target = resource(t, "Targets", "AWS::ElasticLoadBalancingV2::TargetGroup", {
        "VpcId": vpc, "Protocol": "HTTP", "Port": 5000, "TargetType": "instance", "HealthCheckPath": "/health", "Tags": TAGS})
    resource(t, "Https", "AWS::ElasticLoadBalancingV2::Listener", {"LoadBalancerArn": lb, "Port": 443, "Protocol": "HTTPS",
        "SslPolicy": "ELBSecurityPolicy-TLS13-1-2-2021-06", "Certificates": [{"CertificateArn": cert}],
        "DefaultActions": [{"Type": "forward", "TargetGroupArn": target}]})
    resource(t, "HttpRedirect", "AWS::ElasticLoadBalancingV2::Listener", {"LoadBalancerArn": lb, "Port": 80, "Protocol": "HTTP",
        "DefaultActions": [{"Type": "redirect", "RedirectConfig": {"Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}]})
    launch = resource(t, "Launch", "AWS::EC2::LaunchTemplate", {"LaunchTemplateData": {
        "ImageId": image, "InstanceType": "t3.small", "IamInstanceProfile": {"Name": profile}, "SecurityGroupIds": [app_group],
        "MetadataOptions": {"HttpTokens": "required", "HttpPutResponseHopLimit": 2},
        "BlockDeviceMappings": [{"DeviceName": "/dev/xvda", "Ebs": {
            "Encrypted": True, "VolumeSize": 16, "VolumeType": "gp3", "DeleteOnTermination": True}}],
        "CreditSpecification": {"CpuCredits": "standard"}, "Monitoring": {"Enabled": False}}})
    group = resource(t, "Autoscaling", "AWS::AutoScaling::AutoScalingGroup", {
        "MinSize": "0", "MaxSize": "0", "DesiredCapacity": "0", "VPCZoneIdentifier": subnets,
        "LaunchTemplate": {"LaunchTemplateId": launch, "Version": GET("Launch", "LatestVersionNumber")},
        "TargetGroupARNs": [target], "HealthCheckType": "ELB", "HealthCheckGracePeriod": 180,
        "Tags": [{**tag, "PropagateAtLaunch": True} for tag in TAGS]})
    output(t, "AutoScalingGroup", group)
    output(t, "LoadBalancerDns", GET("Balancer", "DNSName"))
    return t


def rds_lab():
    t = template("Cost-gated private encrypted PostgreSQL; Multi-AZ/read replica are additional explicit choices.", paid=True)
    subnets = parameter(t, "PrivateSubnetIds", "List<AWS::EC2::Subnet::Id>")
    group = parameter(t, "DatabaseSecurityGroupId", "AWS::EC2::SecurityGroup::Id")
    multi = parameter(t, "MultiAZ", Default="false", AllowedValues=["false", "true"])
    parameter(t, "EnableReadReplica", Default="false", AllowedValues=["false", "true"])
    t["Conditions"]["ReplicaEnabled"] = {"Fn::And": [{"Condition": "Enabled"}, {"Fn::Equals": [REF("EnableReadReplica"), "true"]}]}
    subnet = resource(t, "DatabaseSubnets", "AWS::RDS::DBSubnetGroup", {"DBSubnetGroupDescription": "Private database tier", "SubnetIds": subnets, "Tags": TAGS})
    db = resource(t, "Postgres", "AWS::RDS::DBInstance", {"Engine": "postgres", "DBInstanceClass": "db.t4g.micro",
        "AllocatedStorage": "20", "StorageType": "gp3", "StorageEncrypted": True, "DBName": "jobtracker",
        "MasterUsername": "jobtracker_admin", "ManageMasterUserPassword": True, "MultiAZ": multi,
        "DBSubnetGroupName": subnet, "VPCSecurityGroups": [group], "PubliclyAccessible": False,
        "BackupRetentionPeriod": 7, "DeletionProtection": True, "AutoMinorVersionUpgrade": True,
        "EnableIAMDatabaseAuthentication": True, "CopyTagsToSnapshot": True,
        "EnableCloudwatchLogsExports": ["postgresql"], "Tags": TAGS}, retain=True)
    resource(t, "ReadReplica", "AWS::RDS::DBInstance", {"SourceDBInstanceIdentifier": db,
        "DBInstanceClass": "db.t4g.micro", "PubliclyAccessible": False, "VPCSecurityGroups": [group],
        "DeletionProtection": True, "AutoMinorVersionUpgrade": True, "Tags": TAGS}, retain=True, condition="ReplicaEnabled")
    output(t, "DatabaseEndpoint", GET("Postgres", "Endpoint.Address"))
    return t


def aurora_lab():
    t = template("Cost-gated private Aurora PostgreSQL reference. Not part of the minimum-cost deployment.", paid=True)
    subnets = parameter(t, "PrivateSubnetIds", "List<AWS::EC2::Subnet::Id>")
    security = parameter(t, "DatabaseSecurityGroupId", "AWS::EC2::SecurityGroup::Id")
    subnet = resource(t, "DatabaseSubnets", "AWS::RDS::DBSubnetGroup", {"DBSubnetGroupDescription": "Private Aurora tier", "SubnetIds": subnets, "Tags": TAGS})
    cluster = resource(t, "Cluster", "AWS::RDS::DBCluster", {"Engine": "aurora-postgresql", "EngineMode": "provisioned",
        "DatabaseName": "jobtracker", "MasterUsername": "jobtracker_admin", "ManageMasterUserPassword": True,
        "StorageEncrypted": True, "DBSubnetGroupName": subnet, "VpcSecurityGroupIds": [security],
        "BackupRetentionPeriod": 7, "DeletionProtection": True, "CopyTagsToSnapshot": True,
        "EnableIAMDatabaseAuthentication": True, "Tags": TAGS}, retain=True)
    resource(t, "Writer", "AWS::RDS::DBInstance", {"Engine": "aurora-postgresql", "DBClusterIdentifier": cluster,
        "DBInstanceClass": "db.t4g.medium", "PubliclyAccessible": False, "AutoMinorVersionUpgrade": True, "Tags": TAGS}, retain=True)
    output(t, "ClusterEndpoint", GET("Cluster", "Endpoint.Address"))
    return t


def efs_lab():
    t = template("Cost-gated EFS reference: encryption, TLS requirement, access point, private NFS mount targets.", paid=True)
    vpc = parameter(t, "VpcId", "AWS::EC2::VPC::Id")
    subnet_a = parameter(t, "PrivateSubnetA", "AWS::EC2::Subnet::Id")
    subnet_b = parameter(t, "PrivateSubnetB", "AWS::EC2::Subnet::Id")
    app_group = parameter(t, "AppSecurityGroupId", "AWS::EC2::SecurityGroup::Id")
    fs = resource(t, "Files", "AWS::EFS::FileSystem", {"Encrypted": True, "PerformanceMode": "generalPurpose",
        "ThroughputMode": "bursting", "LifecyclePolicies": [{"TransitionToIA": "AFTER_30_DAYS"}],
        "FileSystemPolicy": {"Version": "2012-10-17", "Statement": [{"Effect": "Deny", "Principal": "*",
            "Action": "elasticfilesystem:Client*", "Resource": "*", "Condition": {"Bool": {"aws:SecureTransport": "false"}}}]},
        "FileSystemTags": TAGS}, retain=True)
    security = resource(t, "MountSecurity", "AWS::EC2::SecurityGroup", {"VpcId": vpc, "GroupDescription": "NFS only from application tier",
        "SecurityGroupIngress": [{"IpProtocol": "tcp", "FromPort": 2049, "ToPort": 2049, "SourceSecurityGroupId": app_group}], "Tags": TAGS})
    for suffix, subnet in [("A", subnet_a), ("B", subnet_b)]:
        resource(t, "Mount" + suffix, "AWS::EFS::MountTarget", {"FileSystemId": fs, "SubnetId": subnet, "SecurityGroups": [security]})
    access = resource(t, "AccessPoint", "AWS::EFS::AccessPoint", {"FileSystemId": fs,
        "PosixUser": {"Uid": "1000", "Gid": "1000"}, "RootDirectory": {"Path": "/jobtracker",
            "CreationInfo": {"OwnerUid": "1000", "OwnerGid": "1000", "Permissions": "750"}}, "AccessPointTags": TAGS})
    output(t, "FileSystemId", fs)
    output(t, "AccessPointId", access)
    return t


def kms_lab():
    t = template("Optional customer KMS key; monthly key charges apply. AWS-owned/default keys remain the minimum-cost choice.", paid=True)
    key = resource(t, "Key", "AWS::KMS::Key", {"EnableKeyRotation": True, "PendingWindowInDays": 30,
        "Description": "JobTracker optional customer key", "KeyPolicy": {"Version": "2012-10-17", "Statement": [{
            "Sid": "EnableIAMAdministration", "Effect": "Allow", "Principal": {"AWS": SUB("arn:${AWS::Partition}:iam::${AWS::AccountId}:root")},
            "Action": "kms:*", "Resource": "*"}]}, "Tags": TAGS}, retain=True)
    resource(t, "Alias", "AWS::KMS::Alias", {"AliasName": SUB("alias/${ProjectName}"), "TargetKeyId": key})
    output(t, "KeyArn", GET("Key", "Arn"))
    return t


def peering_lab():
    t = template("Optional same-account VPC peering, with explicit routes. Cross-AZ/Region transfer can cost money.", paid=True)
    vpc = parameter(t, "VpcId", "AWS::EC2::VPC::Id")
    peer = parameter(t, "PeerVpcId", "AWS::EC2::VPC::Id")
    route = parameter(t, "RouteTableId")
    peer_route = parameter(t, "PeerRouteTableId")
    cidr = parameter(t, "VpcCidr", AllowedPattern=r"[0-9.]+/[0-9]{1,2}")
    peer_cidr = parameter(t, "PeerVpcCidr", AllowedPattern=r"[0-9.]+/[0-9]{1,2}")
    link = resource(t, "Peering", "AWS::EC2::VPCPeeringConnection", {"VpcId": vpc, "PeerVpcId": peer, "Tags": TAGS})
    resource(t, "LocalRoute", "AWS::EC2::Route", {"RouteTableId": route, "DestinationCidrBlock": peer_cidr, "VpcPeeringConnectionId": link})
    resource(t, "PeerRoute", "AWS::EC2::Route", {"RouteTableId": peer_route, "DestinationCidrBlock": cidr, "VpcPeeringConnectionId": link})
    output(t, "PeeringConnectionId", link)
    return t


def waf_lab():
    t = template("Cost-gated AWS WAF managed rules and IP rate limiting. CloudFront scope must be created in us-east-1.", paid=True)
    scope = parameter(t, "Scope", Default="CLOUDFRONT", AllowedValues=["CLOUDFRONT", "REGIONAL"])
    acl = resource(t, "WebACL", "AWS::WAFv2::WebACL", {"Scope": scope, "DefaultAction": {"Allow": {}},
        "VisibilityConfig": {"CloudWatchMetricsEnabled": False, "SampledRequestsEnabled": False, "MetricName": "JobTrackerWebAcl"},
        "Rules": [{"Name": "CommonRules", "Priority": 0, "OverrideAction": {"None": {}}, "Statement": {
            "ManagedRuleGroupStatement": {"VendorName": "AWS", "Name": "AWSManagedRulesCommonRuleSet"}},
            "VisibilityConfig": {"CloudWatchMetricsEnabled": False, "SampledRequestsEnabled": False, "MetricName": "CommonRules"}},
            {"Name": "IPRateLimit", "Priority": 1, "Action": {"Block": {}}, "Statement": {
                "RateBasedStatement": {"Limit": 100, "AggregateKeyType": "IP"}}, "VisibilityConfig": {
                    "CloudWatchMetricsEnabled": False, "SampledRequestsEnabled": False, "MetricName": "IPRateLimit"}}], "Tags": TAGS})
    output(t, "WebAclArn", GET("WebACL", "Arn"))
    return t


def cloudfront():
    t = template("Private S3 static frontend plus HTTPS API origin. API is never cached; no distribution is created by default.")
    domain = parameter(t, "ApiOriginDomain", AllowedPattern=r"[A-Za-z0-9.-]+", Description="Current HTTPS origin hostname, not a URL; must have a valid matching certificate")
    parameter(t, "WebAclArn", Default="")
    t["Conditions"]["HasWebAcl"] = {"Fn::Not": [{"Fn::Equals": [REF("WebAclArn"), ""]}]}
    bucket = resource(t, "StaticSite", "AWS::S3::Bucket", {
        "BucketEncryption": {"ServerSideEncryptionConfiguration": [{"ServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]},
        "OwnershipControls": {"Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}]},
        "PublicAccessBlockConfiguration": {"BlockPublicAcls": True, "IgnorePublicAcls": True, "BlockPublicPolicy": True, "RestrictPublicBuckets": True}, "Tags": TAGS}, retain=True)
    oac = resource(t, "OriginAccess", "AWS::CloudFront::OriginAccessControl", {"OriginAccessControlConfig": {
        "Name": SUB("${ProjectName}-static-oac"), "OriginAccessControlOriginType": "s3", "SigningBehavior": "always", "SigningProtocol": "sigv4"}})
    no_cache = resource(t, "NoApiCache", "AWS::CloudFront::CachePolicy", {"CachePolicyConfig": {
        "Name": SUB("${ProjectName}-no-api-cache"), "DefaultTTL": 0, "MaxTTL": 0, "MinTTL": 0,
        "ParametersInCacheKeyAndForwardedToOrigin": {"EnableAcceptEncodingGzip": False, "EnableAcceptEncodingBrotli": False,
            "CookiesConfig": {"CookieBehavior": "none"}, "HeadersConfig": {"HeaderBehavior": "none"},
            "QueryStringsConfig": {"QueryStringBehavior": "none"}}}})
    api_forward = resource(t, "ApiForward", "AWS::CloudFront::OriginRequestPolicy", {"OriginRequestPolicyConfig": {
        "Name": SUB("${ProjectName}-api-request"), "HeadersConfig": {"HeaderBehavior": "allExcept", "Headers": ["host"]},
        "CookiesConfig": {"CookieBehavior": "none"}, "QueryStringsConfig": {"QueryStringBehavior": "all"}}})
    response_policy = resource(t, "SecurityHeaders", "AWS::CloudFront::ResponseHeadersPolicy", {"ResponseHeadersPolicyConfig": {
        "Name": SUB("${ProjectName}-security-headers"), "SecurityHeadersConfig": {
            "ContentTypeOptions": {"Override": True}, "FrameOptions": {"FrameOption": "DENY", "Override": True},
            "ReferrerPolicy": {"ReferrerPolicy": "no-referrer", "Override": True},
            "StrictTransportSecurity": {"AccessControlMaxAgeSec": 31536000, "IncludeSubdomains": True, "Preload": False, "Override": True}}}})
    static_cache = resource(t, "StaticCache", "AWS::CloudFront::CachePolicy", {"CachePolicyConfig": {
        "Name": SUB("${ProjectName}-static-cache"), "DefaultTTL": 300, "MaxTTL": 86400, "MinTTL": 0,
        "ParametersInCacheKeyAndForwardedToOrigin": {"EnableAcceptEncodingGzip": True, "EnableAcceptEncodingBrotli": True,
            "CookiesConfig": {"CookieBehavior": "none"}, "HeadersConfig": {"HeaderBehavior": "none"},
            "QueryStringsConfig": {"QueryStringBehavior": "none"}}}})
    rewrite = resource(t, "SpaRewrite", "AWS::CloudFront::Function", {"Name": SUB("${ProjectName}-spa-routes"),
        "AutoPublish": True, "FunctionConfig": {"Comment": "SPA routes only; preserve API and static files", "Runtime": "cloudfront-js-2.0"},
        "FunctionCode": "function handler(event) { var r = event.request; if (r.uri.indexOf('/api/') !== 0 && r.uri.indexOf('.') === -1) r.uri = '/index.html'; return r; }"})
    distribution = resource(t, "Distribution", "AWS::CloudFront::Distribution", {"DistributionConfig": {
        "Enabled": True, "HttpVersion": "http2", "IPV6Enabled": True, "PriceClass": "PriceClass_100", "DefaultRootObject": "index.html",
        "ViewerCertificate": {"CloudFrontDefaultCertificate": True},
        "WebACLId": {"Fn::If": ["HasWebAcl", REF("WebAclArn"), REF("AWS::NoValue")]},
        "Origins": [{"Id": "static", "DomainName": GET("StaticSite", "RegionalDomainName"), "S3OriginConfig": {"OriginAccessIdentity": ""}, "OriginAccessControlId": oac},
                    {"Id": "api", "DomainName": domain, "CustomOriginConfig": {"OriginProtocolPolicy": "https-only", "OriginSSLProtocols": ["TLSv1.2"]}}],
        "DefaultCacheBehavior": {"TargetOriginId": "static", "ViewerProtocolPolicy": "redirect-to-https", "Compress": True,
            "CachePolicyId": static_cache, "ResponseHeadersPolicyId": response_policy, "AllowedMethods": ["GET", "HEAD"],
            "FunctionAssociations": [{"EventType": "viewer-request", "FunctionARN": GET("SpaRewrite", "FunctionARN")}]},
        "CacheBehaviors": [{"PathPattern": "/api/*", "TargetOriginId": "api", "ViewerProtocolPolicy": "https-only",
            "CachePolicyId": no_cache, "OriginRequestPolicyId": api_forward,
            "ResponseHeadersPolicyId": response_policy,
            "AllowedMethods": ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"]}]}, "Tags": TAGS})
    resource(t, "BucketPolicy", "AWS::S3::BucketPolicy", {"Bucket": bucket, "PolicyDocument": {
        "Version": "2012-10-17", "Statement": [allow("s3:GetObject", SUB("${StaticSite.Arn}/*"),
            Principal={"Service": "cloudfront.amazonaws.com"}, Condition={"StringEquals": {"AWS:SourceArn": SUB("arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${Distribution}")}}),
            {"Effect": "Deny", "Principal": "*", "Action": "s3:*", "Resource": [GET("StaticSite", "Arn"), SUB("${StaticSite.Arn}/*")],
             "Condition": {"Bool": {"aws:SecureTransport": "false"}}}]}})
    output(t, "StaticBucket", bucket)
    output(t, "DistributionDomain", GET("Distribution", "DomainName"))
    return t


def observability():
    t = template("Optional basic EC2 alarms and single management-event CloudTrail copy; no data events or Config recorder.")
    instance = parameter(t, "ExistingInstanceId", "AWS::EC2::Instance::Id")
    topic = parameter(t, "AlertTopicArn")
    parameter(t, "EnableTrail", Default="false", AllowedValues=["false", "true"])
    resource(t, "ApplicationLogs", "AWS::Logs::LogGroup", {"LogGroupName": "/jobtracker/operations", "RetentionInDays": 7}, retain=True)
    resource(t, "Diagnostics", "AWS::SSM::Document", {"DocumentType": "Command", "DocumentFormat": "JSON",
        "Content": {"schemaVersion": "2.2", "description": "Read-only JobTracker status; no secret files, environment or credentials",
            "mainSteps": [{"action": "aws:runShellScript", "name": "status", "inputs": {"timeoutSeconds": "60", "runCommand": [
                "systemctl is-active jobtracker.service || true", "docker ps --format '{{.Names}} {{.Status}}'", "df -h /opt/jobtracker"]}}]}, "Tags": TAGS})
    t["Conditions"]["TrailEnabled"] = {"Fn::And": [{"Condition": "Enabled"}, {"Fn::Equals": [REF("EnableTrail"), "true"]}]}
    for name, metric, statistic, threshold in [("StatusFailed", "StatusCheckFailed", "Maximum", 1), ("HighCPU", "CPUUtilization", "Average", 80)]:
        resource(t, name, "AWS::CloudWatch::Alarm", {"Namespace": "AWS/EC2", "MetricName": metric, "Statistic": statistic,
            "Period": 300, "EvaluationPeriods": 2, "Threshold": threshold,
            "ComparisonOperator": "GreaterThanOrEqualToThreshold", "TreatMissingData": "notBreaching",
            "Dimensions": [{"Name": "InstanceId", "Value": instance}], "AlarmActions": [topic]})
    logs = resource(t, "TrailBucket", "AWS::S3::Bucket", {
        "BucketEncryption": {"ServerSideEncryptionConfiguration": [{"ServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]},
        "PublicAccessBlockConfiguration": {"BlockPublicAcls": True, "IgnorePublicAcls": True, "BlockPublicPolicy": True, "RestrictPublicBuckets": True},
        "LifecycleConfiguration": {"Rules": [{"Status": "Enabled", "ExpirationInDays": 30, "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1}}]}, "Tags": TAGS}, retain=True, condition="TrailEnabled")
    trail_arn = SUB("arn:${AWS::Partition}:cloudtrail:${AWS::Region}:${AWS::AccountId}:trail/${ProjectName}-management")
    resource(t, "TrailBucketPolicy", "AWS::S3::BucketPolicy", {"Bucket": logs, "PolicyDocument": {"Version": "2012-10-17", "Statement": [
        allow("s3:GetBucketAcl", GET("TrailBucket", "Arn"), Principal={"Service": "cloudtrail.amazonaws.com"}, Condition={"StringEquals": {"aws:SourceArn": trail_arn}}),
        allow("s3:PutObject", SUB("${TrailBucket.Arn}/AWSLogs/${AWS::AccountId}/*"), Principal={"Service": "cloudtrail.amazonaws.com"},
              Condition={"StringEquals": {"s3:x-amz-acl": "bucket-owner-full-control", "aws:SourceArn": trail_arn}}),
        {"Effect": "Deny", "Principal": "*", "Action": "s3:*", "Resource": [GET("TrailBucket", "Arn"), SUB("${TrailBucket.Arn}/*")],
         "Condition": {"Bool": {"aws:SecureTransport": "false"}}}]}}, condition="TrailEnabled")
    resource(t, "ManagementTrail", "AWS::CloudTrail::Trail", {"TrailName": SUB("${ProjectName}-management"),
        "S3BucketName": logs, "IsLogging": True, "IsMultiRegionTrail": True, "IncludeGlobalServiceEvents": True,
        "EnableLogFileValidation": True, "EventSelectors": [{"ReadWriteType": "WriteOnly", "IncludeManagementEvents": True}], "Tags": TAGS},
        condition="TrailEnabled", depends=["TrailBucketPolicy"])
    return t


def config_lab():
    t = template("Cost-gated AWS Config: narrowly scoped recorder and encrypted-EBS/private-S3 rules. Check existing account recorder first.", paid=True)
    bucket_name = parameter(t, "ExistingDeliveryBucket")
    role(t, "RecorderRole", "config.amazonaws.com", [allow(["ec2:DescribeVolumes", "ec2:DescribeSecurityGroups", "ec2:DescribeInstances"], "*"),
        allow(["s3:GetBucketAcl", "s3:GetBucketLocation", "s3:GetBucketPolicy", "s3:GetBucketPublicAccessBlock", "s3:GetEncryptionConfiguration"], "*"),
        allow(["s3:PutObject"], SUB("arn:${AWS::Partition}:s3:::${ExistingDeliveryBucket}/AWSLogs/${AWS::AccountId}/Config/*"))])
    recorder = resource(t, "Recorder", "AWS::Config::ConfigurationRecorder", {"RoleARN": GET("RecorderRole", "Arn"),
        "RecordingGroup": {"AllSupported": False, "IncludeGlobalResourceTypes": False,
                           "ResourceTypes": ["AWS::EC2::Volume", "AWS::S3::Bucket", "AWS::EC2::SecurityGroup"]}})
    resource(t, "Delivery", "AWS::Config::DeliveryChannel", {"S3BucketName": bucket_name})
    for name, identifier, scope in [("EncryptedEbs", "ENCRYPTED_VOLUMES", "AWS::EC2::Volume"), ("PrivateS3", "S3_BUCKET_PUBLIC_READ_PROHIBITED", "AWS::S3::Bucket")]:
        resource(t, name, "AWS::Config::ConfigRule", {"Scope": {"ComplianceResourceTypes": [scope]},
            "Source": {"Owner": "AWS", "SourceIdentifier": identifier}}, depends=["Recorder"])
    output(t, "RecorderName", recorder)
    return t


def dms_lab():
    t = template("Cost-gated DMS full-load/CDC reference. Creates no running migration task automatically; instance has hourly/storage costs.", paid=True)
    subnets = parameter(t, "PrivateSubnetIds", "List<AWS::EC2::Subnet::Id>")
    security = parameter(t, "ReplicationSecurityGroupId", "AWS::EC2::SecurityGroup::Id")
    access_role = parameter(t, "SecretsAccessRoleArn")
    source_secret = parameter(t, "SourceSecretArn")
    target_secret = parameter(t, "TargetSecretArn")
    source_certificate = parameter(t, "SourceCertificateArn")
    target_certificate = parameter(t, "TargetCertificateArn")
    subnet = resource(t, "Subnets", "AWS::DMS::ReplicationSubnetGroup", {"ReplicationSubnetGroupDescription": "Private migration tier", "SubnetIds": subnets, "Tags": TAGS})
    replica = resource(t, "Replication", "AWS::DMS::ReplicationInstance", {"ReplicationInstanceClass": "dms.t3.micro",
        "AllocatedStorage": 50, "MultiAZ": False, "PubliclyAccessible": False,
        "ReplicationSubnetGroupIdentifier": subnet, "VpcSecurityGroupIds": [security], "Tags": TAGS})
    for name, kind, secret, certificate in [("Source", "source", source_secret, source_certificate), ("Target", "target", target_secret, target_certificate)]:
        resource(t, name, "AWS::DMS::Endpoint", {"EndpointType": kind, "EngineName": "postgres", "SslMode": "verify-full", "CertificateArn": certificate,
            "PostgreSqlSettings": {"SecretsManagerSecretId": secret, "SecretsManagerAccessRoleArn": access_role}, "Tags": TAGS})
    task = resource(t, "Task", "AWS::DMS::ReplicationTask", {"MigrationType": "full-load-and-cdc",
        "ReplicationInstanceArn": replica, "SourceEndpointArn": REF("Source"), "TargetEndpointArn": REF("Target"),
        "TableMappings": json.dumps({"rules": [{"rule-type": "selection", "rule-id": str(i), "rule-name": name,
            "object-locator": {"schema-name": "public", "table-name": name}, "rule-action": "include"}
            for i, name in enumerate(["jobs", "applications", "admin_users"], 1)]}), "Tags": TAGS})
    output(t, "TaskArn", task)
    return t


BUILDERS = {"network": network, "storage": storage, "identity": identity,
            "integration": integration, "credit-monitor": credit_monitor, "compute-reference": compute,
            "ha-lab": ha_lab, "rds-lab": rds_lab, "aurora-lab": aurora_lab,
            "efs-lab": efs_lab, "kms-lab": kms_lab, "peering-lab": peering_lab,
            "waf-lab": waf_lab, "cloudfront": cloudfront, "observability": observability,
            "config-lab": config_lab, "dms-lab": dms_lab}


def main():
    directory = ROOT / "aws/templates"
    directory.mkdir(parents=True, exist_ok=True)
    for name, build in BUILDERS.items():
        (directory / (name + ".json")).write_text(json.dumps(build(), indent=2) + "\n")
    print("Generated", len(BUILDERS), "disabled-by-default templates; no AWS calls made.")


if __name__ == "__main__":
    main()
