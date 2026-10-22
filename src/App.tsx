import { Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ToolPanel } from './components/ToolPanel'
import { useI18n } from './i18n'
import { tryUtf8, utf8 } from './lib/bytes'
import { ToolError } from './lib/errors'
import { ALL_TOOLS, DEFAULT_TOOL_ID, TOOL_MAP, defaultParams } from './lib/tools'
import type { Direction, InputMode, Params, ToolOutput } from './lib/types'

const TOOL_STORAGE_KEY = 'cryptolab.tool'

function initialToolId(): string {
  try {
    const stored = localStorage.getItem(TOOL_STORAGE_KEY)
    if (stored && TOOL_MAP.has(stored)) return stored
  } catch {
    // Ignore storage failures.
  }
  return DEFAULT_TOOL_ID
}

interface RunError {
  code: string
  detail?: string
}

export default function App() {
  const { t } = useI18n()
  const [toolId, setToolId] = useState(initialToolId)
  const tool = TOOL_MAP.get(toolId) ?? TOOL_MAP.get(DEFAULT_TOOL_ID)!
  const [direction, setDirection] = useState<Direction>('encode')
  const [mode, setMode] = useState<InputMode>('text')
  const [params, setParams] = useState<Params>(() => defaultParams(tool))
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ToolOutput | null>(null)
  const [error, setError] = useState<RunError | null>(null)
  const [busy, setBusy] = useState(false)

  const selectTool = useCallback((id: string) => {
    const next = TOOL_MAP.get(id)
    if (!next) return
    setToolId(id)
    setParams(defaultParams(next))
    setDirection('encode')
    setResult(null)
    setError(null)
    if (next.fileSupport === false || next.noInput) setMode('text')
    try {
      localStorage.setItem(TOOL_STORAGE_KEY, id)
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const changeDirection = (next: Direction) => {
    setDirection(next)
    setResult(null)
    setError(null)
  }

  const changeMode = (next: InputMode) => {
    setMode(next)
    setResult(null)
    setError(null)
  }

  const changeParam = (id: string, value: string) => {
    setParams((current) => ({ ...current, [id]: value }))
    setError(null)
  }

  const canRun =
    tool.noInput ||
    (mode === 'file' ? file !== null : text.length > 0) ||
    tool.action === 'hash'

  const run = async () => {
    if (busy) return
    setBusy(true)
    setResult(null)
    setError(null)

    try {
      let input: Uint8Array = new Uint8Array(0)
      if (!tool.noInput) {
        if (mode === 'file') {
          if (!file) {
            setError({ code: 'empty_input' })
            return
          }
          input = new Uint8Array(await file.arrayBuffer())
        } else {
          input = utf8(text)
        }
      }

      const output = await tool.run({
        direction,
        input,
        text: mode === 'text' ? text : (tryUtf8(input) ?? ''),
        params,
        fileName: mode === 'file' ? file?.name : undefined,
        mime: mode === 'file' ? file?.type : undefined,
      })
      setResult(output)
    } catch (cause) {
      if (cause instanceof ToolError) {
        setError({ code: cause.code, detail: cause.detail })
      } else {
        setError({
          code: 'generic',
          detail: cause instanceof Error ? cause.message : String(cause),
        })
      }
    } finally {
      setBusy(false)
    }
  }

  const useAsInput = () => {
    if (!result) return
    const decoded = result.text ?? tryUtf8(result.bytes)
    if (decoded !== null) {
      setMode('text')
      setText(decoded)
      setFile(null)
    } else {
      const outputFile = new File(
        [new Uint8Array(result.bytes)],
        result.filename ?? `${tool.id}-output.bin`,
        { type: result.mime ?? 'application/octet-stream' },
      )
      setMode('file')
      setFile(outputFile)
    }
    setResult(null)
    setError(null)
  }

  const highlights = ['AES-256-GCM', 'ChaCha20', 'Ed25519', 'Argon2id']

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-12 sm:px-6">
        <section className="py-7 sm:py-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <span className="chip border-mint-400/25 text-mint-300">
                <Sparkles className="size-3.5" />
                {t('hero.badge', { count: ALL_TOOLS.length })}
              </span>
              <h1 className="mt-3 max-w-3xl text-[26px] leading-[1.15] font-bold tracking-tight text-fg sm:text-[32px]">
                {t('hero.title')}
              </h1>
              <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-muted sm:text-sm">
                {t('hero.subtitle')}
              </p>
            </div>

            <div className="hidden grid-cols-2 gap-1.5 md:grid">
              {highlights.map((item) => (
                <span
                  key={item}
                  className="rounded-lg border border-line bg-ink-900/70 px-2.5 py-1.5 text-center font-mono text-[10.5px] text-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5">
          <Sidebar selectedId={tool.id} onSelect={selectTool} />

          <ToolPanel
            tool={tool}
            direction={direction}
            mode={mode}
            params={params}
            text={text}
            file={file}
            result={result}
            error={error}
            busy={busy}
            canRun={canRun}
            onDirectionChange={changeDirection}
            onModeChange={changeMode}
            onParamChange={changeParam}
            onTextChange={(value) => {
              setText(value)
              setError(null)
            }}
            onFileChange={(nextFile) => {
              setFile(nextFile)
              setError(null)
            }}
            onRun={run}
            onUseAsInput={useAsInput}
          />
        </div>
      </main>

      <Footer />
    </div>
  )
}
