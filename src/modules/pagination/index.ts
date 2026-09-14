import { ACCESS_TOKEN_SECRET } from "../../config/config";
import { PaginationCursorCodec } from "./Pagination";

export const paginationCursorCodec = new PaginationCursorCodec(
  ACCESS_TOKEN_SECRET
);

export * from "./Pagination";
