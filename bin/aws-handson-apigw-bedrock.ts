#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsHandsonApigwBedrockStack } from '../lib/aws-handson-apigw-bedrock-stack';

const app = new cdk.App();
// environment identifier
const envName: string = app.node.tryGetContext('env');
const projectName: string = app.node.tryGetContext('project');
const myIP: string = app.node.tryGetContext('myip'); // my Public IPaddress

// env
const defaultEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const useast1Env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "us-east-1",
};

new AwsHandsonApigwBedrockStack(app, 'AwsHandsonApigwBedrockStack', {
  pjName: projectName,
  envName: envName,
  ipAddress: myIP,
  env: useast1Env,
});