import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL?.trim();
const redisClient = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 3_000),
      },
    })
  : undefined;

redisClient?.on("error", () => {
  console.error("Rate limit store connection error.");
});

let connectionPromise: Promise<void> | undefined;

const ensureConnected = async (): Promise<void> => {
  if (!redisClient || redisClient.isOpen) {
    return;
  }

  connectionPromise ??= redisClient
    .connect()
    .then(() => {
      redisClient.unref();
    })
    .finally(() => {
      connectionPromise = undefined;
    });
  await connectionPromise;
};

export const createRedisRateLimitStore = (prefix: string) =>
  redisClient
    ? new RedisStore({
        prefix: `mhw:auth-rate-limit:${
          process.env.NODE_ENV === "test" ? `${process.pid}:` : ""
        }${prefix}:`,
        sendCommand: async (...args: string[]) => {
          await ensureConnected();
          return redisClient.sendCommand(args);
        },
      })
    : undefined;

export const connectRateLimitStore = async (): Promise<void> => {
  if (!redisClient) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("REDIS_URL is required in production.");
    }
    return;
  }

  await ensureConnected();
};

export const checkRateLimitStore = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.ping();
  }
};

export const disconnectRateLimitStore = async (): Promise<void> => {
  if (redisClient?.isOpen) {
    await redisClient.close();
  }
};
