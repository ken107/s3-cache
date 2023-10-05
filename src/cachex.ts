import { CacheX } from "multilayer-async-cache-builder";
import { Base, BaseInput } from "./common";

interface S3CacheXOutput {
  objKey: string
  contentType?: string
  contentLength: number
  metadata?: Record<string, string>
}


export class S3CacheX extends Base implements CacheX<BaseInput, S3CacheXOutput> {

  async get(cacheKey: string): Promise<S3CacheXOutput|undefined> {
    const objKey = (this.opts.prefix ?? "") + cacheKey
    try {
      const res = await this.s3.headObject({
        Bucket: this.opts.bucket,
        Key: objKey
      })
      await this.opts.cleanupOpts?.accessLog.setLastAccessed(objKey)
      return {
        objKey,
        contentType: res.ContentType,
        contentLength: res.ContentLength!,
        metadata: res.Metadata
      }
    }
    catch (err: any) {
      if (err.name == "NoSuchKey" || err.name == "NotFound") return undefined
      else throw err
    }
  }

  async set(cacheKey: string, value: BaseInput): Promise<S3CacheXOutput> {
    const objKey = (this.opts.prefix ?? "") + cacheKey
    await this.s3.putObject({
      Bucket: this.opts.bucket,
      Key: objKey,
      Body: value.data,
      ContentType: value.contentType,
      CacheControl: value.cacheControl,
      Metadata: value.metadata
    })
    this.throttledCleanup?.()
    return {
      objKey,
      contentType: value.contentType,
      contentLength: value.data.length,
      metadata: value.metadata
    }
  }
}
