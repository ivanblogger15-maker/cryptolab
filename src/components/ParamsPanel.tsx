import clsx from 'clsx'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n'
import type { Direction, ParamDef, Params, Tool } from '../lib/types'

interface FieldProps {
  def: ParamDef
  value: string
  onChange: (value: string) => void
}

function Field({ def, value, onChange }: FieldProps) {
  const { t } = useI18n()
  const [reveal, setReveal] = useState(false)
  const label = t(def.label)

  if (def.type === 'checkbox') {
    return (
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-ink-950/50 px-3 py-2.5 select-none hover:border-line-2">
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
          className="size-4 accent-[#3ee9b8]"
        />
        <span className="text-sm text-fg">{label}</span>
      </label>
    )
  }

  return (
    <div className={clsx(def.width !== 'half' && 'sm:col-span-2')}>
      <label className="label" htmlFor={`param-${def.id}`}>
        {label}
        {def.required && <span className="ml-1 text-mint-400/80">*</span>}
      </label>

      {def.type === 'select' ? (
        <div className="relative">
          <select
            id={`param-${def.id}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="field cursor-pointer appearance-none pr-9"
          >
            {def.options?.map((option) => (
              <option key={option.value} value={option.value} className="bg-ink-900">
                {t(option.label)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
        </div>
      ) : def.type === 'password' ? (
        <div className="relative">
          <input
            id={`param-${def.id}`}
            type={reveal ? 'text' : 'password'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={def.placeholder}
            autoComplete="new-password"
            spellCheck={false}
            className={clsx('field pr-10', def.mono && 'font-mono text-[13px]')}
          />
          <button
            type="button"
            onClick={() => setReveal((current) => !current)}
            className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-fg"
            aria-label={reveal ? 'Hide' : 'Show'}
            tabIndex={-1}
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      ) : def.type === 'textarea' ? (
        <textarea
          id={`param-${def.id}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={def.placeholder}
          spellCheck={false}
          rows={4}
          className={clsx('field resize-y', (def.mono ?? true) && 'font-mono text-[12.5px] leading-relaxed')}
        />
      ) : def.type === 'number' ? (
        <input
          id={`param-${def.id}`}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={def.placeholder}
          min={def.min}
          max={def.max}
          step={def.step}
          className="field font-mono text-[13px]"
        />
      ) : (
        <input
          id={`param-${def.id}`}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={def.placeholder}
          spellCheck={false}
          className={clsx('field', def.mono && 'font-mono text-[13px]')}
        />
      )}

      {def.help && <p className="mt-1.5 text-[11px] leading-snug text-muted/75">{t(def.help)}</p>}
    </div>
  )
}

interface ParamsPanelProps {
  tool: Tool
  params: Params
  direction: Direction
  onChange: (id: string, value: string) => void
}

export function ParamsPanel({ tool, params, direction, onChange }: ParamsPanelProps) {
  const visible = (tool.params ?? []).filter(
    (def) => !def.showIf || def.showIf(params, direction),
  )

  if (visible.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
      {visible.map((def) => (
        <Field
          key={def.id}
          def={def}
          value={params[def.id] ?? def.default ?? ''}
          onChange={(value) => onChange(def.id, value)}
        />
      ))}
    </div>
  )
}
