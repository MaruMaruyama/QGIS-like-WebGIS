import React, { useState, useEffect } from 'react';
import { GISLayer, CRSType, MapTool } from './types/gis';
import { 
  samplePointsLayer, 
  sampleLinesLayer, 
  samplePolygonsLayer, 
  sampleBaseLayers, 
  initialGeoreferencedImage 
} from './data/samples';
import Toolbar from './components/Toolbar';
import LayerPanel from './components/LayerPanel';
import MapCanvas from './components/MapCanvas';
import AttributeTablePanel from './components/AttributeTablePanel';
import PropertyModal from './components/PropertyModal';
import { 
  Monitor, Info, HelpCircle, HardDrive, Cpu, 
  Compass, Laptop, FileJson, Layers, MapPin, Keyboard,
  Save, Trash2, PlusCircle, Check, Map, RefreshCw, FileDown
} from 'lucide-react';

export default function App() {
  
  // 1. Core State Managers
  const [layers, setLayers] = useState<GISLayer[]>([
    samplePointsLayer,
    sampleLinesLayer,
    samplePolygonsLayer,
    initialGeoreferencedImage,
    ...sampleBaseLayers
  ]);
  const [crsType, setCrsType] = useState<CRSType>('EPSG:4326');
  const [activeTool, setActiveTool] = useState<MapTool>('pan');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('layers-polygons-tokyo');
  const [isTableOpen, setIsTableOpen] = useState<boolean>(false);
  const [activePropertyLayer, setActivePropertyLayer] = useState<GISLayer | null>(null);

  // Buffer state to dynamic coordinates digitising 
  const [digitizedCoords, setDigitizedCoords] = useState<[number, number][]>([]);

  // Telemetry signals for zooming into attributes
  const [zoomToTrigger, setZoomToTrigger] = useState<{ lat: number; lng: number; bounds?: [[number, number], [number, number]]; timestamp: number } | null>(null);

  // Decorative Desktop Window Menu active helpers
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Auto-fading confirmation toast banner for GIS operations saved
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Native layout interactive modal overlays
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);

  // Load from local storage if present
  useEffect(() => {
    const saved = localStorage.getItem('web_gis_layers_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLayers(parsed);
        }
      } catch (err) {
        console.error('Failed to load saved GIS layers from storage:', err);
      }
    }
  }, []);

  // Dismiss toast automatically
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSaveProject = () => {
    try {
      localStorage.setItem('web_gis_layers_v2', JSON.stringify(layers));
      setToast({
        message: '💾 プロジェクトをブラウザのローカルストレージに「手動保存」しました！',
        type: 'success'
      });
    } catch (err) {
      setToast({
        message: '⚠️ 保存に失敗しました。データ容量制限を超えている可能性があります。',
        type: 'error'
      });
    }
  };

  // --- Layer operations handlers ---

  const handleToggleVisibility = (id: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === id ? { ...layer, visible: !layer.visible } : layer
    ));
  };

  const handleDeleteLayer = (id: string) => {
    if (confirm('本当にこのレイヤーをGISキャンバスから削除しますか？')) {
      setLayers(prev => prev.filter(layer => layer.id !== id));
      if (selectedLayerId === id) {
        setSelectedLayerId(null);
      }
    }
  };

  const handleMoveLayer = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;

    setLayers(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleAddLayer = (newLayer: GISLayer) => {
    setLayers(prev => [newLayer, ...prev]);
    setSelectedLayerId(newLayer.id);
  };

  // Add an empty customized vector layer
  const handleAddEmptyVectorLayer = (name: string, type: 'Point' | 'LineString' | 'Polygon') => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    const randomFillColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

    const emptyLayer: GISLayer = {
      id: `empty-layer-${Date.now()}`,
      name: name,
      type: 'vector',
      format: 'geojson',
      visible: true,
      opacity: 1,
      geojsonData: {
        type: 'FeatureCollection',
        features: []
      },
      style: {
        color: randomColor,
        fillColor: randomFillColor,
        weight: 3,
        opacity: 0.95,
        fillOpacity: 0.5,
        pointSize: 6,
        labelField: 'name_ja'
      }
    };

    setLayers(prev => [emptyLayer, ...prev]);
    setSelectedLayerId(emptyLayer.id);
    // Auto toggle tab tool to drawing mode of the corresponding geometry
    if (type === 'Point') setActiveTool('draw_point');
    else if (type === 'LineString') setActiveTool('draw_line');
    else setActiveTool('draw_polygon');

    alert(`「${name}」を作成しました。上部ツールバーの手描き(デジタイズ)ツールを使ってマップ上をクリックすると、このレイヤーに地物が追加されます。`);
  };

  const handleOpenProperties = (layer: GISLayer) => {
    setActivePropertyLayer(layer);
  };

  const handleSaveProperties = (updatedLayer: GISLayer) => {
    setLayers(prev => prev.map(layer => 
      layer.id === updatedLayer.id ? updatedLayer : layer
    ));
    if (selectedLayerId === updatedLayer.id) {
      // Refresh state link
      setSelectedLayerId(null);
      setTimeout(() => setSelectedLayerId(updatedLayer.id), 10);
    }
    setToast({
      message: '⚙️ レイヤーシンボル・表現スタイルを保存しました。',
      type: 'success'
    });
  };

  // --- GIS Feature Database updates ---

  // Triggered when dynamic digitising drawing operations writes node data back
  const handleUpdateLayerGeoJSON = (layerId: string, updatedGeoJSON: any) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, geojsonData: updatedGeoJSON } : layer
    ));
    setToast({
      message: '✨ 図形データを自動保存しました（ジオメトリが更新されました）',
      type: 'success'
    });
  };

  // Cell property value edit in attributes table
  const handleUpdateFeatureProperties = (layerId: string, featureId: string, properties: any) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id !== layerId || !layer.geojsonData) return layer;
      
      const updatedFeatures = layer.geojsonData.features.map((feat: any) => {
        const featId = feat.id || feat.properties?.id;
        if (featId === featureId) {
          return {
            ...feat,
            properties: {
              ...feat.properties,
              ...properties
            }
          };
        }
        return feat;
      });

      return {
        ...layer,
        geojsonData: {
          ...layer.geojsonData,
          features: updatedFeatures
        }
      };
    }));
    setToast({
      message: '📝 属性テーブルの値を自動保存しました！',
      type: 'success'
    });
  };

  // Row feature delete trigger from attributes table
  const handleDeleteFeature = (layerId: string, featureId: string) => {
    if (!confirm('このフィーチャ（地物データ）を物理的にレイヤーから完全に削除しますか？')) return;
    
    setLayers(prev => prev.map(layer => {
      if (layer.id !== layerId || !layer.geojsonData) return layer;
      
      const filteredFeatures = layer.geojsonData.features.filter((feat: any) => {
        const featId = feat.id || feat.properties?.id;
        return featId !== featureId;
      });

      return {
        ...layer,
        geojsonData: {
          ...layer.geojsonData,
          features: filteredFeatures
        }
      };
    }));
  };

  // Add a new dynamic column into selected layer's GeoJSON schema properties structure
  const handleAddField = (layerId: string, fieldName: string) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id !== layerId || !layer.geojsonData) return layer;

      const upgradedFeatures = layer.geojsonData.features.map((feat: any) => ({
        ...feat,
        properties: {
          ...feat.properties,
          [fieldName]: feat.properties?.[fieldName] !== undefined ? feat.properties[fieldName] : ''
        }
      }));

      return {
        ...layer,
        geojsonData: {
          ...layer.geojsonData,
          features: upgradedFeatures
        }
      };
    }));
    alert(`カラム「${fieldName}」を追加しました。セル値が空白""で全行に初期化されました。`);
  };

  // Camera focal viewport trigger when Clicking Zoom lens in attributes sheet
  const handleZoomToFeature = (feature: any) => {
    if (!feature || !feature.geometry) return;
    const geom = feature.geometry;
    
    if (geom.type === 'Point' && geom.coordinates) {
      setZoomToTrigger({
        lat: geom.coordinates[1],
        lng: geom.coordinates[0],
        timestamp: Date.now()
      });
    } else if (geom.type === 'LineString' && geom.coordinates) {
      // compute center or bounding box
      const lats = geom.coordinates.map((c: any) => c[1]);
      const lngs = geom.coordinates.map((c: any) => c[0]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setZoomToTrigger({
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
        bounds: [[minLat, minLng], [maxLat, maxLng]],
        timestamp: Date.now()
      });
    } else if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
      const lats = geom.coordinates[0].map((c: any) => c[1]);
      const lngs = geom.coordinates[0].map((c: any) => c[0]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setZoomToTrigger({
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
        bounds: [[minLat, minLng], [maxLat, maxLng]],
        timestamp: Date.now()
      });
    }
  };

  // Camera bounds zoom of selected whole layer
  const handleZoomToSelectedLayer = () => {
    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer || layer.type !== 'vector' || !layer.geojsonData?.features?.length) return;
    
    const allLats: number[] = [];
    const allLngs: number[] = [];

    layer.geojsonData.features.forEach((feat: any) => {
      const geom = feat.geometry;
      if (!geom) return;

      if (geom.type === 'Point' && geom.coordinates) {
        allLats.push(geom.coordinates[1]);
        allLngs.push(geom.coordinates[0]);
      } else if (geom.type === 'LineString' && geom.coordinates) {
        geom.coordinates.forEach((c: any) => {
          allLats.push(c[1]);
          allLngs.push(c[0]);
        });
      } else if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
        geom.coordinates[0].forEach((c: any) => {
          allLats.push(c[1]);
          allLngs.push(c[0]);
        });
      }
    });

    if (allLats.length && allLngs.length) {
      const minLat = Math.min(...allLats);
      const maxLat = Math.max(...allLats);
      const minLng = Math.min(...allLngs);
      const maxLng = Math.max(...allLngs);
      setZoomToTrigger({
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
        bounds: [[minLat, minLng], [maxLat, maxLng]],
        timestamp: Date.now()
      });
    }
  };

  // Client-side GeoJSON file serialization download trigger (QGIS interchange-friendly)
  const handleExportSelectedGeoJSON = () => {
    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer || layer.type !== 'vector' || !layer.geojsonData) {
      alert('書き出せるベクターレイヤーが選択されていません！');
      return;
    }

    const payloadString = JSON.stringify(layer.geojsonData, null, 2);
    const blob = new Blob([payloadString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Format timestamp-friendly file title: layers-name_yyyyMMdd.geojson
    const safeTitle = layer.name.replace(/[^a-zA-Z0-9ぁ-んァ-ン一-龠]/g, '_');
    link.href = url;
    link.download = `web_gis_${safeTitle}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearDigitized = () => {
    setDigitizedCoords([]);
  };

  const getSelectedLayerObject = (): GISLayer | null => {
    return layers.find(l => l.id === selectedLayerId) || null;
  };

  // Simple handler to dummy desktop dropdown menus click
  const triggerMenuNotice = (menuName: string) => {
    alert(`【デスクトップバー ${menuName}】\\nWeb QGIS Studioでは各種ベクターのインポート、色・不透明度等のプロパティ調整、属性テーブルの作成、地図上をクリックした頂点の直接作図、CRS投影変換などの実用GISコアアクションに最適化されています。上部のマップツールや、左側のレイヤーリストをお使いください！`);
    setActiveMenu(null);
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 overflow-hidden text-slate-800 font-sans select-none antialiased">
      
      {/* =======================================================
          1. CLASSIC QGIS DESKTOP TITLE BAR & WIREFRAME MENUS
          ======================================================= */}
      <header className="bg-white border-b border-gray-200 text-slate-800 h-11 px-4 flex items-center justify-between shrink-0 select-none z-30 shadow-none">
        
        {/* Left branding */}
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-50 p-1.5 rounded-md border border-blue-100 shrink-0">
            <Compass className="w-4 h-4 text-blue-600 rotate-12" />
          </div>
          <div className="flex flex-col">
            <span className="font-sans font-bold tracking-tight text-xs leading-tight text-slate-900 flex items-center gap-1.5">
              OpenGeo GIS Studio <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-1 py-0.2 rounded font-semibold">QGIS Web-Lite</span>
            </span>
            <span className="text-[8px] text-slate-400 font-mono tracking-wider -mt-0.5">EPSG:4326・3857 PROJECT SPACE</span>
          </div>
        </div>

        {/* Real Dropdown native Desktop menus */}
        <nav className="relative hidden md:flex items-center gap-1 text-[11.5px] font-medium text-slate-700 px-6 flex-1 z-50">
          
          {/* Background backdrop click-catcher to dismiss drop downs */}
          {activeMenu && (
            <div className="fixed inset-0 z-40 bg-transparent cursor-default" onClick={() => setActiveMenu(null)} />
          )}

          {/* 1. プロジェクト (P) */}
          <div className="relative z-55">
            <button
              onClick={() => setActiveMenu(activeMenu === 'proj' ? null : 'proj')}
              className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${activeMenu === 'proj' ? 'bg-slate-100 text-blue-600 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              プロジェクト(P)
            </button>
            {activeMenu === 'proj' && (
              <div org="menu" className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg py-1 text-slate-700 select-none text-[12px] z-50">
                <button
                  onClick={() => { handleSaveProject(); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <Save className="w-3.5 h-3.5 text-blue-600" />
                  <span className="flex-1 font-sans">💾 Web GIS プロジェクトを保存</span>
                  <span className="text-[10px] text-slate-400 font-mono">Ctrl+S</span>
                </button>
                <button
                  onClick={() => { handleExportSelectedGeoJSON(); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="flex-1 font-sans">🌍 レイヤーをGeoJSONとして出力...</span>
                  <span className="text-[10px] text-slate-400 font-mono">Ctrl+E</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    const name = prompt('新規に作成する空のベクターレイヤー名を入力してください:', '手描き境界レイヤー');
                    if (name) {
                      const geom = confirm('作成する図形種類を選択してください：\n[OK] = ポリゴン・面地物\n[キャンセル] = ライン・道路・河川') ? 'Polygon' : 'LineString';
                      handleAddEmptyVectorLayer(name, geom);
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="flex-1 font-sans">📄 空の新規レイヤーを定義作成...</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    if (confirm('全ての編集・変更データを初期設定にリセットします。ローカルキャッシュも消去されます。よろしいですか？')) {
                      localStorage.removeItem('web_gis_layers_v2');
                      window.location.reload();
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 hover:text-rose-700 text-rose-600 flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-rose-500" />
                  <span className="flex-1 font-sans">🧹 変更をリセットしてサンプルに戻す</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. 編集 (E) */}
          <div className="relative z-55">
            <button
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
              className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${activeMenu === 'edit' ? 'bg-slate-100 text-blue-600 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              編集(E)
            </button>
            {activeMenu === 'edit' && (
              <div org="menu" className="absolute left-0 mt-1 w-60 bg-white border border-slate-200 rounded-md shadow-lg py-1 text-slate-700 text-[12px] z-50">
                <button
                  onClick={() => { setActiveTool('pan'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span className={activeTool === 'pan' ? 'text-blue-600 font-bold' : ''}>🖐️ マップ移動・パン(Pan)</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => { setActiveTool('draw_point'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span className={activeTool === 'draw_point' ? 'text-blue-600 font-bold' : ''}>📍 新規ポイント図形作成 (点)</span>
                </button>
                <button
                  onClick={() => { setActiveTool('draw_line'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span className={activeTool === 'draw_line' ? 'text-blue-600 font-bold' : ''}>📏 新規ライン図形作成 (線)</span>
                </button>
                <button
                  onClick={() => { setActiveTool('draw_polygon'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span className={activeTool === 'draw_polygon' ? 'text-blue-600 font-bold' : ''}>🔷 新規ポリゴン図形作成 (面)</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => { setActiveTool('edit_geometry'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span className={activeTool === 'edit_geometry' ? 'text-blue-600 font-bold' : 'text-rose-600 font-medium'}>✏️ 図形編集・頂点詳細・中点追加</span>
                </button>
                <button
                  onClick={() => { handleClearDigitized(); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span>🧹 一時描画・計測線のバッファ消去</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. 表示 (V) */}
          <div className="relative z-55">
            <button
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
              className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${activeMenu === 'view' ? 'bg-slate-100 text-blue-600 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              表示(V)
            </button>
            {activeMenu === 'view' && (
              <div org="menu" className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg py-1 text-slate-700 text-[12px] z-50">
                <button
                  onClick={() => { handleZoomToSelectedLayer(); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span>🔍 選択レイヤーの全範囲へズーム表示</span>
                </button>
                <button
                  onClick={() => { setIsTableOpen(true); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span>📊 選択中の属性テーブル一覧ドックを開く</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => { setActiveTool('measure_distance'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span className={activeTool === 'measure_distance' ? 'text-blue-600 font-bold' : ''}>📐 レーザー距離の計測ツール</span>
                </button>
                <button
                  onClick={() => { setActiveTool('measure_area'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span className={activeTool === 'measure_area' ? 'text-blue-600 font-bold' : ''}>🗺️ 面積(平方メートル)計測ツール</span>
                </button>
              </div>
            )}
          </div>

          {/* 4. レイヤ (L) */}
          <div className="relative z-55">
            <button
              onClick={() => setActiveMenu(activeMenu === 'layer' ? null : 'layer')}
              className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${activeMenu === 'layer' ? 'bg-slate-100 text-blue-600 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              レイヤ(L)
            </button>
            {activeMenu === 'layer' && (
              <div org="menu" className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-lg py-1 text-slate-700 text-[12px] z-50">
                <button
                  onClick={() => {
                    const name = prompt('追加する新規レイヤー名を入力してください:', '空の追加調査レイヤー');
                    if (name) {
                      handleAddEmptyVectorLayer(name, 'Point');
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span>➕ 空の新規ベクターレイヤーを追加...</span>
                </button>
                <button
                  onClick={() => {
                    if (selectedLayerId) handleDeleteLayer(selectedLayerId);
                    else alert('削除するレイヤーが選択されていません！');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>選択中レイヤーをマップから削除</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    const activeLyr = getSelectedLayerObject();
                    if (activeLyr) {
                      handleOpenProperties(activeLyr);
                    } else {
                      alert('レイヤーが選択されていません。');
                    }
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span>⚙️ 選択レイヤーのプロパティ(シンボロジー設定)</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. 設定 (S) */}
          <div className="relative z-55">
            <button
              onClick={() => setActiveMenu(activeMenu === 'settings' ? null : 'settings')}
              className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${activeMenu === 'settings' ? 'bg-slate-100 text-blue-600 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              設定(S)
            </button>
            {activeMenu === 'settings' && (
              <div org="menu" className="absolute left-0 mt-1 w-72 bg-white border border-slate-200 rounded-md shadow-lg py-1 text-slate-700 text-[12px] z-50">
                <button
                  onClick={() => { setCrsType('EPSG:4326'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between gap-2"
                >
                  <span>🌐 投影空間CRS: WGS 84 (EPSG:4326)</span>
                  {crsType === 'EPSG:4326' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => { setCrsType('EPSG:3857'); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between gap-2"
                >
                  <span>🌐 投影空間CRS: Web Mercator (EPSG:3857)</span>
                  {crsType === 'EPSG:3857' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
                <div className="border-t border-slate-100 my-1" />
                <div className="px-3.5 py-1.5 text-[10px] text-slate-400 font-mono">
                  ※GISシステムは自動でEPSG:3857投影計算法を用いて距離・ポリゴン求積をメートルとして再計算します。
                </div>
              </div>
            )}
          </div>

          {/* 6. ヘルプ (H) */}
          <div className="relative z-55">
            <button
              onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
              className={`px-3 py-1.5 rounded cursor-pointer transition-colors ${activeMenu === 'help' ? 'bg-slate-100 text-blue-600 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
            >
              ヘルプ(H)
            </button>
            {activeMenu === 'help' && (
              <div org="menu" className="absolute left-0 mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg py-1 text-slate-700 text-[12px] z-50">
                <button
                  onClick={() => { setIsHelpOpen(true); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span>📖 操作マニュアル・使い方</span>
                </button>
                <button
                  onClick={() => { setIsAboutOpen(true); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <span>📌 OpenGeo GIS Studioについて</span>
                </button>
              </div>
            )}
          </div>

        </nav>

        {/* Right Info Badge */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-blue-600" />
            <span>GIS Workspace</span>
          </div>
          <span className="text-slate-350">|</span>
          <div className="flex items-center gap-1">
            <span>Lat/Lng:</span>
            <span className="font-bold text-slate-700">WGS84</span>
          </div>
        </div>

      </header>

      {/* =======================================================
          2. DETAILED ACTION TOOLS BAR
          ======================================================= */}
      <Toolbar
        activeTool={activeTool}
        onChangeTool={(tool) => {
          setActiveTool(tool);
          if (tool !== 'measure_distance' && tool !== 'measure_area' && !tool.startsWith('draw')) {
            // clear buffers on mode transition
            setDigitizedCoords([]);
          }
        }}
        selectedLayer={getSelectedLayerObject()}
        onZoomToLayer={handleZoomToSelectedLayer}
        isTableOpen={isTableOpen}
        onToggleTable={() => {
          setIsTableOpen(!isTableOpen);
        }}
        onExportGeoJSON={handleExportSelectedGeoJSON}
        onClearDigitized={handleClearDigitized}
        onAddEmptyVectorLayer={handleAddEmptyVectorLayer}
      />

      {/* =======================================================
          3. MAIN GIS WORKSPACE COMPARTMENT (Layer Dock + Canvas)
          ======================================================= */}
      <main className="flex-1 flex min-h-0 w-full relative">
        
        {/* Left Side: Layer Tree hierarchy panel */}
        <LayerPanel
          layers={layers}
          selectedLayerId={selectedLayerId}
          onSelectLayer={(id) => setSelectedLayerId(id)}
          onToggleVisibility={handleToggleVisibility}
          onDeleteLayer={handleDeleteLayer}
          onMoveLayer={handleMoveLayer}
          onAddLayer={handleAddLayer}
          onOpenProperties={handleOpenProperties}
        />

        {/* Central Map Workspace Canvas */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-200">
          <MapCanvas
            layers={layers}
            crsType={crsType}
            onChangeCRS={(crs) => setCrsType(crs)}
            activeTool={activeTool}
            selectedLayerId={selectedLayerId}
            onUpdateLayerGeoJSON={handleUpdateLayerGeoJSON}
            digitizedCoords={digitizedCoords}
            setDigitizedCoords={setDigitizedCoords}
            zoomToTrigger={zoomToTrigger}
          />
        </div>

      </main>

      {/* =======================================================
          4. BOTTOM RETRIEVED FEATURE ATTRIBUTES GRID DB
          ======================================================= */}
      <AttributeTablePanel
        layer={getSelectedLayerObject()}
        isOpen={isTableOpen}
        onClose={() => setIsTableOpen(false)}
        onUpdateFeatureProperties={handleUpdateFeatureProperties}
        onDeleteFeature={handleDeleteFeature}
        onZoomToFeature={handleZoomToFeature}
        onAddField={handleAddField}
      />

      {/* =======================================================
          5. MODALS & IN-PLACE LAYER PROPERTIES SYMBOL STYLER
          ======================================================= */}
      {/* =======================================================
          5. MODALS & IN-PLACE LAYER PROPERTIES SYMBOL STYLER
          ======================================================= */}
      {activePropertyLayer && (
        <PropertyModal
          layer={activePropertyLayer}
          isOpen={true}
          onClose={() => setActivePropertyLayer(null)}
          onSave={handleSaveProperties}
        />
      )}

      {/* =======================================================
          6. REAL-TIME AUTO SAVED TOAST ALERTS
          ======================================================= */}
      {toast && (
        <div className="fixed bottom-16 right-4 z-[9999] bg-slate-900/95 backdrop-blur-xs border border-emerald-500/30 text-white text-[12px] px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 animate-fade-in font-sans">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="font-semibold text-emerald-400">自動保存完了:</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* =======================================================
          7. HELP/SHORTCUTS MANUAL MODAL
          ======================================================= */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans" onClick={() => setIsHelpOpen(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-800 text-white px-4 py-3 font-bold text-xs flex justify-between items-center">
              <span className="flex items-center gap-1.5">📖 OpenGeo GIS Studio 操作マニュアル</span>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-white text-base">×</button>
            </div>
            <div className="p-5 text-slate-705 text-xs space-y-3 leading-relaxed max-h-[420px] overflow-y-auto">
              <div>
                <h4 className="font-bold text-slate-900 mb-1">📐 計測＆デジタイズ(図化点線面の作成)</h4>
                <p>上部のツールバーでお好みの作成モード（点・線・ポリゴン）を選択してマップ上を連打してクリック。ダブルクリックで作成が確定されます。作成されたデータは属性テーブルで確認可能です。</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">✏️ 図形編集・頂点微調整ツール</h4>
                <p>作成済みのベクター図形の形状を修正します。ツールバーやメニューから「図形編集/頂点修正」を選択して、対象のレイヤーを緑枠（選択中）にしてください。地物の各頂点に<b>赤いハンドル（頂点）</b>と<b>薄ピンクのハンドル（辺の中点）</b>が表示されます：</p>
                <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                  <li><b>赤ハンドルをドラッグ：</b> 頂点そのものを別の位置へ移動させます。</li>
                  <li><b>薄ピンクハンドルをドラッグ：</b> 新しい頂点をそこに追加して、辺を分割します。</li>
                  <li><b>赤ハンドルを右クリック：</b> その頂点のみを即座に削除します。</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">💾 データの保存方法</h4>
                <p>当システムは<b>「完全自動保存システム」</b>を搭載しています。頂点の移動、テーブルの値入力、表現色マテリアルの修正など、全てのステップで即時に状態が自動保存（メモリ＆ローカルストレージ）されます。また、[プロジェクト] メニューの<b>「Web GISプロジェクトを保存」</b>や、ツールバーの保存マークを押すことで、意図的にブラウザ保管スペースに書き込み・永続化が可能です！</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="font-semibold block mb-1">⌨️ ショートカットキー一覧</span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono">
                  <li>Ctrl + S : ブラウザへ保存</li>
                  <li>Ctrl + E : GeoJSON書き出しダウンロード</li>
                  <li>ESC : すべてのドラフトバッファ消去</li>
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-205 flex justify-end">
              <button
                onClick={() => setIsHelpOpen(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-4 py-1.5 rounded font-medium cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          8. ABOUT DIALOG MODAL
          ======================================================= */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans" onClick={() => setIsAboutOpen(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-800 p-6 flex flex-col items-center justify-center border-b border-slate-100 text-white">
              <div className="bg-blue-500/10 p-3 rounded-full border border-blue-400/20 mb-2">
                <Compass className="w-8 h-8 text-blue-400 rotate-12" />
              </div>
              <h3 className="font-extrabold text-[15px] tracking-tight">OpenGeo GIS Studio</h3>
              <p className="text-[10px] text-blue-300 font-mono tracking-wider mt-0.5">Version 1.2.0 (Web-Lite)</p>
            </div>
            <div className="p-5 text-slate-600 text-xs space-y-2 leading-relaxed">
              <p>
                OpenGeo GIS Studioは、ブラウザだけで動く先進的な高機能Web GIS（地理情報システム）です。軽量スマートなQGIS Desktopの使い心地を目指して設計されました。
              </p>
              <div className="text-[10px] text-slate-500 font-mono text-left bg-slate-50 p-2 rounded">
                <div>・Leaflet Map Engine Core</div>
                <div>・WGS84 ⇄ WebMercator Projected Engine</div>
                <div>・Auto-durable LocalStorage Cache</div>
                <div>・Direct Node GeoJSON manipulation</div>
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-150 flex justify-center">
              <button
                onClick={() => setIsAboutOpen(false)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs py-2 rounded-md font-semibold cursor-pointer"
              >
                了解
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
