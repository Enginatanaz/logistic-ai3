/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * generalDispatchAndFillRateEngine.ts
 * YENİ FAZ 1 – GENEL SEVK, ARAÇ DOLULUK VE ÇIKIŞ KRİTERLERİ
 *
 * Temel Kurallar:
 * 1. %90 Araç Doluluk Kuralı:
 *    Bir hatta ikinci araç çıkışı verilmeden önce ilk aracın en az %90 doluluğa ulaşması gerekir.
 *    - Kamyon (12.500 desi): %90 = 11.250 desi.
 *    - TIR (22.500 desi): %90 = 20.250 desi.
 *    - Panelvan / Kamyonet (4.500 desi): %90 = 4.050 desi.
 *    - İstisna: 1 günlük teslimat SLA'sini tehlikeye atan durumlarda aynı gün sevkiyat istisnası.
 * 2. Araç Çıkış Eşiği ve %90 Kuralı Ayrımı:
 *    - Minimum çıkış eşiği: İlk aracın çıkabilmesi için gereken asgari yük.
 *    - %90 kuralı: 2. ve sonraki araçların çıkış koşulu.
 *    - Sabit araç adedi otomatik çıkış anlamına gelmez.
 * 3. Tesis Bağlantıları (Operasyonel Bağlılık):
 *    - Trabzon paketleri Samsun operasyonuna bağlıdır (gerçek varış Trabzon korunur).
 *    - Van paketleri Erzurum operasyonuna bağlıdır (gerçek varış Van korunur).
 * 4. Aksaray Araç Çıkış Kuralı:
 *    - Aksaray TM, sabit araçlar dışında bağımsız Kamyon veya TIR oluşturmaz.
 *    - Kalan tüm paketler Ankara'ya 1 kamyonet (maksimum 4.500 desi) ile sevk edilir.
 *    - 4.500 desiyi aşan yük açıkta gösterilir ve kullanıcı onayı istenir.
 * 5. Diyarbakır → Erzurum Panelvan Kuralı:
 *    - Diyarbakır Erzurum paketleri + Gaziantep'ten aktarılan 2.500 desi Erzurum paketi
 *      tek bir 4.500 desilik panelvanda birleştirilir. Kamyon veya TIR oluşturulmaz.
 * 6. 10 Adımlı Araç Çıkış Kontrol Sırası:
 *    Tüm hatlar için hiyerarşik 10 adım uygulanır ve denetim kayıtları saklanır.
 */

import { VehicleCategory } from '../types/logistics';

export const GENERAL_DISPATCH_CONSTANTS = {
  KAMYON_CAPACITY: 12500,
  KAMYON_90_PERCENT_THRESHOLD: 11250, // 12.500 * 0.90
  TIR_CAPACITY: 22500,
  TIR_90_PERCENT_THRESHOLD: 20250, // 22.500 * 0.90
  SPECIAL_PANELVAN_CAPACITY: 4500,
  SPECIAL_PANELVAN_90_PERCENT_THRESHOLD: 4050, // 4.500 * 0.90
  GAZIANTEP_ERZURUM_TRANSFER_DESI: 2500,
  AKSARAY_ANKARA_KAMYONET_CAPACITY: 4500,
  OPERATIONAL_AFFILIATIONS: {
    'TRABZON TM': 'SAMSUN TM',
    'VAN TM': 'ERZURUM TM',
  } as Record<string, string>,
};

export type SecondVehicleDepartureStatus =
  | 'CIKIS_VERILDI'
  | 'CIKIS_VERILMEDI_90_KURALI'
  | 'SLA_ISTISNASI_ILE_CIKIS'
  | 'IKINCI_ARAC_YOK';

export interface LaneDispatchAuditRecord {
  laneKey: string;
  routeLabel: string;
  originFacilityId: string;
  destinationFacilityId: string;
  dailyTotalDesi: number;
  dailyTotalPackages: number;

  // 1. Araç Değerlendirmesi
  firstVehicleType: VehicleCategory;
  firstVehicleCapacity: number;
  firstVehicleLoad: number;
  firstVehicleFillRate: number;
  firstVehicle90PercentThreshold: number;
  firstVehicleReached90Percent: boolean;
  firstVehicleDispatched: boolean;
  minimumDepartureThreshold: number;

