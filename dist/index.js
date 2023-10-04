"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Cache = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
class S3Cache {
    constructor(opts) {
        this.opts = opts;
        this.s3 = new client_s3_1.S3(opts.clientConfig);
        if (opts.cleanupOpts)
            this.throttledCleanup = throttle(() => this.cleanup(), opts.cleanupOpts.cleanupInterval);
    }
    async get(cacheKey) {
        const objKey = (this.opts.prefix ?? "") + cacheKey;
        try {
            const res = await this.s3.getObject({
                Bucket: this.opts.bucket,
                Key: objKey
            });
            await this.opts.cleanupOpts?.accessLog.setLastAccessed(objKey);
            const content = await res.Body.transformToByteArray();
            return {
                data: Buffer.from(content),
                metadata: res.Metadata
            };
        }
        catch (err) {
            if (err.name == "NoSuchKey" || err.name == "NotFound")
                return undefined;
            else
                throw err;
        }
    }
    async set(cacheKey, value) {
        const objKey = (this.opts.prefix ?? "") + cacheKey;
        await this.s3.putObject({
            Bucket: this.opts.bucket,
            Key: objKey,
            Body: value.data,
            Metadata: value.metadata
        });
        this.throttledCleanup?.();
    }
    async invalidate(cacheKey) {
        const objKey = (this.opts.prefix ?? "") + cacheKey;
        await this.s3.deleteObject({
            Bucket: this.opts.bucket,
            Key: objKey
        });
    }
    async cleanup() {
        try {
            //console.debug("Cleaning up", this.opts.bucket, this.opts.prefix)
            const { accessLog, ttl } = this.opts.cleanupOpts;
            const now = Date.now();
            let ContinuationToken;
            do {
                const { Contents, NextContinuationToken } = await this.s3.listObjectsV2({
                    Bucket: this.opts.bucket,
                    Prefix: this.opts.prefix,
                    ContinuationToken
                });
                if (Contents) {
                    const lastAccessed = await accessLog.getLastAccessed(Contents.map(obj => obj.Key));
                    const expiredObjs = Contents
                        .filter((obj, index) => Math.max(lastAccessed[index], obj.LastModified.getTime()) + ttl < now);
                    if (expiredObjs.length) {
                        await accessLog.delete(expiredObjs.map(obj => obj.Key));
                        await this.deleteObjects(expiredObjs);
                    }
                }
                ContinuationToken = NextContinuationToken;
            } while (ContinuationToken);
        }
        catch (err) {
            console.error("Cleanup failed", err);
        }
    }
    async deleteObjects(objs) {
        const { Errors } = await this.s3.deleteObjects({
            Bucket: this.opts.bucket,
            Delete: {
                Objects: objs.map(obj => ({ Key: obj.Key })),
                Quiet: true
            }
        });
        if (Errors?.length)
            console.error("Failed to delete", Errors.length, "objects, first error", Errors[0]);
    }
}
exports.S3Cache = S3Cache;
function throttle(fn, interval) {
    let last = Date.now();
    return function () {
        if (Date.now() - last >= interval) {
            last = Date.now();
            fn();
        }
    };
}
