import React from "react";

const NAVY = "#1F2937";
const ACCENT = "#2E5BBA";
const GRAY = "#555555";
const TEXT = "#222222";

function SectionHeading({ children }) {
  return (
    <h2
      style={{
        fontSize: "13px",
        fontWeight: 700,
        color: NAVY,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        borderBottom: `2px solid ${ACCENT}`,
        paddingBottom: "3px",
        marginTop: "14px",
        marginBottom: "6px",
      }}
    >
      {children}
    </h2>
  );
}

function Bullet({ children }) {
  return (
    <li
      style={{
        fontSize: "11.5px",
        color: TEXT,
        lineHeight: 1.4,
        marginBottom: "3px",
      }}
    >
      {children}
    </li>
  );
}

function TechStackLine({ stack }) {
  if (!stack || stack.length === 0) return null;
  return (
    <p style={{ fontSize: "10.5px", color: GRAY, marginTop: "2px", marginBottom: "8px" }}>
      <strong>Tech Stack: </strong>
      <em>{Array.isArray(stack) ? stack.join(", ") : stack}</em>
    </p>
  );
}

/**
 * content shape expected (matches ResumeDraft.content schema):
 * {
 *   personalInfo: { fullName, title, email, phone, location, linkedin, github, website },
 *   summary: string,
 *   education: [{ degree, school, location, startDate, endDate }],
 *   skills: [string] | { languages: [], frameworks: [], databases: [], tools: [] },
 *   experience: [{ title, company, location, startDate, endDate, bullets: [string] }],
 *   projects: [{ name, description, bullets: [string], techStack: [string] }],
 *   certifications: [{ name, issuer, date, link }],
 *   languages: [{ name, proficiency }]
 * }
 */
