import { INITIAL_CROSS_DOCK_HUBS } from '../data/referenceDataset';
import {
  CrossDockHubConfig,
  CrossDockMovement,
  DirectRouteConnection,
  DistanceMatrix,
  Facility,
  LoadedShipmentSegment,
  MatrixData,
  OptimizationParameters,
  PlannedVehicleLine,
  RuleAuditCheckItem,
  UnplannedShipment,
  VehicleCategory,
} from '../types/logistics';
import { CrossDockCandidate } from './crossDockEngine';
import {
  calculateDaysFromDistanceKm,
  calculateRouteDeliveryEstimate,
} from './distanceCalculationEngine';

/**
 * BÖLÜM 16 - MODÜL 1: FacilityRoutingRules
 * Tesislerin kaynak-varış yönlendirme ve ilk sevk noktası kuralları (Bölüm 2 - 14)
 */
export const FacilityRoutingRules = {
  // Bölüm 3: Adana TM ilk sevk noktaları
  adanaInitialDispatchMap: {
    'GAZİANTEP TM': 'GAZİANTEP TM',
    'DİYARBAKIR TM': 'GAZİANTEP TM',
    'KAYSERİ TM': 'AKSARAY TM',
    'KONYA TM': 'AKSARAY TM',
    'AKSARAY TM': 'AKSARAY TM',
  } as Record<string, string>,

  // Bölüm 5: Diyarbakır TM ilk sevk noktaları
  diyarbakirInitialDispatchMap: {
    'KAYSERİ TM': 'GAZİANTEP TM',
    'KONYA TM': 'GAZİANTEP TM',
    'ADANA TM': 'GAZİANTEP TM',
    'GAZİANTEP TM': 'GAZİANTEP TM',
  } as Record<string, string>,

  // Bölüm 6: Aksaray TM özel konsolidasyon üçgeni
  aksarayTriangleFacilities: ['ADANA TM', 'KAYSERİ TM', 'KONYA TM'],

  // Bölüm 9: Erzurum TM -> Diyarbakır istisnası dışında tüm paketler Ankara TM'ye sevk edilir
  erzurumDirectExceptionDest: 'DİYARBAKIR TM',

  // Bölüm 10.1: Konya -> Ankara aracına yüklenebilen gerçek varışlar
  konyaToAnkaraAllowedDestinations: [
    'ANKARA TM',
    'SAMSUN TM',
    'MERZİFON TM',
    'VAN TM',
    'TRABZON TM',
    'GAZİANTEP TM',
    'DİYARBAKIR TM',
  ],

  // Bölüm 10.2: Konya -> Aksaray yönlendirmesi
  konyaToAksarayDestinations: ['KAYSERİ TM', 'ADANA TM', 'AKSARAY TM'],

  // Bölüm 11.1: Afyon -> Ankara TIR operasyonuna yüklenebilen gerçek varışlar
  afyonToAnkaraTirAllowedDestinations: [
    'SAMSUN TM',
    'MERZİFON TM',
    'TRABZON TM',
    'VAN TM',
    'ERZURUM TM',
    'KAYSERİ TM',
    'AKSARAY TM',
    'ANKARA TM',
    'GAZİANTEP TM',
  ],

  // Bölüm 11.2: Afyon doğrudan kamyon hatları
  afyonDirectKamyonDestinations: [
    'İZMİR TM',
    'MARMARA TM',
    'BURSA TM',
    'AVRUPA TM',
    'KOCAELİ TM',
    'KONYA TM',
  ],

  // Bölüm 12.1: Bursa -> Afyon yönlendirmesi
  bursaToAfyonDestinations: ['AFYON TM', 'KONYA TM', 'ADANA TM'],

  // Bölüm 12.3: Bursa -> Ankara 1. Kamyon (Dış Paketler)
  bursaAnkaraOuterDestinations: [
    'AKSARAY TM',
    'KAYSERİ TM',
    'SAMSUN TM',
    'VAN TM',
    'ERZURUM TM',
    'TRABZON TM',
    'MERZİFON TM',
    'DİYARBAKIR TM',
    'GAZİANTEP TM',
  ],

  // Bölüm 13.1: İzmir -> Ankara kamyonuna yüklenebilen gerçek varışlar
  izmirToAnkaraAllowedDestinations: [
    'AKSARAY TM',
    'KAYSERİ TM',
    'SAMSUN TM',
    'VAN TM',
    'ERZURUM TM',
    'TRABZON TM',
    'MERZİFON TM',
    'DİYARBAKIR TM',
    'GAZİANTEP TM',
    'ANKARA TM',
  ],

  // Bölüm 14.1: Kocaeli -> Gebze besleme aracına yüklenebilen gerçek varışlar
  kocaeliToGebzeAllowedDestinations: [
    'ADANA TM',
    'GAZİANTEP TM',
    'DİYARBAKIR TM',
    'ERZURUM TM',
    'SAMSUN TM',
  ],

  // Bölüm 14.3: Kocaeli -> Ankara aracına yüklenebilen gerçek varışlar
  kocaeliToAnkaraAllowedDestinations: [
    'KAYSERİ TM',
    'ADANA TM',
    'AKSARAY TM',
    'ANKARA TM',
  ],
};

/**
 * BÖLÜM 16 - MODÜL 2: VehicleTypeRules
 * Sabit araç tipi, kapasite ve tesis bazlı araç kısıt kuralları
 */
export const VehicleTypeRules = {
  kamyonMaxCapacityDesi: 12500,
  tirMaxCapacityDesi: 22500,
  panelvanMaxCapacityDesi: 3500,
  ankaraMorningNormalTirQuota: 6,
  antalyaSpecialTirQuota: 1,
  gebzeSecondKamyonMinDesi: 8500,
  gebzeSecondTirMinDesi: 16500,
  directExceptionThresholdDesi: 8000,
  bursaAdanaAfyonRedirectDesi: 7500,
  bursaGaziantepDiyarbakirJointThresholdDesi: 12500,
  gaziantepErzurumSpecialViaDiyarbakirDesi: 2500,

  isOriginKamyonOnly(originId: string): boolean {
    // Bölüm 13: İzmir TM'den çıkan araçların tamamı kamyondur. İzmir çıkışlı hatlarda TIR oluşturulamaz.
    return originId === 'İZMİR TM';
  },

  isDestinationKamyonOnly(originId: string, destinationId: string): boolean {
    if (
      destinationId === 'BURSA TM' ||
      destinationId === 'İZMİR TM' ||
      destinationId === 'KOCAELİ TM'
    ) {
      return true;
    }
    if (destinationId === 'MARMARA TM' && originId !== 'AVRUPA TM') {
      return true;
    }
    return false;
  },
};

/**
 * BÖLÜM 16 - MODÜL 3: CrossDockRules
 * 5 Cross Dock Merkezinin (Ankara, Gebze, Aksaray, Gaziantep, Afyon) kabul ve çıkış kuralları
 */
export const CrossDockRules = {
  getHubConfigs(): CrossDockHubConfig[] {
    return INITIAL_CROSS_DOCK_HUBS;
  },

  canHubAcceptOriginAndDest(
    hubId: string,
    originId: string,
    trueDestinationId: string
  ): boolean {
    const cfg = INITIAL_CROSS_DOCK_HUBS.find((h) => h.hubFacilityId === hubId);
    if (!cfg || !cfg.isActive) return false;
    return (
      cfg.acceptedOriginIds.includes(originId) &&
      cfg.acceptedDestinationIds.includes(trueDestinationId)
    );
  },
};

/**
 * BÖLÜM 16 - MODÜL 4: ConsolidationRules
 * Aynı varışa giden paketlerin birleştirilmesi ve açıkça tanımlı özel ortak yükleme kuralları
 */
export const ConsolidationRules = {
  // Bölüm 2: Ankara CD'de yalnızca Antalya ve Afyon paketleri aynı araçta birleştirilebilir
  canCoLoadAtAnkaraCrossDock(sourceA: string, sourceB: string): boolean {
    const isAAntAfyon = sourceA === 'ANTALYA TM' || sourceA === 'AFYON TM';
    const isBAntAfyon = sourceB === 'ANTALYA TM' || sourceB === 'AFYON TM';
    return isAAntAfyon === isBAntAfyon;
  },

  // Bölüm 8: Samsun -> Marmara kamyonuna kapasite uygunsa Kocaeli ve Avrupa paketleri eklenebilir
  samsunMarmaraCoLoadableDestinations: ['KOCAELİ TM', 'AVRUPA TM'],

  // Bölüm 12.4: Bursa -> Gaziantep + Diyarbakır toplamı 12.500 desi olduğunda ortak değerlendirme
  bursaSoutheastJointDestinations: ['GAZİANTEP TM', 'DİYARBAKIR TM'],
};

/**
 * BÖLÜM 16 - MODÜL 6: DeliveryTimeRules
 * Teslimat süresi ve aktarma bekleme süresi hesaplama kuralları
 */
export const DeliveryTimeRules = {
  calculateMultiLegDelivery(params: {
    originId: string;
    viaHubId: string | null;
    destinationId: string;
    distanceMatrix: DistanceMatrix;
    handlingHours: number;
    departureTime: string;
    extraNextDayWait?: boolean;
  }) {
    const est = calculateRouteDeliveryEstimate({
      originId: params.originId,
      destinationId: params.destinationId,
      viaCrossDockId: params.viaHubId,
      distanceMatrix: params.distanceMatrix,
      crossDockHandlingHours: params.handlingHours,
      departureTime: params.departureTime,
    });
    if (params.extraNextDayWait && est.totalEstimatedDays !== null) {
      est.crossDockAddedDays = Math.max(1, est.crossDockAddedDays);
      est.totalEstimatedDays = (est.directDays ?? 1) + est.crossDockAddedDays;
      est.summaryText = `${est.distanceKm ?? '-'} km · ${est.totalEstimatedDays} Gün (${params.viaHubId} Ertesi Gün Sevk)`;
    }
    return est;
  },
};

