/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DirectRouteConnection,
  DistanceMatrix,
  Facility,
  LoadedShipmentSegment,
  OptimizationParameters,
  PlannedVehicleLine,
  RouteWaypoint,
} from '../types/logistics';
import { calculateDaysFromDistanceKm } from './distanceCalculationEngine';

/**
 * Merkezi Yönlendirme Motoru Karar Adımları (7 Adımlı Kesin Sıralama):
 * 1. Doğrudan hat kontrolü
 * 2. Teslimat süresi kontrolü (1G / 2G / 3G)
 * 3. Sabit araç kontrolü
 * 4. Aynı güzergâhtaki araç kontrolü
 * 5. Güzergâh üzerinde uğrama kontrolü
 * 6. Özel operasyon kontrolü (Adana-Gaziantep, Aksaray CD, Gebze CD, vb.)
 * 7. Ek araç kontrolü
 */
export type CentralRoutingStepId =
  | 'ADIM_1_DOGRUDAN_HAT'
  | 'ADIM_2_TESLIMAT_SURESI'
  | 'ADIM_3_SABIT_ARAC'
  | 'ADIM_4_AYNI_GUZERGAH_ARAC'
  | 'ADIM_5_GUZERGAH_UGRAMASI'
  | 'ADIM_6_OZEL_OPERASYON_CD'
  | 'ADIM_7_EK_ARAC';

export interface WaypointCorridorDefinition {
  originId: string;
  mainDestinationId: string;
  waypointFacilityId: string;
  waypointFacilityName: string;
  extraKm: number;
  extraHours: number;
  corridorName: string;
  description: string;
}

/**
 * 19 Standart Tesis Arasında Otoyol ve Ana Ulaşım Koridoru Şehir Uğrama Haritası
 * (Tüm Türkiye genelinde geçerli merkezi güzergâh uğrama kuralları)
 */
