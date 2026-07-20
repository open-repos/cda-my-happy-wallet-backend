import { UserRepo } from './../modules/user/userRepo';
import { ErrorCode } from './../utils/errors/errorCode.error';
import { ErrorException} from './../utils/errors/errorException.error';
import { Request, Response, NextFunction } from "express";
import { prisma } from '../database/index'

export  const isResetTokenExpired =()=> {
return async function (
    req: Request,
    _: Response,
    next: NextFunction
  ){

  const resetToken = req.params.token;
  const userRepo = new UserRepo(prisma)
  const UserEntity = prisma.utilisateur;

  const existUserResetToken =  await userRepo.existUserResetToken(resetToken)
  if (!existUserResetToken) {
   return next(new ErrorException(ErrorCode.Unauthorized))
  }

  if (!resetToken) {
    return next(new ErrorException(ErrorCode.Unauthorized))
  }

    const result = await  UserEntity.findMany({
      where: { resetToken: resetToken },
      select:{resetTokenExpiration:true}
    })

    const today = new Date();
    // const datToCompare = new Date(today.getDay(),today.getHours(),today.getMinutes(),today.getSeconds())

    // const diffDate = datToCompare - resetTokenExpiration// 36e5;
    if (result[0].resetTokenExpiration === null){
        return
    }
    const Time = result[0].resetTokenExpiration.getTime()  - today.getTime(); 
    const HoursDiff = Time / (1000 * 3600); //Diference in Days
    if (HoursDiff>0){
        return;
    }

    next(new ErrorException(ErrorCode.Unauthorized))
       
}
}


// const dateDiff =async  (date1:any, date2:any) => {
//     let diff = {"sec":0,"min":0,"hour":0,"day":0}                           // Initialisation du retour
//     let tmp = date2 - date1;
 
//     tmp = Math.floor(tmp/1000);             // Nombre de secondes entre les 2 dates
//     diff.sec = tmp % 60;                    // Extraction du nombre de secondes
 
//     tmp = Math.floor((tmp-diff.sec)/60);    // Nombre de minutes (partie entière)
//     diff.min = tmp % 60;                    // Extraction du nombre de minutes
 
//     tmp = Math.floor((tmp-diff.min)/60);    // Nombre d'heures (entières)
//     diff.hour = tmp % 24;                   // Extraction du nombre d'heures
     
//     tmp = Math.floor((tmp-diff.hour)/24);   // Nombre de jours restants
//     diff.day = tmp;
     
//     return diff;
// }
