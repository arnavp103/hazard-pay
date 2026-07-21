/**
 * The `@hazard-pay/agent/testing` subpath: the scripted mock model only —
 * what a host package's integration tests need to drive the runtime with no
 * API key (ADR 0003 consequences: CI runs the whole spine on a stub model).
 * The eval harness and vitest global setup stay internal to this package.
 */
export { scriptedModel, textTurn, toolCallTurn } from "./mock-model.ts";
