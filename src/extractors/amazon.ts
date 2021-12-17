// Import Dependencies
import axios from "axios";
import cheerio from "cheerio";
import { Category } from "../constants";
// Define Typings
export type ProductId = string;
export interface ProductInfo {
    url: string;
    id: ProductId;
    title: string;
    price?: number;
}
// Define Constants
export const AMAZON_URL = "https://www.amazon.com";
const amzClient = axios.create({
    baseURL: AMAZON_URL,
});
// Define Mappings
const categoryMapping: Record<Category, number> = {
    CPU: 0,
    GPU: 284822,
    MEM: 0,
};
// Define Interface Functions
export async function robotsInfo() {
    // Fetch Robots.TXT
}
export async function listCategoryProducts(
    category: Category,
    onlyWithPrice = false
): Promise<Array<ProductId>> {
    // Map Category
    const categoryId = categoryMapping[category];
    // Fetch Page
    const { data: page } = await amzClient.get<string>("b", {
        params: { node: categoryId },
    });
    // Parse HTML
    const $ = cheerio.load(page);
    // Find List of Products Nodes
    const productsNodes = $(`[data-component-type="s-search-result"]`)
        .toArray()
        .filter((node) => (!onlyWithPrice ? true : $(node).has(".a-price")));

    // Get Product Ids
    const ids = productsNodes.map((node) => node.attribs["data-asin"]);
    // Return Product Ids
    return ids;
}

export async function getProductDetails(
    productId: ProductId
): Promise<ProductInfo> {
    // Fetch Page
    const { data: page } = await amzClient.get<string>(`dp/${productId}`);
    // Parse HTML
    const $ = cheerio.load(page);
    // Get Title
    const productTitle = $("#productTitle").text().trim();
    // Get Price
    const productPrice = $(`.a-price > [aria-hidden="true"]`)
        .first()
        .text()
        .trim()
        .replace("$", "");
    // Build Final Payload
    const productInfo: ProductInfo = {
        url: new URL(`dp/${productId}`, amzClient.defaults.baseURL).toString(),
        id: productId,
        title: productTitle,
        price: Number(productPrice),
    };
    // Return Product Data
    return productInfo;
}
// Define Helper Functions
// function parseProductInList(cheerioElement: Element) {}
