import {Router, Request, Response} from 'express';

const notFoundRouter: Router = Router();


notFoundRouter.use((_:Request, res:Response) => {
    res.status(404).send('<h1>Page not found</h1>')
})


export  {notFoundRouter}