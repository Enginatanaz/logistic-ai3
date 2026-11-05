export type VehicleCategory = 'KAMYON' | 'TIR' | 'PANELVAN' | 'TANIMSIZ';

export type VehicleRightType =
  | 'SABIT_HAT'
  | 'SABIT_HAT_ARACI'
  | 'ANKARA_CD_SABIT_TIR'
  | 'ANKARA_CD_ILAVE_TIR'
  | 'ANTALYA_OZEL_TIR'
  | 'PANELVAN'
  | 'EKSIK_TANIM'
  | 'EKSIK_ARAC_TANIMI';

export type FacilityRole = 'NORMAL' | 'MAIN_CROSS_DOCK' | 'SPECIAL_CROSS_DOCK';

export type FacilityScheduleType = 'NORMAL' | 'ANKARA_24H' | 'GEBZE_NIGHT_08';

export interface Facility {
  id: string;
  code: string;
  name: string;
  city: string;
  role: FacilityRole;
  isActive: boolean;
  /** True only for GEBZE TM so it is not mistakenly added as a standard 19-facility origin/destination row in the manual package matrix */
  isCrossDockOnly: boolean;
  maxOutboundTir?: number | null;
  inboundKamyonOnly?: boolean;
  preferInboundKamyon?: boolean;
  priorityDirectDestinations?: string[];
  eligibleForGebzeCrossDock?: boolean;

  // FAZ 1 Spesifik Tesis Alanları (Bölüm 1 & 2)
  workingHours: string; // Örn: '16:00 - 22:00', '24 Saat Kesintisiz', '22:00 - 08:00 (Gece)'
  scheduleType: FacilityScheduleType; // 'NORMAL' | 'ANKARA_24H' | 'GEBZE_NIGHT_08'
  crossDockAuthorized: boolean; // Cross Dock yetkisi
  parentFacilityId?: string | null; // Bağlı olduğu operasyon merkezi (Van -> Erzurum, Merzifon & Trabzon -> Samsun)
  parentFacilityName?: string;
  isPassiveByDefault?: boolean; // Van, Merzifon, Trabzon varsayılan pasif
  alternativeCrossDockId?: string | null; // Alternatif aktarma merkezi (Varsayılan: ANKARA TM)
  directOutboundLines?: string[]; // Tanımlı doğrudan çıkış hatları listesi
  intermediateLines?: string[]; // Ara hatları (Örn: Antalya -> Afyon besleme, Gebze besleme, Diyarbakır-Gzt)
  acceptedPackageTypes?: string[]; // Kabul ettiği paket tipleri
  fixedVehicleConfigSummary?: string; // Sabit araç konfigürasyon özeti
  specialRoutingNote?: string;
}

export interface DirectRouteConnection {
  id: string;
  originId: string;
  destinationId: string;
  isActive: boolean;
  isUserOverridden?: boolean;
  notes?: string;

  // Ek Modül: Gerçek Araç Çıkış Planı & Hat Bazlı Araç Tipi Kısıtlamaları
  allowedVehicleTypes: ('KAMYON' | 'TIR' | 'PANELVAN')[];
  operationalVehicleType: 'KAMYON' | 'TIR' | 'PANELVAN' | 'TANIMSIZ' | 'DOGRULANMALI';
  capacityDesi: number;
  routeQuotaType?: VehicleRightType;
  requiresVerification?: boolean;
  warningMessage?: string;
}

export interface FacilityRelationship {
  facilityId: string;
  facilityName: string;
  parentFacilityId: string; // e.g., 'ERZURUM TM' or 'SAMSUN TM'
  parentFacilityName: string;
  isOriginActive: boolean;
  alternativeCrossDockId: string; // 'ANKARA TM'
  description: string;
}

export interface SpecialDistanceLocation {
  id: string;
  name: string;
  category: 'DISTRIBUTION_CENTER' | 'SPECIAL_HUB' | 'CUSTOMER_WAREHOUSE';
  associatedFacilityId?: string;
  notes: string;
  distances: { destination: string; km: number }[];
}

