import React from "react";
import { Page, Bullets } from "./shared";

const ACCENT = "#ea4335";

export function CreativeTemplate({ resume }) {
  const columns = resume.columns || 1;

  if (columns === 2) {
    return (
      <Page>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "14px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #fff5f5 0%, #fef3c7 100%)",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: ACCENT,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22pt",
              fontWeight: 700,
            }}
          >
            {(resume.fullName || "?").charAt(0)}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "20pt", fontWeight: 700 }}>
              {resume.fullName || "Your Name"}
            </h1>
            <div style={{ color: ACCENT, fontWeight: 600 }}>{resume.title}</div>
            <div style={{ fontSize: "9.5pt", color: "#555", marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {resume.email && (
                <a href={`mailto:${resume.email}`} style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                  {resume.email}
                </a>
              )}
              {resume.email && (resume.phone || resume.location || resume.linkedin || resume.github) && <span>·</span>}
              {resume.phone && <span>{resume.phone}</span>}
              {resume.phone && (resume.location || resume.linkedin || resume.github) && <span>·</span>}
              {resume.location && <span>{resume.location}</span>}
              {resume.location && (resume.linkedin || resume.github) && <span>·</span>}
              {resume.linkedin && (
                <a href={resume.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                  LinkedIn
                </a>
              )}
              {resume.linkedin && resume.github && <span>·</span>}
              {resume.github && (
                <a href={resume.github} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                  GitHub
                </a>
              )}
            </div>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 2fr", gap: "0.25in" }}>
          <aside>
            {resume.skills && resume.skills.length > 0 && (
              <Card title="Skills" color={ACCENT}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {resume.skills.map((s, i) => (
                    <span
                      key={i}
                      style={{
                        background: "#fff",
                        border: `1px solid ${ACCENT}`,
                        color: ACCENT,
                        fontSize: "9pt",
                        padding: "2px 8px",
                        borderRadius: "999px",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </Card>
            )}
            {resume.education && resume.education.length > 0 && (
              <Card title="Education" color={ACCENT}>
                {resume.education.map((e) => (
                  <div key={e.id} style={{ marginBottom: "6px" }}>
                    <div style={{ fontWeight: 600 }}>{e.degree}</div>
                    <div style={{ fontSize: "9.5pt" }}>{e.school}</div>
                    <div style={{ fontSize: "9pt", color: "#666" }}>
                      {e.startDate} – {e.endDate}
                    </div>
                  </div>
                ))}
              </Card>
            )}
            {resume.certifications && resume.certifications.length > 0 && (
              <Card title="Certifications" color={ACCENT}>
                {resume.certifications.map((c) => (
                  <div key={c.id} style={{ marginBottom: "6px" }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: "9pt", color: "#555" }}>{c.issuer} ({c.date})</div>
                  </div>
                ))}
              </Card>
            )}
            {resume.languages && resume.languages.length > 0 && (
              <Card title="Languages" color={ACCENT}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {resume.languages.map((l) => (
                    <span
                      key={l.id}
                      style={{
                        background: "#fff",
                        border: `1px solid ${ACCENT}`,
                        color: ACCENT,
                        fontSize: "9pt",
                        padding: "2px 8px",
                        borderRadius: "999px",
                      }}
                    >
                      {l.name} ({l.proficiency})
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </aside>
          <main>
            {resume.summary && (
              <Card title="About me" color={ACCENT}>
                <p style={{ margin: 0 }}>{resume.summary}</p>
              </Card>
            )}
            {resume.experience && resume.experience.length > 0 && (
              <Card title="Experience" color={ACCENT}>
                {resume.experience.map((x) => (
                  <div key={x.id} style={{ marginBottom: "10px" }}>
                    <div style={{ fontWeight: 600 }}>
                      {x.title} <span style={{ color: ACCENT }}>@ {x.company}</span>
                    </div>
                    <div style={{ fontSize: "9.5pt", color: "#666" }}>
                      {x.startDate} – {x.endDate}
                      {x.location ? ` · ${x.location}` : ""}
                    </div>
                    <Bullets items={x.bullets} />
                  </div>
                ))}
              </Card>
            )}
            {resume.projects && resume.projects.length > 0 && (
              <Card title="Projects" color={ACCENT}>
                {resume.projects.map((p) => (
                  <div key={p.id} style={{ marginBottom: "10px" }}>
                    <div style={{ fontWeight: 600 }}>
                      {p.link ? (
                        <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none" }} className="hover:underline">
                          {p.name} ↗
                        </a>
                      ) : (
                        p.name
                      )}
                    </div>
                    <div style={{ fontSize: "9.5pt", color: "#555", marginTop: "2px" }}>{p.description}</div>
                    {p.techStack && p.techStack.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px" }}>
                        {p.techStack.map((t, i) => (
                          <span key={i} style={{ fontSize: "8.5pt", background: "#fff5f5", color: ACCENT, border: `1px solid ${ACCENT}30`, padding: "1px 6px", borderRadius: "8px" }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </main>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "14px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, #fff5f5 0%, #fef3c7 100%)",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: ACCENT,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22pt",
            fontWeight: 700,
          }}
        >
          {(resume.fullName || "?").charAt(0)}
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: "20pt", fontWeight: 700 }}>
            {resume.fullName || "Your Name"}
          </h1>
          <div style={{ color: ACCENT, fontWeight: 600 }}>{resume.title}</div>
          <div style={{ fontSize: "9.5pt", color: "#555", marginTop: "2px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {resume.email && (
              <a href={`mailto:${resume.email}`} style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                {resume.email}
              </a>
            )}
            {resume.email && (resume.phone || resume.location || resume.linkedin || resume.github) && <span>·</span>}
            {resume.phone && <span>{resume.phone}</span>}
            {resume.phone && (resume.location || resume.linkedin || resume.github) && <span>·</span>}
            {resume.location && <span>{resume.location}</span>}
            {resume.location && (resume.linkedin || resume.github) && <span>·</span>}
            {resume.linkedin && (
              <a href={resume.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                LinkedIn
              </a>
            )}
            {resume.linkedin && resume.github && <span>·</span>}
            {resume.github && (
              <a href={resume.github} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }} className="hover:text-primary transition-colors">
                GitHub
              </a>
            )}
          </div>
        </div>
      </header>

      {resume.summary && (
        <Card title="About me" color={ACCENT}>
          <p style={{ margin: 0 }}>{resume.summary}</p>
        </Card>
      )}

      {resume.experience && resume.experience.length > 0 && (
        <Card title="Experience" color={ACCENT}>
          {resume.experience.map((x) => (
            <div key={x.id} style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 600 }}>
                {x.title} <span style={{ color: ACCENT }}>@ {x.company}</span>
              </div>
              <div style={{ fontSize: "9.5pt", color: "#666" }}>
                {x.startDate} – {x.endDate}
                {x.location ? ` · ${x.location}` : ""}
              </div>
              <Bullets items={x.bullets} />
            </div>
          ))}
        </Card>
      )}

      {resume.projects && resume.projects.length > 0 && (
        <Card title="Projects" color={ACCENT}>
          {resume.projects.map((p) => (
            <div key={p.id} style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 600 }}>
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none" }} className="hover:underline">
                    {p.name} ↗
                  </a>
                ) : (
                  p.name
                )}
              </div>
              <div style={{ fontSize: "9.5pt", color: "#555", marginTop: "2px" }}>{p.description}</div>
              {p.techStack && p.techStack.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px" }}>
                  {p.techStack.map((t, i) => (
                    <span key={i} style={{ fontSize: "8.5pt", background: "#fff5f5", color: ACCENT, border: `1px solid ${ACCENT}30`, padding: "1px 6px", borderRadius: "8px" }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {resume.skills && resume.skills.length > 0 && (
          <Card title="Skills" color={ACCENT}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {resume.skills.map((s, i) => (
                <span
                  key={i}
                  style={{
                    background: "#fff",
                    border: `1px solid ${ACCENT}`,
                    color: ACCENT,
                    fontSize: "9pt",
                    padding: "2px 8px",
                    borderRadius: "999px",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </Card>
        )}
        {resume.education && resume.education.length > 0 && (
          <Card title="Education" color={ACCENT}>
            {resume.education.map((e) => (
              <div key={e.id} style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 600 }}>{e.degree}</div>
                <div style={{ fontSize: "9.5pt" }}>{e.school}</div>
                <div style={{ fontSize: "9pt", color: "#666" }}>
                  {e.startDate} – {e.endDate}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
        {resume.certifications && resume.certifications.length > 0 && (
          <Card title="Certifications" color={ACCENT}>
            {resume.certifications.map((c) => (
              <div key={c.id} style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: "9pt", color: "#555" }}>{c.issuer} ({c.date})</div>
              </div>
            ))}
          </Card>
        )}
        {resume.languages && resume.languages.length > 0 && (
          <Card title="Languages" color={ACCENT}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {resume.languages.map((l) => (
                <span
                  key={l.id}
                  style={{
                    background: "#fff",
                    border: `1px solid ${ACCENT}`,
                    color: ACCENT,
                    fontSize: "9pt",
                    padding: "2px 8px",
                    borderRadius: "999px",
                  }}
                >
                  {l.name} ({l.proficiency})
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Page>
  );
}

function Card({ title, color, children }) {
  return (
    <section
      style={{
        marginBottom: "12px",
        border: "1px solid #eee",
        borderRadius: "12px",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: "9pt",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color,
          marginBottom: "6px",
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}
