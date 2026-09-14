import cors from "cors";
import { CORS_ORIGINS, FRONTEND_URL } from "../config/config";
import { ErrorCode, ErrorException } from "../utils/errors";

const allowedOrigins =
  CORS_ORIGINS.length > 0 ? CORS_ORIGINS : [FRONTEND_URL];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (origin == null || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new ErrorException(ErrorCode.CorsOriginDenied));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  maxAge: 600,
  optionsSuccessStatus: 204,
});
