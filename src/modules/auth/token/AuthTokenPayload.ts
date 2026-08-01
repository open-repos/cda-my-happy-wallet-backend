export interface AuthTokenPayload {
  id: number;
}

export const getAuthTokenPayload = (
  decodedToken: string | object
): AuthTokenPayload | null => {
  if (
    typeof decodedToken !== "object" ||
    decodedToken === null ||
    !("id" in decodedToken) ||
    typeof decodedToken.id !== "number" ||
    !Number.isSafeInteger(decodedToken.id) ||
    decodedToken.id <= 0
  ) {
    return null;
  }

  return { id: decodedToken.id };
};
