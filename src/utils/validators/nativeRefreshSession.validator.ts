import Joi from "joi";
import j2s from "joi-to-swagger";

export type NativeRefreshSessionProps = {
  refreshToken: string;
};

export const nativeRefreshSessionSchema = Joi.object<NativeRefreshSessionProps>({
  refreshToken: Joi.string().trim().min(1).max(4096).required(),
});

export const nativeRefreshSessionSchemaSwg = j2s(
  nativeRefreshSessionSchema
).swagger;