  // 2. Araç Değerlendirmesi
  hasSecondVehicleDefined: boolean;
  secondVehicleNeeded: boolean;
  secondVehicleDepartureStatus: SecondVehicleDepartureStatus;
  secondVehicleType?: VehicleCategory;
  secondVehicleCapacity?: number;
  secondVehicleLoad: number;
  secondVehicleFillRate: number;

  // Çıktı ve Kalanlar
  remainingDesi: number;
  exceptionReason: string;
  isSlaExceptionApplied: boolean;
  tenStepAuditLog: string[];
}

/**
 * Araç tipine ve kapasiteye göre %90 doluluk eşiğini hesaplar.
 */
export function calculate90PercentThreshold(capacityDesi: number, vehicleType?: VehicleCategory): number {
  if (capacityDesi === 12500 || vehicleType === 'KAMYON') {
    return GENERAL_DISPATCH_CONSTANTS.KAMYON_90_PERCENT_THRESHOLD;
  }
  if (capacityDesi === 22500 || vehicleType === 'TIR') {
    return GENERAL_DISPATCH_CONSTANTS.TIR_90_PERCENT_THRESHOLD;
  }
  if (capacityDesi === 4500 || vehicleType === 'PANELVAN') {
    return GENERAL_DISPATCH_CONSTANTS.SPECIAL_PANELVAN_90_PERCENT_THRESHOLD;
  }
  return Math.round(capacityDesi * 0.9);
}

/**
 * 10 Adımlı Araç Çıkış Kontrol Sırasını Uygular (Bölüm 8)
 */
