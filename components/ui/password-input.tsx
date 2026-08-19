"use client"

import * as React from "react"
import { Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function PasswordInput({
  className,
  showLabel = "Show password",
  hideLabel = "Hide password",
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & {
  // No i18n context inside a generic ui/ primitive — callers in the app
  // pass their own translated labels via these props.
  showLabel?: string
  hideLabel?: string
}) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pe-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export { PasswordInput }
