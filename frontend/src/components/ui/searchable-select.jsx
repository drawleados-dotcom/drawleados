import * as React from "react"
import { Popover, PopoverAnchor, PopoverContent } from "./popover"
import { ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Strict single-select with an in-popover search box — like Combobox, but
 * the trigger shows the selected option's label (not editable free text)
 * and onChange always fires with one of options[].value, never typed text.
 */
const SearchableSelect = React.forwardRef(({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No matches",
  className,
  disabled = false,
  ...props
}, ref) => {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const selected = options.find((o) => o.value === value)
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  const selectOption = (opt) => {
    onChange(opt.value)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery("") }}>
      <PopoverAnchor asChild>
        <button
          ref={ref}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </button>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-1">
          <Search className="h-3.5 w-3.5 opacity-50 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <div
          className="max-h-64 overflow-y-auto"
          onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; e.preventDefault() }}
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectOption(opt)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  opt.value === value && "bg-accent/50"
                )}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
})
SearchableSelect.displayName = "SearchableSelect"

export { SearchableSelect }
