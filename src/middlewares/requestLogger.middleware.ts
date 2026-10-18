import { Request, RequestHandler, Response } from "express";
import morgan from "morgan";

const loggedMethods = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "CONNECT",
  "TRACE",
]);

const numericToken = (value: string | undefined): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const createDevelopmentRequestLogger = (
  stream?: morgan.StreamOptions
): RequestHandler =>
  morgan<Request, Response>(
    (tokens, req, res) =>
      JSON.stringify({
        event: "http_request",
        method: loggedMethods.has(req.method) ? req.method : "OTHER",
        // The registered local route pattern is trusted code. Never fall back
        // to originalUrl, path, baseUrl or params: they can contain secrets.
        route:
          typeof req.route?.path === "string" ? req.route.path : "unmatched",
        status: numericToken(tokens.status(req, res)),
        responseTimeMs: numericToken(tokens["response-time"](req, res)),
      }),
    { stream }
  );
