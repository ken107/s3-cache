/// <reference types="node" />
import { S3, S3ClientConfig } from "@aws-sdk/client-s3";
export interface BinaryData {
    data: Buffer;
    metadata?: {
        [key: string]: string;
    };
}
export declare function throttle(fn: () => void, interval: number): () => void;
export interface BaseOptions {
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
        logger: {
            debug: Console["debug"];
            error: Console["error"];
        };
    };
}
export declare class Base {
    protected readonly opts: BaseOptions;
    protected readonly s3: S3;
    protected readonly throttledCleanup?: ReturnType<typeof throttle>;
    constructor(opts: BaseOptions);
    invalidate(cacheKey: string): Promise<void>;
    cleanup(): Promise<void>;
    private deleteObjects;
}
