import { EnvelopeReportingController } from "../modules/reconciliation/presentation/EnvelopeReportingController";
import { PrismaEnvelopeReporting } from "../modules/reconciliation/infrastructure/PrismaEnvelopeReporting";
import { RequestHandler, Router } from "express";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import { ReconciliationController } from "../modules/reconciliation/presentation/ReconciliationController";
import { reconciliationHttpError } from "../modules/reconciliation/presentation/reconciliationError";
import { PrismaReconciliationRepository } from "../modules/reconciliation/infrastructure/PrismaReconciliationRepository";
import { prisma } from "../database";

export function createReconciliationRouter(
  controller: ReconciliationController,
  authenticate: RequestHandler = tokenJwtTAuth,
  reports = new EnvelopeReportingController(new PrismaEnvelopeReporting(prisma))
) {
  const router = Router();
  const reporting =
    (method: "overview" | "analytics" | "fixedMonth"): RequestHandler =>
    (req, res, next) => {
      Promise.resolve(reports[method](req, res)).catch((error) =>
        next(reconciliationHttpError(error))
      );
    };
  router.get("/envelope-overview", authenticate, reporting("overview"));
  router.get("/envelope-analytics", authenticate, reporting("analytics"));
  router.get(
    "/operations-fixes/months/:month",
    authenticate,
    reporting("fixedMonth")
  );
  const action =
    (method: keyof ReconciliationController): RequestHandler =>
    (req, res, next) => {
      Promise.resolve(controller[method](req, res)).catch((error) =>
        next(reconciliationHttpError(error))
      );
    };
  router.get("/budget-envelopes", authenticate, action("listEnvelopes"));
  router.post("/budget-envelopes", authenticate, action("saveEnvelope"));
  router.get("/budget-envelopes/:id", authenticate, action("getEnvelope"));
  router.put("/budget-envelopes/:id", authenticate, action("saveEnvelope"));
  router.delete(
    "/budget-envelopes/:id",
    authenticate,
    action("archiveEnvelope")
  );
  router.get(
    "/reconciliation/fixed-eligibility",
    authenticate,
    action("eligibility")
  );
  router.get(
    "/reconciliation/months/:month/occurrences",
    authenticate,
    action("listOccurrences")
  );
  router.get(
    "/reconciliation/months/:month/summary",
    authenticate,
    action("summary")
  );
  router.get(
    "/reconciliation/occurrences/:id",
    authenticate,
    action("getOccurrence")
  );
  router.patch(
    "/reconciliation/occurrences/:id",
    authenticate,
    action("updateOccurrence")
  );
  router.get(
    "/reconciliation/occurrences/:id/operations",
    authenticate,
    action("listOperations")
  );
  router.get("/operations/:id/reconciliation", authenticate, action("getLink"));
  router.put("/operations/:id/reconciliation", authenticate, action("link"));
  router.get(
    "/operations/:id/reconciliation-suggestions",
    authenticate,
    action("suggestions")
  );
  return router;
}
export const reconciliationRouter = createReconciliationRouter(
  new ReconciliationController(new PrismaReconciliationRepository(prisma))
);
