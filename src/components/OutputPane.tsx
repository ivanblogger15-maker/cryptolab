import clsx from 'clsx'
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Info,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { bytesToBase64, toHex, tryUtf8 } from '../lib/bytes'
import type { Direction, Tool, ToolOutput } from '../lib/types'
import { copyText, downloadBytes, downloadText } from '../lib/ui'

type View = 'auto' | 'text' | 'hex' | 'base64'

interface OutputPaneProps {
  tool: Tool
  direction: Direction
  result: ToolOutput | null
  busy: boolean
  onUseAsInput?: () => void
}

export function OutputPane({ tool, direction, result, busy, onUseAsInput }: OutputPaneProps) {
  const { t } = useI18n()
  const [view, setView] = useState<View>('auto')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setView('auto')
  }, [result])

  const text = useMemo(() => {
    if (!result) return null
    return result.text ?? tryUtf8(result.bytes)
  }, [result])

  const resolved: Exclude<View, 'auto'> =
    view === 'auto' ? (text !== null ? 'text' : 'hex') : view

  const shown = useMemo(() => {
    if (!result) return ''
    if (resolved === 'text') return text ?? ''
    if (resolved === 'base64') return bytesToBase64(result.bytes)
    return toHex(result.bytes)
  }, [resolved, result, text])

  const filename = useMemo(() => {
    if (!result) return 'cryptolab-output.txt'
    const fallback = `${tool.id}-${direction}.${result.text !== undefined || text !== null ? 'txt' : 'bin'}`
    return result.filename ?? fallback
  }, [direction, result, text, tool.id])

  const copy = async (value: string, key: string) => {
    const ok = await copyText(value)
    if (ok) {
      setCopied(key)
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600)
    }
  }

  const downloadResult = () => {
    if (!result) return
    if (result.text !== undefined) {
      downloadText(result.text, filename)
      return
    }
    downloadBytes(
      result.bytes,
      filename,
      result.mime ?? (text !== null ? 'text/plain;charset=utf-8' : 'application/octet-stream'),
    )
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted uppercase">
          {t('output.label')}
        </h2>

        {result && (
          <div className="seg ml-1">
            {(['text', 'hex', 'base64'] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={option === 'text' && text === null}
                onClick={() => setView(option)}
                className={clsx(
                  'seg-btn px-2 py-1 text-[10.5px]',
                  resolved === option && 'seg-btn-active',
                  option === 'text' && text === null && 'cursor-not-allowed opacity-40',
                )}
              >
                {t(`output.${option}`)}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {result && (
            <>
              {onUseAsInput && (
                <button
                  type="button"
                  onClick={onUseAsInput}
                  className="btn-subtle px-2 py-1.5 text-[11px]"
                  title={t('output.toInput')}
                >
                  ↑ {t('output.toInput')}
                </button>
              )}
              <button
                type="button"
                onClick={() => copy(shown, 'main')}
                className="btn-subtle px-2 py-1.5 text-[11px]"
              >
                {copied === 'main' ? (
                  <Check className="size-3.5 text-mint-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied === 'main' ? t('output.copied') : t('output.copy')}
              </button>
              <button
                type="button"
                onClick={downloadResult}
                className="btn-subtle px-2 py-1.5 text-[11px]"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">{t('output.download')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {busy ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-muted">
          <Loader2 className="size-6 animate-spin text-mint-400" />
          <span className="text-sm">{t('action.running')}</span>
        </div>
      ) : !result ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="grid size-10 place-items-center rounded-full border border-line bg-ink-850 text-muted/70">
            <Sparkles className="size-4" />
          </span>
          <p className="text-sm text-muted">{t('output.empty')}</p>
        </div>
      ) : (
        <div className="fade-up space-y-3 p-4">
          {result.status && (
            <div
              className={clsx(
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold',
                result.status === 'valid'
                  ? 'border-mint-400/30 bg-mint-400/10 text-mint-300'
                  : 'border-red-400/30 bg-red-400/10 text-red-300',
              )}
            >
              {result.status === 'valid' ? <Check className="size-4" /> : <X className="size-4" />}
              {t(result.status === 'valid' ? 'output.status.valid' : 'output.status.invalid')}
            </div>
          )}

          {result.blocks && result.blocks.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
                {t('output.blocks')}
              </p>
              {result.blocks.map((block, index) => (
                <div
                  key={`${block.label}-${index}`}
                  className="overflow-hidden rounded-xl border border-line bg-ink-950/50"
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                    <span className="text-xs font-semibold text-fg">{t(block.label)}</span>
                    {block.hint && (
                      <span className="text-[10.5px] text-amber-300/80">{t(block.hint)}</span>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copy(block.text, `block-${index}`)}
                        className="btn-subtle px-1.5 py-1 text-[10.5px]"
                      >
                        {copied === `block-${index}` ? (
                          <Check className="size-3.5 text-mint-400" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        {copied === `block-${index}` ? t('output.copied') : t('output.copy')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadText(block.text, block.filename ?? `${tool.id}-${index}.pem`)
                        }
                        className="btn-subtle px-1.5 py-1 text-[10.5px]"
                        title={t('output.download')}
                      >
                        <Download className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <pre className="max-h-44 overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-fg/90">
                    {block.text}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {resolved === 'text' ? (
            <pre className="max-h-[420px] min-h-[120px] overflow-auto rounded-xl border border-line bg-ink-950/60 px-3.5 py-3 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-fg">
              {shown}
            </pre>
          ) : (
            <>
              <pre className="max-h-[420px] min-h-[120px] overflow-auto rounded-xl border border-line bg-ink-950/60 px-3.5 py-3 font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap text-fg">
                {shown}
              </pre>
              <p className="flex items-start gap-2 text-[11px] text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {t('output.binaryHint')}
              </p>
            </>
          )}

          {result.metas && result.metas.length > 0 && (
            <details className="rounded-xl border border-line bg-ink-950/40">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
                {t('output.details')}
                <ChevronDown className="size-3.5" />
              </summary>
              <dl className="grid gap-x-6 gap-y-2 border-t border-line px-3 py-3 sm:grid-cols-2">
                {result.metas.map((meta) => (
                  <div key={`${meta.label}-${meta.value}`} className="min-w-0">
                    <dt className="text-[10px] tracking-wide text-muted/70 uppercase">
                      {t(meta.label)}
                    </dt>
                    <dd
                      className={clsx(
                        'mt-0.5 text-[11.5px] break-all text-fg/90',
                        meta.mono && 'font-mono text-[10.5px]',
                      )}
                    >
                      {meta.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}

          {result.noteKeys && result.noteKeys.length > 0 && (
            <div className="space-y-1.5 border-t border-line pt-3">
              {result.noteKeys.map((key) => (
                <p key={key} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-sky-400/70" />
                  {t(key)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
