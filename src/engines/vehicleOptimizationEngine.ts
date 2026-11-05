import {
  DirectRouteConnection,
  Facility,
  ForbiddenRouteRule,
  OptimizationParameters,
  VehicleCategory,
  VehicleRightType,
} from '../types/logistics';

export interface DirectAllocationVehicle {
  vehicleType: VehicleCategory;
  capacityDesi: number;
  loadedDesi: number;
  loadedPackages: number;
  reason: string;
  ruleApplied: string;
}

export interface RemainderForCrossDock {
  desi: number;
  packages: number;
  reasonType:
    | '12500_16000_ARTIGI'
    | 'TIR_KAPASITE_ARTIGI'
    | 'DUSUK_HACIM_BIRLESTIRME'
    | 'KISIT_ARTIGI';
  reasonDetail: string;
}

export interface LaneAllocationDecision {
  originId: string;
  destinationId: string;
  inputDesi: number;
  inputPackages: number;
  directVehicles: DirectAllocationVehicle[];
  remainder: RemainderForCrossDock | null;
  usedTirCount: number;
  usedKamyonCount: number;
  usedPanelvanCount: number;
  vehicleQuotaType?: VehicleRightType;
  requiresVerification?: boolean;
  warningMessage?: string;
  notes: string[];
}

export function isRouteForbiddenViaAnkara(
  originId: string,
  destinationId: string,
  forbiddenRules: ForbiddenRouteRule[]
): boolean {
  return forbiddenRules.some(
    (r) =>
      r.isActive &&
      r.originId === originId &&
      r.destinationId === destinationId &&
      (r.forbiddenViaId === 'ANKARA TM' || r.ruleType === 'DIRECT_ONLY')
  );
}

/**
 * Deterministic vehicle selection and capacity allocation engine for a single (Origin -> Destination) pair.
 * Strictly implements:
 * - Section 4.1: 12.500 - 16.000 desi => 1 Kamyon (12.500) + remainder to Cross Dock
 * - Section 4.2: > 16.000 desi => TIR (22.500) evaluation (16.000 exact is NOT TIR)
 * - Section 5: Direct transport priority
 * - Section 8: Facility-specific constraints (Bursa/İzmir/Kocaeli Kamyon only, Marmara only-Avrupa TIR, Ankara max 6 normal TIR + 1 Antalya Özel TIR, Marmara max 1 TIR, Konya -> Afyon/Ankara direct priority)
 * - Section 9: Forbidden routes protection (Adana -> Gaziantep, Diyarbakır -> Gaziantep never via Ankara)
 * - Section 12 & Ek Modül: Panelvan capacity (3.500), TANIMSIZ and DOGRULANMALI handling
 * - Section 15: Self-routes (Origin === Destination) produce 0 linehaul vehicles
 */
