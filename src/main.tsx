import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RiverScope, loggerObserver } from "./index";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RiverScope observers={[loggerObserver()]}>
      <App />
    </RiverScope>
  </StrictMode>,
);
