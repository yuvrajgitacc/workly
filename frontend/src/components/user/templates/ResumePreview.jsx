import React from "react";
import { ModernTemplate } from "./ModernTemplate";
import { ClassicTemplate } from "./ClassicTemplate";
import { MinimalTemplate } from "./MinimalTemplate";
import { ExecutiveTemplate } from "./ExecutiveTemplate";
import { CreativeTemplate } from "./CreativeTemplate";
import { CompactTemplate } from "./CompactTemplate";
import AtsOptimizedTemplate from "./AtsOptimizedTemplate";

export const TEMPLATE_META = {
  modern: { name: "Modern", description: "Sidebar layout with subtle accent.", accent: "var(--google-blue)" },
  classic: { name: "Classic", description: "Timeless single-column serif.", accent: "var(--foreground)" },
  minimal: { name: "Minimal", description: "Lots of whitespace, tight type.", accent: "var(--muted-foreground)" },
  executive: { name: "Executive", description: "Bold header, traditional body.", accent: "var(--google-blue)" },
  creative: { name: "Creative", description: "Color accents and rounded cards.", accent: "var(--google-red)" },
  compact: { name: "Compact", description: "Dense two-column for veterans.", accent: "var(--google-green)" },
  ats: { name: "ATS Optimized", description: "Clean single-column ATS-safe layout.", accent: "#2E5BBA" },
};

export function ResumePreview({ template, resume }) {
  const normalizedSkills = (resume?.skills || []).map((s) => {
    if (typeof s === "object" && s !== null) {
      return s.canonical_skill || s.raw_skill || "";
    }
    return String(s);
  }).filter(Boolean);

  const safeResume = {
    ...resume,
    ...resume?.personalInfo, // Flatten personal info fields to the root
    skills: normalizedSkills
  };

  switch (template) {
    case "modern":
      return <ModernTemplate resume={safeResume} />;
    case "classic":
      return <ClassicTemplate resume={safeResume} />;
    case "minimal":
      return <MinimalTemplate resume={safeResume} />;
    case "executive":
      return <ExecutiveTemplate resume={safeResume} />;
    case "creative":
      return <CreativeTemplate resume={safeResume} />;
    case "compact":
      return <CompactTemplate resume={safeResume} />;
    case "ats":
      return <AtsOptimizedTemplate content={resume} />;
    default:
      return <ModernTemplate resume={safeResume} />;
  }
}
