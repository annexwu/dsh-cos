import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { DEFAULT_CONFIG } from '../src/config.ts'
import { CosAttachmentStore, cosAttachmentObjectKey, cosAttachmentObjectKeys } from '../src/cos-attachment-store.ts'

const ref = {
  attachmentId: `sha256:${'a'.repeat(64)}`,
  mediaType: 'image/png',
  bytes: 1024,
  width: 32,
  height: 32,
} as ImageAttachmentRef

describe('COS conversation image attachment layout', () => {
  it('stores content-addressed image objects inside the configured cloud-drive attachment directory', () => {
    const config = {
      ...DEFAULT_CONFIG,
      bucket: 'example-1250000000',
      region: 'ap-guangzhou',
      prefix: 'team/project-a/',
      attachmentDirectory: 'chat-images/',
    }

    expect(cosAttachmentObjectKey(config, ref)).toBe(`team/project-a/chat-images/v1/objects/aa/${'a'.repeat(64)}.png`)
  })

  it('keeps attachment objects under the visible attachment directory at the bucket root', () => {
    const config = { ...DEFAULT_CONFIG, bucket: 'example-1250000000', region: 'ap-guangzhou' }
    expect(cosAttachmentObjectKey(config, ref)).toBe(`dsh-attachments/v1/objects/aa/${'a'.repeat(64)}.png`)
  })

  it('declares no local host path for COS-backed images', () => {
    const store = new CosAttachmentStore(new Context(), {
      getConfig: () => ({ ...DEFAULT_CONFIG, bucket: 'example-1250000000', region: 'ap-guangzhou' }),
      getCredentials: async () => ({ secretId: 'secret-id', secretKey: 'secret-key' }),
    })
    expect(store.imageHostPath(ref)).toBeUndefined()
  })

  it('keeps prior attachment directories readable after the cloud-drive root changes', () => {
    const config = {
      ...DEFAULT_CONFIG,
      bucket: 'example-1250000000',
      region: 'ap-guangzhou',
      attachmentReadRoots: 'team/project-a/dsh-attachments/',
    }
    expect(cosAttachmentObjectKeys(config, ref)).toEqual([
      `dsh-attachments/v1/objects/aa/${'a'.repeat(64)}.png`,
      `dsh-attachments/v1/objects/aa/${'a'.repeat(64)}`,
      `team/project-a/dsh-attachments/v1/objects/aa/${'a'.repeat(64)}.png`,
      `team/project-a/dsh-attachments/v1/objects/aa/${'a'.repeat(64)}`,
    ])
  })
})
