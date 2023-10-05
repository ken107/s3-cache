import { Cache } from "multilayer-async-cache-builder";
import { Base, BaseInput } from "./common";


export class S3Cache extends Base implements Cache<BaseInput> {

  async get(cacheKey: string): Promise<BaseInput|undefined> {
    const objKey = (this.opts.prefix ?? "") + cacheKey
    try {
      const res = await this.s3.getObject({
        Bucket: this.opts.bucket,
        Key: objKey
      })
      await this.opts.cleanupOpts?.accessLog.setLastAccessed(objKey)
      const content = await res.Body!.transformToByteArray()
      return {
        data: Buffer.from(content),
        contentType: res.ContentType,
        cacheControl: res.CacheControl,
        metadata: res.Metadata
      }
    }
    catch (err: any) {
      if (err.name == "NoSuchKey" || err.name == "NotFound") return undefined
      else throw err
    }
  }

  async set(cacheKey: string, value: BaseInput) {
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
  }
}
