import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";
import * as fs from "fs";

export interface WebStackProps extends cdk.StackProps {
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
}

const FRONTEND_DIST = path.join(__dirname, "..", "..", "frontend", "dist");

export class WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `campus-portal-site-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    // Deploy the built frontend/dist output only if it exists - the frontend
    // must be built (npm run build, after generate-frontend-env has written
    // frontend/.env) before this stack is deployed. On first-ever deploy this
    // directory may not exist yet; guard so `cdk synth` doesn't fail locally.
    if (fs.existsSync(FRONTEND_DIST)) {
      new s3deploy.BucketDeployment(this, "SiteDeployment", {
        sources: [s3deploy.Source.asset(FRONTEND_DIST)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ["/*"],
      });
    } else {
      new cdk.CfnOutput(this, "FrontendBuildRequired", {
        value:
          "frontend/dist not found at synth time - run `npm run build` in frontend/ (after generating frontend/.env) and redeploy WebStack to publish the site.",
      });
    }

    new cdk.CfnOutput(this, "SiteUrl", { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, "ApiUrlForFrontend", { value: props.apiUrl });
    new cdk.CfnOutput(this, "UserPoolIdForFrontend", { value: props.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientIdForFrontend", { value: props.userPoolClientId });
  }
}