export const UNIVERSAL_WAYPOINT_CORRIDORS: WaypointCorridorDefinition[] = [
  // Ankara Çıkışlı Koridorlar
  {
    originId: 'ANKARA TM',
    mainDestinationId: 'İZMİR TM',
    waypointFacilityId: 'AFYON TM',
    waypointFacilityName: 'Afyon TM',
    extraKm: 14,
    extraHours: 0.5,
    corridorName: 'Ankara - Afyon - İzmir Koridoru',
    description: 'Ankara’dan İzmir’e giden araç Afyon TM’ye uğrayarak teslimat yapabilir.',
  },
  {
    originId: 'ANKARA TM',
    mainDestinationId: 'ADANA TM',
    waypointFacilityId: 'AKSARAY TM',
    waypointFacilityName: 'Aksaray TM',
    extraKm: 12,
    extraHours: 0.5,
    corridorName: 'Ankara - Aksaray - Adana Koridoru',
    description: 'Ankara’dan Adana’ya giden araç Aksaray TM’ye uğrayabilir.',
  },
  {
    originId: 'ANKARA TM',
    mainDestinationId: 'SAMSUN TM',
    waypointFacilityId: 'MERZİFON TM',
    waypointFacilityName: 'Merzifon TM',
    extraKm: 16,
    extraHours: 0.5,
    corridorName: 'Ankara - Merzifon - Samsun Koridoru',
    description: 'Ankara’dan Samsun’a giden araç Merzifon TM’ye uğrayabilir.',
  },
  {
    originId: 'ANKARA TM',
    mainDestinationId: 'GAZİANTEP TM',
    waypointFacilityId: 'AKSARAY TM',
    waypointFacilityName: 'Aksaray TM',
    extraKm: 15,
    extraHours: 0.5,
    corridorName: 'Ankara - Aksaray - Gaziantep Koridoru',
    description: 'Ankara’dan Gaziantep’e giden araç Aksaray TM’ye uğrayabilir.',
  },

  // Avrupa TM Çıkışlı Koridorlar
  {
    originId: 'AVRUPA TM',
    mainDestinationId: 'MARMARA TM',
    waypointFacilityId: 'KOCAELİ TM',
    waypointFacilityName: 'Kocaeli TM',
    extraKm: 18,
    extraHours: 0.5,
    corridorName: 'Avrupa - Kocaeli - Marmara Koridoru',
    description: 'Avrupa TM’den Marmara TM’ye giden araç Kocaeli TM’ye uğrayabilir.',
  },
  {
    originId: 'AVRUPA TM',
    mainDestinationId: 'İZMİR TM',
    waypointFacilityId: 'BURSA TM',
    waypointFacilityName: 'Bursa TM',
    extraKm: 20,
    extraHours: 0.6,
    corridorName: 'Avrupa - Bursa - İzmir Koridoru',
    description: 'Avrupa TM’den İzmir’e giden araç Bursa TM üzerinden uğrama yapabilir.',
  },
  {
    originId: 'AVRUPA TM',
    mainDestinationId: 'BURSA TM',
    waypointFacilityId: 'KOCAELİ TM',
    waypointFacilityName: 'Kocaeli TM',
    extraKm: 15,
    extraHours: 0.5,
    corridorName: 'Avrupa - Kocaeli - Bursa Koridoru',
    description: 'Avrupa TM’den Bursa’ya giden araç Kocaeli TM’ye uğrayabilir.',
  },

  // Marmara TM Çıkışlı Koridorlar
  {
    originId: 'MARMARA TM',
    mainDestinationId: 'İZMİR TM',
    waypointFacilityId: 'BURSA TM',
    waypointFacilityName: 'Bursa TM',
    extraKm: 18,
    extraHours: 0.5,
    corridorName: 'Marmara - Bursa - İzmir Koridoru',
    description: 'Marmara TM’den İzmir’e giden araç Bursa TM’ye uğrayabilir.',
  },
  {
    originId: 'MARMARA TM',
    mainDestinationId: 'ADANA TM',
    waypointFacilityId: 'KOCAELİ TM',
    waypointFacilityName: 'Kocaeli TM',
    extraKm: 14,
    extraHours: 0.5,
    corridorName: 'Marmara - Kocaeli - Adana Koridoru',
    description: 'Marmara TM’den Adana’ya giden araç Kocaeli TM’ye uğrayabilir.',
  },
  {
    originId: 'MARMARA TM',
    mainDestinationId: 'GAZİANTEP TM',
    waypointFacilityId: 'KOCAELİ TM',
    waypointFacilityName: 'Kocaeli TM',
    extraKm: 14,
    extraHours: 0.5,
    corridorName: 'Marmara - Kocaeli - Gaziantep Koridoru',
    description: 'Marmara TM’den Gaziantep’e giden araç Kocaeli TM’ye uğrayabilir.',
  },

  // Bursa TM Çıkışlı Koridorlar
  {
    originId: 'BURSA TM',
    mainDestinationId: 'İZMİR TM',
    waypointFacilityId: 'AFYON TM',
    waypointFacilityName: 'Afyon TM',
    extraKm: 24,
    extraHours: 0.6,
    corridorName: 'Bursa - Afyon - İzmir Koridoru',
    description: 'Bursa TM’den İzmir’e giden araç Afyon TM’ye uğrayabilir.',
  },
  {
    originId: 'BURSA TM',
    mainDestinationId: 'ADANA TM',
    waypointFacilityId: 'AFYON TM',
    waypointFacilityName: 'Afyon TM',
    extraKm: 18,
    extraHours: 0.5,
    corridorName: 'Bursa - Afyon - Adana Koridoru',
    description: 'Bursa TM’den Adana’ya giden araç Afyon TM’ye uğrayabilir.',
  },

  // Adana TM Çıkışlı Koridorlar
  {
    originId: 'ADANA TM',
    mainDestinationId: 'DİYARBAKIR TM',
    waypointFacilityId: 'GAZİANTEP TM',
    waypointFacilityName: 'Gaziantep TM',
    extraKm: 15,
    extraHours: 0.5,
    corridorName: 'Adana - Gaziantep - Diyarbakır Koridoru',
    description: 'Adana TM’den Diyarbakır’a giden araç Gaziantep TM’ye uğrayabilir.',
  },

  // Gaziantep TM Çıkışlı Koridorlar
  {
    originId: 'GAZİANTEP TM',
    mainDestinationId: 'ERZURUM TM',
    waypointFacilityId: 'DİYARBAKIR TM',
    waypointFacilityName: 'Diyarbakır TM',
    extraKm: 20,
    extraHours: 0.6,
    corridorName: 'Gaziantep - Diyarbakır - Erzurum Koridoru',
    description: 'Gaziantep TM’den Erzurum’a giden araç Diyarbakır TM’ye uğrayabilir.',
  },

  // Konya TM Çıkışlı Koridorlar
  {
    originId: 'KONYA TM',
    mainDestinationId: 'İZMİR TM',
    waypointFacilityId: 'AFYON TM',
    waypointFacilityName: 'Afyon TM',
    extraKm: 16,
    extraHours: 0.5,
    corridorName: 'Konya - Afyon - İzmir Koridoru',
    description: 'Konya TM’den İzmir’e giden araç Afyon TM’ye uğrayabilir.',
  },
  {
    originId: 'KONYA TM',
    mainDestinationId: 'ADANA TM',
    waypointFacilityId: 'AKSARAY TM',
    waypointFacilityName: 'Aksaray TM',
    extraKm: 14,
    extraHours: 0.5,
    corridorName: 'Konya - Aksaray - Adana Koridoru',
    description: 'Konya TM’den Adana’ya giden araç Aksaray TM’ye uğrayabilir.',
  },

  // Samsun TM Çıkışlı Koridorlar
  {
    originId: 'SAMSUN TM',
    mainDestinationId: 'TRABZON TM',
    waypointFacilityId: 'MERZİFON TM',
    waypointFacilityName: 'Merzifon TM',
    extraKm: 14,
    extraHours: 0.5,
    corridorName: 'Samsun - Merzifon - Trabzon Koridoru',
    description: 'Samsun TM’den Trabzon’a giden araç Merzifon TM’ye uğrayabilir.',
  },

  // Erzurum TM Çıkışlı Koridorlar
  {
    originId: 'ERZURUM TM',
    mainDestinationId: 'VAN TM',
    waypointFacilityId: 'AĞRI TM',
    waypointFacilityName: 'Ağrı TM',
    extraKm: 15,
    extraHours: 0.5,
    corridorName: 'Erzurum - Ağrı - Van Koridoru',
    description: 'Erzurum TM’den Van’a giden araç yol üzerindeki Ağrı noktasına uğrayabilir.',
  },
];

