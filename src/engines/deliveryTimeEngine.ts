/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DistanceMatrix, DeliveryEstimate } from '../types/logistics';
import {
  calculateDaysFromDistanceKm,
  calculateRouteDeliveryEstimate,
} from './distanceCalculationEngine';

/**
 * deliveryTimeEngine.ts
 * Mesafeye ve aktarma bekleme sürelerine göre teslimat sürelerini ve 1 günlük paketlerin
 * aynı gün sevk önceliklerini hesaplayan bağımsız teslimat süresi motoru.
 * 
 * Mesafe Kuralları (Bölüm 4):
 * - 0 - 600 km: 1 Gün
 * - 600,1 - 1.000 km: 2 Gün
 * - 1.000 km üzeri: 3 Gün
 * 
 * Sınır Değerleri:
 * - 600.0 km = 1 gün
 * - 600.1 km = 2 gün
 * - 1000.0 km = 2 gün
 * - 1000.1 km = 3 gün
 */

export function calculateDeliveryTimeByKm(km: number | null): {
  days: number | null;
  category: 1 | 2 | 3 | null;
  hasMissingDistance: boolean;
} {
  const days = calculateDaysFromDistanceKm(km);
  if (days === null) {
    return { days: null, category: null, hasMissingDistance: true };
  }
  const category: 1 | 2 | 3 = days >= 3 ? 3 : days === 2 ? 2 : 1;
  return { days, category, hasMissingDistance: false };
}

export function estimateRouteDeliveryWithLegs(params: {
  originId: string;
  destinationId: string;
  viaCrossDockId?: string | null;
  viaIntermediateHubId?: string | null;
  distanceMatrix: DistanceMatrix;
  crossDockHandlingHours?: number;
  departureTime?: string;
  isDirectRouteConnection?: boolean;
}): DeliveryEstimate {
  return calculateRouteDeliveryEstimate({
    ...params,
    crossDockHandlingHours: params.crossDockHandlingHours ?? 4,
    departureTime: params.departureTime ?? '21:30',
  });
}

export const DeliveryTimeEngine = {
  calculateDeliveryTimeByKm,
  estimateRouteDeliveryWithLegs,
};