export interface VehicleTypeConfig {
  id: VehicleCategory;
  name: string;
  capacityDesi: number;
  minRecommendedFillRate: number;
  unitCostIndex: number;
  isActive: boolean;
}

export interface ForbiddenRouteRule {
  id: string;
  originId: string;
  destinationId: string;
  forbiddenViaId?: string; // e.g., ANKARA TM
  ruleType: 'NO_CROSS_DOCK_VIA' | 'DIRECT_ONLY' | 'FORBIDDEN_PAIR';
  description: string;
  isActive: boolean;
}

export interface OptimizationParameters {
  estimatedTotalPackages: number;
  globalDesiPerPackage: number;
  kamyonCapacityDesi: number;
  splitUpperThresholdDesi: number; // 16.000 desi (exact threshold: 12.500 - 16.000 splits to 1 Kamyon + remainder to Ankara CD; > 16.000 evaluates TIR)
  tirCapacityDesi: number;
  panelvanCapacityDesi: number; // 3.500 desi
  directKamyonMinDesi: number; // Minimum desi to justify a direct Kamyon when not forced by priority/baseline
  preserveBaselinePlan: boolean;
  includeSelfRoutesInLinehaul: boolean; // Whether diagonal (Origin === Destination) is shown as local linehaul or separated
  ankaraMaxOutboundTir: number; // 6 normal TIR
  antalyaSpecialTirQuota: number; // 1 Antalya özel TIR (6 araçlık limitin dışındadır)
  marmaraMaxOutboundTir: number; // 1
  ankaraCdFixedTirQuota: number; // 3 sabit TIR
  ankaraCdAdditionalTirQuota: number; // 3 ilave TIR
  ankaraCrossDockMaxKamyonPerDest: number; // 1
  ankaraCrossDockMaxTirPerDest: number; // 1
  crossDockHandlingHours: number; // e.g. 4 hours
  defaultDepartureTime: string; // e.g. "21:30"
}

export interface ShipmentCell {
  originId: string;
  destinationId: string;
  packages: number;
  desi: number;
  packageCoefficient: number; // Share of 650.000 packages
  desiPerPackageRatio: number; // Cell-specific desi/package ratio from reference Excel
}

export type MatrixData = Record<string, Record<string, number>>;

export interface DistanceEntry {
  originId: string;
  destinationId: string;
  km: number | null; // null means missing distance -> must show missing distance warning
  isSpecialRoute?: boolean;
}

export type DistanceMatrix = Record<string, Record<string, number | null>>;

export interface LoadedShipmentSegment {
  segmentId: string;
  sourceFacilityId: string; // True Source (e.g. Van TM or Antalya TM)
  sourceFacilityName: string;
  trueDestinationId: string; // True Destination (e.g. Ankara TM)
  trueDestinationName: string;
  operationalOriginId: string; // Operational dispatch hub (e.g. Afyon TM for Antalya, Erzurum TM for Van)
  operationalOriginName: string;
  packages: number;
  desi: number;
  isFromCrossDock: boolean;
  crossDockFacilityId?: string;
  crossDockFacilityName?: string;
  transferReason?: string;
}

export type CrossDockHubId =
  | 'ANKARA TM'
  | 'GEBZE TM'
  | 'GAZİANTEP TM'
  | 'AKSARAY TM'
  | 'AFYON TM';

export type RouteCategory =
  | 'DIREKT'
  | 'ANKARA_CROSS_DOCK'
  | 'GEBZE_CROSS_DOCK'
  | 'AKSARAY_CROSS_DOCK'
  | 'GAZIANTEP_CROSS_DOCK'
  | 'AFYON_CROSS_DOCK'
  | 'ARA_HAT'
  | 'AFYON_UZERINDEN'
  | 'ERZURUM_UZERINDEN'
  | 'SAMSUN_UZERINDEN'
  | 'MEVCUT_HAT'
  | 'LOKAL_DAGITIM';

