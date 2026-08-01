import { login } from "../../user/useCases/login";
import { refreshSessionService } from "../refreshSession";
import { renewSession } from "../renewSession";
import { NativeSessionController } from "./NativeSessionController";

export const nativeSessionController = new NativeSessionController(
  login,
  renewSession,
  refreshSessionService
);

export { NativeSessionController } from "./NativeSessionController";
