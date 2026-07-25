import { createFileRoute } from "@tanstack/react-router";

import { EnvironmentRegisterPrototype } from "../match-proto/environment-register/environment-register-prototype.tsx";

/**
 * THROWAWAY PROTOTYPE (#91). Its own route rather than a takeover of
 * `/match-proto`, so the #27 hello-render keeps working and four parallel
 * bake-off lanes are not all editing the same file.
 */
export const Route = createFileRoute("/env-register")({
  component: EnvironmentRegisterPrototype,
});
