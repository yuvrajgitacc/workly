import React from "react";

export function Page({ children }) {
  return (
    <div
      className="resume-page bg-white text-[#1a1a1a]"
      style={{
        width: "8.5in",
        minHeight: "11in",
        padding: "0.6in",
        fontFamily: "'Roboto', Arial, sans-serif",
        fontSize: "10.5pt",
        lineHeight: 1.45,
        boxShadow: "0 4px 30px rgba(0,0,0,0.08)",
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  color = "#1a1a1a",
  underline,
}) {
  return (
    <h2
      style={{
        color,
        fontSize: "11pt",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: "8px",
        paddingBottom: underline ? "4px" : 0,
        borderBottom: underline ? `1.5px solid ${color}` : "none",
      }}
    >
      {children}
    </h2>
  );
}

export function Bullets({ items }) {
  if (!items || !Array.isArray(items)) return null;
  return (
    <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px" }}>
      {items.filter(Boolean).map((b, i) => (
        <li key={i} style={{ marginBottom: "3px" }}>
          {b}
        </li>
      ))}
    </ul>
  );
}

export function ContactLine({ resume, align = "center" }) {
  const links = [];
  if (resume.email) {
    links.push(
      <a key="email" href={`mailto:${resume.email}`} className="hover:text-primary transition-colors text-inherit" style={{ textDecoration: "none", color: "inherit" }}>
        {resume.email}
      </a>
    );
  }
  if (resume.phone) {
    links.push(<span key="phone">{resume.phone}</span>);
  }
  if (resume.location) {
    links.push(<span key="loc">{resume.location}</span>);
  }
  if (resume.website) {
    const displayWeb = resume.website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    links.push(
      <a key="web" href={resume.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors text-inherit" style={{ textDecoration: "none", color: "inherit" }}>
        {displayWeb}
      </a>
    );
  }
  if (resume.linkedin) {
    const displayLinkedin = resume.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "").replace(/\/$/, "");
    links.push(
      <a key="li" href={resume.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors text-inherit" style={{ textDecoration: "none", color: "inherit" }}>
        LinkedIn{displayLinkedin ? `: ${displayLinkedin}` : ""}
      </a>
    );
  }
  if (resume.github) {
    const displayGithub = resume.github.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\/$/, "");
    links.push(
      <a key="gh" href={resume.github} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors text-inherit" style={{ textDecoration: "none", color: "inherit" }}>
        GitHub{displayGithub ? `: ${displayGithub}` : ""}
      </a>
    );
  }

  const children = [];
  links.forEach((link, idx) => {
    children.push(link);
    if (idx < links.length - 1) {
      children.push(<span key={`sep-${idx}`} style={{ margin: "0 6px", color: "#ccc" }}>·</span>);
    }
  });

  return (
    <div style={{
      fontSize: "9.5pt",
      color: "#555",
      display: "flex",
      flexWrap: "wrap",
      justifyContent: align === "left" ? "flex-start" : (align === "right" ? "flex-end" : "center"),
      alignItems: "center"
    }}>
      {children}
    </div>
  );
}
