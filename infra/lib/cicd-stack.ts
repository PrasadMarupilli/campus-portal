import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

export interface CicdStackProps extends cdk.StackProps {
  githubOwner: string;
  githubRepo: string;
}

// One-time bootstrap stack: deploy this locally with your own AWS credentials
// (`cdk deploy CampusPortalCicdStack`) before wiring up GitHub Actions. It creates
// the OIDC trust relationship GitHub Actions uses to assume an AWS role without
// any long-lived access keys stored as repo secrets.
export class CicdStack extends cdk.Stack {
  public readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    if (!props.githubOwner || !props.githubRepo) {
      new cdk.CfnOutput(this, "SetupRequired", {
        value:
          "Pass -c githubOwner=<owner> -c githubRepo=<repo> to cdk deploy/synth to configure the GitHub OIDC trust policy.",
      });
    }

    const provider = new iam.OpenIdConnectProvider(this, "GithubOidcProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const repoSubject = `repo:${props.githubOwner || "<owner>"}/${props.githubRepo || "<repo>"}:ref:refs/heads/main`;

    this.deployRole = new iam.Role(this, "GithubActionsDeployRole", {
      roleName: "campus-portal-github-actions-deploy",
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        },
        StringLike: {
          "token.actions.githubusercontent.com:sub": repoSubject,
        },
      }),
      description: "Assumed by GitHub Actions via OIDC to deploy the campus portal CDK stacks",
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Scope: this is a prototype, so the deploy role is granted permissions
    // broad enough for CDK to manage all resources this app creates (Cognito,
    // DynamoDB, S3, Lambda, API Gateway, CloudFront, IAM roles for those
    // resources) plus the CDK bootstrap roles it needs to assume.
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "AssumeCdkBootstrapRoles",
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      })
    );

    new cdk.CfnOutput(this, "DeployRoleArn", { value: this.deployRole.roleArn });
  }
}
