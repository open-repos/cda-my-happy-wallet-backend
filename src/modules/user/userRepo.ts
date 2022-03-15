// On va utiliser notre ORM pour modifier notre BDD (couche de persistence)
//script "générale" utilisable par notre service createUser.ts

type createUserProps = {
    email: string,
    password: string,
    firstname: string,
    lastname:string
}

export class UserRepo {
    private entities: any
    private emailExist: boolean

    constructor(entities: any) {
        this.entities = entities
    }

    public async create(userProps: createUserProps) {
        const UserEntity = this.entities.utilisateur

        // console.log(userProps.email)
        const exists = await this.exists(userProps.email);
        console.log('exists ?',exists);

        if (!exists) {
            console.log('dans UserRepo create fctn',userProps)
            // problem certainement ici
       console.log (await UserEntity.create(
                {
                    data: {
                        email: userProps.email,
                        password: userProps.password,
                        firstname: userProps.firstname,
                        lastname: userProps.lastname,
                    }
                }) )
        }
        return
    }

    public async exists(email: string): Promise<boolean> {
        const UserEntity = this.entities.utilisateur;
        
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
        const UserEntity = this.entities.utilisateur;

        const result = await UserEntity.findUnique({ where: { email: email } })

        return result
    }
}