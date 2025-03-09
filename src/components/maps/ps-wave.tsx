"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import * as turf from "@turf/turf";
import { TravelTableRow, PsWaveProps, EpicenterInfo } from "@/types/types";
import { Feature, FeatureCollection, Polygon } from "geojson";

// 走時表の読み込み
async function importTable(): Promise<TravelTableRow[]> {
  const res = await fetch("/tjma2001.txt");
  const text = await res.text();
  const lines = text.trim().split("\n").map(line => line.trim().replace(/\s+/g, " "));
  return lines.map(line => {
    const s = line.split(" ");
    return {
      p: parseFloat(s[1]),
      s: parseFloat(s[3]),
      depth: parseInt(s[4], 10),
      distance: parseInt(s[5], 10),
    };
  });
}

// 走時表から現在時刻に基づいてP波・S波の伝播距離を計算
function getValue(
  table: TravelTableRow[],
  depth: number,
  time: number
): [number, number] {
  if (depth > 700 || time > 2000) {
    return [NaN, NaN];
  }

  const values = table.filter(x => x.depth === depth);
  if (values.length === 0) {
    console.log("該当するレコードがありません");
    return [NaN, NaN];
  }

  // P波
  const pCandidatesBefore = values.filter(x => x.p <= time);
  const pCandidatesAfter = values.filter(x => x.p >= time);
  const p1 = pCandidatesBefore[pCandidatesBefore.length - 1];
  const p2 = pCandidatesAfter[0];
  if (!p1 || !p2) {
    return [NaN, NaN];
  }
  const pDistance = ((time - p1.p) / (p2.p - p1.p)) * (p2.distance - p1.distance) + p1.distance;

  // S波
  const sCandidatesBefore = values.filter(x => x.s <= time);
  const sCandidatesAfter = values.filter(x => x.s >= time);
  const s1 = sCandidatesBefore[sCandidatesBefore.length - 1];
  const s2 = sCandidatesAfter[0];
  if (!s1 || !s2) {
    return [pDistance, NaN];
  }
  const sDistance = ((time - s1.s) / (s2.s - s1.s)) * (s2.distance - s1.distance) + s1.distance;

  return [pDistance, sDistance];
}

interface ModifiedPsWaveProps extends Omit<PsWaveProps, "nowAppTime"> {
  nowAppTimeRef: React.RefObject<number>;
  isMapMoving?: boolean;
}

const PsWave: React.FC<ModifiedPsWaveProps> = ({ 
  epicenters, 
  psWaveUpdateInterval, 
  nowAppTimeRef,
  isMapMoving = false,
}) => {
  const [circleGeoJSON, setCircleGeoJSON] = useState<FeatureCollection<Polygon>>({
    type: "FeatureCollection",
    features: [],
  });
  const travelTableRef = useRef<TravelTableRow[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const epicenterHashRef = useRef<string>("");
  const isUpdatingRef = useRef<boolean>(false);

  useEffect(() => {
    importTable()
      .then(table => {
        travelTableRef.current = table;
      })
      .catch(err => console.error("走時表の読み込み失敗", err));
    
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  // P/S波の位置を計算
  const calculateWavePositions = useCallback((
    currentTime: number, 
    epicentersList: EpicenterInfo[], 
    travelTable: TravelTableRow[],
    mapMoving: boolean
  ): Feature<Polygon>[] => {
    const circleSteps = mapMoving ? 24 : 48;
    const features: Feature<Polygon>[] = [];

    epicentersList.forEach((epi) => {
      const elapsedTime = (currentTime - epi.originTime) / 1000;
      const [pDistance, sDistance] = getValue(travelTable, epi.depthval, elapsedTime);

      // P波
      if (!isNaN(pDistance)) {
        const pCircle: Feature<Polygon> = turf.circle(
          [epi.lng, epi.lat],
          pDistance,
          { steps: circleSteps, units: "kilometers" }
        ) as Feature<Polygon>;
        pCircle.properties = { 
          color: "#0000ff", 
          type: "pWave",
          eventId: epi.eventId
        };
        features.push(pCircle);
      }

      // S波
      if (!isNaN(sDistance)) {
        const sCircle: Feature<Polygon> = turf.circle(
          [epi.lng, epi.lat],
          sDistance,
          { steps: circleSteps, units: "kilometers" }
        ) as Feature<Polygon>;
        sCircle.properties = { 
          color: "#ff0000", 
          fillOpacity: 0.2, 
          type: "sWave",
          eventId: epi.eventId
        };
        features.push(sCircle);
      }
    });

    return features;
  }, []);

  // GeoJSONを更新
  const updateGeoJSON = useCallback(() => {
    try {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      if (!epicenters.length || !travelTableRef.current.length || !nowAppTimeRef.current) {
        setCircleGeoJSON({ type: "FeatureCollection", features: [] });
        isUpdatingRef.current = false;
        return;
      }

      const now = nowAppTimeRef.current;
      const features = calculateWavePositions(
        now, 
        epicenters, 
        travelTableRef.current,
        isMapMoving
      );

      setCircleGeoJSON({ type: "FeatureCollection", features });
      lastUpdateTimeRef.current = now;

      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);

      const updateInterval = isMapMoving 
        ? Math.max(psWaveUpdateInterval * 1.5, 100) 
        : psWaveUpdateInterval;

      timeoutIdRef.current = window.setTimeout(() => {
        isUpdatingRef.current = false;
        updateGeoJSON();
      }, updateInterval);
    } catch (error) {
      console.error("P/S波の更新中にエラーが発生しました:", error);
      isUpdatingRef.current = false;
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = window.setTimeout(() => {
        updateGeoJSON();
      }, psWaveUpdateInterval);
    }
  }, [epicenters, psWaveUpdateInterval, nowAppTimeRef, isMapMoving, calculateWavePositions]);

  useEffect(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    if (!epicenters.length || !travelTableRef.current.length) {
      setCircleGeoJSON({ type: "FeatureCollection", features: [] });
      return;
    }

    isUpdatingRef.current = false;

    updateGeoJSON();

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [epicenters, psWaveUpdateInterval, isMapMoving, updateGeoJSON]);

  return (
    <Source id="psWaveSource" type="geojson" data={circleGeoJSON}>
      <Layer
        id="pWave-layer"
        type="line"
        paint={{
          "line-color": "#0000ff",
          "line-width": 2,
        }}
        filter={["==", ["get", "type"], "pWave"]}
      />
      <Layer
        id="sWave-layer"
        type="fill"
        paint={{
          "fill-color": "#ff0000",
          "fill-opacity": 0.2,
          "fill-outline-color": "#ff0000",
        }}
        filter={["==", ["get", "type"], "sWave"]}
      />
    </Source>
  );
};

export default React.memo(PsWave);
