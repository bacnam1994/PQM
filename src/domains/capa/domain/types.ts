/**
 * CAPA DOMAIN: TYPES
 */

import { QualityDeviation, CAPAActionItem, ElectronicSignature } from '../../../types';

export interface CreateCapaPlanDto {
  deviationId: string;
  actionType: 'CORRECTIVE' | 'PREVENTIVE';
  description: string;
  assignedTo: string;
  dueDate: string;
}

export type { QualityDeviation, CAPAActionItem, ElectronicSignature };
