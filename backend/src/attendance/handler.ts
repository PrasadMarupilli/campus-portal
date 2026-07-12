import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { BatchWriteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TableNames } from "../shared/ddb-client";
import { getCallerContext, requireAdmin, requireSelfOrAdmin } from "../shared/auth";
import { badRequest, handleErrors, ok } from "../shared/http";
import type { AttendanceRecord } from "../shared/types";

const BATCH_LIMIT = 25;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  handleErrors(async () => {
    const ctx = getCallerContext(event);
    const routeKey = event.routeKey;
    const studentId = event.pathParameters?.studentId;
    const courseId = event.pathParameters?.courseId;
    const date = event.pathParameters?.date;

    switch (routeKey) {
      case "GET /attendance/student/{studentId}/course/{courseId}": {
        if (!studentId || !courseId) return badRequest("studentId and courseId are required");
        requireSelfOrAdmin(ctx, studentId);
        const result = await ddb.send(
          new QueryCommand({
            TableName: TableNames.attendance,
            KeyConditionExpression: "studentCourseId = :key",
            ExpressionAttributeValues: { ":key": `${studentId}#${courseId}` },
          })
        );
        return ok(result.Items ?? []);
      }

      case "GET /attendance/course/{courseId}": {
        requireAdmin(ctx);
        if (!courseId) return badRequest("courseId is required");
        const queryDate = event.queryStringParameters?.date;
        const keyCondition = queryDate ? "courseId = :cid AND #date = :date" : "courseId = :cid";
        const values: Record<string, unknown> = { ":cid": courseId };
        if (queryDate) values[":date"] = queryDate;
        const result = await ddb.send(
          new QueryCommand({
            TableName: TableNames.attendance,
            IndexName: "courseId-date-index",
            KeyConditionExpression: keyCondition,
            ExpressionAttributeNames: queryDate ? { "#date": "date" } : undefined,
            ExpressionAttributeValues: values,
          })
        );
        return ok(result.Items ?? []);
      }

      case "POST /attendance": {
        requireAdmin(ctx);
        const body = JSON.parse(event.body ?? "{}");
        if (!body.courseId || !body.date || !Array.isArray(body.marks)) {
          return badRequest("courseId, date, and marks[] are required");
        }
        const now = new Date().toISOString();
        const records: AttendanceRecord[] = body.marks.map((m: { studentId: string; status: string }) => ({
          studentCourseId: `${m.studentId}#${body.courseId}`,
          date: body.date,
          studentId: m.studentId,
          courseId: body.courseId,
          status: m.status,
          markedBy: ctx.sub,
          markedAt: now,
        }));
        for (const batch of chunk(records, BATCH_LIMIT)) {
          await ddb.send(
            new BatchWriteCommand({
              RequestItems: {
                [TableNames.attendance]: batch.map((record) => ({ PutRequest: { Item: record } })),
              },
            })
          );
        }
        return ok({ marked: records.length });
      }

      case "PUT /attendance/{studentId}/{courseId}/{date}": {
        requireAdmin(ctx);
        if (!studentId || !courseId || !date) return badRequest("studentId, courseId, date are required");
        const body = JSON.parse(event.body ?? "{}");
        if (!body.status) return badRequest("status is required");
        const record: AttendanceRecord = {
          studentCourseId: `${studentId}#${courseId}`,
          date,
          studentId,
          courseId,
          status: body.status,
          markedBy: ctx.sub,
          markedAt: new Date().toISOString(),
        };
        await ddb.send(new PutCommand({ TableName: TableNames.attendance, Item: record }));
        return ok(record);
      }

      default:
        return badRequest(`Unsupported route: ${routeKey}`);
    }
  });
