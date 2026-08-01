const MINIMUM_SECRET_LENGTH = 32;

type SecuritySecretEnvironment = {
  ACCESS_TOKEN?: string;
  REFRESH_TOKEN?: string;
  REGISTER_TOKEN?: string;
};

export type SecuritySecrets = {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  registerTokenSecret: string;
};

export const validateSecuritySecrets = (
  environment: SecuritySecretEnvironment
): SecuritySecrets => {
  const requireSecret = (name: string, value?: string): string => {
    if (value == null || value.trim().length < MINIMUM_SECRET_LENGTH) {
      throw new Error(
        `Invalid security configuration: ${name} must contain at least ${MINIMUM_SECRET_LENGTH} characters.`
      );
    }

    return value;
  };

  const accessTokenSecret = requireSecret(
    "ACCESS_TOKEN",
    environment.ACCESS_TOKEN
  );
  const refreshTokenSecret = requireSecret(
    "REFRESH_TOKEN",
    environment.REFRESH_TOKEN
  );
  const registerTokenSecret = requireSecret(
    "REGISTER_TOKEN",
    environment.REGISTER_TOKEN
  );

  if (
    new Set([accessTokenSecret, refreshTokenSecret, registerTokenSecret]).size !==
    3
  ) {
    throw new Error(
      "Invalid security configuration: ACCESS_TOKEN, REFRESH_TOKEN and REGISTER_TOKEN must be distinct."
    );
  }

  return {
    accessTokenSecret,
    refreshTokenSecret,
    registerTokenSecret,
  };
};
