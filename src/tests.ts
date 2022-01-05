// Import Dependencies
import axios from "axios";
import cheerio from "cheerio";
import { writeFile } from "fs/promises";
import { Category } from "./constants";
import { getProductDetails, listCategoryProducts } from "./extractors/amazon";
import { AMAZON_URL } from "./extractors/amazon";
// Tests
(async function main() {
    // const { data: page } = await axios.get("b", {
    //     params: { node: 284822 },
    //     baseURL: AMAZON_URL,
    // });
    console.log("Requesting");
    const res = await listCategoryProducts(Category.GPU);
    const prods = await Promise.all(res.map(getProductDetails));
    console.log(prods);
    // await writeFile("result.json", JSON.stringify(prods));
})().then(process.exit.bind(process, 0));
