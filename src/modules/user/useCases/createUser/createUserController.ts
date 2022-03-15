// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/users/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/users/
// Pour DELETE http://localhost:3001/api/v1/users/:id
// Pour UPDATE http://localhost:3001/api/v1/users/:id

import { CreateUser } from './createUser'
import { Request, Response } from 'express'
// import { validate } from 'class-validator'

//DTO
// import { RequestCreateUserDto } from './createUserDto'

//Controller
export class CreateUserController {
    private useCase: CreateUser;

    constructor(createUser: CreateUser) {
        this.useCase = createUser;
    }

    public async execute(req: Request, res: Response) {

        // body {
        //     email:"qsdqsd@qsdqs.com"
        //     password:"*******"
        // }

        // const requestUserDto = new RequestCreateUserDto(req.body);
        // const errors = await validate(requestUserDto);


        // console.log('Request DTO create user errors : ', errors);

        // const dtoErrors = await requestUserDto.isValid(requestUserDto)

        // if (!!dtoErrors) {
        //     return res.status(400).json(dtoErrors);
        // }

        try {
            console.log("Dans la fonction execute du CreateUserController", req.body)
            const result = await this.useCase.execute(req.body);
            console.log('result.success final', result.success);
            if (!result.success) {
                return res.status(400).json({ message: result })
            }

            return res.status(201).json();
        }
        catch (err) {
            console.log('create controllers errors :', err);
            return res.status(400).json({ message: err })
        }

    }
}