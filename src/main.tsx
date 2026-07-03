import React from "react";
import ReactDOM from "react-dom/client";
import { setSearchDebug } from "cubing/search";
import App from "./components/App";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.layer.css";
import "mantine-datatable/styles.layer.css";
import "./layout.css";
import { theme } from "./theme";

setSearchDebug({ logPerf: false });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </React.StrictMode>
);
