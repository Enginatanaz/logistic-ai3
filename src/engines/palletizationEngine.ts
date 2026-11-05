/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * palletizationEngine.ts
 * Faz 2 – Bölüm 11: Paletleme Motoru
 *
 * Özel Durumlar:
 * 1. Ankara → Avrupa: Sabit araçlar yüklendikten sonra ~4.500 desi kalan paket varsa paletleme değerlendirilir.
 * 2. Ankara → Marmara: Sabit araçlar yüklendikten sonra ~4.500 desi kalan paket varsa paletleme değerlendirilir.
 * 3. Ankara → Kocaeli: 7.000 desi altındaki yük için paletleme değerlendirilir.
 *
 * Paletler yalnızca uygun Amazon aracında:
 * - Güzergâh uygunluğu
 * - Araç tipi (Amazon TIR / Kamyon)
 * - Boş kapasite kontrolü
 * - Teslimat süresi (SLA)
 * kontrollerinden sonra planlanır.
 *
 * Paletleme miktarı normal araç desisiyle karıştırılmaz; paletlenen desi ve palet adedi ayrıca raporlanır.
 */

import {
  DistanceMatrix,
  LoadedShipmentSegment,
  PalletizedAmazonInfo,
  PlannedVehicleLine,
  PlanRowStatus,
  VehicleCategory,
  VehicleRightType,
  VehicleScheduleType,
} from '../types/logistics';
import { calculateRouteDeliveryEstimate } from './distanceCalculationEngine';

export interface PalletizationDecision {
  shouldPalletize: boolean;
  palletDesi: number;
  palletCount: number;
  thresholdDesi: number;
  amazonVehicleType: VehicleCategory;
  reason: string;
  notes: string[];
}

/**
 * Standart bir paletin ortalama hacmi (desi cinsinden)
 */
export const DESI_PER_PALLET = 750;

/**
 * Paletleme karar eşiklerini denetler.
 */
export function evaluatePalletizationEligibility(params: {
  originId: string;
  destinationId: string;
  remainingDesi: number;
  isFixedVehicleCapacityExceeded?: boolean;
}): PalletizationDecision {
  const { originId, destinationId, remainingDesi, isFixedVehicleCapacityExceeded = true } = params;

  if (originId !== 'ANKARA TM') {
    return {
      shouldPalletize: false,
      palletDesi: 0,
      palletCount: 0,
      thresholdDesi: 0,
      amazonVehicleType: 'TIR',
      reason: 'Paletleme motoru yalnızca tanımlı Ankara TM hatlarında (Avrupa, Marmara, Kocaeli Amazon rotalarında) aktiftir.',
      notes: [],
    };
  }

  // Durum 1: Ankara -> Avrupa TM (~4.500 desi kalan yük)
  if (destinationId === 'AVRUPA TM') {
    const threshold = 4500;
    // 3.500 - 5.500 desi aralığı (~4.500 desi civarı)
    if (remainingDesi >= 3000 && remainingDesi <= 5500 && isFixedVehicleCapacityExceeded) {
      const palletCount = Math.max(1, Math.ceil(remainingDesi / DESI_PER_PALLET));
      return {
        shouldPalletize: true,
        palletDesi: remainingDesi,
        palletCount,
        thresholdDesi: threshold,
        amazonVehicleType: 'TIR',
        reason: `Ankara → Avrupa hattında sabit araçlar dolduktan sonra kalan ${remainingDesi.toLocaleString('tr-TR')} desi (~4.500 desi eşiği) Amazon TIR’ında paletli sevk olarak değerlendirildi.`,
        notes: [
          `Paletleme Kararı: ${remainingDesi.toLocaleString('tr-TR')} desi (${palletCount} Palet).`,
          `Taşıyıcı: Akşam Amazon TIR Seferi (Boş kapasite kontrolü yapıldı).`,
        ],
      };
    }
  }

  // Durum 2: Ankara -> Marmara TM (~4.500 desi kalan yük)
  if (destinationId === 'MARMARA TM') {
    const threshold = 4500;
    if (remainingDesi >= 3000 && remainingDesi <= 5500 && isFixedVehicleCapacityExceeded) {
      const palletCount = Math.max(1, Math.ceil(remainingDesi / DESI_PER_PALLET));
      return {
        shouldPalletize: true,
        palletDesi: remainingDesi,
        palletCount,
        thresholdDesi: threshold,
        amazonVehicleType: 'TIR',
        reason: `Ankara → Marmara hattında sabit araçlar dolduktan sonra kalan ${remainingDesi.toLocaleString('tr-TR')} desi (~4.500 desi eşiği) Amazon TIR’ında paletli sevk olarak değerlendirildi.`,
        notes: [
          `Paletleme Kararı: ${remainingDesi.toLocaleString('tr-TR')} desi (${palletCount} Palet).`,
          `Taşıyıcı: Akşam Amazon TIR Seferi (Marmara yönü).`,
        ],
      };
    }
  }

  // Durum 3: Ankara -> Kocaeli TM (< 7.000 desi yük)
  if (destinationId === 'KOCAELİ TM') {
    const threshold = 7000;
    if (remainingDesi > 0 && remainingDesi < 7000) {
      const palletCount = Math.max(1, Math.ceil(remainingDesi / DESI_PER_PALLET));
      return {
        shouldPalletize: true,
        palletDesi: remainingDesi,
        palletCount,
        thresholdDesi: threshold,
        amazonVehicleType: 'TIR',
        reason: `Ankara → Kocaeli hattında ${remainingDesi.toLocaleString('tr-TR')} desi yük 7.000 desi kamyon eşiğinin altında kaldığı için müstakil kamyon açılmayıp akşam Amazon TIR’ında paletleme değerlendirildi.`,
        notes: [
          `Paletleme Kararı: ${remainingDesi.toLocaleString('tr-TR')} desi < 7.000 d eşiği (${palletCount} Palet).`,
          `Taşıyıcı: XSA8 / Kocaeli Akşam Amazon TIR Seferi.`,
        ],
      };
    }
  }

  return {
    shouldPalletize: false,
    palletDesi: 0,
    palletCount: 0,
    thresholdDesi: 0,
    amazonVehicleType: 'TIR',
    reason: `Miktar (${remainingDesi.toLocaleString('tr-TR')} desi) veya güzergâh (${originId} → ${destinationId}) paletleme eşiklerine uymuyor.`,
    notes: [],
  };
}

