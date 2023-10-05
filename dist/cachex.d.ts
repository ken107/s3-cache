import { CacheX } from "multilayer-async-cache-builder";
import { Base, BaseInput } from "./common";
interface S3CacheXOutput {
    objKey: string;
    contentType?: string;
    contentLength: number;
    metadata?: Record<string, string>;
}
export declare class S3CacheX extends Base implements CacheX<BaseInput, S3CacheXOutput> {
    get(cacheKey: string): Promise<S3CacheXOutput | undefined>;
    set(cacheKey: string, value: BaseInput): Promise<S3CacheXOutput>;
}
export {};
