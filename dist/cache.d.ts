import { Cache } from "multilayer-async-cache-builder";
import { Base, BinaryData } from "./common";
export declare class S3Cache extends Base implements Cache<BinaryData> {
    get(cacheKey: string): Promise<BinaryData | undefined>;
    set(cacheKey: string, value: BinaryData): Promise<void>;
}