export interface CentralRoutingDecisionStepResult {
  step: CentralRoutingStepId;
  stepName: string;
  checked: boolean;
  success: boolean;
  detail: string;
}

export interface CentralRoutingDecision {
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
  desi: number;
  packages: number;
  hasDirectRoute: boolean;
  deliveryDaysCategory: 1 | 2 | 3;
  directDays: number | null;
  directKm: number | null;
  finalStep: CentralRoutingStepId;
  allocatedAction:
    | 'SABIT_ARAC'
    | 'AYNI_GUZERGAH_ARAC'
    | 'GUZERGAH_UGRAMASI'
    | 'OZEL_OPERASYON'
    | 'AYNI_GUN_EK_ARAC'
    | 'CROSS_DOCK_KONSOLIDASYON';
  justification: string;
  stepsAudit: CentralRoutingDecisionStepResult[];
}

/**
 * Adım 4 Kontrolü: Aynı güzergâhtaki başka bir uygun araçta boş kapasite var mı?
 */
export function findSameLaneVehicleWithCapacity(
  originId: string,
  destinationId: string,
  requiredDesi: number,
  existingLines: PlannedVehicleLine[]
): PlannedVehicleLine | null {
  for (const line of existingLines) {
    if (line.originFacilityId === originId && line.destinationFacilityId === destinationId) {
      const remainingCap = line.capacityDesi - line.totalDesi;
      if (remainingCap >= requiredDesi) {
        return line;
      }
    }
  }
  return null;
}

/**
 * Adım 5 Kontrolü: Güzergâh üzerinde uğrama yapabilecek uygun bir araç var mı?
 * - Aynı çıkış tesisinden çıkan başka bir hat
 * - Hedef tesis aracın tanımlı ana güzergâhı üzerinde bulunuyor
 * - Aracın boş kapasitesi desiye yeterli
 * - Araç kapasitesi (Kamyon 12.500 / TIR 22.500) kesinlikle aşılmayacak
 * - Teslimat süresi (özellikle 1 günlük SLA) ihlal edilmeyecek
 * - Gerçek varış tesisi %100 korunacak
 */
