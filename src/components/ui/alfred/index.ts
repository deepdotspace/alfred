/**
 * Alfred design-system primitives.
 *
 * Pixel-faithful to docs/specs/DESIGN-SPEC.md §4. Import these for any Alfred
 * surface:
 *   import { Button, Chip, FitBadge, Card } from '../../components/ui/alfred'
 *
 * The leftover shadcn kit in `src/components/ui/` (Toast provider, etc.) stays
 * for SDK plumbing; reach for these for everything visible in the product.
 */

export * from './icons'
export { Button } from './Button'
export type { ButtonProps, AlfButtonVariant } from './Button'
export {
  Chip, AddChip, StageSegmented, StageMultiSelect, PillToggle, MetaPill, ResumeChip, DocSkillChip, RefineChip,
} from './Chip'
export type { ChipProps, AddChipProps, SegmentedOption, StageSegmentedProps, StageMultiSelectProps, PillToggleProps } from './Chip'
export { FitBadge } from './FitBadge'
export type { FitBadgeProps, FitVariant } from './FitBadge'
export { Card, RoleCard, TrackerCard } from './Card'
export type { CardProps, RoleCardProps, TrackerCardProps } from './Card'
export { Tabs } from './Tabs'
export type { TabsProps, TabsOption } from './Tabs'
export { VisaToggle } from './Toggle'
export type { VisaToggleProps } from './Toggle'
export { Slider } from './Slider'
export type { SliderProps } from './Slider'
export { ProgressDots } from './ProgressDots'
export type { ProgressDotsProps } from './ProgressDots'
export { SearchMultiSelect } from './SearchMultiSelect'
export type { SearchMultiSelectProps } from './SearchMultiSelect'
export { AlfredNote } from './AlfredNote'
export { TrustNote } from './TrustNote'
export type { TrustNoteProps, TrustTone } from './TrustNote'
export { SkelBar, SkeletonLines } from './Skeleton'
export type { SkelBarProps } from './Skeleton'
