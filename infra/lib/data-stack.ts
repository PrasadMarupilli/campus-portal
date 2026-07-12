import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";

export class DataStack extends cdk.Stack {
  public readonly studentsTable: dynamodb.Table;
  public readonly coursesTable: dynamodb.Table;
  public readonly enrollmentsTable: dynamodb.Table;
  public readonly attendanceTable: dynamodb.Table;
  public readonly announcementsTable: dynamodb.Table;
  public readonly documentsTable: dynamodb.Table;
  public readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.studentsTable = new dynamodb.Table(this, "StudentsTable", {
      tableName: "CampusPortal-Students",
      partitionKey: { name: "studentId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.studentsTable.addGlobalSecondaryIndex({
      indexName: "cognitoSub-index",
      partitionKey: { name: "cognitoSub", type: dynamodb.AttributeType.STRING },
    });

    this.coursesTable = new dynamodb.Table(this, "CoursesTable", {
      tableName: "CampusPortal-Courses",
      partitionKey: { name: "courseId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.enrollmentsTable = new dynamodb.Table(this, "EnrollmentsTable", {
      tableName: "CampusPortal-Enrollments",
      partitionKey: { name: "studentId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "courseId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.enrollmentsTable.addGlobalSecondaryIndex({
      indexName: "courseId-studentId-index",
      partitionKey: { name: "courseId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "studentId", type: dynamodb.AttributeType.STRING },
    });

    this.attendanceTable = new dynamodb.Table(this, "AttendanceTable", {
      tableName: "CampusPortal-Attendance",
      partitionKey: { name: "studentCourseId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "date", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.attendanceTable.addGlobalSecondaryIndex({
      indexName: "courseId-date-index",
      partitionKey: { name: "courseId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "date", type: dynamodb.AttributeType.STRING },
    });

    this.announcementsTable = new dynamodb.Table(this, "AnnouncementsTable", {
      tableName: "CampusPortal-Announcements",
      partitionKey: { name: "announcementId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.announcementsTable.addGlobalSecondaryIndex({
      indexName: "audience-createdAt-index",
      partitionKey: { name: "audience", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
    });

    this.documentsTable = new dynamodb.Table(this, "DocumentsTable", {
      tableName: "CampusPortal-Documents",
      partitionKey: { name: "studentId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "documentId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.documentsTable.addGlobalSecondaryIndex({
      indexName: "docType-uploadedAt-index",
      partitionKey: { name: "docType", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "uploadedAt", type: dynamodb.AttributeType.STRING },
    });

    this.documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
      bucketName: `campus-portal-documents-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}
