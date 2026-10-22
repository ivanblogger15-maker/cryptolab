import clsx from 'clsx'
import { FileText, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { formatBytes, utf8 } from '../lib/bytes'
import type { InputMode } from '../lib/types'

interface InputPaneProps {
  mode: InputMode
  text: string
  file: File | null
  onTextChange: (value: string) => void
  onFileChange: (file: File | null) => void
}

export function InputPane({
  mode,
  text,
  file,
  onTextChange,
  onFileChange,
}: InputPaneProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const byteLength = mode === 'text' ? utf8(text).length : (file?.size ?? 0)

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted uppercase">
          {t('input.label')}
        </h2>
        <div className="ml-auto flex items-center gap-3 font-mono text-[10.5px] text-muted/70">
          <span>
            {mode === 'text'
              ? t('input.chars', { n: text.length })
              : t('input.bytes', { n: byteLength })}
          </span>
          {mode === 'text' && text.length > 0 && (
            <span className="hidden sm:inline">· {formatBytes(byteLength)}</span>
          )}
          {((mode === 'text' && text.length > 0) || (mode === 'file' && file)) && (
            <button
              type="button"
              onClick={() => {
                onTextChange('')
                onFileChange(null)
              }}
              className="text-muted transition-colors hover:text-red-400"
            >
              {t('input.clear')}
            </button>
          )}
        </div>
      </div>

      {mode === 'text' ? (
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={t('input.placeholder')}
          spellCheck={false}
          className="min-h-[190px] w-full resize-y bg-transparent px-4 py-4 font-mono text-[13px] leading-relaxed text-fg placeholder:text-muted/45 focus:outline-none"
        />
      ) : (
        <div className="p-4">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            onClick={(event) => {
              ;(event.target as HTMLInputElement).value = ''
            }}
          />

          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-mint-400/25 bg-mint-400/[0.06] px-3.5 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-ink-900">
                <FileText className="size-5 text-mint-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{file.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  {formatBytes(file.size)}
                  {file.type ? ` · ${file.type}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="btn-ghost px-2.5 py-1.5 text-[11px]"
              >
                {t('input.browse')}
              </button>
              <button
                type="button"
                onClick={() => onFileChange(null)}
                title={t('input.remove')}
                className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-ink-800 hover:text-red-400"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                const dropped = event.dataTransfer.files?.[0]
                if (dropped) onFileChange(dropped)
              }}
              className={clsx(
                'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
                dragging
                  ? 'border-mint-400/60 bg-mint-400/10'
                  : 'border-line-2 bg-ink-950/40 hover:border-mint-400/40 hover:bg-ink-900',
              )}
            >
              <span className="grid size-11 place-items-center rounded-full border border-line bg-ink-900 text-mint-400">
                <Upload className="size-5" />
              </span>
              <span className="text-sm font-medium text-fg">{t('input.drop')}</span>
              <span className="text-[11px] text-muted">{t('input.dropHint')}</span>
            </button>
          )}
        </div>
      )}
    </section>
  )
}
