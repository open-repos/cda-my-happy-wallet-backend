import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { ErrorCode, ErrorException } from "../../utils/errors";

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

export type PaginationRequest = Readonly<{
  limit: number;
  cursor: string | null;
}>;

export type PaginationMeta = Readonly<{
  limit: number;
  hasNext: boolean;
  nextCursor: string | null;
}>;

export type CursorPage<T> = Readonly<{
  data: readonly T[];
  meta: PaginationMeta;
}>;

export type CursorContext = Readonly<{
  resource: string;
  scope: string;
}>;

export type CursorValue = string | number;

type CursorPayload = Readonly<{
  resource: string;
  scope: string;
  position: readonly CursorValue[];
}>;

const CURSOR_VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MAX_CURSOR_LENGTH = 2048;

export const invalidPagination = (): ErrorException =>
  new ErrorException(
    ErrorCode.ValidationFailed,
    "Pagination parameters are invalid"
  );

export class PaginationCursorCodec {
  private readonly key: Buffer;

  public constructor(secret: string) {
    this.key = createHash("sha256")
      .update("my-happy-wallet:pagination:v1\0", "utf8")
      .update(secret, "utf8")
      .digest();
  }

  public encode(
    context: CursorContext,
    position: readonly CursorValue[]
  ): string {
    if (!this.isPosition(position)) throw invalidPagination();

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(CURSOR_VERSION, "utf8"));
    const plaintext = Buffer.from(
      JSON.stringify({
        resource: context.resource,
        scope: context.scope,
        position,
      } satisfies CursorPayload),
      "utf8"
    );
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    return `${CURSOR_VERSION}.${payload.toString("base64url")}`;
  }

  public decode(context: CursorContext, cursor: string): readonly CursorValue[] {
    try {
      const [version, encoded, extra] = cursor.split(".");
      if (version !== CURSOR_VERSION || !encoded || extra) {
        throw invalidPagination();
      }

      const payload = Buffer.from(encoded, "base64url");
      if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
        throw invalidPagination();
      }
      const iv = payload.subarray(0, IV_LENGTH);
      const tag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAAD(Buffer.from(CURSOR_VERSION, "utf8"));
      decipher.setAuthTag(tag);
      const decoded = JSON.parse(
        Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
          "utf8"
        )
      ) as Partial<CursorPayload>;

      if (
        decoded.resource !== context.resource ||
        decoded.scope !== context.scope ||
        !this.isPosition(decoded.position)
      ) {
        throw invalidPagination();
      }
      return decoded.position;
    } catch {
      throw invalidPagination();
    }
  }

  private isPosition(value: unknown): value is readonly CursorValue[] {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 3 &&
      value.every(
        (item) =>
          (typeof item === "string" && item.length <= 256) ||
          (typeof item === "number" && Number.isSafeInteger(item))
      )
    );
  }
}

export const parsePaginationRequest = (
  query: Readonly<Record<string, unknown>>
): PaginationRequest => {
  if (Object.keys(query).some((key) => key !== "limit" && key !== "cursor")) {
    throw invalidPagination();
  }

  const rawLimit = query.limit;
  const limit = rawLimit === undefined ? DEFAULT_PAGE_LIMIT : Number(rawLimit);
  if (
    (rawLimit !== undefined &&
      (typeof rawLimit !== "string" || !/^[1-9]\d{0,2}$/.test(rawLimit))) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_LIMIT
  ) {
    throw invalidPagination();
  }

  const rawCursor = query.cursor;
  if (
    rawCursor !== undefined &&
    (typeof rawCursor !== "string" ||
      rawCursor.length === 0 ||
      rawCursor.length > MAX_CURSOR_LENGTH)
  ) {
    throw invalidPagination();
  }

  return { limit, cursor: rawCursor ?? null };
};

export const decodePositiveIntegerCursor = (
  request: PaginationRequest,
  context: CursorContext,
  codec: PaginationCursorCodec
): number | null => {
  if (request.cursor == null) return null;
  const position = codec.decode(context, request.cursor);
  if (
    position.length !== 1 ||
    typeof position[0] !== "number" ||
    !Number.isSafeInteger(position[0]) ||
    position[0] <= 0
  ) {
    throw invalidPagination();
  }
  return position[0];
};

export const createCursorPage = <T>(
  rows: readonly T[],
  request: PaginationRequest,
  context: CursorContext,
  positionOf: (row: T) => readonly CursorValue[],
  codec: PaginationCursorCodec
): CursorPage<T> => {
  const hasNext = rows.length > request.limit;
  const data = rows.slice(0, request.limit);
  const last = data[data.length - 1];
  return {
    data,
    meta: {
      limit: request.limit,
      hasNext,
      nextCursor:
        hasNext && last !== undefined
          ? codec.encode(context, positionOf(last))
          : null,
    },
  };
};
