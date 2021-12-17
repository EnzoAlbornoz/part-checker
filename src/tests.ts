// Import Dependencies
import axios from "axios";
import cheerio from "cheerio";
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
    const p1 = await getProductDetails(res[0]);
    console.log(p1);
})().then(process.exit.bind(process, 0));
