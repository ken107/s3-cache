import { CacheX } from "multilayer-async-cache-builder";
import { Base, BaseOptions, BinaryData } from "./common";
interface S3CacheXOptions extends BaseOptions {
    getDownloadUrl(objKey: string): string;
}
interface S3CacheXOutput {
    downloadUrl: string;
    metadata?: Record<string, string>;
}
export declare class S3CacheX extends Base implements CacheX<BinaryData, S3CacheXOutput> {
    constructor(opts: S3CacheXOptions);
    get(cacheKey: string): Promise<S3CacheXOutput | undefined>;
    set(cacheKey: string, value: BinaryData): Promise<S3CacheXOutput>;
}
export {};