export function evaluateSingleLaneAllocation(params: {
  origin: Facility;
  destination: Facility;
  desi: number;
  packages: number;
  optParams: OptimizationParameters;
  forbiddenRules: ForbiddenRouteRule[];
  remainingOriginTirQuota: number | null; // null = unlimited, >= 0 = remaining TIRs allowed for this origin
  hasBaselineDirectLine: boolean;
  hasDirectRoute?: boolean;
  forceDirectForSubThreshold?: boolean;
  directRouteConfig?: DirectRouteConnection;
}): LaneAllocationDecision {
  const {
    origin,
    destination,
    desi,
    packages,
    optParams,
    forbiddenRules,
    remainingOriginTirQuota,
    hasBaselineDirectLine,
    hasDirectRoute = false,
    forceDirectForSubThreshold = false,
    directRouteConfig,
  } = params;

  const kamyonCap = optParams.kamyonCapacityDesi; // 12500
  const splitThreshold = optParams.splitUpperThresholdDesi; // 16000
  const tirCap = optParams.tirCapacityDesi; // 22500
  const minDirectDesi = optParams.directKamyonMinDesi; // 7500
  const panelvanCap = optParams.panelvanCapacityDesi || 3500;

  const directVehicles: DirectAllocationVehicle[] = [];
  let remainder: RemainderForCrossDock | null = null;
  const notes: string[] = [];

  // Case 0.1: Desi <= 0
  if (desi <= 0) {
    return {
      originId: origin.id,
      destinationId: destination.id,
      inputDesi: 0,
      inputPackages: 0,
      directVehicles: [],
      remainder: null,
      usedTirCount: 0,
      usedKamyonCount: 0,
      usedPanelvanCount: 0,
      notes: [],
    };
  }

  // Case 0.2: Self-routes (Origin === Destination) per Bölüm 15:
  // "0 linehaul vehicles created. Do NOT route to Cross Dock. Do NOT include in vehicle linehaul totals.
  // Reported separately in internal/local category (Tesis İçi / Öz Dağıtım)."
  if (origin.id === destination.id) {
    return {
      originId: origin.id,
      destinationId: destination.id,
      inputDesi: desi,
      inputPackages: packages,
      directVehicles: [],
      remainder: null,
      usedTirCount: 0,
      usedKamyonCount: 0,
      usedPanelvanCount: 0,
      vehicleQuotaType: 'SABIT_HAT_ARACI',
      notes: [
        `${origin.name} tesis içi / öz dağıtım kapsamındadır; şehirlerarası hat aracı tahsis edilmez.`,
      ],
    };
  }

  const avgDesiPerPkg = packages > 0 ? desi / packages : 4;
  const computePackagesForDesi = (d: number, totalRemainingPkg: number, isAll: boolean) => {
    if (isAll) return Math.max(1, totalRemainingPkg);
    const est = Math.max(1, Math.round(d / avgDesiPerPkg));
    return Math.min(totalRemainingPkg, est);
  };

  // Case 0.3: Explicit Missing Vehicle Type ('TANIMSIZ') - e.g. Aksaray TM -> Ankara TM
  if (directRouteConfig?.operationalVehicleType === 'TANIMSIZ') {
    const warn =
      directRouteConfig.warningMessage ||
      'Araç tipi henüz tanımlanmamış. Otomatik araç tipi atanamaz.';
    return {
      originId: origin.id,
      destinationId: destination.id,
      inputDesi: desi,
      inputPackages: packages,
      directVehicles: [
        {
          vehicleType: 'TANIMSIZ',
          capacityDesi: 0,
          loadedDesi: desi,
          loadedPackages: packages,
          reason: warn,
          ruleApplied: 'EKSIK_ARAC_TANIMI',
        },
      ],
      remainder: null,
      usedTirCount: 0,
      usedKamyonCount: 0,
      usedPanelvanCount: 0,
      vehicleQuotaType: 'EKSIK_ARAC_TANIMI',
      requiresVerification: true,
      warningMessage: warn,
      notes: [warn],
    };
  }

  // Case 0.4: Explicit Panelvan Line (e.g. Aksaray TM -> Adana TM, Aksaray TM -> Kayseri TM, Adana TM -> Aksaray TM)
  if (directRouteConfig?.operationalVehicleType === 'PANELVAN') {
    const numPanelvans = Math.max(1, Math.ceil(desi / panelvanCap));
    let curDesi = desi;
    let curPkg = packages;
    for (let i = 0; i < numPanelvans; i++) {
      const loadD = Math.min(curDesi, panelvanCap);
      const isAll = loadD === curDesi;
      const loadP = computePackagesForDesi(loadD, curPkg, isAll);
      directVehicles.push({
        vehicleType: 'PANELVAN',
        capacityDesi: panelvanCap,
        loadedDesi: loadD,
        loadedPackages: loadP,
        reason: `Panelvan aracı ile sevkiyat (${loadD.toLocaleString('tr-TR')} / ${panelvanCap.toLocaleString('tr-TR')} desi).`,
        ruleApplied: 'KURAL_PANELVAN_SEVKIYAT',
      });
      curDesi -= loadD;
      curPkg = Math.max(0, curPkg - loadP);
    }
    return {
      originId: origin.id,
      destinationId: destination.id,
      inputDesi: desi,
      inputPackages: packages,
      directVehicles,
      remainder: null,
      usedTirCount: 0,
      usedKamyonCount: 0,
      usedPanelvanCount: directVehicles.length,
      vehicleQuotaType: 'PANELVAN',
      notes: ['Panelvan tanımlı direkt hat sevkiyatı (Kapasite: 3.500 desi).'],
    };
  }

  // Check strict origin & destination vehicle constraints (Section 12 & Faz 1 Bölüm 13):
  // - İzmir TM outbound: ALL outbound vehicles from İzmir TM are strictly KAMYON (0 TIR allowed)!
  // - İzmir TM inbound: Only Kamyon. NEVER TIR!
  // - Bursa TM inbound: Only Kamyon. NEVER TIR!
  // - Kocaeli TM inbound: Only Kamyon. NEVER TIR!
  // - Marmara TM inbound: ONLY Avrupa TM -> Marmara TM can be TIR! All other facilities to Marmara TM MUST be Kamyon.
  const isOriginKamyonOnly = origin.id === 'İZMİR TM';
  const isDestKamyonOnly =
    Boolean(destination.inboundKamyonOnly) ||
    destination.id === 'BURSA TM' ||
    destination.id === 'İZMİR TM' ||
    destination.id === 'KOCAELİ TM' ||
    (destination.id === 'MARMARA TM' && origin.id !== 'AVRUPA TM');

  // Check Antalya Special TIR Quota:
  // "Antalya TM çıkışlı TIR, Ankara sabah toplama 6 TIR limitinin dışındadır (+1 özel TIR)."
  const isAntalyaSpecialTirRoute =
    origin.id === 'ANKARA TM' && destination.id === 'ANTALYA TM';

  const isKonyaPriorityDirect =
    origin.id === 'KONYA TM' &&
    (destination.id === 'AFYON TM' ||
      destination.id === 'ANKARA TM' ||
      Boolean(origin.priorityDirectDestinations?.includes(destination.id)));

  // Faz 1 Bölüm 9: Erzurum'un Diyarbakır varışlı paketleri doğrudan Diyarbakır'a gönderilir; Ankara'ya yönlendirilmemelidir!
  const isErzurumDiyarbakirDirectException =
    origin.id === 'ERZURUM TM' && destination.id === 'DİYARBAKIR TM';

  const isForbiddenViaAnkara =
    isErzurumDiyarbakirDirectException ||
    isRouteForbiddenViaAnkara(origin.id, destination.id, forbiddenRules);

  // Can this shipment use Cross Dock at all?
  const canUseCrossDock =
    origin.id !== destination.id &&
    origin.id !== 'ANKARA TM' &&
    destination.id !== 'ANKARA TM' &&
    !isForbiddenViaAnkara;

  let remainingDesi = desi;
  let remainingPackages = packages;
  let currentTirQuota = remainingOriginTirQuota;

  const canAllocateTir = (): boolean => {
    if (isOriginKamyonOnly) return false;
    if (isDestKamyonOnly) return false;
    if (isAntalyaSpecialTirRoute) return true; // Antalya TM TIR has dedicated quota outside the 6-TIR limit
    if (currentTirQuota !== null && currentTirQuota <= 0) return false;
    return true;
  };

  if (isOriginKamyonOnly && remainingDesi > splitThreshold) {
    notes.push(
      `Bölüm 13: İzmir TM'den çıkan araçların tamamı kamyondur; İzmir çıkışlı hatlarda TIR oluşturulamaz.`
    );
  } else if (isDestKamyonOnly && remainingDesi > splitThreshold) {
    notes.push(
      `${destination.name} varışlı gönderilerde yalnızca Kamyon kullanılabilir (TIR yasaklı).`
    );
  }

  // Loop for multi-vehicle volumes (e.g., 55.000 desi or 23.000 desi)
  while (remainingDesi > 0) {
    // CASE 1: > 16.000 desi (Strict inequality: 16.000 is NOT included in TIR condition)
    if (remainingDesi > splitThreshold) {
      if (canAllocateTir()) {
        const loadDesi = Math.min(remainingDesi, tirCap);
        const isAll = loadDesi === remainingDesi;
        const loadPkg = computePackagesForDesi(loadDesi, remainingPackages, isAll);

        const tirReason = isAntalyaSpecialTirRoute
          ? `Antalya TM özel TIR kotası kapsamında (+1 özel TIR, Ankara sabah 6 TIR limitine dahil edilmez) ${loadDesi.toLocaleString('tr-TR')} desi için direkt TIR planlandı.`
          : remainingDesi >= tirCap
          ? `16.000 desi üzeri (${remainingDesi.toLocaleString('tr-TR')} desi) tam kapasite TIR (22.500 desi) planlandı.`
          : `16.000 desi eşiği üzeri (${remainingDesi.toLocaleString('tr-TR')} desi) için direkt TIR planlandı.`;

        directVehicles.push({
          vehicleType: 'TIR',
          capacityDesi: tirCap,
          loadedDesi: loadDesi,
          loadedPackages: loadPkg,
          reason: tirReason,
          ruleApplied: isAntalyaSpecialTirRoute ? 'ANTALYA_OZEL_TIR' : 'KURAL_4_2_16000_UZERI_TIR',
        });

        remainingDesi -= loadDesi;
        remainingPackages = Math.max(0, remainingPackages - loadPkg);
        if (currentTirQuota !== null && !isAntalyaSpecialTirRoute) {
          currentTirQuota -= 1;
        }
        continue;
      } else {
        // TIR is restricted (either Bursa/İzmir Kamyon-only OR Origin TIR quota reached)
        const restrictionReason = isDestKamyonOnly
          ? `${destination.name} varış kısıtı (Yalnızca Kamyon)`
          : `${origin.name} maksimum TIR çıkış sınırı`;

        // If remainingDesi > 12500, allocate 1 full Kamyon (12.500 desi) and continue loop
        const loadDesi = Math.min(remainingDesi, kamyonCap);
        const isAll = loadDesi === remainingDesi;
        const loadPkg = computePackagesForDesi(loadDesi, remainingPackages, isAll);

        directVehicles.push({
          vehicleType: 'KAMYON',
          capacityDesi: kamyonCap,
          loadedDesi: loadDesi,
          loadedPackages: loadPkg,
          reason: `${restrictionReason} nedeniyle TIR yerine 12.500 desi kapasiteli direkt Kamyon planlandı.`,
          ruleApplied: isDestKamyonOnly ? 'KURAL_8_VARIS_KAMYON_ZORUNLU' : 'KURAL_8_CIKIS_TIR_SINIRI',
        });

        remainingDesi -= loadDesi;
        remainingPackages = Math.max(0, remainingPackages - loadPkg);
        continue;
      }
    }

    // CASE 2: 12.500 < remainingDesi <= 16.000 (Section 4.1 exact range, including 16.000)
    if (remainingDesi > kamyonCap && remainingDesi <= splitThreshold) {
      // Allocate 1 full Kamyon of 12.500 desi
      const loadDesi = kamyonCap;
      const loadPkg = computePackagesForDesi(loadDesi, remainingPackages, false);

      directVehicles.push({
        vehicleType: 'KAMYON',
        capacityDesi: kamyonCap,
        loadedDesi: loadDesi,
        loadedPackages: loadPkg,
        reason: `12.500–16.000 desi kuralı (${remainingDesi.toLocaleString('tr-TR')} desi): 1 adet tam dolu Kamyon (12.500 desi) oluşturuldu.`,
        ruleApplied: 'KURAL_4_1_12500_16000_KAMYON_VE_ARTIK',
      });

      const leftoverDesi = remainingDesi - loadDesi;
      const leftoverPkg = Math.max(1, remainingPackages - loadPkg);
      remainingDesi = 0;
      remainingPackages = 0;

      if (canUseCrossDock) {
        remainder = {
          desi: leftoverDesi,
          packages: leftoverPkg,
          reasonType: '12500_16000_ARTIGI',
          reasonDetail: `12.500–16.000 desi kuralı gereği kalan ${leftoverDesi.toLocaleString('tr-TR')} desi ikinci bir araca dönüştürülmedi; Cross Dock birleştirmesi için ayrıldı.`,
        };
      } else {
        // Cannot use Cross Dock (e.g. Origin is ANKARA TM, or Destination is ANKARA TM, or forbidden route):
        // Note: if Origin is ANKARA TM or Dest is ANKARA TM, it cannot loop through Ankara CD!
        if (origin.id === destination.id || origin.id === 'ANKARA TM' || destination.id === 'ANKARA TM' || isForbiddenViaAnkara) {
          directVehicles.push({
            vehicleType: 'KAMYON',
            capacityDesi: kamyonCap,
            loadedDesi: leftoverDesi,
            loadedPackages: leftoverPkg,
            reason: isForbiddenViaAnkara
              ? `Yasaklı Cross Dock güzergâhı (${origin.name} → ${destination.name}) nedeniyle kalan ${leftoverDesi.toLocaleString('tr-TR')} desi direkt ek kamyona yüklendi.`
              : `Ankara Cross Dock döngüsünü önlemek için kalan ${leftoverDesi.toLocaleString('tr-TR')} desi direkt kamyon ile planlandı.`,
            ruleApplied: 'DIREKT_ZORUNLU_EK_KAMYON',
          });
        }
      }
      break;
    }

    // CASE 3: remainingDesi <= 12.500
    if (remainingDesi === kamyonCap) {
      directVehicles.push({
        vehicleType: 'KAMYON',
        capacityDesi: kamyonCap,
        loadedDesi: remainingDesi,
        loadedPackages: Math.max(1, remainingPackages),
        reason: `Tam kapasite (12.500 desi) direkt Kamyon planlandı.`,
        ruleApplied: 'KURAL_4_TAM_KAMYON',
      });
      remainingDesi = 0;
      remainingPackages = 0;
      break;
    }

    // Global Yönlendirme Öncelik Hiyerarşisi:
    // Tanımlı doğrudan hat (hasDirectRoute = true) varsa, araç doluluğu nedeniyle paketler
    // Cross Dock merkezlerine saptırılmaz; doğrudan hat aynı gün sevk önceliğiyle kullanılır!
    const isFirstVehicleForLane = directVehicles.length === 0;
    const qualifiesForDirectKamyon =
      hasDirectRoute ||
      remainingDesi >= minDirectDesi ||
      (isFirstVehicleForLane && isKonyaPriorityDirect) ||
      (isFirstVehicleForLane && isForbiddenViaAnkara) ||
      (isFirstVehicleForLane && hasBaselineDirectLine && remainingDesi >= 3000) ||
      (isFirstVehicleForLane && forceDirectForSubThreshold) ||
      !canUseCrossDock;

    if (qualifiesForDirectKamyon) {
      let reasonText = `Direkt taşıma önceliği ile ${remainingDesi.toLocaleString('tr-TR')} desi için Kamyon planlandı.`;
      let ruleTag = 'KURAL_5_DIREKT_ONCELIK';

      if (hasDirectRoute && remainingDesi < minDirectDesi) {
        reasonText = `Global Yönlendirme Önceliği: Tanımlı doğrudan hat (${origin.name} → ${destination.name}) önceliği gereği ${remainingDesi.toLocaleString('tr-TR')} desi paket için direkt Kamyon planlandı.`;
        ruleTag = 'GLOBAL_DOGRUDAN_HAT_ONCELIGI';
      } else if (isKonyaPriorityDirect) {
        reasonText = `Konya TM → ${destination.name} öncelikli hat kuralı gereği direkt Kamyon planlandı.`;
        ruleTag = 'KURAL_8_KONYA_ONCELIK';
      } else if (isForbiddenViaAnkara) {
        reasonText = `${origin.name} → ${destination.name} gönderisi Ankara Cross Dock üzerinden yönlendirilemeyeceği için direkt Kamyon planlandı.`;
        ruleTag = 'KURAL_9_YASAKLI_ROTA_KORUMA';
      } else if (hasBaselineDirectLine && remainingDesi < minDirectDesi) {
        reasonText = `Mevcut hat çıkış planını koruma kuralı gereği direkt Kamyon korundu.`;
        ruleTag = 'KURAL_11_MEVCUT_HAT_KORUMA';
      }

      directVehicles.push({
        vehicleType: 'KAMYON',
        capacityDesi: kamyonCap,
        loadedDesi: remainingDesi,
        loadedPackages: Math.max(1, remainingPackages),
        reason: reasonText,
        ruleApplied: ruleTag,
      });
      remainingDesi = 0;
      remainingPackages = 0;
      break;
    } else {
      // Send to Cross Dock (Gebze or Ankara) for consolidation!
      const isTirOverflow = directVehicles.some((v) => v.vehicleType === 'TIR');
      const isKisitOverflow = directVehicles.length > 0 && !isTirOverflow;
      remainder = {
        desi: remainingDesi,
        packages: Math.max(1, remainingPackages),
        reasonType: isTirOverflow
          ? 'TIR_KAPASITE_ARTIGI'
          : isKisitOverflow
          ? 'KISIT_ARTIGI'
          : 'DUSUK_HACIM_BIRLESTIRME',
        reasonDetail: isTirOverflow
          ? `TIR kapasitesi (22.500 desi) sonrası kalan ${remainingDesi.toLocaleString('tr-TR')} desi tek başına araç doldurmadığı için Cross Dock birleştirmesine aktarıldı.`
          : `${remainingDesi.toLocaleString('tr-TR')} desi gönderi tek başına direkt araç eşiğini (${minDirectDesi.toLocaleString('tr-TR')} desi) doldurmadığı için Cross Dock birleştirmesine ayrıldı.`,
      };
      remainingDesi = 0;
      remainingPackages = 0;
      break;
    }
  }

  return {
    originId: origin.id,
    destinationId: destination.id,
    inputDesi: desi,
    inputPackages: packages,
    directVehicles,
    remainder,
    usedTirCount: directVehicles.filter((v) => v.vehicleType === 'TIR').length,
    usedKamyonCount: directVehicles.filter((v) => v.vehicleType === 'KAMYON').length,
    usedPanelvanCount: directVehicles.filter((v) => v.vehicleType === 'PANELVAN').length,
    vehicleQuotaType: isAntalyaSpecialTirRoute ? 'ANTALYA_OZEL_TIR' : 'SABIT_HAT_ARACI',
    notes,
  };
}
