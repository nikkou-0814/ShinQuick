import React, { memo } from "react";
import { SettingItemProps } from "@/types/types";

const SettingItem: React.FC<SettingItemProps> = memo(
  ({ title, description, children, className = "", vertical = false }) => (
    <div className={`space-y-2 ${className}`}>
      <div
        className={
          vertical
            ? "flex flex-col gap-2"
            : "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        }
      >
        <div className="space-y-1">
          <span className="font-medium">{title}</span>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-start sm:justify-end sm:min-w-[100px]">
          {children}
        </div>
      </div>
    </div>
  )
);

SettingItem.displayName = "SettingItem";

export default SettingItem;
