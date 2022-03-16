// Import Dependencies
import { Db, MongoClient } from "mongodb";
import { URL } from "url";
// Define Startup Function for database
let clientSingleton: MongoClient | null = null;

export async function startMongoClient() {
    // Fetch Env
    const {
        MONGO_HOST,
        MONGO_PORT,
        MONGO_INITDB_ROOT_USERNAME,
        MONGO_INITDB_ROOT_PASSWORD,
    } = process.env;
    // Create Client
    const serverUrl = `mongodb://${MONGO_HOST || "localhost"}:${
        MONGO_PORT || "27017"
    }`;
    const mongoClient = new MongoClient(serverUrl, {
        appName: "partChecker",
        authMechanism: "SCRAM-SHA-1",
        authSource: "admin",
        replicaSet: "rs0",
        auth: {
            username: MONGO_INITDB_ROOT_USERNAME,
            password: MONGO_INITDB_ROOT_PASSWORD,
        },
    });
    clientSingleton = await mongoClient.connect();
}

export async function getMongoClient() {
    if (clientSingleton === null) {
        await startMongoClient();
    }
    return clientSingleton as MongoClient;
}

export async function getMongoDatabase(databaseName?: string) {
    if (clientSingleton === null) {
        await startMongoClient();
    }
    return clientSingleton?.db(
        databaseName || process.env.MONGO_INITDB_DATABASE || "unnamed"
    ) as Db;
}
