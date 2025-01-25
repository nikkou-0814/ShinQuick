"use client";

import React, { forwardRef, useEffect, useCallback, useState } from "react";
import { MapContainer, GeoJSON, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from 'next-themes';

import { FeatureCollection } from "geojson";
import rawCountriesData from "../../public/mapdata/Countries.json";
import rawJapanData from "../../public/mapdata/Japan.json";
import rawSaibunData from "../../public/mapdata/Saibun.json";
import rawCitiesData from "../../public/mapdata/Cities.json";

const CountriesData = rawCountriesData as FeatureCollection;
const JapanData = rawJapanData as FeatureCollection;
const SaibunData = rawSaibunData as FeatureCollection;
const CitiesData = rawCitiesData as FeatureCollection;

if (typeof window !== "undefined") {
  L.Map.mergeOptions({
    smoothWheelZoom: true,
    smoothSensitivity: 5,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (L.Map as any).SmoothWheelZoom = L.Handler.extend({
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (L.Map as any).addInitHook("addHandler", "smoothWheelZoom", (L.Map as any).SmoothWheelZoom);
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
    (map.options as L.MapOptions & { smoothWheelZoom?: boolean | string }).smoothWheelZoom = true; // or "center"
    (map.options as L.MapOptions & { smoothWheelZoom?: boolean | string; smoothSensitivity?: number }).smoothSensitivity = 5;
  }, [map]);

  return null;
}

const Map = forwardRef<L.Map, { homePosition: { center: [number, number]; zoom: number } }>(({ homePosition }, ref) => {
  const [currentZoom, setCurrentZoom] = useState(4);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme || "system";

  const handleZoomChange = useCallback((zoom: number) => {
    setCurrentZoom(zoom);
  }, []);

  const shouldShowCities = currentZoom >= 10;
  const shouldShowSaibun = currentZoom >= 5;

  useEffect(() => {
    const mapElement = document.querySelector(".leaflet-container");
    if (mapElement) {
      (mapElement as HTMLElement).style.backgroundColor =
        theme === "dark" ? "#18181C" : "#AAD3DF";
    }
  }, [theme]);

  return (
    <MapContainer
      ref={ref}
      center={homePosition.center}
      zoom={homePosition.zoom}
      style={{ width: "100%", height: "100vh", zIndex: 0 }}
      scrollWheelZoom={false}
      preferCanvas
      zoomControl={false}
    >
      <MapInner onZoomChange={handleZoomChange} homePosition={homePosition} />

      {/* 世界 */}
      <GeoJSON
        data={CountriesData}
        style={{
          color: theme === "dark" ? "rgba(180,180,180,0.4)" : "rgba(80,80,80,0.4)",
          fillColor: theme === "dark" ? "#252525" : "#737A8A",
          fillOpacity: 0.6,
          weight: 0.8,
        }}
      />

      {/* 日本 */}
      <GeoJSON
        data={JapanData}
        style={{
          color: theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
          fillColor: theme === "dark" ? "#2C2C2C" : "#FFF",
          fillOpacity: 0.9,
          weight: 0.6,
        }}
      />

      {/* 細分 */}
      {shouldShowSaibun && (
        <GeoJSON
          data={SaibunData}
          style={{
            color: theme === "dark" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)",
            fillOpacity: 0,
            weight: 0.5,
          }}
        />
      )}

      {/* 市区町村 */}
      {shouldShowCities && (
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
  );
});

Map.displayName = "Map";

export default Map;
