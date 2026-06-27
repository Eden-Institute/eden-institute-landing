// Global preview wrapper for design-sync cards (cfg.provider).
// Many Eden components render react-router <Link> and shadcn Tooltips, which
// throw without their context. Wrapping every preview in MemoryRouter +
// TooltipProvider lets those render in isolation.
import * as React from "react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

export function EdenPreviewProvider({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
    </MemoryRouter>
  );
}

export default EdenPreviewProvider;
