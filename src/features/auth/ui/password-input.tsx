import { Button, Input } from '@doscientos/ui'
import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Input>, 'type'>

/** Password field with a button to reveal or hide what has been typed. */
export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        className={
          typeof className === 'function'
            ? (values) => `min-h-11 pr-12 ${className(values) ?? ''}`
            : `min-h-11 pr-12 ${className ?? ''}`
        }
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        spellCheck={false}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-1.5 -translate-y-1/2"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </Button>
    </div>
  )
}
