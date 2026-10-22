import { ShieldCheck } from 'lucide-react'
import { useI18n } from '../i18n'
import { GITHUB_URL } from '../lib/ui'
import { GithubIcon } from './GithubIcon'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="border-t border-line/70 bg-ink-950/60">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <ShieldCheck className="size-4 text-mint-400" />
              {t('privacy.title')}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t('privacy.text')}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted/70">{t('footer.warning')}</p>
          </div>

          <div className="flex flex-col gap-2 text-xs text-muted">
            <span className="chip w-fit">{t('privacy.badge')}</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-2 text-muted transition-colors hover:text-mint-400"
            >
              <GithubIcon className="size-4" />
              {t('footer.repo')}
            </a>
            <span className="text-[11px] text-muted/60">{t('footer.made')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
