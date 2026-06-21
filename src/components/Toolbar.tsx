import React, { useState } from 'react';
import { MapTool, GISLayer } from '../types/gis';
import {
  Hand, Info, Ruler, Compass, PlusCircle, PenTool, CircleDot,
  FileDown, Trash2, Maximize, TableProperties, RefreshCw, FolderPlus, Edit
} from 'lucide-react';

interface ToolbarProps {
  activeTool: MapTool;
  onChangeTool: (tool: MapTool) => void;
  selectedLayer: GISLayer | null;
  onZoomToLayer: () => void;
  isTableOpen: boolean;
  onToggleTable: () => void;
  onExportGeoJSON: () => void;
  onClearDigitized: () => void;
  onAddEmptyVectorLayer: (name: string, type: 'Point' | 'LineString' | 'Polygon') => void;
}

export default function Toolbar({
  activeTool,
  onChangeTool,
  selectedLayer,
  onZoomToLayer,
  isTableOpen,
  onToggleTable,
  onExportGeoJSON,
  onClearDigitized,
  onAddEmptyVectorLayer
}: ToolbarProps) {
  const [showNewLayerPrompt, setShowNewLayerPrompt] = useState(false);
  const [newLayerName, setNewLayerName] = useState('手描き新規レイヤー');
  const [newLayerGeom, setNewLayerGeom] = useState<'Point' | 'LineString' | 'Polygon'>('Polygon');

  const toolsList: { id: MapTool; label: string; icon: React.ReactNode; color: string; description: string }[] = [
    { 
      id: 'pan', 
      label: 'ハンド/パン', 
      icon: <Hand className="w-4 h-4" />, 
      color: 'hover:bg-slate-100 text-slate-700',
      description: '地図をドラッグして移動させます (QGIS標準)'
    },
    { 
      id: 'identify', 
      label: '地物情報表示', 
      icon: <Info className="w-4 h-4" />, 
      color: 'hover:bg-sky-50 text-sky-700',
      description: 'ベクターをクリックして属性値（属性情報）をインスペクト'
    },
    { 
      id: 'measure_distance', 
      label: '距離計測', 
      icon: <Ruler className="w-4 h-4" />, 
      color: 'hover:bg-emerald-50 text-emerald-700',
      description: 'クリックして連続するパスの地表面距離を測定'
    },
    { 
      id: 'measure_area', 
      label: '面積計測', 
      icon: <Compass className="w-4 h-4" />, 
      color: 'hover:bg-emerald-50 text-emerald-700',
      description: 'クリックして結んだ多角形の面積を測定'
    },
    { 
      id: 'draw_point', 
      label: '点(Point)デジタイズ', 
      icon: <CircleDot className="w-4 h-4" />, 
      color: 'hover:bg-amber-50 text-amber-700',
      description: '地図をクリックして任意の新規ピン・ポイント地物を追加'
    },
    { 
      id: 'draw_line', 
      label: '線(Line)デジタイズ', 
      icon: <PenTool className="w-4 h-4" />, 
      color: 'hover:bg-amber-50 text-amber-700',
      description: '連続クリックで結線を描画（ダブルクリックで確定）'
    },
    { 
      id: 'draw_polygon', 
      label: '面(Polygon)デジタイズ', 
      icon: <PlusCircle className="w-4 h-4" />, 
      color: 'hover:bg-amber-50 text-slate-705',
      description: '連続クリックで塗りつぶし多角形をデジタイズ作成（ダブルクリックで確定）'
    },
    { 
      id: 'edit_geometry', 
      label: '図形編集/頂点修正', 
      icon: <Edit className="w-4 h-4 text-rose-500" />, 
      color: 'hover:bg-rose-50 text-rose-700',
      description: '選択中ベクターレイヤーの頂点移動、新規中点ドラッグによる追加、右クリックで削除'
    },
  ];

  const handleCreateEmptyLayer = () => {
    if (newLayerName.trim()) {
      onAddEmptyVectorLayer(newLayerName, newLayerGeom);
      setNewLayerName('手描き新規レイヤー');
      setShowNewLayerPrompt(false);
    }
  };

  return (
    <div id="gis-main-toolbar" className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 z-10 select-none shadow-none">
      
      {/* 1. Map Tool selectors group */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1.5 hidden sm:inline">
          マップツール
        </span>
        <div className="flex bg-slate-100 rounded-md p-1 border border-slate-200/50">
          {toolsList.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                id={`tool-btn-${tool.id}`}
                onClick={() => onChangeTool(tool.id)}
                className={`p-1.5 rounded transition-all flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
                  isActive 
                    ? 'bg-white text-blue-600 shadow-xs border border-gray-200/50 ring-1 ring-blue-500/5 font-bold' 
                    : `${tool.color.replace('text-emerald-700', 'text-slate-700').replace('text-amber-700', 'text-slate-700')} opacity-70 hover:opacity-100`
                }`}
                title={`${tool.label}: ${tool.description}`}
              >
                {tool.icon}
                <span className="hidden lg:inline">{tool.label}</span>
              </button>
            );
          })}
        </div>
 
        {/* Clear drawing overlay button */}
        {(activeTool.startsWith('measure') || activeTool.startsWith('draw')) && (
          <button
            id="clear-digi-btn"
            onClick={onClearDigitized}
            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-red-500 hover:bg-slate-50 cursor-pointer text-xs font-semibold flex items-center gap-1"
            title="現在計測中、または未確定デジタイズをクリア"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>描画クリア</span>
          </button>
        )}
      </div>
 
      {/* 2. Layer & Attribute Table Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        
        {/* Empty Layer creator button */}
        <button
          id="btn-new-layer-dlg"
          onClick={() => setShowNewLayerPrompt(!showNewLayerPrompt)}
          className="px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          title="全く新しい白ベースの空レイヤーを追加し、自分で描き込みを行う"
        >
          <FolderPlus className="w-4 h-4 text-slate-400" />
          <span className="hidden md:inline">新規ベクター層作成</span>
        </button>
 
        {/* Zoom to layer bounds extent */}
        <button
          id="btn-zoom-extent"
          onClick={onZoomToLayer}
          disabled={!selectedLayer || selectedLayer.type !== 'vector'}
          className="px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          title="選択ベクターレイヤーの全体緯度経度を自動計算し、そこにカメラをズームフィット"
        >
          <Maximize className="w-4 h-4 text-slate-400" />
          <span>レイヤー領域へズーム</span>
        </button>
 
        {/* Attribute Table toggle */}
        <button
          id="btn-toggle-attrib-table"
          onClick={onToggleTable}
          className={`px-2.5 py-1.5 border rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            isTableOpen
              ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
              : 'bg-white border-gray-200 hover:bg-slate-50 text-slate-700'
          }`}
          title="選択したレイヤーの地物属性データベースを表グリッド形式で開いて直接編集"
        >
          <TableProperties className={`w-4 h-4 ${isTableOpen ? 'text-blue-400' : 'text-slate-400'}`} />
          <span>属性テーブル</span>
          {selectedLayer && selectedLayer.type === 'vector' && (
            <span className="ml-1 px-1.5 py-0.5 bg-blue-50 text-[10px] rounded text-blue-600 font-mono">
              {selectedLayer.geojsonData?.features?.length || 0}
            </span>
          )}
        </button>
 
        {/* GeoJSON Exporter download */}
        <button
          id="btn-export-geojson"
          onClick={onExportGeoJSON}
          disabled={!selectedLayer || selectedLayer.type !== 'vector'}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-none transition-all cursor-pointer"
          title="現在選択・編集されているベクターレイヤーを、QGISなどで本格的に読み込めるGeoJSON形式に書き出してダウンロード"
        >
          <FileDown className="w-4 h-4" />
          <span>GIS保存エクスポート</span>
        </button>
 
      </div>

      {/* Dynamic inline New layer generator modal prompt */}
      {showNewLayerPrompt && (
        <div className="absolute top-[54px] right-[40px] md:right-[260px] bg-white border border-gray-200 p-4 rounded-md shadow-lg z-50 text-xs w-72 space-y-3.5 border-t-4 border-t-blue-600 shadow-slate-200">
          <div className="flex justify-between items-center bg-gray-50 -mx-4 -mt-4 px-4 py-2 rounded-t-sm border-b border-gray-200">
            <span className="font-sans font-bold text-slate-700">新規ベクターレイヤー定義</span>
            <button 
              onClick={() => setShowNewLayerPrompt(false)}
              className="text-slate-400 hover:text-slate-650 font-bold"
            >
              ✕
            </button>
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">レイヤー表示名</label>
            <input
              type="text"
              className="w-full border border-gray-250 px-2 py-1.5 rounded focus:ring-1 focus:ring-blue-500 text-xs focus:outline-hidden"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">ジオメトリ・幾何型</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Point', 'LineString', 'Polygon'] as const).map((geom) => (
                <button
                  key={geom}
                  onClick={() => setNewLayerGeom(geom)}
                  className={`py-1.5 border text-center rounded text-xs font-semibold cursor-pointer ${
                    newLayerGeom === geom
                      ? 'border-blue-550 bg-blue-50 text-blue-800 font-bold'
                      : 'border-gray-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {geom === 'Point' ? '点' : geom === 'LineString' ? '線' : '面'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleCreateEmptyLayer}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded shadow-none cursor-pointer"
          >
            レイヤーを作成して追加する
          </button>
        </div>
      )}

    </div>
  );
}
