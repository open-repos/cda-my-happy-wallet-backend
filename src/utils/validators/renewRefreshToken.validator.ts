import Joi from "joi"


export type renewRefreshTokenProps = {
    grant_type: string
    email: string,
}

export const renewRefreshTokenSchema = Joi.object<renewRefreshTokenProps>({
    grant_type:Joi.string().valid("refresh_token").required(),
    email: Joi.string().email().lowercase().required(),
});