import React from "react";
import { Page, SectionTitle, Bullets } from "./shared";

const ACCENT = "#1a73e8";

export function ModernTemplate({ resume }) {
  const columns = resume.columns || 2;

  if (columns === 1) {
    return (
      <Page>
        <header style={{ borderBottom: `2px solid ${ACCENT}`, paddingBottom: "10px", marginBottom: "14px" }}>
          <div style={{ fontSize: "20pt", fontWeight: 700, color: ACCENT, lineHeight: 1.1 }}>
            {resume.fullName || "Your Name"}
          </div>
          <div style={{ fontSize: "11pt", color: "#555", marginTop: "4px", fontWeight: 500 }}>
            {resume.title}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "9pt", color: "#666", marginTop: "8px" }}>
            {resume.email && (
              <span>
                Email: <a href={`mailto:${resume.email}`} style={{ color: "inherit", textDecoration: "none" }} className="hover:underline">{resume.email}</a>
              </span>
            )}
            {resume.phone && <span>· Phone: {resume.phone}</span>}
            {resume.location && <span>· Location: {resume.location}</span>}
            {resume.website && (
              <span>
                · Web: <a href={resume.website} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:underline">{resume.website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}</a>
              </span>
            )}
            {resume.linkedin && (
              <span>
                · LinkedIn: <a href={resume.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:underline">LinkedIn</a>
              </span>
            )}
            {resume.github && (
              <span>
                · GitHub: <a href={resume.github} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:underline">GitHub</a>
              </span>
            )}
          </div>
        </header>

        {resume.summary && (
          <section style={{ marginBottom: "14px" }}>
            <SectionTitle color={ACCENT}>Summary</SectionTitle>
            <p style={{ margin: 0 }}>{resume.summary}</p>
          </section>
        )}

        {resume.experience && resume.experience.length > 0 && (
          <section style={{ marginBottom: "14px" }}>
            <SectionTitle color={ACCENT}>Experience</SectionTitle>
            {resume.experience.map((x) => (
              <div key={x.id} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600 }}>
                    {x.title} <span style={{ color: ACCENT }}>· {x.company}</span>
                  </div>
                  <div style={{ fontSize: "9.5pt", color: "#666" }}>
                    {x.startDate} – {x.endDate}
                  </div>
                </div>
                {x.location && (
                  <div style={{ fontSize: "9pt", color: "#888" }}>{x.location}</div>
                )}
                <Bullets items={x.bullets} />
              </div>
            ))}
          </section>
        )}

        {resume.projects && resume.projects.length > 0 && (
          <section style={{ marginBottom: "14px" }}>
            <SectionTitle color={ACCENT}>Projects</SectionTitle>
            {resume.projects.map((p) => (
              <div key={p.id} style={{ marginBottom: "12px" }}>
                <div style={{ fontWeight: 600 }}>
                  {p.link ? (
                    <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none" }} className="hover:underline">
                      {p.name} ↗
                    </a>
                  ) : (
                    p.name
                  )}
                </div>
                <div style={{ fontSize: "9.5pt", color: "#333", marginTop: "2px" }}>{p.description}</div>
                {p.techStack && p.techStack.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px" }}>
                    {p.techStack.map((t, i) => (
                      <span key={i} style={{ fontSize: "8.5pt", background: "#e8f0fe", color: ACCENT, padding: "1px 6px", borderRadius: "8px", fontWeight: 500 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {resume.skills && resume.skills.length > 0 && (
          <section style={{ marginBottom: "14px" }}>
            <SectionTitle color={ACCENT}>Skills</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {resume.skills.map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "9pt",
                    background: "#e8f0fe",
                    color: ACCENT,
                    padding: "2px 8px",
                    borderRadius: "10px",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        {resume.education && resume.education.length > 0 && (
          <section style={{ marginBottom: "14px" }}>
            <SectionTitle color={ACCENT}>Education</SectionTitle>
            {resume.education.map((e) => (
              <div key={e.id} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: "10pt" }}>{e.degree}</div>
                  <div style={{ fontSize: "9.5pt", color: "#666" }}>{e.startDate} – {e.endDate}</div>
                </div>
                <div style={{ fontSize: "9.5pt" }}>{e.school}</div>
              </div>
            ))}
          </section>
        )}

        {resume.certifications && resume.certifications.length > 0 && (
          <section style={{ marginBottom: "14px" }}>
            <SectionTitle color={ACCENT}>Certifications</SectionTitle>
            {resume.certifications.map((c) => (
              <div key={c.id} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: "10pt" }}>{c.name}</div>
                  {c.date && <div style={{ fontSize: "9.5pt", color: "#666" }}>{c.date}</div>}
                </div>
                <div style={{ fontSize: "9.5pt" }}>{c.issuer}</div>
              </div>
            ))}
          </section>
        )}

        {resume.languages && resume.languages.length > 0 && (
          <section style={{ marginBottom: "14px" }}>
            <SectionTitle color={ACCENT}>Languages</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", fontSize: "9.5pt" }}>
              {resume.languages.map((l) => (
                <div key={l.id} style={{ marginRight: "15px" }}>
                  <span style={{ fontWeight: 600 }}>{l.name}</span>: <span style={{ color: "#666" }}>{l.proficiency}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </Page>
    );
  }

  return (
    <Page>
      <div style={{ display: "grid", gridTemplateColumns: "2.2in 1fr", gap: "0.4in" }}>
        <aside>
          <div style={{ fontSize: "18pt", fontWeight: 700, color: ACCENT, lineHeight: 1.1 }}>
            {resume.fullName || "Your Name"}
          </div>
          <div style={{ fontSize: "10pt", color: "#555", marginTop: "4px" }}>
            {resume.title}
          </div>

          <SectionWrap title="Contact" color={ACCENT}>
            <div style={{ fontSize: "9.5pt", lineHeight: 1.6 }}>
              {resume.email && (
                <div>
                  <a href={`mailto:${resume.email}`} style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                    {resume.email}
                  </a>
                </div>
              )}
              {resume.phone && <div>{resume.phone}</div>}
              {resume.location && <div>{resume.location}</div>}
              {resume.website && (
                <div>
                  <a href={resume.website} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                    {resume.website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                  </a>
                </div>
              )}
              {resume.linkedin && (
                <div>
                  <a href={resume.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                    LinkedIn
                  </a>
                </div>
              )}
              {resume.github && (
                <div>
                  <a href={resume.github} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                    GitHub
                  </a>
                </div>
              )}
            </div>
          </SectionWrap>

          {resume.skills && resume.skills.length > 0 && (
            <SectionWrap title="Skills" color={ACCENT}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {resume.skills.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: "9pt",
                      background: "#e8f0fe",
                      color: ACCENT,
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </SectionWrap>
          )}

          {resume.education && resume.education.length > 0 && (
            <SectionWrap title="Education" color={ACCENT}>
              {resume.education.map((e) => (
                <div key={e.id} style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 600, fontSize: "10pt" }}>{e.degree}</div>
                  <div style={{ fontSize: "9.5pt" }}>{e.school}</div>
                  <div style={{ fontSize: "9pt", color: "#666" }}>
                    {e.startDate} – {e.endDate}
                  </div>
                </div>
              ))}
            </SectionWrap>
          )}

          {resume.certifications && resume.certifications.length > 0 && (
            <SectionWrap title="Certifications" color={ACCENT}>
              {resume.certifications.map((c) => (
                <div key={c.id} style={{ marginBottom: "10px" }}>
                  <div style={{ fontWeight: 600, fontSize: "10pt" }}>{c.name}</div>
                  <div style={{ fontSize: "9.5pt" }}>{c.issuer}</div>
                  {c.date && <div style={{ fontSize: "9pt", color: "#666" }}>{c.date}</div>}
                </div>
              ))}
            </SectionWrap>
          )}

          {resume.languages && resume.languages.length > 0 && (
            <SectionWrap title="Languages" color={ACCENT}>
              <div style={{ fontSize: "9.5pt", lineHeight: 1.5 }}>
                {resume.languages.map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600 }}>{l.name}</span>
                    <span style={{ color: "#666", fontSize: "9pt" }}>{l.proficiency}</span>
                  </div>
                ))}
              </div>
            </SectionWrap>
          )}
        </aside>

        <main>
          {resume.summary && (
            <section style={{ marginBottom: "14px" }}>
              <SectionTitle color={ACCENT}>Summary</SectionTitle>
              <p style={{ margin: 0 }}>{resume.summary}</p>
            </section>
          )}

          {resume.experience && resume.experience.length > 0 && (
            <section style={{ marginBottom: "14px" }}>
              <SectionTitle color={ACCENT}>Experience</SectionTitle>
              {resume.experience.map((x) => (
                <div key={x.id} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 600 }}>
                      {x.title} <span style={{ color: ACCENT }}>· {x.company}</span>
                    </div>
                    <div style={{ fontSize: "9.5pt", color: "#666" }}>
                      {x.startDate} – {x.endDate}
                    </div>
                  </div>
                  {x.location && (
                    <div style={{ fontSize: "9pt", color: "#888" }}>{x.location}</div>
                  )}
                  <Bullets items={x.bullets} />
                </div>
              ))}
            </section>
          )}

          {resume.projects && resume.projects.length > 0 && (
            <section>
              <SectionTitle color={ACCENT}>Projects</SectionTitle>
              {resume.projects.map((p) => (
                <div key={p.id} style={{ marginBottom: "12px" }}>
                  <div style={{ fontWeight: 600 }}>
                    {p.link ? (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none" }} className="hover:underline">
                        {p.name} ↗
                      </a>
                    ) : (
                      p.name
                    )}
                  </div>
                  <div style={{ fontSize: "9.5pt", color: "#333", marginTop: "2px" }}>{p.description}</div>
                  {p.techStack && p.techStack.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px" }}>
                      {p.techStack.map((t, i) => (
                        <span key={i} style={{ fontSize: "8.5pt", background: "#e8f0fe", color: ACCENT, padding: "1px 6px", borderRadius: "8px", fontWeight: 500 }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </main>
      </div>
    </Page>
  );
}

function SectionWrap({ title, color, children }) {
  return (
    <div style={{ marginTop: "18px" }}>
      <SectionTitle color={color}>{title}</SectionTitle>
      {children}
    </div>
  );
}