export function findWaypointDetourVehicleWithCapacity(
  originId: string,
  targetDestinationId: string,
  requiredDesi: number,
  existingLines: PlannedVehicleLine[],
  deliveryDaysCategory: 1 | 2 | 3
): { line: PlannedVehicleLine; corridor: WaypointCorridorDefinition } | null {
  // İlgili hedefi waypoint kabul eden tanımlı koridorları filtrele
  const matchingCorridors = UNIVERSAL_WAYPOINT_CORRIDORS.filter(
    (c) => c.originId === originId && c.waypointFacilityId === targetDestinationId
  );

  if (matchingCorridors.length === 0) return null;

  for (const corridor of matchingCorridors) {
    // Bu koridorun ana varışına giden mevcut bir araç ara
    const candidateLine = existingLines.find(
      (l) =>
        l.originFacilityId === originId &&
        l.destinationFacilityId === corridor.mainDestinationId &&
        l.capacityDesi - l.totalDesi >= requiredDesi
    );

    if (candidateLine) {
      // 1 günlük paket ise ek süre teslimat SLA'sını aşmamalı (azami 1 gün teslimat)
      if (deliveryDaysCategory === 1) {
        const estDays = candidateLine.delivery?.totalEstimatedDays ?? candidateLine.delivery?.directDays ?? 1;
        if (estDays > 1) {
          continue; // Uğrama teslimat süresini 1 günün üzerine çıkarıyorsa uygun değil
        }
      }

      return { line: candidateLine, corridor };
    }
  }

  return null;
}

/**
 * Merkezi Yönlendirme Karar Motoru
 * Herhangi bir paket grubu için 1'den 7'ye kadar olan kontrol sırasını çalıştırır
 * ve gerekçeli denetim raporu üretir.
 */
