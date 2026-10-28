import "server-only";
import { createTatum, tatumSuiClient, type Tatum } from "@splitsense/chain";
import { env } from "@/env";

let client: Tatum | null = null;
let sdk: ReturnType<typeof tatumSuiClient> | null = null;

/** One client per server process, so every Tatum call shares the same rate limiter. */
export const tatum = () => (client ??= createTatum({ url: env.TATUM_SUI_GRAPHQL_URL, apiKey: env.TATUM_API_KEY }));

/** The Sui SDK over Tatum, on the same rate limiter. */
export const suiClient = () => (sdk ??= tatumSuiClient({ url: env.TATUM_SUI_GRAPHQL_URL, apiKey: env.TATUM_API_KEY, fetch: tatum().fetch }));
