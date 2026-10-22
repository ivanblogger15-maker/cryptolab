import clsx from 'clsx'
import { AlertTriangle, Loader2, Play, ShieldCheck, Sparkles } from 'lucide-react'
import { useI18n } from '../i18n'
import { actionKeys } from '../lib/labels'
import type {
  Direction,
  InputMode,
  Params,
  Tool,
  ToolOutput,
} from '../lib/types'
import { CategoryIcon } from './CategoryIcon'
import { InputPane } from './InputPane'
import { OutputPane } from './OutputPane'
import { ParamsPanel } from './ParamsPanel'

interface ToolPanelProps {
  tool: Tool
  direction: Direction
  mode: InputMode
  params: Params
  text: string
  file: File | null
  result: ToolOutput | null
  error: { code: string; detail?: string } | null
  busy: boolean
  canRun: boolean
  onDirectionChange: (direction: Direction) => void
  onModeChange: (mode: InputMode) => void
  onParamChange: (id: string, value: string) => void
  onTextChange: (value: string) => void
  onFileChange: (file: File | null) => void
  onRun: () => void
  onUseAsInput: () => void
}

const BADGE_STYLE: Record<NonNullable<Tool['badge']>, string> = {
  recommended: 'border-mint-400/30 bg-mint-400/10 text-mint-300',
  legacy: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  insecure: 'border-red-400/30 bg-red-400/10 text-red-300',
}

const BADGE_KEY: Record<NonNullable<Tool['badge']>, string> = {
  recommended: 'badge.recommended',
  legacy: 'badge.legacy',
  insecure: 'badge.insecure',
}

export function ToolPanel({
  tool,
  direction,
  mode,
  params,
  text,
  file,
  result,
  error,
  busy,
  canRun,
  onDirectionChange,
  onModeChange,
  onParamChange,
  onTextChange,
  onFileChange,
  onRun,
  onUseAsInput,
}: ToolPanelProps) {
  const { t } = useI18n()
  const [encodeKey, decodeKey] = actionKeys(tool.action)
  const showDirection =
    Boolean(tool.reversible) && tool.action !== 'hash' && tool.action !== 'generate'
  const showMode = tool.fileSupport !== false && !tool.noInput
  const errorMessage =
    error && error.code !== 'generic' && t(`err.${error.code}`) !== `err.${error.code}`
      ? t(`err.${error.code}`)
      : t('error.generic')

  return (
    <div className="min-w-0 space-y-4">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip">
                <CategoryIcon category={tool.category} className="size-3" />
                {t(`cat.${tool.category}`)}
              </span>
              {tool.badge && (
                <span
                  className={clsx(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    BADGE_STYLE[tool.badge],
                  )}
                >
                  {t(BADGE_KEY[tool.badge])}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-fg sm:text-2xl">
              {tool.name}
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
              {t(`tool.${tool.id}`)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showDirection && (
              <div className="seg" role="group">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDirectionChange('encode')}
                  className={clsx('seg-btn', direction === 'encode' && 'seg-btn-active')}
                >
                  {t(encodeKey)}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDirectionChange('decode')}
                  className={clsx('seg-btn', direction === 'decode' && 'seg-btn-active')}
                >
                  {t(decodeKey)}
                </button>
              </div>
            )}

            {showMode && (
              <div className="seg" role="group">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onModeChange('text')}
                  className={clsx('seg-btn', mode === 'text' && 'seg-btn-active')}
                >
                  {t('mode.text')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onModeChange('file')}
                  className={clsx('seg-btn', mode === 'file' && 'seg-btn-active')}
                >
                  {t('mode.file')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <ParamsPanel
            tool={tool}
            params={params}
            direction={direction}
            onChange={onParamChange}
          />

          {tool.noInput ? (
            <div className="flex items-start gap-3 rounded-xl border border-line bg-ink-950/40 px-4 py-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-ink-900 text-mint-400">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-fg">{t('input.none')}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">{t('input.noneHint')}</p>
              </div>
            </div>
          ) : (
            <InputPane
              mode={mode}
              text={text}
              file={file}
              onTextChange={onTextChange}
              onFileChange={onFileChange}
            />
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onRun}
              disabled={!canRun || busy}
              className="btn-primary w-full py-3 sm:w-auto sm:px-7"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {t(busy ? 'action.running' : direction === 'encode' ? encodeKey : decodeKey)}
            </button>
            <span className="flex items-center gap-1.5 text-[11px] text-muted/70">
              <ShieldCheck className="size-3.5 text-mint-400/70" />
              {t('app.localTitle')}
            </span>
          </div>

          {error && (
            <div className="fade-up rounded-xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
                <AlertTriangle className="size-4" />
                {t('error.title')}
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-red-100/85">
                {errorMessage}
              </p>
              {error.detail && (
                <p className="mt-1.5 font-mono text-[10.5px] break-all text-red-200/55">
                  {t('error.detail')}: {error.detail}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <OutputPane
        tool={tool}
        direction={direction}
        result={result}
        busy={busy}
        onUseAsInput={onUseAsInput}
      />
    </div>
  )
}
