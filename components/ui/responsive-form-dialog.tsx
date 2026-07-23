"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFocusWithin } from "@/hooks/use-focus-within";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Renders as a centered Dialog on desktop and a bottom Sheet on mobile.
// The Sheet starts compact (sized to its content) and expands to fill the
// full viewport the moment a text field inside it gains focus, tracking
// the on-screen keyboard via dvh — see hooks/use-focus-within.ts.
export function ResponsiveFormDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const { ref, focusWithin: keyboardOpen, onFocus, onBlur, reset } =
    useFocusWithin<HTMLDivElement>();

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        ref={ref}
        onFocus={onFocus}
        onBlur={onBlur}
        onOpenAutoFocus={(event) => event.preventDefault()}
        side="bottom"
        style={keyboardOpen ? { height: "100dvh" } : undefined}
        className={cn(
          "flex flex-col gap-0 rounded-t-2xl transition-[height]",
          !keyboardOpen && "max-h-[90dvh]",
        )}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          {children}
        </div>
        <SheetFooter>{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
