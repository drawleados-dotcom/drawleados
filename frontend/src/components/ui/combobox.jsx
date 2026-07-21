import * as React from "react"
import { Popover, PopoverAnchor, PopoverContent } from "./popover"
import { Input } from "./input"
import { cn } from "@/lib/utils"

/**
 * Editable, filterable text input: typing filters `options` in a popover
 * below, picking one fills the input with its label, but any typed text
 * (including no match) is a valid value — unlike Select, it never blocks
 * free text.
 */
const Combobox = React.forwardRef(({
  value,
  onChange,
  options = [],
  placeholder,
  loading = false,
  loadingText = "Loading…",
  emptyText = "No matches — you can still use this as a new name",
  className,
  ...inputProps
}, ref) => {
  const [open, setOpen] = React.useState(false)

  const query = (value || "").trim().toLowerCase()
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query))
    : options

  const selectOption = (opt) => {
    onChange(opt.label)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={ref}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
          {...inputProps}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Scroll lives on this inner div, not PopoverContent itself — Popper
            applies a CSS transform to PopoverContent for positioning, and the
            surrounding modal Dialog's scroll-lock swallows wheel events on
            transformed/portal content unless we drive scrollTop manually. */}
        <div
          className="max-h-64 overflow-y-auto"
          onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; e.preventDefault() }}
        >
          {loading ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{loadingText}</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectOption(opt)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-sm flex items-center justify-between gap-2",
                  "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span>{opt.label}</span>
                {opt.sublabel && <span className="text-xs text-muted-foreground shrink-0">{opt.sublabel}</span>}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
})
Combobox.displayName = "Combobox"

export { Combobox }
