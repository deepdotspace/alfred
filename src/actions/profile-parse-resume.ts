/**
 * profile-parse-resume -- server action: parse uploaded resume file(s) and/or
 * text into a merged structured master profile + a ROLE_TAXONOMY pre-selection.
 *
 * Auth-gated (the worker validates the JWT before the action runs); the
 * anthropic / cloudconvert calls are developer-billed (owner pays), so this
 * MUST stay behind a signed-in caller -- which it is.
 */
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { actionInvoker } from '../server/integrations'
import { parseResume, type ResumeFileInput } from '../server/profile/parse'

export const profileParseResume: ActionHandler<Env> = async ({ params, tools }) => {
  const files = (Array.isArray(params.files) ? params.files : []) as ResumeFileInput[]
  const text = typeof params.text === 'string' ? params.text : undefined
  try {
    const data = await parseResume(actionInvoker(tools), { files, text })
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Resume parse failed' }
  }
}