export type PlanRowStatus =
  | 'MEVCUT_KORUNDU'
  | 'OPTIMIZE_EDILDI'
  | 'CROSS_DOCK_BIRLESTIRME'
  | 'ARA_HAT_OPERASYONU'
  | 'OZEL_OPERASYON'
  | 'KURAL_ONAYI_GEREKLI'
  | 'KISIT_UYGULANDI'
  | 'KAPASITE_UYARISI'
  | 'BAGLI_TESIS_AKTARIMI'
  | 'AYNI_GUN_EK_ARAC'
  | 'PALETLI_AMAZON_SEVK'
  | 'SEHIR_UGRAMALI';

export interface CrossDockHubConfig {
  hubFacilityId: CrossDockHubId;
  hubFacilityName: string;
  isActive: boolean;
  acceptedOriginIds: string[]; // Kural 6: Kabul edilen çıkış tesisleri
  acceptedDestinationIds: string[]; // Kural 6: Kabul edilen hedef tesisler
  primaryDeliveryDays: number[]; // Kural 1 & 3: [2] (2 günlük teslimat süresine sahip paketler)
  allowThreeDayConsolidation: boolean; // Kural 5: 3 günlük paketlerin direkt araç yoksa birleştirilmesi
  handlingHours: number; // Kural 8: Aktarma bekleme süresi (saat)
  description: string;
  specialRulesSummary?: string[];
}

export interface DeliveryLegDetail {
  legName: string; // 'Giriş Ayağı (Inbound)' | 'Ana Sevkiyat Ayağı (Main Outbound)'
  fromFacilityId: string;
  fromFacilityName: string;
  toFacilityId: string;
  toFacilityName: string;
  distanceKm: number | null;
  estimatedDays: number | null;
}

export interface DeliveryEstimate {
  distanceKm: number | null;
  directDays: number | null;
  crossDockAddedDays: number;
  totalEstimatedDays: number | null;
  crossDockTransferHours: number;
  waitingHours: number;
  departureTime: string;
  hasMissingDistance: boolean;
  summaryText: string;
  isWarningNonDirect?: boolean;

  // Kural 8: Giriş ayağı, aktarma bekleme süresi ve ana sevkiyat ayağı ayrı hesaplanır
  inboundLeg?: DeliveryLegDetail;
  transferBufferHours?: number;
  mainLeg?: DeliveryLegDetail;
  deliveryDaysCategory?: 1 | 2 | 3;
}

export interface BaselineComparisonInfo {
  changeType:
    | 'KORUNDU'
    | 'OPTIMIZE_EDILDI'
    | 'YENI_EKLENDI'
    | 'CROSS_DOCK_AKTARILDI'
    | 'KISIT_NEDENIYLE_DEGISTI'
    | 'BAGLI_MERKEZE_YONLENDIRILDI';
  baselineLineCode?: string;
  baselineVehicleType?: VehicleCategory;
  baselineDesi?: number;
  explanation: string;
}

export type VehicleScheduleType =
  | 'SABIT_ARAC'
  | 'EK_ARAC'
  | 'GECE_TUTULAN_ARAC'
  | 'PALETLI_AMAZON_ARACI'
  | 'UGRAMALI_ARAC';

export interface RouteWaypoint {
  facilityId: string;
  facilityName: string;
  extraKm: number;
  extraHours: number;
  droppedDesi: number;
  droppedPackages: number;
}

export interface PalletizedAmazonInfo {
  isAmazonVehicle: boolean;
  palletDesi: number;
  decisionThresholdDesi: number; // 4.500 or 7.000
  explanation: string;
}

export interface DestinationDesiBreakdown {
  destinationId: string;
  destinationName: string;
  desi: number;
  packages: number;
}

