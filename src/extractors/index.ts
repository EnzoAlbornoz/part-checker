// Import Dependencies
import * as amz from "./amazon";
import * as neg from "./newegg";
import { Origin } from "../constants";
export const extractors = {
    [Origin.AMAZON]: amz,
    [Origin.NEWEGG]: neg,
};
export default extractors;
