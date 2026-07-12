import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { ddb, TableNames } from "../shared/ddb-client";
import { getCallerContext, requireAdmin } from "../shared/auth";
import { badRequest, created, handleErrors, noContent, ok } from "../shared/http";
import type { Announcement, AnnouncementAudience } from "../shared/types";

async function queryByAudience(audience: AnnouncementAudience) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TableNames.announcements,
      IndexName: "audience-createdAt-index",
      KeyConditionExpression: "audience = :aud",
      ExpressionAttributeValues: { ":aud": audience },
      ScanIndexForward: false,
    })
  );
  return result.Items ?? [];
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  handleErrors(async () => {
    const ctx = getCallerContext(event);
    const routeKey = event.routeKey;
    const announcementId = event.pathParameters?.announcementId;

    switch (routeKey) {
      case "GET /announcements": {
        const audiences: AnnouncementAudience[] = ctx.isAdmin
          ? ["ALL", "STUDENTS", "ADMINS"]
          : ["ALL", "STUDENTS"];
        const results = await Promise.all(audiences.map(queryByAudience));
        const merged = results.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        return ok(merged);
      }

      case "POST /announcements": {
        requireAdmin(ctx);
        const body = JSON.parse(event.body ?? "{}");
        if (!body.title || !body.body) return badRequest("title and body are required");
        const announcement: Announcement = {
          announcementId: randomUUID(),
          title: body.title,
          body: body.body,
          audience: body.audience ?? "ALL",
          createdBy: ctx.sub,
          createdAt: new Date().toISOString(),
          pinned: Boolean(body.pinned),
        };
        await ddb.send(new PutCommand({ TableName: TableNames.announcements, Item: announcement }));
        return created(announcement);
      }

      case "PUT /announcements/{announcementId}": {
        requireAdmin(ctx);
        if (!announcementId) return badRequest("announcementId is required");
        const body = JSON.parse(event.body ?? "{}");
        if (!body.title || !body.body) return badRequest("title and body are required");
        const announcement: Announcement = {
          announcementId,
          title: body.title,
          body: body.body,
          audience: body.audience ?? "ALL",
          createdBy: ctx.sub,
          createdAt: body.createdAt ?? new Date().toISOString(),
          pinned: Boolean(body.pinned),
        };
        await ddb.send(new PutCommand({ TableName: TableNames.announcements, Item: announcement }));
        return ok(announcement);
      }

      case "DELETE /announcements/{announcementId}": {
        requireAdmin(ctx);
        if (!announcementId) return badRequest("announcementId is required");
        await ddb.send(
          new DeleteCommand({ TableName: TableNames.announcements, Key: { announcementId } })
        );
        return noContent();
      }

      default:
        return badRequest(`Unsupported route: ${routeKey}`);
    }
  });
