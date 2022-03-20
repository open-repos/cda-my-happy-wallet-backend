import { UserRepo } from '../../userRepo';
// import { ErrorException } from '../../../../utils/errors/errorException.error';
// import { ErrorCode } from './../../../../utils/errors/errorCode.error';

export class ConfirmRegistrationUser {
    private userRepo: UserRepo;

    constructor(userRepo: UserRepo) {
        this.userRepo = userRepo
    }

    public async execute(id: string, token:string) {

            console.log('JUSTE AVANT LE MODIF DE SATUS ET VERIF DE TOKEN')

            const result = await this.userRepo.confirmRegistration(id, token);
            // const {register_token, ...userInfo}=newUserInfo
            console.log('JUSTE APRES LE CREATE et avant le return succes true')
            return result
    }
}