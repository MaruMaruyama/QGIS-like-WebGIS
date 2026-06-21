import { CRSDefinition, GISLayer } from '../types/gis';
import proj4 from 'proj4';

// Register Projection Definitions
// EPSG:4326 (WGS 84 / Geographic, latitude-longitude)
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

// EPSG:3857 (Web Mercator)
proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs');

// EPSG:6677 (JGD2011 / Japanese Plane Rectangular Coordinate System Zone IX / Tokyo area)
proj4.defs('EPSG:6677', '+proj=tmerc +lat_0=36 +lon_0=139.833333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');

// DMS convert function helper
export function toDMS(val: number, isLat: boolean): string {
  const absVal = Math.abs(val);
  const deg = Math.floor(absVal);
  const minFloat = (absVal - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(2);
  const suffix = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  return `${deg}° ${min}' ${sec}" ${suffix}`;
}

export const CRS_LIST: CRSDefinition[] = [
  {
    code: 'EPSG:4326',
    name: 'JGD2011 / WGS 84 (緯度経度)',
    unit: 'Degrees',
    proj4Def: 'EPSG:4326',
    formatCoord: (lng, lat) => `${lng.toFixed(6)}, ${lat.toFixed(6)}`
  },
  {
    code: 'EPSG:3857',
    name: 'WGS 84 / Pseudo-Mercator (Webメルカトル)',
    unit: 'Meters',
    proj4Def: 'EPSG:3857',
    formatCoord: (lng, lat) => {
      const coord = proj4('EPSG:4326', 'EPSG:3857', [lng, lat]);
      return `X: ${coord[0].toFixed(2)} m, Y: ${coord[1].toFixed(2)} m`;
    }
  },
  {
    code: 'EPSG:6677',
    name: 'JGD2011 / 平面直角座標系 第IX系',
    unit: 'Meters',
    proj4Def: 'EPSG:6677',
    formatCoord: (lng, lat) => {
      const coord = proj4('EPSG:4326', 'EPSG:6677', [lng, lat]);
      // Plane rectangular coords standard lists Northing (Y) and Easting (X)
      // Usually displayed as X(North), Y(East) in Japan
      return `X(第IX系北): ${coord[1].toFixed(2)} m, Y(東): ${coord[0].toFixed(2)} m`;
    }
  }
];

export const transformCoord = (from: string, to: string, coords: [number, number]): [number, number] => {
  return proj4(from, to, coords);
};

// --- GIS Sample Datasets (Tokyo Central Map Area: lat: 35.68, lng: 139.75) ---

// 1. Points Layer: Tokyo Famous Tower & Buildings
export const samplePointsLayer: GISLayer = {
  id: 'layers-points-tokyo',
  name: '東京都・ランドマーク(点地物)',
  type: 'vector',
  format: 'geojson',
  visible: true,
  opacity: 1,
  style: {
    color: '#1e3a8a',
    fillColor: '#ef4444',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.9,
    pointSize: 8,
    labelField: 'name_ja'
  },
  geojsonData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'tokyo-point-1',
        properties: {
          id: 'tokyo-point-1',
          name_ja: '東京タワー',
          name_en: 'Tokyo Tower',
          height_m: 332.9,
          type: '塔・ランドマーク',
          address: '港区芝公園４丁目２−８',
          established: 1958
        },
        geometry: {
          type: 'Point',
          coordinates: [139.7454329, 35.6585805]
        }
      },
      {
        type: 'Feature',
        id: 'tokyo-point-2',
        properties: {
          id: 'tokyo-point-2',
          name_ja: '東京都庁 第一本庁舎',
          name_en: 'Tokyo Metropolitan Government',
          height_m: 243.4,
          type: '庁舎・行政',
          address: '新宿区西新宿２丁目８−１',
          established: 1990
        },
        geometry: {
          type: 'Point',
          coordinates: [139.691712, 35.689632]
        }
      },
      {
        type: 'Feature',
        id: 'tokyo-point-3',
        properties: {
          id: 'tokyo-point-3',
          name_ja: '東京スカイツリー',
          name_en: 'Tokyo Skytree',
          height_m: 634.0,
          type: '電波塔・商業施設',
          address: '墨田区押上１丁目１−２',
          established: 2012
        },
        geometry: {
          type: 'Point',
          coordinates: [139.8107, 35.710063]
        }
      },
      {
        type: 'Feature',
        id: 'tokyo-point-4',
        properties: {
          id: 'tokyo-point-4',
          name_ja: '国会議事堂',
          name_en: 'National Diet Building',
          height_m: 65.4,
          type: '国会・主要機関',
          address: '千代田区永田町１丁目７−１',
          established: 1936
        },
        geometry: {
          type: 'Point',
          coordinates: [139.744856, 35.675888]
        }
      }
    ]
  }
};

