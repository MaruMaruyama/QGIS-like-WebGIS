export type CRSType = 'EPSG:4326' | 'EPSG:3857' | 'EPSG:6677'; // WGS84, Web Mercator, JGD2011 Plane Rectangular IX

export interface CRSDefinition {
  code: CRSType;
  name: string;
  unit: 'Degrees' | 'Meters';
  proj4Def: string;
  formatCoord: (lng: number, lat: number) => string;
}

export type LayerType = 'vector' | 'raster';
export type VectorFormat = 'geojson';
export type RasterFormat = 'xyz_tile' | 'georeferenced_image';

export interface VectorStyle {
  color: string;      // Line color
  fillColor: string;  // Fill color
  weight: number;     // Line weight (pixels)
  opacity: number;    // Line opacity (0-1)
  fillOpacity: number;// Fill opacity (0-1)
  pointSize: number;  // For point features
  labelField?: string; // Optional field in properties to display as label on hover/static
}

export interface GISLayer {
  id: string;
  name: string;
  type: LayerType;
  format: VectorFormat | RasterFormat;
  visible: boolean;
  opacity: number; // General opacity for raster layers
  
  // Vector-specific fields
  geojsonData?: any; // any GeoJSON FeatureCollection
  style?: VectorStyle;
  
  // Raster-specific fields
  url?: string;      // For XYZ Tiles URL or Image base64/URL
  bounds?: [[number, number], [number, number]]; // For image absolute bounding box (lat/lng)
  attribution?: string;
}

export interface AttributeTableState {
  layerId: string | null;
  isOpen: boolean;
  selectedFeatureId: string | null;
}

export type MapTool = 'pan' | 'identify' | 'measure_distance' | 'measure_area' | 'draw_point' | 'draw_line' | 'draw_polygon' | 'edit_geometry';
