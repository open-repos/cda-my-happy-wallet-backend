import { createUserProps } from "../../src/utils/validators/register.validator";

export const userFixtures = {
  id: 42,
  idAsString: "42",
  email: "user@example.com",
  createInput: {
    email: "user@example.com",
    password: "MypassworD!0",
    firstname: "Test",
    lastname: "User",
    confirmpassword: "MypassworD!0",
  } as createUserProps,
  newPassword: "NewPassword!1",
  resetToken: "a".repeat(128),
};
