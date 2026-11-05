import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  History,
  Info,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  DirectRouteConnection,
  DistanceMatrix,
  Facility,
  FacilityRelationship,
  FacilityScheduleType,
  ForbiddenRouteRule,
  MatrixData,
  OptimizationParameters,
  PlanningExecutionResult,
  RuleVerificationCase,
  SpecialDistanceLocation,
  VehicleTypeConfig,
} from '../types/logistics';
import { calculateDaysFromDistanceKm } from '../engines/distanceCalculationEngine';
import { getStandardMatrixFacilities } from '../engines/shipmentCalculationEngine';
import { Phase2TestEngine, Phase2ScenarioResult } from '../engines/phase2TestEngine';

/* ============================================================================
 * EKRAN 5: TESİS YÖNETİMİ (FAZ 1 GÜNCEL STANDART)
 * ========================================================================== */
interface FacilityManagementProps {
  facilities: Facility[];
  onAddFacility: (name: string, city: string, isCrossDockOnly: boolean) => void;
  onUpdateFacility: (updated: Facility) => void;
}

export const FacilityManagementView: React.FC<FacilityManagementProps> = ({
  facilities,
  onAddFacility,
  onUpdateFacility,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<
    'ALL' | 'NORMAL' | 'ANKARA_24H' | 'GEBZE_NIGHT_08' | 'CROSS_DOCK' | 'SUBORDINATED' | 'KAMYON_ONLY'
  >('ALL');

  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newIsCdOnly, setNewIsCdOnly] = useState(false);

  // Modal State for Full Facility Inspection & Edit
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [editForm, setEditForm] = useState<Facility | null>(null);
  const [newPackageType, setNewPackageType] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newName.trim().toUpperCase();
    if (!cleaned) return;
    onAddFacility(
      cleaned.endsWith('TM') ? cleaned : `${cleaned} TM`,
      newCity.trim() || cleaned,
      newIsCdOnly
    );
    setNewName('');
    setNewCity('');
    setNewIsCdOnly(false);
  };

  const openEditModal = (facility: Facility) => {
    setSelectedFacility(facility);
    setEditForm({
      ...facility,
      acceptedPackageTypes: facility.acceptedPackageTypes ? [...facility.acceptedPackageTypes] : ['Standart Koli'],
      directOutboundLines: facility.directOutboundLines ? [...facility.directOutboundLines] : [],
      intermediateLines: facility.intermediateLines ? [...facility.intermediateLines] : [],
    });
  };

  const saveEditModal = () => {
    if (editForm) {
      onUpdateFacility(editForm);
      setSelectedFacility(null);
      setEditForm(null);
    }
  };

  // Filter facilities
  const filteredFacilities = facilities.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.city.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'NORMAL') return f.scheduleType === 'NORMAL' || (!f.scheduleType && !f.isCrossDockOnly && f.id !== 'ANKARA TM');
    if (filterType === 'ANKARA_24H') return f.scheduleType === 'ANKARA_24H' || f.id === 'ANKARA TM';
    if (filterType === 'GEBZE_NIGHT_08') return f.scheduleType === 'GEBZE_NIGHT_08' || f.id === 'GEBZE TM';
    if (filterType === 'CROSS_DOCK') return f.crossDockAuthorized || f.isCrossDockOnly || f.role === 'MAIN_CROSS_DOCK';
    if (filterType === 'SUBORDINATED') return Boolean(f.parentFacilityId);
    if (filterType === 'KAMYON_ONLY') return Boolean(f.inboundKamyonOnly);
    return true;
  });

  const totalNormalCount = facilities.filter(f => f.scheduleType === 'NORMAL' || (!f.scheduleType && !f.isCrossDockOnly && f.id !== 'ANKARA TM')).length;
  const crossDockCount = facilities.filter(f => f.crossDockAuthorized || f.isCrossDockOnly || f.role === 'MAIN_CROSS_DOCK').length;
  const subordinatedCount = facilities.filter(f => Boolean(f.parentFacilityId)).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Stats */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>Faz 1 Veri Altyapısı · Tesis & Operasyon Yönetimi</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              20 Lojistik Transfer Merkezi ve Bağımsız Çalışma Takvimleri
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-4xl">
              19 Standart Transfer Merkezi + 1 Özel Gece Cross Dock Merkezi (Gebze TM). Her tesis için çalışma saatleri,
              bağlı olduğu merkez, doğrudan çıkış hatları, ara hatlar, kabul ettiği paket tipleri ve sabit araç konfigürasyonları
              kalıcı veri tabanında bağımsız olarak yönetilir.
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2 shrink-0 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <input
              type="text"
              placeholder="Yeni Tesis (Örn: DENİZLİ TM)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <input
              type="text"
              placeholder="Şehir"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              className="w-28 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 px-1 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsCdOnly}
                onChange={(e) => setNewIsCdOnly(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span className="text-[11px]">Özel CD</span>
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ekle</span>
            </button>
          </form>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Toplam Transfer Merkezi</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">20</span>
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">19 Normal + 1 Özel CD</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Gebze TM matris dışı gece aktarmasıdır</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Normal Çalışma Takvimi</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{totalNormalCount}</span>
            </div>
            <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1">16:00 – 22:00</div>
            <div className="text-[10px] text-slate-500 mt-0.5">16:00 toplama başlangıcı, 22:00 araç çıkışı</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Özel Çalışma Takvimleri</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">2</span>
            </div>
            <div className="text-base font-bold text-purple-700 dark:text-purple-400 mt-1">Ankara 24h & Gebze Gece</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Ankara kesintisiz, Gebze 22:00 - 08:00</div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Cross Dock & Bağlı Tesisler</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{crossDockCount} CD / {subordinatedCount} Bağlı</span>
            </div>
            <div className="text-base font-bold text-amber-700 dark:text-amber-400 mt-1">Van, Merzifon, Trabzon</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Bağlı merkezler ana TM üzerinden sevk edilir</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Tümü ({facilities.length})
          </button>
          <button
            onClick={() => setFilterType('NORMAL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'NORMAL'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Normal Takvim (16:00-22:00)
          </button>
          <button
            onClick={() => setFilterType('ANKARA_24H')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'ANKARA_24H'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Ankara TM (24 Saat)
          </button>
          <button
            onClick={() => setFilterType('GEBZE_NIGHT_08')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'GEBZE_NIGHT_08'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Gebze TM (Gece - 08:00)
          </button>
          <button
            onClick={() => setFilterType('CROSS_DOCK')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'CROSS_DOCK'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Cross Dock Yetkililer ({crossDockCount})
          </button>
          <button
            onClick={() => setFilterType('SUBORDINATED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'SUBORDINATED'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Bağlı / Pasif TM ({subordinatedCount})
          </button>
          <button
            onClick={() => setFilterType('KAMYON_ONLY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filterType === 'KAMYON_ONLY'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Yalnızca Kamyon Varışlı
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tesis adı, kod veya şehir ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Facilities Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-3.5 w-12 text-center">#</th>
                <th className="py-3 px-3.5">Tesis / Kod</th>
                <th className="py-3 px-3.5">Şehir</th>
                <th className="py-3 px-3.5">Çalışma Saatleri & Takvim</th>
                <th className="py-3 px-3.5">Bağlı Olduğu Merkez</th>
                <th className="py-3 px-3.5">Cross Dock Yetkisi</th>
                <th className="py-3 px-3.5">Varış Kısıtı</th>
                <th className="py-3 px-3.5 text-center">Doğrudan Hatlar</th>
                <th className="py-3 px-3.5 text-center">Durum</th>
                <th className="py-3 px-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredFacilities.map((f, index) => {
                const is24h = f.scheduleType === 'ANKARA_24H' || f.id === 'ANKARA TM';
                const isGebze = f.scheduleType === 'GEBZE_NIGHT_08' || f.id === 'GEBZE TM';
                const isCd = f.crossDockAuthorized || f.isCrossDockOnly || f.role === 'MAIN_CROSS_DOCK';

                return (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3.5 font-mono text-slate-400 text-center">{index + 1}</td>
                    
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{f.name}</span>
                        {f.id === 'GEBZE TM' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                            Özel CD
                          </span>
                        )}
                        {f.id === 'ANKARA TM' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold">
                            Ana Hub
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{f.code}</div>
                    </td>

                    <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300 font-medium">
                      {f.city}
                    </td>

                    <td className="py-3 px-3.5">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        is24h
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          : isGebze
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{f.workingHours || (is24h ? '24 Saat Kesintisiz' : isGebze ? '22:00 - 08:00' : '16:00 - 22:00')}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {is24h
                          ? '24 Saat Kesintisiz Takvim'
                          : isGebze
                          ? 'Gece Cross Dock Takvimi'
                          : 'Normal Tesis Takvimi'}
                      </div>
                    </td>

                    <td className="py-3 px-3.5">
                      {f.parentFacilityId ? (
                        <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-medium">
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            → {f.parentFacilityName || f.parentFacilityId}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Bağımsız (Ana Merkez)</span>
                      )}
                      {f.specialRoutingNote && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[220px]" title={f.specialRoutingNote}>
                          {f.specialRoutingNote}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3.5">
                      {isCd ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Yetkili CD</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5">
                      {f.inboundKamyonOnly ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Yalnızca Kamyon</span>
                        </span>
                      ) : f.id === 'MARMARA TM' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          <span>Yalnız Avrupa TIR, Diğerleri Kamyon</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400 text-[11px]">TIR + Kamyon Kabul</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 text-center font-mono">
                      {f.directOutboundLines && f.directOutboundLines.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {f.directOutboundLines.length} Hat
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">0 (Bağlı)</span>
                      )}
                    </td>

                    <td className="py-3 px-3.5 text-center">
                      <button
                        onClick={() => onUpdateFacility({ ...f, isActive: !f.isActive })}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                          f.isActive
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300'
                        }`}
                      >
                        {f.isActive ? 'Aktif' : 'Pasif'}
                      </button>
                    </td>

                    <td className="py-3 px-3.5 text-right">
                      <button
                        onClick={() => openEditModal(f)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded transition-colors cursor-pointer border border-blue-200 dark:border-blue-900"
                      >
                        <Settings className="w-3 h-3" />
                        <span>İncele / Düzenle</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Facility Detailed Inspection & Edit Modal */}
      {selectedFacility && editForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <div className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {editForm.code} · {editForm.city}
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {editForm.name} Operasyonel Tesis Tanımı
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedFacility(null);
                  setEditForm(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              {/* Row 1: Basic identity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tesis Adı
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tesis Kodu
                  </label>
                  <input
                    type="text"
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Şehir
                  </label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Row 2: Schedules (Section 2) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Bölüm 2: Çalışma Saatleri ve Operasyonel Takvim</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Takvim Modeli
                    </label>
                    <select
                      value={editForm.scheduleType || 'NORMAL'}
                      onChange={(e) => {
                        const sType = e.target.value as FacilityScheduleType;
                        let wHours = '16:00 - 22:00';
                        if (sType === 'ANKARA_24H') wHours = '24 Saat Kesintisiz (00:00 - 23:59)';
                        if (sType === 'GEBZE_NIGHT_08') wHours = '22:00 - 08:00 (Gece Operasyonu)';
                        setEditForm({ ...editForm, scheduleType: sType, workingHours: wHours });
                      }}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                    >
                      <option value="NORMAL">Normal Tesis (16:00 toplama başlangıcı – 22:00 araç çıkışı)</option>
                      <option value="ANKARA_24H">Ankara TM (24 Saat Kesintisiz Operasyon)</option>
                      <option value="GEBZE_NIGHT_08">Gebze TM (Gece Operasyonu – Sabah 08:00)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Çalışma Saatleri Açıklaması
                    </label>
                    <input
                      type="text"
                      value={editForm.workingHours || ''}
                      onChange={(e) => setEditForm({ ...editForm, workingHours: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Operational Relationships & Subordination (Section 1 & 7) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ArrowRight className="w-4 h-4 text-purple-600" />
                  <span>Bölüm 7: Bağlı Olduğu Merkez & Cross Dock Yetkisi</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Bağlı Olduğu Operasyon Merkezi
                    </label>
                    <select
                      value={editForm.parentFacilityId || ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        const parentName = val ? facilities.find(f => f.id === val)?.name || val : undefined;
                        setEditForm({
                          ...editForm,
                          parentFacilityId: val,
                          parentFacilityName: parentName,
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-medium"
                    >
                      <option value="">Bağımsız (Hiçbir tesise bağlı değil)</option>
                      <option value="ERZURUM TM">ERZURUM TM (Van TM bağlı merkezi)</option>
                      <option value="SAMSUN TM">SAMSUN TM (Merzifon TM & Trabzon TM bağlı merkezi)</option>
                      <option value="AFYON TM">AFYON TM (Antalya TM besleme merkezi)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Alternatif Aktarma Merkezi (Varsayılan: Ankara TM)
                    </label>
                    <input
                      type="text"
                      value={editForm.alternativeCrossDockId || 'ANKARA TM'}
                      onChange={(e) => setEditForm({ ...editForm, alternativeCrossDockId: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.crossDockAuthorized)}
                      onChange={(e) => setEditForm({ ...editForm, crossDockAuthorized: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Cross Dock Yetkisi</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.inboundKamyonOnly)}
                      onChange={(e) => setEditForm({ ...editForm, inboundKamyonOnly: e.target.checked })}
                      className="rounded text-amber-600"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Varış Yalnızca Kamyon</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.eligibleForGebzeCrossDock)}
                      onChange={(e) => setEditForm({ ...editForm, eligibleForGebzeCrossDock: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Gebze CD Uygunluğu</span>
                  </label>
                </div>
              </div>

              {/* Row 4: Accepted Packages & Fixed Vehicle Config Summary */}
              <div className="space-y-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kabul Ettiği Paket Tipleri
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {(editForm.acceptedPackageTypes || []).map((pkg, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      >
                        <span>{pkg}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editForm.acceptedPackageTypes || []).filter((_, idx) => idx !== i);
                            setEditForm({ ...editForm, acceptedPackageTypes: updated });
                          }}
                          className="hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Paket tipi ekle (Örn: Ağır Paletli Kargo)..."
                      value={newPackageType}
                      onChange={(e) => setNewPackageType(e.target.value)}
                      className="px-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newPackageType.trim()) {
                          const updated = [...(editForm.acceptedPackageTypes || []), newPackageType.trim()];
                          setEditForm({ ...editForm, acceptedPackageTypes: updated });
                          setNewPackageType('');
                        }
                      }}
                      className="px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Ekle
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sabit Araç Konfigürasyon Özeti
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.fixedVehicleConfigSummary || ''}
                    onChange={(e) => setEditForm({ ...editForm, fixedVehicleConfigSummary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-[11px]"
                    placeholder="Örn: 1 TIR (Avrupa), 1 Kamyon (Ankara)..."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Özel Operasyonel Yönlendirme Notu
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.specialRoutingNote || ''}
                    onChange={(e) => setEditForm({ ...editForm, specialRoutingNote: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    placeholder="Özel aktarma veya operasyonel yönlendirme kuralları..."
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => {
                  setSelectedFacility(null);
                  setEditForm(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={saveEditModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Değişiklikleri Kaydet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


/* ============================================================================
 * EKRAN 6: ARAÇ YÖNETİMİ
 * ========================================================================== */
interface VehicleManagementProps {
  vehicles: VehicleTypeConfig[];
  optParams: OptimizationParameters;
  onUpdateVehiclesAndParams: (
    vehicles: VehicleTypeConfig[],
    optParams: OptimizationParameters
  ) => void;
}

export const VehicleManagementView: React.FC<VehicleManagementProps> = ({
  vehicles,
  optParams,
  onUpdateVehiclesAndParams,
}) => {
  const [panelvanCap, setPanelvanCap] = useState(String(optParams.panelvanCapacityDesi || 3500));
  const [kamyonCap, setKamyonCap] = useState(String(optParams.kamyonCapacityDesi));
  const [splitThresh, setSplitThresh] = useState(String(optParams.splitUpperThresholdDesi));
  const [tirCap, setTirCap] = useState(String(optParams.tirCapacityDesi));
  const [minDirect, setMinDirect] = useState(String(optParams.directKamyonMinDesi));

  const applyChanges = () => {
    const pCap = Math.max(500, Number(panelvanCap) || 3500);
    const kCap = Math.max(1000, Number(kamyonCap) || 12500);
    const sThr = Math.max(kCap, Number(splitThresh) || 16000);
    const tCap = Math.max(sThr + 1, Number(tirCap) || 22500);
    const mDir = Math.max(500, Number(minDirect) || 7500);

    const updatedVehicles = vehicles.map((v) => {
      if (v.id === 'PANELVAN') return { ...v, capacityDesi: pCap };
      if (v.id === 'KAMYON') return { ...v, capacityDesi: kCap };
      return { ...v, capacityDesi: tCap };
    });

    onUpdateVehiclesAndParams(updatedVehicles, {
      ...optParams,
      panelvanCapacityDesi: pCap,
      kamyonCapacityDesi: kCap,
      splitUpperThresholdDesi: sThr,
      tirCapacityDesi: tCap,
      directKamyonMinDesi: mDir,
    });
  };

  const resetDefaults = () => {
    setPanelvanCap('3500');
    setKamyonCap('12500');
    setSplitThresh('16000');
    setTirCap('22500');
    setMinDirect('7500');
    const updatedVehicles = vehicles.map((v) => {
      if (v.id === 'PANELVAN') return { ...v, capacityDesi: 3500 };
      if (v.id === 'KAMYON') return { ...v, capacityDesi: 12500 };
      return { ...v, capacityDesi: 22500 };
    });
    onUpdateVehiclesAndParams(updatedVehicles, {
      ...optParams,
      panelvanCapacityDesi: 3500,
      kamyonCapacityDesi: 12500,
      splitUpperThresholdDesi: 16000,
      tirCapacityDesi: 22500,
      directKamyonMinDesi: 7500,
    });
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Araç Yönetimi · Kapasite ve Eşik Motoru
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Araç Türleri, Desi Kapasiteleri ve Seçim Eşikleri
          </h1>
        </div>
        <button
          onClick={resetDefaults}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Standart Kapasitelere Dön (3.500 / 12.500 / 16.000 / 22.500)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Araç Kapasite ve Karar Eşikleri
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Panelvan Maksimum Kapasitesi (Standart: 3.500 desi)
              </label>
              <input
                type="number"
                value={panelvanCap}
                onChange={(e) => setPanelvanCap(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kamyon Maksimum Kapasitesi (Standart: 12.500 desi)
              </label>
              <input
                type="number"
                value={kamyonCap}
                onChange={(e) => setKamyonCap(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                1 Kamyon + Cross Dock Üst Eşiği (Standart: 16.000 desi — 16.000 TIR’a dahil değildir)
              </label>
              <input
                type="number"
                value={splitThresh}
                onChange={(e) => setSplitThresh(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                TIR Maksimum Kapasitesi (Standart: 22.500 desi)
              </label>
              <input
                type="number"
                value={tirCap}
                onChange={(e) => setTirCap(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Direkt Kamyon Öncelik Alt Eşiği (Standart: 7.500 desi)
              </label>
              <input
                type="number"
                value={minDirect}
                onChange={(e) => setMinDirect(e.target.value)}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <button
              onClick={applyChanges}
              className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
            >
              Araç Kapasite ve Eşiklerini Güncelle
            </button>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Deterministik Araç Seçim Algoritması Özeti
          </h2>
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                1. 0 – 12.500 Desi Aralığı
              </div>
              <p className="mt-1">
                Gönderi direkt taşıma eşiğini ({optParams.directKamyonMinDesi.toLocaleString('tr-TR')} desi) karşılıyorsa, mevcut hat planında yer alıyorsa veya Konya→Afyon/Ankara ya da Adana/Diyarbakır→Gaziantep hattındaysa doğrudan 1 adet Kamyon planlanır.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                2. 12.500 – 16.000 Desi Aralığı (16.000 Dahil)
              </div>
              <p className="mt-1">
                1 adet tam dolu Kamyon (12.500 desi) oluşturulur. Kalan (0 – 3.500 desi) doğrudan ikinci bir kamyona veya TIR’a dönüştürülmez; Ankara veya Gebze Cross Dock üzerinden aynı varışlı diğer tesis yükleriyle birleştirilir.
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                3. 16.000 Desi Üzeri (16.001+ Desi)
              </div>
              <p className="mt-1">
                Varış tesisi Bursa veya İzmir değilse ve çıkış tesisinin TIR kotası uygunsa 22.500 desi kapasiteli TIR planlanır. 22.500 desiyi aşan miktar için aynı algoritma tekrar işletilir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * EKRAN 7: KATSAYI, KURALLAR VE BÖLÜM 16 OTOMATİK DOĞRULAMA TEST SİSTEMİ
 * ========================================================================== */
interface RulesAndCoefficientsProps {
  facilities: Facility[];
  optParams: OptimizationParameters;
  forbiddenRules: ForbiddenRouteRule[];
  packageShareMatrix: MatrixData;
  desiPerPackageMatrix: MatrixData;
  verificationCases: RuleVerificationCase[];
  onUpdateOptParams: (updated: OptimizationParameters) => void;
  onToggleForbiddenRule: (ruleId: string) => void;
}

export const RulesAndCoefficientsView: React.FC<RulesAndCoefficientsProps> = ({
  facilities,
  optParams,
  forbiddenRules,
  packageShareMatrix,
  desiPerPackageMatrix,
  verificationCases,
  onUpdateOptParams,
  onToggleForbiddenRule,
}) => {
  const [subTab, setSubTab] = useState<'PHASE1_RULES' | 'PHASE2_SCENARIOS' | 'TESTS' | 'RULES' | 'COEFFICIENTS'>('PHASE2_SCENARIOS');
  const [phase2Results, setPhase2Results] = useState<Phase2ScenarioResult[]>(() => Phase2TestEngine.runAllPhase2TestScenarios().results);
  const [phase2Filter, setPhase2Filter] = useState<string>('ALL');
  const activeFacilities = getStandardMatrixFacilities(facilities);
  const passedCount = verificationCases.filter((c) => c.passed).length;
  const phase2PassedCount = phase2Results.filter((r) => r.passed).length;

  const rerunPhase2Tests = () => {
    const res = Phase2TestEngine.runAllPhase2TestScenarios();
    setPhase2Results(res.results);
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Katsayılar, Operasyon Kuralları ve Doğrulama Motoru
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Dağıtım Katsayıları, Tesis Kısıtları ve 18 Otomatik Hesaplama Testi
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
          <button
            onClick={() => setSubTab('PHASE2_SCENARIOS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'PHASE2_SCENARIOS'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Faz 2: 18 Test Senaryosu ({phase2PassedCount}/{phase2Results.length})
          </button>
          <button
            onClick={() => setSubTab('PHASE1_RULES')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'PHASE1_RULES'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Faz 1: 13 Tesis Kuralları & SLA
          </button>
          <button
            onClick={() => setSubTab('TESTS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'TESTS'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Bölüm 16 Doğrulama Testleri ({passedCount}/{verificationCases.length})
          </button>
          <button
            onClick={() => setSubTab('RULES')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'RULES'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Kısıtlar & Parametreler
          </button>
          <button
            onClick={() => setSubTab('COEFFICIENTS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'COEFFICIENTS'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Excel Dağıtım Katsayıları (19×19)
          </button>
        </div>
      </div>

      {subTab === 'PHASE1_RULES' && (
        <div className="space-y-6">
          {/* SLA and Vehicle Constraints Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Bölüm 8: Teslimat Süresi (SLA) ve Kilometre Kuralları
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Mesafe aralıkları ve çok bacaklı güzergâh SLA gün hesabı kuralları:
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-300">1 GÜN</div>
                  <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 mt-1">0 – 600,0 km</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">600.0 km dahil 1 gün</div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="font-mono text-base font-bold text-blue-700 dark:text-blue-300">2 GÜN</div>
                  <div className="text-[11px] font-semibold text-blue-800 dark:text-blue-200 mt-1">600,1 – 1000,0 km</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">1000.0 km dahil 2 gün</div>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="font-mono text-base font-bold text-amber-700 dark:text-amber-300">3 GÜN</div>
                  <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 mt-1">&gt; 1000,0 km</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">1000 km üzeri mesafeler</div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300">
                <span className="font-bold">Çok Bacaklı Hat SLA Formülü: </span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">1. Bacak Süresi (Gün) + Aktarma Bekleme Süresi + 2. Bacak Süresi (Gün) = Toplam SLA</span>
                <div className="text-[10px] text-slate-500 mt-1">Her bacak kendi kilometresi üzerinden ayrı ayrı hesaplanır ve gün cinsinden toplanır.</div>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Bölüm 6: Varış Tesisi Araç Tipi Kısıtlamaları
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Tesis giriş kısıtlamaları ve filo kapasite kuralları:
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-200">İZMİR TM: </span>
                    <span className="text-amber-800 dark:text-amber-300">Yalnızca Kamyon kabul eder.</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">TIR KESİNLİKLE YASAK</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-200">BURSA TM: </span>
                    <span className="text-amber-800 dark:text-amber-300">Yalnızca Kamyon kabul eder.</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">TIR KESİNLİKLE YASAK</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-200">KOCAELİ TM: </span>
                    <span className="text-amber-800 dark:text-amber-300">Yalnızca Kamyon kabul eder.</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">TIR KESİNLİKLE YASAK</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div>
                    <span className="font-bold text-blue-900 dark:text-blue-200">MARMARA TM: </span>
                    <span className="text-blue-800 dark:text-blue-300">Yalnızca Avrupa TM’den gelen TIR’ları kabul eder.</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100">Diğerleri Yalnız Kamyon</span>
                </div>
              </div>
            </div>
          </div>

          {/* 13 Facilities Operational Rules Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <span>Bölüm 9: 13 Tesis Bazlı Operasyonel Yönlendirme ve Konsolidasyon Kuralları</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sistem motorunda kodlanmış, her transfer merkezinin kendine özgü operasyonel yükleme ve aktarma kuralları:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* 1. Adana TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>1. Adana TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 font-semibold">Gaziantep Direkt</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Adana çıkışlı Gaziantep ve Diyarbakır paketleri doğrudan Gaziantep TM’ye sevk edilir; Ankara üzerinden aktarma yapılamaz.
                  Kayseri, Konya ve Aksaray paketleri Aksaray TM’ye gönderilir.
                </p>
              </div>

              {/* 2. Gaziantep TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>2. Gaziantep TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 font-semibold">Diyarbakır Ortak Araç</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Diyarbakır TM (6.000 desi) + Gaziantep TM (16.000 desi) birleştirilerek Avrupa TM varışına 22.000 desilik ortak TIR oluşturulur.
                  Gaziantep → Erzurum 2.500 desilik yük Diyarbakır üzerinden özel aktarmayla sevk edilir.
                </p>
              </div>

              {/* 3. Diyarbakır TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>3. Diyarbakır TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">Gaziantep CD</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Kayseri, Konya ve Adana paketleri Gaziantep Cross Dock’a alınır ve ertesi gün sevk edilir. Erzurum TM için doğrudan kamyon hattı işletilir.
                </p>
              </div>

              {/* 4. Aksaray TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>4. Aksaray TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 font-semibold">Üçgen Konsolidasyon</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Adana TM, Gaziantep TM ve Kayseri TM arasında üçgen konsolidasyon aktarma merkezi olarak görev yapar.
                  Netlog Ankara TM → Aksaray TM özel mesafesi 265,5 km olarak işletilir.
                </p>
              </div>

              {/* 5. Kayseri TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>5. Kayseri TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 font-semibold">TIR Tavanı 15.000 Desi</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Aksaray TM ile üçgen konsolidasyon kurallarına tabidir. Kayseri çıkışlı TIR yükleme sınırı 15.000 desidir (operasyonel tavan sınır).
                </p>
              </div>

              {/* 6. Samsun TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>6. Samsun TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 font-semibold">Ankara 3 Araç Kaydı</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Merzifon TM ve Trabzon TM Samsun TM’ye bağlıdır. Ankara → Samsun hattında 3 ayrı kayıt tutulur:
                  1 Sabit TIR (22.500 desi), 1 Sabit Kamyon (12.500 desi), Gece Cross Dock için 1 Kamyon (12.500 desi).
                </p>
              </div>

              {/* 7. Erzurum TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>7. Erzurum TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">Van Bağlı Merkezi</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Van TM doğrudan hattı yoksa Erzurum TM operasyonuna bağlanır. Erzurum → Diyarbakır istisnası haricinde tüm paketler Ankara TM Cross Dock üzerinden aktarılır.
                </p>
              </div>

              {/* 8. Konya TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>8. Konya TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 font-semibold">≥8.000 Desi İstisnası</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Antalya-Afyon-Konya toplama operasyonuna tabidir. Doğrudan Hat İstisnası: Varış noktasına ≥ 8.000 desi varsa ve Afyon aracı doluysa doğrudan hat açılır.
                </p>
              </div>

              {/* 9. Afyon TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>9. Afyon TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 font-semibold">Adana Özel CD</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Antalya, Afyon, Konya toplama yüklerini Ankara TIR’ına yükler.
                  İzmir, Afyon ve Bursa (7.500 desi) çıkışlı Adana paketleri Afyon Adana Özel Cross Dock’ta birleştirilir.
                </p>
              </div>

              {/* 10. Bursa TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>10. Bursa TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 font-semibold">Ankara 2 Kamyon</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Yalnızca Kamyon kabul eder (TIR yasak). Ankara’ya 2 kamyon çıkar: 1. Kamyon Çevre TM’ler, 2. Kamyon Ankara Şehir İçi.
                  Gaziantep + Diyarbakır toplamı ≥ 12.500 desi ise ortak araç açılır.
                </p>
              </div>

              {/* 11. İzmir TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>11. İzmir TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 font-semibold">TIR Kesinlikle Yasak</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Giriş ve çıkışta yalnızca Kamyon kullanılır. Varış noktasına ≥ 8.000 desi varsa doğrudan kamyon açılır.
                  Adana yükleri Afyon Adana Cross Dock konsolidasyonuna verilir.
                </p>
              </div>

              {/* 12. Kocaeli TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>12. Kocaeli TM</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 font-semibold">Gebze Besleme</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Yalnızca Kamyon kabul eder (TIR yasak). Gebze TM gece operasyonunu besler.
                  2. Araç Açma Eşikleri: Kamyon için 8.500 desi, TIR için 16.500 desi.
                </p>
              </div>

              {/* 13. Ankara TM & Antalya TM */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 md:col-span-2 lg:col-span-3">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center justify-between">
                  <span>13. Ankara TM & Antalya TM Özel Operasyon Düzeni</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 font-semibold">24 Saat & Gece CD & Özel TIR</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600 dark:text-slate-400 mt-1">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Ankara TM: </span>
                    24 saat kesintisiz çalışır. Akşam saat 22:00’de sabit araçlar çıkar (Maksimum 6 TIR sınırı uygulanır).
                    Gece Cross Dock operasyonunda tüm gelen araçlar boşaltılır, ayrıştırılır ve sabah 03:00–05:00 arasında dağıtım araçlarına yüklenir.
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Antalya TM: </span>
                    Antalya çıkışlı tüm gönderiler Afyon TM üzerinden besleme hattıyla aktarılır.
                    Ankara TM için 1 Özel TIR çıkartılır ve bu TIR, Ankara’nın sabah 6 TIR limitine dahil edilmez (+1 Özel TIR hakkı).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'TESTS' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Bölüm 16: Deterministik Hesaplama Doğrulama ve Kural Test Sistemi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Uygulama hesaplama motorunun referans Excel kurallarıyla %100 uyumu aşağıda gerçek zamanlı test edilmektedir.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>{passedCount} / {verificationCases.length} TEST BAŞARILI</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Kod</th>
                  <th className="py-2.5 px-3">Test Senaryosu</th>
                  <th className="py-2.5 px-3">Girdi Verisi</th>
                  <th className="py-2.5 px-3">Beklenen Kural Sonucu</th>
                  <th className="py-2.5 px-3">Motorun Ürettiği Sonuç</th>
                  <th className="py-2.5 px-3 text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {verificationCases.map((tc) => (
                  <tr key={tc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-500">
                      {tc.id}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {tc.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tc.scenarioDescription}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {tc.inputSummary}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      {tc.expectedOutcome}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {tc.actualOutcome}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {tc.passed ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Doğrulandı</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Hata</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'PHASE2_SCENARIOS' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-1">
                <span>Faz 2 – Bölüm 15</span>
                <span>•</span>
                <span>Otomatik Test Senaryoları Motoru</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                18 Deterministik Lojistik Kural ve Senaryo Doğrulaması
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kullanıcı verilerinden bağımsız referans girdi kümeleriyle 18 kural senaryosu gerçek zamanlı icra edilir.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={rerunPhase2Tests}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Testleri Yeniden Çalıştır</span>
              </button>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{phase2PassedCount} / {phase2Results.length} TEST BAŞARILI (%100 UYUM)</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 w-24">Senaryo</th>
                  <th className="py-2.5 px-3">Test Konusu & Açıklama</th>
                  <th className="py-2.5 px-3">Girdi Verisi</th>
                  <th className="py-2.5 px-3">Beklenen Kural Sonucu</th>
                  <th className="py-2.5 px-3">Motorun Ürettiği Sonuç</th>
                  <th className="py-2.5 px-3 text-right w-28">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {phase2Results.map((tc) => (
                  <tr key={tc.scenarioCode} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400 align-top">
                      {tc.scenarioCode}
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {tc.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {tc.description}
                      </div>
                      {tc.diagnosticNotes && tc.diagnosticNotes.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {tc.diagnosticNotes.map((note, nIdx) => (
                            <span key={nIdx} className="inline-block px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded mr-1">
                              {note}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 align-top">
                      {tc.inputDescription}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 align-top">
                      {tc.expectedResult}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 dark:text-slate-100 align-top">
                      {tc.actualResult}
                    </td>
                    <td className="py-2.5 px-3 text-right align-top">
                      {tc.passed ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Doğrulandı</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Hata</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'RULES' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Tesis Bazlı Özel Kısıtlar ve Parametreler
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Ankara TM Çıkışlı Maksimum TIR Sayısı
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={optParams.ankaraMaxOutboundTir}
                  onChange={(e) =>
                    onUpdateOptParams({
                      ...optParams,
                      ankaraMaxOutboundTir: Math.max(1, Number(e.target.value) || 6),
                    })
                  }
                  className="w-20 px-2.5 py-1 text-right font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Marmara TM Çıkışlı Maksimum TIR Sayısı
                </span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={optParams.marmaraMaxOutboundTir}
                  onChange={(e) =>
                    onUpdateOptParams({
                      ...optParams,
                      marmaraMaxOutboundTir: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="w-20 px-2.5 py-1 text-right font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Ankara Cross Dock Varış Başına Max Kamyon / TIR
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {optParams.ankaraCrossDockMaxKamyonPerDest} Kamyon +{' '}
                  {optParams.ankaraCrossDockMaxTirPerDest} TIR
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Mevcut Hat Çıkış Planını Koru
                </span>
                <input
                  type="checkbox"
                  checked={optParams.preserveBaselinePlan}
                  onChange={(e) =>
                    onUpdateOptParams({
                      ...optParams,
                      preserveBaselinePlan: e.target.checked,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Tesis İçi (Köşegen) Dağılımları Hat Tablosuna Dahil Et
                </span>
                <input
                  type="checkbox"
                  checked={optParams.includeSelfRoutesInLinehaul}
                  onChange={(e) =>
                    onUpdateOptParams({
                      ...optParams,
                      includeSelfRoutesInLinehaul: e.target.checked,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Bölüm 9: Yasaklı Güzergâhlar ve Gönderi Koruma Kuralları
            </h2>
            <div className="space-y-3 text-xs">
              {forbiddenRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {rule.originId} → {rule.destinationId} (Yasaklı Aktarma: {rule.forbiddenViaId})
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      {rule.description}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggleForbiddenRule(rule.id)}
                    className={`px-2.5 py-1 font-semibold rounded shrink-0 cursor-pointer ${
                      rule.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {rule.isActive ? 'Aktif' : 'Pasif'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'COEFFICIENTS' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Hücre Bazlı Desi/Paket Katsayısı ve Paket Dağılım Payı Matrisi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Referans Excel’deki gerçek Paket ve Desi matrislerinden çıkarılan hücre bazlı Desi/Paket oranı ve binde pay katsayıları
            </p>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-3">Çıkış \ Varış (Desi/Paket Oranı)</th>
                  {activeFacilities.map((f) => (
                    <th key={f.id} className="py-2 px-2 text-right whitespace-nowrap">
                      {f.name.replace(' TM', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                {activeFacilities.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-1.5 px-3 font-sans font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {o.name}
                    </td>
                    {activeFacilities.map((d) => {
                      const ratio = desiPerPackageMatrix[o.id]?.[d.id] ?? 4;
                      const sharePermille = ((packageShareMatrix[o.id]?.[d.id] ?? 0) * 1000).toFixed(2);
                      return (
                        <td key={d.id} className="py-1.5 px-2 text-right">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {ratio.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">‰{sharePermille}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * EKRAN 7: MESAFE YÖNETİMİ (KGM STANDART MESAFELERİ & ÖZEL LOKASYONLAR)
 * ========================================================================== */
interface DistanceManagementProps {
  facilities: Facility[];
  distanceMatrix: DistanceMatrix;
  specialLocations?: SpecialDistanceLocation[];
  onUpdateDistance: (originId: string, destId: string, km: number | null) => void;
  onResetDistances: () => void;
}

export const DistanceManagementView: React.FC<DistanceManagementProps> = ({
  facilities,
  distanceMatrix,
  specialLocations = [],
  onUpdateDistance,
  onResetDistances,
}) => {
  const activeFacilities = facilities.filter((f) => f.isActive && !f.isCrossDockOnly);

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Mesafe ve Teslimat Süresi Motoru · 0–600 km: 1 Gün · 600–1.000 km: 2 Gün · 1.000+ km: 3 Gün
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Tesisler Arası Karayolu Mesafe Matrisi (km)
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Bir hücreyi boş bıraktığınızda, sistem mesafe uydurmaz ve ilgili hatta otomatik olarak <strong>“Mesafe Eksik Uyarısı”</strong> gösterir.
          </p>
        </div>

        <button
          onClick={onResetDistances}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>KGM Standart Mesafelerine Döndür</span>
        </button>
      </div>

      {/* Main 19x19 Distance Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-200 dark:bg-slate-800 py-2.5 px-3 min-w-[140px]">
                  Çıkış \ Varış (km)
                </th>
                {activeFacilities.map((d) => (
                  <th key={d.id} className="py-2 px-2 text-right whitespace-nowrap min-w-[88px]">
                    {d.name.replace(' TM', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeFacilities.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 py-1.5 px-3 font-bold text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    {o.name}
                  </td>
                  {activeFacilities.map((d) => {
                    const km = distanceMatrix[o.id]?.[d.id] ?? null;
                    const days = calculateDaysFromDistanceKm(km);
                    return (
                      <td
                        key={d.id}
                        className={`p-1 border-r border-slate-100 dark:border-slate-800 ${
                          km === null ? 'bg-red-50 dark:bg-red-950/30' : ''
                        }`}
                      >
                        <input
                          type="number"
                          placeholder="EKSİK"
                          value={km === null ? '' : km}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === '') {
                              onUpdateDistance(o.id, d.id, null);
                            } else {
                              const parsed = Math.max(0, Math.round(Number(raw)));
                              onUpdateDistance(o.id, d.id, Number.isNaN(parsed) ? null : parsed);
                            }
                          }}
                          className="w-full text-right font-mono tabular-nums px-1 py-0.5 bg-transparent focus:bg-white dark:focus:bg-slate-800 rounded text-slate-900 dark:text-slate-100"
                        />
                        <div className="text-[10px] text-right font-mono text-slate-400 px-1">
                          {days === null ? (
                            <span className="text-red-600 font-semibold">Eksik!</span>
                          ) : (
                            `${days}g`
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 8: Special Distance Locations (Özel Lokasyonlar) */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Bölüm 8: Özel Lokasyon Mesafeleri (Standart Tesislerle Birleştirilmeyen Özel Noktalar)
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Özel Dağıtım Merkezleri ve Koridor Mesafeleri
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Bu özel noktalar standart 19 transfer merkezine zorla dahil edilmeyip ayrı kayıt altında tutulur.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {specialLocations.map((loc) => (
            <div
              key={loc.id}
              className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  {loc.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 font-semibold rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  {loc.category}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                {loc.notes}
              </p>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-mono">
                {loc.distances.map((dist, i) => (
                  <div key={i} className="py-1 flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300 font-sans">
                      → {dist.destination}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {dist.km} km ({calculateDaysFromDistanceKm(dist.km)} Gün)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * EKRAN 6: DİREKT HAT YÖNETİMİ (BÖLÜM 4: 15 TEK YÖNLÜ DİREKT HAT LİSTESİ)
 * ========================================================================== */
interface DirectRouteManagementProps {
  facilities: Facility[];
  directRoutes: DirectRouteConnection[];
  onToggleDirectRoute: (routeId: string) => void;
  onAddDirectRoute: (originId: string, destId: string, notes?: string) => void;
  onResetDirectRoutes: () => void;
}

export const DirectRouteManagementView: React.FC<DirectRouteManagementProps> = ({
  facilities,
  directRoutes,
  onToggleDirectRoute,
  onAddDirectRoute,
  onResetDirectRoutes,
}) => {
  const [selectedOrigin, setSelectedOrigin] = useState<string>('ALL');
  const [newOrigin, setNewOrigin] = useState<string>('ANKARA TM');
  const [newDest, setNewDest] = useState<string>('İZMİR TM');
  const [newNotes, setNewNotes] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const activeFacilities = facilities.filter((f) => f.isActive && !f.isCrossDockOnly);

  const filteredRoutes = directRoutes.filter((r) => {
    if (selectedOrigin !== 'ALL' && r.originId !== selectedOrigin) return false;
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      const matchO = r.originId.toUpperCase().includes(q);
      const matchD = r.destinationId.toUpperCase().includes(q);
      if (!matchO && !matchD) return false;
    }
    return true;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOrigin === newDest) return;
    onAddDirectRoute(newOrigin, newDest, newNotes.trim() || undefined);
    setNewNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Direkt Hat Yönetimi · Bölüm 4: 15 Tek Yönlü Direkt Hat Listesi
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Gerçek Direkt Hat Bağlantıları ve Yön Yönetimi
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            <strong>Kural:</strong> İki tesis arasında karayolu mesafesi olması o hatta direkt araç kalkacağı anlamına gelmez. Yalnızca bu listede aktif olan direkt hatlarda direkt sefer planlanır; diğerleri aktarma merkezleri veya bağlı hub üzerinden taşınır.
          </p>
        </div>

        <button
          onClick={onResetDirectRoutes}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Bölüm 4 Standart 15 Direkt Hat Listesine Sıfırla</span>
        </button>
      </div>

      {/* Add Direct Line Form & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleAdd}
          className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Yeni Direkt Hat Tanımla
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Çıkış Tesisi
              </label>
              <select
                value={newOrigin}
                onChange={(e) => setNewOrigin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {activeFacilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Varış Tesisi (Tek Yönlü)
              </label>
              <select
                value={newDest}
                onChange={(e) => setNewDest(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {activeFacilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Operasyonel Açıklama / Not
              </label>
              <input
                type="text"
                placeholder="Örn: Sezonluk ekspres direkt hat"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
            >
              Direkt Hattı Ekle ve Aktifleştir
            </button>
          </div>
        </form>

        <div className="lg:col-span-2 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Tanımlı Direkt Hatlar ({filteredRoutes.length} Hat)
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="ALL">Tüm Çıkış Tesisleri</option>
                {activeFacilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} Çıkışlı Hatlar
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Filtrele..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-32 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[500px] divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {filteredRoutes.map((route) => (
              <div
                key={route.id}
                className="py-2.5 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded"
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                    <span>{route.originId}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-blue-600 dark:text-blue-400">{route.destinationId}</span>

                    {/* Operational Vehicle Badge */}
                    {route.operationalVehicleType === 'TANIMSIZ' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                        Eksik Araç Tanımı (!)
                      </span>
                    ) : route.operationalVehicleType === 'PANELVAN' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        Panelvan ({route.capacityDesi?.toLocaleString('tr-TR')} d)
                      </span>
                    ) : route.operationalVehicleType === 'TIR' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300">
                        TIR ({route.capacityDesi?.toLocaleString('tr-TR')} d)
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300">
                        Kamyon ({route.capacityDesi?.toLocaleString('tr-TR')} d)
                      </span>
                    )}

                    {/* Route Quota Badge */}
                    {route.routeQuotaType === 'ANTALYA_OZEL_TIR' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300">
                        Antalya Özel TIR
                      </span>
                    )}

                    {/* Verification Required Badge */}
                    {route.requiresVerification && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300">
                        Doğrulanmalı
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500">
                    {route.notes || (route.isUserOverridden ? 'Kullanıcı tanımlı direkt hat' : 'Bölüm 4 standart direkt bağlantı')}
                  </div>

                  {route.warningMessage && (
                    <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                      ⚠ {route.warningMessage}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                      route.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {route.isActive ? 'Aktif Direkt' : 'Pasif'}
                  </span>
                  <button
                    onClick={() => onToggleDirectRoute(route.id)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded cursor-pointer"
                  >
                    {route.isActive ? 'Pasife Al' : 'Aktifleştir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * EKRAN 10: OPERASYONEL BAĞLILIKLAR (BÖLÜM 1 & 10: VAN, MERZİFON, TRABZON, ANTALYA)
 * ========================================================================== */
interface FacilityRelationshipsProps {
  facilities: Facility[];
  relationships: FacilityRelationship[];
  onToggleOriginActive: (facilityId: string) => void;
}

export const FacilityRelationshipsView: React.FC<FacilityRelationshipsProps> = ({
  facilities,
  relationships,
  onToggleOriginActive,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Operasyonel Bağlılıklar · Bölüm 1 & Bölüm 10: Pasif ve Bağlı Tesis Davranışı
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
          Bağlı Tesisler, Ana Hub İlişkileri ve Özel Besleyici Güzergâhlar
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
          <strong>Temel Prensip:</strong> Bir tesisin başka bir tesise bağlı çalışması, iki tesisin aynı kabul edilmesi demek değildir. Paketlerin gerçek kaynak ve varış tesisleri manifestoda daima korunur.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {relationships.map((rel) => (
          <div
            key={rel.facilityId}
            className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-mono text-slate-500">Bağlı Tesis</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {rel.facilityName}
                </h2>
              </div>
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded ${
                  rel.isOriginActive
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                }`}
              >
                {rel.isOriginActive ? 'Doğrudan Çıkış Açık' : 'Hub Üzerinden Sevk'}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg">
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Ana Bağlı Hub:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{rel.parentFacilityName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Alternatif Aktarma Merkezi:</span>
                <span className="font-mono">{rel.alternativeCrossDockId}</span>
              </div>
              <p className="pt-1 leading-relaxed">
                {rel.description}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {rel.isOriginActive ? 'Bu tesisten direkt araç planlamasına izin verilir' : 'Tüm yükler önce bağlı hub havuzuna aktarılır'}
              </span>
              <button
                onClick={() => onToggleOriginActive(rel.facilityId)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer"
              >
                {rel.isOriginActive ? 'Hub Bağlılığına Döndür' : 'Doğrudan Çıkışı Aktifleştir'}
              </button>
            </div>
          </div>
        ))}

        {/* Antalya TM Feeder Special Behavior Card */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-mono text-slate-500">Özel Besleyici Güzergâh (Bölüm 4.16)</span>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ANTALYA TM
              </h2>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              Afyon TM Besleme Aktif
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg">
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Zorunlu Besleme Hattı:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">AFYON TM</span>
            </div>
            <p className="pt-1 leading-relaxed">
              Bölüm 4.16 kuralı uyarınca Antalya TM’den uzun hat doğrudan araç kaldırılmaz. Antalya TM çıkışlı tüm gönderiler Afyon TM aktarma havuzuna bağlanır; Afyon TM üzerinden ana hat araçlarıyla gerçek varış merkezine sevk edilir. Gerçek paket kaynağı "ANTALYA TM" olarak muhafaza edilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};


/* ============================================================================
 * EKRAN 9: PLANLAMA GEÇMİŞİ
 * ========================================================================== */
interface PlanningHistoryProps {
  currentResult: PlanningExecutionResult;
  history: PlanningExecutionResult[];
  onSaveCurrentToHistory: (name: string) => void;
  onDeleteHistoryItem: (planId: string) => void;
}

export const PlanningHistoryView: React.FC<PlanningHistoryProps> = ({
  currentResult,
  history,
  onSaveCurrentToHistory,
  onDeleteHistoryItem,
}) => {
  const [planTitle, setPlanTitle] = useState('');
  const [selectedCompareId, setSelectedCompareId] = useState<string | null>(
    history[0]?.planId ?? null
  );

  const comparedPlan =
    history.find((h) => h.planId === selectedCompareId) ?? history[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Planlama Geçmişi · Kalıcı Veri Katmanı (IndexedDB)
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Kaydedilen Hat Planları ve Senaryo Karşılaştırma
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            placeholder="Senaryo Adı (Örn: Kasım 1. Hafta Onaylı Plan)"
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            className="w-64 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
          />
          <button
            onClick={() => {
              onSaveCurrentToHistory(
                planTitle.trim() || `${currentResult.planName} (${new Date().toLocaleTimeString('tr-TR')})`
              );
              setPlanTitle('');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Mevcut Planı Geçmişe Kaydet</span>
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-3">
          <History className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Henüz kaydedilmiş geçmiş plan bulunmuyor
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Yukarıdaki “Mevcut Planı Geçmişe Kaydet” butonuna tıklayarak aktif hat planını kaydedebilir ve farklı senaryolarla karşılaştırabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Kaydedilen Planlar ({history.length})
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {history.map((item) => (
                <div
                  key={item.planId}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {item.planName}
                    </div>
                    <div className="text-slate-500 font-mono mt-0.5">
                      {new Date(item.createdAt).toLocaleString('tr-TR')} · {item.summary.totalVehicles} Araç ({item.summary.totalTir} TIR, {item.summary.totalKamyon} Kamyon) · %{item.summary.averageFillRate} Doluluk
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedCompareId(item.planId)}
                      className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                        comparedPlan?.planId === item.planId
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      Karşılaştır
                    </button>
                    <button
                      onClick={() => onDeleteHistoryItem(item.planId)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {comparedPlan && (
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Aktif Plan vs Seçilen Geçmiş Plan Karşılaştırması
              </h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-2 text-left">Kriter</th>
                    <th className="py-2 text-right">Aktif Plan</th>
                    <th className="py-2 text-right">{comparedPlan.planName}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                  <tr>
                    <td className="py-2 font-sans text-slate-600 dark:text-slate-400">Toplam Desi</td>
                    <td className="py-2 text-right font-bold">{currentResult.summary.totalInputDesi.toLocaleString('tr-TR')}</td>
                    <td className="py-2 text-right">{comparedPlan.summary.totalInputDesi.toLocaleString('tr-TR')}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-sans text-slate-600 dark:text-slate-400">Toplam Araç</td>
                    <td className="py-2 text-right font-bold">{currentResult.summary.totalVehicles}</td>
                    <td className="py-2 text-right">{comparedPlan.summary.totalVehicles}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-sans text-slate-600 dark:text-slate-400">Toplam TIR / Kamyon</td>
                    <td className="py-2 text-right font-bold">
                      {currentResult.summary.totalTir} / {currentResult.summary.totalKamyon}
                    </td>
                    <td className="py-2 text-right">
                      {comparedPlan.summary.totalTir} / {comparedPlan.summary.totalKamyon}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 font-sans text-slate-600 dark:text-slate-400">Ortalama Doluluk</td>
                    <td className="py-2 text-right font-bold text-emerald-600">
                      %{currentResult.summary.averageFillRate}
                    </td>
                    <td className="py-2 text-right">%{comparedPlan.summary.averageFillRate}</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-sans text-slate-600 dark:text-slate-400">Cross Dock Desi</td>
                    <td className="py-2 text-right font-bold">
                      {currentResult.summary.plannedCrossDockDesi.toLocaleString('tr-TR')}
                    </td>
                    <td className="py-2 text-right">
                      {comparedPlan.summary.plannedCrossDockDesi.toLocaleString('tr-TR')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * EKRAN 10: RAPORLAMA VE EXCEL DIŞA AKTARMA MERKEZİ
 * ========================================================================== */
interface ReportingViewProps {
  result: PlanningExecutionResult;
  onExportExcel: () => void;
}

export const ReportingView: React.FC<ReportingViewProps> = ({
  result,
  onExportExcel,
}) => {
  const reportSheets = [
    {
      no: '01',
      name: 'Hat Planlama',
      desc: 'Tüm çıkış tesisleri, hat kodları, yüklenen tesisler, varış noktası, desi, kapasite ve doluluk oranlarını içeren ana operasyon tablosu.',
      count: `${result.lines.length} Araç Hattı`,
    },
    {
      no: '02',
      name: 'Araç Listesi',
      desc: 'TIR (22.500 desi) ve Kamyon (12.500 desi) bazında araç manifestosu, boş kapasite ve kalkış saatleri.',
      count: `${result.summary.totalTir} TIR · ${result.summary.totalKamyon} Kamyon`,
    },
    {
      no: '03',
      name: 'Tesis Bazlı Yükleme',
      desc: '19 standart transfer merkezi + Gebze Cross Dock için toplam çıkan ve varışlı araç/desi icmali.',
      count: '20 Tesis İcmali',
    },
    {
      no: '04',
      name: 'Desi Hesapları',
      desc: 'Üç Hacim Ortak Katsayı Modeli ile hesaplanan 19×19 Desi Dağılım Matrisi ve Paket Dağılım Matrisi.',
      count: `${result.summary.totalInputDesi.toLocaleString('tr-TR')} Desi`,
    },
    {
      no: '05',
      name: 'Araç Doluluk Oranları',
      desc: 'Doluluk oranına göre sıralı araç verimlilik analizi (%85+ Yüksek Verimli, %65-85 Normal, <%65 Zorunlu Direkt).',
      count: `Ort. %${result.summary.averageFillRate} Doluluk`,
    },
    {
      no: '06',
      name: 'Cross Dock Planı',
      desc: 'Ankara Cross Dock ve Gebze Cross Dock üzerinden birleştirilen her gönderinin kaynak, gerçek varış ve birleştirme nedeni.',
      count: `${result.crossDockMovements.length} Aktarma Kaydı`,
    },
    {
      no: '07',
      name: 'Planlanamayan Gönderiler',
      desc: 'Ankara Cross Dock varış başına 1 Kamyon + 1 TIR sınırı veya 6 TIR kotası nedeniyle bekleyen gönderiler.',
      count: `${result.unplannedShipments.length} Bekleyen Kayıt`,
    },
    {
      no: '08',
      name: 'Mesafe ve Teslimat',
      desc: 'Tesisler arası karayolu mesafeleri (km) ve 1-2-3 gün tahmini teslimat süresi matrisi.',
      count: `Ort. ${result.summary.estimatedAvgDeliveryDays} Gün`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Raporlama ve Dışa Aktarma Merkezi · 8 Sayfalı Kurumsal Excel Çıktısı
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Operasyonel Excel Raporu (.xlsx)
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Uygulamanın kendi bağımsız motorunda ürettiği tüm hat planlama, Cross Dock ve desi tablolarını tek bir çok sayfalı Excel çalışma kitabı olarak indirebilirsiniz.
          </p>
        </div>

        <button
          onClick={onExportExcel}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shrink-0 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>8 Sayfalı Excel Raporunu İndir (.xlsx)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportSheets.map((sh) => (
          <div
            key={sh.no}
            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>SAYFA {sh.no}</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{sh.count}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1.5">
                {sh.name}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {sh.desc}
              </p>
            </div>
            <button
              onClick={onExportExcel}
              className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Çalışma Kitabıyla İndir</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
