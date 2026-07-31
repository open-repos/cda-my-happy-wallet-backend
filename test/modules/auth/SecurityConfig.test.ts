import assert from "assert";
import { validateSecuritySecrets } from "../../../src/config/securityConfig";

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
  () => validateSecuritySecrets({ ...validEnvironment, ACCESS_TOKEN: undefined }),
  /ACCESS_TOKEN must contain at least 32 characters/
);

assert.throws(
  () => validateSecuritySecrets({ ...validEnvironment, ACCESS_TOKEN: " ".repeat(32) }),
  /ACCESS_TOKEN must contain at least 32 characters/
);

const shortSecret = "secret-value-must-not-be-revealed";
assert.throws(
  () => validateSecuritySecrets({ ...validEnvironment, REFRESH_TOKEN: shortSecret.slice(0, 16) }),
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
