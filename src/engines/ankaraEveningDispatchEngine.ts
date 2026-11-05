import {
  CrossDockMovement,
  DestinationDesiBreakdown,
  DistanceMatrix,
  Facility,
  LoadedShipmentSegment,
  OptimizationParameters,
  PalletizedAmazonInfo,
  PlannedVehicleLine,
  PlanRowStatus,
  RouteWaypoint,
  UnplannedShipment,
  VehicleCategory,
  VehicleRightType,
  VehicleScheduleType,
} from '../types/logistics';
import { CrossDockCandidate } from './crossDockEngine';
import {
  calculateDaysFromDistanceKm,
  calculateRouteDeliveryEstimate,
} from './distanceCalculationEngine';

/**
 * 1. FAZ EK KURALLAR – TESLİMAT SÜRESİ, AYNI GÜN SEVK VE ANKARA GECE ARAÇ PLANLAMASI
 *
 * Madde 1: Teslimat Süresi En Önemli Öncelik:
 * - 1 Günlük Paketler: Aynı gün sevk zorunludur! Cross Dock beklemesi veya ertesi güne bırakma yasaktır.
 * - 2 Günlük Paketler: Uygun Cross Dock merkezlerinde birleştirilebilir.
 * - 3 Günlük Paketler: Kendi güzergâh ve planına göre sevk edilir.
 *
 * Madde 1.1 & 1.3: Aynı Gün Sevk Karar Önceliği:
 * 1. Sabit araç
 * 2. Aynı güzergâhtaki diğer sabit araç
 * 3. Güzergâh üzerinden şehir uğraması yapılabilen araç
 * 4. Uygun kapasitesi olan başka bir aynı gün aracı
 * 5. Ek araç tedariki
 *
 * Madde 2 & 3: Ankara TM Akşam Sabit Araç ve Gece Cross Dock Planı (22:00 Operasyonu)
 * - İlk sabit araçlar 22:00'de çıkar.
 * - Ankara'nın kendi toplaması + Ankara Cross Dock'tan gelen paketler birleştirilir.
 * - Gerçek varış tesisleri ve kaynak kırılımları (Ankara Toplama vs Cross Dock) ayrı takip edilir.
 * - Kayseri TIR'ına en fazla 15.000 desi yükleme sınırı uygulanır!
 * - Avrupa & Marmara: ~4.500 desi paletleme karar eşiği (Amazon aracına yükleme).
 * - Kocaeli: < 7.000 desi paletleme karar eşiği (Amazon TIR'ına yükleme).
 * - Samsun: 1 TIR + 1 Kamyon sabit + 1 Gece Cross Dock Kamyonu (3 ayrı araç).
 */

export interface AnkaraDestinationPool {
  destinationId: string;
  destinationName: string;
  distanceKm: number | null;
  directDays: number | null;
  deliveryDaysCategory: 1 | 2 | 3;
  localCollectionDesi: number;
  localCollectionPackages: number;
  crossDockDesi: number;
  crossDockPackages: number;
  totalDesi: number;
  totalPackages: number;
  segments: LoadedShipmentSegment[];
}

export interface AnkaraCorridorDefinition {
  mainDestinationId: string;
  potentialWaypoints: Array<{
    intermediateId: string;
    intermediateName: string;
    corridorDetourKm: number;
    extraHours: number;
  }>;
}

// Tanımlı Güzergâh Uğrama Koridorları (Madde 1.2)
export const ANKARA_CORRIDORS: AnkaraCorridorDefinition[] = [
  {
    // Ankara -> İzmir koridoru üzerinden Afyon uğraması
    mainDestinationId: 'İZMİR TM',
    potentialWaypoints: [
      {
        intermediateId: 'AFYON TM',
        intermediateName: 'Afyon TM',
        corridorDetourKm: 14,
        extraHours: 0.5,
      },
    ],
  },
  {
    // Ankara -> Marmara koridoru üzerinden Kocaeli uğraması
    mainDestinationId: 'MARMARA TM',
    potentialWaypoints: [
      {
        intermediateId: 'KOCAELİ TM',
        intermediateName: 'Kocaeli TM',
        corridorDetourKm: 19,
        extraHours: 0.5,
      },
    ],
  },
  {
    // Ankara -> Avrupa koridoru üzerinden Kocaeli uğraması
    mainDestinationId: 'AVRUPA TM',
    potentialWaypoints: [
      {
        intermediateId: 'KOCAELİ TM',
        intermediateName: 'Kocaeli TM',
        corridorDetourKm: 25,
        extraHours: 0.6,
      },
    ],
  },
  {
    // Ankara -> Adana koridoru üzerinden Aksaray uğraması
    mainDestinationId: 'ADANA TM',
    potentialWaypoints: [
      {
        intermediateId: 'AKSARAY TM',
        intermediateName: 'Aksaray TM',
        corridorDetourKm: 0,
        extraHours: 0.3,
      },
    ],
  },
  {
    // Ankara -> Samsun koridoru üzerinden Merzifon uğraması
    mainDestinationId: 'SAMSUN TM',
    potentialWaypoints: [
      {
        intermediateId: 'MERZİFON TM',
        intermediateName: 'Merzifon TM',
        corridorDetourKm: 26,
        extraHours: 0.6,
      },
    ],
  },
];

