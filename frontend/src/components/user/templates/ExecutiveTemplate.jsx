import React from "react";
import { Page, SectionTitle, Bullets } from "./shared";

const ACCENT = "#0f3057";

export function ExecutiveTemplate({ resume }) {
  const columns = resume.columns || 1;

  if (columns === 2) {
    return (
      <Page>
        <header style={{ background: ACCENT, color: "white", padding: "16px 20px", margin: "-0.6in -0.6in 16px -0.6in" }}>
          <h1 style={{ fontSize: "24pt", fontWeight: 700, margin: 0, fontFamily: "Georgia, serif" }}>
            {resume.fullName || "Your Name"}
          </h1>
          <div style={{ fontSize: "11pt", marginTop: "4px", opacity: 0.9 }}>{resume.title}</div>
          <div style={{ fontSize: "9.5pt", marginTop: "6px", opacity: 0.85, display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {resume.email && (
              <a href={`mailto:${resume.email}`} style={{ color: "white", textDecoration: "none" }} className="hover:underline">
                {resume.email}
              </a>
            )}
            {resume.email && (resume.phone || resume.location || resume.linkedin || resume.github) && <span>·</span>}
            {resume.phone && <span>{resume.phone}</span>}
            {resume.phone && (resume.location || resume.linkedin || resume.github) && <span>·</span>}
            {resume.location && <span>{resume.location}</span>}
            {resume.location && (resume.linkedin || resume.github) && <span>·</span>}
            {resume.linkedin && (
              <a href={resume.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "white", textDecoration: "none" }} className="hover:underline">
                LinkedIn
              </a>
            )}
            {resume.linkedin && resume.github && <span>·</span>}
            {resume.github && (
              <a href={resume.github} target="_blank" rel="noopener noreferrer" style={{ color: "white", textDecoration: "none" }} className="hover:underline">
                GitHub
              </a>
            )}
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.3in" }}>
          <aside style={{ borderRight: "1px solid #eee", paddingRight: "0.2in" }}>
            {resume.skills && resume.skills.length > 0 && (
              <section style={{ marginBottom: "12px" }}>
                <SectionTitle color={ACCENT} underline>Core Competencies</SectionTitle>
                <div>{resume.skills.join(" · ")}</div>
              </section>
            )}
            {resume.education && resume.education.length > 0 && (
              <section style={{ marginBottom: "12px" }}>
                <SectionTitle color={ACCENT} underline>Education</SectionTitle>
                {resume.education.map((e) => (
                  <div key={e.id} style={{ marginBottom: "6px" }}>
                    <div style={{ fontWeight: 700 }}>{e.degree}</div>
                    <div>{e.school}</div>
                    <div style={{ fontSize: "9pt", color: "#666" }}>
                      {e.startDate} – {e.endDate}
                    </div>
                  </div>
                ))}
              </section>
            )}
            {resume.certifications && resume.certifications.length > 0 && (
              <section style={{ marginBottom: "12px" }}>
                <SectionTitle color={ACCENT} underline>Certifications</SectionTitle>
                {resume.certifications.map((c) => (
                  <div key={c.id} style={{ marginBottom: "6px" }}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: "9.5pt", color: "#444" }}>{c.issuer} ({c.date})</div>
                  </div>
                ))}
              </section>
            )}
            {resume.languages && resume.languages.length > 0 && (
              <section>
                <SectionTitle color={ACCENT} underline>Languages</SectionTitle>
                <div style={{ fontSize: "9.5pt", color: "#444" }}>
                  {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(" · ")}
                </div>
              </section>
            )}
          </aside>
          <main>
            {resume.summary && (
              <section style={{ marginBottom: "12px" }}>
                <SectionTitle color={ACCENT} underline>Executive Summary</SectionTitle>
                <p style={{ margin: 0 }}>{resume.summary}</p>
              </section>
            )}
            {resume.experience && resume.experience.length > 0 && (
              <section style={{ marginBottom: "12px" }}>
                <SectionTitle color={ACCENT} underline>Professional Experience</SectionTitle>
                {resume.experience.map((x) => (
                  <div key={x.id} style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 700, color: ACCENT }}>{x.title}</div>
                      <div style={{ fontSize: "9.5pt" }}>
                        {x.startDate} – {x.endDate}
                      </div>
                    </div>
                    <div style={{ fontStyle: "italic" }}>
                      {x.company}
                      {x.location ? ` | ${x.location}` : ""}
                    </div>
                    <Bullets items={x.bullets} />
                  </div>
                ))}
              </section>
            )}
            {resume.projects && resume.projects.length > 0 && (
              <section style={{ marginBottom: "12px" }}>
                <SectionTitle color={ACCENT} underline>Key Projects</SectionTitle>
                {resume.projects.map((p) => (
                  <div key={p.id} style={{ marginBottom: "10px" }}>
                    <div style={{ fontWeight: 700, color: ACCENT }}>
                      {p.link ? (
                        <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                          {p.name}
                        </a>
                      ) : (
                        p.name
                      )}
                    </div>
                    <div style={{ fontSize: "9.5pt", marginTop: "2px" }}>{p.description}</div>
                    {p.techStack && p.techStack.length > 0 && (
                      <div style={{ marginTop: "3px", fontSize: "9pt", color: "#555" }}>
                        <strong>Stack:</strong> {p.techStack.join(", ")}
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

  return (
    <Page>
      <header style={{ background: ACCENT, color: "white", padding: "16px 20px", margin: "-0.6in -0.6in 16px -0.6in" }}>
        <h1 style={{ fontSize: "24pt", fontWeight: 700, margin: 0, fontFamily: "Georgia, serif" }}>
          {resume.fullName || "Your Name"}
        </h1>
        <div style={{ fontSize: "11pt", marginTop: "4px", opacity: 0.9 }}>{resume.title}</div>
        <div style={{ fontSize: "9.5pt", marginTop: "6px", opacity: 0.85, display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {resume.email && (
            <a href={`mailto:${resume.email}`} style={{ color: "white", textDecoration: "none" }} className="hover:underline">
              {resume.email}
            </a>
          )}
          {resume.email && (resume.phone || resume.location || resume.linkedin || resume.github) && <span>·</span>}
          {resume.phone && <span>{resume.phone}</span>}
          {resume.phone && (resume.location || resume.linkedin || resume.github) && <span>·</span>}
          {resume.location && <span>{resume.location}</span>}
          {resume.location && (resume.linkedin || resume.github) && <span>·</span>}
          {resume.linkedin && (
            <a href={resume.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "white", textDecoration: "none" }} className="hover:underline">
              LinkedIn
            </a>
          )}
          {resume.linkedin && resume.github && <span>·</span>}
          {resume.github && (
            <a href={resume.github} target="_blank" rel="noopener noreferrer" style={{ color: "white", textDecoration: "none" }} className="hover:underline">
              GitHub
            </a>
          )}
        </div>
      </header>

      {resume.summary && (
        <section style={{ marginBottom: "12px" }}>
          <SectionTitle color={ACCENT} underline>
            Executive Summary
          </SectionTitle>
          <p style={{ margin: 0 }}>{resume.summary}</p>
        </section>
      )}

      {resume.experience && resume.experience.length > 0 && (
        <section style={{ marginBottom: "12px" }}>
          <SectionTitle color={ACCENT} underline>
            Professional Experience
          </SectionTitle>
          {resume.experience.map((x) => (
            <div key={x.id} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, color: ACCENT }}>{x.title}</div>
                <div style={{ fontSize: "9.5pt" }}>
                  {x.startDate} – {x.endDate}
                </div>
              </div>
              <div style={{ fontStyle: "italic" }}>
                {x.company}
                {x.location ? ` | ${x.location}` : ""}
              </div>
              <Bullets items={x.bullets} />
            </div>
          ))}
        </section>
      )}

      {resume.projects && resume.projects.length > 0 && (
        <section style={{ marginBottom: "12px" }}>
          <SectionTitle color={ACCENT} underline>
            Key Projects
          </SectionTitle>
          {resume.projects.map((p) => (
            <div key={p.id} style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 700, color: ACCENT }}>
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </div>
              <div style={{ fontSize: "9.5pt", marginTop: "2px" }}>{p.description}</div>
              {p.techStack && p.techStack.length > 0 && (
                <div style={{ marginTop: "3px", fontSize: "9pt", color: "#555" }}>
                  <strong>Stack:</strong> {p.techStack.join(", ")}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {resume.education && resume.education.length > 0 && (
          <section>
            <SectionTitle color={ACCENT} underline>
              Education
            </SectionTitle>
            {resume.education.map((e) => (
              <div key={e.id} style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 700 }}>{e.degree}</div>
                <div>{e.school}</div>
                <div style={{ fontSize: "9pt", color: "#666" }}>
                  {e.startDate} – {e.endDate}
                </div>
              </div>
            ))}
          </section>
        )}
        {resume.skills && resume.skills.length > 0 && (
          <section>
            <SectionTitle color={ACCENT} underline>
              Core Competencies
            </SectionTitle>
            <div>{resume.skills.join(" · ")}</div>
          </section>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "12px" }}>
        {resume.certifications && resume.certifications.length > 0 && (
          <section>
            <SectionTitle color={ACCENT} underline>
              Certifications
            </SectionTitle>
            {resume.certifications.map((c) => (
              <div key={c.id} style={{ marginBottom: "6px" }}>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: "9.5pt", color: "#444" }}>{c.issuer} ({c.date})</div>
              </div>
            ))}
          </section>
        )}
        {resume.languages && resume.languages.length > 0 && (
          <section>
            <SectionTitle color={ACCENT} underline>
              Languages
            </SectionTitle>
            <div style={{ fontSize: "9.5pt", color: "#444" }}>
              {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(" · ")}
            </div>
          </section>
        )}
      </div>
    </Page>
  );
}
