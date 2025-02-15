"use client";

import React, { useEffect, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { EewInformation } from "@dmdata/telegram-json-types";

export interface EewDisplayProps {
  parsedData: EewInformation.Latest.Main | null;
  isAccuracy?: boolean;
  isLowAccuracy?: boolean;
  onEpicenterUpdate?: (info: {
    eventId: string;
    serialNo: string;
    lat: number;
    lng: number;
    icon: string;
    depthval: number;
    originTime: number;
  }) => void;
  onRegionIntensityUpdate?: (regionMap: Record<string, string>) => void;
  onWarningRegionUpdate?: (warningRegions: { code: string; name: string }[]) => void;
}

const EewDisplay: React.FC<EewDisplayProps> = ({
  parsedData,
  isAccuracy = false,
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
      prevWarningRegionsRef.current = regions;
    }
  }, [parsedData, onWarningRegionUpdate]);

  const getJstTime = (timestamp: string | undefined): Date | null => {
    try {
      if (!timestamp) return null;
      return new Date(timestamp);
    } catch {
      return null;
    }
  };  

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
    if (!isLowAccuracy) return;
  
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
  
    const latVal = Number(coordinate.latitude.value);
    const lngVal = Number(coordinate.longitude.value);
    const depthVal = Number(hypocenter.depth.value);
  
    if (isNaN(latVal) || isNaN(lngVal) || isNaN(depthVal)) return;
  
    onEpicenterUpdate({
      eventId,
      serialNo,
      lat: latVal,
      lng: lngVal,
      icon,
      depthval: depthVal,
      originTime: quakeOriginTime,
    });
  }, [parsedData, onEpicenterUpdate, isLowAccuracy]);

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

    onRegionIntensityUpdate(newMap);
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
    prefectures = [],
    zones = [],
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
    magnitudeValue !== "不明" ? `M${magnitudeValue}` : magnitudeCondition || "不明";

  const forecastMaxInt = intensity?.forecastMaxInt;
  const forecastMaxLgInt = intensity?.forecastMaxLgInt;

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

  const maxLgInt =
    forecastMaxLgInt?.to === "over"
      ? `${forecastMaxLgInt.from || "不明"}程度以上`
      : forecastMaxLgInt?.to || "不明";

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

  const lgintcolors: Record<string, { background: string; text: string }> = {
    "0": { background: "#2B8EB2", text: "white" },
    "1": { background: "#F6CB51", text: "black" },
    "2": { background: "#E54812", text: "white" },
    "3": { background: "#C31B1B", text: "white" },
    "4": { background: "#930A7A", text: "white" },
    "不明": { background: "#62626B", text: "white" },
    "0程度以上": { background: "#2B8EB2", text: "white" },
    "1程度以上": { background: "#F6CB51", text: "black" },
    "2程度以上": { background: "#E54812", text: "white" },
    "3程度以上": { background: "#C31B1B", text: "white" },
    "4程度以上": { background: "#930A7A", text: "white" },
  };

  const backgroundColor = intensityColors[maxIntensity]?.background || "#CCCCCC";
  const textColor = intensityColors[maxIntensity]?.text || "black";
  const lgint_backgroundColor =
    lgintcolors[maxLgInt]?.background || "#CCCCCC";
  const lgint_textColor = lgintcolors[maxLgInt]?.text || "black";
  const regions =
    prefectures.length > 8
      ? zones.map((zone: { name: string; }) => zone.name || "不明")
      : prefectures.map((pref) => pref.name || "不明");
  const regionsDisplay = regions.length > 0 ? regions.join("、") : "不明";
  const accuracyData = hypocenterAccuracy;
  const epicenters = accuracyData?.epicenters || [];
  const epicenterAccuracy0 = epicenters[0] || "不明";
  const epicenterAccuracy1 = epicenters[1] || "不明";
  const accuracyDepthLabel = accuracyData?.depth || "不明";
  const accuracyMagnitudeCalc = accuracyData?.magnitudeCalculation || "不明";
  const accuracyNumberOfMagCalc =
    accuracyData?.numberOfMagnitudeCalculation || "不明";

  const mapAccuracyValue = (
    value: string | number,
    category: string
  ): string => {
    const mapping: Record<string, Record<string, string>> = {
      epicenters: {
        "0": "不明",
        "1":
          "P波/S波レベル越え、IPF法(1点)または仮定震源要素",
        "2": "IPF法(2点)",
        "3": "IPF法(3点/4点)",
        "4": "IPF法(5点以上)",
        "5": "防災科研システム(4点以下または精度情報なし)",
        "6": "防災科研システム(5点以上)",
        "7": "EPOS(海域)",
        "8": "EPOS(内陸)",
        "9": "震源とマグニチュードに基づく最終精度（気象庁）",
      },
      depth: {
        "0": "不明",
        "1":
          "P波/S波レベル越え、IPF法(1点)または仮定震源要素",
        "2": "IPF法(2点)",
        "3": "IPF法(3点/4点)",
        "4": "IPF法(5点以上)",
        "5": "防災科研システム(4点以下または精度情報なし)",
        "6": "防災科研システム(5点以上)",
        "7": "EPOS(海域)",
        "8": "EPOS(内陸)",
      },
      magnitudeCalculation: {
        "0": "不明",
        "2": "速度マグニチュード",
        "3": "全相P相",
        "4": "P相/全相混在",
        "5": "全点全相",
        "6": "EPOS",
        "8": "P波/S波レベル越えまたは仮定震源要素",
      },
      numberOfMagnitudeCalculation: {
        "0": "不明",
        "1": "1点",
        "2": "2点",
        "3": "3点",
        "4": "4点",
        "5": "5点以上",
      },
    };
    return mapping[category]?.[String(value)] || "未知の値";
  };

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
          緊急地震速報の特別警報です
          <br />
          身の安全を確保してください
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
          緊急地震速報（警報）発表
          <br />
          強い揺れに警戒してください
        </>
      );
    } else {
      return (
        <>
          緊急地震速報（予報）発表
          <br />
          揺れに注意してください
        </>
      );
    }
  })();

  const description = (
    <>
      {regionsDisplay !== "不明" && (
        <>
          <strong>{regionsDisplay}</strong>
          <br />
          では強い揺れに警戒してください
          <br />
          <br />
        </>
      )}
      {additionalMessage}
    </>
  );

  const eventType = method !== "PLUM法" && method !== "レベル法" ? "地震" : "揺れ";

  const isTest = status === "訓練" || status === "試験";

  return (
    <Card className="w-96 shadow-xl bg-white/90 dark:bg-black/75 border">
      <CardHeader className="pb-4">
        <CardTitle
          className={`flex flex-wrap items-center gap-2 text-lg p-2 rounded-lg ${
            isCanceled
              ? "bg-gray-200 dark:bg-gray-600/20"
              : isWarning
              ? "bg-red-100 dark:bg-red-600/10"
              : "bg-yellow-100 dark:bg-yellow-950/30"
          }`}
        >
          <div className="flex items-center gap-2">
            {isCanceled ? (
              <XCircle className="h-5 w-5 text-gray-500" />
            ) : isWarning ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            {`緊急地震速報（${
              isWarning ? (isCanceled ? "取消" : "警報") : (isCanceled ? "取消" : "予報")
            }）`}
            {!isTest && (
              <span className="text-sm ml-auto">
                {isLastInfo ? `第${serialNo}報 （最終）` : `第${serialNo}報`}
              </span>
            )}
          </div>

          {isTest && (
            <div className="flex w-full justify-between items-center text-sm">
              <span className="text-xs">訓練・試験報</span>
              {!isCanceled && (
                <span className="ml-auto">
                  {isLastInfo ? `第${serialNo}報 （最終）` : `第${serialNo}報`}
                </span>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isCanceled &&(
            <div
            className={`rounded-lg border-2 p-4 ${
              isWarning
                ? "border-red-500/50 bg-red-200/30 dark:bg-red-950/30"
                : "border-yellow-500/50 bg-yellow-200/30 dark:bg-yellow-950/30"
            }`}
          >
            <h1 className="text-2xl font-bold mb-2">
              {hypName}で{eventType}
            </h1>
            <p className="text-sm text-gray-800 dark:text-gray-300">
              {formattedTimeDisplay}
              {detectionOrOccurrence}
            </p>
            <div
              className="rounded-md p-4 mt-4 text-center font-bold shadow-md"
              style={{ backgroundColor, color: textColor }}
            >
              <h1 className="text-lg">
                {displayIntensity}
              </h1>
            </div>
            {maxLgInt !== "不明" && maxLgInt !== "0" && (
              <div
                className="rounded-md p-4 mt-4 text-center font-bold shadow-md"
                style={{
                  backgroundColor: lgint_backgroundColor,
                  color: lgint_textColor,
                }}
              >
                <h1 className="text-lg">
                  推定最大長周期地震動階級 {maxLgInt}
                </h1>
              </div>
            )}
          </div>
        )}
            {description && !isCanceled && (
              <div
                className={`rounded-lg p-4 border-2 ${
                  isWarning
                    ? "border-red-500/50 bg-red-200/30 dark:bg-red-950/30"
                    : "border-yellow-500/50 bg-yellow-200/30 dark:bg-yellow-950/30"
                }`}
              >
                <p className="text-sm font-medium">{description}</p>
              </div>
            )}
            {isCanceled && (
              <div
                className={`rounded-lg p-4 border-2 bg-gray-200/30 dark:bg-gray-950/30`}
              >
                <p className="text-sm font-medium">この緊急地震速報は取り消されました。</p>
              </div>
            )}
            
            {!isCanceled && (
              <>
              {method === "PLUM法" || method === "レベル法" ? (
                <div className="space-y-1 w-full">
                  <p className="font-medium text-center p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border">
                    {method === "PLUM法"
                      ? "PLUM法による仮定震源"
                      : "レベル法による仮定震源"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 p-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      マグニチュード
                    </p>
                    <p className="font-medium">{magnitudeDisplay}</p>
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      深さ
                    </p>
                    <p className="font-medium">{depthValue} km</p>
                  </div>
                </div>
              )}
              </>
            )}

            {isAccuracy && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-950/30 p-2 rounded-lg">
                    <Info className="h-4 w-4 text-blue-500" />
                    <h3 className="font-medium">精度情報</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2">
                      <p className="text-gray-500 dark:text-gray-400">
                        震央精度
                      </p>
                      <p className="mt-1">
                        {mapAccuracyValue(
                          epicenterAccuracy0,
                          "epicenters"
                        )}
                      </p>
                    </div>
                    <div className="p-2">
                      <p className="text-gray-500 dark:text-gray-400">
                        震源精度
                      </p>
                      <p className="mt-1">
                        {mapAccuracyValue(
                          epicenterAccuracy1,
                          "epicenters"
                        )}
                      </p>
                    </div>
                    <div className="p-2">
                      <p className="text-gray-500 dark:text-gray-400">
                        深さ精度
                      </p>
                      <p className="mt-1">
                        {mapAccuracyValue(
                          accuracyDepthLabel,
                          "depth"
                        )}
                      </p>
                    </div>
                    <div className="p-2">
                      <p className="text-gray-500 dark:text-gray-400">
                        M精度
                      </p>
                      <p className="mt-1">
                        {mapAccuracyValue(
                          accuracyMagnitudeCalc,
                          "magnitudeCalculation"
                        )}
                      </p>
                    </div>
                    <div className="p-2">
                      <p className="text-gray-500 dark:text-gray-400">
                        M計算使用観測点数
                      </p>
                      <p className="mt-1">
                        {mapAccuracyValue(
                          accuracyNumberOfMagCalc,
                          "numberOfMagnitudeCalculation"
                        )}
                      </p>
                    </div>
                    <div className="p-2">
                      <p className="text-gray-500 dark:text-gray-400">
                        予測手法
                      </p>
                      <p className="mt-1">{method}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
      </CardContent>
    </Card>
  );
};

export default EewDisplay;