export function executeAnkaraEveningDispatch(params: {
  facilitiesMap: Record<string, Facility>;
  ankaraOwnDesiMap: Record<string, number>;
  ankaraOwnPackageMap: Record<string, number>;
  crossDockCandidates: CrossDockCandidate[];
  distanceMatrix: DistanceMatrix;
  optParams: OptimizationParameters;
  startVehicleSeq?: number;
}): {
  ankaraLines: PlannedVehicleLine[];
  ankaraMovements: CrossDockMovement[];
  unplannedShipments: UnplannedShipment[];
  usedNormalTirCount: number;
} {
  const {
    facilitiesMap,
    ankaraOwnDesiMap,
    ankaraOwnPackageMap,
    crossDockCandidates,
    distanceMatrix,
    optParams,
    startVehicleSeq = 1,
  } = params;

  const ankaraLines: PlannedVehicleLine[] = [];
  const ankaraMovements: CrossDockMovement[] = [];
  const unplannedShipments: UnplannedShipment[] = [];

  let vehicleSeq = startVehicleSeq;
  let usedNormalTirCount = 0;

  // Step 1: Destination bazında Ankara kendi toplaması ve gelen Cross Dock paketlerini topla
  const poolByDest: Record<string, AnkaraDestinationPool> = {};

  // Tüm hedef tesisleri başlat (Ankara ve Gebze hariç)
  for (const [fId, f] of Object.entries(facilitiesMap)) {
    if (fId === 'ANKARA TM' || fId === 'GEBZE TM') continue;

    const km = distanceMatrix['ANKARA TM']?.[fId] ?? null;
    const directDays = calculateDaysFromDistanceKm(km);
    const dCat: 1 | 2 | 3 = directDays ? (directDays >= 3 ? 3 : directDays === 2 ? 2 : 1) : 2;

    const ownDesi = Math.max(0, Math.round(ankaraOwnDesiMap[fId] ?? 0));
    const ownPkg = Math.max(0, Math.round(ankaraOwnPackageMap[fId] ?? 0));

    const segs: LoadedShipmentSegment[] = [];
    if (ownDesi > 0) {
      segs.push({
        segmentId: `SEG-ANK-OWN-${fId}`,
        sourceFacilityId: 'ANKARA TM',
        sourceFacilityName: 'ANKARA TM',
        trueDestinationId: fId,
        trueDestinationName: f.name,
        operationalOriginId: 'ANKARA TM',
        operationalOriginName: 'ANKARA TM',
        packages: ownPkg,
        desi: ownDesi,
        isFromCrossDock: false,
        transferReason: 'Ankara TM kendi toplama paketi.',
      });
    }

    poolByDest[fId] = {
      destinationId: fId,
      destinationName: f.name,
      distanceKm: km,
      directDays,
      deliveryDaysCategory: dCat,
      localCollectionDesi: ownDesi,
      localCollectionPackages: ownPkg,
      crossDockDesi: 0,
      crossDockPackages: 0,
      totalDesi: ownDesi,
      totalPackages: ownPkg,
      segments: segs,
    };
  }

  // Cross Dock adaylarını havuzlara ekle (Gerçek varış tesisini kesinlikle koruyarak)
  for (const cand of crossDockCandidates) {
    const destPool = poolByDest[cand.trueDestinationId];
    if (!destPool) {
      unplannedShipments.push({
        id: `UNP-NO-DEST-${cand.id}`,
        originFacilityId: cand.sourceFacilityId,
        originFacilityName: cand.sourceFacilityName,
        trueDestinationId: cand.trueDestinationId,
        trueDestinationName: cand.trueDestinationName,
        currentLocationId: 'ANKARA TM',
        desi: cand.desi,
        packages: cand.packages,
        reasonCode: 'DIREKT_HAT_VE_BAGLI_TESIS_YOK',
        explanation: `Ankara TM havuzunda ${cand.trueDestinationName} hedefi bulunamadı.`,
      });
      continue;
    }

    destPool.crossDockDesi += cand.desi;
    destPool.crossDockPackages += cand.packages;
    destPool.totalDesi += cand.desi;
    destPool.totalPackages += cand.packages;

    destPool.segments.push({
      segmentId: `SEG-ANK-CD-${cand.sourceFacilityId}-${cand.trueDestinationId}-${cand.id}`,
      sourceFacilityId: cand.sourceFacilityId,
      sourceFacilityName: cand.sourceFacilityName,
      trueDestinationId: cand.trueDestinationId,
      trueDestinationName: cand.trueDestinationName,
      operationalOriginId: 'ANKARA TM',
      operationalOriginName: 'ANKARA TM (Cross Dock)',
      packages: cand.packages,
      desi: cand.desi,
      isFromCrossDock: true,
      crossDockFacilityId: 'ANKARA TM',
      crossDockFacilityName: 'ANKARA TM',
      transferReason: cand.reasonDetail,
    });
  }

  // Yardımcı Araç Oluşturucu
  const createAnkaraLine = (cfg: {
    lineCode: string;
    destinationId: string;
    vehicleType: VehicleCategory;
    capacityDesi: number;
    scheduleType: VehicleScheduleType;
    scheduleLabel: string;
    departureTime: string;
    quotaType: VehicleRightType;
    quotaLabel: string;
    isAntalyaSpecialTir?: boolean;
    isAnkaraCdFixedTir?: boolean;
    isAnkaraCdAdditionalTir?: boolean;
    segmentsToLoad: LoadedShipmentSegment[];
    waypoints?: RouteWaypoint[];
    extraRouteKm?: number;
    isPalletized?: boolean;
    palletizedInfo?: PalletizedAmazonInfo;
    maxLoadLimitDesi?: number;
    sameDayPriorityEnforced?: boolean;
    ruleTag: string;
    justification: string;
    status: PlanRowStatus;
  }): PlannedVehicleLine => {
    const loadedDesi = cfg.segmentsToLoad.reduce((s, x) => s + x.desi, 0);
    const loadedPkg = cfg.segmentsToLoad.reduce((s, x) => s + x.packages, 0);
    const effectiveCap = cfg.maxLoadLimitDesi || cfg.capacityDesi;
    const fillRate = Number(((loadedDesi / (cfg.capacityDesi || 1)) * 100).toFixed(1));
    const remCapacity = Math.max(0, effectiveCap - loadedDesi);

    const ownDesiInVehicle = cfg.segmentsToLoad
      .filter((s) => s.sourceFacilityId === 'ANKARA TM')
      .reduce((s, x) => s + x.desi, 0);
    const cdDesiInVehicle = loadedDesi - ownDesiInVehicle;

    // Destination breakdown
    const destBreakdownMap: Record<string, DestinationDesiBreakdown> = {};
    for (const seg of cfg.segmentsToLoad) {
      if (!destBreakdownMap[seg.trueDestinationId]) {
        destBreakdownMap[seg.trueDestinationId] = {
          destinationId: seg.trueDestinationId,
          destinationName: seg.trueDestinationName,
          desi: 0,
          packages: 0,
        };
      }
      destBreakdownMap[seg.trueDestinationId].desi += seg.desi;
      destBreakdownMap[seg.trueDestinationId].packages += seg.packages;
    }

    const destFacility = facilitiesMap[cfg.destinationId] || {
      id: cfg.destinationId,
      name: cfg.destinationId,
    };

    const delivery = calculateRouteDeliveryEstimate({
      originId: 'ANKARA TM',
      destinationId: cfg.destinationId,
      viaCrossDockId: null,
      distanceMatrix,
      crossDockHandlingHours: optParams.crossDockHandlingHours,
      departureTime: cfg.departureTime,
      isDirectRouteConnection: true,
    });

    if (cfg.extraRouteKm && delivery.distanceKm !== null) {
      delivery.distanceKm += cfg.extraRouteKm;
    }

    const lineId = `LINE-ANK-${cfg.lineCode}`;

    // Record Cross Dock Movements
    for (const seg of cfg.segmentsToLoad) {
      if (seg.isFromCrossDock) {
        ankaraMovements.push({
          id: `MOV-ANK-${cfg.lineCode}-${seg.segmentId}`,
          hubFacilityId: 'ANKARA TM',
          sourceFacilityId: seg.sourceFacilityId,
          sourceFacilityName: seg.sourceFacilityName,
          trueDestinationId: seg.trueDestinationId,
          trueDestinationName: seg.trueDestinationName,
          desi: seg.desi,
          packages: seg.packages,
          reasonType: 'MARMARA_KOCAELI_AVRUPA_KONSOLIDASYON',
          reasonDetail: `Ankara TM akşam planlamasında ${cfg.lineCode} (${cfg.scheduleLabel}) aracına yüklendi.`,
          outboundVehicleLineId: lineId,
          status: 'PLANLANDI',
        });
      }
    }

    const isWaypointed = Boolean(cfg.waypoints && cfg.waypoints.length > 0);
    const transportTypeLabel = cfg.isPalletized
      ? 'Paletli Amazon Aracı'
      : isWaypointed
      ? 'Ankara Direkt + Uğramalı Hat'
      : cdDesiInVehicle > 0 && ownDesiInVehicle > 0
      ? 'Ankara Sabit + Cross Dock Birleşik'
      : cdDesiInVehicle > 0
      ? 'Ankara Cross Dock'
      : 'Ankara Direkt Sabit Hat';

    const lineRecord: PlannedVehicleLine = {
      id: lineId,
      lineCode: cfg.lineCode,
      originFacilityId: 'ANKARA TM',
      originFacilityName: 'ANKARA TM',
      destinationFacilityId: cfg.destinationId,
      destinationFacilityName: isWaypointed
        ? `${destFacility.name} (${cfg.waypoints!.map((w) => `${w.facilityName} Uğramalı`).join(', ')})`
        : destFacility.name,
      vehicleType: cfg.vehicleType,
      capacityDesi: cfg.capacityDesi,
      totalDesi: loadedDesi,
      totalPackages: loadedPkg,
      fillRate,
      routeCategory: cdDesiInVehicle > 0 ? 'ANKARA_CROSS_DOCK' : 'DIREKT',
      transportTypeLabel,
      vehicleQuotaType: cfg.quotaType,
      vehicleQuotaLabel: cfg.quotaLabel,
      isAntalyaSpecialTir: Boolean(cfg.isAntalyaSpecialTir),
      isAnkaraCdFixedTir: Boolean(cfg.isAnkaraCdFixedTir),
      isAnkaraCdAdditionalTir: Boolean(cfg.isAnkaraCdAdditionalTir),
      phase1RuleTag: cfg.ruleTag,
      planStatus: cfg.status,
      loadedSegments: cfg.segmentsToLoad,
      delivery,
      comparison: {
        changeType: cfg.status === 'MEVCUT_KORUNDU' ? 'KORUNDU' : 'OPTIMIZE_EDILDI',
        explanation: cfg.justification,
      },
      notes: [
        `Çıkış Saati: ${cfg.departureTime} · Plan Türü: ${cfg.scheduleLabel}`,
        cfg.justification,
        `Yük Dağılımı: Ankara Kendi Toplaması: ${ownDesiInVehicle.toLocaleString('tr-TR')} d · Cross Dock: ${cdDesiInVehicle.toLocaleString('tr-TR')} d · Boş Kapasite: ${remCapacity.toLocaleString('tr-TR')} d`,
      ],
      departureTime: cfg.departureTime,
      isFixedScheduleVehicle: cfg.scheduleType === 'SABIT_ARAC',
      vehicleScheduleType: cfg.scheduleType,
      vehicleScheduleLabel: cfg.scheduleLabel,
      remainingCapacityDesi: remCapacity,
      localCollectionDesi: ownDesiInVehicle,
      crossDockDesi: cdDesiInVehicle,
      waypoints: cfg.waypoints,
      extraRouteKm: cfg.extraRouteKm,
      isPalletized: cfg.isPalletized,
      palletizedInfo: cfg.palletizedInfo,
      planningJustification: cfg.justification,
      destinationBreakdown: Object.values(destBreakdownMap),
      allowedCoLoadedDestinationIds: isWaypointed
        ? [cfg.destinationId, ...cfg.waypoints!.map((w) => w.facilityId)]
        : undefined,
      maxLoadLimitDesi: cfg.maxLoadLimitDesi,
      sameDayPriorityEnforced: cfg.sameDayPriorityEnforced ?? true,
    };

    if (cfg.vehicleType === 'TIR' && !cfg.isAntalyaSpecialTir) {
      usedNormalTirCount += 1;
    }

    return lineRecord;
  };

  // Yardımcı Segment Dilimleyici (Bir araca kapasitesi kadar segment doldurur, taşanı döndürür)
  const sliceSegmentsForCapacity = (
    segments: LoadedShipmentSegment[],
    capacity: number
  ): { batch: LoadedShipmentSegment[]; remainder: LoadedShipmentSegment[] } => {
    const batch: LoadedShipmentSegment[] = [];
    const remainder: LoadedShipmentSegment[] = [];
    let accDesi = 0;
    let batchHasAntalyaOrAfyon = false;
    let batchHasOtherExternal = false;

    for (const seg of segments) {
      const isAntalyaOrAfyon =
        seg.sourceFacilityId === 'ANTALYA TM' || seg.sourceFacilityId === 'AFYON TM';
      const isOtherExternal =
        seg.sourceFacilityId !== 'ANTALYA TM' &&
        seg.sourceFacilityId !== 'AFYON TM' &&
        seg.sourceFacilityId !== 'ANKARA TM';

      // Bölüm 14: Ankara Cross Dock'ta yalnızca Antalya TM ve Afyon TM paketleri aynı araçta birleştirilebilir.
      // Diğer merkezlerin paketleri bunlarla aynı araçta taşınamaz (Ankara kendi toplaması her ikisiyle de taşınabilir).
      if (
        (isAntalyaOrAfyon && batchHasOtherExternal) ||
        (isOtherExternal && batchHasAntalyaOrAfyon)
      ) {
        remainder.push(seg);
        continue;
      }

      const space = capacity - accDesi;
      if (space <= 0) {
        remainder.push(seg);
      } else if (seg.desi <= space) {
        batch.push(seg);
        accDesi += seg.desi;
        if (isAntalyaOrAfyon) batchHasAntalyaOrAfyon = true;
        if (isOtherExternal) batchHasOtherExternal = true;
      } else {
        const ratio = space / seg.desi;
        const takePkg = Math.max(1, Math.round(seg.packages * ratio));
        batch.push({
          ...seg,
          segmentId: `${seg.segmentId}-P1`,
          desi: space,
          packages: takePkg,
        });
        remainder.push({
          ...seg,
          segmentId: `${seg.segmentId}-P2`,
          desi: seg.desi - space,
          packages: Math.max(1, seg.packages - takePkg),
        });
        accDesi += space;
        if (isAntalyaOrAfyon) batchHasAntalyaOrAfyon = true;
        if (isOtherExternal) batchHasOtherExternal = true;
      }
    }

    return { batch, remainder };
  };

  // Ek araçları kapasiteyi (12.500 desi) kesinlikle aşmayacak şekilde 01, 02, ... dilimlerine ayıran sevk yardımcısı
  const dispatchEkKamyonBatches = (
    destCode: string,
    destId: string,
    segments: LoadedShipmentSegment[],
    kamyonCap: number,
    ruleTag: string,
    reasonText: string
  ) => {
    let rem = [...segments];
    let idx = 1;
    while (rem.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(rem, kamyonCap);
      if (batch.length === 0) break;
      const bDesi = batch.reduce((s, x) => s + x.desi, 0);
      const line = createAnkaraLine({
        lineCode: `ANK-${destCode}-EK-0${idx}`,
        destinationId: destId,
        vehicleType: 'KAMYON',
        capacityDesi: kamyonCap,
        scheduleType: 'EK_ARAC',
        scheduleLabel: `Ek Araç 0${idx} (Aynı Gün Sevk)`,
        departureTime: '22:45',
        quotaType: 'SABIT_HAT_ARACI',
        quotaLabel: 'Ek Araç',
        segmentsToLoad: batch,
        ruleTag,
        justification: `${reasonText} Kalan ${bDesi.toLocaleString('tr-TR')} desi ek araç 0${idx} ile kapasite dahilinde (${kamyonCap.toLocaleString('tr-TR')} desi sınırı korunarak) aynı gün sevk edildi.`,
        status: 'AYNI_GUN_EK_ARAC',
      });
      ankaraLines.push(line);
      rem = remainder;
      idx++;
    }
  };

  // ============================================================================
  // ADIM 2: BÖLÜM 3.1 - 3.13 ANKARA SABİT HATLARININ ARAÇ PLANLAMASI (22:00 Çıkışları)
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 3.1 ANKARA → AVRUPA (2 Kamyon Sabit, 22:00 Çıkış, ~4.500 Desi Paletleme Eşiği)
  // ----------------------------------------------------------------------------
  const avrPool = poolByDest['AVRUPA TM'];
  if (avrPool && avrPool.totalDesi > 0) {
    let currentSegments = [...avrPool.segments];
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    // 1. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-AVR-KAM-01`,
          destinationId: 'AVRUPA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_1_ANKARA_AVRUPA',
          justification:
            'Bölüm 3.1: Ankara → Avrupa 1. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    // 2. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-AVR-KAM-02`,
          destinationId: 'AVRUPA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_1_ANKARA_AVRUPA',
          justification:
            'Bölüm 3.1: Ankara → Avrupa 2. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    // Kalan paketler: Yaklaşık 4.500 desi seviyesinde olduğunda paletleme seçeneği (Amazon aracı)
    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      // 4.500 desi karar eşiği: 1.000 - 6.500 desi aralığında Amazon aracına paletlenir; daha büyükse ek kamyon çıkar
      if (remDesi <= 6500) {
        const line = createAnkaraLine({
          lineCode: `ANK-AVR-PLT-01`,
          destinationId: 'AVRUPA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'PALETLI_AMAZON_ARACI',
          scheduleLabel: 'Paletli Amazon Aracı',
          departureTime: '22:30',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Paletli Amazon Aracı',
          segmentsToLoad: currentSegments,
          isPalletized: true,
          palletizedInfo: {
            isAmazonVehicle: true,
            palletDesi: remDesi,
            decisionThresholdDesi: 4500,
            explanation: `Bölüm 3.1 & 4: Kalan ${remDesi.toLocaleString('tr-TR')} desi paket (~4.500 desi karar eşiği) paletlenerek Amazon aracına yüklendi. 1 günlük teslimat süresi korundu.`,
          },
          ruleTag: 'BOLUM_3_1_AVRUPA_PALETLEME',
          justification: `Bölüm 3.1 & 4: 2 sabit kamyon sonrası kalan ${remDesi.toLocaleString('tr-TR')} desi paket (~4.500 desi paletleme eşiği) ile Amazon aracına paletlendi.`,
          status: 'PALETLI_AMAZON_SEVK',
        });
        ankaraLines.push(line);
        currentSegments = [];
      } else {
        // Büyük hacim -> Ek Kamyon (Aynı Gün Sevk Zorunluluğu)
        dispatchEkKamyonBatches(
          'AVR',
          'AVRUPA TM',
          currentSegments,
          kamyonCap,
          'BOLUM_1_1_AYNI_GUN_EK_ARAC',
          'Bölüm 1.1 & 3.1: 1 günlük paketler ertesi güne bırakılamayacağından'
        );
        currentSegments = [];
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 3.4 ANKARA → MARMARA (2 Kamyon Sabit, 22:00 Çıkış, ~4.500 Desi Paletleme Eşiği)
  // ----------------------------------------------------------------------------
  const mrmPool = poolByDest['MARMARA TM'];
  if (mrmPool && mrmPool.totalDesi > 0) {
    let currentSegments = [...mrmPool.segments];
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    // 1. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-MRM-KAM-01`,
          destinationId: 'MARMARA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_4_ANKARA_MARMARA',
          justification:
            'Bölüm 3.4: Ankara → Marmara 1. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    // 2. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-MRM-KAM-02`,
          destinationId: 'MARMARA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_4_ANKARA_MARMARA',
          justification:
            'Bölüm 3.4: Ankara → Marmara 2. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      if (remDesi <= 6500) {
        const line = createAnkaraLine({
          lineCode: `ANK-MRM-PLT-01`,
          destinationId: 'MARMARA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'PALETLI_AMAZON_ARACI',
          scheduleLabel: 'Paletli Amazon Aracı',
          departureTime: '22:30',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Paletli Amazon Aracı',
          segmentsToLoad: currentSegments,
          isPalletized: true,
          palletizedInfo: {
            isAmazonVehicle: true,
            palletDesi: remDesi,
            decisionThresholdDesi: 4500,
            explanation: `Bölüm 3.4 & 4: Kalan ${remDesi.toLocaleString('tr-TR')} desi (~4.500 desi karar eşiği) paletlenerek Amazon aracına yüklendi. 1 günlük teslimat süresi korundu.`,
          },
          ruleTag: 'BOLUM_3_4_MARMARA_PALETLEME',
          justification: `Bölüm 3.4 & 4: 2 sabit kamyon sonrası kalan ${remDesi.toLocaleString('tr-TR')} desi paket Amazon aracına paletlendi.`,
          status: 'PALETLI_AMAZON_SEVK',
        });
        ankaraLines.push(line);
        currentSegments = [];
      } else {
        dispatchEkKamyonBatches(
          'MRM',
          'MARMARA TM',
          currentSegments,
          kamyonCap,
          'BOLUM_1_1_AYNI_GUN_EK_ARAC',
          'Bölüm 1.1 & 3.4: 1 günlük paketler için'
        );
        currentSegments = [];
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 3.2 ANKARA → İZMİR (2 Kamyon Sabit, 22:00 Çıkış)
  // ----------------------------------------------------------------------------
  const izmPool = poolByDest['İZMİR TM'];
  if (izmPool && izmPool.totalDesi > 0) {
    let currentSegments = [...izmPool.segments];
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    // 1. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-IZM-KAM-01`,
          destinationId: 'İZMİR TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_2_ANKARA_IZMIR',
          justification:
            'Bölüm 3.2: Ankara → İzmir 1. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    // 2. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-IZM-KAM-02`,
          destinationId: 'İZMİR TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_2_ANKARA_IZMIR',
          justification:
            'Bölüm 3.2: Ankara → İzmir 2. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'IZM',
        'İZMİR TM',
        currentSegments,
        kamyonCap,
        'BOLUM_1_1_AYNI_GUN_EK_ARAC',
        'Bölüm 3.2 & 1.1: 1 günlük paketler ertesi güne bırakılamayacağından'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // 3.3 ANKARA → BURSA (2 Kamyon Sabit, 22:00 Çıkış)
  // ----------------------------------------------------------------------------
  const brsPool = poolByDest['BURSA TM'];
  if (brsPool && brsPool.totalDesi > 0) {
    let currentSegments = [...brsPool.segments];
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    // 1. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-BRS-KAM-01`,
          destinationId: 'BURSA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_3_ANKARA_BURSA',
          justification:
            'Bölüm 3.3: Ankara → Bursa 1. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    // 2. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-BRS-KAM-02`,
          destinationId: 'BURSA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_3_ANKARA_BURSA',
          justification:
            'Bölüm 3.3: Ankara → Bursa 2. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'BRS',
        'BURSA TM',
        currentSegments,
        kamyonCap,
        'BOLUM_1_1_AYNI_GUN_EK_ARAC',
        'Bölüm 3.3 & 1.1: 1 günlük paketler ertesi güne bırakılamayacağından'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // 3.5 ANKARA → SAMSUN (1 TIR Sabit + 1 Kamyon Sabit + 1 Gece Cross Dock Kamyonu)
  // Üç araç da ayrı araç kaydı olarak tutulur; mükerrer atama yapılmaz!
  // ----------------------------------------------------------------------------
  const smsPool = poolByDest['SAMSUN TM'];
  if (smsPool && smsPool.totalDesi > 0) {
    let currentSegments = [...smsPool.segments];
    const tirCap = optParams.tirCapacityDesi; // 22.500
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    // 1. Sabit TIR
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, tirCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-SMS-TIR-01`,
          destinationId: 'SAMSUN TM',
          vehicleType: 'TIR',
          capacityDesi: tirCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_5_ANKARA_SAMSUN_TIR',
          justification:
            'Bölüm 3.5: Ankara → Samsun 1. Sabit TIR saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    // 2. Sabit Kamyon
    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-SMS-KAM-01`,
          destinationId: 'SAMSUN TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_5_ANKARA_SAMSUN_KAMYON',
          justification:
            'Bölüm 3.5: Ankara → Samsun 1. Sabit Kamyon saat 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    // 3. Gece Cross Dock Kamyonu (Gece tutulan araç)
    const { batch: cdBatch, remainder: cdRemainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
    const line3 = createAnkaraLine({
      lineCode: `ANK-SMS-GECE-KAM-02`,
      destinationId: 'SAMSUN TM',
      vehicleType: 'KAMYON',
      capacityDesi: kamyonCap,
      scheduleType: 'GECE_TUTULAN_ARAC',
      scheduleLabel: 'Gece Tutulan Cross Dock Kamyonu (23:30)',
      departureTime: '23:30',
      quotaType: 'ANKARA_CD_SABIT_TIR',
      quotaLabel: 'Gece Cross Dock Aracı',
      segmentsToLoad: cdBatch,
      ruleTag: 'BOLUM_3_5_SAMSUN_GECE_CROSS_DOCK',
      justification:
        cdBatch.length > 0
          ? 'Bölüm 3.5: Samsun Cross Dock operasyonu için gece tutulan 2. Kamyon planlandı ve kalan paketler yüklendi.'
          : 'Bölüm 3.5: Samsun Cross Dock operasyonu için gece tutulan 2. Kamyon ayrıldı (Kapasite: 12.500 desi hazır).',
      status: 'CROSS_DOCK_BIRLESTIRME',
    });
    ankaraLines.push(line3);
    currentSegments = cdRemainder;

    // Kalan paketler varsa ek araç
    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'SMS',
        'SAMSUN TM',
        currentSegments,
        kamyonCap,
        'BOLUM_1_1_AYNI_GUN_EK_ARAC',
        'Bölüm 3.5 & 1.1: Samsun yönünde 3 araç sonrası'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // 3.6 ANKARA → ADANA (1 TIR Sabit, 22:00 Çıkış)
  // ----------------------------------------------------------------------------
  const adnPool = poolByDest['ADANA TM'];
  if (adnPool && adnPool.totalDesi > 0) {
    let currentSegments = [...adnPool.segments];
    const tirCap = optParams.tirCapacityDesi; // 22.500

    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, tirCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-ADN-TIR-01`,
          destinationId: 'ADANA TM',
          vehicleType: 'TIR',
          capacityDesi: tirCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_6_ANKARA_ADANA',
          justification:
            'Bölüm 3.6: Ankara → Adana 1. Sabit TIR kendi toplaması ve uygun Cross Dock paketleriyle 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'ADN',
        'ADANA TM',
        currentSegments,
        optParams.kamyonCapacityDesi,
        'BOLUM_1_1_AYNI_GUN_EK_ARAC',
        'Bölüm 3.6 & 1.1: 1 günlük teslimat zorunluluğu nedeniyle Adana'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // 3.7 ANKARA → KONYA (1 Kamyon Sabit, 22:00 Çıkış)
  // ----------------------------------------------------------------------------
  const knyPool = poolByDest['KONYA TM'];
  if (knyPool && knyPool.totalDesi > 0) {
    let currentSegments = [...knyPool.segments];
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-KNY-KAM-01`,
          destinationId: 'KONYA TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_7_ANKARA_KONYA',
          justification:
            'Bölüm 3.7: Ankara → Konya 1. Sabit Kamyon 1 günlük teslimat zorunluluğuyla 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'KNY',
        'KONYA TM',
        currentSegments,
        kamyonCap,
        'BOLUM_1_1_AYNI_GUN_EK_ARAC',
        'Bölüm 3.7 & 1.1: 1 günlük Konya paketleri ertesi güne bırakılamayacağından'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // 3.8 ANKARA → AFYON (1 Kamyon Sabit, 22:00 Çıkış)
  // ----------------------------------------------------------------------------
  const afyPool = poolByDest['AFYON TM'];
  if (afyPool && afyPool.totalDesi > 0) {
    let currentSegments = [...afyPool.segments];
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-AFY-KAM-01`,
          destinationId: 'AFYON TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_8_ANKARA_AFYON',
          justification:
            'Bölüm 3.8: Ankara → Afyon 1. Sabit Kamyon 1 günlük teslimat kuralıyla 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      // İzmir aracı güzergâhında Afyon uğraması kontrolü (Madde 1.2)
      const izmLineWithSpace = ankaraLines.find(
        (l) =>
          l.destinationFacilityId === 'İZMİR TM' &&
          (l.remainingCapacityDesi ?? 0) >= remDesi
      );

      if (izmLineWithSpace) {
        // Uğrama yap (Madde 1.2)
        izmLineWithSpace.loadedSegments.push(...currentSegments);
        izmLineWithSpace.totalDesi += remDesi;
        izmLineWithSpace.totalPackages += currentSegments.reduce((s, x) => s + x.packages, 0);
        izmLineWithSpace.fillRate = Number(
          ((izmLineWithSpace.totalDesi / izmLineWithSpace.capacityDesi) * 100).toFixed(1)
        );
        izmLineWithSpace.remainingCapacityDesi = Math.max(
          0,
          izmLineWithSpace.capacityDesi - izmLineWithSpace.totalDesi
        );
        izmLineWithSpace.waypoints = [
          {
            facilityId: 'AFYON TM',
            facilityName: 'Afyon TM',
            extraKm: 14,
            extraHours: 0.5,
            droppedDesi: remDesi,
            droppedPackages: currentSegments.reduce((s, x) => s + x.packages, 0),
          },
        ];
        izmLineWithSpace.extraRouteKm = 14;
        izmLineWithSpace.planStatus = 'SEHIR_UGRAMALI';
        izmLineWithSpace.destinationFacilityName = 'İZMİR TM (Afyon TM Uğramalı)';
        izmLineWithSpace.notes.push(
          `Bölüm 1.2 Güzergâh Uğraması: Kalan ${remDesi.toLocaleString('tr-TR')} desi Afyon paketi İzmir aracına yüklendi (+14 km ek mesafe). 1 günlük süre korundu.`
        );
        currentSegments = [];
      } else {
        // Ek araç çıkar
        dispatchEkKamyonBatches(
          'AFY',
          'AFYON TM',
          currentSegments,
          kamyonCap,
          'BOLUM_1_1_AYNI_GUN_EK_ARAC',
          'Bölüm 3.8 & 1.1: Afyon'
        );
        currentSegments = [];
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 3.9 ANKARA → KAYSERİ (1 TIR Sabit, 15.000 DESİ YÜKLEME TAVANI KURALI!)
  // "Kayseri TIR’ına en fazla 15.000 desi yükleme yapılması kuralı uygulanır!
  //  15.000 desi Kayseri TIR'ı için belirtilen yükleme sınırıdır; genel TIR kapasitesinin (22.500) yerine geçmez."
  // Sistem Karar Sırası:
  // 1. Sabit Kayseri TIR'ını kontrol et.
  // 2. 15.000 desi yükleme sınırını uygula.
  // 3. Ankara'nın kendi toplamasını hesapla.
  // 4. Akşam Cross Dock paketlerini hesapla.
  // 5. Gece için tutulan ek aracın kapasitesini kontrol et.
  // 6. Kalan paketler için ek araç ihtiyacını belirle.
  // ----------------------------------------------------------------------------
  const kysPool = poolByDest['KAYSERİ TM'];
  if (kysPool && kysPool.totalDesi > 0) {
    const kayseriTirLoadLimit = 15000; // Hard max load limit for Kayseri fixed TIR
    const tirStandardCap = optParams.tirCapacityDesi; // 22.500
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    // Step 3 & 4: Separate own collection vs evening cross dock segments
    const ownSegments = kysPool.segments.filter((s) => !s.isFromCrossDock);
    const cdSegments = kysPool.segments.filter((s) => s.isFromCrossDock);

    // Prioritize own collection in Sabit TIR, then fill with Cross Dock up to 15.000 desi
    const sortedKysSegments = [...ownSegments, ...cdSegments];

    // 1. Sabit Kayseri TIR'ı (Genel TIR kapasitesi: 22.500, Yükleme Tavanı: 15.000 desi!)
    const { batch: tirBatch, remainder: tirRemainder } = sliceSegmentsForCapacity(
      sortedKysSegments,
      kayseriTirLoadLimit
    );

    if (tirBatch.length > 0) {
      const line = createAnkaraLine({
        lineCode: `ANK-KYS-TIR-01`,
        destinationId: 'KAYSERİ TM',
        vehicleType: 'TIR',
        capacityDesi: tirStandardCap, // 22.500 genel TIR kapasitesi (15.000 kapasite olarak kullanılmaz!)
        maxLoadLimitDesi: kayseriTirLoadLimit, // 15.000 desi yükleme tavanı kuralı
        scheduleType: 'SABIT_ARAC',
        scheduleLabel: 'Sabit TIR (22:00 - 15.000 Desi Sınırı)',
        departureTime: '22:00',
        quotaType: 'SABIT_HAT_ARACI',
        quotaLabel: 'Sabit Hat Aracı (15.000 d Limit)',
        segmentsToLoad: tirBatch,
        ruleTag: 'BOLUM_3_9_KAYSERI_15000_SINIRI',
        justification:
          'Bölüm 3.9: Ankara → Kayseri 1. Sabit TIR’ına genel kapasite (22.500 desi) yerine en fazla 15.000 desi yükleme kuralı kesin olarak uygulandı. Ankara kendi toplaması ve uygun akşam Cross Dock paketleri yüklendi.',
        status: 'MEVCUT_KORUNDU',
      });
      ankaraLines.push(line);
    }

    // 5. Gece için tutulan ek aracın kapasitesini kontrol et (Kamyon: 12.500 desi)
    let currentKysSegments = tirRemainder;
    const remDesi = currentKysSegments.reduce((s, x) => s + x.desi, 0);

    if (remDesi > 0) {
      const { batch: geceBatch, remainder: geceRemainder } = sliceSegmentsForCapacity(
        currentKysSegments,
        kamyonCap
      );

      if (geceBatch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-KYS-GECE-KAM-02`,
          destinationId: 'KAYSERİ TM',
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          scheduleType: 'GECE_TUTULAN_ARAC',
          scheduleLabel: 'Gece Tutulan Ek Araç (23:30)',
          departureTime: '23:30',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Gece Tutulan Araç',
          segmentsToLoad: geceBatch,
          ruleTag: 'BOLUM_3_9_KAYSERI_GECE_ARACI',
          justification: `Bölüm 3.9: Kayseri 15.000 desi sınırından taşan ve akşam Cross Dock’tan gelen ${geceBatch.reduce((s, x) => s + x.desi, 0).toLocaleString('tr-TR')} desi paket gece tutulan ek araçla sevk edildi.`,
          status: 'CROSS_DOCK_BIRLESTIRME',
        });
        ankaraLines.push(line);
      }

      // 6. Kalan paketler için ek araç ihtiyacını belirle
      if (geceRemainder.length > 0) {
        const rem2Desi = geceRemainder.reduce((s, x) => s + x.desi, 0);
        const line2 = createAnkaraLine({
          lineCode: `ANK-KYS-EK-03`,
          destinationId: 'KAYSERİ TM',
          vehicleType: rem2Desi > optParams.splitUpperThresholdDesi ? 'TIR' : 'KAMYON',
          capacityDesi:
            rem2Desi > optParams.splitUpperThresholdDesi ? tirStandardCap : kamyonCap,
          scheduleType: 'EK_ARAC',
          scheduleLabel: 'Ek Araç (Aynı Gün Sevk)',
          departureTime: '23:45',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Ek Araç',
          segmentsToLoad: geceRemainder,
          ruleTag: 'BOLUM_1_1_AYNI_GUN_EK_ARAC',
          justification: `Bölüm 3.9 & 1.1: 1 günlük Kayseri paketleri için ek araç tedarik edildi (${rem2Desi.toLocaleString('tr-TR')} desi). Ertesi güne bırakılmadı.`,
          status: 'AYNI_GUN_EK_ARAC',
        });
        ankaraLines.push(line2);
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 3.10 ANKARA → KOCAELİ (≥ 7.000 Desi Kamyon, < 7.000 Desi Paletleme Amazon TIR'ı)
  // "7.000 desi araç kapasitesi değil, kamyon tutma karar eşiğidir!"
  // ----------------------------------------------------------------------------
  const kocPool = poolByDest['KOCAELİ TM'];
  if (kocPool && kocPool.totalDesi > 0) {
    let currentSegments = [...kocPool.segments];
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    if (kocPool.totalDesi >= 7000) {
      // ≥ 7.000 desi: Kamyon tutulur!
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
      const line = createAnkaraLine({
        lineCode: `ANK-KOC-KAM-01`,
        destinationId: 'KOCAELİ TM',
        vehicleType: 'KAMYON',
        capacityDesi: kamyonCap,
        scheduleType: 'SABIT_ARAC',
        scheduleLabel: 'Sabit Kamyon (≥ 7.000 d Eşiği)',
        departureTime: '22:00',
        quotaType: 'SABIT_HAT_ARACI',
        quotaLabel: 'Sabit Hat Aracı',
        segmentsToLoad: batch,
        ruleTag: 'BOLUM_3_10_KOCAELI_KAMYON_ESIGI',
        justification: `Bölüm 3.10: Kocaeli için ${kocPool.totalDesi.toLocaleString('tr-TR')} desi (≥ 7.000 desi eşiği) paket bulunduğundan Kamyon tutuldu.`,
        status: 'OPTIMIZE_EDILDI',
      });
      ankaraLines.push(line);
      currentSegments = remainder;
    } else {
      // < 7.000 desi: Paletleme seçeneği uygulanır ve Amazon TIR'ına yüklenir!
      const line = createAnkaraLine({
        lineCode: `ANK-KOC-PLT-01`,
        destinationId: 'KOCAELİ TM',
        vehicleType: 'TIR',
        capacityDesi: optParams.tirCapacityDesi, // 22.500 Amazon TIR kapasitesi (7.000 araç kapasitesi değil karar eşiğidir!)
        scheduleType: 'PALETLI_AMAZON_ARACI',
        scheduleLabel: 'Paletli Amazon TIR’ı (< 7.000 d Eşiği)',
        departureTime: '22:15',
        quotaType: 'SABIT_HAT_ARACI',
        quotaLabel: 'Paletli Amazon Aracı',
        segmentsToLoad: currentSegments,
        isPalletized: true,
        palletizedInfo: {
          isAmazonVehicle: true,
          palletDesi: kocPool.totalDesi,
          decisionThresholdDesi: 7000,
          explanation: `Bölüm 3.10 & 4: Kocaeli desisi (${kocPool.totalDesi.toLocaleString('tr-TR')} desi) 7.000 desinin altında kaldığından paletlenerek akşam Amazon TIR’ına yüklendi. 1 günlük teslimat korundu.`,
        },
        ruleTag: 'BOLUM_3_10_KOCAELI_PALETLEME',
        justification: `Bölüm 3.10 & 4: 7.000 desi altında kalan ${kocPool.totalDesi.toLocaleString('tr-TR')} desi Kocaeli paketi Amazon aracına paletlendi.`,
        status: 'PALETLI_AMAZON_SEVK',
      });
      ankaraLines.push(line);
      currentSegments = [];
    }

    // Taşan varsa ek araç
    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'KOC',
        'KOCAELİ TM',
        currentSegments,
        kamyonCap,
        'BOLUM_1_1_AYNI_GUN_EK_ARAC',
        'Bölüm 3.10 & 1.1: 1 günlük Kocaeli paketleri ertesi güne bırakılamayacağından'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // 3.11 ANKARA → ERZURUM (1 TIR Sabit, 22:00 Çıkış)
  // ----------------------------------------------------------------------------
  const erzPool = poolByDest['ERZURUM TM'];
  if (erzPool && erzPool.totalDesi > 0) {
    let currentSegments = [...erzPool.segments];
    const tirCap = optParams.tirCapacityDesi; // 22.500

    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, tirCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-ERZ-TIR-01`,
          destinationId: 'ERZURUM TM',
          vehicleType: 'TIR',
          capacityDesi: tirCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_11_ANKARA_ERZURUM',
          justification:
            'Bölüm 3.11: Ankara → Erzurum 1. Sabit TIR Ankara kendi toplaması ve Cross Dock paketleriyle 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'ERZ',
        'ERZURUM TM',
        currentSegments,
        optParams.kamyonCapacityDesi,
        'BOLUM_3_11_ERZURUM_EK_ARAC',
        'Bölüm 3.11: Erzurum sabit TIR kapasitesi dolduğundan'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // 3.12 ANKARA → GAZİANTEP (1 TIR Sabit, 22:00 Çıkış)
  // ----------------------------------------------------------------------------
  const gztPool = poolByDest['GAZİANTEP TM'];
  if (gztPool && gztPool.totalDesi > 0) {
    let currentSegments = [...gztPool.segments];
    const tirCap = optParams.tirCapacityDesi; // 22.500

    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, tirCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-GZT-TIR-01`,
          destinationId: 'GAZİANTEP TM',
          vehicleType: 'TIR',
          capacityDesi: tirCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_12_ANKARA_GAZIANTEP',
          justification:
            'Bölüm 3.12: Ankara → Gaziantep 1. Sabit TIR Ankara toplaması ve Cross Dock paketleriyle 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'GZT',
        'GAZİANTEP TM',
        currentSegments,
        optParams.kamyonCapacityDesi,
        'BOLUM_3_12_GAZIANTEP_EK_ARAC',
        'Bölüm 3.12: Gaziantep sabit TIR kapasitesi dolduğundan'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // 3.13 ANKARA → DİYARBAKIR (1 TIR Sabit, 22:00 Çıkış)
  // ----------------------------------------------------------------------------
  const dybPool = poolByDest['DİYARBAKIR TM'];
  if (dybPool && dybPool.totalDesi > 0) {
    let currentSegments = [...dybPool.segments];
    const tirCap = optParams.tirCapacityDesi; // 22.500

    if (currentSegments.length > 0) {
      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, tirCap);
      if (batch.length > 0) {
        const line = createAnkaraLine({
          lineCode: `ANK-DYB-TIR-01`,
          destinationId: 'DİYARBAKIR TM',
          vehicleType: 'TIR',
          capacityDesi: tirCap,
          scheduleType: 'SABIT_ARAC',
          scheduleLabel: 'Sabit Araç (22:00)',
          departureTime: '22:00',
          quotaType: 'SABIT_HAT_ARACI',
          quotaLabel: 'Sabit Hat Aracı',
          segmentsToLoad: batch,
          ruleTag: 'BOLUM_3_13_ANKARA_DIYARBAKIR',
          justification:
            'Bölüm 3.13: Ankara → Diyarbakır 1. Sabit TIR Ankara toplaması ve Cross Dock paketleriyle 22:00’de çıkarıldı.',
          status: 'MEVCUT_KORUNDU',
        });
        ankaraLines.push(line);
      }
      currentSegments = remainder;
    }

    const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
    if (remDesi > 0) {
      dispatchEkKamyonBatches(
        'DYB',
        'DİYARBAKIR TM',
        currentSegments,
        optParams.kamyonCapacityDesi,
        'BOLUM_3_13_DIYARBAKIR_EK_ARAC',
        'Bölüm 3.13: Diyarbakır sabit TIR kapasitesi dolduğundan'
      );
      currentSegments = [];
    }
  }

  // ----------------------------------------------------------------------------
  // DİĞER ANKARA VARIŞLARI: ANTALYA (Özel TIR), AKSARAY, MERZİFON, TRABZON, VAN
  // ----------------------------------------------------------------------------

  // Ankara → Antalya (1 Antalya Özel TIR - 6 TIR sınırının dışındadır!)
  const antPool = poolByDest['ANTALYA TM'];
  if (antPool && antPool.totalDesi > 0) {
    let currentSegments = [...antPool.segments];
    const tirCap = optParams.tirCapacityDesi; // 22.500

    const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, tirCap);
    if (batch.length > 0) {
      const line = createAnkaraLine({
        lineCode: `ANK-ANT-TIR-01`,
        destinationId: 'ANTALYA TM',
        vehicleType: 'TIR',
        capacityDesi: tirCap,
        scheduleType: 'SABIT_ARAC',
        scheduleLabel: 'Antalya Özel TIR (22:00)',
        departureTime: '22:00',
        quotaType: 'ANTALYA_OZEL_TIR',
        quotaLabel: 'Antalya Özel TIR',
        isAntalyaSpecialTir: true,
        segmentsToLoad: batch,
        ruleTag: 'BOLUM_2_ANTALYA_OZEL_TIR',
        justification:
          'Bölüm 2: Ankara → Antalya Özel TIR (6 araçlık normal limitin dışındadır) saat 22:00’de çıkarıldı.',
        status: 'MEVCUT_KORUNDU',
      });
      ankaraLines.push(line);
    }

    if (remainder.length > 0) {
      dispatchEkKamyonBatches(
        'ANT',
        'ANTALYA TM',
        remainder,
        optParams.kamyonCapacityDesi,
        'BOLUM_1_1_AYNI_GUN_EK_ARAC',
        'Bölüm 1.1: 1 günlük Antalya paketleri için'
      );
    }
  }

  // Ankara → Aksaray (1 Kamyon Sabit)
  const aksPool = poolByDest['AKSARAY TM'];
  if (aksPool && aksPool.totalDesi > 0) {
    let currentSegments = [...aksPool.segments];
    const kamyonCap = optParams.kamyonCapacityDesi; // 12.500

    const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, kamyonCap);
    if (batch.length > 0) {
      const line = createAnkaraLine({
        lineCode: `ANK-AKS-KAM-01`,
        destinationId: 'AKSARAY TM',
        vehicleType: 'KAMYON',
        capacityDesi: kamyonCap,
        scheduleType: 'SABIT_ARAC',
        scheduleLabel: 'Sabit Araç (22:00)',
        departureTime: '22:00',
        quotaType: 'SABIT_HAT_ARACI',
        quotaLabel: 'Sabit Hat Aracı',
        segmentsToLoad: batch,
        ruleTag: 'BOLUM_2_ANKARA_AKSARAY',
        justification: 'Ankara → Aksaray sabit kamyonu 22:00’de planlandı.',
        status: 'MEVCUT_KORUNDU',
      });
      ankaraLines.push(line);
    }

    if (remainder.length > 0) {
      dispatchEkKamyonBatches(
        'AKS',
        'AKSARAY TM',
        remainder,
        kamyonCap,
        'BOLUM_1_1_AYNI_GUN_EK_ARAC',
        '1 günlük Aksaray paketleri için'
      );
    }
  }

  // Kalan diğer tüm hedefler (Merzifon, Trabzon, Van vb.)
  const remainingDestIds = ['MERZİFON TM', 'TRABZON TM', 'VAN TM'];
  for (const rDestId of remainingDestIds) {
    const rPool = poolByDest[rDestId];
    if (!rPool || rPool.totalDesi <= 0) continue;

    let currentSegments = [...rPool.segments];
    let seq = 1;

    while (currentSegments.length > 0) {
      const remDesi = currentSegments.reduce((s, x) => s + x.desi, 0);
      const canUseTir = usedNormalTirCount < optParams.ankaraMaxOutboundTir;
      const isTir = canUseTir && remDesi > optParams.splitUpperThresholdDesi;
      const vType: VehicleCategory = isTir ? 'TIR' : 'KAMYON';
      const cap = isTir ? optParams.tirCapacityDesi : optParams.kamyonCapacityDesi;

      const { batch, remainder } = sliceSegmentsForCapacity(currentSegments, cap);
      const code = `ANK-${rDestId.substring(0, 3)}-${isTir ? 'TIR' : 'KAM'}-${String(seq++).padStart(2, '0')}`;

      const line = createAnkaraLine({
        lineCode: code,
        destinationId: rDestId,
        vehicleType: vType,
        capacityDesi: cap,
        scheduleType: seq === 2 ? 'SABIT_ARAC' : 'EK_ARAC',
        scheduleLabel: seq === 2 ? 'Sabit Araç (22:00)' : 'Ek Araç / Gece Sevk',
        departureTime: seq === 2 ? '22:00' : '23:15',
        quotaType: 'SABIT_HAT_ARACI',
        quotaLabel: 'Sabit Hat Aracı',
        segmentsToLoad: batch,
        ruleTag: `ANKARA_${rDestId.replace(/\s+/g, '_')}`,
        justification: `Ankara → ${rPool.destinationName} sevkiyatı ${vType} ile planlandı.`,
        status: 'OPTIMIZE_EDILDI',
      });
      ankaraLines.push(line);
      currentSegments = remainder;
    }
  }

  return {
    ankaraLines,
    ankaraMovements,
    unplannedShipments,
    usedNormalTirCount,
  };
}
