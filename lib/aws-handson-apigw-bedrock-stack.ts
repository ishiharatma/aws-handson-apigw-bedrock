import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import {
  aws_iam as iam,
  aws_s3 as s3,
  aws_logs as logs,
  aws_lambda as lambda,
  aws_apigateway as apigw,
} from 'aws-cdk-lib';


interface AwsHandsonApigwBedrockStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly ipAddress: string;
}

export class AwsHandsonApigwBedrockStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsHandsonApigwBedrockStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    const srcLambdaDirBase:string = '../src/lambda';
    const baseName:string = 'handson-apigw-bedrock';

    // Output S3 Bucket
    const resultS3Bucket = new s3.Bucket(this, 'BedrockResultBucket', {
      bucketName: [props.pjName, props.envName,baseName, accountId].join('.'),
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.KMS_MANAGED,
    });
    // Bucket Lifecycle
    resultS3Bucket.addLifecycleRule({
      expiration: cdk.Duration.days(60),
      abortIncompleteMultipartUploadAfter: cdk.Duration.days(7), // 不完全なマルチパートアップロードの削除
      transitions: [
        {
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(0),
        },
      ],
    });

    // Lambda
    const bedrockLambdaFunctionRole = new iam.Role(this, 'BedrockLambdaFunctionRole',{
      roleName: ['@role', 'lambda', props.pjName, props.envName,baseName].join('-'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        BedrockInvokeModel: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions:[
              "bedrock:InvokeModel",
            ],
            resources: ["arn:aws:bedrock:us-east-1::foundation-model/stability.stable-diffusion-xl-v1"],
          }),
         ]
      }),
        S3PutObject: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions:[
              "s3:GetObject",
              "s3:PutObject",
            ],
            resources: [resultS3Bucket.arnForObjects('*')],
          }),
         ]
      }),
      }
    });
    const bedrockLambdaFunction = new lambda.Function(
      this,
      'bedrockLambdaFunction',
      {
        functionName: [props.pjName, props.envName,baseName].join('-'),
        code: lambda.Code.fromAsset(
          path.join(__dirname, `${srcLambdaDirBase}/handson-bedrock`)
        ),
        handler: 'index.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_12,
        timeout: cdk.Duration.seconds(25),
        architecture: lambda.Architecture.ARM_64, //X86_64,
        environment: {
          S3_BUCKET_NAME: resultS3Bucket.bucketName,
          LOG_LEVEL: 'INFO',
        },
        role: bedrockLambdaFunctionRole,
        //tracing: lambda.Tracing.ACTIVE,
      }
    );

    // API Gateway
    const restApiName = [props.pjName, props.envName, baseName].join('-');
    const apigwLogGroup = new logs.LogGroup(this,'LogGroup',{
      logGroupName: restApiName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const resourcePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["execute-api:Invoke"],
          principals: [new iam.AnyPrincipal()],
          resources: ["execute-api:/*/*/*"],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: ["execute-api:Invoke"],
          principals: [new iam.AnyPrincipal()],
          resources: ["execute-api:/*/*/*"],
          conditions: {
            NotIpAddress: {
              // ここで許可したい IP アドレスを指定する
              "aws:SourceIp": [props.ipAddress]
            },
          },
        }),
      ]
    });
    const restApi = new apigw.RestApi(this, 'APIGateway', {
        restApiName: restApiName,
        policy: resourcePolicy,
        endpointTypes: [apigw.EndpointType.REGIONAL],
        deployOptions: {
          stageName: 'v1',
          loggingLevel: apigw.MethodLoggingLevel.INFO,
          // カスタムログ
          accessLogDestination: new apigw.LogGroupLogDestination(apigwLogGroup),
          // フォーマットカスタム
          // See: https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html#context-variable-reference-access-logging-only
          // アクセスログ記録専用の $context 変数
          accessLogFormat: apigw.AccessLogFormat.custom(
            JSON.stringify({
              reqestId: apigw.AccessLogField.contextResourceId(),
              requestId: apigw.AccessLogField.contextRequestId(),
              ip: apigw.AccessLogField.contextIdentitySourceIp(),
              user: apigw.AccessLogField.contextIdentityUser(),
              caller: apigw.AccessLogField.contextIdentityCaller(),
              requestTime: apigw.AccessLogField.contextRequestTime(),
              httpMethod: apigw.AccessLogField.contextHttpMethod(),
              resourcePath: apigw.AccessLogField.contextResourcePath(),
              status: apigw.AccessLogField.contextStatus(),
              protocol: apigw.AccessLogField.contextProtocol(),
              responseLength: apigw.AccessLogField.contextResponseLength(),
              integrationLatency: apigw.AccessLogField.contextIntegrationLatency(), // 統合レイテンシー (ミリ秒):
                                                                                  // バックエンドにリクエストを中継してから、バックエンドからレスポンスを受け取るまでの時間
              responselatency: apigw.AccessLogField.contextResponseLatency(), // レスポンスレイテンシー (ミリ秒)
                                                                            // クライアントからリクエストを受け取ってから、クライアントにレスポンスを返すまでの時間
                                                                            // API Gateway のオーバーヘッドを含む時間
            }),
          ),
        },
        cloudWatchRole: true,
        // CORS Prefilight Options sample
        // See: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html#cross-origin-resource-sharing-cors
        defaultCorsPreflightOptions: {
          allowOrigins: apigw.Cors.ALL_ORIGINS,
          allowMethods: apigw.Cors.ALL_METHODS,
          allowHeaders: apigw.Cors.DEFAULT_HEADERS,
          statusCode: 200,
        },
    });

    new cdk.CfnOutput(this, 'restApiId', {
      value: restApi.restApiId,
    });
    new cdk.CfnOutput(this, 'restApiEndpoint', {
      value: restApi.url,
    });

    //API Gatewayにリクエスト先のリソースを追加
    const restApiBedrock = restApi.root.addResource('bedrock');

    //リソースにPOSTメソッド、Lambda統合プロキシを指定
    //restApiBedrock.addCorsPreflight({
    //  allowOrigins: ['http://localhost:3000'],
    //  allowMethods: ['PUT'],
    //  //allowHeaders: []
    //});
    restApiBedrock.addMethod(
      'POST',
      new apigw.LambdaIntegration(bedrockLambdaFunction)
    );

  }
}
