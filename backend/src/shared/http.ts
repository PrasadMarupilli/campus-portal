import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

export const ok = (body: unknown) => json(200, body);
export const created = (body: unknown) => json(201, body);
export const noContent = () => ({ statusCode: 204, headers: CORS_HEADERS, body: "" });
export const badRequest = (message: string) => json(400, { error: message });
export const forbidden = (message = "Forbidden") => json(403, { error: message });
export const notFound = (message = "Not found") => json(404, { error: message });
export const serverError = (message = "Internal server error") => json(500, { error: message });

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function handleErrors(
  handler: () => Promise<APIGatewayProxyStructuredResultV2>
): Promise<APIGatewayProxyStructuredResultV2> {
  return handler().catch((err) => {
    if (err instanceof HttpError) {
      return json(err.statusCode, { error: err.message });
    }
    console.error(err);
    return serverError();
  });
}
