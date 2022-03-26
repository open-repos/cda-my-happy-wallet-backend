import j2s from 'joi-to-swagger';
import Joi from "joi"


export type renewRefreshTokenProps = {
    grant_type: string
    email: string,
}

export const renewRefreshTokenSchema = Joi.object<renewRefreshTokenProps>({
    grant_type:Joi.string().valid("refresh_token").required(),
    email: Joi.string().email().lowercase().trim(true).required().example("capitaine@hadock.fr"),
});

export const renewAccessTokenSchemaSwg = j2s(renewRefreshTokenSchema).swagger