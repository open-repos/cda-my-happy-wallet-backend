import { getAuthTokenPayload } from "../token/AuthTokenPayload";

export interface RefreshTokenPayload {
  id: number;
  sessionId: string;
  jti: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getRefreshTokenPayload = (
  decodedToken: string | object
): RefreshTokenPayload | null => {
  const user = getAuthTokenPayload(decodedToken);
  if (
    user == null ||
    typeof decodedToken !== "object" ||
    !("sessionId" in decodedToken) ||
    typeof decodedToken.sessionId !== "string" ||
    !UUID_PATTERN.test(decodedToken.sessionId) ||
    !("jti" in decodedToken) ||
    typeof decodedToken.jti !== "string" ||
    !UUID_PATTERN.test(decodedToken.jti)
  ) {
    return null;
  }

  return {
    id: user.id,
    sessionId: decodedToken.sessionId,
    jti: decodedToken.jti,
  };
};
