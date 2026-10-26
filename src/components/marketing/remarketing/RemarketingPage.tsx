import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import html from "./body.html?raw";
import "./remarketing.css";
import { initRemarketing } from "./remarketing-init";

export default function RemarketingPage() {
  useEffect(() => initRemarketing(), []);
  return (
    <>
      <Navbar />
      <main className="rmk" dangerouslySetInnerHTML={{ __html: html }} />
      <Footer />
    </>
  );
}
