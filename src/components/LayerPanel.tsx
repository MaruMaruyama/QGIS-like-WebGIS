import React, { useState, useRef } from 'react';
import { GISLayer, VectorStyle } from '../types/gis';
import { 
  Layers, EyeOff, Clipboard, RefreshCw, 
  Trash2, Sliders, ChevronUp, ChevronDown, Plus, FileCode, ImageIcon, 
  Map, HelpCircle, Upload, CheckCircle2, AlertTriangle
} from 'lucide-react';

interface LayerPanelProps {
  layers: GISLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayer: (index: number, direction: 'up' | 'down') => void;
  onAddLayer: (newLayer: GISLayer) => void;
  onOpenProperties: (layer: GISLayer) => void;
}

export default function LayerPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisibility,
  onDeleteLayer,
  onMoveLayer,
  onAddLayer,
  onOpenProperties
}: LayerPanelProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  
  // States for importing custom Vector (GeoJSON)
  const [geoJSONInput, setGeoJSONInput] = useState('');
  const [customVectorName, setCustomVectorName] = useState('インポート・レイヤー');
  const [vectorImportError, setVectorImportError] = useState('');
  const [vectorSuccess, setVectorSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for importing custom Georeferenced Raster
  const [customRasterName, setCustomRasterName] = useState('ジオリファレンス空撮画像');
  const [rasterUrl, setRasterUrl] = useState('');
  const [swLat, setSwLat] = useState('35.660000');
  const [swLng, setSwLng] = useState('139.720000');
  const [neLat, setNeLat] = useState('35.700000');
  const [neLng, setNeLng] = useState('139.780000');
  const [rasterImportError, setRasterImportError] = useState('');

  // Built-in Japanese Base tile structures we can easily add
  const presetTiles = [
    {
      name: 'Google Maps (標準道路地図)',
      url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      attribution: 'Google Maps'
    },
    {
      name: 'Google Maps (衛星航空写真)',
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      attribution: 'Google Maps'
    },
    {
      name: 'Google Maps (ハイブリッド地図)',
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      attribution: 'Google Maps'
    },
    {
      name: 'Google Maps (地形地図)',
      url: 'https://mt1.google.com/vt/lyrs=t&x={x}&y={y}&z={z}',
      attribution: 'Google Maps'
    },
    {
      name: 'OpenStreetMap (標準表示)',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: 'OSM contributors'
    },
    {
      name: 'OpenStreetMap (暗色ダークマルチ)',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: 'CartoDB'
    },
    {
      name: '国土地理院(標準地図)',
      url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
      attribution: '国土地理院標準'
    },
    {
      name: '国土地理院(淡色地図)',
      url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
      attribution: '国土地理院淡色'
    },
    {
      name: '国土地理院(空中写真)',
      url: 'https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg',
      attribution: '国土地理院最新オルソ'
    }
  ];

  // Load sample geojson on click
  const insertSampleGeoJSON = (type: 'points' | 'polygons') => {
    if (type === 'points') {
      const sample = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name_ja: '渋谷スクランブル交差点', address: '渋谷区道玄坂', node_type: '観光' },
            geometry: { type: 'Point', coordinates: [139.7013, 35.6595] }
          },
          {
            type: 'Feature',
            properties: { name_ja: '浅草 浅草寺', address: '台東区浅草', node_type: '歴史寺社' },
            geometry: { type: 'Point', coordinates: [139.7967, 35.7148] }
          }
        ]
      };
      setGeoJSONInput(JSON.stringify(sample, null, 2));
      setCustomVectorName('渋谷・浅草 観光スポット');
    } else {
      const sample = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name_ja: '上野恩賜公園 桜の広場', type: '公園区画' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [139.7690, 35.7160], [139.7750, 35.7170],
                [139.7745, 35.7101], [139.7680, 35.7110], [139.7690, 35.7160]
              ]]
            }
          }
        ]
      };
      setGeoJSONInput(JSON.stringify(sample, null, 2));
      setCustomVectorName('上野公園・区画範囲');
    }
  };

  const handleVectorTextImport = () => {
    setVectorImportError('');
    setVectorSuccess(false);
    try {
      if (!geoJSONInput.trim()) {
        throw new Error('GeoJSONテキストを入力してください。');
      }
      
      const parsed = JSON.parse(geoJSONInput);
      if (!parsed.type) {
        throw new Error('GeoJSONフォーマットが無効です。type属性が欠けています。');
      }

      // Generate random color style helper
      const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      const randomFillColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

      const customLayer: GISLayer = {
        id: `custom-vector-${Date.now()}`,
        name: customVectorName || `インポート・ベクター-${layers.length + 1}`,
        type: 'vector',
        format: 'geojson',
        visible: true,
        opacity: 1,
        geojsonData: parsed,
        style: {
          color: randomColor,
          fillColor: randomFillColor,
          weight: 3,
          opacity: 0.9,
          fillOpacity: 0.6,
          pointSize: 6,
          labelField: parsed.features?.[0]?.properties ? Object.keys(parsed.features[0].properties)[0] : undefined
        }
      };

      onAddLayer(customLayer);
      setVectorSuccess(true);
      setGeoJSONInput('');
      setCustomVectorName('インポート・レイヤー');
      setTimeout(() => setActiveTab('list'), 1000);
    } catch (e: any) {
      setVectorImportError(e.message || 'JSON構文が無効です。');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomVectorName(file.name.replace(/\.[^/.]+$/, ''));
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setGeoJSONInput(text);
    };
    reader.readAsText(file);
  };

  const handlePresetAdd = (preset: typeof presetTiles[0]) => {
    const customPresetLayer: GISLayer = {
      id: `tiles-${Date.now()}`,
      name: `${preset.name}`,
      type: 'raster',
      format: 'xyz_tile',
      visible: true,
      opacity: 1,
      url: preset.url,
      attribution: `&copy; ${preset.attribution}`
    };
    onAddLayer(customPresetLayer);
    setActiveTab('list');
  };

  const fillRasterPresetSample = () => {
    // Beautiful scenic old historical mapping of central Tokyo or color grid patterns
    // We can use a creative gradient placeholder as base64 or beautiful watercolor painting url
    setRasterUrl('https://upload.wikimedia.org/wikipedia/commons/e/ec/Nihonbashi_Meisho_Edo_Momoyama.jpg');
    setCustomRasterName('日本橋 江戸風情鳥瞰古地図（1650）');
    setSwLat('35.672000');
    setSwLng('139.735000');
    setNeLat('35.710000');
    setNeLng('139.795000');
  };

  const handleRasterImport = () => {
    setRasterImportError('');
    if (!rasterUrl.trim()) {
      setRasterImportError('画像URL（またはDataURI / Base64）を入力してください。');
      return;
    }

    const sw_lat = parseFloat(swLat);
    const sw_lng = parseFloat(swLng);
    const ne_lat = parseFloat(neLat);
    const ne_lng = parseFloat(neLng);

    if (isNaN(sw_lat) || isNaN(sw_lng) || isNaN(ne_lat) || isNaN(ne_lng)) {
      setRasterImportError('バウンディングボックスの経緯度が数値ではありません。');
      return;
    }

    if (sw_lat >= ne_lat || sw_lng >= ne_lng) {
      setRasterImportError('南西の座標値は、北東の座標値より小さくある必要があります。');
      return;
    }

    const rasterLayer: GISLayer = {
      id: `raster-georef-${Date.now()}`,
      name: customRasterName || `カスタム・ラスターオーバーレイ`,
      type: 'raster',
      format: 'georeferenced_image',
      visible: true,
      opacity: 0.7,
      url: rasterUrl,
      bounds: [
        [sw_lat, sw_lng],
        [ne_lat, ne_lng]
      ],
      attribution: 'Custom Georeferenced Imagery Overlay'
    };

    onAddLayer(rasterLayer);
    setRasterUrl('');
    setCustomRasterName('ジオリファレンス・画像レイヤー');
    setActiveTab('list');
  };

  return (
    <div id="gis-layer-manager" className="w-[320px] bg-white border-r border-gray-200 flex flex-col h-full shrink-0 select-none shadow-none">
      
      {/* Panel Tab Switcher */}
      <div className="flex border-b border-gray-150 bg-gray-50 text-xs">
        <button
          id="tab-layers-list"
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-3 text-center font-sans font-semibold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'list'
              ? 'border-blue-650 text-blue-650 bg-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>レイヤー ({layers.length})</span>
        </button>
        <button
          id="tab-layers-add"
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-3 text-center font-sans font-semibold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'add'
              ? 'border-blue-650 text-blue-650 bg-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>インポート・追加</span>
        </button>
      </div>

      {/* 1. Layers List Tab Panel */}
      {activeTab === 'list' && (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
          
          {/* Layer Panel Quick Info Info bar */}
          <div className="px-4 py-2 bg-blue-50/50 text-[11px] text-blue-900 flex items-center gap-2 border-b border-blue-100/40 font-medium">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span>地物追加はアクティブに選択したベクターに対して行われます。</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {layers.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 border border-dashed border-slate-200 rounded-lg bg-white p-4">
                <Layers className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                <span className="text-center">レイヤーが存在しません。<br />右上のタブからGeoJSONや地図タイルを追加してください。</span>
              </div>
            ) : (
              layers.map((layer, index) => {
                const isSelected = selectedLayerId === layer.id;
                return (
                  <div
                    key={layer.id}
                    id={`layer-item-${layer.id}`}
                    onClick={() => onSelectLayer(layer.id)}
                    className={`p-2.5 rounded-md border transition-all cursor-pointer bg-white group flex items-center justify-between ${
                      isSelected
                        ? 'border-blue-500 ring-1 ring-blue-550/15 bg-blue-50/5 shadow-xs scale-[1.01]'
                        : 'border-gray-200 hover:border-gray-300/80 hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Layer selection controls & info */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Checkbox eyeball to toggle visibility */}
                      <button
                        align-center="true"
                        id={`vis-btn-${layer.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleVisibility(layer.id);
                        }}
                        className={`text-slate-400 hover:text-slate-705 transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer ${
                          layer.visible ? 'text-blue-600' : 'opacity-40'
                        }`}
                        title={layer.visible ? 'レイヤーの非表示' : 'レイヤーの表示'}
                      >
                        {layer.visible ? <Layers className="w-4 h-4 text-blue-600" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      {/* Formatting icons based on Vector/Raster */}
                      <div className="flex-shrink-0">
                        {layer.type === 'vector' ? (
                          <div 
                            className="w-3.5 h-3.5 rounded-xs border shadow-2xs" 
                            style={{ 
                              borderColor: layer.style?.color || '#3b82f6', 
                              backgroundColor: layer.style?.fillColor || '#93c5fd',
                              borderWidth: `${Math.min(2, (layer.style?.weight || 2))}px` 
                            }}
                            title="ベクター(地物レイヤー)"
                          />
                        ) : (
                          <Map className="w-4 h-4 text-sky-600" title="ラスター(地図レイヤー・空撮)" />
                        )}
                      </div>

                      {/* Name of Layer */}
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs block truncate ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                          {layer.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono block tracking-tight uppercase leading-none mt-0.5">
                          {layer.type === 'vector' ? 'Vector (GeoJSON)' : `Raster (${layer.format})`}
                        </span>
                      </div>
                    </div>

                    {/* Operational controls */}
                    <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0">
                      
                      {/* Move up */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveLayer(index, 'up');
                        }}
                        disabled={index === 0}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                        title="上へ重ねる"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Move down */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveLayer(index, 'down');
                        }}
                        disabled={index === layers.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                        title="下へ重ねる"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Symbology Styles properties */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProperties(layer);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        title="スタイル/プロパティ"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Layer button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLayer(layer.id);
                        }}
                        className="p-1 rounded text-red-400 hover:text-red-700 hover:bg-red-50"
                        title="レイヤー削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-1.5 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-500 text-xs px-1">状態凡例:</span>
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 bg-blue-50 border border-blue-550 inline-block rounded-xs"></span>
              <span>選択中：マップ上でハイライト、かつ下パネルで属性テーブルを開けます</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add New GIS Layer tab panel */}
      {activeTab === 'add' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/10 min-h-0">
          
          {/* Section A: Ready GIS Basemaps presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">A. 標準ラスタータイル地図の追加</span>
            <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
              {presetTiles.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetAdd(preset)}
                  className="w-full text-left p-2 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 flex items-center justify-between text-xs transition-all text-slate-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Map className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate font-medium">{preset.name}</span>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-sm shrink-0 font-mono">XYZ</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section B: Custom Vector Layer (GeoJSON Upload & Paste) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">B. ベクターデータ (GeoJSON)</span>
              <div className="flex gap-1.5 text-[10px]">
                <button 
                  onClick={() => insertSampleGeoJSON('points')}
                  className="text-blue-650 hover:underline cursor-pointer font-medium"
                >
                  [点サンプル]
                </button>
                <button 
                  onClick={() => insertSampleGeoJSON('polygons')}
                  className="text-blue-650 hover:underline cursor-pointer font-medium"
                >
                  [面サンプル]
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">レイヤー表示名</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  value={customVectorName}
                  onChange={(e) => setCustomVectorName(e.target.value)}
                />
              </div>

              {/* Drag Area or File Choose */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-lg p-4 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                <span className="text-[10px] text-slate-500 block font-medium">GeoJSONファイルをドロップ または 選択</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".geojson,.json"
                  className="hidden"
                />
              </div>

              {/* GeoJSON text paste box */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">GeoJSONテキスト(構造データ) の貼り付け</label>
                <textarea
                  className="w-full h-20 text-[10px] font-mono p-1.5 border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder='{"type": "FeatureCollection", "features": [...] }'
                  value={geoJSONInput}
                  onChange={(e) => setGeoJSONInput(e.target.value)}
                />
              </div>

              {vectorImportError && (
                <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-200 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="break-all">{vectorImportError}</span>
                </div>
              )}

              {vectorSuccess && (
                <div className="text-[10px] text-blue-900 bg-blue-50 p-2 rounded border border-blue-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>レイヤーがロードされました！</span>
                </div>
              )}

              <button
                onClick={handleVectorTextImport}
                className="w-full bg-blue-600 text-white hover:bg-blue-700 text-xs py-1.5 rounded shadow-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>ベクターレイヤーを読込・追加</span>
              </button>
            </div>
          </div>

          {/* Section C: Georeferenced Custom imagery */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block">C. ジオリファレンス・画像 ラスター</span>
              <button 
                onClick={fillRasterPresetSample}
                className="text-[10px] text-blue-650 hover:underline cursor-pointer font-medium"
              >
                [江戸の古地図例を表示]
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">ラスターレイヤー名</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-hidden"
                  value={customRasterName}
                  onChange={(e) => setCustomRasterName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">画像URL (URL / Base64画像)</label>
                <input
                  type="text"
                  placeholder="https://example.com/map-image.png"
                  className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                  value={rasterUrl}
                  onChange={(e) => setRasterUrl(e.target.value)}
                />
              </div>

              {/* Bounding Box coordinates */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1 flex items-center justify-between">
                  <span>画像の投影座標 (緯度・経度の四隅境界)</span>
                  <span className="text-[9px] text-slate-400 font-normal">WGS84 経緯度</span>
                </label>
                
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-slate-50/50 p-2 rounded border border-slate-100">
                    <span className="font-semibold block text-slate-500 mb-1 border-b border-slate-100">南西の角 (西南SW)</span>
                    <div className="space-y-1">
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono">緯度:</span>
                        <input
                          type="text"
                          className="w-full px-1.5 py-0.5 text-xs border border-slate-200 rounded bg-white font-mono"
                          value={swLat}
                          onChange={(e) => setSwLat(e.target.value)}
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono">経度:</span>
                        <input
                          type="text"
                          className="w-full px-1.5 py-0.5 text-xs border border-slate-200 rounded bg-white font-mono"
                          value={swLng}
                          onChange={(e) => setSwLng(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-2 rounded border border-slate-100">
                    <span className="font-semibold block text-slate-500 mb-1 border-b border-slate-100">北東の角 (東北NE)</span>
                    <div className="space-y-1">
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono">緯度:</span>
                        <input
                          type="text"
                          className="w-full px-1.5 py-0.5 text-xs border border-slate-200 rounded bg-white font-mono"
                          value={neLat}
                          onChange={(e) => setNeLat(e.target.value)}
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono">経度:</span>
                        <input
                          type="text"
                          className="w-full px-1.5 py-0.5 text-xs border border-slate-200 rounded bg-white font-mono"
                          value={neLng}
                          onChange={(e) => setNeLng(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {rasterImportError && (
                <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-200 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="break-all">{rasterImportError}</span>
                </div>
              )}

              <button
                onClick={handleRasterImport}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white text-xs py-1.5 rounded shadow-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>空間配置(ジオリファレンス) して追加</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
