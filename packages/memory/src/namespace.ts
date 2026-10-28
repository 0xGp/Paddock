import { sha256Hex } from "@splitsense/engine";

export const APP_NAMESPACE = "ss_app";

/** On-chain blob metadata is public, so namespaces never contain names (ADR-0003). */
export function groupNamespace(groupId: string, salt: string): string {
  if (salt.length < 16) throw new Error("NAMESPACE_SALT must be at least 16 characters");
  return `ss_g_${sha256Hex(`${groupId}:${salt}`).slice(0, 16)}`;
}

export const isSplitSenseNamespace = (ns: string) => ns === APP_NAMESPACE || /^ss_g_[0-9a-f]{16}$/.test(ns);