export function evaluate10StepDispatchSequence(params: {
  originId: string;
  destinationId: string;
  routeLabel: string;
  dailyTotalDesi: number;
  dailyTotalPackages?: number;
  firstVehicleType: VehicleCategory;
  firstVehicleCapacity?: number;
  hasSecondVehicleDefined: boolean;
  secondVehicleType?: VehicleCategory;
  secondVehicleCapacity?: number;
  minimumDepartureThreshold?: number;
  isOneDaySlaRisk?: boolean;
  canConsolidateCrossDock?: boolean;
  canUseOtherVehicles?: boolean;
}): LaneDispatchAuditRecord {
  const {
    originId,
    destinationId,
    routeLabel,
    dailyTotalDesi,
    dailyTotalPackages = Math.max(1, Math.round(dailyTotalDesi / 3.74)),
    firstVehicleType,
    firstVehicleCapacity = firstVehicleType === 'TIR'
      ? GENERAL_DISPATCH_CONSTANTS.TIR_CAPACITY
      : firstVehicleType === 'PANELVAN'
      ? GENERAL_DISPATCH_CONSTANTS.SPECIAL_PANELVAN_CAPACITY
      : GENERAL_DISPATCH_CONSTANTS.KAMYON_CAPACITY,
    hasSecondVehicleDefined,
    secondVehicleType = firstVehicleType,
    secondVehicleCapacity = secondVehicleType === 'TIR'
      ? GENERAL_DISPATCH_CONSTANTS.TIR_CAPACITY
      : secondVehicleType === 'PANELVAN'
      ? GENERAL_DISPATCH_CONSTANTS.SPECIAL_PANELVAN_CAPACITY
      : GENERAL_DISPATCH_CONSTANTS.KAMYON_CAPACITY,
    minimumDepartureThreshold = 0,
    isOneDaySlaRisk = false,
    canConsolidateCrossDock = false,
    canUseOtherVehicles = false,
  } = params;

  const log: string[] = [];

  // Adım 1 & 2 & 3: Sabit araç var mı, araç tipi nedir, kapasitesi nedir?
  log.push(`1. Sabit Araç: Tanımlı (${firstVehicleType})`);
  log.push(`2. Araç Tipi: ${firstVehicleType}`);
  log.push(`3. Araç Kapasitesi: ${firstVehicleCapacity.toLocaleString('tr-TR')} desi`);

  // Adım 4: Hatta özel minimum çıkış desisi var mı?
  log.push(
    minimumDepartureThreshold > 0
      ? `4. Minimum Çıkış Eşiği: ${minimumDepartureThreshold.toLocaleString('tr-TR')} desi tanımlı.`
      : `4. Minimum Çıkış Eşiği: Genel kural (Tanımlı eşik yok).`
  );

  // Adım 5: İlk araç ne kadar dolu?
  const first90Threshold = calculate90PercentThreshold(firstVehicleCapacity, firstVehicleType);
  const firstLoad = Math.min(dailyTotalDesi, firstVehicleCapacity);
  const firstFillRate = Number(((firstLoad / firstVehicleCapacity) * 100).toFixed(1));
  const firstReached90 = firstLoad >= first90Threshold;
  const firstDispatched = dailyTotalDesi >= minimumDepartureThreshold && dailyTotalDesi > 0;

  log.push(
    `5. İlk Araç Yükü: ${firstLoad.toLocaleString('tr-TR')} desi (%${firstFillRate} doluluk · %90 Eşiği: ${first90Threshold.toLocaleString('tr-TR')} desi)`
  );

  // Adım 6: İkinci araç ihtiyacı var mı?
  const excessAfterFirst = Math.max(0, dailyTotalDesi - firstLoad);
  const secondNeeded = excessAfterFirst > 0;
  log.push(
    secondNeeded
      ? `6. İkinci Araç İhtiyacı: VAR (${excessAfterFirst.toLocaleString('tr-TR')} desi taştı).`
      : `6. İkinci Araç İhtiyacı: YOK (Taşan yük bulunmamaktadır).`
  );

  // Adım 7: İlk araç %90 doluluğa ulaştı mı?
  log.push(
    firstReached90
      ? `7. %90 Doluluk Şartı: SAĞLANDI (${firstLoad.toLocaleString('tr-TR')} >= ${first90Threshold.toLocaleString('tr-TR')} desi).`
      : `7. %90 Doluluk Şartı: SAĞLANAMADI (${firstLoad.toLocaleString('tr-TR')} < ${first90Threshold.toLocaleString('tr-TR')} desi).`
  );

  // Adım 8 & 9: Kalan paketler başka uygun araca veya Cross Dock'a yüklenebilir mi?
  log.push(`8. Diğer Uygun Sabit Araçlar: ${canUseOtherVehicles ? 'Alternatif mevcut' : 'Alternatif yok'}`);
  log.push(`9. Cross Dock / Konsolidasyon: ${canConsolidateCrossDock ? 'Uygun' : 'Doğrudan sevk zorunlu'}`);

  // Adım 10: Ek / 2. araç gerçekten gerekli mi ve çıkış onaylanabilir mi?
  let secondStatus: SecondVehicleDepartureStatus = 'IKINCI_ARAC_YOK';
  let secondLoad = 0;
  let remainingDesi = excessAfterFirst;
  let exceptionReason = '';
  let isSlaExceptionApplied = false;

  if (hasSecondVehicleDefined || secondNeeded) {
    if (firstReached90) {
      // İlk araç %90 doluluğa ulaştı: İkinci araca çıkış verilebilir!
      secondStatus = 'CIKIS_VERILDI';
      secondLoad = Math.min(excessAfterFirst, secondVehicleCapacity);
      remainingDesi = Math.max(0, excessAfterFirst - secondLoad);
      log.push(`10. İkinci Araç Çıkışı: ONAYLANDI (İlk araç %90 eşiğini geçtiği için ${secondLoad.toLocaleString('tr-TR')} desi yüklendi).`);
    } else if (isOneDaySlaRisk && excessAfterFirst > 0) {
      // SLA İstisnası: 1 günlük teslimat SLA'si tehlikedeyse sevkiyat geciktirilmez!
      secondStatus = 'SLA_ISTISNASI_ILE_CIKIS';
      secondLoad = Math.min(excessAfterFirst, secondVehicleCapacity);
      remainingDesi = Math.max(0, excessAfterFirst - secondLoad);
      isSlaExceptionApplied = true;
      exceptionReason =
        '1 Günlük SLA / Teslimat Güvencesi İstisnası: İlk araç %90 doluluğa ulaşmamış olmasına rağmen paketlerin teslimat süresini korumak için sevk onayı verildi.';
      log.push(`10. İkinci Araç Çıkışı: İSTİSNA İLE ONAYLANDI (${exceptionReason}).`);
    } else {
      // %90 kuralı engeli: İkinci araca çıkış verilmez!
      secondStatus = 'CIKIS_VERILMEDI_90_KURALI';
      secondLoad = 0;
      remainingDesi = excessAfterFirst;
      exceptionReason = `İlk araç %90 doluluğa (${first90Threshold.toLocaleString('tr-TR')} desi) ulaşmadığı için ikinci araca çıkış verilmedi. Taşan ${excessAfterFirst.toLocaleString('tr-TR')} desi açıkta tutuldu.`;
      log.push(`10. İkinci Araç Çıkışı: ENGELLENDİ (${exceptionReason}).`);
    }
  } else {
    log.push(`10. İkinci Araç Çıkışı: Gereksinim yok.`);
  }

  const secondFillRate = secondVehicleCapacity > 0
    ? Number(((secondLoad / secondVehicleCapacity) * 100).toFixed(1))
    : 0;

  return {
    laneKey: `${originId} -> ${destinationId}`,
    routeLabel,
    originFacilityId: originId,
    destinationFacilityId: destinationId,
    dailyTotalDesi,
    dailyTotalPackages,
    firstVehicleType,
    firstVehicleCapacity,
    firstVehicleLoad: firstLoad,
    firstVehicleFillRate: firstFillRate,
    firstVehicle90PercentThreshold: first90Threshold,
    firstVehicleReached90Percent: firstReached90,
    firstVehicleDispatched: firstDispatched,
    minimumDepartureThreshold,
    hasSecondVehicleDefined,
    secondVehicleNeeded: secondNeeded,
    secondVehicleDepartureStatus: secondStatus,
    secondVehicleType,
    secondVehicleCapacity,
    secondVehicleLoad: secondLoad,
    secondVehicleFillRate: secondFillRate,
    remainingDesi,
    exceptionReason,
    isSlaExceptionApplied,
    tenStepAuditLog: log,
  };
}

