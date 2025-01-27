export interface Coordinate {
  latitude: { value: string | number };
  longitude: { value: string | number };
}

export interface Accuracy {
  epicenters?: string[];
  depth?: string;
  magnitudeCalculation?: string;
  numberOfMagnitudeCalculation?: string;
}

export interface Hypocenter {
  name: string;
  depth?: { value: string };
  latitude?: { value: string };
  longitude?: { value: string };
  accuracy?: Accuracy;
}

export interface Earthquake {
  hypocenter: Hypocenter;
  magnitude?: {
    value?: string;
    condition?: string;
  };
  condition?: string;
  originTime?: string;
  arrivalTime?: string;
}

export interface Intensity {
  forecastMaxInt?: {
    from?: string;
    to?: string;
  };
  forecastMaxLgInt?: {
    from?: string;
    to?: string;
  };
}

export interface Prefecture {
  name: string;
}

export interface Zone {
  name: string;
}

export interface Body {
  isCanceled?: boolean;
  isLastInfo?: boolean;
  isWarning?: boolean;
  earthquake: Earthquake;
  intensity?: Intensity;
  prefectures?: Prefecture[];
  zones?: Zone[];
}

export interface EewData {
  serialNo: string;
  status?: string;
  type?: string;
  editorialOffice?: string;
  body: Body;
}

export interface EewDisplayProps {
  parsedData: EewData | null;
  isAccuracy?: boolean;
  isLowAccuracy?: boolean;
}