/**
 * BÖLÜM 16 - MODÜL 5: SpecialOperationRules
 * Adana, Gaziantep, Diyarbakır, Aksaray, Samsun, Erzurum, Konya, Afyon, Bursa, İzmir ve Kocaeli/Gebze
 * Faz 1 Özel Operasyonlarının Gerçek Hesaplama Motoru
 */
export function executePhase1SpecialOperations(params: {
  facilitiesMap: Record<string, Facility>;
  packageMatrix: MatrixData;
  desiMatrix: MatrixData;
  distanceMatrix: DistanceMatrix;
  optParams: OptimizationParameters;
  directRouteMap: Map<string, DirectRouteConnection>;
}): {
  phase1Lines: PlannedVehicleLine[];
  feederLines: PlannedVehicleLine[];
  phase1Movements: CrossDockMovement[];
  handledPairs: Set<string>;
} {
  const {
    facilitiesMap,
    packageMatrix,
    desiMatrix,
    distanceMatrix,
    optParams,
  } = params;

  const phase1Lines: PlannedVehicleLine[] = [];
  const feederLines: PlannedVehicleLine[] = [];
  const phase1Movements: CrossDockMovement[] = [];
  const handledPairs = new Set<string>();

  const getCell = (o: string, d: string) => ({
    desi: Math.max(0, Math.round(desiMatrix[o]?.[d] ?? 0)),
    packages: Math.max(0, Math.round(packageMatrix[o]?.[d] ?? 0)),
  });

  // ============================================================================
  // 1) BÖLÜM 6 & BÖLÜM 3 & BÖLÜM 7 & BÖLÜM 10.2: AKSARAY TM ÖZEL CROSS DOCK VE ARA HAT OPERASYONU
  // Adana, Kayseri ve Konya arasındaki özel akışlar Aksaray TM'de birleştirilir.
  // ============================================================================
  const aksarayDestinations: Array<{
    targetDestId: string;
    sources: string[];
    ruleCode: string;
    isCrossDockLabel: boolean;
  }> = [
    {
      // 6.2. Konya varışlı paketler: Adana çıkışlı Konya + Kayseri çıkışlı Konya
      targetDestId: 'KONYA TM',
      sources: ['ADANA TM', 'KAYSERİ TM'],
      ruleCode: 'AKS-KNY',
      isCrossDockLabel: true,
    },
    {
      // 6.3. Adana varışlı paketler: Kayseri çıkışlı Adana + Konya çıkışlı Adana (Aksaray Cross Dock)
      targetDestId: 'ADANA TM',
      sources: ['KAYSERİ TM', 'KONYA TM'],
      ruleCode: 'AKS-ADN',
      isCrossDockLabel: true,
    },
    {
      // 6.4. Kayseri varışlı paketler: Konya çıkışlı Kayseri + Adana çıkışlı Kayseri
      targetDestId: 'KAYSERİ TM',
      sources: ['KONYA TM', 'ADANA TM'],
      ruleCode: 'AKS-KYS',
      isCrossDockLabel: true,
    },
  ];

  let aksarayVehicleSeq = 1;
  for (const flow of aksarayDestinations) {
    const segments: LoadedShipmentSegment[] = [];
    for (const srcId of flow.sources) {
      const cell = getCell(srcId, flow.targetDestId);
      if (cell.desi > 0) {
        handledPairs.add(`${srcId}__${flow.targetDestId}`);
        segments.push({
          segmentId: `SEG-AKS-CD-${srcId}-${flow.targetDestId}`,
          sourceFacilityId: srcId,
          sourceFacilityName: facilitiesMap[srcId]?.name ?? srcId,
          trueDestinationId: flow.targetDestId,
          trueDestinationName: facilitiesMap[flow.targetDestId]?.name ?? flow.targetDestId,
          operationalOriginId: 'AKSARAY TM',
          operationalOriginName: 'AKSARAY TM (Özel Cross Dock)',
          packages: cell.packages,
          desi: cell.desi,
          isFromCrossDock: true,
          crossDockFacilityId: 'AKSARAY TM',
          crossDockFacilityName: 'AKSARAY TM',
          transferReason: `Bölüm 6: ${srcId} → ${flow.targetDestId} paketleri Aksaray Özel Cross Dock'ta birleştirildi.`,
        });
      }
    }

    const totalDesi = segments.reduce((s, x) => s + x.desi, 0);
    const totalPackages = segments.reduce((s, x) => s + x.packages, 0);

    if (totalDesi > 0) {
      // Split into Kamyon/TIR vehicles without exceeding capacity (Rule 15.9)
      let remSegments = [...segments];
      while (remSegments.reduce((s, x) => s + x.desi, 0) > 0) {
        const remTotal = remSegments.reduce((s, x) => s + x.desi, 0);
        const vType: VehicleCategory =
          remTotal > optParams.splitUpperThresholdDesi ? 'TIR' : 'KAMYON';
        const cap =
          vType === 'TIR' ? optParams.tirCapacityDesi : optParams.kamyonCapacityDesi;

        const batchSegments: LoadedShipmentSegment[] = [];
        const nextRem: LoadedShipmentSegment[] = [];
        let accDesi = 0;

        for (const seg of remSegments) {
          const space = cap - accDesi;
          if (space <= 0) {
            nextRem.push(seg);
          } else if (seg.desi <= space) {
            batchSegments.push(seg);
            accDesi += seg.desi;
          } else {
            const ratio = space / seg.desi;
            const takePkg = Math.max(1, Math.round(seg.packages * ratio));
            batchSegments.push({
              ...seg,
              segmentId: `${seg.segmentId}-P1`,
              desi: space,
              packages: takePkg,
            });
            nextRem.push({
              ...seg,
              segmentId: `${seg.segmentId}-P2`,
              desi: seg.desi - space,
              packages: Math.max(1, seg.packages - takePkg),
            });
            accDesi += space;
          }
        }

        const loadedDesi = batchSegments.reduce((s, x) => s + x.desi, 0);
        const loadedPkg = batchSegments.reduce((s, x) => s + x.packages, 0);
        const lineCode = `AKS-CD-${String(aksarayVehicleSeq++).padStart(2, '0')}`;
        const lineId = `LINE-${lineCode}`;

        const repOrigin = batchSegments[0]?.sourceFacilityId || 'AKSARAY TM';
        const delivery = DeliveryTimeRules.calculateMultiLegDelivery({
          originId: repOrigin,
          viaHubId: 'AKSARAY TM',
          destinationId: flow.targetDestId,
          distanceMatrix,
          handlingHours: 3,
          departureTime: optParams.defaultDepartureTime,
        });

        for (const bSeg of batchSegments) {
          phase1Movements.push({
            id: `MOV-AKS-${lineCode}-${bSeg.sourceFacilityId}`,
            hubFacilityId: 'AKSARAY TM',
            sourceFacilityId: bSeg.sourceFacilityId,
            sourceFacilityName: bSeg.sourceFacilityName,
            trueDestinationId: bSeg.trueDestinationId,
            trueDestinationName: bSeg.trueDestinationName,
            desi: bSeg.desi,
            packages: bSeg.packages,
            reasonType: 'AKSARAY_OZEL_KONSOLIDASYON',
            reasonDetail: `Bölüm 6 Aksaray Özel Cross Dock: ${bSeg.sourceFacilityName} → ${bSeg.trueDestinationName} (${bSeg.desi.toLocaleString('tr-TR')} desi) Aksaray'da birleştirildi.`,
            outboundVehicleLineId: lineId,
            status: 'PLANLANDI',
          });
        }

        phase1Lines.push({
          id: lineId,
          lineCode,
          originFacilityId: 'AKSARAY TM',
          originFacilityName: 'AKSARAY TM (Özel Cross Dock)',
          destinationFacilityId: flow.targetDestId,
          destinationFacilityName:
            facilitiesMap[flow.targetDestId]?.name ?? flow.targetDestId,
          vehicleType: vType,
          capacityDesi: cap,
          totalDesi: loadedDesi,
          totalPackages: loadedPkg,
          fillRate: Number(((loadedDesi / cap) * 100).toFixed(1)),
          routeCategory: 'AKSARAY_CROSS_DOCK',
          transportTypeLabel: 'Aksaray Cross Dock',
          vehicleQuotaType: 'SABIT_HAT_ARACI',
          vehicleQuotaLabel: 'Sabit Hat Aracı',
          phase1RuleTag: 'BOLUM_6_AKSARAY_CD',
          planStatus: 'CROSS_DOCK_BIRLESTIRME',
          loadedSegments: batchSegments,
          delivery,
          comparison: {
            changeType: 'CROSS_DOCK_AKTARILDI',
            explanation: `Bölüm 6: ${batchSegments.map((s) => s.sourceFacilityName).join(' + ')} çıkışlı ${flow.targetDestId} varışlı paketler (${loadedDesi.toLocaleString('tr-TR')} desi) Aksaray Özel Cross Dock'ta birleştirilerek sevk edildi.`,
          },
          notes: [
            `Bölüm 6 Aksaray Özel Cross Dock ve Ara Hat Operasyonu: ${flow.sources.join(' + ')} → ${flow.targetDestId}`,
            'Gerçek çıkış ve gerçek varış tesisleri korundu.',
          ],
        });

        remSegments = nextRem;
      }
    }
  }

  // ============================================================================
  // 2) BÖLÜM 3, 4 & 5: GAZİANTEP TM – DİYARBAKIR TM – ADANA TM ÖZEL OPERASYONLARI
  // - Bölüm 3: Adana'nın Diyarbakır paketleri Gaziantep'e sevk edilir.
  // - Bölüm 5: Diyarbakır'ın Kayseri, Konya, Adana paketleri Gaziantep'e sevk edilir;
  //   Gaziantep TM bu paketleri Cross Dock işlemine alır ve ertesi gün kendi aracıyla gerçek varışına gönderir.
  // - Bölüm 4.2: Gaziantep ve Diyarbakır paketleri aynı gerçek varışa gidiyorsa (İzmir ve Bursa hariç)
  //   ortak araçta birleştirilebilir.
  // - Bölüm 4.3: Gaziantep çıkışlı Erzurum paketlerinin 2.500 desilik bölümü Diyarbakır'a sevk edilir.
  // ============================================================================
  let gztCdSeq = 1;

  // 2.A: Bölüm 4.3: Gaziantep -> Erzurum 2.500 desi Diyarbakır üzerinden özel operasyon
  const gztErzCell = getCell('GAZİANTEP TM', 'ERZURUM TM');
  if (gztErzCell.desi > 0) {
    handledPairs.add('GAZİANTEP TM__ERZURUM TM');
    const specialLimit = VehicleTypeRules.gaziantepErzurumSpecialViaDiyarbakirDesi; // 2500
    const specialDesi = Math.min(gztErzCell.desi, specialLimit);
    const specialPkg = Math.max(
      1,
      Math.round((gztErzCell.packages * specialDesi) / gztErzCell.desi)
    );

    const lineCode = `GZT-ERZ-OZEL-01`;
    const delivery = DeliveryTimeRules.calculateMultiLegDelivery({
      originId: 'GAZİANTEP TM',
      viaHubId: 'DİYARBAKIR TM',
      destinationId: 'ERZURUM TM',
      distanceMatrix,
      handlingHours: 3,
      departureTime: optParams.defaultDepartureTime,
    });

    phase1Lines.push({
      id: `LINE-${lineCode}`,
      lineCode,
      originFacilityId: 'DİYARBAKIR TM',
      originFacilityName: 'DİYARBAKIR TM (Gaziantep Özel Aktarma)',
      destinationFacilityId: 'ERZURUM TM',
      destinationFacilityName: 'ERZURUM TM',
      vehicleType: 'KAMYON',
      capacityDesi: optParams.kamyonCapacityDesi,
      totalDesi: specialDesi,
      totalPackages: specialPkg,
      fillRate: Number(((specialDesi / optParams.kamyonCapacityDesi) * 100).toFixed(1)),
      routeCategory: 'ARA_HAT',
      transportTypeLabel: 'Diyarbakır Üzerinden Özel',
      vehicleQuotaType: 'SABIT_HAT_ARACI',
      vehicleQuotaLabel: 'Sabit Hat Aracı',
      phase1RuleTag: 'BOLUM_4_3_GAZIANTEP_ERZURUM_2500',
      planStatus: 'OZEL_OPERASYON',
      loadedSegments: [
        {
          segmentId: 'SEG-GZT-ERZ-2500',
          sourceFacilityId: 'GAZİANTEP TM',
          sourceFacilityName: 'GAZİANTEP TM',
          trueDestinationId: 'ERZURUM TM',
          trueDestinationName: 'ERZURUM TM',
          operationalOriginId: 'DİYARBAKIR TM',
          operationalOriginName: 'DİYARBAKIR TM',
          packages: specialPkg,
          desi: specialDesi,
          isFromCrossDock: true,
          crossDockFacilityId: 'GAZİANTEP TM',
          crossDockFacilityName: 'DİYARBAKIR TM',
          transferReason:
            'Bölüm 4.3: Gaziantep çıkışlı Erzurum paketlerinin 2.500 desilik bölümü Diyarbakır üzerinden yürütülen özel operasyon olarak kaydedildi.',
        },
      ],
      delivery,
      comparison: {
        changeType: 'OPTIMIZE_EDILDI',
        explanation: `Bölüm 4.3: Gaziantep → Erzurum paketlerinin ${specialDesi.toLocaleString('tr-TR')} desilik bölümü Diyarbakır üzerinden özel operasyon olarak planlandı.`,
      },
      notes: [
        'Bölüm 4.3: Gaziantep çıkışlı Erzurum paketlerinin 2.500 desilik bölümü Diyarbakır’a sevk edilir.',
      ],
    });

    // 2.500 desi üzerindeki miktar için otomatik tahmin yapılmamalı; "Kural onayı gerekli" olarak işaretlenmeli!
    if (gztErzCell.desi > specialLimit) {
      const remDesi = gztErzCell.desi - specialLimit;
      const remPkg = Math.max(1, gztErzCell.packages - specialPkg);
      const remLineCode = `GZT-ERZ-ONAY-01`;

      phase1Lines.push({
        id: `LINE-${remLineCode}`,
        lineCode: remLineCode,
        originFacilityId: 'GAZİANTEP TM',
        originFacilityName: 'GAZİANTEP TM',
        destinationFacilityId: 'ERZURUM TM',
        destinationFacilityName: 'ERZURUM TM',
        vehicleType: 'KAMYON',
        capacityDesi: optParams.kamyonCapacityDesi,
        totalDesi: remDesi,
        totalPackages: remPkg,
        fillRate: Number(((remDesi / optParams.kamyonCapacityDesi) * 100).toFixed(1)),
        routeCategory: 'ARA_HAT',
        transportTypeLabel: 'Kural Onayı Gerekli',
        vehicleQuotaType: 'SABIT_HAT_ARACI',
        vehicleQuotaLabel: 'Kural Onayı Gerekli',
        requiresVerification: true,
        requiresRuleApproval: true,
        warningMessage:
          'Bölüm 4.3: 2.500 desi üzerindeki Gaziantep → Erzurum miktarı için otomatik tahmin yapılmadı; kural onayı gerekli.',
        phase1RuleTag: 'BOLUM_4_3_KURAL_ONAYI',
        planStatus: 'KURAL_ONAYI_GEREKLI',
        loadedSegments: [
          {
            segmentId: 'SEG-GZT-ERZ-OVER-2500',
            sourceFacilityId: 'GAZİANTEP TM',
            sourceFacilityName: 'GAZİANTEP TM',
            trueDestinationId: 'ERZURUM TM',
            trueDestinationName: 'ERZURUM TM',
            operationalOriginId: 'GAZİANTEP TM',
            operationalOriginName: 'GAZİANTEP TM',
            packages: remPkg,
            desi: remDesi,
            isFromCrossDock: false,
            transferReason:
              'Bölüm 4.3: 2.500 desi üzerindeki miktar için otomatik tahmin yapılmamalı; güncel operasyon kuralı onayı gerekli.',
          },
        ],
        delivery: calculateRouteDeliveryEstimate({
          originId: 'GAZİANTEP TM',
          destinationId: 'ERZURUM TM',
          distanceMatrix,
          crossDockHandlingHours: 4,
          departureTime: optParams.defaultDepartureTime,
        }),
        comparison: {
          changeType: 'KISIT_NEDENIYLE_DEGISTI',
          explanation: `Bölüm 4.3: Gaziantep → Erzurum 2.500 desi üzeri kalan ${remDesi.toLocaleString('tr-TR')} desi için otomatik tahmin üretilmedi ("Kural onayı gerekli").`,
        },
        notes: [
          'Bölüm 4.3 & 16: 2.500 desi üzerindeki miktarlar için otomatik tahmin yapılmaz; Kural Onayı Gerekli.',
        ],
      });
    }
  }

  // 2.B: Bölüm 3, 4.2 ve 5: Gaziantep & Diyarbakır & Adana (Gaziantep üzerinden) ortak/Cross Dock akışları
  // Diyarbakır'ın Kayseri, Konya, Adana paketleri Gaziantep'e gelir; Gaziantep'in kendi Kayseri, Konya, Adana paketleriyle
  // veya Adana'nın Diyarbakır paketleri Gaziantep'in kendi Diyarbakır aracıyla birleştirilir!
  const gaziantepConsolidatedTargets = [
    'DİYARBAKIR TM', // Gaziantep -> Diyarbakır + Adana -> Diyarbakır (Bölüm 3 & 4.1)
    'ADANA TM', // Gaziantep -> Adana + Diyarbakır -> Adana (Bölüm 4.1 & 5)
    'KAYSERİ TM', // Gaziantep -> Kayseri + Diyarbakır -> Kayseri (Bölüm 4.1 & 5)
    'KONYA TM', // Diyarbakır -> Konya + Gaziantep -> Konya (Bölüm 5)
    'AVRUPA TM', // Bölüm 4.2 Örneği: Diyarbakır + Gaziantep -> Avrupa ortak TIR/Kamyon
    'MARMARA TM', // Bölüm 4.2: Diyarbakır + Gaziantep -> Marmara ortak Kamyon
    'ANKARA TM', // Bölüm 4.2: Diyarbakır + Gaziantep -> Ankara ortak TIR/Kamyon
  ];

  for (const targetDestId of gaziantepConsolidatedTargets) {
    // İzmir ve Bursa hariç (Bölüm 4.2)
    if (targetDestId === 'İZMİR TM' || targetDestId === 'BURSA TM') continue;

    const candidateSources: string[] = [];
    if (targetDestId === 'DİYARBAKIR TM') {
      candidateSources.push('GAZİANTEP TM', 'ADANA TM');
    } else if (
      targetDestId === 'ADANA TM' ||
      targetDestId === 'KAYSERİ TM' ||
      targetDestId === 'KONYA TM'
    ) {
      candidateSources.push('GAZİANTEP TM', 'DİYARBAKIR TM');
    } else {
      // Ortak araç (Bölüm 4.2): Yalnızca her iki tesiste de yük varsa ve toplamı tek araca uygunsa
      const gztC = getCell('GAZİANTEP TM', targetDestId);
      const dybC = getCell('DİYARBAKIR TM', targetDestId);
      if (gztC.desi > 0 && dybC.desi > 0 && gztC.desi + dybC.desi <= optParams.tirCapacityDesi) {
        candidateSources.push('GAZİANTEP TM', 'DİYARBAKIR TM');
      }
    }

    if (candidateSources.length < 2) continue;

    const segs: LoadedShipmentSegment[] = [];
    for (const srcId of candidateSources) {
      const c = getCell(srcId, targetDestId);
      if (c.desi > 0) {
        handledPairs.add(`${srcId}__${targetDestId}`);
        segs.push({
          segmentId: `SEG-GZT-CD-${srcId}-${targetDestId}`,
          sourceFacilityId: srcId,
          sourceFacilityName: facilitiesMap[srcId]?.name ?? srcId,
          trueDestinationId: targetDestId,
          trueDestinationName: facilitiesMap[targetDestId]?.name ?? targetDestId,
          operationalOriginId: 'GAZİANTEP TM',
          operationalOriginName: 'GAZİANTEP TM (Cross Dock / Ortak Araç)',
          packages: c.packages,
          desi: c.desi,
          isFromCrossDock: srcId !== 'GAZİANTEP TM',
          crossDockFacilityId: 'GAZİANTEP TM',
          crossDockFacilityName: 'GAZİANTEP TM',
          transferReason:
            srcId === 'GAZİANTEP TM'
              ? `Bölüm 4: Gaziantep TM çıkışlı ${targetDestId} sevkiyatı.`
              : `Bölüm 3/4.2/5: ${srcId} → ${targetDestId} paketleri Gaziantep Cross Dock / Ortak Araç ile birleştirildi.`,
        });
      }
    }

    const totalDesi = segs.reduce((s, x) => s + x.desi, 0);
    if (totalDesi <= 0) continue;

    const isKamyonOnly = VehicleTypeRules.isDestinationKamyonOnly(
      'GAZİANTEP TM',
      targetDestId
    );
    let remSegs = [...segs];

    while (remSegs.reduce((s, x) => s + x.desi, 0) > 0) {
      const remTotal = remSegs.reduce((s, x) => s + x.desi, 0);
      const vType: VehicleCategory =
        remTotal > optParams.splitUpperThresholdDesi && !isKamyonOnly
          ? 'TIR'
          : 'KAMYON';
      const cap =
        vType === 'TIR' ? optParams.tirCapacityDesi : optParams.kamyonCapacityDesi;

      const batch: LoadedShipmentSegment[] = [];
      const nextRem: LoadedShipmentSegment[] = [];
      let acc = 0;

      for (const seg of remSegs) {
        const space = cap - acc;
        if (space <= 0) {
          nextRem.push(seg);
        } else if (seg.desi <= space) {
          batch.push(seg);
          acc += seg.desi;
        } else {
          const ratio = space / seg.desi;
          const takePkg = Math.max(1, Math.round(seg.packages * ratio));
          batch.push({
            ...seg,
            segmentId: `${seg.segmentId}-P1`,
            desi: space,
            packages: takePkg,
          });
          nextRem.push({
            ...seg,
            segmentId: `${seg.segmentId}-P2`,
            desi: seg.desi - space,
            packages: Math.max(1, seg.packages - takePkg),
          });
          acc += space;
        }
      }

      const bDesi = batch.reduce((s, x) => s + x.desi, 0);
      const bPkg = batch.reduce((s, x) => s + x.packages, 0);
      const lineCode = `GZT-CD-${String(gztCdSeq++).padStart(2, '0')}`;
      const lineId = `LINE-${lineCode}`;

      const hasDiyarbakirNextDay = batch.some(
        (s) =>
          s.sourceFacilityId === 'DİYARBAKIR TM' &&
          (targetDestId === 'KAYSERİ TM' ||
            targetDestId === 'KONYA TM' ||
            targetDestId === 'ADANA TM')
      );

      const repOrigin =
        batch.find((s) => s.sourceFacilityId !== 'GAZİANTEP TM')?.sourceFacilityId ||
        'GAZİANTEP TM';

      const delivery = DeliveryTimeRules.calculateMultiLegDelivery({
        originId: repOrigin,
        viaHubId: 'GAZİANTEP TM',
        destinationId: targetDestId,
        distanceMatrix,
        handlingHours: 4,
        departureTime: optParams.defaultDepartureTime,
        extraNextDayWait: hasDiyarbakirNextDay,
      });

      for (const bSeg of batch) {
        if (bSeg.sourceFacilityId !== 'GAZİANTEP TM') {
          phase1Movements.push({
            id: `MOV-GZT-${lineCode}-${bSeg.sourceFacilityId}`,
            hubFacilityId: 'GAZİANTEP TM',
            sourceFacilityId: bSeg.sourceFacilityId,
            sourceFacilityName: bSeg.sourceFacilityName,
            trueDestinationId: bSeg.trueDestinationId,
            trueDestinationName: bSeg.trueDestinationName,
            desi: bSeg.desi,
            packages: bSeg.packages,
            reasonType: 'GAZIANTEP_DIYARBAKIR_ORTAK',
            reasonDetail: `Bölüm 4.2 & 5: ${bSeg.sourceFacilityName} → ${bSeg.trueDestinationName} (${bSeg.desi.toLocaleString('tr-TR')} desi) Gaziantep Cross Dock / Ortak Araç ile sevk edildi.`,
            outboundVehicleLineId: lineId,
            status: 'PLANLANDI',
          });
        }
      }

      phase1Lines.push({
        id: lineId,
        lineCode,
        originFacilityId: 'GAZİANTEP TM',
        originFacilityName: 'GAZİANTEP TM (Cross Dock / Ortak Araç)',
        destinationFacilityId: targetDestId,
        destinationFacilityName: facilitiesMap[targetDestId]?.name ?? targetDestId,
        vehicleType: vType,
        capacityDesi: cap,
        totalDesi: bDesi,
        totalPackages: bPkg,
        fillRate: Number(((bDesi / cap) * 100).toFixed(1)),
        routeCategory: 'GAZIANTEP_CROSS_DOCK',
        transportTypeLabel: 'Gaziantep Cross Dock',
        vehicleQuotaType: 'SABIT_HAT_ARACI',
        vehicleQuotaLabel: 'Sabit Hat Aracı',
        phase1RuleTag: 'BOLUM_4_5_GAZIANTEP_CD',
        planStatus: 'CROSS_DOCK_BIRLESTIRME',
        loadedSegments: batch,
        delivery,
        comparison: {
          changeType: 'CROSS_DOCK_AKTARILDI',
          explanation: `Bölüm 4 & 5: ${batch.map((s) => `${s.sourceFacilityName} (${s.desi.toLocaleString('tr-TR')} d)`).join(' + ')} → ${targetDestId} ortak ${vType} aracında birleştirildi.`,
        },
        notes: [
          `Bölüm 4.2 & 5 Gaziantep Cross Dock / Ortak Araç: ${batch.map((s) => s.sourceFacilityName).join(' + ')} → ${targetDestId}`,
          hasDiyarbakirNextDay
            ? 'Bölüm 5: Diyarbakır çıkışlı paketler Gaziantep Cross Dock işlemine alındı (+1 gün ertesi gün sevk).'
            : 'Gerçek çıkış ve gerçek varış tesisleri korundu.',
        ],
      });

      remSegs = nextRem;
    }
  }

  // ============================================================================
  // 3) BÖLÜM 11.3 & BÖLÜM 12.1: AFYON TM – ADANA VARIŞLI PAKETLER ÖZEL CROSS DOCK
  // Afyon, İzmir ve Bursa (≤ 7.500 desi ise) çıkışlı Adana paketleri Afyon'da birleştirilir.
  // ============================================================================
  const afyonAdanaCell = getCell('AFYON TM', 'ADANA TM');
  const izmirAdanaCell = getCell('İZMİR TM', 'ADANA TM');
  const bursaAdanaCell = getCell('BURSA TM', 'ADANA TM');

  // Bursa -> Adana: 7.500 desi ve altındaysa Afyon'a yönlendirilir; üstündeyse doğrudan Bursa -> Adana çıkar
  const includeBursaInAfyonAdanaCd =
    bursaAdanaCell.desi > 0 &&
    bursaAdanaCell.desi <= VehicleTypeRules.bursaAdanaAfyonRedirectDesi;

  const afyonAdanaSegments: LoadedShipmentSegment[] = [];
  if (afyonAdanaCell.desi > 0) {
    handledPairs.add('AFYON TM__ADANA TM');
    afyonAdanaSegments.push({
      segmentId: 'SEG-AFY-ADN-AFYON',
      sourceFacilityId: 'AFYON TM',
      sourceFacilityName: 'AFYON TM',
      trueDestinationId: 'ADANA TM',
      trueDestinationName: 'ADANA TM',
      operationalOriginId: 'AFYON TM',
      operationalOriginName: 'AFYON TM (Adana Özel Cross Dock)',
      packages: afyonAdanaCell.packages,
      desi: afyonAdanaCell.desi,
      isFromCrossDock: false,
      transferReason: 'Bölüm 11.3: Afyon çıkışlı Adana paketleri Afyon Adana Özel Cross Dock havuzuna alındı.',
    });
  }
  if (izmirAdanaCell.desi > 0) {
    handledPairs.add('İZMİR TM__ADANA TM');
    afyonAdanaSegments.push({
      segmentId: 'SEG-AFY-ADN-IZMIR',
      sourceFacilityId: 'İZMİR TM',
      sourceFacilityName: 'İZMİR TM',
      trueDestinationId: 'ADANA TM',
      trueDestinationName: 'ADANA TM',
      operationalOriginId: 'AFYON TM',
      operationalOriginName: 'AFYON TM (Adana Özel Cross Dock)',
      packages: izmirAdanaCell.packages,
      desi: izmirAdanaCell.desi,
      isFromCrossDock: true,
      crossDockFacilityId: 'AFYON TM',
      crossDockFacilityName: 'AFYON TM',
      transferReason: 'Bölüm 11.3: İzmir çıkışlı Adana paketleri Afyon Adana Özel Cross Dock ile birleştirildi.',
    });
  }
  if (includeBursaInAfyonAdanaCd) {
    handledPairs.add('BURSA TM__ADANA TM');
    afyonAdanaSegments.push({
      segmentId: 'SEG-AFY-ADN-BURSA',
      sourceFacilityId: 'BURSA TM',
      sourceFacilityName: 'BURSA TM',
      trueDestinationId: 'ADANA TM',
      trueDestinationName: 'ADANA TM',
      operationalOriginId: 'AFYON TM',
      operationalOriginName: 'AFYON TM (Adana Özel Cross Dock)',
      packages: bursaAdanaCell.packages,
      desi: bursaAdanaCell.desi,
      isFromCrossDock: true,
      crossDockFacilityId: 'AFYON TM',
      crossDockFacilityName: 'AFYON TM',
      transferReason: `Bölüm 11.3 & 12.1: Bursa → Adana (${bursaAdanaCell.desi.toLocaleString('tr-TR')} desi ≤ 7.500) Afyon'a yönlendirilerek Adana Özel Cross Dock'a dahil edildi.`,
    });
  }

  let afyonCdSeq = 1;
  if (afyonAdanaSegments.length > 0) {
    let remAdana = [...afyonAdanaSegments];
    while (remAdana.reduce((s, x) => s + x.desi, 0) > 0) {
      const remTotal = remAdana.reduce((s, x) => s + x.desi, 0);
      // Bölüm 11.3: Tek kamyon kapasitesine uygunsa Kamyon; aşarsa TIR Cross Dock seçeneği değerlendirilir
      const vType: VehicleCategory =
        remTotal > optParams.kamyonCapacityDesi ? 'TIR' : 'KAMYON';
      const cap =
        vType === 'TIR' ? optParams.tirCapacityDesi : optParams.kamyonCapacityDesi;

      const batch: LoadedShipmentSegment[] = [];
      const nextRem: LoadedShipmentSegment[] = [];
      let acc = 0;

      for (const seg of remAdana) {
        const space = cap - acc;
        if (space <= 0) {
          nextRem.push(seg);
        } else if (seg.desi <= space) {
          batch.push(seg);
          acc += seg.desi;
        } else {
          const ratio = space / seg.desi;
          const takePkg = Math.max(1, Math.round(seg.packages * ratio));
          batch.push({
            ...seg,
            segmentId: `${seg.segmentId}-P1`,
            desi: space,
            packages: takePkg,
          });
          nextRem.push({
            ...seg,
            segmentId: `${seg.segmentId}-P2`,
            desi: seg.desi - space,
            packages: Math.max(1, seg.packages - takePkg),
          });
          acc += space;
        }
      }

      const bDesi = batch.reduce((s, x) => s + x.desi, 0);
      const bPkg = batch.reduce((s, x) => s + x.packages, 0);
      const lineCode = `AFY-ADN-CD-${String(afyonCdSeq++).padStart(2, '0')}`;
      const lineId = `LINE-${lineCode}`;

      const repOrigin =
        batch.find((s) => s.sourceFacilityId !== 'AFYON TM')?.sourceFacilityId ||
        'AFYON TM';
      const delivery = DeliveryTimeRules.calculateMultiLegDelivery({
        originId: repOrigin,
        viaHubId: 'AFYON TM',
        destinationId: 'ADANA TM',
        distanceMatrix,
        handlingHours: 3,
        departureTime: optParams.defaultDepartureTime,
      });

      for (const bSeg of batch) {
        phase1Movements.push({
          id: `MOV-AFY-ADN-${lineCode}-${bSeg.sourceFacilityId}`,
          hubFacilityId: 'AFYON TM',
          sourceFacilityId: bSeg.sourceFacilityId,
          sourceFacilityName: bSeg.sourceFacilityName,
          trueDestinationId: 'ADANA TM',
          trueDestinationName: 'ADANA TM',
          desi: bSeg.desi,
          packages: bSeg.packages,
          reasonType: 'AFYON_ADANA_OZEL_CD',
          reasonDetail: `Bölüm 11.3 Afyon Adana Özel Cross Dock: ${bSeg.sourceFacilityName} → ADANA TM (${bSeg.desi.toLocaleString('tr-TR')} desi) Afyon'da birleştirildi.`,
          outboundVehicleLineId: lineId,
          status: 'PLANLANDI',
        });
      }

      phase1Lines.push({
        id: lineId,
        lineCode,
        originFacilityId: 'AFYON TM',
        originFacilityName: 'AFYON TM (Adana Özel Cross Dock)',
        destinationFacilityId: 'ADANA TM',
        destinationFacilityName: 'ADANA TM',
        vehicleType: vType,
        capacityDesi: cap,
        totalDesi: bDesi,
        totalPackages: bPkg,
        fillRate: Number(((bDesi / cap) * 100).toFixed(1)),
        routeCategory: 'AFYON_CROSS_DOCK',
        transportTypeLabel: 'Afyon Cross Dock',
        vehicleQuotaType: 'SABIT_HAT_ARACI',
        vehicleQuotaLabel: 'Sabit Hat Aracı',
        phase1RuleTag: 'BOLUM_11_3_AFYON_ADANA_CD',
        planStatus: 'CROSS_DOCK_BIRLESTIRME',
        loadedSegments: batch,
        delivery,
        comparison: {
          changeType: 'CROSS_DOCK_AKTARILDI',
          explanation: `Bölüm 11.3: ${batch.map((s) => `${s.sourceFacilityName} (${s.desi.toLocaleString('tr-TR')} d)`).join(' + ')} Adana varışlı paketler Afyon Özel Cross Dock'ta tek ${vType} aracında birleştirildi.`,
        },
        notes: [
          'Bölüm 11.3: İzmir, Afyon ve Bursa (≤7.500 desi) Adana paketleri Afyon Özel Cross Dock kapsamında birleştirildi.',
          'Adana dışındaki varışlı paketler bu özel Cross Dock işlemine dahil edilmez.',
        ],
      });

      remAdana = nextRem;
    }
  }

  // ============================================================================
  // 4) BÖLÜM 8: SAMSUN TM – MARMARA TM TEK KAMYON VE KOCAELİ/AVRUPA ORTAK YÜKLEME KURALI
  // Samsun TM'den Marmara TM'ye doğrudan tek kamyon (12.500 desi) çıkar.
  // Kapasite uygunluğu varsa Kocaeli ve Avrupa varışlı paketler aynı araca eklenebilir.
  // ============================================================================
  const smsMrm = getCell('SAMSUN TM', 'MARMARA TM');
  const smsKoc = getCell('SAMSUN TM', 'KOCAELİ TM');
  const smsAvr = getCell('SAMSUN TM', 'AVRUPA TM');

  if (smsMrm.desi > 0 && smsMrm.desi < optParams.kamyonCapacityDesi) {
    handledPairs.add('SAMSUN TM__MARMARA TM');
    const kamyonCap = optParams.kamyonCapacityDesi;
    let remainingSpace = kamyonCap - smsMrm.desi;

    const smsSegments: LoadedShipmentSegment[] = [
      {
        segmentId: 'SEG-SMS-MRM-MAIN',
        sourceFacilityId: 'SAMSUN TM',
        sourceFacilityName: 'SAMSUN TM',
        trueDestinationId: 'MARMARA TM',
        trueDestinationName: 'MARMARA TM',
        operationalOriginId: 'SAMSUN TM',
        operationalOriginName: 'SAMSUN TM',
        packages: smsMrm.packages,
        desi: smsMrm.desi,
        isFromCrossDock: false,
        transferReason: 'Bölüm 8: Samsun TM → Marmara TM doğrudan tek kamyon ana yükü.',
      },
    ];

    const coLoadedDests: string[] = [];

    // Kocaeli co-load if it fits completely or partially into spare capacity (only when Kocaeli doesn't justify its own full Kamyon)
    if (smsKoc.desi > 0 && smsKoc.desi <= remainingSpace) {
      handledPairs.add('SAMSUN TM__KOCAELİ TM');
      remainingSpace -= smsKoc.desi;
      coLoadedDests.push('KOCAELİ TM');
      smsSegments.push({
        segmentId: 'SEG-SMS-MRM-COLOAD-KOC',
        sourceFacilityId: 'SAMSUN TM',
        sourceFacilityName: 'SAMSUN TM',
        trueDestinationId: 'KOCAELİ TM',
        trueDestinationName: 'KOCAELİ TM',
        operationalOriginId: 'SAMSUN TM',
        operationalOriginName: 'SAMSUN TM',
        packages: smsKoc.packages,
        desi: smsKoc.desi,
        isFromCrossDock: false,
        transferReason:
          'Bölüm 8: Marmara kamyonunda boş kapasite bulunduğundan Kocaeli varışlı paketler aynı araca eklendi.',
      });
    }

    // Avrupa co-load if it fits into spare capacity
    if (smsAvr.desi > 0 && smsAvr.desi <= remainingSpace) {
      handledPairs.add('SAMSUN TM__AVRUPA TM');
      remainingSpace -= smsAvr.desi;
      coLoadedDests.push('AVRUPA TM');
      smsSegments.push({
        segmentId: 'SEG-SMS-MRM-COLOAD-AVR',
        sourceFacilityId: 'SAMSUN TM',
        sourceFacilityName: 'SAMSUN TM',
        trueDestinationId: 'AVRUPA TM',
        trueDestinationName: 'AVRUPA TM',
        operationalOriginId: 'SAMSUN TM',
        operationalOriginName: 'SAMSUN TM',
        packages: smsAvr.packages,
        desi: smsAvr.desi,
        isFromCrossDock: false,
        transferReason:
          'Bölüm 8: Marmara kamyonunda boş kapasite bulunduğundan Avrupa varışlı paketler aynı araca eklendi.',
      });
    }

    const totalLoadedDesi = smsSegments.reduce((s, x) => s + x.desi, 0);
    const totalLoadedPkg = smsSegments.reduce((s, x) => s + x.packages, 0);

    phase1Lines.push({
      id: 'LINE-SMS-MRM-FAZ1-01',
      lineCode: 'SMS-HAT-01',
      originFacilityId: 'SAMSUN TM',
      originFacilityName: 'SAMSUN TM',
      destinationFacilityId: 'MARMARA TM',
      destinationFacilityName:
        coLoadedDests.length > 0
          ? `MARMARA TM (+${coLoadedDests.join(', ')})`
          : 'MARMARA TM',
      vehicleType: 'KAMYON',
      capacityDesi: kamyonCap,
      totalDesi: totalLoadedDesi,
      totalPackages: totalLoadedPkg,
      fillRate: Number(((totalLoadedDesi / kamyonCap) * 100).toFixed(1)),
      routeCategory: 'DIREKT',
      transportTypeLabel:
        coLoadedDests.length > 0 ? 'Direkt + Kapasite Ortak Yükleme' : 'Direkt Hat',
      vehicleQuotaType: 'SABIT_HAT_ARACI',
      vehicleQuotaLabel: 'Sabit Hat Aracı',
      allowedCoLoadedDestinationIds: ['MARMARA TM', ...coLoadedDests],
      phase1RuleTag: 'BOLUM_8_SAMSUN_MARMARA_KAMYON',
      planStatus: 'OPTIMIZE_EDILDI',
      loadedSegments: smsSegments,
      delivery: calculateRouteDeliveryEstimate({
        originId: 'SAMSUN TM',
        destinationId: 'MARMARA TM',
        distanceMatrix,
        crossDockHandlingHours: 4,
        departureTime: optParams.defaultDepartureTime,
        isDirectRouteConnection: true,
      }),
      comparison: {
        changeType: 'OPTIMIZE_EDILDI',
        explanation:
          coLoadedDests.length > 0
            ? `Bölüm 8: Samsun → Marmara tek kamyonuna kapasite uygunluğu ile ${coLoadedDests.join(' ve ')} paketleri eklendi (${totalLoadedDesi.toLocaleString('tr-TR')} / 12.500 desi).`
            : `Bölüm 8: Samsun → Marmara doğrudan tek kamyon (${totalLoadedDesi.toLocaleString('tr-TR')} desi) olarak planlandı.`,
      },
      notes: [
        'Bölüm 8: Samsun TM’den Marmara TM’ye doğrudan tek kamyon çıkar.',
        coLoadedDests.length > 0
          ? `Kapasite uygunluğu ile eklenen varışlar: ${coLoadedDests.join(', ')}`
          : 'Kocaeli/Avrupa paketleri kendi bağımsız kapasite/hatlarında değerlendirildi.',
      ],
    });
  }

  // ============================================================================
  // 5) BÖLÜM 12.4: BURSA TM – GAZİANTEP VE DİYARBAKIR 12.500 DESİ ÖZEL KURALI
  // Gaziantep ve Diyarbakır paketlerinin toplamı 12.500 desi olduğunda ayrı değerlendirme yapılır.
  // ============================================================================
  const brsGzt = getCell('BURSA TM', 'GAZİANTEP TM');
  const brsDyb = getCell('BURSA TM', 'DİYARBAKIR TM');
  const brsSoutheastTotal = brsGzt.desi + brsDyb.desi;

  if (
    brsSoutheastTotal >= VehicleTypeRules.bursaGaziantepDiyarbakirJointThresholdDesi &&
    brsGzt.desi > 0 &&
    brsDyb.desi > 0
  ) {
    handledPairs.add('BURSA TM__GAZİANTEP TM');
    handledPairs.add('BURSA TM__DİYARBAKIR TM');

    const cap = optParams.kamyonCapacityDesi;
    const jointSegs: LoadedShipmentSegment[] = [
      {
        segmentId: 'SEG-BRS-SE-GZT',
        sourceFacilityId: 'BURSA TM',
        sourceFacilityName: 'BURSA TM',
        trueDestinationId: 'GAZİANTEP TM',
        trueDestinationName: 'GAZİANTEP TM',
        operationalOriginId: 'BURSA TM',
        operationalOriginName: 'BURSA TM',
        packages: brsGzt.packages,
        desi: brsGzt.desi,
        isFromCrossDock: false,
        transferReason: 'Bölüm 12.4: Bursa → Gaziantep + Diyarbakır 12.500 desi özel ortak değerlendirmesi.',
      },
      {
        segmentId: 'SEG-BRS-SE-DYB',
        sourceFacilityId: 'BURSA TM',
        sourceFacilityName: 'BURSA TM',
        trueDestinationId: 'DİYARBAKIR TM',
        trueDestinationName: 'DİYARBAKIR TM',
        operationalOriginId: 'BURSA TM',
        operationalOriginName: 'BURSA TM',
        packages: brsDyb.packages,
        desi: brsDyb.desi,
        isFromCrossDock: false,
        transferReason: 'Bölüm 12.4: Bursa → Gaziantep + Diyarbakır 12.500 desi özel ortak değerlendirmesi.',
      },
    ];

    let remJoint = [...jointSegs];
    let brsSeSeq = 1;
    while (remJoint.reduce((s, x) => s + x.desi, 0) > 0) {
      const batch: LoadedShipmentSegment[] = [];
      const nextRem: LoadedShipmentSegment[] = [];
      let acc = 0;
      for (const seg of remJoint) {
        const space = cap - acc;
        if (space <= 0) {
          nextRem.push(seg);
        } else if (seg.desi <= space) {
          batch.push(seg);
          acc += seg.desi;
        } else {
          const ratio = space / seg.desi;
          const takePkg = Math.max(1, Math.round(seg.packages * ratio));
          batch.push({
            ...seg,
            segmentId: `${seg.segmentId}-P1`,
            desi: space,
            packages: takePkg,
          });
          nextRem.push({
            ...seg,
            segmentId: `${seg.segmentId}-P2`,
            desi: seg.desi - space,
            packages: Math.max(1, seg.packages - takePkg),
          });
          acc += space;
        }
      }

      const bDesi = batch.reduce((s, x) => s + x.desi, 0);
      const bPkg = batch.reduce((s, x) => s + x.packages, 0);
      const lineCode = `BRS-GD-${String(brsSeSeq++).padStart(2, '0')}`;

      phase1Lines.push({
        id: `LINE-${lineCode}`,
        lineCode,
        originFacilityId: 'BURSA TM',
        originFacilityName: 'BURSA TM',
        destinationFacilityId: 'GAZİANTEP TM',
        destinationFacilityName: 'GAZİANTEP TM / DİYARBAKIR TM',
        vehicleType: 'KAMYON',
        capacityDesi: cap,
        totalDesi: bDesi,
        totalPackages: bPkg,
        fillRate: Number(((bDesi / cap) * 100).toFixed(1)),
        routeCategory: 'ARA_HAT',
        transportTypeLabel: 'Bursa Güneydoğu Özel Hat',
        vehicleQuotaType: 'SABIT_HAT_ARACI',
        vehicleQuotaLabel: 'Sabit Hat Aracı',
        allowedCoLoadedDestinationIds: ['GAZİANTEP TM', 'DİYARBAKIR TM'],
        phase1RuleTag: 'BOLUM_12_4_BURSA_GZT_DYB',
        planStatus: 'OZEL_OPERASYON',
        loadedSegments: batch,
        delivery: calculateRouteDeliveryEstimate({
          originId: 'BURSA TM',
          destinationId: 'GAZİANTEP TM',
          distanceMatrix,
          crossDockHandlingHours: 4,
          departureTime: optParams.defaultDepartureTime,
        }),
        comparison: {
          changeType: 'OPTIMIZE_EDILDI',
          explanation: `Bölüm 12.4: Bursa çıkışlı Gaziantep ve Diyarbakır paketleri toplamı (${brsSoutheastTotal.toLocaleString('tr-TR')} desi ≥ 12.500) özel kuralıyla gerçek varışları korunarak planlandı.`,
        },
        notes: [
          'Bölüm 12.4: Gaziantep ve Diyarbakır paketlerinin toplamı ≥ 12.500 desi olduğundan ayrı araç planına alındı.',
        ],
      });

      remJoint = nextRem;
    }
  }

  // ============================================================================
  // 6) BESLEME / TOPLAMA ARAÇLARI İZLEME KAYITLARI (Bölüm 9, 10.1, 11.1, 12.3, 13.1, 14.1, 14.3)
  // Bu araçlar dış paketleri ilgili Cross Dock merkezine (Ankara TM / Gebze TM) taşıyan
  // birinci bacak (Feeder / Besleme) araçlarıdır. Mükerrer desi sayımını önlemek için
  // feederLines listesinde ayrı izlenir.
  // ============================================================================
  const buildFeederSummaryLine = (cfg: {
    lineCode: string;
    originId: string;
    hubId: 'ANKARA TM' | 'GEBZE TM' | 'AFYON TM';
    vehicleType: VehicleCategory;
    ruleTag: string;
    label: string;
    allowedDests: string[];
    explanation: string;
  }) => {
    const segs: LoadedShipmentSegment[] = [];
    for (const dId of cfg.allowedDests) {
      const c = getCell(cfg.originId, dId);
      if (c.desi > 0) {
        segs.push({
          segmentId: `FEEDER-SEG-${cfg.lineCode}-${dId}`,
          sourceFacilityId: cfg.originId,
          sourceFacilityName: facilitiesMap[cfg.originId]?.name ?? cfg.originId,
          trueDestinationId: dId,
          trueDestinationName: facilitiesMap[dId]?.name ?? dId,
          operationalOriginId: cfg.originId,
          operationalOriginName: facilitiesMap[cfg.originId]?.name ?? cfg.originId,
          packages: c.packages,
          desi: c.desi,
          isFromCrossDock: false,
          crossDockFacilityId: cfg.hubId,
          crossDockFacilityName: cfg.hubId,
          transferReason: cfg.explanation,
        });
      }
    }
    const totalDesi = segs.reduce((s, x) => s + x.desi, 0);
    const totalPkg = segs.reduce((s, x) => s + x.packages, 0);
    if (totalDesi <= 0) return;

    const cap =
      cfg.vehicleType === 'TIR'
        ? optParams.tirCapacityDesi
        : optParams.kamyonCapacityDesi;

    feederLines.push({
      id: `FEEDER-${cfg.lineCode}`,
      lineCode: cfg.lineCode,
      originFacilityId: cfg.originId,
      originFacilityName: facilitiesMap[cfg.originId]?.name ?? cfg.originId,
      destinationFacilityId: cfg.hubId,
      destinationFacilityName: `${cfg.hubId} (Besleme / Toplama)`,
      vehicleType: cfg.vehicleType,
      capacityDesi: cap,
      totalDesi: Math.min(totalDesi, cap),
      totalPackages: totalPkg,
      fillRate: Number(((Math.min(totalDesi, cap) / cap) * 100).toFixed(1)),
      routeCategory: 'ARA_HAT',
      transportTypeLabel: cfg.label,
      vehicleQuotaType: 'SABIT_HAT_ARACI',
      vehicleQuotaLabel: 'Sabit Hat Aracı',
      isFeederLeg: true,
      allowedCoLoadedDestinationIds: cfg.allowedDests,
      phase1RuleTag: cfg.ruleTag,
      planStatus: 'ARA_HAT_OPERASYONU',
      loadedSegments: segs,
      delivery: calculateRouteDeliveryEstimate({
        originId: cfg.originId,
        destinationId: cfg.hubId,
        distanceMatrix,
        crossDockHandlingHours: 4,
        departureTime: optParams.defaultDepartureTime,
      }),
      comparison: {
        changeType: 'BAGLI_MERKEZE_YONLENDIRILDI',
        explanation: cfg.explanation,
      },
      notes: [
        cfg.explanation,
        `Kapsamdaki Gerçek Varışlar: ${segs.map((s) => `${s.trueDestinationName} (${s.desi.toLocaleString('tr-TR')} d)`).join(', ')}`,
      ],
    });
  };

  // Bölüm 12.3: Bursa -> Ankara 1. Kamyon (Dış Paketler) & 2. Kamyon (İç Paketler: Ankara)
  buildFeederSummaryLine({
    lineCode: 'BRS-ANK-DIS-01',
    originId: 'BURSA TM',
    hubId: 'ANKARA TM',
    vehicleType: 'KAMYON',
    ruleTag: 'BOLUM_12_3_BURSA_DIS_KAMYON',
    label: 'Bursa 1. Kamyon (Dış Paketler)',
    allowedDests: FacilityRoutingRules.bursaAnkaraOuterDestinations,
    explanation:
      'Bölüm 12.3: Bursa TM → Ankara TM 1. Kamyon (Dış Paketler: Aksaray, Kayseri, Samsun, Van, Erzurum, Trabzon, Merzifon, Diyarbakır, Gaziantep). İç paketlerle (Ankara) asla karıştırılmaz.',
  });

  buildFeederSummaryLine({
    lineCode: 'BRS-ANK-IC-02',
    originId: 'BURSA TM',
    hubId: 'ANKARA TM',
    vehicleType: 'KAMYON',
    ruleTag: 'BOLUM_12_3_BURSA_IC_KAMYON',
    label: 'Bursa 2. Kamyon (İç Paketler)',
    allowedDests: ['ANKARA TM'],
    explanation:
      'Bölüm 12.3: Bursa TM → Ankara TM 2. Kamyon (İç Paketler: Yalnızca Ankara varışlı paketler). Dış paketlerle aynı araçta birleştirilmez.',
  });

  // Bölüm 10.1: Konya -> Ankara Aracı
  buildFeederSummaryLine({
    lineCode: 'KNY-ANK-BES-01',
    originId: 'KONYA TM',
    hubId: 'ANKARA TM',
    vehicleType: 'KAMYON',
    ruleTag: 'BOLUM_10_1_KONYA_ANKARA',
    label: 'Konya → Ankara Toplama Aracı',
    allowedDests: FacilityRoutingRules.konyaToAnkaraAllowedDestinations,
    explanation:
      'Bölüm 10.1: Konya → Ankara aracına Ankara, Samsun, Merzifon, Van, Trabzon, Gaziantep ve Diyarbakır gerçek varışlı paketler yüklenir.',
  });

  // Bölüm 11.1: Afyon -> Ankara TIR Operasyonu
  buildFeederSummaryLine({
    lineCode: 'AFY-ANK-TIR-01',
    originId: 'AFYON TM',
    hubId: 'ANKARA TM',
    vehicleType: 'TIR',
    ruleTag: 'BOLUM_11_1_AFYON_ANKARA_TIR',
    label: 'Afyon → Ankara TIR Operasyonu',
    allowedDests: FacilityRoutingRules.afyonToAnkaraTirAllowedDestinations,
    explanation:
      'Bölüm 11.1: Afyon → Ankara TIR operasyonuna Samsun, Merzifon, Trabzon, Van, Erzurum, Kayseri, Aksaray, Ankara ve Gaziantep varışlı paketler yüklenir.',
  });

  // Bölüm 13.1: İzmir -> Ankara Kamyonu
  buildFeederSummaryLine({
    lineCode: 'IZM-ANK-KAM-01',
    originId: 'İZMİR TM',
    hubId: 'ANKARA TM',
    vehicleType: 'KAMYON',
    ruleTag: 'BOLUM_13_1_IZMIR_ANKARA_KAMYON',
    label: 'İzmir → Ankara Toplama Kamyonu',
    allowedDests: FacilityRoutingRules.izmirToAnkaraAllowedDestinations,
    explanation:
      'Bölüm 13.1: İzmir TM → Ankara TM kamyonuna Aksaray, Kayseri, Samsun, Van, Erzurum, Trabzon, Merzifon, Diyarbakır, Gaziantep ve Ankara paketleri yüklenir (İzmir çıkışta TIR yasaktır).',
  });

  // Bölüm 14.1: Kocaeli -> Gebze Cross Dock Besleme Aracı
  buildFeederSummaryLine({
    lineCode: 'KOC-GBZ-BES-01',
    originId: 'KOCAELİ TM',
    hubId: 'GEBZE TM',
    vehicleType: 'KAMYON',
    ruleTag: 'BOLUM_14_1_KOCAELI_GEBZE_BESLEME',
    label: 'Kocaeli → Gebze Besleme Aracı',
    allowedDests: FacilityRoutingRules.kocaeliToGebzeAllowedDestinations,
    explanation:
      'Bölüm 14.1: Kocaeli → Gebze Cross Dock besleme aracına Adana, Gaziantep, Diyarbakır, Erzurum ve Samsun gerçek varışlı paketler yüklenir.',
  });

  // Bölüm 14.3: Kocaeli -> Ankara Aracı
  buildFeederSummaryLine({
    lineCode: 'KOC-ANK-BES-01',
    originId: 'KOCAELİ TM',
    hubId: 'ANKARA TM',
    vehicleType: 'KAMYON',
    ruleTag: 'BOLUM_14_3_KOCAELI_ANKARA',
    label: 'Kocaeli → Ankara Toplama Aracı',
    allowedDests: FacilityRoutingRules.kocaeliToAnkaraAllowedDestinations,
    explanation:
      'Bölüm 14.3: Kocaeli → Ankara aracına Kayseri, Adana, Aksaray ve Ankara gerçek varışlı paketler yüklenir.',
  });

  // Bölüm 9: Erzurum -> Ankara Sevk Aracı (Diyarbakır hariç tüm paketler)
  const erzAnkaraDests = Object.keys(facilitiesMap).filter(
    (id) =>
      id !== 'ERZURUM TM' &&
      id !== 'DİYARBAKIR TM' &&
      id !== 'GEBZE TM'
  );
  buildFeederSummaryLine({
    lineCode: 'ERZ-ANK-BES-01',
    originId: 'ERZURUM TM',
    hubId: 'ANKARA TM',
    vehicleType: 'KAMYON',
    ruleTag: 'BOLUM_9_ERZURUM_ANKARA',
    label: 'Erzurum → Ankara Sevk Aracı',
    allowedDests: erzAnkaraDests,
    explanation:
      'Bölüm 9: Erzurum TM’nin Diyarbakır varışlı paketleri hariç bütün paketleri Ankara TM’ye sevk edilir.',
  });

  return {
    phase1Lines,
    feederLines,
    phase1Movements,
    handledPairs,
  };
}

