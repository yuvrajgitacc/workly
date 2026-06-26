import React from "react";
import { Page, Bullets, ContactLine } from "./shared";

export function MinimalTemplate({ resume }) {
  const columns = resume.columns || 1;

  if (columns === 2) {
    return (
      <Page>
        <header style={{ marginBottom: "18px" }}>
          <h1 style={{ fontSize: "20pt", fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
            {resume.fullName || "Your Name"}
          </h1>
          <div style={{ fontSize: "10pt", color: "#666", marginTop: "4px" }}>{resume.title}</div>
          <div style={{ marginTop: "6px" }}>
            <ContactLine resume={resume} />
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: "0.25in" }}>
          <aside style={{ borderRight: "1px solid #eee", paddingRight: "0.15in" }}>
            {resume.skills && resume.skills.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Skills</div>
                <div style={{ color: "#444" }}>{resume.skills.join(", ")}</div>
              </div>
            )}
            {resume.education && resume.education.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Education</div>
                {resume.education.map((e) => (
                  <div key={e.id} style={{ marginBottom: "4px", fontSize: "9.5pt" }}>
                    <div style={{ fontWeight: 600 }}>{e.degree}</div>
                    <div>{e.school}</div>
                    <div style={{ color: "#666", fontSize: "9pt" }}>
                      {e.startDate} – {e.endDate}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {resume.certifications && resume.certifications.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Certifications</div>
                {resume.certifications.map((c) => (
                  <div key={c.id} style={{ marginBottom: "4px", fontSize: "9.5pt" }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <div style={{ color: "#666", fontSize: "9pt" }}>{c.issuer} ({c.date})</div>
                  </div>
                ))}
              </div>
            )}
            {resume.languages && resume.languages.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Languages</div>
                <div style={{ color: "#444", fontSize: "9.5pt" }}>
                  {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(", ")}
                </div>
              </div>
            )}
          </aside>
          <main>
            {resume.summary && <p style={{ marginTop: 0, marginBottom: "16px" }}>{resume.summary}</p>}
            
            {resume.experience && resume.experience.map((x) => (
              <div key={x.id} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600 }}>{x.title}</div>
                  <div style={{ color: "#666", fontSize: "9.5pt" }}>
                    {x.startDate} – {x.endDate}
                  </div>
                </div>
                <div style={{ color: "#666", fontSize: "10pt" }}>
                  {x.company}
                  {x.location ? ` · ${x.location}` : ""}
                </div>
                <Bullets items={x.bullets} />
              </div>
            ))}

            {resume.projects && resume.projects.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>Projects</div>
                {resume.projects.map((p) => (
                  <div key={p.id} style={{ marginBottom: "10px" }}>
                    <div style={{ fontWeight: 600, fontSize: "10pt" }}>
                      {p.link ? (
                        <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                          {p.name}
                        </a>
                      ) : (
                        p.name
                      )}
                    </div>
                    <div style={{ color: "#444", fontSize: "9.5pt", marginTop: "2px" }}>{p.description}</div>
                    {p.techStack && p.techStack.length > 0 && (
                      <div style={{ marginTop: "3px", fontSize: "9pt", color: "#666" }}>
                        {p.techStack.join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <header style={{ marginBottom: "18px" }}>
        <h1 style={{ fontSize: "20pt", fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
          {resume.fullName || "Your Name"}
        </h1>
        <div style={{ fontSize: "10pt", color: "#666", marginTop: "4px" }}>{resume.title}</div>
        <div style={{ marginTop: "6px" }}>
          <ContactLine resume={resume} />
        </div>
      </header>

      {resume.summary && <p style={{ marginBottom: "16px" }}>{resume.summary}</p>}

      {resume.experience && resume.experience.map((x) => (
        <div key={x.id} style={{ marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 600 }}>{x.title}</div>
            <div style={{ color: "#666", fontSize: "9.5pt" }}>
              {x.startDate} – {x.endDate}
            </div>
          </div>
          <div style={{ color: "#666", fontSize: "10pt" }}>
            {x.company}
            {x.location ? ` · ${x.location}` : ""}
          </div>
          <Bullets items={x.bullets} />
        </div>
      ))}

      {resume.education && resume.education.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Education</div>
          {resume.education.map((e) => (
            <div key={e.id} style={{ marginBottom: "4px" }}>
              {e.degree} — {e.school},{" "}
              <span style={{ color: "#666" }}>
                {e.startDate} – {e.endDate}
              </span>
            </div>
          ))}
        </div>
      )}

      {resume.skills && resume.skills.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Skills</div>
          <div style={{ color: "#444" }}>{resume.skills.join(", ")}</div>
        </div>
      )}

      {resume.projects && resume.projects.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Projects</div>
          {resume.projects.map((p) => (
            <div key={p.id} style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 600, fontSize: "10pt" }}>
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </div>
              <div style={{ color: "#444", fontSize: "9.5pt", marginTop: "2px" }}>{p.description}</div>
              {p.techStack && p.techStack.length > 0 && (
                <div style={{ marginTop: "3px", fontSize: "9pt", color: "#666" }}>
                  {p.techStack.join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {resume.certifications && resume.certifications.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Certifications</div>
          {resume.certifications.map((c) => (
            <div key={c.id} style={{ marginBottom: "4px" }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span> — {c.issuer} ({c.date})
            </div>
          ))}
        </div>
      )}

      {resume.languages && resume.languages.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Languages</div>
          <div style={{ color: "#444" }}>
            {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(", ")}
          </div>
        </div>
      )}
    </Page>
  );
}
