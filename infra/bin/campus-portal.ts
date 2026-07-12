#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AuthStack } from "../lib/auth-stack";
import { DataStack } from "../lib/data-stack";
import { ApiStack } from "../lib/api-stack";
import { WebStack } from "../lib/web-stack";
import { CicdStack } from "../lib/cicd-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

const authStack = new AuthStack(app, "CampusPortalAuthStack", { env });

const dataStack = new DataStack(app, "CampusPortalDataStack", { env });

const apiStack = new ApiStack(app, "CampusPortalApiStack", {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  studentsTable: dataStack.studentsTable,
  coursesTable: dataStack.coursesTable,
  enrollmentsTable: dataStack.enrollmentsTable,
  attendanceTable: dataStack.attendanceTable,
  announcementsTable: dataStack.announcementsTable,
  documentsTable: dataStack.documentsTable,
  documentsBucket: dataStack.documentsBucket,
});

new WebStack(app, "CampusPortalWebStack", {
  env,
  apiUrl: apiStack.apiUrl,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
});

const githubOwner = app.node.tryGetContext("githubOwner") || "";
const githubRepo = app.node.tryGetContext("githubRepo") || "";

new CicdStack(app, "CampusPortalCicdStack", {
  env,
  githubOwner,
  githubRepo,
});
