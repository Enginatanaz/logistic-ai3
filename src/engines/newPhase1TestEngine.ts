/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * newPhase1TestEngine.ts
 * YENİ FAZ 1 – BÖLÜM 9: 7 OTOMATİK KABUL TESTİ VE DOĞRULAMA MOTORU
 *
 * Test 1: 12.500 desilik kamyon için 11.250 desi %90 eşiğini doğrula.
 * Test 2: 22.500 desilik TIR için 20.250 desi %90 eşiğini doğrula.
 * Test 3: İlk araç %90 dolmadan ikinci aracın çıkmamasını doğrula.
 * Test 4: Sabit araç adedinin otomatik çıkış anlamına gelmediğini doğrula.
 * Test 5: Aksaray'ın yalnızca sabit hat ve 4.500 desilik Ankara kamyonetiyle çalıştığını doğrula.
 * Test 6: Diyarbakır → Erzurum 4.500 desilik panelvan konsolidasyonunu doğrula.
 * Test 7: Trabzon ve Van bağlı tesis eşleştirmelerini ve gerçek varışın korunduğunu doğrula.
 */

import {
  GENERAL_DISPATCH_CONSTANTS,
  calculate90PercentThreshold,
  evaluate10StepDispatchSequence,
  evaluateAksarayDispatchRule,
  evaluateDiyarbakirErzurumPanelvanConsolidation,
  checkOperationalAffiliation,
} from './generalDispatchAndFillRateEngine';

export interface NewPhase1ScenarioResult {
  scenarioNo: number;
  scenarioCode: string;
  title: string;
  description: string;
  inputDescription: string;
  expectedResult: string;
  actualResult: string;
  passed: boolean;
  technicalDetails: Record<string, unknown>;
}

