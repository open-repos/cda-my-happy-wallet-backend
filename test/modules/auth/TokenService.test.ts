import assert from "assert";
import { JsonWebTokenService } from "../../../src/modules/auth/token/JsonWebTokenService";
import { FakeTokenService } from "../../fakes/FakeTokenService";
import jwt from "jsonwebtoken";

const tokenService = new JsonWebTokenService();
const secret = "unit-test-secret-not-real";
const token = tokenService.sign({ id: 42 }, secret, { expiresIn: "1h" });
const decodedToken = tokenService.verify(token, secret) as { id: number };

assert.strictEqual(decodedToken.id, 42);
assert.strictEqual(jwt.decode(token, { complete: true })?.header.alg, "HS256");

const unsupportedAlgorithmToken = jwt.sign({ id: 42 }, secret, {
  algorithm: "HS512",
});
assert.throws(
  () => tokenService.verify(unsupportedAlgorithmToken, secret),
  /invalid algorithm/
);

const fakeTokenService = new FakeTokenService({ email: "user@example.com" });
const fakeToken = fakeTokenService.sign(
  { email: "user@example.com" },
  "fake-register-secret",
  { expiresIn: "5min" }
);

assert.strictEqual(fakeToken, "fake.jwt.token");
assert.deepStrictEqual(fakeTokenService.signedTokens[0], {
  payload: { email: "user@example.com" },
  secret: "fake-register-secret",
  options: { expiresIn: "5min" },
});

const verifiedToken = fakeTokenService.verify("fake.jwt.token", "fake-secret");

assert.deepStrictEqual(verifiedToken, { email: "user@example.com" });
assert.deepStrictEqual(fakeTokenService.verifiedTokens[0], {
  token: "fake.jwt.token",
  secret: "fake-secret",
});

fakeTokenService.verify("fake.jwt.token", "fake-secret", (err, decoded) => {
  assert.strictEqual(err, null);
  assert.deepStrictEqual(decoded, { email: "user@example.com" });
});

const failingTokenService = new FakeTokenService({}, new Error("invalid token"));

assert.throws(
  () => failingTokenService.verify("expired.jwt.token", "fake-secret"),
  /invalid token/
);
