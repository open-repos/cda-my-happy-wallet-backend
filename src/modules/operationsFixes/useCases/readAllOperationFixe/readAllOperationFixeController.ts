// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/operation-fixes/
// Pour READ http://localhost:3001/api/v1/operation-fixes

import {ReadAllOperationFixe } from './readAllOperationFixe'
import { Request, Response } from 'express'
import { TypeOperationFixeEnum } from '@prisma/client';

//Controller
export class ReadAllOperationFixeController {
    private useCase: ReadAllOperationFixe;
    // private fctnCall:string="read";

    constructor(readOperationFixe: ReadAllOperationFixe) {
        this.useCase =readOperationFixe;
    }

    public async execute(req: Request, res: Response, typeOperation?:TypeOperationFixeEnum) {


            console.log("Dans la fonction execute du operationController")
            const result = await this.useCase.execute(req.cookies.id_user,typeOperation);
            console.log('result.success final', result.success);

            return res.status(200).json(result);


    }
}