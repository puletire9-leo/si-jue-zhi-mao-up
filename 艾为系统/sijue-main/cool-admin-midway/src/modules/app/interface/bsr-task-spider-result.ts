import {ProductInfoSpiderResult} from "./product-info-spider-result";

export interface BsrTaskSpiderResult {
  category: string;

  products_info: ProductInfoSpiderResult[];
}
