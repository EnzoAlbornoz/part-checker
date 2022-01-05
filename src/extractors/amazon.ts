// Import Dependencies
import axios from "axios";
import cheerio from "cheerio";
import dayjs from "dayjs";
import { camelCase } from "change-case";
import { Category, INCHES_TO_METER, POUNDS_TO_KILOS } from "../constants";
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
export const AMAZON_URL = "https://www.amazon.com";
const amzClient = axios.create({
    baseURL: AMAZON_URL,
    headers: {
        authority: "www.amazon.com",
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
    },
});
// Define Mappings
const categoryMapping: Record<Category, number> = {
    CPU: 229189,
    GPU: 284822,
    MEM: 172500,
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
    // Get Description
    const productDescription = $("#productDescription")
        .text()
        .trim()
        .replaceAll("\n", "")
        .replace(/\s\s+/g, " ");
    // Get Price
    const productPrice = $(`.a-price > [aria-hidden="true"]`)
        .first()
        .text()
        .trim()
        .replace("$", "");
    // Get Availability
    const availabilityText = $(`#availability`).text().trim();
    const productAvailable =
        /^(?:In Stock)|(?:Only \d* left in stock(?: - order soon.?)?)$/.test(
            availabilityText
        );
    // Get Ships From
    const productShipsFrom = $(
        `.tabular-buybox-text[tabular-attribute-name="Ships from"]`
    )
        .text()
        .replaceAll("\n", "")
        .replaceAll("\u200E", "")
        .trim();
    // Get Sold By
    const productSoldBy = $(
        `.tabular-buybox-text[tabular-attribute-name="Sold by"]`
    )
        .text()
        .replaceAll("\n", "")
        .replaceAll("\u200E", "")
        .trim();
    // Get Product Techical Attributes
    const {
        productDimensions: dimensionsProduct,
        packageDimensions: dimensionsPackage,
        itemDimensions: dimensionsItem,
        brand: productBrand,
        manufacturer: productManufacturer,
        countryOfOrigin,
        dateFirstAvailable,
        itemWeight,
        itemModelNumber,
        asin: _asin,
        itemDimensionsLxwxh: _itemDimensionsLxwxh,
        ...productTechnicalDetails
    } = Object.fromEntries(
        $(`[id^='productDetails_techSpec'] > tbody > tr`)
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
                    .replaceAll("\n", "")
                    .replaceAll("\u200E", "")
                    .trim(),
            ])
    );
    // Get Dimensions
    let productDimensions: ProductDimensions | undefined = undefined;
    const dimensionsArray = (
        dimensionsItem ||
        dimensionsProduct ||
        dimensionsPackage
    )
        ?.split("x")
        ?.flatMap((slice) => slice.trim().split(" "));
    if (dimensionsArray) {
        const [length, width, height, metric] = dimensionsArray;
        switch (metric) {
            case "inches":
                productDimensions = {
                    length: Number(length) * INCHES_TO_METER,
                    width: Number(width) * INCHES_TO_METER,
                    height: Number(height) * INCHES_TO_METER,
                };
                break;
            default:
                // Meters
                productDimensions = {
                    length: Number(length),
                    width: Number(width),
                    height: Number(height),
                };
                break;
        }
    }
    // Get Weight
    let productWeight: number | undefined = undefined;
    const weightArray = itemWeight?.split(" ");
    if (weightArray) {
        const [weight, metric] = weightArray;
        switch (metric) {
            case "pounds":
                productWeight = Number(weight) * POUNDS_TO_KILOS;
                break;
            default:
                // Kilos
                productWeight = Number(weight);
        }
    }
    // Get Images
    let productImages = $(`[class^="image item itemNo"] img`)
        .toArray()
        .map((img) => $(img).attr("src"))
        .filter((imgUrl): imgUrl is string => imgUrl !== undefined);
    try {
        // Fetch High Resolution Images
        const alternativeProductImages: string[] = JSON.parse(
            page
                .match(/'colorImages': ({ 'initial': \[.*\]}),/)
                ?.at(1)
                ?.replace("'initial'", `"initial"`) || "{}"
        )?.initial?.map(
            (imgMeta: { large: string; thumb: string; hiRes: string }) =>
                imgMeta.hiRes
        );
        productImages =
            alternativeProductImages.length >= productImages.length
                ? alternativeProductImages
                : productImages;
    } catch (error) {
        console.warn("Error while fetching hiResImages: ", error);
    }
    // Build Final Payload
    const productInfo: ProductInfo = {
        url: new URL(`dp/${productId}`, amzClient.defaults.baseURL).toString(),
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
        manufacturer: productManufacturer,
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
