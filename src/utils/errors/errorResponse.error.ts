import { ErrorException } from "./errorException.error";

export type ApiErrorResponse = {
  response: "error";
  error: {
    type: string;
    path: string;
    statusCode: number;
    message: string;
    details?: unknown;
  };
};

export function createErrorResponse(
  error: ErrorException,
  path: string
): ApiErrorResponse {
  const response: ApiErrorResponse = {
    response: "error",
    error: {
      type: error.name,
      path,
      statusCode: error.status,
      message: error.message,
    },
  };

  if (error.metaData !== null && error.metaData !== undefined) {
    response.error.details = error.metaData;
  }

  return response;
}
