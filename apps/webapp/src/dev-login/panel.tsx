import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, StatusChip, Sticker } from "@hazard-pay/ui";

import { apiClient } from "../lib/api.ts";
import { authClient, useSession } from "../lib/auth-client.ts";
import { describeLoginPhase } from "./login-phase.ts";

/** The player fetch's query key — its own tier, not the polled overworld tier. */
const PLAYER_ME_KEY = ["player", "me"];

/**
 * The dev-login surface (#50): a dev-stub identity affordance, not account
 * management. No session -> "jack in" mints one via better-auth's anonymous
 * plugin (auto-creates the 1:1 player row, packages/auth's databaseHooks).
 * With a session -> the player's handle as a sticker, with an inline rename
 * flow against `POST /player/rename`.
 */
export function DevLoginPanel() {
  const { data: session, isPending: sessionPending } = useSession();
  const queryClient = useQueryClient();
  const hasSession = session != null;

  const playerQuery = useQuery({
    queryKey: PLAYER_ME_KEY,
    queryFn: () => apiClient.playerMe(),
    enabled: hasSession,
  });

  const signInMutation = useMutation({
    mutationFn: () => authClient.signIn.anonymous(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PLAYER_ME_KEY });
    },
  });

  const [renaming, setRenaming] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [renameError, setRenameError] = useState<string | undefined>(undefined);

  const renameMutation = useMutation({
    mutationFn: (handle: string) => apiClient.renamePlayer({ handle }),
    onSuccess: (player) => {
      queryClient.setQueryData(PLAYER_ME_KEY, player);
      setRenaming(false);
      setRenameError(undefined);
    },
    onError: (error: unknown) => {
      setRenameError(error instanceof Error ? error.message : "rename failed");
    },
  });

  const phase = describeLoginPhase({
    sessionPending,
    hasSession,
    hasPlayer: playerQuery.data !== undefined,
  });

  if (phase === "checking-session" || phase === "loading-player") {
    return (
      <StatusChip tone="neutral">
        {phase === "checking-session" ? "checking session…" : "loading player…"}
      </StatusChip>
    );
  }

  if (phase === "signed-out") {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={() => signInMutation.mutate()}
        disabled={signInMutation.isPending}
      >
        {signInMutation.isPending ? "jacking in…" : "jack in"}
      </Button>
    );
  }

  // phase === "signed-in": playerQuery.data is defined by construction.
  const player = playerQuery.data;
  if (player === undefined) {
    return null;
  }

  if (renaming) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          renameMutation.mutate(handleInput);
        }}
      >
        <input
          aria-label="new handle"
          autoFocus
          className="h-8 w-40 border-2 border-accent bg-transparent px-2 font-data text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-info"
          onChange={(event) => setHandleInput(event.target.value)}
          value={handleInput}
        />
        <Button disabled={renameMutation.isPending} size="sm" type="submit" variant="primary">
          save
        </Button>
        <Button
          onClick={() => {
            setRenaming(false);
            setRenameError(undefined);
          }}
          size="sm"
          type="button"
        >
          cancel
        </Button>
        {renameError !== undefined && (
          <span className="font-data text-[10px] text-danger uppercase">{renameError}</span>
        )}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Sticker rotated={false} tone="magenta">{player.handle}</Sticker>
      <Button
        onClick={() => {
          setHandleInput(player.handle);
          setRenaming(true);
        }}
        size="sm"
      >
        rename
      </Button>
    </div>
  );
}
