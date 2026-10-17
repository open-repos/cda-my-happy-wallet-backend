export type JwtPurpose = "access" | "refresh" | "registration";

type JwtEnvironment = {
  NODE_ENV?: string;
  JWT_ISSUER?: string;
  JWT_AUDIENCE?: string;
};

export type JwtConfiguration = {
  issuer: string;
  audiences: Record<JwtPurpose, string>;
};

export const validateJwtConfiguration = (
  environment: JwtEnvironment
): JwtConfiguration => {
  const claim = (
    name: "JWT_ISSUER" | "JWT_AUDIENCE",
    fallback: string
  ): string => {
    const value = environment[name];
    if (value == null && environment.NODE_ENV !== "production") {
      return fallback;
    }
    if (value == null || !/^[\x21-\x7e]{1,200}$/.test(value)) {
      throw new Error(
        `Invalid security configuration: ${name} must contain 1 to 200 printable ASCII characters without whitespace.`
      );
    }
    return value;
  };

  const issuer = claim("JWT_ISSUER", "urn:myhappywallet:local:issuer");
  const audience = claim("JWT_AUDIENCE", "urn:myhappywallet:local");
  return {
    issuer,
    audiences: {
      access: audience,
      refresh: `${audience}:refresh`,
      registration: `${audience}:registration`,
    },
  };
};