/**
 * Paletlenen gönderi için bağımsız bir PlannedVehicleLine kaydı oluşturur.
 * Paletlenen yük normal araç yüküyle karıştırılmaz.
 */
export function createPalletizedAmazonVehicleLine(params: {
  originId: string;
  destinationId: string;
  segments: LoadedShipmentSegment[];
  decision: PalletizationDecision;
  distanceMatrix: DistanceMatrix;
  lineSeq?: number;
}): PlannedVehicleLine {
  const { originId, destinationId, segments, decision, distanceMatrix, lineSeq = 1 } = params;

  const totalDesi = segments.reduce((sum, s) => sum + s.desi, 0);
  const totalPackages = segments.reduce((sum, s) => sum + s.packages, 0);
  const capacityDesi = 22500; // Amazon TIR Kapasitesi

  const delivery = calculateRouteDeliveryEstimate({
    originId,
    destinationId,
    viaCrossDockId: null,
    distanceMatrix,
    crossDockHandlingHours: 4,
    departureTime: '22:00',
    isDirectRouteConnection: true,
  });

  const lineCode = `AMAZON-PLT-${originId.substring(0, 3)}-${destinationId.substring(0, 3)}-${lineSeq}`;
  const fillRate = Number(((totalDesi / capacityDesi) * 100).toFixed(1));

  const palletInfo: PalletizedAmazonInfo = {
    isAmazonVehicle: true,
    palletDesi: decision.palletDesi,
    decisionThresholdDesi: decision.thresholdDesi,
    explanation: decision.reason,
  };

  return {
    id: `LINE-${lineCode}`,
    lineCode,
    originFacilityId: originId,
    originFacilityName: originId,
    destinationFacilityId: destinationId,
    destinationFacilityName: `${destinationId} (Paletli Amazon Sevk)`,
    vehicleType: 'TIR',
    capacityDesi,
    totalDesi,
    totalPackages,
    fillRate,
    routeCategory: 'DIREKT',
    transportTypeLabel: 'Paletli Amazon TIR Seferi',
    vehicleQuotaType: 'SABIT_HAT_ARACI',
    vehicleQuotaLabel: 'Paletli Amazon Aracı',
    planStatus: 'PALETLI_AMAZON_SEVK',
    loadedSegments: segments,
    delivery,
    comparison: {
      changeType: 'OPTIMIZE_EDILDI',
      explanation: decision.reason,
    },
    notes: [
      `Paletleme Kararı: ${decision.reason}`,
      `Palet Sayısı: ${decision.palletCount} Palet · Palet Desisi: ${decision.palletDesi.toLocaleString('tr-TR')} desi.`,
      `Akşam Amazon TIR’ı ile doğrudan sevk edildi (Müstakil araç açılmadı).`,
    ],
    departureTime: '22:00',
    isFixedScheduleVehicle: false,
    vehicleScheduleType: 'PALETLI_AMAZON_ARACI',
    vehicleScheduleLabel: 'Paletli Amazon TIR Sevk',
    remainingCapacityDesi: Math.max(0, capacityDesi - totalDesi),
    localCollectionDesi: totalDesi,
    crossDockDesi: 0,
    isPalletized: true,
    palletizedInfo: palletInfo,
    planningJustification: decision.reason,
    sameDayPriorityEnforced: true,
  };
}

export const PalletizationEngine = {
  DESI_PER_PALLET,
  evaluatePalletizationEligibility,
  createPalletizedAmazonVehicleLine,
};
