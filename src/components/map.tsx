"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  RefObject
} from "react";
import Map, {
  Source,
  Layer,
  Marker,
  ViewStateChangeEvent,
  MapRef
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { WebMercatorViewport } from "viewport-mercator-project";
import { useTheme } from "next-themes";
import { FeatureCollection, Feature } from "geojson";
import Image from "next/image";

import KyoshinMonitor from "./maps/kyoshin-monitor";
import PsWave from "./maps/ps-wave";
import { MapProps, SaibunProperties, SaibunFeatureWithBbox, EpicenterInfo } from "@/types/types";
import "maplibre-gl/dist/maplibre-gl.css";
import { getJapanHomePosition } from "@/utils/home-position";

const intensityFillColors: Record<string, string> = {
  "0": "#62626B",
  "1": "#2B8EB2",
  "2": "#4CD0A7",
  "3": "#F6CB51",
  "4": "#FF9939",
  "5-": "#E52A18",
  "5+": "#C31B1B",
  "6-": "#A50C6B",
  "6+": "#930A7A",
  "7": "#5F0CA2",
  "不明": "#62626B",
};

// 地図データのキャッシュ管理
const mapDataCache = {
  countries: {} as Record<string, FeatureCollection>,
  saibun: null as FeatureCollection | null,
  cities: null as FeatureCollection | null,
  loading: {} as Record<string, Promise<FeatureCollection>>,
};

// 国データを読み込むためのワーカー
const loadCountryData = async (resolution: string): Promise<FeatureCollection> => {
  // キャッシュにあればそれを返す
  if (mapDataCache.countries[resolution]) {
    return mapDataCache.countries[resolution];
  }
  
  // 既に読み込み中の場合は、その Promise を返す
  if (mapDataCache.loading[resolution] !== undefined) {
    return mapDataCache.loading[resolution];
  }
  
  // 新しい読み込みを開始し、Promise をキャッシュ
  const loadPromise = (async () => {
    try {
      let data: FeatureCollection;
      
      if (resolution === "10m") {
        const dataModule = await import("../../public/mapdata/10mCountries.json");
        data = {
          type: "FeatureCollection" as const,
          features: (dataModule.default as { geometries: GeoJSON.Geometry[] }).geometries.map(
            (geometry: GeoJSON.Geometry) => ({
              type: "Feature" as const,
              geometry,
              properties: {},
            })
          ),
        };
      } else if (resolution === "50m") {
        const dataModule = await import("../../public/mapdata/50mCountries.json");
        data = dataModule.default as unknown as FeatureCollection;
      } else {
        const dataModule = await import("../../public/mapdata/110mCountries.json");
        data = dataModule.default as unknown as FeatureCollection;
      }
      
      // キャッシュに保存
      mapDataCache.countries[resolution] = data;
      delete mapDataCache.loading[resolution];
      return data;
    } catch (error) {
      console.error(`国データの読み込みに失敗 (${resolution}):`, error);
      delete mapDataCache.loading[resolution];
      throw error;
    }
  })();
  
  mapDataCache.loading[resolution] = loadPromise;
  return loadPromise;
};

const MapComponent = React.forwardRef<MapRef, MapProps>((props, ref) => {
  const {
    enableKyoshinMonitor,
    epicenters,
    regionIntensityMap,
    enableMapIntensityFill,
    enableDynamicZoom,
    mapAutoZoom,
    mapResolution,
    onAutoZoomChange,
    forceAutoZoomTrigger,
    enableMapWarningArea,
    warningRegionCodes,
    isCancel,
    psWaveUpdateInterval,
    onMapLoad,
    nowAppTimeRef,
  } = props;

  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme || "light";
  const [saibunDataLoaded, setSaibunDataLoaded] = useState(!!mapDataCache.saibun);
  const [citiesDataLoaded, setCitiesDataLoaded] = useState(!!mapDataCache.cities);
  
  useEffect(() => {
    const loadMapData = async () => {
      try {
        if (!mapDataCache.saibun) {
          const dataModule = await import("../../public/mapdata/Saibun.json");
          mapDataCache.saibun = dataModule.default as FeatureCollection;
          setSaibunDataLoaded(true);
        }
  
        if (!mapDataCache.cities) {
          const dataModule = await import("../../public/mapdata/Cities.json");
          mapDataCache.cities = dataModule.default as FeatureCollection;
          setCitiesDataLoaded(true);
        }
      } catch (error) {
        console.error("地図データの読み込みに失敗:", error);
      }
    };
    
    loadMapData();
  }, []);
  const [countriesData, setCountriesData] = useState<FeatureCollection | null>(null);
  const [isMapMoving, setIsMapMoving] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const fetchCountryData = async () => {
      try {
        const data = await loadCountryData(mapResolution);
        if (mounted) {
          setCountriesData(data);
        }
      } catch (error) {
        console.error("国データの読み込みに失敗:", error);
      }
    };
    
    fetchCountryData();
    return () => { mounted = false; };
  }, [mapResolution]);

  // 細分化地域のバウンディングボックスをあらかじめ計算
  const saibunFeaturesWithBbox = useMemo<SaibunFeatureWithBbox[]>(() => {
    if (!saibunDataLoaded || !mapDataCache.saibun) return [];
    
    return mapDataCache.saibun.features
      .filter((feature) => feature.geometry && feature.geometry.type)
      .map((feature) => {
        // 既にbboxプロパティがある場合はそれを使用
        if (feature.bbox && feature.bbox.length === 4) {
          return {
            feature,
            bbox: feature.bbox as [number, number, number, number],
          };
        }
        
        let minLat = 90,
          maxLat = -90,
          minLng = 180,
          maxLng = -180;
          
        // 座標処理
        const processCoord = (coord: number[]) => {
          const [lng, lat] = coord;
          minLng = lng < minLng ? lng : minLng;
          maxLng = lng > maxLng ? lng : maxLng;
          minLat = lat < minLat ? lat : minLat;
          maxLat = lat > maxLat ? lat : maxLat;
        };
        
        if (feature.geometry.type === "Polygon") {
          for (const coordArr of feature.geometry.coordinates || []) {
            for (const coord of coordArr) {
              processCoord(coord);
            }
          }
        } else if (feature.geometry.type === "MultiPolygon") {
          for (const polygon of feature.geometry.coordinates || []) {
            for (const coordArr of polygon) {
              for (const coord of coordArr) {
                processCoord(coord);
              }
            }
          }
        }

        return {
          feature,
          bbox: [minLng, minLat, maxLng, maxLat],
        };
      });
  }, [saibunDataLoaded]);

  const affectedRegionCodesSet = useMemo(() => {
    return new Set(Object.keys(regionIntensityMap));
  }, [regionIntensityMap]);

  const warningRegionCodesSet = useMemo(() => {
    return new Set(warningRegionCodes);
  }, [warningRegionCodes]);

  const prevPropsMapRef = useRef<Record<string, {color: string, opacity: number}>>({});
  
  // 細分化地域の塗りつぶし色などをプロパティに仕込む
  const processedSaibunData = useMemo(() => {
    if (!saibunDataLoaded || saibunFeaturesWithBbox.length === 0) {
      return { type: "FeatureCollection", features: [] } as FeatureCollection;
    }

    const currentPropsMap: Record<string, {color: string, opacity: number}> = {};    
    const clonedFeatures: Feature[] = saibunFeaturesWithBbox.map(({ feature }) => {
      const cloned = {
        ...feature,
        properties: { ...feature.properties } as SaibunProperties,
      };
      
      const fProps = cloned.properties as SaibunProperties;
      const code = fProps.code ? String(fProps.code) : "";

      let fillColor = theme === "dark" ? "#2C2C2C" : "#FFF";
      let fillOpacity = 0.9;

      if (code) {
        // 警報領域
        if (enableMapWarningArea && warningRegionCodesSet.has(code)) {
          fillColor = "#FF0000";
          fillOpacity = 0.9;
        }
        // 震度塗りつぶし
        else if (enableMapIntensityFill && affectedRegionCodesSet.has(code)) {
          const intensity = regionIntensityMap[code];
          if (intensity) {
            fillColor = intensityFillColors[intensity] || "#62626B";
            fillOpacity = 1;
          }
        }
      }
      
      // 前回と同じプロパティなら再計算をスキップ
      const prevProps = prevPropsMapRef.current[code];
      if (prevProps && prevProps.color === fillColor && prevProps.opacity === fillOpacity) {
        // 前回の値を再利用
        fProps.computedFillColor = fillColor;
        fProps.computedFillOpacity = fillOpacity;
      } else {
        // 新しい値を設定
        fProps.computedFillColor = fillColor;
        fProps.computedFillOpacity = fillOpacity;
      }
      
      // 現在の値をマップに保存
      currentPropsMap[code] = {color: fillColor, opacity: fillOpacity};
      
      return cloned;
    });

    prevPropsMapRef.current = currentPropsMap;

    return {
      type: "FeatureCollection",
      features: clonedFeatures,
    } as FeatureCollection;
  }, [
    saibunDataLoaded,
    saibunFeaturesWithBbox,
    theme,
    enableMapWarningArea,
    warningRegionCodesSet,
    enableMapIntensityFill,
    affectedRegionCodesSet,
    regionIntensityMap
  ]);

  const initialViewState = useMemo(() => getJapanHomePosition(), []);

  const [viewState, setViewState] = useState({
    longitude: initialViewState.longitude,
    latitude: initialViewState.latitude,
    zoom: initialViewState.zoom,
  });

  const [autoZoomEnabled, setAutoZoomEnabled] = useState(
    enableDynamicZoom ? mapAutoZoom : false
  );

  useEffect(() => {
    if (!enableDynamicZoom) {
      setAutoZoomEnabled(false);
    } else {
      setAutoZoomEnabled(mapAutoZoom);
    }
  }, [enableDynamicZoom, mapAutoZoom]);

  useEffect(() => {
    if (forceAutoZoomTrigger && enableDynamicZoom) {
      setAutoZoomEnabled(true);
      onAutoZoomChange?.(true);
    }
  }, [forceAutoZoomTrigger, onAutoZoomChange, enableDynamicZoom]);

  const lastAutoZoomTime = useRef(0);
  const pendingAutoZoom = useRef(false);
  const processedEventIds = useRef<Set<string>>(new Set());
  const prevEpicenters = useRef<EpicenterInfo[]>([]);
  const prevRegionIntensityMapKeys = useRef<string[]>([]);
  const currentViewBounds = useRef<{minLng: number, maxLng: number, minLat: number, maxLat: number} | null>(null);

  // 自動ズーム処理
  useEffect(() => {
    if (epicenters.length === 0 && Object.keys(regionIntensityMap).length === 0) {
      if (enableDynamicZoom && autoZoomEnabled && ref && 'current' in ref && ref.current) {
        const { longitude, latitude, zoom } = getJapanHomePosition();
        ref.current.flyTo({
          center: [longitude, latitude],
          duration: 1000,
          zoom: zoom,
          essential: true,
        });
      }
      return;
    }

    if (!enableDynamicZoom || !autoZoomEnabled) return;
    if (!ref || !('current' in ref) || !ref.current) return;
    
    const now = nowAppTimeRef.current;
    if (now - lastAutoZoomTime.current < 200) {
      if (!pendingAutoZoom.current) {
        pendingAutoZoom.current = true;
        setTimeout(() => {
          pendingAutoZoom.current = false;
          setAutoZoomEnabled(prev => prev);
        }, 200);
      }
      return;
    }

    // 震源と塗りつぶし地域の境界を計算
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    let hasValidBounds = false;
    
    // 震源の境界を計算
    for (let i = 0; i < epicenters.length; i++) {
      const epi = epicenters[i];
      if (epi && typeof epi.lat === "number" && typeof epi.lng === "number") {
        minLng = epi.lng < minLng ? epi.lng : minLng;
        maxLng = epi.lng > maxLng ? epi.lng : maxLng;
        minLat = epi.lat < minLat ? epi.lat : minLat;
        maxLat = epi.lat > maxLat ? epi.lat : maxLat;
        hasValidBounds = true;
      }
    }

    // 塗りつぶし地域の境界を計算
    const regionKeys = Object.keys(regionIntensityMap);
    if (regionKeys.length > 0) {
      const regionCodesSet = new Set(regionKeys);
      
      for (let i = 0; i < saibunFeaturesWithBbox.length; i++) {
        const { bbox, feature } = saibunFeaturesWithBbox[i];
        const code = feature.properties?.code;
        if (code && regionCodesSet.has(String(code))) {
          const [bMinLng, bMinLat, bMaxLng, bMaxLat] = bbox;
          minLng = bMinLng < minLng ? bMinLng : minLng;
          maxLng = bMaxLng > maxLng ? bMaxLng : maxLng;
          minLat = bMinLat < minLat ? bMinLat : minLat;
          maxLat = bMaxLat > maxLat ? bMaxLat : maxLat;
          hasValidBounds = true;
        }
      }
    }

    if (!hasValidBounds) {
      const { longitude, latitude, zoom } = getJapanHomePosition();
      ref.current.flyTo({
        center: [longitude, latitude],
        duration: 1000,
        zoom: zoom,
        essential: true,
      });
      return;
    }

    if (ref.current) {
      const bounds = ref.current.getBounds();
      if (bounds) {
        currentViewBounds.current = {
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth()
        };
      }
    }

    // ズームを更新するかどうかの判断
    let shouldUpdateZoom = false;
    let zoomUpdateReason = "";

    // 初報の場合は必ずズーム
    const newEventIds = [];
    for (let i = 0; i < epicenters.length; i++) {
      if (!processedEventIds.current.has(epicenters[i].eventId)) {
        newEventIds.push(epicenters[i]);
      }
    }
    
    if (newEventIds.length > 0) {
      shouldUpdateZoom = true;
      zoomUpdateReason = "初報のため";
      for (let i = 0; i < newEventIds.length; i++) {
        processedEventIds.current.add(newEventIds[i].eventId);
      }
    } 
    else {
      for (let i = 0; i < epicenters.length; i++) {
        const epi = epicenters[i];
        const prevEpi = prevEpicenters.current.find(p => p.eventId === epi.eventId);
        if (prevEpi) {
          const latDiff = Math.abs(epi.lat - prevEpi.lat);
          const lngDiff = Math.abs(epi.lng - prevEpi.lng);
          
          // 位置が大幅に変わった場合（0.5度以上の変化）
          if (latDiff > 0.5 || lngDiff > 0.5) {
            shouldUpdateZoom = true;
            zoomUpdateReason = "震源位置が大幅に変化";
            break;
          }
          
          // 現在の表示範囲から震源が外れた場合
          if (currentViewBounds.current) {
            const { minLng, maxLng, minLat, maxLat } = currentViewBounds.current;
            if (epi.lng < minLng || epi.lng > maxLng || epi.lat < minLat || epi.lat > maxLat) {
              shouldUpdateZoom = true;
              zoomUpdateReason = "震源が表示範囲外";
              break;
            }
          }
        }
      }
      
      // 塗りつぶし地域が更新されたかチェック
      if (!shouldUpdateZoom) {
        const currentRegionKeys = regionKeys;
        const prevRegionKeys = prevRegionIntensityMapKeys.current;
        
        // 地域数が変わった場合
        if (currentRegionKeys.length !== prevRegionKeys.length) {
          shouldUpdateZoom = true;
          zoomUpdateReason = "塗りつぶし地域が更新";
        } 
        // 地域が同じ数でも内容が変わった場合
        else if (currentRegionKeys.length > 0) {
          const prevKeysSet = new Set(prevRegionKeys);
          for (let i = 0; i < currentRegionKeys.length; i++) {
            if (!prevKeysSet.has(currentRegionKeys[i])) {
              shouldUpdateZoom = true;
              zoomUpdateReason = "塗りつぶし地域が更新";
              break;
            }
          }
        }
      }
    }

    prevEpicenters.current = [...epicenters];
    prevRegionIntensityMapKeys.current = regionKeys;

    if (!shouldUpdateZoom) {
      return;
    }

    lastAutoZoomTime.current = now;

    // 最適なズームレベルを決定
    let maxZoom = 10;
    if (epicenters.length === 1) {
      maxZoom = epicenters[0].depthval > 150 ? 5 : 7;
    } else if (epicenters.length > 1) {
      let hasDeepEpicenter = false;
      for (let i = 0; i < epicenters.length; i++) {
        if (epicenters[i].depthval > 150) {
          hasDeepEpicenter = true;
          break;
        }
      }
      maxZoom = hasDeepEpicenter ? 5 : 6;
    }

    // requestAnimationFrameを使用して視覚的な更新
    requestAnimationFrame(() => {
      try {
        const viewport = new WebMercatorViewport({
          width: window.innerWidth,
          height: window.innerHeight,
        }).fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 50, maxZoom }
        );

        const duration = zoomUpdateReason === "塗りつぶし地域が更新" ? 100 : 300;

        ref.current?.flyTo({
          center: [viewport.longitude, viewport.latitude],
          duration: duration,
          zoom: viewport.zoom,
          essential: true,
        });
        
        onAutoZoomChange?.(true);
      } catch (e) {
        console.error("Auto-zoom calculation failed:", e);
      }
    });
  }, [
    epicenters,
    regionIntensityMap,
    autoZoomEnabled,
    enableDynamicZoom,
    onAutoZoomChange,
    saibunFeaturesWithBbox,
    ref,
    nowAppTimeRef
  ]);

  const autoZoomTimeoutRef = useRef<number | null>(null);

  const setHomePosition = useCallback(() => {
    if (ref && typeof ref !== "function" && ref.current) {
      const { longitude, latitude, zoom } = getJapanHomePosition();
      ref.current.flyTo({
        center: [longitude, latitude],
        zoom: zoom,
        duration: 1000,
      });
    }
  }, [ref]);

  const handleUserInteractionStart = useCallback(() => {
    if (autoZoomTimeoutRef.current) {
      clearTimeout(autoZoomTimeoutRef.current);
      autoZoomTimeoutRef.current = null;
    }
    if (enableDynamicZoom) {
      setAutoZoomEnabled(false);
      onAutoZoomChange?.(false);
    }
  }, [enableDynamicZoom, onAutoZoomChange]);

  const handleUserInteractionEnd = useCallback(() => {
    if (autoZoomTimeoutRef.current) {
      clearTimeout(autoZoomTimeoutRef.current);
    }
    if (enableDynamicZoom) {
      if (epicenters.length === 0 && Object.keys(regionIntensityMap).length === 0) {
        autoZoomTimeoutRef.current = window.setTimeout(() => {
          setHomePosition();
          setAutoZoomEnabled(true);
          onAutoZoomChange?.(true);
        }, 10000);
      }
    }
  }, [enableDynamicZoom, onAutoZoomChange, setHomePosition, epicenters, regionIntensityMap]);

  const reorderMapLayers = useCallback(() => {
    if (ref && "current" in ref && ref.current) {
      requestAnimationFrame(() => {
        if (!ref.current) return;
        const map = ref.current;
        const layerOrder = [
          "countries-fill",
          "countries-outline",
          "saibun-layer",
          "cities-layer",
          "site-layer",
          "pWave-layer",
          "sWave-layer"
        ];
        
        for (let i = 0; i < layerOrder.length; i++) {
          const layerId = layerOrder[i];
          if (map.getLayer(layerId)) {
            map.moveLayer(layerId);
          }
        }
      });
    }
  }, [ref]);

  useEffect(() => {
    if (enableKyoshinMonitor) {
      const timer = setTimeout(() => {
        reorderMapLayers();
      }, 400); 
      return () => clearTimeout(timer);
    }
  }, [enableKyoshinMonitor, reorderMapLayers]);

  const handleMoveStart = useCallback(() => {
    setIsMapMoving(true);
    window.dispatchEvent(new Event('movestart'));
  }, []);

  const handleMoveEnd = useCallback(() => {
    reorderMapLayers();
    setIsMapMoving(false);
    window.dispatchEvent(new Event('moveend'));
  }, [reorderMapLayers]);

  const onMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);
  }, [setViewState]);

  // マップのロード完了
  const onMapLoadHandler = useCallback(() => {
    reorderMapLayers();
    onMapLoad?.();
  }, [onMapLoad, reorderMapLayers]);

  // レイヤーの順序を整理
  useEffect(() => {
    reorderMapLayers();
  }, [reorderMapLayers]);

  const countriesFillPaint = useMemo(() => ({
    "fill-color": theme === "dark" ? "#252525" : "#737A8A",
    "fill-opacity": 0.6,
  }), [theme]);

  const countriesOutlinePaint = useMemo(() => ({
    "line-color": theme === "dark" ? "rgba(180,180,180,0.4)" : "rgba(80,80,80,0.4)",
    "line-width": 0.8,
  }), [theme]);

  const saibunLayerPaint = useMemo(() => ({
    "fill-color": (["get", "computedFillColor"] as unknown) as maplibregl.DataDrivenPropertyValueSpecification<string>,
    "fill-opacity": (["get", "computedFillOpacity"] as unknown) as maplibregl.DataDrivenPropertyValueSpecification<number>,
    "fill-outline-color": theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
  }), [theme]);

  const citiesLayerPaint = useMemo(() => ({
    "line-color": theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
    "line-width": theme === "dark" ? 0.3 : 0.4,
  }), [theme]);

  const bgColor = useMemo(() => 
    theme === "dark" ? "#18181C" : "#AAD3DF"
  , [theme]);

  const memoizedEpicenters = useMemo(() => {
    return epicenters.map((epi) => (
      <Marker
        key={`epi-${epi.eventId}`}
        longitude={epi.lng}
        latitude={epi.lat}
        anchor="center"
      >
        <Image
          src={epi.icon}
          alt="epicenter"
          width={48}
          height={48}
          className={epi.isCancel ? "opacity-30" : "blink"}
          priority={true}
        />
      </Marker>
    ));
  }, [epicenters]);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        backgroundColor: bgColor,
        overflow: "hidden",
      }}
    >
      <Map
        ref={ref as RefObject<MapRef>}
        longitude={viewState.longitude}
        latitude={viewState.latitude}
        zoom={viewState.zoom}
        mapLib={maplibregl}
        onMove={onMove}
        onMoveStart={() => {
          handleMoveStart();
          handleUserInteractionStart();
        }}
        onMoveEnd={() => {
          handleMoveEnd();
          handleUserInteractionEnd();
        }}
        onLoad={onMapLoadHandler}
        reuseMaps
        maxPitch={0}
        maxZoom={12}
      >
        {countriesData && (
          <Source id="countries" type="geojson" data={countriesData} generateId>
            <Layer
              id="countries-fill"
              type="fill"
              paint={countriesFillPaint}
            />
            <Layer
              id="countries-outline"
              type="line"
              paint={countriesOutlinePaint}
            />
          </Source>
        )}

        {saibunDataLoaded && (
          <Source id="saibun" type="geojson" data={processedSaibunData} generateId>
            <Layer
              id="saibun-layer"
              type="fill"
              paint={saibunLayerPaint}
            />
          </Source>
        )}

        {citiesDataLoaded && mapDataCache.cities && (
          <Source id="cities" type="geojson" data={mapDataCache.cities} generateId>
            <Layer
              id="cities-layer"
              type="line"
              minzoom={9}
              paint={citiesLayerPaint}
            />
          </Source>
        )}

        {memoizedEpicenters}

        <PsWave
          epicenters={epicenters}
          psWaveUpdateInterval={psWaveUpdateInterval}
          isCancel={isCancel}
          nowAppTimeRef={nowAppTimeRef}
          isMapMoving={isMapMoving}
          ref={ref}
        />
        <KyoshinMonitor
          enableKyoshinMonitor={enableKyoshinMonitor}
          nowAppTimeRef={nowAppTimeRef}
        />
      </Map>
    </div>
  );
});

MapComponent.displayName = "MapComponent";
export default React.memo(MapComponent);
