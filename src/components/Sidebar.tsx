import clsx from 'clsx'
import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../lib/labels'
import { ALL_TOOLS } from '../lib/tools'
import type { Category, Tool } from '../lib/types'
import { CategoryIcon } from './CategoryIcon'

interface SidebarProps {
  selectedId: string
  onSelect: (id: string) => void
}

type Filter = Category | 'all'

function badgeClass(badge: Tool['badge']): string {
  if (badge === 'insecure') return 'bg-red-400'
  if (badge === 'legacy') return 'bg-amber-400'
  return 'bg-mint-400'
}

function badgeKey(badge: Tool['badge']): string {
  if (badge === 'insecure') return 'badge.insecure'
  if (badge === 'legacy') return 'badge.legacy'
  return 'badge.recommended'
}

export function Sidebar({ selectedId, onSelect }: SidebarProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL_TOOLS.filter((tool) => {
      if (filter !== 'all' && tool.category !== filter) return false
      if (!q) return true
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.id.includes(q) ||
        t(`tool.${tool.id}`).toLowerCase().includes(q) ||
        t(CATEGORY_LABEL[tool.category]).toLowerCase().includes(q)
      )
    })
  }, [filter, query, t])

  const groups = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        tools: filtered.filter((tool) => tool.category === category),
      })).filter((group) => group.tools.length > 0),
    [filtered],
  )

  return (
    <aside className="panel flex max-h-[420px] flex-col overflow-hidden lg:sticky lg:top-[76px] lg:max-h-[calc(100dvh-6rem)]">
      <div className="space-y-2.5 border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('nav.search')}
            aria-label={t('nav.search')}
            className="field py-2 pr-8 pl-8 text-[13px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted hover:text-fg"
              aria-label={t('input.clear')}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={clsx(
              'shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
              filter === 'all'
                ? 'bg-mint-400/15 text-mint-300'
                : 'text-muted hover:bg-ink-800 hover:text-fg',
            )}
          >
            {t('nav.all')}
          </button>
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(category)}
              className={clsx(
                'shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                filter === category
                  ? 'bg-mint-400/15 text-mint-300'
                  : 'text-muted hover:bg-ink-800 hover:text-fg',
              )}
            >
              {t(CATEGORY_LABEL[category])}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted">{t('nav.noResults')}</p>
        )}

        {groups.map((group) => (
          <div key={group.category} className="mb-2 last:mb-0">
            <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
              <CategoryIcon category={group.category} className="size-3 text-muted/70" />
              <span className="text-[10px] font-semibold tracking-wider text-muted/70 uppercase">
                {t(CATEGORY_LABEL[group.category])}
              </span>
              <span className="ml-auto text-[10px] text-muted/50">{group.tools.length}</span>
            </div>

            <div className="space-y-0.5">
              {group.tools.map((tool) => {
                const selected = tool.id === selectedId
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => onSelect(tool.id)}
                    className={clsx(
                      'group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                      selected
                        ? 'bg-mint-400/10 text-fg'
                        : 'text-muted hover:bg-ink-800/70 hover:text-fg',
                    )}
                  >
                    {selected && (
                      <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-mint-400" />
                    )}
                    <span
                      className={clsx(
                        'grid size-7 shrink-0 place-items-center rounded-md border',
                        selected
                          ? 'border-mint-400/30 bg-mint-400/10 text-mint-300'
                          : 'border-line bg-ink-850 text-muted group-hover:text-fg',
                      )}
                    >
                      <CategoryIcon category={tool.category} className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-medium">{tool.name}</span>
                        {tool.badge && (
                          <span
                            className={clsx('size-1.5 shrink-0 rounded-full', badgeClass(tool.badge))}
                            title={t(badgeKey(tool.badge))}
                          />
                        )}
                      </span>
                      <span className="block truncate text-[10.5px] leading-tight text-muted/70">
                        {t(`tool.${tool.id}`)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[10px] text-muted/70">
        <span>{t('nav.tools')}</span>
        <span className="font-mono">{ALL_TOOLS.length}</span>
      </div>
    </aside>
  )
}
