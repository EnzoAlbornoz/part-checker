// Import Dependencies
import "dotenv/config";
import { Category, Origin } from "./constants";
import { getMongoDatabase, startMongoClient } from "./database/setup";

import dayjs from "dayjs";
import dayjsUtc from "dayjs/plugin/utc";
import extractors from "./extractors";
import { ChangeStreamDocument, Db } from "mongodb";
import { RateLimiter } from "limiter";
dayjs.extend(dayjsUtc);

/**
 * Same as Promise.all(items.map(item => task(item))), but it waits for
 * the first {batchSize} promises to finish before starting the next batch.
 */
async function promiseAllInBatches<A, B>(
    task: (arg0: A) => B,
    items: A[],
    batchSize: number,
    sleepTime = 0
): Promise<B[]> {
    let position = 0;
    let results: B[] = [];
    while (position < items.length) {
        console.debug(`Cursor at: ${position}`);
        const itemsForBatch = items.slice(position, position + batchSize);
        results = [
            ...results,
            ...(await Promise.all(itemsForBatch.map((item) => task(item)))),
        ];
        position += batchSize;
        if (sleepTime) {
            await sleep(sleepTime);
        }
    }
    return results;
}

function sleep(time: number) {
    return new Promise((res) => setTimeout(res, time));
}

// Execute Steps
async function executeSteps() {
    // Step 1 - Define what pages to check
    const db = await getMongoDatabase();
    console.info(
        `[${dayjs.utc().toISOString()}] [Step: 1] Mapping probing pages`
    );
    const pageIndexes = Object.fromEntries(
        await Promise.all(
            Object.values(Origin).map(async (origin) => [
                origin,
                Object.fromEntries(
                    await Promise.all(
                        Object.values(Category).map(async (category) => [
                            category,
                            await db
                                .collection<{ key: string; value: number }>(
                                    "page_probe_meta"
                                )
                                .findOne({
                                    key: `${origin}.${category}`,
                                })
                                .then((data) => (data?.value || -1) + 1),
                        ])
                    )
                ),
            ])
        )
    ) as Record<Origin, Record<Category, number>>;
    console.info(
        `[${dayjs.utc().toISOString()}] [Step: 1] Page indexes to probe: `,
        pageIndexes
    );
    // Executing List Probe
    await Promise.all(
        Object.values(Origin).map(async (origin) => {
            // Get Pages
            for (const category of Object.values(Category)) {
                const pageIndex = pageIndexes[origin][category];
                console.info(
                    `[${dayjs
                        .utc()
                        .toISOString()}] [Step: 1] [${origin}] [${category}] [${pageIndex}] Probing page...`
                );
                const pageIds = await extractors[origin].listCategoryProducts(
                    category,
                    false,
                    pageIndex
                );
                console.info(
                    `[${dayjs
                        .utc()
                        .toISOString()}] [Step: 1] [${origin}] [${category}] [${pageIndex}] Found ${[
                        pageIds.length,
                    ]} product ids`
                );
                console.info(
                    `[${dayjs
                        .utc()
                        .toISOString()}] [Step: 1] [${origin}] [${category}] [${pageIndex}] Persisting ids`
                );
                if (pageIds.length) {
                    await db.collection("product_meta").insertMany(
                        pageIds.map((id) => ({
                            productId: id,
                            origin,
                            category,
                        }))
                    );
                }
                // Update Index
                await db.collection("page_probe_meta").findOneAndUpdate(
                    {
                        key: `${origin}.${category}`,
                    },
                    [
                        {
                            $addFields: {
                                value: {
                                    $add: [{ $ifNull: ["$value", 0] }, 1],
                                },
                            },
                        },
                    ],
                    {
                        upsert: true,
                    }
                );
                console.info(
                    `[${dayjs
                        .utc()
                        .toISOString()}] [Step: 1] [${origin}] [${category}] [${pageIndex}] Done!`
                );
            }
        })
    );
}
// Call Timer
executeSteps();
setInterval(executeSteps, 10 * 60 * 1000);
// Define Rate-Limiters
const rateLimiters = Object.fromEntries(
    Object.values(Origin).map((origin) => [
        origin,
        new RateLimiter({
            tokensPerInterval: 1,
            interval: origin === Origin.AMAZON ? 2000 /* ms */ : "second",
        }),
    ])
) as Record<Origin, RateLimiter>;
// Step 2 - Extract Data
function handleProductInfoTrigger(db: Db) {
    db.collection("product_meta")
        .watch([{ $match: { operationType: "insert" } }])
        .on(
            "change",
            async (
                change: ChangeStreamDocument<{
                    productId: string;
                    origin: Origin;
                    category: Category;
                }>
            ) => {
                const productId = change.fullDocument?.productId as string;
                const origin = change.fullDocument?.origin as Origin;
                const category = change.fullDocument?.category as Category;
                console.info(
                    `[${dayjs
                        .utc()
                        .toISOString()}] [Step: 2] [${origin}] [${category}] [${productId}] Waiting for token...`
                );
                // Wait for token
                await rateLimiters[origin].removeTokens(1);
                console.info(
                    `[${dayjs
                        .utc()
                        .toISOString()}] [Step: 2] [${origin}] [${category}] [${productId}] Extracting product info...`
                );
                // Extract Data
                const productData = await extractors[origin].getProductDetails(
                    productId
                );
                console.info(
                    `[${dayjs
                        .utc()
                        .toISOString()}] [Step: 2] [${origin}] [${category}] [${productId}] Persisting data...`
                );
                // Persist Data
                db.collection("products").insertOne({
                    ...productData,
                    meta: {
                        created_at: new Date(),
                    },
                });
                console.info(
                    `[${dayjs
                        .utc()
                        .toISOString()}] [Step: 2] [${origin}] [${category}] [${productId}] Done!`
                );
            }
        );
}
getMongoDatabase().then(handleProductInfoTrigger);
