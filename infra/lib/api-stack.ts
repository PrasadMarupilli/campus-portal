import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as path from "path";

export interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  studentsTable: dynamodb.Table;
  coursesTable: dynamodb.Table;
  enrollmentsTable: dynamodb.Table;
  attendanceTable: dynamodb.Table;
  announcementsTable: dynamodb.Table;
  documentsTable: dynamodb.Table;
  documentsBucket: s3.Bucket;
}

const BACKEND_DIR = path.join(__dirname, "..", "..", "backend");
const BACKEND_SRC = path.join(BACKEND_DIR, "src");
const BACKEND_LOCK_FILE = path.join(BACKEND_DIR, "package-lock.json");

export class ApiStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    this.httpApi = new apigwv2.HttpApi(this, "CampusPortalHttpApi", {
      apiName: "campus-portal-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
      },
    });

    const authorizer = new HttpJwtAuthorizer("CampusPortalJwtAuthorizer", props.userPool.userPoolProviderUrl, {
      jwtAudience: [props.userPoolClient.userPoolClientId],
      identitySource: ["$request.header.Authorization"],
    });

    const commonEnv: Record<string, string> = {
      STUDENTS_TABLE: props.studentsTable.tableName,
      COURSES_TABLE: props.coursesTable.tableName,
      ENROLLMENTS_TABLE: props.enrollmentsTable.tableName,
      ATTENDANCE_TABLE: props.attendanceTable.tableName,
      ANNOUNCEMENTS_TABLE: props.announcementsTable.tableName,
      DOCUMENTS_TABLE: props.documentsTable.tableName,
      DOCUMENTS_BUCKET: props.documentsBucket.bucketName,
    };

    const makeFn = (name: string, extraEnv: Record<string, string> = {}) =>
      new lambdaNode.NodejsFunction(this, `${name}Fn`, {
        functionName: `campus-portal-${name}`,
        entry: path.join(BACKEND_SRC, name, "handler.ts"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: { ...commonEnv, ...extraEnv },
        projectRoot: BACKEND_DIR,
        depsLockFilePath: BACKEND_LOCK_FILE,
        bundling: { minify: true, sourceMap: false },
      });

    const studentsFn = makeFn("students");
    const coursesFn = makeFn("courses");
    const enrollmentsFn = makeFn("enrollments");
    const attendanceFn = makeFn("attendance");
    const announcementsFn = makeFn("announcements");
    const documentsFn = makeFn("documents");

    // Least-privilege grants: each Lambda only gets access to the table(s)
    // and bucket it actually needs, not a shared blanket role.
    props.studentsTable.grantReadWriteData(studentsFn);
    props.coursesTable.grantReadWriteData(coursesFn);
    props.enrollmentsTable.grantReadWriteData(enrollmentsFn);
    props.attendanceTable.grantReadWriteData(attendanceFn);
    props.announcementsTable.grantReadWriteData(announcementsFn);
    props.documentsTable.grantReadWriteData(documentsFn);
    props.documentsBucket.grantReadWrite(documentsFn);

    const integrationFor = (fn: lambdaNode.NodejsFunction) => new HttpLambdaIntegration(`${fn.node.id}Integration`, fn);

    const addRoute = (path_: string, method: apigwv2.HttpMethod, fn: lambdaNode.NodejsFunction) => {
      this.httpApi.addRoutes({
        path: path_,
        methods: [method],
        integration: integrationFor(fn),
        authorizer,
      });
    };

    // Students
    addRoute("/students", apigwv2.HttpMethod.GET, studentsFn);
    addRoute("/students/me", apigwv2.HttpMethod.GET, studentsFn);
    addRoute("/students/{studentId}", apigwv2.HttpMethod.GET, studentsFn);
    addRoute("/students", apigwv2.HttpMethod.POST, studentsFn);
    addRoute("/students/{studentId}", apigwv2.HttpMethod.PUT, studentsFn);
    addRoute("/students/{studentId}", apigwv2.HttpMethod.DELETE, studentsFn);

    // Courses
    addRoute("/courses", apigwv2.HttpMethod.GET, coursesFn);
    addRoute("/courses/{courseId}", apigwv2.HttpMethod.GET, coursesFn);
    addRoute("/courses", apigwv2.HttpMethod.POST, coursesFn);
    addRoute("/courses/{courseId}", apigwv2.HttpMethod.PUT, coursesFn);
    addRoute("/courses/{courseId}", apigwv2.HttpMethod.DELETE, coursesFn);

    // Enrollments
    addRoute("/enrollments/student/{studentId}", apigwv2.HttpMethod.GET, enrollmentsFn);
    addRoute("/enrollments/course/{courseId}", apigwv2.HttpMethod.GET, enrollmentsFn);
    addRoute("/enrollments", apigwv2.HttpMethod.POST, enrollmentsFn);
    addRoute("/enrollments/{studentId}/{courseId}", apigwv2.HttpMethod.DELETE, enrollmentsFn);

    // Attendance
    addRoute("/attendance/student/{studentId}/course/{courseId}", apigwv2.HttpMethod.GET, attendanceFn);
    addRoute("/attendance/course/{courseId}", apigwv2.HttpMethod.GET, attendanceFn);
    addRoute("/attendance", apigwv2.HttpMethod.POST, attendanceFn);
    addRoute("/attendance/{studentId}/{courseId}/{date}", apigwv2.HttpMethod.PUT, attendanceFn);

    // Announcements
    addRoute("/announcements", apigwv2.HttpMethod.GET, announcementsFn);
    addRoute("/announcements", apigwv2.HttpMethod.POST, announcementsFn);
    addRoute("/announcements/{announcementId}", apigwv2.HttpMethod.PUT, announcementsFn);
    addRoute("/announcements/{announcementId}", apigwv2.HttpMethod.DELETE, announcementsFn);

    // Documents
    addRoute("/documents", apigwv2.HttpMethod.GET, documentsFn);
    addRoute("/documents/upload-url", apigwv2.HttpMethod.POST, documentsFn);
    addRoute("/documents/{documentId}/download-url", apigwv2.HttpMethod.GET, documentsFn);
    addRoute("/documents/{documentId}", apigwv2.HttpMethod.DELETE, documentsFn);

    this.apiUrl = this.httpApi.apiEndpoint;
    new cdk.CfnOutput(this, "ApiUrl", { value: this.apiUrl });
  }
}