// 2. Lines Layer: Rivers & Railways in Tokyo Central
export const sampleLinesLayer: GISLayer = {
  id: 'layers-lines-tokyo',
  name: '主要河川＆鉄道路線(線地物)',
  type: 'vector',
  format: 'geojson',
  visible: true,
  opacity: 1,
  style: {
    color: '#34d399',
    fillColor: '#34d399',
    weight: 4,
    opacity: 0.9,
    fillOpacity: 0.2,
    pointSize: 4,
    labelField: 'name_ja'
  },
  geojsonData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'tokyo-line-1',
        properties: {
          id: 'tokyo-line-1',
          name_ja: '隅田川(一級河川)',
          name_en: 'Sumida River (Class 1 River)',
          length_km: 23.5,
          category: '河川',
          flow_rate_max: 'Moderate'
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [139.8000, 35.7350],
            [139.8055, 35.7280],
            [139.7990, 35.7120],
            [139.7910, 35.6980],
            [139.7710, 35.6790],
            [139.7610, 35.6550],
            [139.7650, 35.6320]
          ]
        }
      },
      {
        type: 'Feature',
        id: 'tokyo-line-2',
        properties: {
          id: 'tokyo-line-2',
          name_ja: 'JR中央本線(部分)',
          name_en: 'JR Chuo Line (Local Seg)',
          length_km: 7.2,
          category: '鉄道幹線',
          operator: 'JR東日本'
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [139.7000, 35.6900], // Shinjuku
            [139.7208, 35.6855], // Yotsuya
            [139.7420, 35.6975], // Iidabashi
            [139.7715, 35.6985], // Akihabara
            [139.7710, 35.6811]  // Tokyo
          ]
        }
      }
    ]
  }
};

// 3. Polygons Layer: Main Parks & Royal Estate in Tokyo
export const samplePolygonsLayer: GISLayer = {
  id: 'layers-polygons-tokyo',
  name: '都内心休公園・敷地(面地物)',
  type: 'vector',
  format: 'geojson',
  visible: true,
  opacity: 1,
  style: {
    color: '#064e3b',
    fillColor: '#10b981',
    weight: 2.5,
    opacity: 0.85,
    fillOpacity: 0.5,
    pointSize: 4,
    labelField: 'name_ja'
  },
  geojsonData: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'tokyo-poly-1',
        properties: {
          id: 'tokyo-poly-1',
          name_ja: '皇居東御苑・敷地',
          name_en: 'Imperial Palace East Gardens',
          area_ha: 21.0,
          established: 1968,
          category: '特別緑地/皇室関連',
          admission: '無料'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [139.7540, 35.6880],
              [139.7610, 35.6890],
              [139.7640, 35.6840],
              [139.7580, 35.6810],
              [139.7510, 35.6830],
              [139.7540, 35.6880]
            ]
          ]
        }
      },
      {
        type: 'Feature',
        id: 'tokyo-poly-2',
        properties: {
          id: 'tokyo-poly-2',
          name_ja: '新宿御苑',
          name_en: 'Shinjuku Gyoen National Garden',
          area_ha: 58.3,
          established: 1949,
          category: '国民公園',
          admission: '有料(一般500円)'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [139.7050, 35.6890],
              [139.7150, 35.6885],
              [139.7180, 35.6830],
              [139.7080, 35.6790],
              [139.7030, 35.6820],
              [139.7050, 35.6890]
            ]
          ]
        }
      },
      {
        type: 'Feature',
        id: 'tokyo-poly-3',
        properties: {
          id: 'tokyo-poly-3',
          name_ja: '代々木公園',
          name_en: 'Yoyogi Park',
          area_ha: 54.1,
          established: 1967,
          category: '都立公園',
          admission: '無料'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [139.6910, 35.6750],
              [139.7010, 35.6740],
              [139.6990, 35.6660],
              [139.6900, 35.6690],
              [139.6910, 35.6750]
            ]
          ]
        }
      }
    ]
  }
};

