import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import AttendeePage from "./views/AttendeePage";
import AdminPage from "./views/AdminPage";
import BroadcastPage from "./views/BroadcastPage";
import ModeratorPage from "./views/ModeratorPage";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<AttendeePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/broadcast" element={<BroadcastPage />} />
        <Route path="/moderator" element={<ModeratorPage />} />
        <Route path="*" element={<AttendeePage />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
