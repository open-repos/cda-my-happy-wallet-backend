import { ErrorCode } from "./errorCode.error";

export type ErrorDefinition = {
  status: number;
  message: string;
};

const badRequest: ErrorDefinition = { status: 400, message: "Bad Request" };

export const errorCatalog: Record<string, ErrorDefinition> = {
  [ErrorCode.WrongParamsID]: {
    status: 400,
    message: "Bad Request, wrong params id",
  },
  [ErrorCode.IncompleteRequestBody]: badRequest,
  [ErrorCode.IncompleteRequestCookie]: badRequest,
  [ErrorCode.PrismaError]: badRequest,
  [ErrorCode.AsyncError]: badRequest,
  [ErrorCode.EmailNotFound]: {
    status: 401,
    message: "No account with that email.",
  },
  [ErrorCode.EmailPasswordNotValid]: {
    status: 401,
    message: "Email or password not valid",
  },
  [ErrorCode.Unauthenticated]: {
    status: 401,
    message: "User Unauthenticated",
  },
  [ErrorCode.Unauthorized]: { status: 401, message: "User Unauthorized" },
  [ErrorCode.EmailAlreadyTaken]: {
    status: 403,
    message: "Email is already taken",
  },
  [ErrorCode.AccessForbidden]: { status: 403, message: "Access Forbidden" },
  [ErrorCode.InvalidInput]: { status: 405, message: "Invalid Input" },
  [ErrorCode.TooManyRequests]: {
    status: 429,
    message: "Too many requests. Please try again later.",
  },
  [ErrorCode.SendEmaillError]: { status: 500, message: "Email was not sent" },
  [ErrorCode.NotFound]: {
    status: 404,
    message: "The requested resource was not found",
  },
  [ErrorCode.UnknownError]: { status: 500, message: "Unknown Error" },
};

export function getErrorDefinition(code: string): ErrorDefinition {
  return errorCatalog[code] || errorCatalog[ErrorCode.UnknownError];
}
