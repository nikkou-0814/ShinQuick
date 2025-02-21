import React, { useEffect, useState } from "react"

const ClockDisplay: React.FC<{
  nowAppTimeRef: React.MutableRefObject<number>;
  overrideTime?: string;
}> = React.memo(({ nowAppTimeRef, overrideTime }) => {
  const [displayTime, setDisplayTime] = useState(
    overrideTime ?? "----/--/-- --:--:--"
  );

  useEffect(() => {
    if (overrideTime !== undefined) {
      setDisplayTime(overrideTime);
    } else {
      const interval = setInterval(() => {
        const dateObj = new Date(nowAppTimeRef.current);
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
    }
  }, [nowAppTimeRef, overrideTime]);

  return <p className="pr-1">{displayTime}</p>;
});

export { ClockDisplay }