export interface PlannedVehicleLine {
  id: string;
  lineCode: string;
  originFacilityId: string; // Operational departure center (e.g. AFYON TM, ERZURUM TM, ANKARA TM)
  originFacilityName: string;
  destinationFacilityId: string; // Immediate vehicle destination
  destinationFacilityName: string;
  vehicleType: VehicleCategory;
  capacityDesi: number;
  totalDesi: number;
  totalPackages: number;
  fillRate: number; // 0 - 100+
  routeCategory: RouteCategory;
  transportTypeLabel: string; // 'Direkt' | 'Ankara Cross Dock' | 'Gebze Cross Dock' | 'Aksaray Cross Dock' | 'Gaziantep Cross Dock' | 'Afyon Cross Dock' | 'Ara Hat' | ...
  vehicleQuotaType: VehicleRightType;
  vehicleQuotaLabel: string; // 'Sabit Hat Aracı' | 'Ankara Cross Dock Sabit TIR' | 'Ankara Cross Dock İlave TIR' | 'Antalya Özel TIR' | 'Panelvan' | 'Eksik Araç Tanımı'
  isAnkaraCdFixedTir?: boolean;
  isAnkaraCdAdditionalTir?: boolean;
  isAntalyaSpecialTir?: boolean;
  isMissingVehicleType?: boolean;
  requiresVerification?: boolean;
  requiresRuleApproval?: boolean;
  warningMessage?: string;
  isFeederLeg?: boolean; // True when this line is an initial feeder/collection vehicle whose packages continue on a downstream Cross Dock vehicle
  allowedCoLoadedDestinationIds?: string[]; // Explicit co-loading destinations authorized by Phase 1 rules (e.g. Samsun -> Marmara co-loading Kocaeli/Avrupa)
  phase1RuleTag?: string; // e.g., 'BOLUM_3_ADANA', 'BOLUM_6_AKSARAY_CD', 'BOLUM_12_BURSA_ANKARA_2_KAMYON'
  planStatus: PlanRowStatus;
  loadedSegments: LoadedShipmentSegment[];
  delivery: DeliveryEstimate;
  comparison: BaselineComparisonInfo;
  notes: string[];

  // 1. FAZ EK KURALLAR: Teslimat Süresi, Aynı Gün Sevk, Ankara Akşam Planlaması ve Uğrama Bilgileri
  departureTime?: string;
  isFixedScheduleVehicle?: boolean;
  vehicleScheduleType?: VehicleScheduleType;
  vehicleScheduleLabel?: string;
  remainingCapacityDesi?: number;
  localCollectionDesi?: number;
  crossDockDesi?: number;
  waypoints?: RouteWaypoint[];
  extraRouteKm?: number;
  isPalletized?: boolean;
  palletizedInfo?: PalletizedAmazonInfo;
  planningJustification?: string;
  destinationBreakdown?: DestinationDesiBreakdown[];
  maxLoadLimitDesi?: number; // e.g. Kayseri TIR 15.000 desi loading limit (not general vehicle capacity)
  sameDayPriorityEnforced?: boolean; // True for 1-day delivery SLA packages guaranteed same-day dispatch
}

export interface CrossDockMovement {
  id: string;
  hubFacilityId: CrossDockHubId;
  sourceFacilityId: string;
  sourceFacilityName: string;
  trueDestinationId: string;
  trueDestinationName: string;
  desi: number;
  packages: number;
  reasonType:
    | '12500_16000_ARTIGI'
    | 'DUSUK_HACIM_BIRLESTIRME'
    | 'TIR_KAPASITE_ARTIGI'
    | 'MARMARA_KOCAELI_AVRUPA_KONSOLIDASYON'
    | 'AKSARAY_OZEL_KONSOLIDASYON'
    | 'GAZIANTEP_DIYARBAKIR_ORTAK'
    | 'AFYON_ADANA_OZEL_CD'
    | 'FAZ1_ARA_HAT_AKTARIMI'
    | 'KISIT_ARTIGI'
    | 'PASIF_TESIS_ALTERNATIFI';
  reasonDetail: string;
  feederVehicleLineId?: string;
  outboundVehicleLineId?: string;
  status: 'PLANLANDI' | 'BEKLEYEN_KOTA_ASIMI' | 'BEKLEYEN_DUSUK_HACIM';
}

