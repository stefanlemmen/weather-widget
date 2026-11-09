import "@weather-widget/location-picker";
import "@weather-widget/widget";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExampleHost } from "./example-host.tsx";

const ROOT_ID = "root";

const root = document.getElementById(ROOT_ID);
if (root === null) {
  throw new Error(`The page has no #${ROOT_ID} element to render into`);
}

createRoot(root).render(
  <StrictMode>
    <ExampleHost />
  </StrictMode>,
);
