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
import { MapProps, SaibunProperties, SaibunFeatureWithBbox } from "@/types/types";
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
};

// 国データを読み込むためのワーカー
const loadCountryData = async (resolution: string): Promise<FeatureCollection> => {
  // キャッシュにあればそれを返す
  if (mapDataCache.countries[resolution]) {
    return mapDataCache.countries[resolution];
  }
  
  let data: FeatureCollection;
  
  try {
    if (resolution === "10m") {
      const module = await import("../../public/mapdata/10mCountries.json");
      data = {
        type: "FeatureCollection" as const,
        features: (module.default as { geometries: GeoJSON.Geometry[] }).geometries.map(
          (geometry: GeoJSON.Geometry) => ({
            type: "Feature" as const,
            geometry,
            properties: {},
          })
        ),
      };
    } else if (resolution === "50m") {
      const module = await import("../../public/mapdata/50mCountries.json");
      data = module.default as unknown as FeatureCollection;
    } else {
      const module = await import("../../public/mapdata/110mCountries.json");
      data = module.default as unknown as FeatureCollection;
    }
    
    // キャッシュに保存
    mapDataCache.countries[resolution] = data;
    return data;
  } catch (error) {
    console.error(`国データの読み込みに失敗 (${resolution}):`, error);
    throw error;
  }
};

const MapComponent = React.forwardRef<MapRef, MapProps>((props, ref) => {
  const {
    enableKyoshinMonitor,
    onTimeUpdate,
    isConnected,
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
          const module = await import("../../public/mapdata/Saibun.json");
          mapDataCache.saibun = module.default as FeatureCollection;
          setSaibunDataLoaded(true);
        }
  
        if (!mapDataCache.cities) {
          const module = await import("../../public/mapdata/Cities.json");
          mapDataCache.cities = module.default as FeatureCollection;
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
        let minLat = 90,
          maxLat = -90,
          minLng = 180,
          maxLng = -180;
        if (feature.geometry.type === "Polygon") {
          (feature.geometry.coordinates || []).forEach((coordArr) => {
            coordArr.forEach((coord) => {
              const [lng, lat] = coord;
              if (lng < minLng) minLng = lng;
              if (lng > maxLng) maxLng = lng;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
            });
          });
        } else if (feature.geometry.type === "MultiPolygon") {
          (feature.geometry.coordinates || []).forEach((polygon) => {
            polygon.forEach((coordArr) => {
              coordArr.forEach((coord) => {
                const [lng, lat] = coord;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
              });
            });
          });
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

  // 細分化地域の塗りつぶし色などをプロパティに仕込む
  const processedSaibunData = useMemo(() => {
    if (!saibunDataLoaded || saibunFeaturesWithBbox.length === 0) {
      return { type: "FeatureCollection", features: [] } as FeatureCollection;
    }

    const clonedFeatures: Feature[] = saibunFeaturesWithBbox.map(({ feature }) => {
      const cloned = JSON.parse(JSON.stringify(feature)) as Feature;
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
      fProps.computedFillColor = fillColor;
      fProps.computedFillOpacity = fillOpacity;
      return cloned;
    });

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

  // 自動ズーム処理
  useEffect(() => {
    if (epicenters.length === 0 && Object.keys(regionIntensityMap).length === 0) return;
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

    lastAutoZoomTime.current = now;

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    let hasValidBounds = false;

    epicenters.forEach((epi) => {
      if (epi && typeof epi.lat === "number" && typeof epi.lng === "number") {
        const lat = epi.lat;
        const lng = epi.lng;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        hasValidBounds = true;
      }
    });

    if (Object.keys(regionIntensityMap).length > 0) {
      for (const { bbox, feature } of saibunFeaturesWithBbox) {
        const code = feature.properties?.code;
        if (code && regionIntensityMap[String(code)] !== undefined) {
          const [bMinLng, bMinLat, bMaxLng, bMaxLat] = bbox;
          minLng = Math.min(minLng, bMinLng);
          maxLng = Math.max(maxLng, bMaxLng);
          minLat = Math.min(minLat, bMinLat);
          maxLat = Math.max(maxLat, bMaxLat);
          hasValidBounds = true;
        }
      }
    }

    if (!hasValidBounds) {
      ref.current.flyTo({
        center: [136, 35],
        duration: 1000,
        zoom: 4.5,
        essential: true,
      });
      return;
    }

    let maxZoom = 10;
    if (epicenters.length === 1) {
      maxZoom = epicenters[0].depthval > 150 ? 5 : 7;
    } else if (epicenters.length > 1) {
      maxZoom = epicenters.some((epi) => epi.depthval > 150) ? 5 : 6;
    }

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

      ref.current.flyTo({
        center: [viewport.longitude, viewport.latitude],
        duration: 500,
        zoom: viewport.zoom,
        essential: true,
      });
      
      onAutoZoomChange?.(true);
    } catch (e) {
      console.error("Auto-zoom calculation failed:", e);
    }
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
      autoZoomTimeoutRef.current = window.setTimeout(() => {
        setHomePosition();
        setAutoZoomEnabled(true);
        onAutoZoomChange?.(true);
      }, 10000);
    }
  }, [enableDynamicZoom, onAutoZoomChange, setHomePosition]);

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
  }, []);

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
          className={isCancel ? "opacity-30" : "blink"}
          priority={true}
        />
      </Marker>
    ));
  }, [epicenters, isCancel]);

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
          onTimeUpdate={onTimeUpdate}
          isConnected={isConnected}
          nowAppTimeRef={nowAppTimeRef}
        />
      </Map>
    </div>
  );
});

MapComponent.displayName = "MapComponent";
export default React.memo(MapComponent);