/**
 * Aksaray TM Araç Çıkış Kuralı Değerlendirmesi (Bölüm 6)
 * - Aksaray TM, sabit hat araçları dışında kendi başına yeni bir çıkış aracı oluşturmaz.
 * - Aksaray'da sabit araçlara yerleştirilemeyen kalan paketler Ankara'ya gönderilir.
 * - Aksaray → Ankara arasında 1 kamyonet (maksimum 4.500 desi).
 * - 4.500 desiyi aşarsa kamyonet doldurulur, artan açıkta bırakılır; otomatik Kamyon/TIR oluşturulmaz!
 */
export function evaluateAksarayDispatchRule(params: {
  originId: string;
  unassignedShipments: { destinationId: string; desi: number; packages: number }[];
}): {
  allowedVehicles: { vehicleType: VehicleCategory; capacityDesi: number; loadedDesi: number; destinationId: string }[];
  transferredToAnkaraDesi: number;
  unassignedOpenDesi: number;
  isAutomaticTruckForbidden: boolean;
  warningMessage?: string;
} {
  const { originId, unassignedShipments } = params;
  if (originId !== 'AKSARAY TM') {
    return {
      allowedVehicles: [],
      transferredToAnkaraDesi: 0,
      unassignedOpenDesi: 0,
      isAutomaticTruckForbidden: false,
    };
  }

  // Aksaray'da sabit araçlara sığmayan tüm paketler Ankara yönüne kanalize edilir
  let totalAnkaraBoundDesi = 0;
  for (const ship of unassignedShipments) {
    totalAnkaraBoundDesi += ship.desi;
  }

  const kamyonetCapacity = GENERAL_DISPATCH_CONSTANTS.AKSARAY_ANKARA_KAMYONET_CAPACITY; // 4.500
  const loadedKamyonetDesi = Math.min(totalAnkaraBoundDesi, kamyonetCapacity);
  const openDesi = Math.max(0, totalAnkaraBoundDesi - kamyonetCapacity);

  let warning: string | undefined;
  if (openDesi > 0) {
    warning = `Aksaray TM Kuralı: Kalan ${totalAnkaraBoundDesi.toLocaleString('tr-TR')} desi yük için yalnızca 1 kamyonet (4.500 d) tahsis edildi. Kalan ${openDesi.toLocaleString('tr-TR')} desi açıkta bırakıldı. Otomatik Kamyon/TIR açılması kesin olarak yasaklanmıştır (Kullanıcı Onayı Gerekli).`;
  }

  return {
    allowedVehicles: [
      {
        vehicleType: 'PANELVAN',
        capacityDesi: kamyonetCapacity,
        loadedDesi: loadedKamyonetDesi,
        destinationId: 'ANKARA TM',
      },
    ],
    transferredToAnkaraDesi: loadedKamyonetDesi,
    unassignedOpenDesi: openDesi,
    isAutomaticTruckForbidden: true,
    warningMessage: warning,
  };
}

