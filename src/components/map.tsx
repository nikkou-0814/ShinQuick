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

import rawCountriesData10 from "../../public/mapdata/10mCountries.json";
import rawCountriesData50 from "../../public/mapdata/50mCountries.json";
import rawCountriesData110 from "../../public/mapdata/110mCountries.json";
import rawSaibunData from "../../public/mapdata/Saibun.json";
import rawCitiesData from "../../public/mapdata/Cities.json";

import KyoshinMonitor from "./maps/kyoshin-monitor";
import PsWave from "./maps/ps-wave";
import { MapProps } from "@/types/types";
import "maplibre-gl/dist/maplibre-gl.css";

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

const SaibunData = rawSaibunData as FeatureCollection;
const CitiesData = rawCitiesData as FeatureCollection;

interface SaibunFeatureWithBbox {
  feature: Feature;
  bbox: [number, number, number, number];
}

const MapComponent = React.forwardRef<MapRef, MapProps>((props, ref) => {
  const {
    homePosition,
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

  const countriesData = useMemo(() => {
    if (mapResolution === "10m") {
      return {
        type: "FeatureCollection" as const,
        features: (rawCountriesData10 as { geometries: GeoJSON.Geometry[] }).geometries.map(
          (geometry: GeoJSON.Geometry) => ({
            type: "Feature" as const,
            geometry,
            properties: {},
          })
        ),
      };
    } else if (mapResolution === "50m") {
      return rawCountriesData50 as unknown as FeatureCollection;
    } else {
      return rawCountriesData110 as unknown as FeatureCollection;
    }
  }, [mapResolution]);

  // 細分化区画のバウンディングボックスをあらかじめ計算
  const saibunFeaturesWithBbox = useMemo<SaibunFeatureWithBbox[]>(() => {
    const data: FeatureCollection = JSON.parse(JSON.stringify(SaibunData));

    return data.features
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
  }, []);

  // 細分化区画の塗りつぶし色などをプロパティに仕込む
  const processedSaibunData = useMemo(() => {
    const clonedFeatures: Feature[] = saibunFeaturesWithBbox.map(({ feature }) => {
      const cloned = JSON.parse(JSON.stringify(feature)) as Feature;
      const fProps: any = cloned.properties || {};
      const code = fProps.code;
      // デフォルト
      let fillColor = theme === "dark" ? "#2C2C2C" : "#FFF";
      let fillOpacity = 0.9;

      if (code) {
        // 警報領域
        if (enableMapWarningArea && warningRegionCodes.includes(String(code))) {
          fillColor = "#FF0000";
          fillOpacity = 0.9;
        }
        // 震度塗りつぶし
        else if (enableMapIntensityFill) {
          const intensity = regionIntensityMap[String(code)];
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

    const featureCollection: FeatureCollection = {
      type: "FeatureCollection",
      features: clonedFeatures,
    };
    return featureCollection;
  }, [
    theme,
    enableMapWarningArea,
    warningRegionCodes,
    enableMapIntensityFill,
    regionIntensityMap,
    saibunFeaturesWithBbox
  ]);

  const [viewState, setViewState] = useState({
    longitude: homePosition.center[1],
    latitude: homePosition.center[0],
    zoom: homePosition.zoom,
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

  // 自動ズーム処理
  useEffect(() => {
    if (!enableDynamicZoom || !autoZoomEnabled) return;

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    epicenters.forEach((epi) => {
      if (epi && typeof epi.lat === "number" && typeof epi.lng === "number") {
        const lat = epi.lat;
        const lng = epi.lng;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    });

    saibunFeaturesWithBbox.forEach(({ bbox, feature }) => {
      const code = feature.properties?.code;
      if (code && regionIntensityMap[String(code)] !== undefined) {
        const [bMinLng, bMinLat, bMaxLng, bMaxLat] = bbox;
        if (bMinLng < minLng) minLng = bMinLng;
        if (bMaxLng > maxLng) maxLng = bMaxLng;
        if (bMinLat < minLat) minLat = bMinLat;
        if (bMaxLat > maxLat) maxLat = bMaxLat;
      }
    });

    if (minLng > maxLng || minLat > maxLat) {
      if (ref && 'current' in ref && ref.current) {
        ref.current.flyTo({
          center: [136, 35],
          duration: 1000,
          zoom: 4.5,
          essential: true,
        });
      }
      return;
    }

    let maxZoom = 10;
    if (epicenters.length === 1) {
      maxZoom = epicenters[0].depthval > 150 ? 5 : 7;
    } else if (epicenters.length > 1) {
      maxZoom = epicenters.some((epi) => epi.depthval > 150) ? 5 : 9;
    }

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

    if (ref && 'current' in ref && ref.current) {
      ref.current.flyTo({
      center: [viewport.longitude, viewport.latitude],
      duration: 500,
      zoom: viewport.zoom,
      essential: true,
    })};
    onAutoZoomChange?.(true);
  }, [
    epicenters,
    regionIntensityMap,
    autoZoomEnabled,
    enableDynamicZoom,
    onAutoZoomChange,
    saibunFeaturesWithBbox,
    ref,
  ]);

  const autoZoomTimeoutRef = useRef<number | null>(null);

  const handleUserInteractionStart = useCallback(() => {
    if (autoZoomTimeoutRef.current) {
      clearTimeout(autoZoomTimeoutRef.current);
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
        setAutoZoomEnabled(true);
        onAutoZoomChange?.(true);
      }, 10000);
    }
  }, [enableDynamicZoom, onAutoZoomChange]);

  const onMove = (evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);
  };

  // マップのロード完了
  const onMapLoadHandler = useCallback(() => {
    if (enableKyoshinMonitor)
      if (ref && 'current' in ref && ref.current) {
        ref.current.moveLayer("site-layer");
        ref.current.moveLayer("pWave-layer");
        ref.current.moveLayer("sWave-layer");
      }
    onMapLoad?.();
  }, [onMapLoad]);  

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        backgroundColor: theme === "dark" ? "#18181C" : "#AAD3DF",
        overflow: "hidden",
      }}
    >
      <Map
        ref={ref as RefObject<MapRef>}
        {...viewState}
        mapLib={maplibregl}
        onMove={onMove}
        onMoveStart={handleUserInteractionStart}
        onMoveEnd={handleUserInteractionEnd}
        onLoad={onMapLoadHandler}
      >
        <Source id="countries" type="geojson" data={countriesData}>
          <Layer
            id="countries-fill"
            type="fill"
            paint={{
              "fill-color": theme === "dark" ? "#252525" : "#737A8A",
              "fill-opacity": 0.6,
            }}
          />
          <Layer
            id="countries-outline"
            type="line"
            paint={{
              "line-color": theme === "dark" ? "rgba(180,180,180,0.4)" : "rgba(80,80,80,0.4)",
              "line-width": 0.8,
            }}
          />
        </Source>

        <Source id="saibun" type="geojson" data={processedSaibunData}>
          <Layer
            id="saibun-layer"
            type="fill"
            paint={{
              "fill-color": ["get", "computedFillColor"],
              "fill-opacity": ["get", "computedFillOpacity"],
              "fill-outline-color":
                theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
            }}
          />
        </Source>

        <Source id="cities" type="geojson" data={CitiesData}>
          <Layer
            id="cities-layer"
            type="line"
            minzoom={9}
            paint={{
              "line-color": theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
              "line-width": theme === "dark" ? 0.3 : 0.4,
            }}
          />
        </Source>

        {epicenters.map((epi, index) => (
          <Marker
            key={`epi-${index}`}
            longitude={epi.lng}
            latitude={epi.lat}
            anchor="center"
          >
            <img
              src={epi.icon}
              alt="epicenter"
              style={{ width: 48, height: 48 }}
              className={isCancel ? "opacity-30" : "blink"}
            />
          </Marker>
        ))}

        <PsWave
          epicenters={epicenters}
          psWaveUpdateInterval={psWaveUpdateInterval}
          isCancel={isCancel}
          nowAppTimeRef={nowAppTimeRef}
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
