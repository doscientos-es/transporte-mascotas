import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
} from '@doscientos/ui'
import { Search } from 'lucide-react'

export type FilterOption = { id: string; label: string }

export function SearchFilter({
  ariaLabel,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  ariaLabel: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <InputGroup className="w-full max-w-64 bg-white">
      <InputGroupAddon>
        <Search size={16} aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </InputGroup>
  )
}

type SelectFieldProps = {
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  options: (FilterOption & { disabled?: boolean })[]
  disabled?: boolean
  className?: string
}

/** Select sin etiqueta visible, para usar dentro de formularios o con su propio `<label>`. */
export function SelectField({
  ariaLabel,
  value,
  onChange,
  options,
  disabled,
  className = 'min-h-10 bg-white',
}: SelectFieldProps) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value}
      isDisabled={disabled}
      onSelectionChange={(key) => onChange(String(key ?? ''))}
      disabledKeys={options.filter((option) => option.disabled).map((option) => option.id)}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectList items={options}>
          {(option) => (
            <SelectItem id={option.id} textValue={option.label}>
              {option.label}
            </SelectItem>
          )}
        </SelectList>
      </SelectContent>
    </Select>
  )
}

export function FilterSelect({
  label,
  ...props
}: Omit<SelectFieldProps, 'className'> & { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-[#555]">
      <span aria-hidden="true">{label}</span>
      <SelectField {...props} className="min-h-9 min-w-40 bg-white" />
    </div>
  )
}
