/// <reference types="node" />
import { S3ClientConfig } from "@aws-sdk/client-s3";
interface BinaryData {
    data: Buffer;
    metadata?: {
        [key: string]: string;
    };
}
interface S3CacheOptions {
    clientConfig: S3ClientConfig;
    bucket: string;
    prefix?: string;
    cleanupOpts?: {
        accessLog: {
            getLastAccessed(objKeys: string[]): Promise<number[]>;
            setLastAccessed(objKey: string): Promise<void>;
            delete(objKeys: string[]): Promise<void>;
        };
        ttl: number;
        cleanupInterval: number;
    };
}
export declare class S3Cache {
    private readonly opts;
    private readonly s3;
    private readonly throttledCleanup?;
    constructor(opts: S3CacheOptions);
    get(cacheKey: string): Promise<BinaryData | undefined>;
    set(cacheKey: string, value: BinaryData): Promise<void>;
    invalidate(cacheKey: string): Promise<void>;
    private cleanup;
    private deleteObjects;
}
export {};
