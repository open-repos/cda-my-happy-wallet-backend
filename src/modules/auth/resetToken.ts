import { ErrorCode, ErrorException } from "../../utils/errors";

const RESET_TOKEN_PATTERN = /^[a-f0-9]{128}$/;

export const parseResetToken = (token: unknown): string => {
  if (typeof token !== "string" || !RESET_TOKEN_PATTERN.test(token)) {
    throw new ErrorException(ErrorCode.Unauthorized);
  }

  return token;
};
