import { WebMercatorViewport } from "viewport-mercator-project";

export const japanBounds: [[number, number], [number, number]] = [
  [122.9385, 20.4259],
  [153.9820, 45.5515],
];

export const getJapanHomePosition = () => {
  const viewport = new WebMercatorViewport({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  return viewport.fitBounds(japanBounds, { padding: 50 });
};
