import React, { useState } from 'react';
import { GISLayer } from '../types/gis';
import { 
  X, Grid, Search, ZoomIn, Trash2, PlusCircle, AlertCircle, Save, Database
} from 'lucide-react';

interface AttributeTablePanelProps {
  layer: GISLayer | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateFeatureProperties: (layerId: string, featureId: string, properties: any) => void;
  onDeleteFeature: (layerId: string, featureId: string) => void;
  onZoomToFeature: (feature: any) => void;
  onAddField: (layerId: string, fieldName: string) => void;
}

export default function AttributeTablePanel({
  layer,
  isOpen,
  onClose,
  onUpdateFeatureProperties,
  onDeleteFeature,
  onZoomToFeature,
  onAddField
}: AttributeTablePanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [showAddField, setShowAddField] = useState(false);

  if (!isOpen) return null;

  if (!layer) {
    return (
      <div id="gis-attrib-tray" className="h-[280px] bg-white border-t border-gray-200 flex flex-col shrink-0">
        <div className="bg-slate-900 text-slate-100 px-4 py-2 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2 font-semibold font-sans">
            <Database className="w-4 h-4 text-slate-400" />
            <span>属性テーブル</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 text-xs gap-1.5 select-none bg-slate-50">
          <AlertCircle className="w-6 h-6 text-slate-300 animate-pulse" />
          <span>レイヤーが選択されていません。</span>
          <span className="text-[11px] text-slate-450">左側のレイヤーリストから「ベクターレイヤー」を1つクリックして選択してください。</span>
        </div>
      </div>
    );
  }

  if (layer.type !== 'vector') {
    return (
      <div id="gis-attrib-tray" className="h-[280px] bg-white border-t border-gray-200 flex flex-col shrink-0">
        <div className="bg-slate-900 text-slate-100 px-4 py-2 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2 font-semibold font-sans">
            <Database className="w-4 h-4 text-blue-400" />
            <span>属性テーブル — {layer.name}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 text-xs gap-1.5 select-none bg-slate-50">
          <AlertCircle className="w-6 h-6 text-amber-500" />
          <span className="font-semibold text-slate-600">ラスター形式レイヤーには属性テーブルがありません。</span>
          <span className="text-[11px] text-slate-450">属性情報を確認・編集するには、GeoJSONで読み込まれたベクターレイヤーを選択してください。</span>
        </div>
      </div>
    );
  }

  // Safely grab features
  const features = layer.geojsonData?.features || [];
  
  // Dynamically extract all possible keys from features properties for schema
  const propertyKeysSet = new Set<string>();
  propertyKeysSet.add('id'); // Explicitly guarantee ID Column
  features.forEach((f: any) => {
    if (f.properties) {
      Object.keys(f.properties).forEach((key) => {
        if (key !== 'id') propertyKeysSet.add(key);
      });
    }
  });
  const propertyHeaders = Array.from(propertyKeysSet);

  // Filter features based on search bar term
  const filteredFeatures = features.filter((f: any) => {
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    
    // Check geometry type or coordinates string representation
    if (f.geometry?.type?.toLowerCase()?.includes(query)) return true;

    // Check properties
    if (!f.properties) return false;
    return Object.values(f.properties).some((val: any) => {
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(query);
    });
  });

  const handleCellChange = (featureId: string, key: string, value: any, originalProps: any) => {
    // Try to parse numeric input elements
    let parsedValue = value;
    if (value !== '' && !isNaN(Number(value)) && typeof originalProps[key] === 'number') {
      parsedValue = Number(value);
    }
    
    const updatedProps = {
      ...originalProps,
      [key]: parsedValue
    };
    onUpdateFeatureProperties(layer.id, featureId, updatedProps);
  };

  const handleCreateNewField = () => {
    const nameFormatted = newFieldName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (nameFormatted) {
      onAddField(layer.id, nameFormatted);
      setNewFieldName('');
      setShowAddField(false);
    }
  };

  return (
    <div id="gis-attrib-tray" className="h-[290px] bg-white border-t-2 border-gray-200 flex flex-col shrink-0 shadow-lg select-text">
      
      {/* 1. Attributes Header panel bar */}
      <div className="bg-slate-900 text-slate-100 px-4 py-2.5 flex items-center justify-between text-xs font-semibold select-none shrink-0 border-b border-black">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          <span>属性テーブル (属性データシート) — {layer.name}</span>
          <span className="bg-blue-600/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-medium">
            全体: {features.length} 地物 | フィルタ後: {filteredFeatures.length} 地物
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline font-normal font-sans">
            ※ セル値を書き換えると自動的に地図上のポップアップ内容と連動・保存されます
          </span>
          <button 
            id="close-attrib-tray-btn"
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="属性パネルを閉じる"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* 2. Database operational toolbar inside tray */}
      <div className="bg-slate-50 border-b border-gray-200 px-4 py-1.5 flex items-center justify-between gap-4 shrink-0 select-none text-xs">
        
        {/* Quick Search */}
        <div className="flex items-center gap-2 max-w-sm w-full relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            id="attrib-search-bar"
            type="text"
            placeholder="地物の全属性から絞り込み検索 (例: 皇居, 332)"
            className="w-full bg-white border border-gray-250 rounded pl-8 pr-2.5 py-1 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400 focus:bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Column addition & Actions */}
        <div className="flex items-center gap-2">
          
          {/* Quick field additions */}
          {showAddField ? (
            <div className="flex items-center gap-1.5 animation-fade-in">
              <input
                id="new-field-input"
                type="text"
                placeholder="英小文字列名（例: category）"
                className="border border-blue-400 px-2.5 py-0.5 text-[11px] rounded focus:outline-hidden bg-white"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
              />
              <button
                id="btn-confirm-add-field"
                onClick={handleCreateNewField}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-none cursor-pointer"
              >
                追加
              </button>
              <button
                id="btn-cancel-add-field"
                onClick={() => setShowAddField(false)}
                className="text-slate-500 hover:text-slate-800 text-[10px] cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              id="attrib-add-column-btn"
              onClick={() => setShowAddField(true)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-gray-200 text-slate-705 font-medium rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              title="このベクター属性テーブルに新しいカラム（列の枠）を新規追加します"
            >
              <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>属性カラム(列)を新規追加</span>
            </button>
          )}

        </div>

      </div>

      {/* 3. The SQL Grid - Table rendering */}
      <div className="flex-1 overflow-auto bg-white min-h-0 relative">
        {filteredFeatures.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-450 text-xs gap-1.5 p-10 select-none bg-slate-50/50">
            <Grid className="w-8 h-8 text-slate-350 stroke-[1.5]" />
            <span className="font-semibold text-slate-650">フィルタに合致する地物が見つかりません。</span>
            <span>検索キーワードをクリアするか、別の語をお試しください。</span>
          </div>
        ) : (
          <table className="min-w-full text-xs text-left text-slate-705 font-sans border-collapse relative">
            
            {/* Headers */}
            <thead className="bg-gray-50 text-slate-500 uppercase text-[10px] font-mono tracking-wider border-b border-gray-200 sticky top-0 z-10 select-none">
              <tr>
                <th className="px-4 py-2 text-center w-12 font-bold bg-gray-100 border-r border-gray-200">#</th>
                <th className="px-3 py-2 text-center w-[100px] border-r border-gray-200">操作</th>
                <th className="px-3 py-2 font-bold text-slate-700 border-r border-gray-200 uppercase">ジオメトリ型</th>
                
                {propertyHeaders.map((header) => (
                  <th key={header} className="px-3 py-2 font-bold text-slate-700 border-r border-gray-200 lowercase min-w-[120px]">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Content list */}
            <tbody>
              {filteredFeatures.map((feature: any, index: number) => {
                const featureId = feature.id || feature.properties?.id || `geo-feat-${index}`;
                const properties = feature.properties || {};
                const geomType = feature.geometry?.type || 'Unknown';

                return (
                  <tr 
                    key={featureId} 
                    id={`attr-row-${featureId}`}
                    className="border-b border-gray-150 hover:bg-slate-50 transition-colors group"
                  >
                    {/* Index count cell */}
                    <td className="px-4 py-1.5 text-center bg-gray-50 border-r border-gray-200 text-slate-400 font-mono text-[10px] select-none">
                      {index + 1}
                    </td>

                    {/* Operational column: Zoom-In and Trash delete */}
                    <td className="px-3 py-1 text-center border-r border-gray-200 select-none">
                      <div className="flex items-center justify-center gap-1">
                        
                        {/* Zoom In button */}
                        <button
                          id={`zoom-feat-${featureId}`}
                          onClick={() => onZoomToFeature(feature)}
                          className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer"
                          title="マップ上でこの地物を自動探索し、ズーム移動してハイライトします"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Row button */}
                        <button
                          id={`del-feat-${featureId}`}
                          onClick={() => onDeleteFeature(layer.id, featureId)}
                          className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-650 transition cursor-pointer"
                          title="この地物データをレイヤー全体から削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>

                    {/* Geometry Type badge */}
                    <td className="px-3 py-1.5 border-r border-gray-200 font-mono text-[10px] font-bold select-none text-slate-500">
                      <span className={`px-1.5 py-0.5 rounded ${
                        geomType === 'Point' 
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/30' 
                          : geomType === 'LineString' 
                          ? 'bg-blue-50 text-blue-800 border border-blue-200/30' 
                          : 'bg-indigo-50 text-indigo-800 border border-indigo-200/30'
                      }`}>
                        {geomType}
                      </span>
                    </td>

                    {/* Property cell grids inputs */}
                    {propertyHeaders.map((header) => {
                      const value = header === 'id' ? featureId : (properties[header] !== undefined ? properties[header] : '');
                      const isIdFixed = header === 'id';

                      return (
                        <td key={header} className="px-2 py-0.5 border-r border-gray-200">
                          {isIdFixed ? (
                            <span className="px-1.5 py-1 block text-slate-400 font-mono select-all bg-gray-50 text-[10px] truncate max-w-[150px]">
                              {value}
                            </span>
                          ) : (
                            <input
                              id={`cell-${featureId}-${header}`}
                              type="text"
                              className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-white rounded font-mono text-slate-800 focus:outline-hidden transition-all text-ellipsis"
                              value={value}
                              onChange={(e) => handleCellChange(featureId, header, e.target.value, properties)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

          </table>
        )}
      </div>

    </div>
  );
}
