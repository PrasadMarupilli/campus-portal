import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { ddb, DocumentsBucketName, TableNames } from "../shared/ddb-client";
import { getCallerContext, requireSelfOrAdmin } from "../shared/auth";
import { badRequest, forbidden, handleErrors, notFound, ok, created } from "../shared/http";
import type { DocumentMeta } from "../shared/types";

const s3 = new S3Client({});
const UPLOAD_URL_EXPIRY_SECONDS = 300;
const DOWNLOAD_URL_EXPIRY_SECONDS = 60;

// Required for single-document routes (download/delete by documentId) since
// the metadata table is keyed by (studentId, documentId), not documentId
// alone. The frontend always knows the owning studentId already - it comes
// from whichever list call (own documents, or admin's cross-student browse)
// surfaced the row being acted on.
function requireOwnerQueryParam(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const ownerStudentId = event.queryStringParameters?.studentId;
  if (!ownerStudentId) throw new Error("Missing required query parameter: studentId");
  return ownerStudentId;
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) =>
  handleErrors(async () => {
    const ctx = getCallerContext(event);
    const routeKey = event.routeKey;
    const documentId = event.pathParameters?.documentId;

    switch (routeKey) {
      case "GET /documents": {
        const queryStudentId = event.queryStringParameters?.studentId;
        const docType = event.queryStringParameters?.docType;

        if (!ctx.isAdmin) {
          if (!ctx.studentId) return notFound("No student record linked to this account");
          const result = await ddb.send(
            new QueryCommand({
              TableName: TableNames.documents,
              KeyConditionExpression: "studentId = :sid",
              ExpressionAttributeValues: { ":sid": ctx.studentId },
            })
          );
          return ok(result.Items ?? []);
        }

        if (queryStudentId) {
          const result = await ddb.send(
            new QueryCommand({
              TableName: TableNames.documents,
              KeyConditionExpression: "studentId = :sid",
              ExpressionAttributeValues: { ":sid": queryStudentId },
            })
          );
          return ok(result.Items ?? []);
        }

        if (docType) {
          const result = await ddb.send(
            new QueryCommand({
              TableName: TableNames.documents,
              IndexName: "docType-uploadedAt-index",
              KeyConditionExpression: "docType = :dt",
              ExpressionAttributeValues: { ":dt": docType },
            })
          );
          return ok(result.Items ?? []);
        }

        // Admin browsing everything with no filter - acceptable Scan at demo scale.
        const result = await ddb.send(new ScanCommand({ TableName: TableNames.documents }));
        return ok(result.Items ?? []);
      }

      case "POST /documents/upload-url": {
        const body = JSON.parse(event.body ?? "{}");
        if (!body.fileName || !body.contentType || !body.docType) {
          return badRequest("fileName, contentType, and docType are required");
        }
        const targetStudentId = ctx.isAdmin
          ? (event.queryStringParameters?.studentId ?? body.studentId)
          : ctx.studentId;
        if (!targetStudentId) return badRequest("studentId is required (admin must specify one)");
        requireSelfOrAdmin(ctx, targetStudentId);

        const documentId = randomUUID();
        const s3Key = `documents/${targetStudentId}/${documentId}/${body.fileName}`;

        const metadata: DocumentMeta = {
          studentId: targetStudentId,
          documentId,
          s3Key,
          fileName: body.fileName,
          contentType: body.contentType,
          docType: body.docType,
          uploadedAt: new Date().toISOString(),
          uploadedBy: ctx.sub,
          courseId: body.courseId,
        };
        await ddb.send(new PutCommand({ TableName: TableNames.documents, Item: metadata }));

        const uploadUrl = await getSignedUrl(
          s3,
          new PutObjectCommand({ Bucket: DocumentsBucketName, Key: s3Key, ContentType: body.contentType }),
          { expiresIn: UPLOAD_URL_EXPIRY_SECONDS }
        );

        return created({ uploadUrl, documentId, s3Key });
      }

      case "GET /documents/{documentId}/download-url": {
        if (!documentId) return badRequest("documentId is required");
        const ownerStudentId = requireOwnerQueryParam(event);
        requireSelfOrAdmin(ctx, ownerStudentId);

        const result = await ddb.send(
          new GetCommand({ TableName: TableNames.documents, Key: { studentId: ownerStudentId, documentId } })
        );
        if (!result.Item) return notFound();
        const meta = result.Item as DocumentMeta;
        if (meta.studentId !== ownerStudentId) return forbidden();

        const downloadUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: DocumentsBucketName, Key: meta.s3Key }),
          { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS }
        );
        return ok({ downloadUrl, fileName: meta.fileName });
      }

      case "DELETE /documents/{documentId}": {
        if (!documentId) return badRequest("documentId is required");
        const ownerStudentId = requireOwnerQueryParam(event);
        requireSelfOrAdmin(ctx, ownerStudentId);

        const result = await ddb.send(
          new GetCommand({ TableName: TableNames.documents, Key: { studentId: ownerStudentId, documentId } })
        );
        if (!result.Item) return notFound();
        const meta = result.Item as DocumentMeta;

        await s3.send(new DeleteObjectCommand({ Bucket: DocumentsBucketName, Key: meta.s3Key }));
        await ddb.send(
          new DeleteCommand({ TableName: TableNames.documents, Key: { studentId: ownerStudentId, documentId } })
        );
        return ok({ documentId, deleted: true });
      }

      default:
        return badRequest(`Unsupported route: ${routeKey}`);
    }
  });
