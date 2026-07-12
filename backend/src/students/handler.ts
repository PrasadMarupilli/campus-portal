import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { ddb, TableNames } from "../shared/ddb-client";
import { getCallerContext, requireAdmin, requireSelfOrAdmin, resolveStudentIdBySub } from "../shared/auth";
import { badRequest, forbidden, handleErrors, notFound, ok, created, noContent } from "../shared/http";
import type { Student } from "../shared/types";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  handleErrors(async () => {
    const ctx = getCallerContext(event);
    const routeKey = event.routeKey;
    const studentId = event.pathParameters?.studentId;

    switch (routeKey) {
      case "GET /students": {
        if (!ctx.isAdmin) return forbidden("Admin privileges required");
        const result = await ddb.send(new ScanCommand({ TableName: TableNames.students }));
        return ok(result.Items ?? []);
      }

      case "GET /students/me": {
        const resolvedId = ctx.studentId ?? (await resolveStudentIdBySub(ctx.sub));
        if (!resolvedId) return notFound("No student record linked to this account");
        const result = await ddb.send(
          new GetCommand({ TableName: TableNames.students, Key: { studentId: resolvedId } })
        );
        if (!result.Item) return notFound();
        return ok(result.Item);
      }

      case "GET /students/{studentId}": {
        if (!studentId) return badRequest("studentId is required");
        requireSelfOrAdmin(ctx, studentId);
        const result = await ddb.send(
          new GetCommand({ TableName: TableNames.students, Key: { studentId } })
        );
        if (!result.Item) return notFound();
        return ok(result.Item);
      }

      case "POST /students": {
        requireAdmin(ctx);
        const body = JSON.parse(event.body ?? "{}");
        if (!body.cognitoSub || !body.email || !body.firstName || !body.lastName) {
          return badRequest("cognitoSub, email, firstName, lastName are required");
        }
        const student: Student = {
          studentId: randomUUID(),
          cognitoSub: body.cognitoSub,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          program: body.program ?? "",
          year: body.year ?? 1,
          status: "active",
          createdAt: new Date().toISOString(),
        };
        await ddb.send(new PutCommand({ TableName: TableNames.students, Item: student }));
        return created(student);
      }

      case "PUT /students/{studentId}": {
        requireAdmin(ctx);
        if (!studentId) return badRequest("studentId is required");
        const body = JSON.parse(event.body ?? "{}");
        const updatable = ["firstName", "lastName", "program", "year", "status"] as const;
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
            TableName: TableNames.students,
            Key: { studentId },
            UpdateExpression: `SET ${setParts.join(", ")}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
          })
        );
        return ok({ studentId, updated: true });
      }

      case "DELETE /students/{studentId}": {
        requireAdmin(ctx);
        if (!studentId) return badRequest("studentId is required");
        await ddb.send(new DeleteCommand({ TableName: TableNames.students, Key: { studentId } }));
        return noContent();
      }

      default:
        return badRequest(`Unsupported route: ${routeKey}`);
    }
  });
