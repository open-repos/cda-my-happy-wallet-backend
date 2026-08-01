import { prisma } from "../../../database";
import { UserRepo } from "../../user/userRepo";
import { refreshSessionService } from "../refreshSession";
import { RenewSession } from "./RenewSession";

const userRepository = new UserRepo(prisma);

export const renewSession = new RenewSession(
  userRepository,
  refreshSessionService
);

export { RenewSession } from "./RenewSession";
