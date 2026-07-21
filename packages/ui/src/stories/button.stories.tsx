import type { Story } from "@ladle/react";

import { Button } from "../components/button.tsx";

export default {
  title: "Components / Button",
};

export const Variants: Story = () => (
  <div className="flex max-w-xl flex-col gap-8 p-8">
    <div className="flex items-center gap-5">
      <Button variant="primary">Queue move</Button>
      <Button>View lane</Button>
      <Button variant="danger">Abort mission</Button>
    </div>
    <div className="flex items-center gap-5">
      <Button variant="primary" size="sm">Deploy leader</Button>
      <Button size="sm">Inspect wake</Button>
      <Button variant="danger" size="sm">Burn asset</Button>
    </div>
    <div className="flex items-center gap-5">
      <Button variant="primary" disabled>Queue move</Button>
      <Button disabled>View lane</Button>
      <Button variant="danger" disabled>Abort mission</Button>
    </div>
  </div>
);
