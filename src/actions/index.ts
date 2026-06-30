import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { profileParseResume } from './profile-parse-resume'
import { profileExtractText } from './profile-extract-text'
import { matchRecompute } from './match-recompute'
import { matchMarkSeen } from './match-mark-seen'
import { devSeedProfile, devMatchPreview } from './match-dev'
import { devRunDigest, devSeedApplications } from './digest-dev'
import { tailorStart } from './tailor-start'
import { tailorDownload } from './tailor-download'
import { devTailorPreview } from './tailor-dev'
import { sampleBrief } from './sample-brief'

export const actions: Record<string, ActionHandler<Env>> = {
  'profile-parse-resume': profileParseResume,
  'profile-extract-text': profileExtractText,
  // Matching (P3)
  'match-recompute': matchRecompute,
  'match-mark-seen': matchMarkSeen,
  'dev-seed-profile': devSeedProfile,
  'dev-match-preview': devMatchPreview,
  // Digest + tracker (P5) -- dev-gated verification only
  'dev-run-digest': devRunDigest,
  'dev-seed-applications': devSeedApplications,
  // Tailoring (P4)
  'tailor-start': tailorStart,
  'tailor-download': tailorDownload,
  'dev-tailor-preview': devTailorPreview,
  // Landing live sample (P6) -- public-facing curated pool subset
  'sample-brief': sampleBrief,
}
