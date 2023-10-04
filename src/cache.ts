import { Cache } from "multilayer-async-cache-builder";
import { Base, BinaryData } from "./common";


export class S3Cache extends Base implements Cache<BinaryData> {

  async get(cacheKey: string): Promise<BinaryData|undefined> {
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
        metadata: res.Metadata
      }
    }
    catch (err: any) {
      if (err.name == "NoSuchKey" || err.name == "NotFound") return undefined
      else throw err
    }
  }

  async set(cacheKey: string, value: BinaryData) {
    const objKey = (this.opts.prefix ?? "") + cacheKey
    await this.s3.putObject({
      Bucket: this.opts.bucket,
      Key: objKey,
      Body: value.data,
      Metadata: value.metadata
    })
    this.throttledCleanup?.()
  }
}
