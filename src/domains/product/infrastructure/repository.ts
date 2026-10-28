/**
 * PRODUCT DOMAIN: INFRASTRUCTURE REPOSITORY BINDING
 */

import { IProductRepository } from '../../../repositories/interfaces/IProductRepository';
import { productRepository as defaultProductRepo } from '../../../repositories/firebase/FirebaseProductRepository';

export type { IProductRepository };
export { defaultProductRepo };
