import { Input, Label } from '@doscientos/ui'

import { expenseCategories } from '../application/finance'
import { expenseCategoryLabel } from '../application/finance-summary'

export function ExpenseCategoryField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Label>
      Categoría
      <Input
        aria-label="Categoría"
        list="expense-category-suggestions"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id="expense-category-suggestions">
        {expenseCategories.map((id) => {
          const label = expenseCategoryLabel(id)
          return (
            <option key={id} value={id} label={label}>
              {label}
            </option>
          )
        })}
      </datalist>
    </Label>
  )
}