// 4. Default Base Overlays definitions (Rasters & XYZ Tilings)
export const sampleBaseLayers: GISLayer[] = [
  {
    id: 'tiles-osm',
    name: 'OpenStreetMap (標準日本語地図)',
    type: 'raster',
    format: 'xyz_tile',
    visible: true,
    opacity: 1,
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  {
    id: 'tiles-google-roadmap',
    name: 'Google Maps (標準道路地図)',
    type: 'raster',
    format: 'xyz_tile',
    visible: false,
    opacity: 1,
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>'
  },
  {
    id: 'tiles-google-hybrid',
    name: 'Google Maps (航空写真ハイブリッド)',
    type: 'raster',
    format: 'xyz_tile',
    visible: false,
    opacity: 1,
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>'
  },
  {
    id: 'tiles-google-terrain',
    name: 'Google Maps (地形地図)',
    type: 'raster',
    format: 'xyz_tile',
    visible: false,
    opacity: 1,
    url: 'https://mt1.google.com/vt/lyrs=t&x={x}&y={y}&z={z}',
    attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>'
  },
  {
    id: 'tiles-gsi-standard',
    name: '国土地理院 地図 (標準地図)',
    type: 'raster',
    format: 'xyz_tile',
    visible: false,
    opacity: 1,
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a> 国土地理院標準地図'
  },
  {
    id: 'tiles-gsi-pale',
    name: '国土地理院 地図 (淡色地図)',
    type: 'raster',
    format: 'xyz_tile',
    visible: false,
    opacity: 1,
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a> 国土地理院淡色地図'
  },
  {
    id: 'tiles-gsi-ort',
    name: '国土地理院 衛星航空写真 (最新オルソ)',
    type: 'raster',
    format: 'xyz_tile',
    visible: false,
    opacity: 0.85,
    url: 'https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg',
    attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a> 航空写真'
  }
];

// Simple mock Georeferenced Image (Raster file setup mockup)
export const initialGeoreferencedImage: GISLayer = {
  id: 'layers-raster-georef',
  name: 'ジオリファレンス・ラスター（例: 古地図シミュレータ）',
  type: 'raster',
  format: 'georeferenced_image',
  visible: false,
  opacity: 0.65,
  url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 100 100"><rect width="100" height="100" fill="beige" opacity="0.75" stroke="brown" stroke-width="3"/><circle cx="50" cy="50" r="30" fill="none" stroke="red" stroke-width="1.5" stroke-dasharray="2,2"/><text x="50" y="55" font-family="serif" font-size="6" font-weight="bold" fill="brown" text-anchor="middle">TOKYO EDO MAP 1850</text><line x1="50" y1="10" x2="50" y2="90" stroke="brown" stroke-width="0.5"/><line x1="10" y1="50" x2="90" y2="50" stroke="brown" stroke-width="0.5"/><text x="50" y="8" font-size="4" fill="brown" text-anchor="middle">北</text></svg>',
  bounds: [
    [35.670, 139.730], // Southwest
    [35.700, 139.770]  // Northeast
  ],
  attribution: 'Edo Ancient Map projection overlay simulator'
};
