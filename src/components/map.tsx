"use client";

import React, { forwardRef, useEffect, useCallback, useState, useRef } from "react";
import { MapContainer, GeoJSON, useMapEvents, useMap } from "react-leaflet";
import L, { LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import { FeatureCollection } from "geojson";
import rawCountriesData10 from "../../public/mapdata/10mCountries.json";
import rawCountriesData50 from "../../public/mapdata/50mCountries.json";
import rawCountriesData110 from "../../public/mapdata/110mCountries.json";
import rawSaibunData from "../../public/mapdata/Saibun.json";
import rawCitiesData from "../../public/mapdata/Cities.json";
import KyoshinMonitor from "./maps/kyoshin-monitor";
import PsWave from "./maps/ps-wave";
import { MapProps } from "@/types/types";

// SmoothWheelZoom
if (typeof window !== "undefined") {
  (L.Map as typeof L.Map & { SmoothWheelZoom?: unknown }).mergeOptions({
    smoothWheelZoom: true,
    smoothSensitivity: 5,
  });

  (L.Map as typeof L.Map & { SmoothWheelZoom?: unknown }).SmoothWheelZoom = L.Handler.extend({
    addHooks: function () {
      L.DomEvent.on(this._map._container, "wheel", this._onWheelScroll, this);
    },
    removeHooks: function () {
      L.DomEvent.off(this._map._container, "wheel", this._onWheelScroll, this);
    },
    _onWheelScroll: function (e: WheelEvent) {
      if (!this._isWheeling) {
        this._onWheelStart(e);
      }
      this._onWheeling(e);
    },
    _onWheelStart: function (e: WheelEvent) {
      const map = this._map;
      this._isWheeling = true;
      this._wheelMousePosition = map.mouseEventToContainerPoint(e);
      this._centerPoint = map.getSize()._divideBy(2);
      this._startLatLng = map.containerPointToLatLng(this._centerPoint);
      this._wheelStartLatLng = map.containerPointToLatLng(this._wheelMousePosition);
      this._startZoom = map.getZoom();
      this._moved = false;
      this._zooming = true;

      map._stop();
      if (map._panAnim) {
        map._panAnim.stop();
      }

      this._goalZoom = map.getZoom();
      this._prevCenter = map.getCenter();
      this._prevZoom = map.getZoom();

      this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this));
    },
    _onWheeling: function (e: WheelEvent) {
      const map = this._map;
      this._goalZoom =
        this._goalZoom +
        L.DomEvent.getWheelDelta(e) * 0.003 * map.options.smoothSensitivity;

      if (this._goalZoom < map.getMinZoom() || this._goalZoom > map.getMaxZoom()) {
        this._goalZoom = map._limitZoom(this._goalZoom);
      }
      this._wheelMousePosition = map.mouseEventToContainerPoint(e);

      clearTimeout(this._timeoutId);
      this._timeoutId = setTimeout(this._onWheelEnd.bind(this), 200);

      L.DomEvent.preventDefault(e);
      L.DomEvent.stopPropagation(e);
    },
    _onWheelEnd: function () {
      this._isWheeling = false;
      cancelAnimationFrame(this._zoomAnimationId);
      this._map._moveEnd(true);
    },
    _updateWheelZoom: function () {
      const map = this._map;
      if (!map.getCenter().equals(this._prevCenter) || map.getZoom() !== this._prevZoom) {
        return;
      }

      this._zoom = map.getZoom() + (this._goalZoom - map.getZoom()) * 0.3;
      this._zoom = Math.floor(this._zoom * 100) / 100;

      const delta = this._wheelMousePosition.subtract(this._centerPoint);
      if (delta.x === 0 && delta.y === 0) return;

      if (map.options.smoothWheelZoom === "center") {
        this._center = this._startLatLng;
      } else {
        this._center = map.unproject(
          map.project(this._wheelStartLatLng, this._zoom).subtract(delta),
          this._zoom
        );
      }

      if (!this._moved) {
        map._moveStart(true, false);
        this._moved = true;
      }

      map._move(this._center, this._zoom);
      this._prevCenter = map.getCenter();
      this._prevZoom = map.getZoom();

      this._zoomAnimationId = requestAnimationFrame(this._updateWheelZoom.bind(this));
    },
  });

  (L.Map as typeof L.Map & { SmoothWheelZoom?: unknown }).addInitHook(
    "addHandler",
    "smoothWheelZoom",
    (L.Map as typeof L.Map & { SmoothWheelZoom?: unknown }).SmoothWheelZoom
  );
}

const SaibunData = rawSaibunData as FeatureCollection;
const CitiesData = rawCitiesData as FeatureCollection;

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

function UserInteractionDetector({
  onUserInteractionStart,
  onUserInteractionEnd,
}: {
  onUserInteractionStart: () => void;
  onUserInteractionEnd: () => void;
}) {
  useMapEvents({
    dragstart: onUserInteractionStart,
    zoomstart: onUserInteractionStart,
    dragend: onUserInteractionEnd,
    zoomend: onUserInteractionEnd,
  });
  return null;
}

