import { Router, Request, Response, NextFunction } from "express";
import { createOperationFixeController } from "../modules/operationsFixes/useCases/createOperationFixe";
import { updateOperationFixeController } from "../modules/operationsFixes/useCases/updateOperationFixe";
import { readOperationFixeController } from "../modules/operationsFixes/useCases/readOperationFixe";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import { Validator } from "../middlewares/validator.middleware";
import { readAllOperationFixeController } from "../modules/operationsFixes/useCases/readAllOperationFixe";



export const swOperationFixeRouter = {
    "/operations-fixes": {
      "get": {
      }
    } ,
    // "/operations-fixes/revenus": {
    //   "post": {
    //   },
    //   "get": {
    // },
    // },
    // "/operations-fixes/charges": {
    //   "post": {
    //   },
    //   "get": {
    // }
    // },
    // "/operations-fixes/revenus/{id}": {
    //   "put": {
    //   },
    //   "get": {
    // },
    // "delete": {
    // }
    // },
    // "/operations-fixes/charges/{id}": {
    //     "put": {
    //     },
    //     "get": {
    //   },
    //   "delete": {
    //   }
    // },

  }

const operationFixeRouter: Router = Router();
// Read list operationsFixes
operationFixeRouter.get(
  "/",
  tokenJwtTAuth,
  (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(
    readAllOperationFixeController.execute(req, res)
  ).catch(next)
);

operationFixeRouter.get(
  "/revenus",
  tokenJwtTAuth,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      readAllOperationFixeController.execute(req, res, "REVENU")
    ).catch(next)
);
operationFixeRouter.get(
  "/charges",
  tokenJwtTAuth,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      readAllOperationFixeController.execute(req, res, "CHARGE")
    ).catch(next)
);


//Create revenus / charges
operationFixeRouter.post(
  "/revenus",
  tokenJwtTAuth,
  Validator("operationFixe"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      createOperationFixeController.execute(req, res, "REVENU")
    ).catch(next)
);
operationFixeRouter.post(
  "/charges",
  tokenJwtTAuth,
  Validator("operationFixe"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      createOperationFixeController.execute(req, res, "CHARGE")
    ).catch(next)
);

// Update revenus / charges by ID
operationFixeRouter.put(
  "/revenus/:id",
  Validator("operationFixe"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      updateOperationFixeController.execute(req, res, "REVENU")
    ).catch(next)
);
operationFixeRouter.put(
  "/charges/:id",
  Validator("operationFixe"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      updateOperationFixeController.execute(req, res, "CHARGE")
    ).catch(next)
);

// Read revenus / charges by ID
operationFixeRouter.get(
  "/revenus/:id",
  tokenJwtTAuth,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      readOperationFixeController.execute(req, res, "REVENU")
    ).catch(next)
);
operationFixeRouter.get(
  "/charges/:id",
  tokenJwtTAuth,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      readOperationFixeController.execute(req, res, "CHARGE")
    ).catch(next)
);

export { operationFixeRouter };