export function evaluateUniversalRoutingDecision(params: {
  origin: Facility;
  destination: Facility;
  desi: number;
  packages: number;
  hasDirectRoute: boolean;
  directRouteConfig?: DirectRouteConnection;
  distanceMatrix: DistanceMatrix;
  optParams: OptimizationParameters;
  existingLines: PlannedVehicleLine[];
  isExplicitSpecialOperation?: boolean;
  specialOperationDetail?: string;
}): CentralRoutingDecision {
  const {
    origin,
    destination,
    desi,
    packages,
    hasDirectRoute,
    distanceMatrix,
    optParams,
    existingLines,
    isExplicitSpecialOperation = false,
    specialOperationDetail = '',
  } = params;

  const stepsAudit: CentralRoutingDecisionStepResult[] = [];
  const km = distanceMatrix[origin.id]?.[destination.id] ?? null;
  const directDays = calculateDaysFromDistanceKm(km);
  const deliveryDaysCategory: 1 | 2 | 3 = directDays && directDays >= 3 ? 3 : directDays === 2 ? 2 : 1;

  // --------------------------------------------------------------------------
  // ADIM 1: Doğrudan hat kontrolü
  // --------------------------------------------------------------------------
  stepsAudit.push({
    step: 'ADIM_1_DOGRUDAN_HAT',
    stepName: '1. Doğrudan Hat Kontrolü',
    checked: true,
    success: hasDirectRoute,
    detail: hasDirectRoute
      ? `${origin.name} → ${destination.name} arasında aktif tanımlı doğrudan hat bulunmaktadır.`
      : `${origin.name} → ${destination.name} arasında doğrudan hat tanımlı değildir.`,
  });

  // --------------------------------------------------------------------------
  // ADIM 2: Teslimat süresi kontrolü
  // --------------------------------------------------------------------------
  const isOneDaySla = deliveryDaysCategory === 1;
  stepsAudit.push({
    step: 'ADIM_2_TESLIMAT_SURESI',
    stepName: '2. Teslimat Süresi Kontrolü',
    checked: true,
    success: true,
    detail: `Mesafe: ${km ? `${km} km` : 'Tanımsız'} · Teslimat Süresi: ${deliveryDaysCategory} gün (${
      isOneDaySla
        ? '1 Günlük Paket: Aynı gün sevk edilmesi zorunludur; Cross Dock beklemesi veya erteleme yasaktır'
        : `${deliveryDaysCategory} Günlük Paket: Uygun Cross Dock merkezlerinde birleştirilebilir`
    }).`,
  });

  // --------------------------------------------------------------------------
  // ADIM 6 ÖNCELİKLİ İSTİSNA KONTROLÜ (Açıkça tanımlanmış özel operasyonlar):
  // "Açıkça tanımlanmış özel operasyon kuralları bu genel kuralın istisnasıdır.
  // Örneğin Adana–Gaziantep, Aksaray konsolidasyonu ve Gebze Cross Dock gibi kullanıcı tanımlı akışlar kendi kurallarına göre çalışır."
  // --------------------------------------------------------------------------
  if (isExplicitSpecialOperation) {
    stepsAudit.push({
      step: 'ADIM_6_OZEL_OPERASYON_CD',
      stepName: '6. Özel Operasyon Kontrolü',
      checked: true,
      success: true,
      detail: `Özel operasyon kuralı uygulandı: ${specialOperationDetail}`,
    });

    return {
      originId: origin.id,
      originName: origin.name,
      destinationId: destination.id,
      destinationName: destination.name,
      desi,
      packages,
      hasDirectRoute,
      deliveryDaysCategory,
      directDays,
      directKm: km,
      finalStep: 'ADIM_6_OZEL_OPERASYON_CD',
      allocatedAction: 'OZEL_OPERASYON',
      justification: `Açıkça tanımlanmış özel operasyon kuralı gereği ${specialOperationDetail} kapsamında yönlendirildi.`,
      stepsAudit,
    };
  }

  // --------------------------------------------------------------------------
  // ADIM 3: Sabit araç kontrolü
  // --------------------------------------------------------------------------
  if (hasDirectRoute) {
    stepsAudit.push({
      step: 'ADIM_3_SABIT_ARAC',
      stepName: '3. Sabit Araç Kontrolü',
      checked: true,
      success: true,
      detail: `${origin.name} → ${destination.name} doğrudan hattında sabit araç planlanır. Kapasite dolarsa alternatif aramaya geçilir.`,
    });
  } else {
    stepsAudit.push({
      step: 'ADIM_3_SABIT_ARAC',
      stepName: '3. Sabit Araç Kontrolü',
      checked: true,
      success: false,
      detail: `Doğrudan hat tanımlı olmadığından sabit hat aracı tahsis edilmedi.`,
    });
  }

  // --------------------------------------------------------------------------
  // ADIM 4: Aynı güzergâhtaki araç kontrolü
  // --------------------------------------------------------------------------
  const sameLaneVehicle = findSameLaneVehicleWithCapacity(origin.id, destination.id, desi, existingLines);
  stepsAudit.push({
    step: 'ADIM_4_AYNI_GUZERGAH_ARAC',
    stepName: '4. Aynı Güzergâhtaki Araç Kontrolü',
    checked: true,
    success: Boolean(sameLaneVehicle),
    detail: sameLaneVehicle
      ? `Aynı güzergâhtaki ${sameLaneVehicle.lineCode} aracında ${desi.toLocaleString('tr-TR')} desi için yeterli boş kapasite bulundu (${(
          sameLaneVehicle.capacityDesi - sameLaneVehicle.totalDesi
        ).toLocaleString('tr-TR')} d boş).`
      : `Aynı gün aynı hatta yeterli boş kapasiteye sahip başka bir araç bulunamadı.`,
  });

  if (sameLaneVehicle) {
    return {
      originId: origin.id,
      originName: origin.name,
      destinationId: destination.id,
      destinationName: destination.name,
      desi,
      packages,
      hasDirectRoute,
      deliveryDaysCategory,
      directDays,
      directKm: km,
      finalStep: 'ADIM_4_AYNI_GUZERGAH_ARAC',
      allocatedAction: 'AYNI_GUZERGAH_ARAC',
      justification: `Bölüm 1.1 / Adım 4: Aynı gün aynı güzergâha giden ${sameLaneVehicle.lineCode} aracının boş kapasitesine yüklendi.`,
      stepsAudit,
    };
  }

  // --------------------------------------------------------------------------
  // ADIM 5: Güzergâh üzerinde uğrama kontrolü
  // --------------------------------------------------------------------------
  const waypointMatch = findWaypointDetourVehicleWithCapacity(
    origin.id,
    destination.id,
    desi,
    existingLines,
    deliveryDaysCategory
  );

  stepsAudit.push({
    step: 'ADIM_5_GUZERGAH_UGRAMASI',
    stepName: '5. Güzergâh Üzerinde Uğrama Kontrolü',
    checked: true,
    success: Boolean(waypointMatch),
    detail: waypointMatch
      ? `${waypointMatch.corridor.corridorName} üzerinde hareket eden ${waypointMatch.line.lineCode} aracında yeterli kapasite bulundu (+${waypointMatch.corridor.extraKm} km, +${waypointMatch.corridor.extraHours} sa).`
      : `Hedef şehre makul sapmayla uğrama yapabilecek uygun kapasiteli bir güzergâh aracı bulunamadı.`,
  });

  if (waypointMatch) {
    return {
      originId: origin.id,
      originName: origin.name,
      destinationId: destination.id,
      destinationName: destination.name,
      desi,
      packages,
      hasDirectRoute,
      deliveryDaysCategory,
      directDays,
      directKm: km,
      finalStep: 'ADIM_5_GUZERGAH_UGRAMASI',
      allocatedAction: 'GUZERGAH_UGRAMASI',
      justification: `Bölüm 1.2 / Adım 5: ${waypointMatch.corridor.corridorName} kapsamında ${waypointMatch.line.lineCode} aracına şehir uğraması olarak yüklendi (+${waypointMatch.corridor.extraKm} km ek mesafe). Gerçek varış korundu.`,
      stepsAudit,
    };
  }

  // --------------------------------------------------------------------------
  // ADIM 6: Özel operasyon ve Cross Dock uygunluğu kontrolü
  // --------------------------------------------------------------------------
  const isEligibleCrossDock =
    !hasDirectRoute &&
    deliveryDaysCategory >= 2 &&
    origin.id !== 'ANKARA TM' &&
    destination.id !== 'ANKARA TM';

  stepsAudit.push({
    step: 'ADIM_6_OZEL_OPERASYON_CD',
    stepName: '6. Özel Operasyon / Cross Dock Kontrolü',
    checked: true,
    success: isEligibleCrossDock,
    detail: isEligibleCrossDock
      ? `Doğrudan hat bulunmayan ${deliveryDaysCategory} günlük paket grubu yetkili Cross Dock merkezinde konsolidasyon için uygundur.`
      : hasDirectRoute
      ? `Doğrudan hat tanımlı olduğundan araç doluluğu nedeniyle Cross Dock’a saptırılamaz.`
      : `1 günlük teslimat SLA zorunluluğu nedeniyle Cross Dock aktarmasına bırakılamaz.`,
  });

  if (isEligibleCrossDock) {
    return {
      originId: origin.id,
      originName: origin.name,
      destinationId: destination.id,
      destinationName: destination.name,
      desi,
      packages,
      hasDirectRoute,
      deliveryDaysCategory,
      directDays,
      directKm: km,
      finalStep: 'ADIM_6_OZEL_OPERASYON_CD',
      allocatedAction: 'CROSS_DOCK_KONSOLIDASYON',
      justification: `Doğrudan hattı bulunmayan ${deliveryDaysCategory} günlük paket grubu yetkili Cross Dock merkezinde konsolide edilmek üzere yönlendirildi.`,
      stepsAudit,
    };
  }

  // --------------------------------------------------------------------------
  // ADIM 7: Ek araç kontrolü (Aynı gün ek araç tahsisi)
  // --------------------------------------------------------------------------
  stepsAudit.push({
    step: 'ADIM_7_EK_ARAC',
    stepName: '7. Ek Araç Kontrolü',
    checked: true,
    success: true,
    detail: isOneDaySla
      ? `1 günlük teslimat zorunluluğu ve doğrudan hat önceliği gereği ertelenemez; tesisten aynı gün 22:45 çıkışlı ek araç oluşturulur.`
      : `Tanımlı doğrudan hat paketlerinin Cross Dock’a saptırılmaması için aynı gün ek araç planlanır.`,
  });

  return {
    originId: origin.id,
    originName: origin.name,
    destinationId: destination.id,
    destinationName: destination.name,
    desi,
    packages,
    hasDirectRoute,
    deliveryDaysCategory,
    directDays,
    directKm: km,
    finalStep: 'ADIM_7_EK_ARAC',
    allocatedAction: 'AYNI_GUN_EK_ARAC',
    justification: isOneDaySla
      ? `Bölüm 1.1 & 1.3: 1 günlük paketler ertesi güne veya Cross Dock beklemesine bırakılamayacağından aynı gün ek araç tahsis edildi.`
      : `Merkezi Yönlendirme Kuralı: Doğrudan hattı bulunan paketler yalnızca araç doluluğu nedeniyle Cross Dock’a saptırılamayacağından aynı gün ek araç oluşturuldu.`,
    stepsAudit,
  };
}
