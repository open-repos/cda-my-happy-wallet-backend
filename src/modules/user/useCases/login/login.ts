import { UserRepo } from '../../userRepo'
import argon2 from 'argon2'
import { sign } from 'jsonwebtoken'
import { ACCESS_TOKEN_SECRET ,REFRESH_TOKEN_SECRET } from '../../../../config/config'

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

            const passwordMatches = await argon2.verify(user.password,password)
            console.log('passwordMatches', passwordMatches);

            if (!passwordMatches) {
                return {
                    success: false,
                    message: "Email or password missmatch"
                }
            }

            //Création de notre JWT token
            const jwtToken = sign({ id: user.id }, ACCESS_TOKEN_SECRET as string, {expiresIn:"60s"})
            console.log('TOKEN', jwtToken);

            //Création de notre JWT token
            const refreshToken = sign({ id: user.id }, REFRESH_TOKEN_SECRET as string, {expiresIn:"1d"})
            console.log('REFRESH TOKEN', refreshToken);
            return {
                success: true,
                payload: {
                    user,
                    accesToken: jwtToken,
                    refreshToken:refreshToken,
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