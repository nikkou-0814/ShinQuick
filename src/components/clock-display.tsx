import React, { useEffect, useState } from "react"
import { ClockDisplayProps } from "@/types/types"

const ClockDisplay: React.FC<ClockDisplayProps> = React.memo(
  ({ nowAppTimeRef, KyoshinMonitor }) => {
    const [displayTime, setDisplayTime] = useState("----/--/-- --:--:--");

    useEffect(() => {
      const interval = setInterval(() => {
        const adjustedTime =
          nowAppTimeRef.current - (KyoshinMonitor ? 2000 : 0);
        const dateObj = new Date(adjustedTime);
        const formatted = dateObj.toLocaleString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setDisplayTime(formatted);
      }, 1000);
      return () => clearInterval(interval);
    }, [nowAppTimeRef, KyoshinMonitor]);

    return <p className="pr-1">{displayTime}</p>;
  }
);

ClockDisplay.displayName = "ClockDisplay";
export { ClockDisplay }
