import { Cache } from "multilayer-async-cache-builder";
import { Base, BaseInput } from "./common";
export declare class S3Cache extends Base implements Cache<BaseInput> {
    get(cacheKey: string): Promise<BaseInput | undefined>;
    set(cacheKey: string, value: BaseInput): Promise<void>;
}
