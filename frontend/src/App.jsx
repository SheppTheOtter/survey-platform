import React from "react";
import { CssBaseline } from "@mui/material";

import Layout from "./components/Layout";
import Questionnaires from "./pages/Questionnaires";
import Collection from "./pages/Collection";
import Analytics from "./pages/Analytics"; // <--- Importar

export default function App() {
  const [page, setPage] = React.useState("questionnaires");
  return (
    <>
      <CssBaseline />
      <Layout page={page} setPage={setPage}>
        {page === "questionnaires" && <Questionnaires />}
        {page === "collection" && <Collection />}
        {page === "analytics" && <Analytics />}
      </Layout>
    </>
  );
}