/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VehicleCategory } from '../types/logistics';
import { VehicleTypeRules } from './phase1OperationalRulesEngine';

/**
 * vehicleCapacityEngine.ts
 * Araç tipleri, taşıma kapasiteleri ve varış/çıkış tesisi bazlı araç kısıtlarını denetleyen motor.
 * 
 * Kapasiteler (Bölüm 3):
 * - Kamyon: 12.500 desi
 * - TIR: 22.500 desi
 * - Panelvan / Kamyonet: 3.500 desi (Panelvan/kamyonet otomatik kamyon sayılmaz)
 * 
 * Kısıtlar (Bölüm 10):
 * - İzmir varışlı ve İzmir çıkışlı hatlarda YALNIZCA KAMYON (TIR Yasaktır).
 * - Bursa ve Kocaeli varışlı hatlarda YALNIZCA KAMYON.
 * - Marmara varışlı hatlarda yalnızca Avrupa çıkışlı TIR olabilir; diğer tüm hatlar KAMYON olmalıdır.
 * - Kayseri TIR yükleme sınırı 15.000 desidir (genel TIR kapasitesinden ayrı operasyon tavanıdır).
 */

export const VEHICLE_CAPACITIES: Record<VehicleCategory, number> = {
  KAMYON: 12500,
  TIR: 22500,
  PANELVAN: 3500,
  TANIMSIZ: 0,
};

export function getVehicleCapacityDesi(category: VehicleCategory, customPanelvanCapacity?: number): number {
  if (category === 'PANELVAN' && customPanelvanCapacity && customPanelvanCapacity > 0) {
    return customPanelvanCapacity;
  }
  return VEHICLE_CAPACITIES[category] ?? 12500;
}

export function isVehicleTypeAllowedOnLane(
  originId: string,
  destinationId: string,
  vehicleType: VehicleCategory
): boolean {
  if (VehicleTypeRules.isOriginKamyonOnly(originId) && vehicleType === 'TIR') {
    return false;
  }
  if (VehicleTypeRules.isDestinationKamyonOnly(originId, destinationId) && vehicleType === 'TIR') {
    return false;
  }
  return true;
}

export const VehicleCapacityEngine = {
  VEHICLE_CAPACITIES,
  getVehicleCapacityDesi,
  isVehicleTypeAllowedOnLane,
};
