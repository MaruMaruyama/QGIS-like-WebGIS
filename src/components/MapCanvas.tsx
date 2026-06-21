import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GISLayer, CRSType, MapTool } from '../types/gis';
import { CRS_LIST, transformCoord, toDMS } from '../data/samples';
import { Compass, ZoomIn, ZoomOut, Target, CheckCircle2 } from 'lucide-react';

interface MapCanvasProps {
  layers: GISLayer[];
  crsType: CRSType;
  onChangeCRS: (crs: CRSType) => void;
  activeTool: MapTool;
  selectedLayerId: string | null;
  onUpdateLayerGeoJSON: (layerId: string, updatedGeoJSON: any) => void;
  digitizedCoords: [number, number][]; // Buffered drawing vertices [lat, lng]
  setDigitizedCoords: React.Dispatch<React.SetStateAction<[number, number][]>>;
  zoomToTrigger: { lat: number; lng: number; bounds?: [[number, number], [number, number]]; timestamp: number } | null;
}

export default function MapCanvas({
  layers,
  crsType,
  onChangeCRS,
  activeTool,
  selectedLayerId,
  onUpdateLayerGeoJSON,
  digitizedCoords,
  setDigitizedCoords,
  zoomToTrigger
}: MapCanvasProps) {
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Track visual active layer instances inside Leaflet for clean additions & deletions
  const leafletLayersRef = useRef<{ [key: string]: L.Layer }>({});
  const drawGuideLayersRef = useRef<L.Layer[]>([]);
  const editHandlesLayersRef = useRef<L.Layer[]>([]);
  
  // Coordinate & Zoom level reactive states for Bottom QGIS Status Bar
  const [mouseCoords, setMouseCoords] = useState<[number, number]>([139.75, 35.68]);
  const [zoomLevel, setZoomLevel] = useState<number>(13);
  const [measurementResult, setMeasurementResult] = useState<string>('');

  // 1. Initial Leaflet Canvas mounting
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center map around beautiful Central Tokyo (Imperial Palace area)
    const map = L.map(mapContainerRef.current, {
      center: [35.6895, 139.7450],
      zoom: 13,
      zoomControl: false, // Custom placed for desktop feel
      attributionControl: true
    });

    // Save map instance
    mapInstanceRef.current = map;

    // Force default scale indicator at bottom-left (metric format scale multiplier)
    L.control.scale({
      position: 'bottomleft',
      imperial: false,
      metric: true
    }).addTo(map);

    // Coordinate mouse tracking listener
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setMouseCoords([e.latlng.lng, e.latlng.lat]);
    });

    // Zoom level tracker
    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    // Initial click listener for Measuring/Digitising tools
    map.on('click', handleMapClick);

    // Initial double click listener to terminate Line/Area/Polygon digitizers
    map.on('dblclick', handleMapDoubleClick);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. React viewport focus/zoom actions trigger (triggered when user clicks lens in attribute table)
  useEffect(() => {
    if (!mapInstanceRef.current || !zoomToTrigger) return;
    
    const map = mapInstanceRef.current;
    if (zoomToTrigger.bounds) {
      map.fitBounds(zoomToTrigger.bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      map.setView([zoomToTrigger.lat, zoomToTrigger.lng], 16);
    }
  }, [zoomToTrigger]);

  // 3. React Reactive syncing: Re-render GIS layers (tiles, rasters overlays, GeoJSons vectors) on state alter
  // Optimization: Do NOT recreate or delete unchanged base tile layers during vector/vertex edits to prevent blinking/disappearing tiles.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layerIdsInState = new Set(layers.map(key => key.id));

    // Remove Leaflet layers that are no longer part of active layers array state
    Object.keys(leafletLayersRef.current).forEach((id) => {
      if (!layerIdsInState.has(id)) {
        map.removeLayer(leafletLayersRef.current[id]);
        delete leafletLayersRef.current[id];
      }
    });

    // Sync state configuration back-to-front
    [...layers].reverse().forEach((layer) => {
      const existingLeafletLayer = leafletLayersRef.current[layer.id];

      // If hidden, remove from view but cache in ref
      if (!layer.visible) {
        if (existingLeafletLayer) {
          map.removeLayer(existingLeafletLayer);
        }
        return;
      }

      // Context 1: RASTER Maps (Google, Mapbox, OSM, XYZ, ImageOverlays)
      if (layer.type === 'raster') {
        if (existingLeafletLayer) {
          // If already instantiated, just ensure it is active on map and sync the opacity!
          if (!map.hasLayer(existingLeafletLayer)) {
            existingLeafletLayer.addTo(map);
          }
          if (typeof (existingLeafletLayer as any).setOpacity === 'function') {
            (existingLeafletLayer as any).setOpacity(layer.opacity);
          }
          return; // Skip re-request and recreation to defeat the flicker!
        }

        // Fresh creation
        let leafletLayer: L.Layer | null = null;
        if (layer.format === 'xyz_tile' && layer.url) {
          leafletLayer = L.tileLayer(layer.url, {
            attribution: layer.attribution || '',
            opacity: layer.opacity,
            zIndex: 10
          });
        } else if (layer.format === 'georeferenced_image' && layer.url && layer.bounds) {
          leafletLayer = L.imageOverlay(layer.url, layer.bounds, {
            opacity: layer.opacity,
            interactive: true,
            attribution: layer.attribution || ''
          });
        }

        if (leafletLayer) {
          leafletLayer.addTo(map);
          leafletLayersRef.current[layer.id] = leafletLayer;
        }
      }

      // Context 2: VECTOR Maps (GeoJSON files and drawn features)
      else if (layer.type === 'vector') {
        // Redraw vector geometry by stripping the old frame and generating direct coordinates
        if (existingLeafletLayer) {
          map.removeLayer(existingLeafletLayer);
        }

        if (layer.format === 'geojson' && layer.geojsonData) {
          const styleConfig = layer.style || {
            color: '#3b82f6',
            fillColor: '#93c5fd',
            weight: 2,
            opacity: 0.85,
            fillOpacity: 0.45,
            pointSize: 6
          };

          const isLayerSelected = selectedLayerId === layer.id;

          const leafletLayer = L.geoJSON(layer.geojsonData, {
            pointToLayer: (feature, latlng) => {
              return L.circleMarker(latlng, {
                radius: styleConfig.pointSize,
                color: isLayerSelected ? '#ef4444' : styleConfig.color,
                fillColor: styleConfig.fillColor,
                weight: styleConfig.weight,
                opacity: styleConfig.opacity,
                fillOpacity: styleConfig.fillOpacity
              });
            },
            style: (feature) => {
              return {
                color: isLayerSelected ? '#ef4444' : styleConfig.color,
                fillColor: styleConfig.fillColor,
                weight: isLayerSelected ? styleConfig.weight + 1.5 : styleConfig.weight,
                opacity: styleConfig.opacity,
                fillOpacity: styleConfig.fillOpacity,
                dashArray: isLayerSelected ? '4,4' : undefined
              };
            },
            onEachFeature: (feature, leafletFeat) => {
              const props = feature.properties || {};
              let tableRows = '';
              Object.keys(props).forEach((key) => {
                if (key === 'id') return;
                tableRows += `
                  <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td class="py-1 px-2 font-semibold text-[10px] text-slate-500 font-mono">${key}</td>
                    <td class="py-1 px-2 text-[10px] text-slate-800 break-all font-mono">${props[key]}</td>
                  </tr>
                `;
              });

              const contentHtml = `
                <div class="p-1 min-w-[200px] font-sans">
                  <div class="bg-slate-800 text-white text-[11px] font-bold px-2 py-1 rounded-t flex items-center justify-between gap-1">
                    <span>GIS地物属性情報 (${feature.geometry?.type || 'Vector'})</span>
                  </div>
                  <table class="w-full border-collapse">
                    <tbody>
                      ${tableRows || '<tr><td colspan="2" class="p-2 text-center text-[10px] text-slate-400">属性なし</td></tr>'}
                    </tbody>
                  </table>
                </div>
              `;

              leafletFeat.bindPopup(contentHtml, {
                maxWidth: 320,
                className: 'qgis-popup-container shadow-xl'
              });

              if (styleConfig.labelField && props[styleConfig.labelField] !== undefined) {
                leafletFeat.bindTooltip(String(props[styleConfig.labelField]), {
                  permanent: false,
                  direction: 'top',
                  className: 'gis-feature-label font-bold'
                });
              }
            }
          });

          leafletLayer.addTo(map);
          leafletLayersRef.current[layer.id] = leafletLayer;
        }
      }
    });

  }, [layers, selectedLayerId]);

  // 4. Temporary Guide layer drawer for Measure paths & Digitizing lines active visualization
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous drawing helper guidelines
    drawGuideLayersRef.current.forEach(layer => map.removeLayer(layer));
    drawGuideLayersRef.current = [];

    if (digitizedCoords.length === 0) {
      setMeasurementResult('');
      return;
    }

    // A. Draw individual plotted vertices as tiny black markers
    digitizedCoords.forEach((pt, i) => {
      const circle = L.circleMarker(pt, {
        radius: 4,
        color: '#1f2937',
        fillColor: '#ffffff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 1
      }).addTo(map);
      drawGuideLayersRef.current.push(circle);
    });

    // B. Draw connected Segment paths
    if (digitizedCoords.length > 1) {
      if (activeTool === 'measure_area' || activeTool === 'draw_polygon') {
        const poly = L.polygon(digitizedCoords, {
          color: '#d97706',
          fillColor: '#fbbf24',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.35,
          dashArray: '3, 3'
        }).addTo(map);
        drawGuideLayersRef.current.push(poly);
        
        // Math coordinates for area
        const areaM2 = Math.abs(calculatePolygonArea(digitizedCoords));
        if (areaM2 >= 1000000) {
          setMeasurementResult(`面積(投影): ${(areaM2 / 1000000).toFixed(4)} km²`);
        } else {
          setMeasurementResult(`面積(投影): ${areaM2.toFixed(1)} m²`);
        }
      } else {
        const line = L.polyline(digitizedCoords, {
          color: '#059669',
          weight: 3,
          opacity: 0.9,
          dashArray: '5, 5'
        }).addTo(map);
        drawGuideLayersRef.current.push(line);

        // Math coordinates distance calculation
        let totalD = 0;
        for (let idx = 0; idx < digitizedCoords.length - 1; idx++) {
          const latlng1 = L.latLng(digitizedCoords[idx]);
          const latlng2 = L.latLng(digitizedCoords[idx + 1]);
          totalD += latlng1.distanceTo(latlng2);
        }
        if (totalD >= 1000) {
          setMeasurementResult(`総距離: ${(totalD / 1000).toFixed(3)} km`);
        } else {
          setMeasurementResult(`総距離: ${totalD.toFixed(1)} m`);
        }
      }
    } else {
      setMeasurementResult('基準点1 プロット完了 (ダブルクリックで終了)');
    }

  }, [digitizedCoords, activeTool]);

  // 5. Interactive vertex editing handles rendering for already created features
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous edit handles
    editHandlesLayersRef.current.forEach((layer) => map.removeLayer(layer));
    editHandlesLayersRef.current = [];

    if (activeTool !== 'edit_geometry' || !selectedLayerId) return;

    const activeLayer = layers.find((l) => l.id === selectedLayerId);
    if (!activeLayer || activeLayer.type !== 'vector' || !activeLayer.geojsonData) return;

    const features = activeLayer.geojsonData.features || [];

    const createVertexHandle = (
      coord: [number, number], // [lng, lat]
      onDrag: (lng: number, lat: number) => void,
      onDelete: () => void
    ) => {
      const marker = L.marker([coord[1], coord[0]], {
        draggable: true,
        icon: L.divIcon({
          className: 'custom-vertex-handle-marker',
          html: '<div class="w-3.5 h-3.5 bg-rose-600 border-2 border-white rounded-full shadow-md cursor-grab active:cursor-grabbing hover:bg-rose-700 transition-colors"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      });

      marker.bindTooltip('ドラッグで頂点移動、右クリックで頂点削除', {
        direction: 'top',
        className: 'text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-white font-sans border-0 font-medium'
      });

      marker.on('dragend', () => {
        const latlng = marker.getLatLng();
        onDrag(latlng.lng, latlng.lat);
      });

      marker.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e as any);
        L.DomEvent.preventDefault(e as any);
        onDelete();
      });

      marker.addTo(map);
      editHandlesLayersRef.current.push(marker);
    };

    const createMidpointHandle = (
      coord: [number, number], // [lng, lat]
      onDrag: (lng: number, lat: number) => void
    ) => {
      const marker = L.marker([coord[1], coord[0]], {
        draggable: true,
        icon: L.divIcon({
          className: 'custom-midpoint-handle-marker',
          html: '<div class="w-2.5 h-2.5 bg-rose-400 border border-white rounded-full shadow-xs cursor-crosshair opacity-80 hover:opacity-100 hover:bg-rose-500 hover:scale-125 transition-transform"></div>',
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        })
      });

      marker.bindTooltip('ドラッグすると新しい頂点を作成して挿入します', {
        direction: 'top',
        className: 'text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-white font-sans border-0 font-medium'
      });

      marker.on('dragend', () => {
        const latlng = marker.getLatLng();
        onDrag(latlng.lng, latlng.lat);
      });

      marker.addTo(map);
      editHandlesLayersRef.current.push(marker);
    };

    features.forEach((feature: any, featureIndex: number) => {
      const geom = feature.geometry;
      if (!geom) return;

      if (geom.type === 'Point') {
        const coords = geom.coordinates; // [lng, lat]
        createVertexHandle(coords, (newLng, newLat) => {
          const updatedFeatures = [...features];
          updatedFeatures[featureIndex] = {
            ...feature,
            geometry: {
              ...geom,
              coordinates: [newLng, newLat]
            }
          };
          onUpdateLayerGeoJSON(activeLayer.id, {
            ...activeLayer.geojsonData,
            features: updatedFeatures
          });
        }, () => {
          alert('地物の削除は属性テーブルの「行を削除」ボタンから実施してください。');
        });
      } 
      
      else if (geom.type === 'LineString') {
        const coords = geom.coordinates; // Array of [lng, lat]
        
        // 1. Existing vertices
        coords.forEach((coord: [number, number], vertexIndex: number) => {
          createVertexHandle(coord, (newLng, newLat) => {
            const updatedCoords = [...coords];
            updatedCoords[vertexIndex] = [newLng, newLat];
            
            const updatedFeatures = [...features];
            updatedFeatures[featureIndex] = {
              ...feature,
              geometry: {
                ...geom,
                coordinates: updatedCoords
              }
            };
            onUpdateLayerGeoJSON(activeLayer.id, {
              ...activeLayer.geojsonData,
              features: updatedFeatures
            });
          }, () => {
            if (coords.length <= 2) {
              alert('線（LineString）の頂点は2つ未満に削減できません。');
              return;
            }
            const updatedCoords = coords.filter((_: any, idx: number) => idx !== vertexIndex);
            const updatedFeatures = [...features];
            updatedFeatures[featureIndex] = {
              ...feature,
              geometry: {
                ...geom,
                coordinates: updatedCoords
              }
            };
            onUpdateLayerGeoJSON(activeLayer.id, {
              ...activeLayer.geojsonData,
              features: updatedFeatures
            });
          });
        });

        // 2. Midpoints for adding new nodes
        for (let i = 0; i < coords.length - 1; i++) {
          const c1 = coords[i];
          const c2 = coords[i + 1];
          const midLng = (c1[0] + c2[0]) / 2;
          const midLat = (c1[1] + c2[1]) / 2;
          createMidpointHandle([midLng, midLat], (newLng, newLat) => {
            const updatedCoords = [...coords];
            updatedCoords.splice(i + 1, 0, [newLng, newLat]);
            
            const updatedFeatures = [...features];
            updatedFeatures[featureIndex] = {
              ...feature,
              geometry: {
                ...geom,
                coordinates: updatedCoords
              }
            };
            onUpdateLayerGeoJSON(activeLayer.id, {
              ...activeLayer.geojsonData,
              features: updatedFeatures
            });
          });
        }
      } 
      
      else if (geom.type === 'Polygon') {
        const rings = geom.coordinates; // Array of rings, each is Array of [lng, lat]
        rings.forEach((ring: [number, number][], ringIndex: number) => {
          const n = ring.length;
          // Rings usually close (first is identical to the last). Edit vertices from 0 to n-2
          for (let vertexIndex = 0; vertexIndex < n - 1; vertexIndex++) {
            const coord = ring[vertexIndex];
            createVertexHandle(coord, (newLng, newLat) => {
              const updatedRings = [...rings];
              const updatedRing = [...ring];
              
              updatedRing[vertexIndex] = [newLng, newLat];
              if (vertexIndex === 0) {
                // Keep closing index identical to start
                updatedRing[n - 1] = [newLng, newLat];
              }
              
              updatedRings[ringIndex] = updatedRing;
              
              const updatedFeatures = [...features];
              updatedFeatures[featureIndex] = {
                ...feature,
                geometry: {
                  ...geom,
                  coordinates: updatedRings
                }
              };
              onUpdateLayerGeoJSON(activeLayer.id, {
                ...activeLayer.geojsonData,
                features: updatedFeatures
              });
            }, () => {
              if (ring.length <= 4) { // Needs at least 3 vertices + 1 closing vertex
                alert('ポリゴン（Polygon）の頂点は3つ以上に保つ必要があります。');
                return;
              }
              
              const updatedRing = ring.filter((_: any, idx: number) => idx !== vertexIndex);
              // Maintain closure if start node was deleted
              if (vertexIndex === 0) {
                updatedRing[updatedRing.length - 1] = updatedRing[0];
              }
              
              const updatedRings = [...rings];
              updatedRings[ringIndex] = updatedRing;
              
              const updatedFeatures = [...features];
              updatedFeatures[featureIndex] = {
                ...feature,
                geometry: {
                  ...geom,
                  coordinates: updatedRings
                }
              };
              onUpdateLayerGeoJSON(activeLayer.id, {
                ...activeLayer.geojsonData,
                features: updatedFeatures
              });
            });
          }

          // Midpoints for adding new nodes
          for (let i = 0; i < ring.length - 1; i++) {
            const c1 = ring[i];
            const c2 = ring[i + 1];
            const midLng = (c1[0] + c2[0]) / 2;
            const midLat = (c1[1] + c2[1]) / 2;
            createMidpointHandle([midLng, midLat], (newLng, newLat) => {
              const updatedRings = [...rings];
              const updatedRing = [...ring];
              updatedRing.splice(i + 1, 0, [newLng, newLat]);
              updatedRings[ringIndex] = updatedRing;
              
              const updatedFeatures = [...features];
              updatedFeatures[featureIndex] = {
                ...feature,
                geometry: {
                  ...geom,
                  coordinates: updatedRings
                }
              };
              onUpdateLayerGeoJSON(activeLayer.id, {
                ...activeLayer.geojsonData,
                features: updatedFeatures
              });
            });
          }
        });
      }
    });

    return () => {
      editHandlesLayersRef.current.forEach((layer) => map.removeLayer(layer));
      editHandlesLayersRef.current = [];
    };
  }, [layers, selectedLayerId, activeTool]);

  // Handle click on canvas depending on active tools mapping
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    const latlng = e.latlng;
    const tool = activeTool;
    
    if (tool === 'pan') {
      // Free clicking to popup features. Handled natively by layer click bindings.
      return;
    }

    if (tool.startsWith('measure') || tool === 'draw_line' || tool === 'draw_polygon') {
      // Append coordinates coordinate index
      setDigitizedCoords(prev => [...prev, [latlng.lat, latlng.lng]]);
      return;
    }

    if (tool === 'draw_point') {
      if (!selectedLayerId) {
        alert('宛先ベクターレイヤーが選択されていません！左側の「レイヤー」からベクターデータを選択（緑枠線）してください。');
        return;
      }
      
      const targetLayer = layers.find(l => l.id === selectedLayerId);
      if (!targetLayer || targetLayer.type !== 'vector') {
        alert('地物はベクターレイヤーにのみ追加できます。左レイヤーリストからベクター選択してください。');
        return;
      }

      // Fast Point digitizing implementation
      const newFeatureId = `digit-pt-${Date.now()}`;
      const newFeature = {
        type: 'Feature',
        id: newFeatureId,
        properties: {
          id: newFeatureId,
          name_ja: 'デジタル点地物',
          category: '手描きポイント',
          lat_y: latlng.lat.toFixed(6),
          lng_x: latlng.lng.toFixed(6)
        },
        geometry: {
          type: 'Point',
          coordinates: [latlng.lng, latlng.lat]
        }
      };

      const updatedGeoJSON = {
        ...targetLayer.geojsonData,
        features: [...(targetLayer.geojsonData?.features || []), newFeature]
      };

      onUpdateLayerGeoJSON(targetLayer.id, updatedGeoJSON);
    }
  };

  // Terminating multi-step digitizing line/polygon geometries via double clicks
  const handleMapDoubleClick = (e: L.LeafletMouseEvent) => {
    const latlng = e.latlng;
    const tool = activeTool;

    if (digitizedCoords.length < 2) return;

    if (tool === 'draw_line' || tool === 'draw_polygon') {
      if (!selectedLayerId) {
        alert('宛先ベクターレイヤーが選択されていません。');
        setDigitizedCoords([]);
        return;
      }

      const targetLayer = layers.find(l => l.id === selectedLayerId);
      if (!targetLayer || targetLayer.type !== 'vector') {
        alert('ベクターレイヤーが選択されていません。');
        setDigitizedCoords([]);
        return;
      }

      // Lock current buffered coordinates list
      const finalCoords = [...digitizedCoords];
      // Append double click lat/lng if not already there
      const lastCoord = finalCoords[finalCoords.length - 1];
      if (Math.abs(lastCoord[0] - latlng.lat) > 0.0001 || Math.abs(lastCoord[1] - latlng.lng) > 0.0001) {
        finalCoords.push([latlng.lat, latlng.lng]);
      }

      const geomType = tool === 'draw_line' ? 'LineString' : 'Polygon';
      const newFeatId = `digit-geom-${Date.now()}`;

      // Format coordinates standard GeoJSON: [lng, lat]
      let geojsonCoords: any = [];
      if (geomType === 'LineString') {
        geojsonCoords = finalCoords.map(c => [c[1], c[0]]);
      } else {
        // Close polygon ring implicitly by appending first node at tail
        const ring = finalCoords.map(c => [c[1], c[0]]);
        ring.push([finalCoords[0][1], finalCoords[0][0]]);
        geojsonCoords = [ring];
      }

      const newFeature = {
        type: 'Feature',
        id: newFeatId,
        properties: {
          id: newFeatId,
          name_ja: `デジタル化 ${geomType === 'LineString' ? '線' : '面'}-${targetLayer.geojsonData?.features?.length + 1}`,
          category: '手描き図化地物',
          source: 'Web_QGIS'
        },
        geometry: {
          type: geomType,
          coordinates: geojsonCoords
        }
      };

      const updatedGeoJSON = {
        ...targetLayer.geojsonData,
        features: [...(targetLayer.geojsonData?.features || []), newFeature]
      };

      onUpdateLayerGeoJSON(targetLayer.id, updatedGeoJSON);
      setDigitizedCoords([]);
    } else if (tool.startsWith('measure')) {
      // Simply visual freeze completed measurements
      setDigitizedCoords([]);
    }
  };

  // Pure mathematical shoelace algorithm based on projected meters coordinates for actual field bounds area sizes!
  const calculatePolygonArea = (coords: [number, number][]): number => {
    if (coords.length < 3) return 0;
    
    // Convert geographic lat-lngs down to EPSG:3857 Web Mercator meters coordinate system
    const projectedMeters = coords.map(c => transformCoord('EPSG:4326', 'EPSG:3857', [c[1], c[0]]));
    
    let sum = 0;
    const n = projectedMeters.length;
    for (let i = 0; i < n; i++) {
      const nextIdx = (i + 1) % n;
      sum += (projectedMeters[i][0] * projectedMeters[nextIdx][1]) - (projectedMeters[nextIdx][0] * projectedMeters[i][1]);
    }
    return 0.5 * sum; // Area size in square meters
  };

  // Zoom Helpers
  const zoomIn = () => mapInstanceRef.current?.zoomIn();
  const zoomOut = () => mapInstanceRef.current?.zoomOut();
  const resetHeading = () => mapInstanceRef.current?.setView([35.6895, 139.7450], 13);

  // Grab the CRS definition based on activeState selection
  const activeCRSDef = CRS_LIST.find(c => c.code === crsType) || CRS_LIST[0];

  return (
    <div id="gis-workspace-canvas" className="flex-1 flex flex-col min-w-0 h-full relative font-sans">
      
      {/* Dynamic Map Layer Container */}
      <div 
        id="leaflet-canvas-container" 
        className={`flex-1 min-h-0 w-full relative outline-hidden ${activeTool !== 'pan' ? 'cursor-crosshair' : ''}`}
        ref={mapContainerRef}
      />

      {/* Floating measurement / draw state prompt overlay banner */}
      {measurementResult && (
        <div id="gis-measure-hud" className="absolute top-4 left-4 z-[999] bg-slate-900/90 text-white shadow-2xl px-3.5 py-2.5 rounded-lg border border-slate-750 flex items-center gap-3 backdrop-blur-xs select-none">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
          <div className="text-xs">
            <span className="text-slate-400 block text-[9px] uppercase font-mono tracking-wider">計測・作図インジケータ</span>
            <span className="font-mono font-bold text-sm text-emerald-400">{measurementResult}</span>
          </div>
          <button 
            onClick={() => setDigitizedCoords([])} 
            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer shrink-0 border-l border-slate-700 pl-2.5 font-bold"
          >
            終了クリア
          </button>
        </div>
      )}

      {/* Floating QGIS style Map Navigation Controls wrapper */}
      <div className="absolute right-4 top-4 z-[999] flex flex-col gap-1.5 shadow select-none">
        
        {/* Zoom inside workspace */}
        <button
          onClick={zoomIn}
          className="w-8.5 h-8.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-xs font-bold"
          title="地図の拡大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Zoom out workspace */}
        <button
          onClick={zoomOut}
          className="w-8.5 h-8.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg flex items-center justify-center transition-all cursor-pointer shadow-xs font-bold"
          title="地図の縮小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Home camera focal to Tokyo Central */}
        <button
          onClick={resetHeading}
          className="w-8.5 h-8.5 bg-white hover:bg-slate-50 text-slate-700 border border-gray-200 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-none border-solid font-bold"
          title="東京の中心（都庁付近）に全域ジャンプ"
        >
          <Target className="w-4 h-4 text-blue-600" />
        </button>

      </div>

      {/* Floating GPS/CRS active quick indicator instructions */}
      {activeTool !== 'pan' && (
        <div className="absolute bottom-16 left-4 z-[999] bg-white border border-gray-200 px-3 py-2 rounded-md shadow-sm text-[11px] text-slate-700 flex items-center gap-2 max-w-sm select-none">
          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          <span>
            {activeTool === 'identify' && '■ クリックしたベクターの属性ポップアップ（Identify表示）します。'}
            {activeTool === 'measure_distance' && '■ 次々にクリックして頂点登録、ダブルクリックで計測確定します。'}
            {activeTool === 'measure_area' && '■ 面の頂点を3つ以上順にクリック。面積が自動計算されます。'}
            {activeTool === 'draw_point' && '■ 地図上をクリックすると、現在編集中（選択中）のベクターに新しい点をインジェクトします。'}
            {activeTool === 'draw_line' && '■ 連続クリックで経路線を描画。ダブルクリックで線地物を作成。'}
            {activeTool === 'draw_polygon' && '■ 面の各境界をクリック。ダブルクリックでポリゴン形状を作成。'}
            {activeTool === 'edit_geometry' && '■ [図形編集/頂点修正] 赤丸をドラッグすると頂点自体の移動、薄ピンク丸をドラッグすると新頂点追加、頂点を右クリックすると頂点が削除されます（選択中レイヤーが対象）。'}
          </span>
        </div>
      )}

      {/* =======================================================
          STRICT MANDATED COMPLIANCE: QGIS Bottom STATUS BAR 
          ======================================================= */}
      <div 
        id="qgis-desktop-statusbar"
        className="h-8.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between px-4 text-xs text-slate-600 select-none shrink-0 font-sans font-medium z-10 shadow-none"
      >
        
        {/* Section left: Active coordinate indicator in selected CRS projections */}
        <div className="flex items-center gap-2 text-slate-700 truncate mr-3">
          <Compass className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-slate-400 text-[10px] uppercase font-bold font-sans">マウス現在座標:</span>
          <span className="font-bold text-slate-800 font-mono bg-white border border-gray-200 px-2 py-0.5 rounded shadow-none">
            {activeCRSDef.formatCoord(mouseCoords[0], mouseCoords[1])}
          </span>
          <span className="text-slate-300 px-1 hidden md:inline">|</span>
          <span className="text-[10px] text-slate-400 font-sans hidden md:inline">DMS地理表記:</span>
          <span className="text-slate-500 font-mono font-normal hidden md:inline">
            Y: {toDMS(mouseCoords[1], true)} , X: {toDMS(mouseCoords[0], false)}
          </span>
        </div>

        {/* Section right: Grid metrics display, Zoom control & CRSs selector */}
        <div className="flex items-center gap-3.5 shrink-0 flex-nowrap text-[11px]">
          
          {/* Zoom tracker */}
          <div className="hidden sm:flex items-center gap-1.5 text-slate-550">
            <span>縮尺レベル:</span>
            <span className="bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-700 font-bold font-mono">Z-{zoomLevel}</span>
          </div>

          <div className="text-slate-300">|</div>

          {/* EPSG Coordinate Reference System Selector (QGIS's bottom-right button) */}
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="text-[10px] text-slate-400 font-bold uppercase hidden md:inline font-sans">座標参照系 (CRS):</span>
            <select
              id="statusbar-crs-selector"
              className="px-2 py-0.5 bg-white text-slate-700 border border-gray-250 hover:border-gray-300 rounded font-sans font-bold text-[11px] focus:outline-hidden cursor-pointer"
              value={crsType}
              onChange={(e) => onChangeCRS(e.target.value as CRSType)}
              title="QGISのように、右下からCRS（座標参照系）を別の投影系へ瞬時に切替・相互投影変換します"
            >
              {CRS_LIST.map((crs) => (
                <option key={crs.code} value={crs.code}>
                  {crs.code} ({crs.name.split(' (')[0]})
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>

    </div>
  );
}
