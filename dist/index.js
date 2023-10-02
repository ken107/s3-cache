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
            const objKeysToDelete = [];
            for await (const obj of this.listObjects()) {
                let lastAccessed = await accessLog.getLastAccessed(obj.Key);
                if (obj.LastModified)
                    lastAccessed = Math.max(lastAccessed, obj.LastModified.getTime());
                if (lastAccessed + ttl < now)
                    objKeysToDelete.push(obj.Key);
            }
            await this.deleteObjects(objKeysToDelete);
            await accessLog.delete(objKeysToDelete);
        }
        catch (err) {
            console.error("Cleanup failed", err);
        }
    }
    async *listObjects() {
        let ContinuationToken;
        do {
            const result = await this.s3.listObjectsV2({
                Bucket: this.opts.bucket,
                Prefix: this.opts.prefix,
                ContinuationToken
            });
            if (result.Contents)
                yield* result.Contents;
            ContinuationToken = result.NextContinuationToken;
        } while (ContinuationToken);
    }
    async deleteObjects(objKeys) {
        for (let i = 0; i < objKeys.length; i += 1000) {
            const result = await this.s3.deleteObjects({
                Bucket: this.opts.bucket,
                Delete: {
                    Objects: objKeys.slice(i, i + 1000).map(objKey => ({ Key: objKey })),
                    Quiet: true
                }
            });
            if (result.Errors?.length)
                console.warn("Failed to delete", result.Errors.length, "objects");
        }
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
