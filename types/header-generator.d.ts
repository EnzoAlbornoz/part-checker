declare module "header-generator" {
    interface BrowserSpecification {
        name: string;
        minVersion: number;
        maxVersion: number;
        httpVersion?: "1" | "2";
    }
    interface HeaderGeneratorOptions {
        browsers?: Array<BrowserSpecification | string>;
        operatingSystems?: Array<string>;
        devices?: Array<string>;
        locales?: Array<string>;
        httpVersion?: "1" | "2";
    }

    export default class HeaderGenerator {
        constructor(options?: HeaderGeneratorOptions);
        getHeaders(
            options?: HeaderGeneratorOptions,
            requestDependentHeaders?: Record<string, string>
        ): Record<string, string>;
        orderHeaders(
            headers: Record<string, string>,
            order: Array<string>
        ): Record<string, string>;
    }
}
