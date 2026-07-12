import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TableNames } from "./ddb-client";
import { HttpError } from "./http";
import type { CallerContext } from "./types";

export function getCallerContext(event: APIGatewayProxyEventV2WithJWTAuthorizer): CallerContext {
  const claims = event.requestContext.authorizer.jwt.claims;
  const rawGroups = claims["cognito:groups"];
  const groups = Array.isArray(rawGroups)
    ? (rawGroups as string[])
    : typeof rawGroups === "string"
      ? rawGroups.replace(/^\[|\]$/g, "").split(",").map((g) => g.trim()).filter(Boolean)
      : [];

  const studentIdClaim = claims["custom:studentId"];

  return {
    sub: String(claims.sub),
    email: String(claims.email ?? ""),
    groups,
    isAdmin: groups.includes("Admins"),
    studentId: studentIdClaim ? String(studentIdClaim) : null,
  };
}

export function requireAdmin(ctx: CallerContext): void {
  if (!ctx.isAdmin) {
    throw new HttpError(403, "Admin privileges required");
  }
}

export function requireSelfOrAdmin(ctx: CallerContext, resourceStudentId: string): void {
  if (ctx.isAdmin) return;
  if (ctx.studentId && ctx.studentId === resourceStudentId) return;
  throw new HttpError(403, "You may only access your own records");
}

// Fallback resolver for callers whose JWT doesn't carry custom:studentId
// (e.g. tokens issued before the attribute was set). Prefer ctx.studentId
// from the token when present - this hits DynamoDB on every call.
export async function resolveStudentIdBySub(cognitoSub: string): Promise<string | null> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TableNames.students,
      IndexName: "cognitoSub-index",
      KeyConditionExpression: "cognitoSub = :sub",
      ExpressionAttributeValues: { ":sub": cognitoSub },
      Limit: 1,
    })
  );
  const item = result.Items?.[0];
  return item ? (item.studentId as string) : null;
}

export async function getStudentById(studentId: string) {
  const result = await ddb.send(
    new GetCommand({ TableName: TableNames.students, Key: { studentId } })
  );
  return result.Item ?? null;
}
