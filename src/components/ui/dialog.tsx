import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-md sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn("w-full max-w-2xl overflow-hidden rounded-2xl border border-white/70 bg-card/95 shadow-soft")}
      >
        <div className="flex items-start justify-between gap-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-cyan-50/70 p-5 sm:p-6">
          <div>
            <h2 id="dialog-title" className="text-xl font-semibold text-foreground">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" aria-label="Close dialog" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-indigo-100 p-5 sm:p-6">{footer}</div> : null}
      </div>
    </div>
  );
}
