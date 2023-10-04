"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Cache = void 0;
const common_1 = require("./common");
class S3Cache extends common_1.Base {
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
}
exports.S3Cache = S3Cache;
