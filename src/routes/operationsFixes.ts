import { swUpdateRevenuById, swUpdateChargeById } from './../modules/operationsFixes/useCases/updateOperationFixe/updateOperationFixeController';
import { swGetRevenuById, swGetChargeById } from './../modules/operationsFixes/useCases/readOperationFixe/readOperationFixeController';
import { swCreateCharge, swCreateRevenu } from './../modules/operationsFixes/useCases/createOperationFixe/createOperationFixeController';
import { swGetAllOperationFixe, swGetAllCharge, swGetAllRevenu } from './../modules/operationsFixes/useCases/readAllOperationFixe/readAllOperationFixeController';
import { Router, Request, Response, NextFunction } from "express";
import { createOperationFixeController } from "../modules/operationsFixes/useCases/createOperationFixe";
import { updateOperationFixeController } from "../modules/operationsFixes/useCases/updateOperationFixe";
import { readOperationFixeController } from "../modules/operationsFixes/useCases/readOperationFixe";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import { Validator } from "../middlewares/validator.middleware";
import { readAllOperationFixeController } from "../modules/operationsFixes/useCases/readAllOperationFixe";
import { swDeleteChargeById, swDeleteRevenuById } from '../modules/operationsFixes/useCases/deleteOperationFixe/deleteOperationFixeController';
import { deleteOperationFixeController } from '../modules/operationsFixes/useCases/deleteOperationFixe';



export const swOperationFixeRouter = {
    "/operations-fixes": {
      "get": {
        ...swGetAllOperationFixe,
      }
    } ,
    "/operations-fixes/revenus": {
      "post": {
        ...swCreateRevenu
      },
      "get": {
        ...swGetAllRevenu,
    },
    },
    "/operations-fixes/charges": {
      "post": {
        ...swCreateCharge
      },
      "get": {
        ...swGetAllCharge
    }
    },
    "/operations-fixes/revenus/{id}": {
      "put": {
        ...swUpdateRevenuById,
      },
      "get": {
        ...swGetRevenuById,

    },
    "delete": {
      ...swDeleteRevenuById,
    }
    },
    "/operations-fixes/charges/{id}": {
        "put": {
          ...swUpdateChargeById,
        },
        "get": {
          ...swGetChargeById
      },
      "delete": {
        ...swDeleteChargeById
      }
    },

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

// Delete revenus / charges by ID
operationFixeRouter.delete(
  "/revenus/:id",
  tokenJwtTAuth,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      deleteOperationFixeController.execute(req, res, "REVENU")
    ).catch(next)
);
operationFixeRouter.delete(
  "/charges/:id",
  tokenJwtTAuth,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      deleteOperationFixeController.execute(req, res, "CHARGE")
    ).catch(next)
);

export { operationFixeRouter };
