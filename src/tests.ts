// Import Dependencies
import axios from "axios";
import cheerio from "cheerio";
import { writeFile } from "fs/promises";
import { Category } from "./constants";
import { getProductDetails, listCategoryProducts } from "./extractors/amazon";
import { AMAZON_URL } from "./extractors/amazon";

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

// Tests
(async function main() {
    // const { data: page } = await axios.get("b", {
    //     params: { node: 284822 },
    //     baseURL: AMAZON_URL,
    // });
    console.log("Requesting");
    const res = await listCategoryProducts(Category.GPU);
    // const prods = await promiseAllInBatches(getProductDetails, res, 5, 1000);
    // const prods = await Promise.all(res.map(getProductDetails));
    const prods = await getProductDetails(res[0]);
    console.log(prods);
    // await writeFile("result.json", JSON.stringify(prods));
})().then(process.exit.bind(process, 0));
