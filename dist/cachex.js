"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3CacheX = void 0;
const common_1 = require("./common");
class S3CacheX extends common_1.Base {
    constructor(opts) {
        super(opts);
    }
    async get(cacheKey) {
        const objKey = (this.opts.prefix ?? "") + cacheKey;
        try {
            const res = await this.s3.headObject({
                Bucket: this.opts.bucket,
                Key: objKey
            });
            await this.opts.cleanupOpts?.accessLog.setLastAccessed(objKey);
            return {
                downloadUrl: this.opts.getDownloadUrl(objKey),
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
        return {
            downloadUrl: this.opts.getDownloadUrl(objKey),
            metadata: value.metadata
        };
    }
}
exports.S3CacheX = S3CacheX;
