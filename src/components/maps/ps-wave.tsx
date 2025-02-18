"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";

type EpicenterInfo = {
  eventId: string;
  lat: number;
  lng: number;
  icon: string;
  startTime?: number;
  originTime: number;
  depthval: number;
};

type TravelTableRow = {
  p: number;
  s: number;
  depth: number;
  distance: number;
};

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

function getValue(
  table: TravelTableRow[],
  depth: number,
  time: number
): [number, number] {
  if (depth > 700 || time > 2000) {
    console.log("しきい値超え", { depth, time });
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

function PsWave({
  epicenters,
  psWaveUpdateInterval,
  ref,
}: {
  epicenters: EpicenterInfo[];
  psWaveUpdateInterval: number;
  isCancel: boolean;
  ref: React.MutableRefObject<L.Map | null> | null;
}) {
  const waveCirclesLayerRef = useRef<L.LayerGroup | null>(null);
  const travelTableRef = useRef<TravelTableRow[]>([]);

  // 走時表の読み込み
  useEffect(() => {
    importTable()
      .then(table => {
        travelTableRef.current = table;
      })
      .catch(err => console.error("走時表の読み込み失敗", err));
  }, []);

  // 円を定期的に描画更新
  useEffect(() => {
    if (!ref || !ref.current) return;
    const mapInstance = ref.current;

    if (!waveCirclesLayerRef.current) {
      waveCirclesLayerRef.current = L.layerGroup().addTo(mapInstance);
    }

    const intervalId = setInterval(() => {
      if (!travelTableRef.current.length || !epicenters.length) {
        waveCirclesLayerRef.current?.clearLayers();
        return;
      }

      waveCirclesLayerRef.current?.clearLayers();

      epicenters.forEach((epi) => {
        const elapsedTime = (Date.now() - epi.originTime) / 1000;
        const [pDistance, sDistance] = getValue(
          travelTableRef.current,
          epi.depthval,
          elapsedTime
        );

        // P波
        if (!isNaN(pDistance)) {
          L.circle([epi.lat, epi.lng], {
            radius: pDistance * 1000,
            color: "#0000ff",
            weight: 3,
            opacity: 1,
            fillOpacity: 0,
            pane: "psWavePane",
          }).addTo(waveCirclesLayerRef.current!);
        }

        // S波
        if (!isNaN(sDistance)) {
          L.circle([epi.lat, epi.lng], {
            radius: sDistance * 1000,
            color: "#ff0000",
            weight: 6,
            opacity: 1,
            fillColor: "#ff0000",
            fillOpacity: 0.2,
            pane: "psWavePane",
          }).addTo(waveCirclesLayerRef.current!);
        }
      });
    }, psWaveUpdateInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [epicenters, psWaveUpdateInterval, ref]);

  return null;
}

export default PsWave;
