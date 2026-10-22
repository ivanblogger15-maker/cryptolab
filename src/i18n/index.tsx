import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Lang } from '../lib/types'
import { ca, type Dict } from './ca'
import { en } from './en'
import { es } from './es'

export const LANGUAGES: { id: Lang; label: string; short: string }[] = [
  { id: 'ca', label: 'Català', short: 'CA' },
  { id: 'es', label: 'Castellano', short: 'ES' },
  { id: 'en', label: 'English', short: 'EN' },
]

const dictionaries: Record<Lang, Dict> = { ca, es, en }
const STORAGE_KEY = 'cryptolab.lang'

function isLang(value: string | null): value is Lang {
  return value === 'ca' || value === 'es' || value === 'en'
}

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLang(stored)) return stored
  } catch {
    // Storage may be disabled; fall through.
  }
  // Catalan is the default interface language.
  return 'ca'
}

type Vars = Record<string, string | number>

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Vars) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const dict = dictionaries[lang] as Record<string, string>
      let value = dict[key] ?? (ca as Record<string, string>)[key] ?? key
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(replacement))
        }
      }
      return value
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
