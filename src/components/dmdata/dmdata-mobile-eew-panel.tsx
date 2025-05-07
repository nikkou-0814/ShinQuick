"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { EewInformation } from "@dmdata/telegram-json-types";
import { AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EewDisplayProps } from "@/types/types";

export const DMDATAMobileEewPanel: React.FC<EewDisplayProps> = ({
  parsedData,
  isLowAccuracy = false,
  onEpicenterUpdate,
  onRegionIntensityUpdate,
  onWarningRegionUpdate,
}) => {
  const prevWarningRegionsRef = useRef<{ code: string; name: string }[]>([]);

  useEffect(() => {
    if (!parsedData || !onWarningRegionUpdate) return;
  
    const { body } = parsedData;
    if (!("regions" in body)) {
      return;
    }
  
    const regions = body.regions as { code: string; name: string }[];
  
    if (!Array.isArray(regions) || regions.length === 0) {
      return;
    }
  
    if (JSON.stringify(prevWarningRegionsRef.current) !== JSON.stringify(regions)) {
      onWarningRegionUpdate(regions);
      prevWarningRegionsRef.current = [...regions];
    }
  }, [parsedData, onWarningRegionUpdate, prevWarningRegionsRef]);

  const getJstTime = useCallback((timestamp: string | undefined): Date | null => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp);
    } catch {
      return null;
    }
  }, []);

  let originDt: Date | null = null;
  if (parsedData) {
    const { body } = parsedData;
    const { originTime, arrivalTime } = (body as EewInformation.Latest.PublicCommonBody).earthquake || {};
    if (originTime) {
      originDt = getJstTime(originTime);
    } else if (arrivalTime) {
      originDt = getJstTime(arrivalTime);
    } else {
      originDt = new Date();
    }
  }

  useEffect(() => {
    if (!parsedData || !onEpicenterUpdate) return;
  
    const { eventId = "", serialNo = "", body } = parsedData;
    const { isCanceled = false } = body;
  
    if (!("earthquake" in body)) return;
  
    const { earthquake } = body;
    const { hypocenter } = earthquake;
    const { coordinate, accuracy: hypocenterAccuracy } = hypocenter;

    const method = (() => {
      const condition = earthquake.condition || "不明";
      const accuracyEpicenters = hypocenterAccuracy?.epicenters || [];
  
      if (condition === "仮定震源要素") {
        return "PLUM法";
      } else if (accuracyEpicenters.length > 0) {
        const epicVal = accuracyEpicenters[0];
        const epicValInt = parseInt(epicVal, 10);
  
        if (epicValInt === 1) {
          return earthquake.originTime ? "IPF法 (1点)" : "レベル法";
        } else if (epicValInt === 2) {
          return "IPF法 (2点)";
        } else if (epicValInt === 3 || epicValInt === 4) {
          return "IPF法 (3点以上)";
        } else {
          return earthquake.originTime ? "不明" : "レベル法";
        }
      } else {
        return earthquake.originTime ? "不明" : "レベル法";
      }
    })();
  
    const icon =
      method === "PLUM法" || method === "レベル法"
        ? "/assumed.png"
        : "/shingen.png";

    let quakeOriginTime = 0;
    if (earthquake.originTime) {
      const dt = getJstTime(earthquake.originTime);
      quakeOriginTime = dt ? dt.getTime() : Date.now();
    } else if (earthquake.arrivalTime) {
      const dt = getJstTime(earthquake.arrivalTime);
      quakeOriginTime = dt ? dt.getTime() : Date.now();
    } else {
      quakeOriginTime = Date.now();
    }

    if (
      isCanceled ||
      !coordinate?.latitude?.value ||
      !coordinate.longitude?.value ||
      !hypocenter.depth?.value
    )
      return;

    const isLowAccuracyMethod =
      method === "PLUM法" || method === "レベル法" || method === "IPF法 (1点)";

    if (!isLowAccuracy && isLowAccuracyMethod) {
      return;
    }

    const latVal = Number(coordinate.latitude.value);
    const lngVal = Number(coordinate.longitude.value);
    const depthVal = Number(hypocenter.depth.value);
  
    if (isNaN(latVal) || isNaN(lngVal) || isNaN(depthVal)) return;
  
    const epicenterData = {
      eventId,
      serialNo,
      lat: latVal,
      lng: lngVal,
      icon,
      depthval: depthVal,
      originTime: quakeOriginTime,
      isCancel: parsedData.body?.isCanceled || false,
    };
    
    onEpicenterUpdate(epicenterData);
  }, [parsedData, onEpicenterUpdate, isLowAccuracy, getJstTime]);

  useEffect(() => {
    if (!parsedData || !onRegionIntensityUpdate) return;
    const { body } = parsedData;
    if (body.isCanceled) {
      onRegionIntensityUpdate({});
      return;
    }
    if (!("intensity" in body)) {
      onRegionIntensityUpdate({});
      return;
    }
    const intensityData = (body as EewInformation.Latest.PublicCommonBody).intensity;
    if (!intensityData || !intensityData.regions) {
      onRegionIntensityUpdate({});
      return;
    }
    
    const newMap: Record<string, string> = {};
    
    intensityData.regions.forEach((region) => {
      const code = region.code;
      if (!region.forecastMaxInt) return;
      const { from = "不明", to = "不明" } = region.forecastMaxInt;
      let final = to;
      if (to === "over") {
        final = from;
      }
      newMap[code] = final;
    });

    onRegionIntensityUpdate({...newMap});
  }, [parsedData, onRegionIntensityUpdate]);

  if (!parsedData) {
    return null;
  }

  const {
    serialNo = "",
    status = "",
    body,
  } = parsedData;

  const {
    isCanceled = false,
    isLastInfo = false,
    isWarning = false,
    earthquake,
    intensity,
  } = body as EewInformation.Latest.PublicCommonBody;

  const {
    originTime,
    condition: earthquakeCondition,
    hypocenter,
    magnitude,
  } = earthquake ?? {};

  const {
    name: hypName = "不明",
    depth: hypocenterDepth,
    accuracy: hypocenterAccuracy,
  } = hypocenter ?? {};

  const depthValue = hypocenterDepth?.value || "不明";
  const magnitudeValue = magnitude?.value || "不明";
  const magnitudeCondition = magnitude?.condition || "";

  const magnitudeDisplay =
    magnitudeValue !== "不明" ? `${magnitudeValue}` : magnitudeCondition || "不明";

  const forecastMaxInt = intensity?.forecastMaxInt;
  let isThreshold = false;

  const convertIntensity = (
    value: EewInformation.Latest.IntensityClass | "over" | "不明",
    isFrom: boolean = false
  ): string => {
    const mapping: Record<string, string> = {
      "0": "0",
      "1": "1",
      "2": "2",
      "3": "3",
      "4": "4",
      "5-": "5弱",
      "5+": "5強",
      "6-": "6弱",
      "6+": "6強",
      "7": "7",
      "over": "over",
      "不明": "不明",
    };
    let intensity = mapping[value] || "不明";
    if (isFrom && intensity !== "不明" && intensity !== "over") {
      intensity += "程度以上";
      isThreshold = true;
    }
    return intensity;
  };

  const raw_maxIntensity = forecastMaxInt
    ? forecastMaxInt.to === "over"
      ? convertIntensity(forecastMaxInt.from || "不明")
      : convertIntensity(forecastMaxInt.to || "不明")
    : "不明";

  const maxIntensity = forecastMaxInt
    ? forecastMaxInt.to === "over"
      ? convertIntensity(forecastMaxInt.from || "不明", true)
      : convertIntensity(forecastMaxInt.to || "不明")
    : "不明";

  const method = (() => {
    const condition = earthquakeCondition || "不明";
    const accuracyEpicenters = hypocenterAccuracy?.epicenters || [];

    if (condition === "仮定震源要素") {
      return "PLUM法";
    } else if (accuracyEpicenters.length > 0) {
      const epicVal = accuracyEpicenters[0];
      const epicValInt = parseInt(epicVal, 10);

      if (epicValInt === 1) {
        return originTime ? "IPF法 (1点)" : "レベル法";
      } else if (epicValInt === 2) {
        return "IPF法 (2点)";
      } else if (epicValInt === 3 || epicValInt === 4) {
        return "IPF法 (3点以上)";
      } else {
        return originTime ? "不明" : "レベル法";
      }
    } else {
      return originTime ? "不明" : "レベル法";
    }
  })();

  if (
    body &&
    !isLowAccuracy &&
    !isCanceled &&
    (method === "PLUM法" || method === "レベル法" || method === "IPF法 (1点)")
  ) {
    return null;
  }

  const intensityColors: Record<string, { background: string; text: string }> = {
    "0": { background: "#62626B", text: "white" },
    "1": { background: "#2B8EB2", text: "white" },
    "2": { background: "#4CD0A7", text: "black" },
    "3": { background: "#F6CB51", text: "black" },
    "4": { background: "#FF9939", text: "black" },
    "5弱": { background: "#E52A18", text: "white" },
    "5強": { background: "#C31B1B", text: "white" },
    "6弱": { background: "#A50C6B", text: "white" },
    "6強": { background: "#930A7A", text: "white" },
    "7": { background: "#5F0CA2", text: "white" },
    "不明": { background: "#62626B", text: "white" },
    "0程度以上": { background: "#62626B", text: "white" },
    "1程度以上": { background: "#2B8EB2", text: "white" },
    "2程度以上": { background: "#4CD0A7", text: "black" },
    "3程度以上": { background: "#F6CB51", text: "black" },
    "4程度以上": { background: "#FF9939", text: "black" },
    "5弱程度以上": { background: "#E52A18", text: "white" },
    "5強程度以上": { background: "#C31B1B", text: "white" },
    "6弱程度以上": { background: "#A50C6B", text: "white" },
    "6強程度以上": { background: "#930A7A", text: "white" },
    "7程度以上": { background: "#5F0CA2", text: "white" },
  };

  const backgroundColor = intensityColors[maxIntensity]?.background || "#CCCCCC";
  const textColor = intensityColors[maxIntensity]?.text || "black";
  const accuracyData = hypocenterAccuracy;
  const epicenters = accuracyData?.epicenters || [];
  const epicenterAccuracy0 = epicenters[0] || "不明";

  let formattedTimeDisplay = "不明";
  if (originDt) {
    formattedTimeDisplay = `${
      originDt.getMonth() + 1
    }月${originDt.getDate()}日 ${originDt
      .getHours()
      .toString()
      .padStart(2, "0")}時${originDt
      .getMinutes()
      .toString()
      .padStart(2, "0")}分${originDt
      .getSeconds()
      .toString()
      .padStart(2, "0")}秒`;
  }

  const detectionOrOccurrence =
    method === "PLUM法" || method === "レベル法" ? "検知" : "発生";

  let displayIntensity = maxIntensity;

  // IPF法
  if (method.startsWith("IPF法")) {
    if (epicenters?.length) {
      const epicenterAccuracy = parseInt(epicenterAccuracy0, 10);
      if (epicenterAccuracy === 1) {
        displayIntensity = "単独点処理のため震度推定なし";
      } else {
        displayIntensity =
          forecastMaxInt?.to === "over"
            ? `推定最大震度 ${convertIntensity(
                forecastMaxInt.from || "不明",
                true
              )}`
            : `推定最大震度 ${convertIntensity(
                (forecastMaxInt?.to || "不明")
              )}`;
      }
    } else {
      displayIntensity = "単独点処理のため震度推定なし";
    }
  }
  // PLUM法
  else if (method === "PLUM法") {
    if (maxIntensity === "不明") {
      displayIntensity = "単独点処理のため震度推定なし";
    } else {
      const fromInt = forecastMaxInt?.from || "不明";
      if (fromInt !== "不明") {
        displayIntensity = `推定最大震度 ${convertIntensity(
          fromInt,
          true
        )}`;
      } else {
        displayIntensity = "単独点処理のため震度推定なし";
      }
    }
  }
  // レベル法
  else if (method === "レベル法") {
    if (
      maxIntensity === "不明" &&
      (forecastMaxInt?.to || "不明") === "不明"
    ) {
      displayIntensity = "単独点処理のため震度推定なし";
    } else {
      displayIntensity =
        forecastMaxInt?.to === "over"
          ? `推定最大震度 ${convertIntensity(
              forecastMaxInt.from || "不明",
              true
            )}`
          : `推定最大震度 ${convertIntensity(
              (forecastMaxInt?.to || "不明")
            )}`;
    }
  }

  // 深発
  if (depthValue !== "不明") {
    const depthStr = depthValue.replace(/[^0-9]/g, "");
    const depthNum = parseInt(depthStr, 10);
    if (!isNaN(depthNum) && depthNum > 150) {
      displayIntensity = "深発地震のため震度推定なし";
    }
  }

  const additionalMessage = (() => {
    if (
      isWarning &&
      ["6弱", "6強", "7"].includes(maxIntensity)
    ) {
      return (
        <>
        <span className="text-red-700">
          緊急地震速報の特別警報です
          <br />
          身の安全を確保してください
        </span>
        </>
      );
    } else if (displayIntensity === "深発地震のため震度推定なし") {
      return (
        <>
          震源が深いため震央から遠い場所で
          <br />
          揺れが大きくなることがあります
        </>
      );
    } else if (
      method === "レベル法" &&
      displayIntensity !== "深発地震のため震度推定なし"
    ) {
      return (
        <>
          大きな加速度が検出されたため
          <br />
          <strong>震度{raw_maxIntensity}</strong>と仮定して発表されています
        </>
      );
    } else if (
      method === "PLUM法" &&
      maxIntensity !== "不明" &&
      displayIntensity !== "深発地震のため震度推定なし"
    ) {
      return (
        <>
          リアルタイム震度から直接推定
          <br />
          された震度が発表されています
        </>
      );
    } else if (
      method === "PLUM法" &&
      maxIntensity === "不明" &&
      displayIntensity !== "深発地震のため震度推定なし"
    ) {
      return (
        <>
          使用されている観測点が少ないため
          <br />
          震源の精度が低い可能性があります
        </>
      );
    } else if (
      method.startsWith("IPF法") &&
      maxIntensity === "不明" &&
      displayIntensity !== "深発地震のため震度推定なし"
    ) {
      return (
        <>
          使用されている観測点が少ないため
          <br />
          震源の精度が低い可能性があります
        </>
      );
    } else if (isWarning) {
      return (
        <>
          <span className="text-yellow-400">
            強い揺れに警戒してください
          </span>
        </>
      );
    } else {
      return (
        <>
          <span className="text-yellow-600 dark:text-yellow-400">
            揺れに注意してください
          </span>
        </>
      );
    }
  })();

  const eventType = method !== "PLUM法" && method !== "レベル法" ? "地震" : "揺れ";

  if (!parsedData) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-black/90 border-t border-gray-200 dark:border-gray-800 p-4 text-center">
        <p className="font-medium">緊急地震速報受信待機中</p>
      </div>
    );
  }

  return (
    <div className="relative top-0 left-0 right-0 z-40 max-h-[80vh] overflow-y-auto">
      <div className="p-2 space-y-2">
        <Card 
          className="bg-white/90 dark:bg-black/90 border overflow-hidden"
        >
          <div className={`p-2 flex items-center gap-2 ${
            isCanceled
              ? "bg-gray-200 dark:bg-gray-600/20"
              : isWarning
              ? "bg-red-100 dark:bg-red-600/10"
              : "bg-yellow-100 dark:bg-yellow-950/30"
          }`}>
            {isCanceled ? (
              <XCircle className="h-4 w-4 text-gray-500 shrink-0" />
            ) : isWarning ? (
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            )}
            <div className="flex-1 text-sm font-medium">
              {`緊急地震速報（${
                isWarning ? (isCanceled ? "取消" : "警報") : (isCanceled ? "取消" : "予報")
              }）${isCanceled ? "" : method === "PLUM法" ? "※PLUM法による仮定震源" : method === "レベル法" ? "※レベル法による仮定震源" : ""}`}
            </div>
            <div className="text-xs">
              {status === "訓練" || status === "試験" ? "訓練・試験報" : ""}
              {!isCanceled && (
                <span>
                  {isLastInfo ? `第${serialNo}報 (最終)` : `第${serialNo}報`}
                </span>
              )}
            </div>
          </div>

          {!isCanceled && (
            <div className="p-3">
              <div className="flex justify-between items-center gap-2">
                <div className="flex flex-col">
                  <h3 className="text-2xl font-bold">{hypName}で{eventType}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formattedTimeDisplay}
                    {detectionOrOccurrence}
                  </p>
                </div>
                {displayIntensity === "深発地震のため震度推定なし" ? (
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-md font-bold flex items-center justify-end shrink-0" style={{ backgroundColor, color: textColor }}>
                    <div className="flex flex-col items-center">
                      <p className="text-xl">深発地震のため</p>
                      <p className="text-xl">震度推定なし</p>
                    </div>
                  </div>
                ) : displayIntensity === "単独点処理のため震度推定なし" ? (
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-md font-bold flex items-center justify-end shrink-0" style={{ backgroundColor, color: textColor }}>
                    <div className="flex flex-col items-center">
                      <p className="text-xl">単独点処理のため</p>
                      <p className="text-xl">震度推定なし</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-md font-bold flex items-center justify-end shrink-0" style={{ backgroundColor, color: textColor }}>
                    <div className="flex flex-col items-end mr-4">
                      <span>推定</span>
                      <span>最大震度</span>
                    </div>
                    <div className="flex items-baseline">
                      <p className="text-4xl">{raw_maxIntensity}</p>
                      { isThreshold ? (<span className="flex items-baseline ml-1">程度以上</span>) : null }
                    </div>
                  </div>
                )}
              </div>

              {method === "PLUM法" || method === "レベル法" ? (
                <div className="flex items-center justify-end">
                  <div className="mt-3 text-sm text-nowrap text-right">
                    {additionalMessage}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div className="flex items-center space-x-1">
                        <div className="flex items-baseline">
                          <span className="text-sm mr-1">M</span>
                          <p className="font-medium text-2xl">{magnitudeDisplay}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="flex items-baseline">
                          <span className="text-sm mr-1 text-nowrap">深さ</span>
                          <p className="font-medium text-2xl">{depthValue}</p>
                          <span className="text-sm ml-1">km</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-nowrap text-right">
                      {additionalMessage}
                    </div>
                  </div>
                </>
              )}

              <div className="flex w-full justify-between items-center text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">情報源: DMDATA</span>
              </div>
            </div>
          )}
          
          {isCanceled && (
            <div className="p-3">
              <p className="text-gray-600 dark:text-gray-400">この緊急地震速報は取り消されました。</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
