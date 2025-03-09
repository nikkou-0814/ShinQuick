"use client";

import React, { useEffect, useState, useRef } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import * as turf from "@turf/turf";
import { TravelTableRow, PsWaveProps } from "@/types/types";
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
  const updateIntervalRef = useRef<number | null>(null);
  const lastUpdateTime = useRef<number>(0);

  useEffect(() => {
    importTable()
      .then(table => {
        travelTableRef.current = table;
      })
      .catch(err => console.error("走時表の読み込み失敗", err));
  }, []);

  // 震源と波の位置を保持するためのキャッシュ
  const epicenterCacheRef = useRef<Map<string, {
    lat: number,
    lng: number,
    depthval: number,
    originTime: number
  }>>(new Map());

  const updatePendingRef = useRef(false);
  const lastCalculatedTimeRef = useRef<number>(0);
  const lastFeaturesRef = useRef<Feature<Polygon>[]>([]);
  const epicenterHashRef = useRef<string>("");

  useEffect(() => {
    if (!epicenters.length || !travelTableRef.current.length) {
      setCircleGeoJSON({ type: "FeatureCollection", features: [] });
      return;
    }

    // 震源情報をキャッシュに保存
    epicenters.forEach(epi => {
      const key = `${epi.eventId}`;
      epicenterCacheRef.current.set(key, {
        lat: epi.lat,
        lng: epi.lng,
        depthval: epi.depthval,
        originTime: epi.originTime
      });
    });

    // 震源情報のハッシュを計算して変更を検出
    const currentHash = JSON.stringify(epicenters.map(epi => ({
      eventId: epi.eventId,
      lat: epi.lat,
      lng: epi.lng,
      depthval: epi.depthval,
      originTime: epi.originTime
    })));

    if (currentHash !== epicenterHashRef.current) {
      epicenterHashRef.current = currentHash;
      if (updateIntervalRef.current !== null) {
        clearTimeout(updateIntervalRef.current);
      }
      updatePendingRef.current = true;
      requestAnimationFrame(() => {
        updateGeoJSON();
      });
    }

    // P/S波の位置を計算
    const calculateWavePositions = (currentTime: number): Feature<Polygon>[] => {
      const circleSteps = isMapMoving ? 16 : 48;
      const features: Feature<Polygon>[] = [];

      epicenters.forEach((epi) => {
        const elapsedTime = (currentTime - epi.originTime) / 1000;
        const [pDistance, sDistance] = getValue(travelTableRef.current, epi.depthval, elapsedTime);

        // P波の描画
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

        // S波の描画
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
    };

    // GeoJSONを更新
    const updateGeoJSON = () => {
      if (!epicenters.length || !travelTableRef.current.length || !nowAppTimeRef.current) {
        setCircleGeoJSON({ type: "FeatureCollection", features: [] });
        updatePendingRef.current = false;
        return;
      }
      const now = nowAppTimeRef.current;
      
      // マップ移動中は更新頻度を下げる
      if (isMapMoving) {
        if (now - lastUpdateTime.current < 100) {
          updateIntervalRef.current = window.setTimeout(updateGeoJSON, psWaveUpdateInterval);
          updatePendingRef.current = false;
          return;
        }
      } else {
        if (now - lastUpdateTime.current < psWaveUpdateInterval) {
          updateIntervalRef.current = window.setTimeout(updateGeoJSON, 
            psWaveUpdateInterval - (now - lastUpdateTime.current));
          updatePendingRef.current = false;
          return;
        }
      }
      
      lastUpdateTime.current = now;

      const shouldRecalculate = now - lastCalculatedTimeRef.current >= psWaveUpdateInterval;
      const features = shouldRecalculate 
        ? calculateWavePositions(now) 
        : lastFeaturesRef.current;
      
      if (shouldRecalculate) {
        lastCalculatedTimeRef.current = now;
        lastFeaturesRef.current = features;
      }

      requestAnimationFrame(() => {
        setCircleGeoJSON({ type: "FeatureCollection", features });
        // 次の更新をスケジュール
        updateIntervalRef.current = window.setTimeout(() => {
          updatePendingRef.current = true;
          updateGeoJSON();
        }, isMapMoving ? Math.max(psWaveUpdateInterval * 2, 100) : psWaveUpdateInterval);
      });
      
      updatePendingRef.current = false;
    };

    if (!updatePendingRef.current) {
      updatePendingRef.current = true;
      updateGeoJSON();
    }

    return () => {
      if (updateIntervalRef.current !== null) {
        clearTimeout(updateIntervalRef.current);
        updatePendingRef.current = false;
      }
    };
  }, [epicenters, psWaveUpdateInterval, nowAppTimeRef, isMapMoving]);

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
