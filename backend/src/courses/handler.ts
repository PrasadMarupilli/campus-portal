import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TableNames } from "../shared/ddb-client";
import { getCallerContext, requireAdmin } from "../shared/auth";
import { badRequest, created, handleErrors, noContent, notFound, ok } from "../shared/http";
import { generateCourseId } from "../shared/ids";
import type { Course } from "../shared/types";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  handleErrors(async () => {
    const ctx = getCallerContext(event);
    const routeKey = event.routeKey;
    const courseId = event.pathParameters?.courseId;

    switch (routeKey) {
      case "GET /courses": {
        // any authenticated user (student or admin) may browse the catalog
        const result = await ddb.send(new ScanCommand({ TableName: TableNames.courses }));
        return ok(result.Items ?? []);
      }

      case "GET /courses/{courseId}": {
        if (!courseId) return badRequest("courseId is required");
        const result = await ddb.send(
          new GetCommand({ TableName: TableNames.courses, Key: { courseId } })
        );
        if (!result.Item) return notFound();
        return ok(result.Item);
      }

      case "POST /courses": {
        requireAdmin(ctx);
        const body = JSON.parse(event.body ?? "{}");
        if (!body.courseCode || !body.title) return badRequest("courseCode and title are required");
        const course: Course = {
          courseId: generateCourseId(body.department),
          courseCode: body.courseCode,
          title: body.title,
          department: body.department ?? "",
          credits: body.credits ?? 3,
          instructor: body.instructor ?? "",
          semester: body.semester ?? "",
        };
        await ddb.send(new PutCommand({ TableName: TableNames.courses, Item: course }));
        return created(course);
      }

      case "PUT /courses/{courseId}": {
        requireAdmin(ctx);
        if (!courseId) return badRequest("courseId is required");
        const body = JSON.parse(event.body ?? "{}");
        const updatable = ["courseCode", "title", "department", "credits", "instructor", "semester"] as const;
        const setParts: string[] = [];
        const values: Record<string, unknown> = {};
        const names: Record<string, string> = {};
        for (const key of updatable) {
          if (body[key] !== undefined) {
            setParts.push(`#${key} = :${key}`);
            names[`#${key}`] = key;
            values[`:${key}`] = body[key];
          }
        }
        if (setParts.length === 0) return badRequest("No updatable fields provided");
        await ddb.send(
          new UpdateCommand({
            TableName: TableNames.courses,
            Key: { courseId },
            UpdateExpression: `SET ${setParts.join(", ")}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
          })
        );
        return ok({ courseId, updated: true });
      }

      case "DELETE /courses/{courseId}": {
        requireAdmin(ctx);
        if (!courseId) return badRequest("courseId is required");
        await ddb.send(new DeleteCommand({ TableName: TableNames.courses, Key: { courseId } }));
        return noContent();
      }

      default:
        return badRequest(`Unsupported route: ${routeKey}`);
    }
  });
