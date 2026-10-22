import {
  Binary,
  FileArchive,
  Fingerprint,
  Key,
  KeyRound,
  Lock,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import type { Category } from '../lib/types'

const ICONS: Record<Category, LucideIcon> = {
  symmetric: Lock,
  asymmetric: KeyRound,
  hash: Fingerprint,
  encoding: Binary,
  classical: ScrollText,
  kdf: Key,
  compression: FileArchive,
}

export function CategoryIcon({
  category,
  className = 'size-4',
}: {
  category: Category
  className?: string
}) {
  const Icon = ICONS[category]
  return <Icon className={className} aria-hidden />
}
