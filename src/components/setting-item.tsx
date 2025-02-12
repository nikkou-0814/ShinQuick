import React, { memo } from "react";

const SettingItem: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
}> = memo(({ title, description, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="font-medium">{title}</span>
      {children}
    </div>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
));

SettingItem.displayName = "SettingItem";

export default SettingItem;
