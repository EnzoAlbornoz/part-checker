// Import Dependencies
import axios from "axios";
import cheerio from "cheerio";
import dayjs from "dayjs";
import { camelCase } from "change-case";
import { Category, INCHES_TO_METER, POUNDS_TO_KILOS } from "../constants";
import { HttpsProxyAgent } from "https-proxy-agent";
import { env } from "process";
import HeaderGenerator from "header-generator";
// Define Typings
export type ProductId = string;
export interface ProductDimensions {
    length: number;
    width: number;
    height: number;
}
export interface ProductInfo {
    url: string;
    id: ProductId;
    title: string;
    description: string;
    images: Array<string>;
    price?: number;
    available: boolean;
    shipsFrom: string;
    soldBy: string;
    technicalDetails: Record<string, string>;
    dimensions?: ProductDimensions;
    weight?: number;
    brand?: string;
    manufacturer?: string;
    model?: string;
    dateFirstAvailable?: Date;
    countryOfOrigin?: string;
}
// Define Constants
export const NEWEGG_URL = "https://newegg.com";
const nggClient = axios.create({
    baseURL: NEWEGG_URL,
    headers: {
        authority: "newegg.com",
        pragma: "no-cache",
        "cache-control": "no-cache",
        dnt: "1",
        "upgrade-insecure-requests": "1",
        "user-agent":
            "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "sec-fetch-site": "none",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        // Auto-Generated Headers
        ...new HeaderGenerator({
            browsers: ["chrome"],
            operatingSystems: ["windows"],
            locales: ["en-US", "en"],
        }).getHeaders(),
    },
    // httpsAgent: new HttpsProxyAgent({
    //     host: env.PROXY_HOST || "localhost",
    //     port: Number(env.PROXY_PORT || "8118"),
    // }),
});
// Define Mappings
const categoryMapping: Record<Category, number> = {
    CPU: 343,
    GPU: 48,
    MEM: 147,
};
// Define Interface Functions
export async function robotsInfo() {
    // Fetch Robots.TXT
}
export async function listCategoryProducts(
    category: Category,
    onlyWithPrice = false,
    paginationIndex = 1
): Promise<Array<ProductId>> {
    // Map Category
    const categoryId = categoryMapping[category];
    // Fetch Page
    const { data: page } = await nggClient.get<string>(
        `x/SubCategory/ID-${categoryId}/${
            paginationIndex > 1 ? `Page-${paginationIndex}` : ""
        }`
    );
    // Parse HTML
    const $ = cheerio.load(page);
    // Find List of Products Nodes
    const productsNodes = $(`.item-cell > .item-container`)
        .toArray()
        .filter((node) => !$(node).has(".item-sponsored-box").length);
    // Get Product Ids
    const ids = productsNodes
        .map(
            (node) =>
                $("a", node).first().attr("href")?.split("/").at(-1) || null
        )
        .filter((id): id is string => id !== null);
    // Return Product Ids
    return ids;
}

export async function getProductDetails(
    productId: ProductId
): Promise<ProductInfo> {
    // Fetch Page
    const { data: page } = await nggClient.get<string>(`x/p/${productId}`);
    // Parse HTML
    const $ = cheerio.load(page);
    // Get Title
    const productTitle = $(".product-title").text().trim();
    // Get Description
    const productDescription = $(".product-bullets > ul")
        .text()
        .trim()
        .replaceAll("\n", "")
        .replace(/\s\s+/g, " ");
    // Get Price
    const productPrice = $(`.price-current`)
        .first()
        .text()
        .trim()
        .replace("$", "")
        .replace(",", "");
    console.log(productPrice);
    // Get Availability
    const availabilityText = $(`.product-flag`).text().trim();
    const productAvailable = !/OUT OF STOCK/.test(availabilityText);
    // Get Ships From
    const productShipsFrom = (
        $(".product-pane .shipped-by-newegg").toArray().length
            ? $(".product-pane .shipped-by-newegg")
            : $(".product-pane .product-seller strong")
    )
        .first()
        .text()
        .replaceAll("\n", "")
        .replaceAll("\u200E", "")
        .replaceAll(/shipped by/gi, "")
        .trim();
    // Get Sold By
    const productSoldBy = $(`.product-pane .product-seller strong`)
        .first()
        .text()
        .replaceAll("\n", "")
        .replaceAll("\u200E", "")
        .trim();
    // Get Product Techical Attributes
    const specsTabIndex = $("#product-details > .tab-navs > .tab-nav")
        .toArray()
        .map((el) => $(el).text())
        .findIndex((txt) => txt.toLowerCase() === "specs");
    const {
        brand: productBrand,
        dateFirstAvailable,
        model: itemModelNumber,
        chipsetManufacturer,
        cardDimensionsLXH: dimensions,
        ...productTechnicalDetails
    } = Object.fromEntries(
        $(
            ".table-horizontal > tbody > tr",
            $("#product-details > .tab-panes > .tab-pane").toArray()[
                specsTabIndex
            ]
        )
            .toArray()
            .map((el) => [
                camelCase(
                    $("th", el)
                        .text()
                        .replaceAll("\n", "")
                        .replaceAll("\u200E", "")
                        .trim()
                        .toLowerCase()
                ),
                $("td", el)
                    .text()
                    .replaceAll("\n", " ")
                    .replaceAll("\u200E", "")
                    .trim(),
            ])
    );
    // Get Dimensions
    let productDimensions: ProductDimensions | undefined = undefined;
    if (dimensions) {
        const [l, h] = dimensions.replaceAll(`"`, "").split("x").map(Number);
        productDimensions = {
            length: l,
            height: h,
            width: 0,
        };
    }
    // Get Weight
    const productWeight: number | undefined = undefined;
    // Get Images
    const productImages = $(`.mainSlide .swiper-slide img`)
        .toArray()
        .map((img) => $(img).attr("src"))
        .filter((imgUrl): imgUrl is string => imgUrl !== undefined);
    // Get Country of Origin
    const countryOfOrigin = $(
        ".product-wrap .product-info-group .product-ship-from"
    )
        .first()
        .text()
        .replace(/ships from/i, "")
        .replace(".", "")
        .trim();
    // Build Final Payload
    const productInfo: ProductInfo = {
        url: new URL(`x/p/${productId}`, nggClient.defaults.baseURL).toString(),
        id: productId,
        title: productTitle,
        description: productDescription,
        images: productImages,
        price: Number(productPrice),
        available: productAvailable,
        shipsFrom: productShipsFrom,
        soldBy: productSoldBy,
        technicalDetails: productTechnicalDetails,
        dimensions: productDimensions,
        weight: productWeight,
        brand: productBrand,
        manufacturer: chipsetManufacturer,
        dateFirstAvailable: dateFirstAvailable
            ? dayjs(dateFirstAvailable).toDate()
            : undefined,
        countryOfOrigin,
        model: itemModelNumber,
    };
    // Return Product Data
    return productInfo;
}
// Define Helper Functions
// function parseProductInList(cheerioElement: Element) {}
