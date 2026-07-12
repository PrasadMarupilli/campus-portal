import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TableNames = {
  students: process.env.STUDENTS_TABLE ?? "",
  courses: process.env.COURSES_TABLE ?? "",
  enrollments: process.env.ENROLLMENTS_TABLE ?? "",
  attendance: process.env.ATTENDANCE_TABLE ?? "",
  announcements: process.env.ANNOUNCEMENTS_TABLE ?? "",
  documents: process.env.DOCUMENTS_TABLE ?? "",
};

export const DocumentsBucketName = process.env.DOCUMENTS_BUCKET ?? "";
