"use client";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import SettingsDialog from "@/components/settings-dialog";
import { useTheme } from 'next-themes';
import { Map } from 'leaflet';

const DynamicMap = dynamic(() => import("@/components/map"), {
  ssr: false,
});

interface Settings {
  theme: 'system' | 'dark' | 'light';
  enable_dynamic_zoom: boolean;
  enable_low_accuracy_eew: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  enable_dynamic_zoom: true,
  enable_low_accuracy_eew: false,
};

export default function Page() {
  const [ShowSettings, setShowSettings] = useState<boolean>(false);
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prevSettings) => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      localStorage.setItem('settings', JSON.stringify(updatedSettings));
      return updatedSettings;
    });
  };

  const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (key === 'theme') {
      if (value === 'dark' || value === 'light' || value === 'system') {
        setTheme(value);
      }
    }
    updateSettings({ [key]: value });
  };

  const setHomePosition = () => {
    if (mapRef.current) {
      mapRef.current.setView([35, 136], 5);
    }
  };  

  return (
    <main className="h-full w-full">
      <DynamicMap ref={mapRef} homePosition={{ center: [35, 136], zoom: 5 }} />

      <SettingsDialog
        showSettings={ShowSettings}
        setShowSettings={setShowSettings}
        settings={settings}
        handleSettingChange={handleSettingChange}
      />

      <div className="fixed bottom-4 right-4 space-x-4">
        <Button
          variant="outline"
          onClick={() => setShowSettings(true)}
        >
          設定
        </Button>
        <Button
          variant="outline"
          onClick={() => setHomePosition()}
        >
          ホーム
        </Button>
      </div>
    </main>
  );
}
