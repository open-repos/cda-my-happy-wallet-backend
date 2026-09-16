import assert from "assert";
import express from "express";
import request from "supertest";
import { FRONTEND_URL } from "../../../src/config/config";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ConfirmRegistrationUser } from "../../../src/modules/user/useCases/confirmRegistrationUser/confirmRegistrationUser";
import { ConfirmRegistrationUserController } from "../../../src/modules/user/useCases/confirmRegistrationUser/confirmRegistrationUserController";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

function createApplication(error: ErrorException) {
  const useCase = {
    execute: async () => {
      throw error;
    },
  } as unknown as ConfirmRegistrationUser;
  const controller = new ConfirmRegistrationUserController(useCase);
  const application = express();

  application.get("/verify/:id/:token", (req, res, next) =>
    Promise.resolve(controller.execute(req, res, next)).catch(next)
  );
  application.use(errorHandler);
  return application;
}

async function run() {
  const replayApplication = createApplication(
    new ErrorException(
      ErrorCode.Conflict,
      "The registration link has already been used."
    )
  );
  const browserReplay = await request(replayApplication)
    .get("/verify/42/secret-registration-token")
    .set("Accept", "text/html,application/xhtml+xml");
  assert.strictEqual(browserReplay.status, 303);
  assert.strictEqual(
    browserReplay.headers.location,
    new URL("/login?confirmation=already-used", FRONTEND_URL).toString()
  );
  assert.doesNotMatch(browserReplay.headers.location, /secret|token|42/);

  const jsonReplay = await request(replayApplication)
    .get("/verify/42/secret-registration-token")
    .set("Accept", "application/json");
  assert.strictEqual(jsonReplay.status, 409);
  assert.strictEqual(jsonReplay.body.error.type, ErrorCode.Conflict);

  const invalidApplication = createApplication(
    new ErrorException(
      ErrorCode.Unauthorized,
      "The register token is not valid."
    )
  );
  const browserInvalid = await request(invalidApplication)
    .get("/verify/42/another-secret-token")
    .set("Accept", "text/html");
  assert.strictEqual(browserInvalid.status, 303);
  assert.strictEqual(
    browserInvalid.headers.location,
    new URL("/login?confirmation=invalid-or-expired", FRONTEND_URL).toString()
  );
  assert.doesNotMatch(browserInvalid.headers.location, /secret|token|42/);

  const wildcardInvalid = await request(invalidApplication)
    .get("/verify/42/another-secret-token")
    .set("Accept", "*/*");
  assert.strictEqual(wildcardInvalid.status, 401);
  assert.strictEqual(wildcardInvalid.body.error.type, ErrorCode.Unauthorized);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
