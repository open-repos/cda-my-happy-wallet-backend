import { NextFunction, Request, Response } from "express";

/**
 * Interdit tout stockage HTTP des réponses de l'API : données financières,
 * sessions et leurs erreurs (#98). Monté avant les analyseurs de corps, il
 * couvre aussi les refus produits avant le routeur (corps invalide, CORS,
 * limitation de débit).
 *
 * Les en-têtes conditionnels sont retirés : Express ne répond donc jamais
 * `304` à une requête privée, même avec `If-None-Match: *`.
 */
export const privateApiCache = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.set("Cache-Control", "private, no-store");
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  next();
};
