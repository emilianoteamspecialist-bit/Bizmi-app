import { cn } from "@/lib/utils"

export type FilterOption = { value: string; label: string }

/** A single-choice filter group (radio buttons) for marketplace sidebars. */
export function FilterGroup({
  legend,
  name,
  options,
  value,
  onChange,
  className,
}: {
  legend: string
  name: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <fieldset className={cn("border-b border-border pb-4 last:border-b-0 last:pb-0", className)}>
      <legend className="mb-2 text-sm font-semibold text-foreground">{legend}</legend>
      <div className="space-y-0.5">
        {options.map((opt) => {
          const id = `${name}-${opt.value || "any"}`
          const checked = value === opt.value
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-2",
                checked ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              {opt.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