export default function AtsOptimizedTemplate({ content }) {
  if (!content) return null;

  const {
    personalInfo = {},
    summary,
    education = [],
    skills = [],
    experience = [],
    projects = [],
    certifications = [],
    languages = [],
  } = content;

  // Group skills if they come as flat array, otherwise use provided groups
  const skillGroups = Array.isArray(skills)
    ? [{ label: "Skills", items: skills }]
    : Object.entries(skills).map(([label, items]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        items,
      }));

  const columns = content.columns || 1;

  if (columns === 2) {
    return (
      <div
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          color: TEXT,
          width: "100%",
          maxWidth: "850px",
          margin: "0 auto",
          padding: "32px 40px",
          background: "#ffffff",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: NAVY, margin: 0 }}>
            {(personalInfo.fullName || "Your Name").toUpperCase()}
          </h1>
          {personalInfo.title && (
            <p style={{ fontSize: "12.5px", fontWeight: 600, color: ACCENT, margin: "4px 0" }}>
              {personalInfo.title}
            </p>
          )}
          <p style={{ fontSize: "10.5px", color: GRAY, margin: "4px 0" }}>
            {[personalInfo.email, personalInfo.phone, personalInfo.location]
              .filter(Boolean)
              .join("  |  ")}
          </p>
          {(personalInfo.linkedin || personalInfo.github || personalInfo.website) && (
            <p style={{ fontSize: "10.5px", margin: "2px 0" }}>
              {[
                personalInfo.linkedin && (
                  <a key="li" href={personalInfo.linkedin} style={{ color: ACCENT }}>
                    LinkedIn
                  </a>
                ),
                personalInfo.github && (
                  <a key="gh" href={personalInfo.github} style={{ color: ACCENT }}>
                    GitHub
                  </a>
                ),
                personalInfo.website && (
                  <a key="web" href={personalInfo.website} style={{ color: ACCENT }}>
                    Portfolio
                  </a>
                ),
              ]
                .filter(Boolean)
                .reduce((acc, el) => (acc.length ? [...acc, "  |  ", el] : [el]), [])}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: "0.25in", marginTop: "14px" }}>
          <aside style={{ borderRight: "1px solid #eee", paddingRight: "0.2in" }}>
            {/* Technical Skills */}
            {skillGroups.some((g) => g.items?.length) && (
              <>
                <SectionHeading>Technical Skills</SectionHeading>
                {skillGroups.map(
                  (group, i) =>
                    group.items?.length > 0 && (
                      <p key={i} style={{ fontSize: "11px", margin: "2px 0" }}>
                        <strong>{group.label}: </strong>
                        {group.items.join(", ")}
                      </p>
                    )
                )}
              </>
            )}

            {/* Education */}
            {education.length > 0 && (
              <>
                <SectionHeading>Education</SectionHeading>
                {education.map((edu, i) => (
                  <div key={i} style={{ marginBottom: "6px" }}>
                    <div style={{ fontWeight: 700, fontSize: "11.5px" }}>{edu.degree}</div>
                    <div style={{ fontSize: "11px" }}>{edu.school}</div>
                    <div style={{ fontSize: "10px", fontStyle: "italic", color: GRAY }}>
                      {edu.startDate} {edu.startDate && edu.endDate ? "–" : ""} {edu.endDate}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Certifications */}
            {certifications.length > 0 && (
              <>
                <SectionHeading>Certifications</SectionHeading>
                {certifications.map((cert, i) => (
                  <div key={i} style={{ fontSize: "11px", marginBottom: "4px" }}>
                    {cert.link ? (
                      <a href={cert.link} style={{ color: ACCENT, fontWeight: 600 }}>
                        {cert.name}
                      </a>
                    ) : (
                      <strong style={{ fontWeight: 600 }}>{cert.name}</strong>
                    )}
                    {cert.issuer ? <div style={{ fontSize: "10.5px", color: GRAY }}>{cert.issuer}</div> : ""}
                    {cert.date ? <div style={{ fontSize: "10px", fontStyle: "italic", color: GRAY }}>{cert.date}</div> : ""}
                  </div>
                ))}
              </>
            )}

            {/* Languages */}
            {languages.length > 0 && (
              <>
                <SectionHeading>Languages</SectionHeading>
                <div style={{ fontSize: "11px" }}>
                  {languages.map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ""}`).join(", ")}
                </div>
              </>
            )}
          </aside>

          <main>
            {/* Summary */}
            {summary && (
              <>
                <SectionHeading>Professional Summary</SectionHeading>
                <p style={{ fontSize: "11.5px", lineHeight: 1.45, margin: 0 }}>{summary}</p>
              </>
            )}

            {/* Experience */}
            {experience.length > 0 && (
              <>
                <SectionHeading>Work Experience</SectionHeading>
                {experience.map((exp, i) => (
                  <div key={i} style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: "12px", color: NAVY }}>
                        {exp.title}{exp.company ? ` — ${exp.company}` : ""}
                      </strong>
                      <span style={{ fontSize: "11px", fontStyle: "italic", color: GRAY, whiteSpace: "nowrap" }}>
                        {exp.startDate} – {exp.endDate || "Present"}
                      </span>
                    </div>
                    {exp.bullets?.length > 0 && (
                      <ul style={{ margin: "3px 0 0 16px", padding: 0 }}>
                        {exp.bullets.map((b, j) => (
                          <Bullet key={j}>{b}</Bullet>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Projects */}
            {projects.length > 0 && (
              <>
                <SectionHeading>Projects</SectionHeading>
                {projects.map((proj, i) => (
                  <div key={i} style={{ marginBottom: "8px" }}>
                    <strong style={{ fontSize: "12px", color: NAVY }}>{proj.name}</strong>
                    {proj.bullets?.length > 0 ? (
                      <ul style={{ margin: "3px 0 0 16px", padding: 0 }}>
                        {proj.bullets.map((b, j) => (
                          <Bullet key={j}>{b}</Bullet>
                        ))}
                      </ul>
                    ) : proj.description ? (
                      <ul style={{ margin: "3px 0 0 16px", padding: 0 }}>
                        <Bullet>{proj.description}</Bullet>
                      </ul>
                    ) : null}
                    <TechStackLine stack={proj.techStack} />
                  </div>
                ))}
              </>
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div
      // CRITICAL FOR ATS: single column, no tables, no background images, no icons
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        color: TEXT,
        width: "100%",
        maxWidth: "850px",
        margin: "0 auto",
        padding: "32px 40px",
        background: "#ffffff",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: NAVY, margin: 0 }}>
          {(personalInfo.fullName || "Your Name").toUpperCase()}
        </h1>
        {personalInfo.title && (
          <p style={{ fontSize: "12.5px", fontWeight: 600, color: ACCENT, margin: "4px 0" }}>
            {personalInfo.title}
          </p>
        )}
        <p style={{ fontSize: "10.5px", color: GRAY, margin: "4px 0" }}>
          {[personalInfo.email, personalInfo.phone, personalInfo.location]
            .filter(Boolean)
            .join("  |  ")}
        </p>
        {(personalInfo.linkedin || personalInfo.github || personalInfo.website) && (
          <p style={{ fontSize: "10.5px", margin: "2px 0" }}>
            {[
              personalInfo.linkedin && (
                <a key="li" href={personalInfo.linkedin} style={{ color: ACCENT }}>
                  LinkedIn
                </a>
              ),
              personalInfo.github && (
                <a key="gh" href={personalInfo.github} style={{ color: ACCENT }}>
                  GitHub
                </a>
              ),
              personalInfo.website && (
                <a key="web" href={personalInfo.website} style={{ color: ACCENT }}>
                  Portfolio
                </a>
              ),
            ]
              .filter(Boolean)
              .reduce((acc, el) => (acc.length ? [...acc, "  |  ", el] : [el]), [])}
          </p>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <>
          <SectionHeading>Professional Summary</SectionHeading>
          <p style={{ fontSize: "11.5px", lineHeight: 1.45, margin: 0 }}>{summary}</p>
        </>
      )}

      {/* Education */}
      {education.length > 0 && (
        <>
          <SectionHeading>Education</SectionHeading>
          {education.map((edu, i) => (
            <div key={i} style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "12px" }}>{edu.degree}{edu.school ? `, ${edu.school}` : ""}</strong>
                <span style={{ fontSize: "11px", fontStyle: "italic", color: GRAY }}>
                  {edu.startDate} {edu.startDate && edu.endDate ? "–" : ""} {edu.endDate}
                </span>
              </div>
              {edu.location && <p style={{ fontSize: "10.5px", color: GRAY, margin: 0 }}>{edu.location}</p>}
            </div>
          ))}
        </>
      )}

      {/* Skills */}
      {skillGroups.some((g) => g.items?.length) && (
        <>
          <SectionHeading>Technical Skills</SectionHeading>
          {skillGroups.map(
            (group, i) =>
              group.items?.length > 0 && (
                <p key={i} style={{ fontSize: "11px", margin: "2px 0" }}>
                  <strong>{group.label}: </strong>
                  {group.items.join(", ")}
                </p>
              )
          )}
        </>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <>
          <SectionHeading>Work Experience</SectionHeading>
          {experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "12px", color: NAVY }}>
                  {exp.title}{exp.company ? ` — ${exp.company}` : ""}
                </strong>
                <span style={{ fontSize: "11px", fontStyle: "italic", color: GRAY }}>
                  {exp.startDate} – {exp.endDate || "Present"}
                </span>
              </div>
              {/* CRITICAL: bullets, never a paragraph blob */}
              {exp.bullets?.length > 0 && (
                <ul style={{ margin: "3px 0 0 16px", padding: 0 }}>
                  {exp.bullets.map((b, j) => (
                    <Bullet key={j}>{b}</Bullet>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <>
          <SectionHeading>Projects</SectionHeading>
          {projects.map((proj, i) => (
            <div key={i} style={{ marginBottom: "8px" }}>
              <strong style={{ fontSize: "12px", color: NAVY }}>{proj.name}</strong>
              {proj.bullets?.length > 0 ? (
                <ul style={{ margin: "3px 0 0 16px", padding: 0 }}>
                  {proj.bullets.map((b, j) => (
                    <Bullet key={j}>{b}</Bullet>
                  ))}
                </ul>
              ) : proj.description ? (
                // Fallback: if only a description string exists, split into bullet-like lines
                <ul style={{ margin: "3px 0 0 16px", padding: 0 }}>
                  <Bullet>{proj.description}</Bullet>
                </ul>
              ) : null}
              <TechStackLine stack={proj.techStack} />
            </div>
          ))}
        </>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <>
          <SectionHeading>Certifications</SectionHeading>
          {certifications.map((cert, i) => (
            <p key={i} style={{ fontSize: "11px", margin: "2px 0" }}>
              {cert.link ? (
                <a href={cert.link} style={{ color: ACCENT }}>
                  {cert.name}
                </a>
              ) : (
                cert.name
              )}
              {cert.issuer ? ` — ${cert.issuer}` : ""}
              {cert.date ? ` (${cert.date})` : ""}
            </p>
          ))}
        </>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <>
          <SectionHeading>Languages</SectionHeading>
          <p style={{ fontSize: "11px", margin: 0 }}>
            {languages.map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ""}`).join(", ")}
          </p>
        </>
      )}
    </div>
  );
}