/**
 * Diyarbakır → Erzurum Panelvan Konsolidasyon Kuralı (Bölüm 7)
 * - Diyarbakır'ın kendi Erzurum paketleri + Gaziantep'ten aktarılan 2.500 desi Erzurum paketi birleştirilir.
 * - Tek bir panelvanda (4.500 desi) değerlendirilir.
 * - Toplam yük 4.500 desiyi aşamaz. Ayrı bir Kamyon veya TIR otomatik oluşturulmaz.
 */
export function evaluateDiyarbakirErzurumPanelvanConsolidation(params: {
  diyarbakirOwnErzurumDesi: number;
  diyarbakirOwnErzurumPackages?: number;
  gaziantepTransferredErzurumDesi?: number;
  gaziantepTransferredErzurumPackages?: number;
}): {
  vehicleType: VehicleCategory;
  capacityDesi: number;
  loadedDiyarbakirDesi: number;
  loadedGaziantepTransferDesi: number;
  totalLoadedDesi: number;
  fillRate: number;
  unassignedOverflowDesi: number;
  isAutomaticTruckForbidden: boolean;
  notes: string;
} {
  const {
    diyarbakirOwnErzurumDesi,
    gaziantepTransferredErzurumDesi = GENERAL_DISPATCH_CONSTANTS.GAZIANTEP_ERZURUM_TRANSFER_DESI, // 2500
  } = params;

  const capacity = GENERAL_DISPATCH_CONSTANTS.SPECIAL_PANELVAN_CAPACITY; // 4500
  const combinedDemand = diyarbakirOwnErzurumDesi + gaziantepTransferredErzurumDesi;

  // 1. Gaziantep'ten gelen 2.500 desi öncelikli aktarılır
  const loadedGaziantep = Math.min(gaziantepTransferredErzurumDesi, capacity);
  const remainingForDiyarbakir = Math.max(0, capacity - loadedGaziantep);
  const loadedDiyarbakir = Math.min(diyarbakirOwnErzurumDesi, remainingForDiyarbakir);

  const totalLoaded = loadedGaziantep + loadedDiyarbakir;
  const overflow = Math.max(0, combinedDemand - capacity);
  const fillRate = Number(((totalLoaded / capacity) * 100).toFixed(1));

  return {
    vehicleType: 'PANELVAN',
    capacityDesi: capacity,
    loadedDiyarbakirDesi: loadedDiyarbakir,
    loadedGaziantepTransferDesi: loadedGaziantep,
    totalLoadedDesi: totalLoaded,
    fillRate,
    unassignedOverflowDesi: overflow,
    isAutomaticTruckForbidden: true,
    notes: `Diyarbakır → Erzurum 4.500 d Panelvan Konsolidasyonu (Diyarbakır: ${loadedDiyarbakir.toLocaleString('tr-TR')} d + Gaziantep Aktarımı: ${loadedGaziantep.toLocaleString('tr-TR')} d). Otomatik Kamyon/TIR açılması engellendi.`,
  };
}

/**
 * Operasyonel Bağlılık Denetimi (Bölüm 5):
 * - Trabzon paketleri Samsun operasyonuna bağlıdır.
 * - Van paketleri Erzurum operasyonuna bağlıdır.
 * - Gerçek varış tesisi (trueDestinationId) kesinlikle değiştirilmez!
 */
export function checkOperationalAffiliation(destinationId: string): {
  operationalHubId: string;
  isAffiliated: boolean;
} {
  const hub = GENERAL_DISPATCH_CONSTANTS.OPERATIONAL_AFFILIATIONS[destinationId];
  if (hub) {
    return {
      operationalHubId: hub,
      isAffiliated: true,
    };
  }
  return {
    operationalHubId: destinationId,
    isAffiliated: false,
  };
}
