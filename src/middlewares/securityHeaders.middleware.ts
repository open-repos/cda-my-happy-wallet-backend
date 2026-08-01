import { NextFunction, Request, Response } from "express";
import helmet from "helmet";

const apiSecurityHeaders = helmet();
const swaggerSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
    },
  },
});

export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const middleware = req.path.startsWith("/api-docs")
    ? swaggerSecurityHeaders
    : apiSecurityHeaders;

  return middleware(req, res, next);
};
