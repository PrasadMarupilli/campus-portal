import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { randomUUID } from "crypto";
import { ddb, TableNames } from "../shared/ddb-client";
import { cognito, UserPoolId } from "../shared/cognito-client";
import { getCallerContext, requireAdmin, requireSelfOrAdmin, resolveStudentIdBySub } from "../shared/auth";
import { badRequest, forbidden, handleErrors, notFound, ok, created, noContent } from "../shared/http";
import { generateTempPassword } from "../shared/ids";
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
        if (!body.email || !body.firstName || !body.lastName) {
          return badRequest("email, firstName, lastName are required");
        }

        const newStudentId = randomUUID();
        const password = typeof body.password === "string" && body.password.length > 0 ? body.password : generateTempPassword();

        try {
          await cognito.send(
            new AdminCreateUserCommand({
              UserPoolId,
              Username: body.email,
              UserAttributes: [
                { Name: "email", Value: body.email },
                { Name: "email_verified", Value: "true" },
                { Name: "given_name", Value: body.firstName },
                { Name: "family_name", Value: body.lastName },
                { Name: "custom:studentId", Value: newStudentId },
              ],
              MessageAction: "SUPPRESS",
            })
          );
        } catch (err) {
          if (err instanceof Error && err.name === "UsernameExistsException") {
            return badRequest("A Cognito user with this email already exists");
          }
          throw err;
        }

        try {
          await cognito.send(
            new AdminSetUserPasswordCommand({ UserPoolId, Username: body.email, Password: password, Permanent: true })
          );
          await cognito.send(
            new AdminAddUserToGroupCommand({ UserPoolId, Username: body.email, GroupName: "Students" })
          );
          const cognitoUser = await cognito.send(new AdminGetUserCommand({ UserPoolId, Username: body.email }));
          const cognitoSub = cognitoUser.UserAttributes?.find((a) => a.Name === "sub")?.Value;
          if (!cognitoSub) throw new Error("Could not resolve the new Cognito user's sub");

          const student: Student = {
            studentId: newStudentId,
            cognitoSub,
            email: body.email,
            firstName: body.firstName,
            lastName: body.lastName,
            program: body.program ?? "",
            year: body.year ?? 1,
            status: "active",
            createdAt: new Date().toISOString(),
          };
          await ddb.send(new PutCommand({ TableName: TableNames.students, Item: student }));
          return created({ ...student, temporaryPassword: password });
        } catch (err) {
          // Cognito user was created above; if anything after that fails, remove it
          // so the email isn't stuck as an orphan blocking future retries.
          await cognito.send(new AdminDeleteUserCommand({ UserPoolId, Username: body.email })).catch(() => {});
          throw err;
        }
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
        const existing = await ddb.send(new GetCommand({ TableName: TableNames.students, Key: { studentId } }));
        if (existing.Item) {
          try {
            await cognito.send(new AdminDeleteUserCommand({ UserPoolId, Username: existing.Item.email }));
          } catch (err) {
            if (!(err instanceof Error && err.name === "UserNotFoundException")) throw err;
          }
        }
        await ddb.send(new DeleteCommand({ TableName: TableNames.students, Key: { studentId } }));
        return noContent();
      }

      default:
        return badRequest(`Unsupported route: ${routeKey}`);
    }
  });
