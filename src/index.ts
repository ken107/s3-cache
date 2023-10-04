import { S3, S3ClientConfig, _Object } from "@aws-sdk/client-s3";

interface BinaryData {
  data: Buffer;
  metadata?: {[key: string]: string};
}

interface S3CacheOptions {
  clientConfig: S3ClientConfig,
  bucket: string,
  prefix?: string,
  cleanupOpts?: {
    accessLog: {
      getLastAccessed(objKeys: string[]): Promise<number[]>,
      setLastAccessed(objKey: string): Promise<void>,
      delete(objKeys: string[]): Promise<void>
    },
    ttl: number,
    cleanupInterval: number
  }
}


export class S3Cache {
  private readonly s3: S3
  private readonly throttledCleanup?: ReturnType<typeof throttle>

  constructor(private readonly opts: S3CacheOptions) {
    this.s3 = new S3(opts.clientConfig)
    if (opts.cleanupOpts)
      this.throttledCleanup = throttle(() => this.cleanup(), opts.cleanupOpts.cleanupInterval)
  }

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

  async invalidate(cacheKey: string) {
    const objKey = (this.opts.prefix ?? "") + cacheKey
    await this.s3.deleteObject({
      Bucket: this.opts.bucket,
      Key: objKey
    })
  }

  private async cleanup() {
    try {
      //console.debug("Cleaning up", this.opts.bucket, this.opts.prefix)
      const {accessLog, ttl} = this.opts.cleanupOpts!
      const now = Date.now()
      let ContinuationToken: string|undefined
      do {
        const {Contents, NextContinuationToken} = await this.s3.listObjectsV2({
          Bucket: this.opts.bucket,
          Prefix: this.opts.prefix,
          ContinuationToken
        })
        if (Contents) {
          const lastAccessed = await accessLog.getLastAccessed(Contents.map(obj => obj.Key!))
          const expiredObjs = Contents
            .filter((obj, index) => Math.max(lastAccessed[index], obj.LastModified!.getTime()) + ttl < now)
          if (expiredObjs.length) {
            await accessLog.delete(expiredObjs.map(obj => obj.Key!))
            await this.deleteObjects(expiredObjs)
          }
        }
        ContinuationToken = NextContinuationToken
      }
      while (ContinuationToken)
    }
    catch (err) {
      console.error("Cleanup failed", err)
    }
  }

  private async deleteObjects(objs: _Object[]) {
    const {Errors} = await this.s3.deleteObjects({
      Bucket: this.opts.bucket,
      Delete: {
        Objects: objs.map(obj => ({Key: obj.Key})),
        Quiet: true
      }
    })
    if (Errors?.length)
      console.error("Failed to delete", Errors.length, "objects, first error", Errors[0])
  }
}



function throttle(fn: () => void, interval: number) {
  let last = Date.now()
  return function() {
    if (Date.now()-last >= interval) {
      last = Date.now()
      fn()
    }
  }
}
