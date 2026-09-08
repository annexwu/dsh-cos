import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { AttachmentError, AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type {
  ImageAttachmentLimits,
  ImageAttachmentRef,
  ImageRequestPolicy,
  RequestImageAttachment,
  SaveImageAttachment,
  StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment'
import {
  DEFAULT_MAX_IMAGE_BYTES,
  DEFAULT_MAX_IMAGE_DIMENSION,
  DEFAULT_MAX_IMAGE_PIXELS,
  DEFAULT_MAX_IMAGES_PER_MESSAGE,
  DEFAULT_MAX_MESSAGE_IMAGE_BYTES,
  DEFAULT_NORMALIZED_IMAGE_MAX_BYTES,
  DEFAULT_NORMALIZED_IMAGE_MAX_DIMENSION,
  DEFAULT_NORMALIZED_IMAGE_MAX_PIXELS,
  commitPreparedImageFile,
  prepareImageFile,
  readImageFile,
  readRequestImageFile,
} from '@deepseek-ai/dsh-attachment-local'
import type { NormalizationPolicy } from '@deepseek-ai/dsh-attachment-local'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { Context } from '@deepseek-ai/cordis'
import { attachmentReadOrigins, attachmentReadRoots, attachmentRootPrefix, type AttachmentReadOrigin } from './cos-config.ts'
import { createCosClient, isCosNotFoundError, type CosCredentials } from './cos-client.ts'
import type { Config } from './config.ts'

const OBJECTS_DIRECTORY = 'v1/objects'

export interface CosAttachmentServices {
  getConfig(): Config
  getCredentials(): Promise<CosCredentials>
}

function attachmentHash(ref: ImageAttachmentRef): string {
  const match = /^sha256:([a-f0-9]{64})$/.exec(String(ref.attachmentId))
  if (match?.[1] === undefined) throw new AttachmentError('Attachment reference is invalid.', 'INVALID_ATTACHMENT_REF')
  return match[1]
}

export function cosAttachmentObjectKey(config: Config, ref: ImageAttachmentRef): string {
  return cosAttachmentObjectKeyAtRoot(attachmentRootPrefix(config), ref)
}

function extensionForMediaType(ref: ImageAttachmentRef): string {
  switch (ref.mediaType) {
    case 'image/png': return 'png'
    case 'image/jpeg': return 'jpg'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
  }
}

export function cosAttachmentObjectKeyAtRoot(root: string, ref: ImageAttachmentRef): string {
  const hash = attachmentHash(ref)
  return `${root}${OBJECTS_DIRECTORY}/${hash.slice(0, 2)}/${hash}.${extensionForMediaType(ref)}`
}

function legacyCosAttachmentObjectKeyAtRoot(root: string, ref: ImageAttachmentRef): string {
  const hash = attachmentHash(ref)
  return `${root}${OBJECTS_DIRECTORY}/${hash.slice(0, 2)}/${hash}`
}

export function cosAttachmentObjectKeys(config: Config, ref: ImageAttachmentRef): readonly string[] {
  return attachmentReadRoots(config).flatMap(root => [
    cosAttachmentObjectKeyAtRoot(root, ref),
    legacyCosAttachmentObjectKeyAtRoot(root, ref),
  ])
}

function configured(config: Config): boolean {
  return config.bucket.trim() !== '' && config.region.trim() !== ''
}

function sourceLimits(): ImageAttachmentLimits {
  return Object.freeze({
    maxImageBytes: DEFAULT_MAX_IMAGE_BYTES,
    maxImagesPerMessage: DEFAULT_MAX_IMAGES_PER_MESSAGE,
    maxMessageImageBytes: DEFAULT_MAX_MESSAGE_IMAGE_BYTES,
    maxImagePixels: DEFAULT_MAX_IMAGE_PIXELS,
    maxImageDimension: DEFAULT_MAX_IMAGE_DIMENSION,
    mediaTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const),
  })
}

function normalizationPolicy(): NormalizationPolicy {
  return Object.freeze({
    maxPixels: DEFAULT_NORMALIZED_IMAGE_MAX_PIXELS,
    maxDimension: DEFAULT_NORMALIZED_IMAGE_MAX_DIMENSION,
    maxBytes: DEFAULT_NORMALIZED_IMAGE_MAX_BYTES,
  })
}

async function streamBytes(stream: Readable, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
  signal?.throwIfAborted()
  const abort = () => stream.destroy(signal?.reason instanceof Error ? signal.reason : new Error('Attachment request cancelled.'))
  signal?.addEventListener('abort', abort, { once: true })
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const chunk of stream) {
      signal?.throwIfAborted()
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
      size += buffer.byteLength
      if (size > maxBytes) {
        stream.destroy()
        throw new AttachmentError('Stored attachment exceeds the recorded size.', 'ATTACHMENT_CORRUPT')
      }
      chunks.push(buffer)
    }
    return Buffer.concat(chunks)
  } finally {
    signal?.removeEventListener('abort', abort)
    stream.destroy()
  }
}