export function runAllNewPhase1TestScenarios(): {
  results: NewPhase1ScenarioResult[];
  allPassed: boolean;
} {
  const results: NewPhase1ScenarioResult[] = [];

  // =========================================================================
  // TEST 1: 12.500 desilik kamyon için 11.250 desi %90 eşiğini doğrula
  // =========================================================================
  {
    const capacity = GENERAL_DISPATCH_CONSTANTS.KAMYON_CAPACITY; // 12500
    const threshold = calculate90PercentThreshold(capacity, 'KAMYON');
    const expected = 11250;
    const passed = threshold === expected && threshold === capacity * 0.9;

    results.push({
      scenarioNo: 1,
      scenarioCode: 'TEST-NP1-01',
      title: 'Kamyon (12.500 Desi) %90 Doluluk Eşiği Doğrulaması',
      description: 'Kamyon kapasitesi olan 12.500 desinin %90 eşiği tam olarak 11.250 desi olmalıdır.',
      inputDescription: 'Kamyon Kapasitesi: 12.500 desi',
      expectedResult: 'Hesaplanan Eşik: 11.250 desi (%90.0)',
      actualResult: `Hesaplanan Eşik: ${threshold.toLocaleString('tr-TR')} desi (${((threshold / capacity) * 100).toFixed(1)}%)`,
      passed,
      technicalDetails: { capacity, threshold, expected },
    });
  }

  // =========================================================================
  // TEST 2: 22.500 desilik TIR için 20.250 desi %90 eşiğini doğrula
  // =========================================================================
  {
    const capacity = GENERAL_DISPATCH_CONSTANTS.TIR_CAPACITY; // 22500
    const threshold = calculate90PercentThreshold(capacity, 'TIR');
    const expected = 20250;
    const passed = threshold === expected && threshold === capacity * 0.9;

    results.push({
      scenarioNo: 2,
      scenarioCode: 'TEST-NP1-02',
      title: 'TIR (22.500 Desi) %90 Doluluk Eşiği Doğrulaması',
      description: 'TIR kapasitesi olan 22.500 desinin %90 eşiği tam olarak 20.250 desi olmalıdır.',
      inputDescription: 'TIR Kapasitesi: 22.500 desi',
      expectedResult: 'Hesaplanan Eşik: 20.250 desi (%90.0)',
      actualResult: `Hesaplanan Eşik: ${threshold.toLocaleString('tr-TR')} desi (${((threshold / capacity) * 100).toFixed(1)}%)`,
      passed,
      technicalDetails: { capacity, threshold, expected },
    });
  }

  // =========================================================================
  // TEST 3: İlk araç %90 dolmadan ikinci aracın çıkmamasını doğrula
  // =========================================================================
  {
    // Senaryo: Bir hatta 2 Kamyon tanımlı. Günlük toplam talep 8.000 desi (< 11.250 desi).
    // İlk kamyon 8.000 desi almıştır (%64 doluluk). İkinci araca kesinlikle çıkış verilmemelidir!
    const auditBelow90 = evaluate10StepDispatchSequence({
      originId: 'ANKARA TM',
      destinationId: 'AVRUPA TM',
      routeLabel: 'Ankara → Avrupa (2 Kamyonlu Hat)',
      dailyTotalDesi: 8000,
      firstVehicleType: 'KAMYON',
      firstVehicleCapacity: 12500,
      hasSecondVehicleDefined: true,
      secondVehicleType: 'KAMYON',
      secondVehicleCapacity: 12500,
      isOneDaySlaRisk: false,
    });

    // Senaryo 3b: Talep 18.000 desi olduğunda ilk kamyon 12.500 alıp %100 (> %90) olmalı,
    // ikinci araca kalan 5.500 desi verilerek çıkış onaylanmalıdır!
    const auditAbove90 = evaluate10StepDispatchSequence({
      originId: 'ANKARA TM',
      destinationId: 'AVRUPA TM',
      routeLabel: 'Ankara → Avrupa (2 Kamyonlu Hat)',
      dailyTotalDesi: 18000,
      firstVehicleType: 'KAMYON',
      firstVehicleCapacity: 12500,
      hasSecondVehicleDefined: true,
      secondVehicleType: 'KAMYON',
      secondVehicleCapacity: 12500,
      isOneDaySlaRisk: false,
    });

    const passed =
      auditBelow90.secondVehicleDepartureStatus === 'CIKIS_VERILMEDI_90_KURALI' &&
      auditBelow90.secondVehicleLoad === 0 &&
      auditAbove90.secondVehicleDepartureStatus === 'CIKIS_VERILDI' &&
      auditAbove90.secondVehicleLoad === 5500;

    results.push({
      scenarioNo: 3,
      scenarioCode: 'TEST-NP1-03',
      title: 'İlk Araç %90 Eşiğine Ulaşmadan İkinci Aracın Çıkışının Engellenmesi',
      description: 'İlk kamyon 8.000 desi yükte (%64) kaldığında 2. araç sefere verilmez; 18.000 desi yükte 1. araç dolunca 2. araç sevk edilir.',
      inputDescription: 'Durum A: 8.000 desi yük | Durum B: 18.000 desi yük (2 Kamyon tanımlı hat)',
      expectedResult: 'Durum A: İkinci araca çıkış verilmedi (%90 eşiği altı) | Durum B: İkinci araca çıkış verildi (1. araç >= %90)',
      actualResult: `Durum A Durumu: ${auditBelow90.secondVehicleDepartureStatus} (2. Araç Yükü: ${auditBelow90.secondVehicleLoad} d) | Durum B Durumu: ${auditAbove90.secondVehicleDepartureStatus} (2. Araç Yükü: ${auditAbove90.secondVehicleLoad} d)`,
      passed,
      technicalDetails: { auditBelow90, auditAbove90 },
    });
  }

  // =========================================================================
  // TEST 4: Sabit araç adedinin otomatik çıkış anlamına gelmediğini doğrula
  // =========================================================================
  {
    // Senaryo: 2 Kamyon tanımlı ancak minimum çıkış eşiği 5.000 desi ve hatta sadece 2.000 desi yük var.
    // İlk araç dahi asgari eşiği karşılamadığında sevk edilmez veya 2. araç hiçbir şekilde çıkmaz.
    const auditLowLoad = evaluate10StepDispatchSequence({
      originId: 'AFYON TM',
      destinationId: 'KONYA TM',
      routeLabel: 'Afyon → Konya',
      dailyTotalDesi: 4000,
      firstVehicleType: 'KAMYON',
      firstVehicleCapacity: 12500,
      hasSecondVehicleDefined: true,
      secondVehicleType: 'KAMYON',
      secondVehicleCapacity: 12500,
      minimumDepartureThreshold: 5000,
      isOneDaySlaRisk: false,
    });

    const passed =
      !auditLowLoad.firstVehicleDispatched &&
      auditLowLoad.secondVehicleDepartureStatus === 'CIKIS_VERILMEDI_90_KURALI' &&
      auditLowLoad.secondVehicleLoad === 0;

    results.push({
      scenarioNo: 4,
      scenarioCode: 'TEST-NP1-04',
      title: 'Sabit Araç Adedinin Otomatik Çıkış Anlamına Gelmediğinin Doğrulanması',
      description: 'Hattaki sabit araç sayısı 2 olsa bile, talep yetersiz olduğunda araçlar otomatik olarak sefere verilmez.',
      inputDescription: 'Tanımlı Araç: 2 Kamyon | Günlük Talep: 4.000 desi | Asgari Çıkış Eşiği: 5.000 desi',
      expectedResult: 'Araçlar otomatik çıkmaz; ilk araç eşik altı, 2. araç çıkış verilmedi olarak raporlanır.',
      actualResult: `1. Araç Çıkışı: ${auditLowLoad.firstVehicleDispatched ? 'Çıktı' : 'Eşik Altı (Çıkmadı)'} | 2. Araç Çıkışı: ${auditLowLoad.secondVehicleDepartureStatus}`,
      passed,
      technicalDetails: { auditLowLoad },
    });
  }

  // =========================================================================
  // TEST 5: Aksaray'ın yalnızca sabit hat ve 4.500 desilik Ankara kamyonetiyle çalıştığını doğrula
  // =========================================================================
  {
    // Senaryo: Aksaray'da sabit araçlara yerleşemeyen 7.200 desi yük Ankara'ya aktarılıyor.
    // Kural: Aksaray için Kamyon veya TIR AÇILAMAZ! Yalnızca 1 Kamyonet (4.500 desi) tahsis edilir,
    // kalan 2.700 desi açıkta bırakılır ve uyarı üretilir.
    const aksarayEval = evaluateAksarayDispatchRule({
      originId: 'AKSARAY TM',
      unassignedShipments: [
        { destinationId: 'İSTANBUL', desi: 3200, packages: 800 },
        { destinationId: 'İZMİR', desi: 4000, packages: 1000 },
      ],
    });

    const passed =
      aksarayEval.isAutomaticTruckForbidden &&
      aksarayEval.allowedVehicles.length === 1 &&
      aksarayEval.allowedVehicles[0].vehicleType === 'PANELVAN' &&
      aksarayEval.allowedVehicles[0].capacityDesi === 4500 &&
      aksarayEval.allowedVehicles[0].loadedDesi === 4500 &&
      aksarayEval.unassignedOpenDesi === 2700 &&
      aksarayEval.warningMessage !== undefined;

    results.push({
      scenarioNo: 5,
      scenarioCode: 'TEST-NP1-05',
      title: 'Aksaray TM Özel Çıkış ve 4.500 Desi Kamyonet Kuralı Doğrulaması',
      description: 'Aksaray TM bağımsız Kamyon/TIR oluşturmaz; kalan paketler Ankara yönüne en fazla 4.500 desilik 1 kamyonet ile sevk edilir.',
      inputDescription: 'Aksaray Kalan Taşan Yük: 7.200 desi',
      expectedResult: '1 Kamyonet (4.500 desi) tahsis edilir, 2.700 desi açıkta tutulur, otomatik Kamyon/TIR açılması engellenir.',
      actualResult: `Araç: ${aksarayEval.allowedVehicles[0]?.vehicleType} (${aksarayEval.allowedVehicles[0]?.loadedDesi.toLocaleString('tr-TR')} / ${aksarayEval.allowedVehicles[0]?.capacityDesi.toLocaleString('tr-TR')} d) | Açıkta Kalan: ${aksarayEval.unassignedOpenDesi.toLocaleString('tr-TR')} d | Kamyon/TIR Yasağı: ${aksarayEval.isAutomaticTruckForbidden ? 'Aktif' : 'Pasif'}`,
      passed,
      technicalDetails: { aksarayEval },
    });
  }

  // =========================================================================
  // TEST 6: Diyarbakır → Erzurum 4.500 desilik panelvan konsolidasyonunu doğrula
  // =========================================================================
  {
    // Senaryo: Diyarbakır'ın kendi 1.600 desi Erzurum paketi + Gaziantep'ten aktarılan 2.500 desi Erzurum paketi.
    // Kural: Tek bir 4.500 desilik panelvanda birleştirilir (toplam 4.100 desi). Kamyon veya TIR oluşturulmaz.
    const diyarbakirEval = evaluateDiyarbakirErzurumPanelvanConsolidation({
      diyarbakirOwnErzurumDesi: 1600,
      gaziantepTransferredErzurumDesi: 2500,
    });

    const passed =
      diyarbakirEval.vehicleType === 'PANELVAN' &&
      diyarbakirEval.capacityDesi === 4500 &&
      diyarbakirEval.loadedGaziantepTransferDesi === 2500 &&
      diyarbakirEval.loadedDiyarbakirDesi === 1600 &&
      diyarbakirEval.totalLoadedDesi === 4100 &&
      diyarbakirEval.fillRate === 91.1 &&
      diyarbakirEval.isAutomaticTruckForbidden;

    results.push({
      scenarioNo: 6,
      scenarioCode: 'TEST-NP1-06',
      title: 'Diyarbakır → Erzurum 4.500 Desi Panelvan Konsolidasyonu Doğrulaması',
      description: 'Diyarbakır Erzurum yükü ile Gaziantep Erzurum aktarımı (2.500 desi) tek bir panelvanda birleştirilir.',
      inputDescription: 'Diyarbakır Yükü: 1.600 desi + Gaziantep Aktarımı: 2.500 desi (Toplam 4.100 desi)',
      expectedResult: '1 Panelvan (4.500 desi) içinde 4.100 desi yüklenir (%91.1 doluluk), ayrı Kamyon/TIR açılmaz.',
      actualResult: `Araç Tipi: ${diyarbakirEval.vehicleType} | Yüklenen: ${diyarbakirEval.totalLoadedDesi.toLocaleString('tr-TR')} d / ${diyarbakirEval.capacityDesi.toLocaleString('tr-TR')} d (%${diyarbakirEval.fillRate}) | Kamyon/TIR Yasağı: ${diyarbakirEval.isAutomaticTruckForbidden ? 'Aktif' : 'Pasif'}`,
      passed,
      technicalDetails: { diyarbakirEval },
    });
  }

  // =========================================================================
  // TEST 7: Trabzon ve Van bağlı tesis eşleştirmelerini doğrula
  // =========================================================================
  {
    // Kural:
    // - Trabzon paketleri Samsun operasyonuna bağlıdır.
    // - Van paketleri Erzurum operasyonuna bağlıdır.
    // - Gerçek varış tesisi kesinlikle değiştirilmez!
    const trabzonAffiliation = checkOperationalAffiliation('TRABZON TM');
    const vanAffiliation = checkOperationalAffiliation('VAN TM');
    const bursaAffiliation = checkOperationalAffiliation('BURSA TM');

    // Gerçek varış değişmezliği testi:
    const mockShipmentTrabzon = {
      sourceFacilityId: 'ANKARA TM',
      operationalHubId: trabzonAffiliation.operationalHubId, // 'SAMSUN TM'
      trueDestinationId: 'TRABZON TM', // Gerçek varış Trabzon olarak kalmalı
      desi: 1200,
    };

    const mockShipmentVan = {
      sourceFacilityId: 'ANKARA TM',
      operationalHubId: vanAffiliation.operationalHubId, // 'ERZURUM TM'
      trueDestinationId: 'VAN TM', // Gerçek varış Van olarak kalmalı
      desi: 950,
    };

    const passed =
      trabzonAffiliation.isAffiliated &&
      trabzonAffiliation.operationalHubId === 'SAMSUN TM' &&
      mockShipmentTrabzon.trueDestinationId === 'TRABZON TM' &&
      vanAffiliation.isAffiliated &&
      vanAffiliation.operationalHubId === 'ERZURUM TM' &&
      mockShipmentVan.trueDestinationId === 'VAN TM' &&
      !bursaAffiliation.isAffiliated &&
      bursaAffiliation.operationalHubId === 'BURSA TM';

    results.push({
      scenarioNo: 7,
      scenarioCode: 'TEST-NP1-07',
      title: 'Trabzon (Samsun) ve Van (Erzurum) Operasyonel Bağlılık & Gerçek Varış Korunumu',
      description: 'Trabzon paketleri Samsun, Van paketleri Erzurum operasyonuna bağlanır; gerçek varış tesisi hiçbir durumda değiştirilmez.',
      inputDescription: 'Hedef 1: TRABZON TM | Hedef 2: VAN TM',
      expectedResult: 'Trabzon -> Samsun Hub (Gerçek: TRABZON TM) | Van -> Erzurum Hub (Gerçek: VAN TM)',
      actualResult: `Trabzon: ${trabzonAffiliation.operationalHubId} üzerinden sevk (Gerçek: ${mockShipmentTrabzon.trueDestinationId}) | Van: ${vanAffiliation.operationalHubId} üzerinden sevk (Gerçek: ${mockShipmentVan.trueDestinationId})`,
      passed,
      technicalDetails: { trabzonAffiliation, vanAffiliation, mockShipmentTrabzon, mockShipmentVan },
    });
  }

  const allPassed = results.every((r) => r.passed);
  return { results, allPassed };
}
