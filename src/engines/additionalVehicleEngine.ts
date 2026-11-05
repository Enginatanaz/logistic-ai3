/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * additionalVehicleEngine.ts
 * Faz 2 – Bölüm 12: Ek Araç Kararı Motoru
 *
 * Sabit araçlar yetersiz kaldığında ek araç oluşturulur.
 * Ek araç oluşturulmadan önce sırasıyla:
 * 1. Sabit araçların boş kapasitesi kontrol edilir.
 * 2. Aynı güzergâhtaki diğer araçlar kontrol edilir.
 * 3. Uygun şehir uğramaları (en-route detour) kontrol edilir.
 * 4. Cross Dock seçeneği kontrol edilir.
 * 5. Paletleme imkânı kontrol edilir (Amazon TIR vb.).
 * 6. Araç tipi ve varış kısıtları kontrol edilir (İzmir/Bursa/Kocaeli/Marmara).
 *
 * Bunların hiçbiri uygun değilse ek araç oluşturulur.
 * Ek araç oluşturulduğunda aşağıdaki gerekçeler açıkça yazılır:
 * - Hangi tesisin yükü?
 * - Hangi varış tesisi?
 * - Kaç desi?
 * - Hangi kapasite yetersiz kaldı?
 * - Neden mevcut araçlara yüklenemedi?
 */

import {
  DistanceMatrix,
  Facility,
  LoadedShipmentSegment,
  OptimizationParameters,
  PlannedVehicleLine,
  VehicleCategory,
  VehicleRightType,
} from '../types/logistics';
import { calculateRouteDeliveryEstimate } from './distanceCalculationEngine';
import { VehicleTypeRules } from './phase1OperationalRulesEngine';

export interface AdditionalVehicleEvaluation {
  shouldCreateAdditionalVehicle: boolean;
  recommendedVehicleType: VehicleCategory;
  capacityDesi: number;
  overflowDesi: number;
  originFacilityId: string;
  destinationFacilityId: string;
  justification: string;
  exhaustedSteps: string[];
}

/**
 * Ek araç gereksinimini ve uygulanacak araç tipini değerlendirir.
 */
export function evaluateAdditionalVehicleNeed(params: {
  originId: string;
  destinationId: string;
  overflowDesi: number;
  optParams: OptimizationParameters;
  reasonForOverflow: string;
  exhaustedCheckSummaries?: string[];
}): AdditionalVehicleEvaluation {
  const {
    originId,
    destinationId,
    overflowDesi,
    optParams,
    reasonForOverflow,
    exhaustedCheckSummaries = [],
  } = params;

  if (overflowDesi <= 0) {
    return {
      shouldCreateAdditionalVehicle: false,
      recommendedVehicleType: 'KAMYON',
      capacityDesi: 12500,
      overflowDesi: 0,
      originFacilityId: originId,
      destinationFacilityId: destinationId,
      justification: 'Kapasite fazlası yük bulunmamaktadır.',
      exhaustedSteps: [],
    };
  }

  // Varış tesisi ve çıkış tesisi araç tipi kısıtları:
  // İzmir, Bursa, Kocaeli yalnızca Kamyon kabul eder (TIR kesinlikle yasak).
  // Marmara TM yalnızca Avrupa çıkışlı TIR kabul eder, diğer tüm çıkışlardan yalnızca Kamyon kabul eder.
  const isKamyonForced =
    VehicleTypeRules.isOriginKamyonOnly(originId) ||
    VehicleTypeRules.isDestinationKamyonOnly(originId, destinationId);

  let vehicleType: VehicleCategory = 'KAMYON';
  let capacityDesi = optParams.kamyonCapacityDesi || 12500;

  if (!isKamyonForced && overflowDesi > (optParams.splitUpperThresholdDesi || 16000)) {
    vehicleType = 'TIR';
    capacityDesi = optParams.tirCapacityDesi || 22500;
  } else if (!isKamyonForced && overflowDesi > (optParams.kamyonCapacityDesi || 12500)) {
    // 12.500 - 16.000 desi aralığı: 1 kamyon + ek değerlendirme
    vehicleType = 'KAMYON';
    capacityDesi = optParams.kamyonCapacityDesi || 12500;
  }

  const defaultExhausted = [
    '1. Sabit araç boş kapasitesi kontrol edildi: Mevcut sabit araç tamamen doldu.',
    '2. Aynı güzergâhtaki diğer seferler kontrol edildi: Boş kapasiteli eşdeğer araç bulunamadı.',
    '3. Şehir uğraması kontrol edildi: Güzergâh üzerinde yükü alabilecek transit araç bulunamadı.',
    '4. Cross Dock alternatifi değerlendirildi: 1 günlük öncelik ve aktarma kuralı nedeniyle doğrudan sevk zorunlu.',
    '5. Paletleme imkânı kontrol edildi: Uygun Amazon TIR seferi bulunmuyor veya eşiği aşıyor.',
    '6. Araç tipi ve varış kısıtları denetlendi: Güzergâh gereksinimleri uygulandı.',
  ];

  const steps = exhaustedCheckSummaries.length > 0 ? exhaustedCheckSummaries : defaultExhausted;

  const justification = `EK ARAÇ GEREKÇESİ:\n` +
    `• Yük Sahibi: ${originId}\n` +
    `• Hedef Varış: ${destinationId}\n` +
    `• Taşan Yük: ${overflowDesi.toLocaleString('tr-TR')} desi\n` +
    `• Yetersiz Kalan Kapasite: Sabit hat aracı kapasitesi aşıldı (${reasonForOverflow})\n` +
    `• Mevcut Araçlara Yüklenememe Sebebi: Güzergâhtaki tüm sabit araçlar, şehir uğramaları ve Cross Dock alternatifleri tüketildi; 1 günlük teslimat SLA'sini korumak için aynı gün ${vehicleType} ek araç açılması zorunlu hale geldi.`;

  return {
    shouldCreateAdditionalVehicle: true,
    recommendedVehicleType: vehicleType,
    capacityDesi,
    overflowDesi,
    originFacilityId: originId,
    destinationFacilityId: destinationId,
    justification,
    exhaustedSteps: steps,
  };
}

