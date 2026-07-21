import type { Content } from "@elizaos/core";

/**
 * Coerce a typed RHC response into the loose `Content` payload shape ElizaOS
 * action callbacks accept for `content`. Named interfaces (unlike anonymous
 * object literals) don't get an implicit string index signature, so we widen
 * here rather than repeating an assertion at every call site.
 */
export function toContent(data: unknown): Content {
  return data as Content;
}
