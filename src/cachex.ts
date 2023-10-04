import { CacheX } from "multilayer-async-cache-builder";
import { Base, BaseOptions, BinaryData } from "./common";

interface S3CacheXOptions extends BaseOptions {
  getDownloadUrl(objKey: string): string
}

interface S3CacheXOutput {
  downloadUrl: string
  metadata?: Record<string, string>
}


export class S3CacheX extends Base implements CacheX<BinaryData, S3CacheXOutput> {
  constructor(opts: S3CacheXOptions) {
    super(opts)
  }

  async get(cacheKey: string): Promise<S3CacheXOutput|undefined> {
    const objKey = (this.opts.prefix ?? "") + cacheKey
    try {
      const res = await this.s3.headObject({
        Bucket: this.opts.bucket,
        Key: objKey
      })
      await this.opts.cleanupOpts?.accessLog.setLastAccessed(objKey)
      return {
        downloadUrl: (this.opts as S3CacheXOptions).getDownloadUrl(objKey),
        metadata: res.Metadata
      }
    }
    catch (err: any) {
      if (err.name == "NoSuchKey" || err.name == "NotFound") return undefined
      else throw err
    }
  }

  async set(cacheKey: string, value: BinaryData): Promise<S3CacheXOutput> {
    const objKey = (this.opts.prefix ?? "") + cacheKey
    await this.s3.putObject({
      Bucket: this.opts.bucket,
      Key: objKey,
      Body: value.data,
      Metadata: value.metadata
    })
    this.throttledCleanup?.()
    return {
      downloadUrl: (this.opts as S3CacheXOptions).getDownloadUrl(objKey),
      metadata: value.metadata
    }
  }
}
