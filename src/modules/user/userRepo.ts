// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createUser.ts

type createUserProps = {
    email: string,
    password: string
}

export class UserRepo {
    private entities: any
    private emailExist: boolean

    constructor(entities: any) {
        this.entities = entities
    }

    public async create(userProps: createUserProps) {
        const UserEntity = this.entities.user

        // console.log(userProps.email)
        const exists = await this.exists(userProps.email);
        console.log('create ?',exists);

        if (!exists) {
            console.log('dans create et userProps',userProps)
            // problem certainement ici
       console.log (await UserEntity.create(
                {
                    data: {
                        email: userProps.email,
                        password: userProps.password,
                    }
                }) )
        }
        return
    }

    public async exists(email: string): Promise<boolean> {
        const UserEntity = this.entities.user;
        
        // console.log('email dans findUnique', email)
        const result = await UserEntity.findUnique({ where: { email: email } })

        console.log('exists : ', result);
        console.log('!result: ', !result);
        console.log('!!result : ', !!result);
        if (result === null){
            this.emailExist = false
        } else {
            this.emailExist = true
        }
        return this.emailExist;
    }

    public async getUserByEmail(email: string) {
        const UserEntity = this.entities.user;

        const result = await UserEntity.findUnique({ where: { email: email } })

        return result
    }
}