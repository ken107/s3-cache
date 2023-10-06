import { Cache } from "multilayer-async-cache-builder";
import { Base, S3CacheEntry } from "./common";
export declare class S3Cache extends Base implements Cache<S3CacheEntry> {
    get(cacheKey: string): Promise<S3CacheEntry | undefined>;
    set(cacheKey: string, value: S3CacheEntry): Promise<void>;
}