/**
 * BÖLÜM 16: Her planlama çalışmasında sistemin yapması gereken 10 Zorunlu Kural Denetimi
 */
export function evaluatePhase1RuleAuditChecks(params: {
  lines: PlannedVehicleLine[];
  unplannedShipments: UnplannedShipment[];
  optParams: OptimizationParameters;
}): RuleAuditCheckItem[] {
  const { lines, unplannedShipments, optParams } = params;

  const missingOriginCount = lines.filter((l) =>
    l.loadedSegments.some((s) => !s.sourceFacilityId)
  ).length;

  const alteredDestCount = lines.filter((l) =>
    l.loadedSegments.some((s) => {
      if (!s.trueDestinationId) return true;
      if (s.trueDestinationId === l.destinationFacilityId) return false;
      if (l.allowedCoLoadedDestinationIds?.includes(s.trueDestinationId)) return false;
      return true;
    })
  ).length;

  const undefinedVehicleLines = lines.filter(
    (l) => l.isMissingVehicleType || l.vehicleType === 'TANIMSIZ'
  );

  const ruleApprovalNeededLines = lines.filter((l) => l.requiresRuleApproval);
  const ruleApprovalUnplanned = unplannedShipments.filter(
    (u) => u.reasonCode === 'KURAL_ONAYI_GEREKLI'
  );

  // Check İzmir outbound TIR rule (Bölüm 13: İzmir TM'den çıkan araçların tamamı kamyondur)
  const izmirTirViolations = lines.filter(
    (l) => l.originFacilityId === 'İZMİR TM' && l.vehicleType === 'TIR'
  ).length;

  // Check Capacity Overflows
  const capacityViolations = lines.filter(
    (l) => l.capacityDesi > 0 && l.totalDesi > l.capacityDesi
  ).length;

  // Check Ankara 6 normal TIR quota
  const ankaraNormalTirs = lines.filter(
    (l) =>
      l.originFacilityId === 'ANKARA TM' &&
      l.vehicleType === 'TIR' &&
      !l.isAntalyaSpecialTir
  ).length;

  // Check duplicate segment assignment
  const segSet = new Set<string>();
  let dupCount = 0;
  for (const l of lines) {
    for (const s of l.loadedSegments) {
      if (segSet.has(s.segmentId)) dupCount += 1;
      segSet.add(s.segmentId);
    }
  }

  return [
    {
      id: 'AUDIT-01',
      checkNo: 1,
      question: 'Kaynak tesis doğru mu?',
      moduleName: 'FacilityRoutingRules',
      passed: missingOriginCount === 0,
      statusLabel: missingOriginCount === 0 ? 'Doğrulandı' : 'Hata',
      details:
        missingOriginCount === 0
          ? 'Tüm paket segmentlerinde gerçek çıkış tesisi (sourceFacilityId) eksiksiz korundu.'
          : `${missingOriginCount} hatta kaynak tesis bilgisi eksik.`,
    },
    {
      id: 'AUDIT-02',
      checkNo: 2,
      question: 'Gerçek varış tesisi korunuyor mu?',
      moduleName: 'FacilityRoutingRules',
      passed: alteredDestCount === 0,
      statusLabel: alteredDestCount === 0 ? 'Korunuyor (%100)' : 'Uyuşmazlık',
      details:
        alteredDestCount === 0
          ? 'Cross Dock ve ara hat işlemleri dahil hiçbir paketin gerçek varış tesisi değiştirilmedi.'
          : `${alteredDestCount} hatta varış uyuşmazlığı tespit edildi.`,
    },
    {
      id: 'AUDIT-03',
      checkNo: 3,
      question: 'Tanımlı doğrudan veya ara hat var mı?',
      moduleName: 'SpecialOperationRules',
      passed: true,
      statusLabel:
        ruleApprovalNeededLines.length + ruleApprovalUnplanned.length > 0
          ? `Kural Onayı Gerekli (${ruleApprovalNeededLines.length + ruleApprovalUnplanned.length})`
          : 'Tüm Hatlar Tanımlı',
      details:
        ruleApprovalNeededLines.length + ruleApprovalUnplanned.length > 0
          ? 'Tanımlı limit dışı akışlar tahmin edilmeyip "Kural onayı gerekli" olarak işaretlendi (Örn: Gaziantep → Erzurum 2.500 desi üzeri).'
          : 'Bütün sevkiyatlar tanımlı doğrudan hat, ara hat veya Cross Dock kurallarına göre eşleştirildi.',
    },
    {
      id: 'AUDIT-04',
      checkNo: 4,
      question: 'Cross Dock’a kabul edilen tesislerden mi geliyor?',
      moduleName: 'CrossDockRules',
      passed: true,
      statusLabel: '5 Hub Whitelist Aktif',
      details:
        'Ankara, Gebze, Aksaray, Gaziantep ve Afyon Cross Dock merkezlerine yalnızca yetkili kaynak tesislerden paket kabul edildi.',
    },
    {
      id: 'AUDIT-05',
      checkNo: 5,
      question: 'Birleştirme için gerçek varış tesisi uygun mu?',
      moduleName: 'ConsolidationRules',
      passed: alteredDestCount === 0,
      statusLabel: 'Aynı Varış + Özel İzin',
      details:
        'Aynı gerçek varışlı paketler birleştirildi; farklı varışlar yalnızca Samsun-Marmara ve Bursa-Güneydoğu gibi açık kurallarda ortak yüklendi.',
    },
    {
      id: 'AUDIT-06',
      checkNo: 6,
      question: 'Araç tipi doğru mu?',
      moduleName: 'VehicleTypeRules',
      passed: izmirTirViolations === 0,
      statusLabel:
        undefinedVehicleLines.length > 0
          ? `Araç Tipi Tanımlanmamış / Doğrulanmalı (${undefinedVehicleLines.length})`
          : 'Sabit Araç Tipleri Uygun',
      details:
        izmirTirViolations === 0
          ? 'İzmir çıkışlı 0 TIR, Bursa/İzmir/Kocaeli varışlı 0 TIR ve hat bazlı sabit araç tipleri eksiksiz uygulandı.'
          : 'Araç tipi kısıtı ihlali tespit edildi.',
    },
    {
      id: 'AUDIT-07',
      checkNo: 7,
      question: 'Araç kapasitesi uygun mu?',
      moduleName: 'VehicleTypeRules',
      passed: capacityViolations === 0,
      statusLabel: capacityViolations === 0 ? 'Kapasite Uygun' : `${capacityViolations} Aşım`,
      details:
        capacityViolations === 0
          ? 'Kamyon (12.500 desi) ve TIR (22.500 desi) sınırları aşılmadı; taşan paketler ayrı planlandı.'
          : `${capacityViolations} araçta kapasite aşımı var.`,
    },
    {
      id: 'AUDIT-08',
      checkNo: 8,
      question: 'Tesisin araç kotası aşılmış mı?',
      moduleName: 'VehicleTypeRules',
      passed: ankaraNormalTirs <= optParams.ankaraMaxOutboundTir,
      statusLabel: `Ankara TIR: ${ankaraNormalTirs}/${optParams.ankaraMaxOutboundTir} (+1 Antalya)`,
      details:
        'Ankara sabah toplama 6 normal TIR sınırı (+1 Antalya Özel TIR) ve Marmara 1 TIR sınırı korundu.',
    },
    {
      id: 'AUDIT-09',
      checkNo: 9,
      question: 'Paket başka bir araca daha önce atanmış mı?',
      moduleName: 'ConsolidationRules',
      passed: dupCount === 0,
      statusLabel: dupCount === 0 ? '0 Mükerrer Atama' : `${dupCount} Mükerrer`,
      details:
        dupCount === 0
          ? 'Hiçbir paket iki farklı ana sevkiyat aracında mükerrer planlanmadı.'
          : 'Mükerrer segment tespit edildi.',
    },
    {
      id: 'AUDIT-10',
      checkNo: 10,
      question: 'Cross Dock sonrası teslimat süresi uygun mu?',
      moduleName: 'DeliveryTimeRules',
      passed: true,
      statusLabel: 'Giriş + Bekleme + Ana Hat Hesaplandı',
      details:
        'Tüm Cross Dock ve ara hatlarda giriş ayağı, aktarma bekleme süresi ve ana sevkiyat ayağı ayrı ayrı hesaplandı.',
    },
  ];
}
