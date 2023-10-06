import { CacheX } from "multilayer-async-cache-builder";
import { Base, S3CacheEntry } from "./common";
interface S3CacheXOutput {
    objKey: string;
    contentType?: string;
    contentLength: number;
    metadata?: Record<string, string>;
}
export declare class S3CacheX extends Base implements CacheX<S3CacheEntry, S3CacheXOutput> {
    get(cacheKey: string): Promise<S3CacheXOutput | undefined>;
    set(cacheKey: string, value: S3CacheEntry): Promise<S3CacheXOutput>;
}
export {};
