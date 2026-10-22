import clsx from 'clsx'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { LANGUAGES, useI18n } from '../i18n'
import { GITHUB_URL } from '../lib/ui'
import { GithubIcon } from './GithubIcon'

export function Header() {
  const { lang, setLang, t } = useI18n()

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6">
        <a href="./" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-mint-400/25 bg-gradient-to-br from-mint-400/15 to-sky-400/10 shadow-[0_0_30px_-10px_rgba(62,233,184,0.6)]">
            <LockKeyhole className="size-5 text-mint-400" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-fg">{t('app.name')}</span>
            <span className="hidden text-[11px] text-muted sm:block">{t('app.tagline')}</span>
          </span>
        </a>

        <div className="ml-auto flex items-center gap-2">
          <span className="chip hidden md:inline-flex" title={t('app.localTitle')}>
            <ShieldCheck className="size-3.5 text-mint-400" />
            {t('app.local')}
          </span>

          <div className="seg" role="group" aria-label={t('app.language')}>
            {LANGUAGES.map((language) => (
              <button
                key={language.id}
                type="button"
                onClick={() => setLang(language.id)}
                aria-pressed={lang === language.id}
                title={language.label}
                className={clsx('seg-btn px-2 py-1', lang === language.id && 'seg-btn-active')}
              >
                {language.short}
              </button>
            ))}
          </div>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            title={t('app.github')}
            className="grid size-9 place-items-center rounded-xl border border-line bg-ink-850/60 text-muted transition-colors hover:border-line-2 hover:text-fg"
          >
            <GithubIcon className="size-4" />
          </a>
        </div>
      </div>
    </header>
  )
}