function verifiedReference(prepared: { ref: ImageAttachmentRef }, ref: ImageAttachmentRef): boolean {
  return prepared.ref.attachmentId === ref.attachmentId
    && prepared.ref.mediaType === ref.mediaType
    && prepared.ref.width === ref.width
    && prepared.ref.height === ref.height
    && prepared.ref.bytes === ref.bytes
}

/**
 * DSH image attachment backend that stores new conversation images in COS while
 * retaining local read compatibility for images created before COS was enabled.
 */
export class CosAttachmentStore extends AttachmentStore {
  readonly imageLimits = sourceLimits()
  readonly normalizationPolicy = normalizationPolicy()
  readonly localRoot = resolve(join(resolveDshHome(), 'attachments', 'v1'))
  readonly variantCacheRoot = resolve(join(resolveDshHome(), 'attachments', 'cos-variants', 'v1'))

  constructor(
    ctx: Context,
    private readonly services: CosAttachmentServices,
  ) {
    super(ctx)
  }

  async validateImage(input: SaveImageAttachment): Promise<void> {
    await prepareImageFile(input, this.imageLimits, this.normalizationPolicy)
  }

  override async saveImages(inputs: readonly SaveImageAttachment[]): Promise<readonly ImageAttachmentRef[]> {
    this.validateImageBatch(inputs)
    const prepared = await Promise.all(inputs.map(input => prepareImageFile(input, this.imageLimits, this.normalizationPolicy)))
    const refs: ImageAttachmentRef[] = []
    for (const image of prepared) refs.push(await this.savePrepared(image))
    return refs
  }

  async saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef> {
    return await this.savePrepared(await prepareImageFile(input, this.imageLimits, this.normalizationPolicy))
  }

  override imageHostPath(ref: ImageAttachmentRef): string | undefined {
    attachmentHash(ref)
    return undefined
  }

  async readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment> {
    const config = this.services.getConfig()
    if (configured(config)) {
      for (const origin of attachmentReadOrigins(config)) {
        for (const key of [
          cosAttachmentObjectKeyAtRoot(origin.root, ref),
          legacyCosAttachmentObjectKeyAtRoot(origin.root, ref),
        ]) {
          try {
            return await this.readCosImage(ref, key, origin, signal)
          } catch (error) {
            if (!isCosNotFoundError(error)) throw error
          }
        }
      }
    }
    return await readImageFile(this.localRoot, ref, signal)
  }

  override async readImageRequest(
    ref: ImageAttachmentRef,
    policy: ImageRequestPolicy,
    signal?: AbortSignal,
  ): Promise<RequestImageAttachment> {
    return await readRequestImageFile(this.variantCacheRoot, await this.readImage(ref, signal), policy, signal)
  }

  private async savePrepared(prepared: Awaited<ReturnType<typeof prepareImageFile>>): Promise<ImageAttachmentRef> {
    const config = this.services.getConfig()
    if (!config.attachmentEnabled || !configured(config)) {
      return await commitPreparedImageFile(this.localRoot, prepared)
    }
    const credentials = await this.services.getCredentials()
    const cos = createCosClient(credentials)
    try {
      await cos.putObject({
        Bucket: config.bucket,
        Region: config.region,
        Key: cosAttachmentObjectKey(config, prepared.ref),
        Body: Buffer.from(prepared.data),
        ContentLength: prepared.data.byteLength,
        ContentType: prepared.ref.mediaType,
      })
    } catch (error) {
      throw new AttachmentError('Unable to persist image attachment in COS.', 'ATTACHMENT_WRITE_FAILED', { cause: error })
    }
    return prepared.ref
  }

  private async readCosImage(ref: ImageAttachmentRef, key: string, origin: AttachmentReadOrigin, signal?: AbortSignal): Promise<StoredImageAttachment> {
    const credentials = await this.services.getCredentials()
    const cos = createCosClient(credentials)
    let data: Uint8Array
    try {
      const stream = cos.getObjectStream({
        Bucket: origin.bucket,
        Region: origin.region,
        Key: key,
        Range: `bytes=0-${ref.bytes - 1}`,
      }) as Readable
      data = await streamBytes(stream, ref.bytes, signal)
    } catch (error) {
      signal?.throwIfAborted()
      if (isCosNotFoundError(error)) throw error
      throw new AttachmentError('Unable to read image attachment from COS.', 'ATTACHMENT_READ_FAILED', { cause: error })
    }
    const digest = createHash('sha256').update(data).digest('hex')
    if (digest !== attachmentHash(ref)) {
      throw new AttachmentError('Stored COS attachment failed integrity verification.', 'ATTACHMENT_CORRUPT')
    }
    const prepared = await prepareImageFile({ data, mediaType: ref.mediaType, ...(ref.name === undefined ? {} : { name: ref.name }) }, this.imageLimits, this.normalizationPolicy)
    if (!verifiedReference(prepared, ref)) {
      throw new AttachmentError('Stored COS attachment metadata does not match its reference.', 'ATTACHMENT_CORRUPT')
    }
    return { ref, data }
  }
}

export default CosAttachmentStore
