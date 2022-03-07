import { UserRepo } from '../../userRepo'
import argon2 from 'argon2'
import { sign } from 'jsonwebtoken'
import { JWT_PASSPHRASE } from '../../../../config'

type loginUserProps = {
    email: string,
    password: string
}

//Equivalent to a specific service in a CRUD API
export class Login {
    private userRepo: UserRepo

    constructor(userRepo: UserRepo) {
        this.userRepo = userRepo
    }

    //This is what our use case will do
    public async execute(props: loginUserProps) {
        try {
            const { email, password } = props;
            console.log('email : ', email);
            console.log('password : ', password);

            const user = await this.userRepo.getUserByEmail(email);

            if (!user) {
                return {
                    success: false,
                    message: "Email or password missmatch"
                }
            }

            console.log('password user in database', user.password);
            console.log('password in body', password);

            const passwordMatches = await argon2.verify(user.password, password)
            console.log('passwordMatches', passwordMatches);

            if (!passwordMatches) {
                return {
                    success: false,
                    message: "Email or password missmatch"
                }
            }

            //Création de notre JWT token
            const jwtToken = sign({ id: user.id }, JWT_PASSPHRASE)
            console.log('TOKEN', jwtToken);

            return {
                success: true,
                payload: {
                    user,
                    token: jwtToken
                }
            }

        } catch (e) {
            console.log('error :', e)
            return {
                success: false,
                message: e
            }
        }
    }
}