export interface UnplannedShipment {
  id: string;
  originFacilityId: string;
  originFacilityName: string;
  trueDestinationId: string;
  trueDestinationName: string;
  currentLocationId: string;
  desi: number;
  packages: number;
  reasonCode:
    | 'ANKARA_CD_ARAC_SINIRI'
    | 'ANKARA_TIR_KOTASI'
    | 'YASAKLI_GUZERGAH'
    | 'KAPASITE_ASIMI_ARTIGI'
    | 'TESIS_ICI_KAPSAM_DISI'
    | 'DIREKT_HAT_VE_BAGLI_TESIS_YOK'
    | 'ARAC_TIPI_KISITI'
    | 'EKSIK_ARAC_TANIMI'
    | 'KURAL_ONAYI_GEREKLI';
  explanation: string;
}

export interface BaselineLineTemplate {
  id: string;
  lineCode: string;
  originFacilityId: string;
  destinationFacilityId: string;
  preferredVehicleType: VehicleCategory;
  loadedSourceFacilityIds: string[];
  viaCrossDock?: CrossDockHubId | null;
  notes: string;
}

export interface InvariantCheckItem {
  id: string;
  title: string;
  passed: boolean;
  expected: string;
  actual: string;
  details: string;
}

export interface RuleAuditCheckItem {
  id: string;
  checkNo: number;
  question: string;
  moduleName:
    | 'FacilityRoutingRules'
    | 'VehicleTypeRules'
    | 'CrossDockRules'
    | 'ConsolidationRules'
    | 'SpecialOperationRules'
    | 'DeliveryTimeRules';
  passed: boolean;
  statusLabel: string;
  details: string;
}

export interface RuleVerificationCase {
  id: string;
  testNo: number;
  title: string;
  scenarioDescription: string;
  inputSummary: string;
  expectedOutcome: string;
  actualOutcome: string;
  passed: boolean;
}

export interface CentralRoutingAuditSummary {
  directRoutesPrioritizedCount: number;
  oneDaySameDayDispatchedCount: number;
  delayedOneDayPackagesCount: number; // Sıfır (0) olmalıdır
  sameLaneVehicleAllocationsCount: number;
  waypointDetoursExecutedCount: number;
  specialOperationsExecutedCount: number;
  sameDayEkAracAllocatedCount: number;
  unauthorizedCrossDockDiversionsCount: number; // Sıfır (0) olmalıdır
  trueDestinationPreservationRate: number; // %100 olmalıdır
  decisionFlowStepsEnforced: boolean;
}

export interface PlanningExecutionResult {
  planId: string;
  planName: string;
  mode: 'MEVCUT_PLAN' | 'OPTIMIZE_PLAN' | 'ALTERNATIF_YUKSEK_DOLULUK' | 'ALTERNATIF_HIZLI_TESLIMAT';
  createdAt: string;
  lines: PlannedVehicleLine[];
  feederLines?: PlannedVehicleLine[];
  crossDockMovements: CrossDockMovement[];
  unplannedShipments: UnplannedShipment[];
  summary: {
    totalInputPackages: number;
    totalInputDesi: number;
    intercityInputDesi: number;
    selfRouteDesi: number;
    plannedDirectDesi: number;
    plannedCrossDockDesi: number;
    plannedSelfRouteDesi: number;
    totalPlannedDesi: number;
    unplannedDesi: number;
    totalVehicles: number;
    totalFeederVehicles?: number;
    totalKamyon: number;
    totalTir: number;
    totalPanelvan: number;
    averageFillRate: number;
    ankaraOutboundTirCount: number;
    ankaraCdFixedTirUsed: number;
    ankaraCdAdditionalTirUsed: number;
    ankaraCdAdditionalTirRemaining: number;
    antalyaSpecialTirUsed: number;
    marmaraOutboundTirCount: number;
    capacityOverflowCount: number;
    missingDistanceRoutesCount: number;
    missingVehicleTypeRoutesCount: number;
    estimatedAvgDeliveryDays: number;
    preservedBaselineLinesCount: number;
    optimizedLinesCount: number;
  };
  invariants: InvariantCheckItem[];
  ruleAuditChecks?: RuleAuditCheckItem[];
  allInvariantsPassed: boolean;
  centralRoutingSummary?: CentralRoutingAuditSummary;
}
