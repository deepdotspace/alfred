/**
 * profile-extract-text -- server action: pull plain text out of an uploaded
 * doc/PDF (cloudconvert -> txt). Used by the writing-reference upload (founder
 * add: accept upload in addition to paste) so Alfred can study the voice.
 *
 * Developer-billed (cloudconvert); auth-gated by the worker.
 */
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { actionInvoker } from '../server/integrations'
import { fileToPlainText, type ResumeFileInput } from '../server/profile/parse'

export const profileExtractText: ActionHandler<Env> = async ({ params, tools }) => {
  const file = params.file as ResumeFileInput | undefined
  if (!file || typeof file.base64 !== 'string') {
    return { success: false, error: 'No file provided' }
  }
  try {
    const text = await fileToPlainText(actionInvoker(tools), file)
    return { success: true, data: { text } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Could not read the document' }
  }
}
