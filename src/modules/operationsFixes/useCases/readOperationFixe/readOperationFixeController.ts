// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/OperationFixes/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/OperationFixes/
// Pour DELETE http://localhost:3001/api/v1/OperationFixes/:id
// Pour UPDATE http://localhost:3001/api/v1/OperationFixes/:id
// Pour READ http://localhost:3001/api/v1/OperationFixes/:id

import {ReadOperationFixe } from './readOperationFixe'
import { Request, Response } from 'express'

//Controller
export class ReadOperationFixeController {
    private useCase: ReadOperationFixe;
    private fctnCall:string="read";

    constructor(readOperationFixe: ReadOperationFixe) {
        this.useCase =readOperationFixe;
    }

    public async execute(req: Request, res: Response,typeOperation:string) {

        try {
            console.log("Dans la fonction execute du operationController")
            const result = await this.useCase.execute(req.body,req.cookies.id_user,req.params.id,typeOperation);
            console.log('result.success final', result.success);
            if (!result.success) {
                return res.status(400).json({ message: result })
            }
            return res.status(201).json(result);
        }
        catch (err) {
            console.log(`${this.fctnCall} controllers errors :`, err);
            return res.status(400).json({ message: err })
        }

    }
}