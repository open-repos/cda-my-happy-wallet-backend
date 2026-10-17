import assert from "assert";
import { validateSecuritySecrets } from "../../../src/config/securityConfig";
import { validateJwtConfiguration } from "../../../src/config/jwtConfig";

const validEnvironment = {
  ACCESS_TOKEN: "access-token-secret-at-least-32-characters",
  REFRESH_TOKEN: "refresh-token-secret-at-least-32-characters",
  REGISTER_TOKEN: "register-token-secret-at-least-32-characters",
};

assert.deepStrictEqual(validateSecuritySecrets(validEnvironment), {
  accessTokenSecret: validEnvironment.ACCESS_TOKEN,
  refreshTokenSecret: validEnvironment.REFRESH_TOKEN,
  registerTokenSecret: validEnvironment.REGISTER_TOKEN,
});

assert.throws(
  () =>
    validateSecuritySecrets({ ...validEnvironment, ACCESS_TOKEN: undefined }),
  /ACCESS_TOKEN must contain at least 32 characters/
);

assert.throws(
  () =>
    validateSecuritySecrets({
      ...validEnvironment,
      ACCESS_TOKEN: " ".repeat(32),
    }),
  /ACCESS_TOKEN must contain at least 32 characters/
);

const shortSecret = "secret-value-must-not-be-revealed";
assert.throws(
  () =>
    validateSecuritySecrets({
      ...validEnvironment,
      REFRESH_TOKEN: shortSecret.slice(0, 16),
    }),
  (error: Error) =>
    /REFRESH_TOKEN must contain at least 32 characters/.test(error.message) &&
    !error.message.includes(shortSecret.slice(0, 16))
);

assert.throws(
  () =>
    validateSecuritySecrets({
      ...validEnvironment,
      REGISTER_TOKEN: validEnvironment.ACCESS_TOKEN,
    }),
  /ACCESS_TOKEN, REFRESH_TOKEN and REGISTER_TOKEN must be distinct/
);

const jwtEnvironment = {
  NODE_ENV: "production",
  JWT_ISSUER: "urn:myhappywallet:production:issuer",
  JWT_AUDIENCE: "urn:myhappywallet:production",
};
assert.deepStrictEqual(validateJwtConfiguration(jwtEnvironment), {
  issuer: jwtEnvironment.JWT_ISSUER,
  audiences: {
    access: jwtEnvironment.JWT_AUDIENCE,
    refresh: `${jwtEnvironment.JWT_AUDIENCE}:refresh`,
    registration: `${jwtEnvironment.JWT_AUDIENCE}:registration`,
  },
});
assert.deepStrictEqual(validateJwtConfiguration({ NODE_ENV: "test" }), {
  issuer: "urn:myhappywallet:local:issuer",
  audiences: {
    access: "urn:myhappywallet:local",
    refresh: "urn:myhappywallet:local:refresh",
    registration: "urn:myhappywallet:local:registration",
  },
});
for (const name of ["JWT_ISSUER", "JWT_AUDIENCE"] as const) {
  for (const value of [
    undefined,
    "",
    "private value",
    "private\nvalue",
    "x".repeat(201),
  ]) {
    assert.throws(
      () => validateJwtConfiguration({ ...jwtEnvironment, [name]: value }),
      (error: Error) =>
        error.message.includes(name) && !error.message.includes("private")
    );
  }
  assert.throws(() =>
    validateJwtConfiguration({ NODE_ENV: "test", [name]: "" })
  );
}
