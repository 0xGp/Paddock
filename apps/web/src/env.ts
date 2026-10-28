import "server-only";
import { USDC_MAINNET_COIN_TYPE } from "@splitsense/chain";
import { z } from "zod";

const serverEnv = z.object({
  DATABASE_URL: z.url().refine((u) => u.startsWith("postgres"), "must be a Postgres connection string"),
  ADMIN_DRAIN_TOKEN: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  MEMWAL_PRIVATE_KEY: z.string().min(32),
  MEMWAL_ACCOUNT_ID: z.string().startsWith("0x"),
  MEMWAL_SERVER_URL: z.url().default("https://relayer.memory.walrus.xyz"),
  NAMESPACE_SALT: z.string().min(16),
  SESSION_SECRET: z.string().min(32),
  /** Mainnet memory writes for user-created groups stay off until approved. */
  MEMORY_USER_GROUPS: z.enum(["on", "off"]).default("off"),
  TATUM_API_KEY: z.string().min(16),
  TATUM_SUI_GRAPHQL_URL: z.url().default("https://sui-mainnet.gateway.tatum.io/graphql"),
  USDC_COIN_TYPE: z.string().default(USDC_MAINNET_COIN_TYPE),
  /** Transaction `/status` reads back: the demo flat's first gasless USDC settlement. */
  STATUS_KNOWN_DIGEST: z.string().min(32).default("FHS5aw5nn9X4DKRevpoTKs4yMGhUnHEsgT725THiuAU2"),
});

export const env = serverEnv.parse(process.env);
