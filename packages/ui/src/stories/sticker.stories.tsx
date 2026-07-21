import type { Story } from "@ladle/react";

import { StatusChip, Sticker } from "../components/sticker.tsx";

export default {
  title: "Components / Sticker",
};

export const Stickers: Story = () => (
  <div className="flex max-w-xl flex-col gap-8 p-8">
    <div className="flex items-center gap-5">
      <Sticker>Overworld</Sticker>
      <Sticker tone="magenta">Decision phase</Sticker>
      <Sticker tone="warn">Held</Sticker>
      <Sticker tone="neutral">Archive</Sticker>
    </div>
    <div className="flex items-center gap-5">
      <Sticker rotated={false}>Flat sticker</Sticker>
      <Sticker tone="magenta" rotated={false}>No rotation</Sticker>
    </div>
  </div>
);

export const StatusChips: Story = () => (
  <div className="flex max-w-xl flex-col gap-8 p-8">
    <div className="flex items-center gap-4">
      <StatusChip tone="acid">Live</StatusChip>
      <StatusChip tone="warn">Held</StatusChip>
      <StatusChip tone="neutral">Done</StatusChip>
      <StatusChip tone="magenta">Phase 07</StatusChip>
      <StatusChip tone="danger">Burned</StatusChip>
      <StatusChip tone="info">Link ok</StatusChip>
    </div>
    <div className="flex items-center gap-4">
      <StatusChip tone="acid" stamped>Stamped in</StatusChip>
      <span className="font-data text-[10px] text-ink-dim uppercase">
        reload the story to replay the stamp
      </span>
    </div>
  </div>
);
