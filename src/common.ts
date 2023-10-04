import { S3, S3ClientConfig, _Object } from "@aws-sdk/client-s3";

export interface BinaryData {
  data: Buffer;
  metadata?: {[key: string]: string};
}

export function throttle(fn: () => void, interval: number) {
  let last = Date.now()
  return function() {
    if (Date.now()-last >= interval) {
      last = Date.now()
      fn()
    }
  }
}

export interface BaseOptions {
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
    logger: {
      debug: Console["debug"]
      error: Console["error"]
    }
  }
}

export class Base {
  protected readonly s3: S3
  protected readonly throttledCleanup?: ReturnType<typeof throttle>

  constructor(protected readonly opts: BaseOptions) {
    this.s3 = new S3(opts.clientConfig)
    if (opts.cleanupOpts)
      this.throttledCleanup = throttle(() => this.cleanup(), opts.cleanupOpts.cleanupInterval)
  }

  async invalidate(cacheKey: string) {
    const objKey = (this.opts.prefix ?? "") + cacheKey
    await this.opts.cleanupOpts?.accessLog.delete([objKey])
    await this.s3.deleteObject({
      Bucket: this.opts.bucket,
      Key: objKey
    })
  }

  async cleanup() {
    const {accessLog, ttl, logger} = this.opts.cleanupOpts!
    const now = Date.now()
    logger.debug("Cleaning up", this.opts.bucket, this.opts.prefix, ttl)
    try {
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
            logger.debug("Found", expiredObjs.length, "expired objects in", Contents.length)
            await accessLog.delete(expiredObjs.map(obj => obj.Key!))
            await this.deleteObjects(expiredObjs, logger)
          }
        }
        ContinuationToken = NextContinuationToken
      }
      while (ContinuationToken)
    }
    catch (err) {
      logger.error("Cleanup failed", err)
    }
  }

  private async deleteObjects(objs: _Object[], logger: {error: Console["error"]}) {
    const {Errors} = await this.s3.deleteObjects({
      Bucket: this.opts.bucket,
      Delete: {
        Objects: objs.map(obj => ({Key: obj.Key})),
        Quiet: true
      }
    })
    if (Errors?.length)
      logger.error("Failed to delete", Errors.length, "objects, first error", Errors[0])
  }
}