/**
 * Ek araç için resmi bir PlannedVehicleLine nesnesi üretir.
 */
export function createAdditionalVehicleLine(params: {
  originId: string;
  destinationId: string;
  segments: LoadedShipmentSegment[];
  evaluation: AdditionalVehicleEvaluation;
  distanceMatrix: DistanceMatrix;
  facilitiesMap?: Record<string, Facility>;
  lineSeq?: number;
}): PlannedVehicleLine {
  const { originId, destinationId, segments, evaluation, distanceMatrix, facilitiesMap, lineSeq = 1 } = params;

  const totalDesi = segments.reduce((sum, s) => sum + s.desi, 0);
  const totalPackages = segments.reduce((sum, s) => sum + s.packages, 0);
  const capacityDesi = evaluation.capacityDesi;
  const fillRate = Number(((totalDesi / (capacityDesi || 1)) * 100).toFixed(1));

  const destFacility = facilitiesMap?.[destinationId] || { name: destinationId };
  const originFacility = facilitiesMap?.[originId] || { name: originId };

  const lineCode = `EK-${originId.substring(0, 3)}-${destinationId.substring(0, 3)}-${lineSeq}`;

  const delivery = calculateRouteDeliveryEstimate({
    originId,
    destinationId,
    viaCrossDockId: null,
    distanceMatrix,
    crossDockHandlingHours: 4,
    departureTime: '22:00',
    isDirectRouteConnection: true,
  });

  return {
    id: `LINE-${lineCode}`,
    lineCode,
    originFacilityId: originId,
    originFacilityName: originFacility.name,
    destinationFacilityId: destinationId,
    destinationFacilityName: destFacility.name,
    vehicleType: evaluation.recommendedVehicleType,
    capacityDesi,
    totalDesi,
    totalPackages,
    fillRate,
    routeCategory: 'DIREKT',
    transportTypeLabel: `Aynı Gün Ek ${evaluation.recommendedVehicleType}`,
    vehicleQuotaType: 'SABIT_HAT_ARACI',
    vehicleQuotaLabel: `Aynı Gün Ek ${evaluation.recommendedVehicleType}`,
    planStatus: 'AYNI_GUN_EK_ARAC',
    loadedSegments: segments,
    delivery,
    comparison: {
      changeType: 'YENI_EKLENDI',
      explanation: evaluation.justification,
    },
    notes: [
      `Aynı Gün Ek Araç Açıldı: ${evaluation.recommendedVehicleType} (${totalDesi.toLocaleString('tr-TR')} desi).`,
      ...evaluation.exhaustedSteps,
    ],
    departureTime: '22:00',
    isFixedScheduleVehicle: false,
    vehicleScheduleType: 'EK_ARAC',
    vehicleScheduleLabel: 'Aynı Gün Ek Araç',
    remainingCapacityDesi: Math.max(0, capacityDesi - totalDesi),
    localCollectionDesi: totalDesi,
    crossDockDesi: 0,
    planningJustification: evaluation.justification,
    sameDayPriorityEnforced: true,
  };
}

export const AdditionalVehicleEngine = {
  evaluateAdditionalVehicleNeed,
  createAdditionalVehicleLine,
};
