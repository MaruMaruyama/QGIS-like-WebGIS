import React, { useState, useEffect } from 'react';
import { GISLayer, VectorStyle } from '../types/gis';
import { X, Palette, Type, ShieldAlert } from 'lucide-react';

interface PropertyModalProps {
  layer: GISLayer;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedLayer: GISLayer) => void;
}

export default function PropertyModal({ layer, isOpen, onClose, onSave }: PropertyModalProps) {
  const [name, setName] = useState(layer.name);
  const [opacity, setOpacity] = useState(layer.opacity);
  
  // Vector-specific styles
  const [strokeColor, setStrokeColor] = useState(layer.style?.color || '#3b82f6');
  const [fillColor, setFillColor] = useState(layer.style?.fillColor || '#93c5fd');
  const [weight, setWeight] = useState(layer.style?.weight || 3);
  const [strokeOpacity, setStrokeOpacity] = useState(layer.style?.opacity || 0.9);
  const [fillOpacity, setFillOpacity] = useState(layer.style?.fillOpacity || 0.55);
  const [pointSize, setPointSize] = useState(layer.style?.pointSize || 6);
  const [labelField, setLabelField] = useState(layer.style?.labelField || '');

  // Available attributes from layer's geojsons features for label mapping
  const [availableFields, setAvailableFields] = useState<string[]>([]);

  useEffect(() => {
    setName(layer.name);
    setOpacity(layer.opacity);
    if (layer.style) {
      setStrokeColor(layer.style.color);
      setFillColor(layer.style.fillColor);
      setWeight(layer.style.weight);
      setStrokeOpacity(layer.style.opacity);
      setFillOpacity(layer.style.fillOpacity);
      setPointSize(layer.style.pointSize);
      setLabelField(layer.style.labelField || '');
    }

    if (layer.type === 'vector' && layer.geojsonData?.features?.[0]?.properties) {
      const fields = Object.keys(layer.geojsonData.features[0].properties);
      setAvailableFields(fields);
    } else {
      setAvailableFields([]);
    }
  }, [layer]);

  if (!isOpen) return null;

  const handleApply = () => {
    const updated: GISLayer = {
      ...layer,
      name,
      opacity,
    };

    if (layer.type === 'vector') {
      updated.style = {
        color: strokeColor,
        fillColor,
        weight,
        opacity: strokeOpacity,
        fillOpacity: fillOpacity,
        pointSize,
        labelField: labelField || undefined,
      };
    }

    onSave(updated);
    onClose();
  };

  return (
    <div id="gis-prop-overlay" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div id="gis-prop-window" className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-slate-100 px-5 py-3.5 flex items-center justify-between border-b border-black">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-400" />
            <span className="font-display font-semibold tracking-tight text-base">
              レイヤープロパティ — {layer.name}
            </span>
          </div>
          <button 
            id="close-prop-btn"
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Panel */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          
          {/* General Metadata */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">一般プロパティ</label>
            <div>
              <label className="block text-slate-700 font-medium mb-1">レイヤー表示名</label>
              <input
                id="prop-layer-name"
                type="text"
                className="w-full px-3 py-1.5 border border-gray-250 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800 font-medium bg-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-1.5">
              <div>
                <span className="text-xs text-slate-400 block font-mono">ID: {layer.id}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block text-right font-semibold">
                  タイプ: {layer.type === 'vector' ? 'ベクター (GeoJSON)' : `ラスター (${layer.format})`}
                </span>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Style Configuration Section (Vector Map Customizations) */}
          {layer.type === 'vector' ? (
            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">シンボロジー（ベクター描画設定）</label>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Stroke Color */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border border-slate-300 block" style={{ backgroundColor: strokeColor }}></span>
                    主線・枠線の色 (Color)
                  </label>
                  <input
                    id="prop-stroke-color"
                    type="color"
                    className="w-full h-8 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                  />
                </div>

                {/* Fill Color */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border border-slate-300 block" style={{ backgroundColor: fillColor }}></span>
                    塗りつぶし色 (Fill)
                  </label>
                  <input
                    id="prop-fill-color"
                    type="color"
                    className="w-full h-8 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                  />
                </div>
              </div>

              {/* Stroke Weight */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-700 font-medium">枠線の太さ (Weight)</label>
                  <span className="text-xs font-mono font-bold text-slate-500">{weight} px</span>
                </div>
                <input
                  id="prop-line-weight"
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value))}
                />
              </div>

              {/* Stroke Opacity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-700 font-medium">線の不透明度</label>
                    <span className="text-xs font-mono text-slate-500">{Math.round(strokeOpacity * 100)}%</span>
                  </div>
                  <input
                    id="prop-line-opacity"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    value={strokeOpacity}
                    onChange={(e) => setStrokeOpacity(parseFloat(e.target.value))}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-700 font-medium">面の不透明度</label>
                    <span className="text-xs font-mono text-slate-500">{Math.round(fillOpacity * 100)}%</span>
                  </div>
                  <input
                    id="prop-fill-opacity"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    value={fillOpacity}
                    onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {/* Point Mark Size */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-700 font-medium">代表点マーカーサイズ (Point Size)</label>
                  <span className="text-xs font-mono font-bold text-slate-500">{pointSize} px</span>
                </div>
                <input
                  id="prop-point-size"
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  value={pointSize}
                  onChange={(e) => setPointSize(parseInt(e.target.value))}
                />
              </div>

              {/* Field Label Select (Interactive GIS Hover label configuration) */}
              <div>
                <label className="text-slate-700 font-medium mb-1 block flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-blue-500" />
                  ラベル属性フィールドの選択 (Hover Label)
                </label>
                {availableFields.length > 0 ? (
                  <select
                    id="prop-label-selector"
                    className="w-full px-3 py-1.5 border border-gray-250 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800 bg-white"
                    value={labelField}
                    onChange={(e) => setLabelField(e.target.value)}
                  >
                    <option value="">-- ホバーラベルなし --</option>
                    {availableFields.map(f => (
                      <option key={f} value={f}>
                        {f} (属性)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-amber-50 text-amber-800 text-xs px-3 py-2.5 rounded border border-amber-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>レイヤー内に地物属性データが存在しない、または読み込まれていません。</span>
                  </div>
                )}
              </div>

            </div>
          ) : (
            // Raster layer Opacity settings
            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">ラスター描画設定</label>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-700 font-medium">レイヤー全体不透明度 (General Opacity)</label>
                  <span className="text-xs font-mono font-bold text-slate-500">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  id="prop-raster-opacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                />
              </div>
              <div className="bg-slate-50 rounded p-3 text-slate-500 text-xs space-y-1">
                <span className="font-semibold block text-slate-600">ラスターソース情報:</span>
                {layer.url && (
                  <p className="break-all font-mono text-[10px] bg-white p-1 rounded border border-gray-200">
                    URL: {layer.url.substring(0, 120)}{layer.url.length > 120 ? '...' : ''}
                  </p>
                )}
                {layer.bounds && (
                  <p className="font-mono text-[10px]">
                    バインディングボックス座標:<br />
                    SW: {layer.bounds[0].join(', ')}<br />
                    NE: {layer.bounds[1].join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons footer */}
        <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            id="prop-cancel-btn"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-sm transition-colors text-xs cursor-pointer"
          >
            キャンセル
          </button>
          <button
            id="prop-apply-btn"
            onClick={handleApply}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-sm transition-colors text-xs cursor-pointer"
          >
            適用して閉じる
          </button>
        </div>

      </div>
    </div>
  );
}
