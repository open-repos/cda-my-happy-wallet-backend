import express from "express";

const REQUEST_BODY_LIMIT = "64kb";

export const urlEncodedBodyParser = express.urlencoded({
  extended: true,
  limit: REQUEST_BODY_LIMIT,
  parameterLimit: 100,
});

export const jsonBodyParser = express.json({ limit: REQUEST_BODY_LIMIT });
