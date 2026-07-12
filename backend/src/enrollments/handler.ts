import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TableNames } from "../shared/ddb-client";
import { getCallerContext, requireAdmin, requireSelfOrAdmin } from "../shared/auth";
import { badRequest, created, handleErrors, noContent, ok } from "../shared/http";
import type { Enrollment } from "../shared/types";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  handleErrors(async () => {
    const ctx = getCallerContext(event);
    const routeKey = event.routeKey;
    const studentId = event.pathParameters?.studentId;
    const courseId = event.pathParameters?.courseId;

    switch (routeKey) {
      case "GET /enrollments/student/{studentId}": {
        if (!studentId) return badRequest("studentId is required");
        requireSelfOrAdmin(ctx, studentId);
        const result = await ddb.send(
          new QueryCommand({
            TableName: TableNames.enrollments,
            KeyConditionExpression: "studentId = :sid",
            ExpressionAttributeValues: { ":sid": studentId },
          })
        );
        return ok(result.Items ?? []);
      }

      case "GET /enrollments/course/{courseId}": {
        requireAdmin(ctx);
        if (!courseId) return badRequest("courseId is required");
        const result = await ddb.send(
          new QueryCommand({
            TableName: TableNames.enrollments,
            IndexName: "courseId-studentId-index",
            KeyConditionExpression: "courseId = :cid",
            ExpressionAttributeValues: { ":cid": courseId },
          })
        );
        return ok(result.Items ?? []);
      }

      case "POST /enrollments": {
        requireAdmin(ctx);
        const body = JSON.parse(event.body ?? "{}");
        if (!body.studentId || !body.courseId) return badRequest("studentId and courseId are required");
        const enrollment: Enrollment = {
          studentId: body.studentId,
          courseId: body.courseId,
          enrolledAt: new Date().toISOString(),
          status: "enrolled",
        };
        await ddb.send(new PutCommand({ TableName: TableNames.enrollments, Item: enrollment }));
        return created(enrollment);
      }

      case "DELETE /enrollments/{studentId}/{courseId}": {
        requireAdmin(ctx);
        if (!studentId || !courseId) return badRequest("studentId and courseId are required");
        await ddb.send(
          new DeleteCommand({ TableName: TableNames.enrollments, Key: { studentId, courseId } })
        );
        return noContent();
      }

      default:
        return badRequest(`Unsupported route: ${routeKey}`);
    }
  });