function MapInner({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
  homePosition: { center: [number, number]; zoom: number };
}): null {
  const map = useMap();
  useMapEvents({
    zoomend: (e) => {
      onZoomChange(e.target.getZoom());
    },
  });
  useEffect(() => {
    if (!map) return;
    map.options.scrollWheelZoom = false;
    (map.options as L.MapOptions & { smoothWheelZoom?: boolean }).smoothWheelZoom = true;
    (map.options as L.MapOptions & { smoothSensitivity?: number }).smoothSensitivity = 5;
  }, [map]);
  return null;
}

function CreatePsWavePane() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane("psWavePane")) {
      map.createPane("psWavePane");
      map.getPane("psWavePane")!.style.zIndex = "1000";
    }
  }, [map]);
  return null;
}

const Map = forwardRef<L.Map, MapProps>(
  (
    {
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
      nowAppTime,
      onMapLoad,
    },
    ref
  ) => {
    const [currentZoom, setCurrentZoom] = useState(homePosition.zoom);
    const { resolvedTheme } = useTheme();
    const theme = resolvedTheme || "light";
    const epicenterLayerRef = useRef<LayerGroup | null>(null);

    const countriesData =
      mapResolution === "10m"
        ? {
            type: "FeatureCollection" as const,
            features: (rawCountriesData10 as { geometries: GeoJSON.Geometry[] }).geometries.map(
              (geometry: GeoJSON.Geometry) => ({
                type: "Feature",
                geometry,
                properties: {},
              })
            ),
          }
        : mapResolution === "50m"
        ? (rawCountriesData50 as unknown as FeatureCollection)
        : (rawCountriesData110 as unknown as FeatureCollection);

    const [autoZoomEnabled, setAutoZoomEnabled] = useState(
      enableDynamicZoom ? mapAutoZoom : false
    );
    const autoZoomTimeoutRef = useRef<number | null>(null);
    const [, setMapLoaded] = useState(false);

    useEffect(() => {
      if (!enableDynamicZoom) {
        setAutoZoomEnabled(false);
      } else {
        setAutoZoomEnabled(mapAutoZoom);
      }
    }, [enableDynamicZoom, mapAutoZoom]);

    useEffect(() => {
      const mapInstance = (ref as React.RefObject<L.Map | null>).current;
      if (!mapInstance) return;
      if (!mapInstance.getPane("psWavePane")) {
        mapInstance.createPane("psWavePane");
        mapInstance.getPane("psWavePane")!.style.zIndex = "1000";
      }
    }, [ref]);

    useEffect(() => {
      if (forceAutoZoomTrigger && enableDynamicZoom) {
        setAutoZoomEnabled(true);
        onAutoZoomChange?.(true);
      }
    }, [forceAutoZoomTrigger, onAutoZoomChange, enableDynamicZoom]);

    useEffect(() => {
      return () => {
        if (autoZoomTimeoutRef.current) clearTimeout(autoZoomTimeoutRef.current);
      };
    }, []);

    useEffect(() => {
      onAutoZoomChange?.(autoZoomEnabled);
    }, [autoZoomEnabled, onAutoZoomChange]);

    const handleUserInteractionStart = useCallback(() => {
      if (autoZoomTimeoutRef.current) clearTimeout(autoZoomTimeoutRef.current);
      if (enableDynamicZoom) setAutoZoomEnabled(false);
    }, [enableDynamicZoom]);

    const handleUserInteractionEnd = useCallback(() => {
      if (autoZoomTimeoutRef.current) clearTimeout(autoZoomTimeoutRef.current);
      if (enableDynamicZoom) {
        autoZoomTimeoutRef.current = window.setTimeout(() => {
          setAutoZoomEnabled(true);
          onAutoZoomChange?.(true);
        }, 10000);
      }
    }, [enableDynamicZoom, onAutoZoomChange]);

    useEffect(() => {
      if (typeof window !== "undefined") {
        const mapElement = document.querySelector(".leaflet-container");
        if (mapElement) {
          (mapElement as HTMLElement).style.backgroundColor =
            theme === "dark" ? "#18181C" : "#AAD3DF";
        }
      }
    }, [theme]);

    // 震源マーカー描画 + 自動ズーム処理
    useEffect(() => {
      if (!ref || !(ref as React.RefObject<L.Map | null>).current) return;
      const mapInstance = (ref as React.RefObject<L.Map | null>).current;
      if (!epicenterLayerRef.current && mapInstance) {
        epicenterLayerRef.current = L.layerGroup().addTo(mapInstance);
      }
      epicenterLayerRef.current?.clearLayers();
      epicenters.forEach((epi) => {
        const iconObj = L.icon({
          iconUrl: epi.icon,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          className: isCancel ? "opacity-30" : "blink",
        });
        const marker = L.marker([epi.lat, epi.lng], { icon: iconObj });
        epicenterLayerRef.current?.addLayer(marker);
      });
      if (enableDynamicZoom && autoZoomEnabled) {
        const latlngs = epicenters.map((epi) => [epi.lat, epi.lng]) as [number, number][];
        const polygonsBounds = L.latLngBounds([]);
        SaibunData.features.forEach((feature) => {
          const code = feature.properties?.code;
          if (!code) return;
          if (!(code in regionIntensityMap)) return;
          const layer = L.geoJSON(feature as GeoJSON.GeoJsonObject);
          const layerBounds = layer.getBounds();
          polygonsBounds.extend(layerBounds);
        });
        const finalBounds = L.latLngBounds(latlngs);
        finalBounds.extend(polygonsBounds);
        if (epicenters.length === 1) {
          const zoom = epicenters[0].depthval > 150 ? 5 : 7;
          if (finalBounds.isValid()) {
            mapInstance?.fitBounds(finalBounds, { maxZoom: zoom, padding: [50, 50] });
          } else {
            // 細分区の指定がないケース
            mapInstance?.setView([epicenters[0].lat, epicenters[0].lng], zoom);
          }
        } else if (epicenters.length > 1) {
          // 震源が複数
          const maxZoom = epicenters.some((epi) => epi.depthval > 150) ? 5 : 9;
          if (finalBounds.isValid()) {
            mapInstance?.fitBounds(finalBounds, { padding: [50, 50], maxZoom });
          } else {
            // 細分区 + 震源なし等の想定がある場合
            mapInstance?.setView([35, 136], 5);
          }
        } else {
          // 震源が空の場合でも、細分区にズーム
          if (polygonsBounds.isValid()) {
            mapInstance?.fitBounds(polygonsBounds, { padding: [50, 50], maxZoom: 10 });
          } else {
            mapInstance?.setView([35, 136], 5);
          }
        }
      }
    }, [epicenters, ref, autoZoomEnabled, enableDynamicZoom, regionIntensityMap, isCancel]);

    return (
      <div style={{ position: "relative", width: "100%", height: "100vh" }}>
        <MapContainer
          ref={ref as React.RefObject<L.Map | null>}
          center={homePosition.center}
          zoom={homePosition.zoom}
          style={{ width: "100%", height: "100vh", zIndex: 0 }}
          scrollWheelZoom={false}
          preferCanvas
          zoomControl={false}
          whenReady={() => {
            setMapLoaded(true);
            if (typeof onMapLoad === 'function') {
              onMapLoad();
            }
          }}
        >
          <CreatePsWavePane />
          <UserInteractionDetector
            onUserInteractionStart={handleUserInteractionStart}
            onUserInteractionEnd={handleUserInteractionEnd}
          />
          <MapInner onZoomChange={setCurrentZoom} homePosition={homePosition} />
          <KyoshinMonitor
            enableKyoshinMonitor={enableKyoshinMonitor}
            onTimeUpdate={onTimeUpdate}
            isConnected={isConnected}
            nowAppTime={nowAppTime}
          />
          <PsWave
            epicenters={epicenters}
            psWaveUpdateInterval={psWaveUpdateInterval}
            isCancel={isCancel}
            ref={ref as React.RefObject<L.Map | null>}
            nowAppTime={nowAppTime}
          />
          <GeoJSON
            key={`worldMap-${mapResolution}`}
            data={countriesData}
            style={{
              color: theme === "dark" ? "rgba(180,180,180,0.4)" : "rgba(80,80,80,0.4)",
              fillColor: theme === "dark" ? "#252525" : "#737A8A",
              fillOpacity: 0.6,
              weight: 0.8,
            }}
          />
          <GeoJSON
            data={SaibunData}
            style={(feature) => {
              const defaultStyle = {
                color: theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
                weight: 0.6,
                fillColor: theme === "dark" ? "#2C2C2C" : "#FFF",
                fillOpacity: 0.9,
              };
              if (enableMapWarningArea && feature?.properties?.code) {
                if (warningRegionCodes.includes(String(feature.properties.code))) {
                  return { ...defaultStyle, fillColor: "#FF0000", fillOpacity: 0.9 };
                }
              }
              if (!enableMapIntensityFill) return defaultStyle;
              if (!feature?.properties?.code) return defaultStyle;
              const regionCode = String(feature.properties.code);
              const intensity = regionIntensityMap[regionCode];
              if (!intensity) return defaultStyle;
              const fillColor = intensityFillColors[intensity] || "#62626B";
              return { ...defaultStyle, fillColor, fillOpacity: 1 };
            }}
          />
          {currentZoom >= 10 && (
            <GeoJSON
              data={CitiesData}
              style={{
                color: theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
                fillOpacity: 0,
                weight: theme === "dark" ? 0.3 : 0.4,
              }}
            />
          )}
        </MapContainer>
      </div>
    );
  }
);

Map.displayName = "Map";
export default Map;
