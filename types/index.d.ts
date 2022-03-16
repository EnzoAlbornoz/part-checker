import "./robots-txt-parser";
import "./header-generator";

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            MONGO_HOST?: string;
            MONGO_PORT?: string;
            MONGO_INITDB_ROOT_USERNAME?: string;
            MONGO_INITDB_ROOT_PASSWORD?: string;
            MONGO_INITDB_DATABASE?: string;
            PROXY_HOST?: string;
            PROXY_PORT?: string;
            QUEUE_CONCURRENCY?: string;
            QUEUE_NAME?: string;
            REDIS_HOST?: string;
            REDIS_PORT?: string;
        }
    }
}
