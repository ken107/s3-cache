import { S3, S3ClientConfig } from "@aws-sdk/client-s3";

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
      getLastAccessed(objKey: string): number|Promise<number>,
      setLastAccessed(objKey: string): void|Promise<void>,
      delete(objKeys: string[]): void|Promise<void>
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
      const objKeysToDelete: string[] = []
      for await (const obj of this.listObjects()) {
        let lastAccessed = await accessLog.getLastAccessed(obj.Key!)
        if (obj.LastModified) lastAccessed = Math.max(lastAccessed, obj.LastModified.getTime())
        if (lastAccessed + ttl < now) objKeysToDelete.push(obj.Key!)
      }
      await this.deleteObjects(objKeysToDelete)
      await accessLog.delete(objKeysToDelete)
    }
    catch (err) {
      console.error("Cleanup failed", err)
    }
  }

  private async *listObjects() {
    let ContinuationToken: string|undefined
    do {
      const result = await this.s3.listObjectsV2({
        Bucket: this.opts.bucket,
        Prefix: this.opts.prefix,
        ContinuationToken
      })
      if (result.Contents) yield* result.Contents
      ContinuationToken = result.NextContinuationToken
    }
    while (ContinuationToken)
  }

  private async deleteObjects(objKeys: string[]) {
    for (let i=0; i<objKeys.length; i+=1000) {
      const result = await this.s3.deleteObjects({
        Bucket: this.opts.bucket,
        Delete: {
          Objects: objKeys.slice(i, i+1000).map(objKey => ({Key: objKey})),
          Quiet: true
        }
      })
      if (result.Errors?.length)
        console.warn("Failed to delete", result.Errors.length, "objects")
    }
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
