import React from "react";
import { Page, SectionTitle, Bullets, ContactLine } from "./shared";

export function ClassicTemplate({ resume }) {
  const columns = resume.columns || 1;

  if (columns === 2) {
    return (
      <Page>
        <header style={{ textAlign: "center", marginBottom: "14px" }}>
          <h1 style={{ fontSize: "22pt", fontWeight: 700, margin: 0, fontFamily: "Georgia, serif" }}>
            {resume.fullName || "Your Name"}
          </h1>
          <div style={{ fontSize: "11pt", marginTop: "2px" }}>{resume.title}</div>
          <div style={{ marginTop: "4px" }}>
            <ContactLine resume={resume} />
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2.2fr", gap: "0.25in", marginTop: "14px" }}>
          <aside style={{ borderRight: "1px solid #eee", paddingRight: "0.2in" }}>
            {resume.skills && resume.skills.length > 0 && (
              <Section title="Skills">
                <div>{resume.skills.join(", ")}</div>
              </Section>
            )}
            {resume.education && resume.education.length > 0 && (
              <Section title="Education">
                {resume.education.map((e) => (
                  <div key={e.id} style={{ marginBottom: "6px" }}>
                    <div style={{ fontWeight: 700 }}>{e.degree}</div>
                    <div style={{ fontSize: "9.5pt" }}>{e.school}</div>
                    <div style={{ fontStyle: "italic", fontSize: "9pt", color: "#666" }}>
                      {e.startDate} – {e.endDate}
                    </div>
                  </div>
                ))}
              </Section>
            )}
            {resume.certifications && resume.certifications.length > 0 && (
              <Section title="Certifications">
                {resume.certifications.map((c) => (
                  <div key={c.id} style={{ marginBottom: "6px" }}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    {c.issuer && <div style={{ fontStyle: "italic", color: "#555" }}>{c.issuer}</div>}
                    <div style={{ fontStyle: "italic", fontSize: "9pt", color: "#666" }}>{c.date}</div>
                  </div>
                ))}
              </Section>
            )}
            {resume.languages && resume.languages.length > 0 && (
              <Section title="Languages">
                <div>
                  {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(" · ")}
                </div>
              </Section>
            )}
          </aside>
          <main>
            {resume.summary && (
              <Section title="Professional Summary">
                <p style={{ margin: 0 }}>{resume.summary}</p>
              </Section>
            )}
            {resume.experience && resume.experience.length > 0 && (
              <Section title="Experience">
                {resume.experience.map((x) => (
                  <div key={x.id} style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 700 }}>
                        {x.title}, {x.company}
                      </div>
                      <div style={{ fontStyle: "italic" }}>
                        {x.startDate} – {x.endDate}
                      </div>
                    </div>
                    {x.location && <div style={{ fontStyle: "italic", color: "#666" }}>{x.location}</div>}
                    <Bullets items={x.bullets} />
                  </div>
                ))}
              </Section>
            )}
            {resume.projects && resume.projects.length > 0 && (
              <Section title="Projects">
                {resume.projects.map((p) => (
                  <div key={p.id} style={{ marginBottom: "10px" }}>
                    <div style={{ fontWeight: 700 }}>
                      {p.link ? (
                        <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                          {p.name}
                        </a>
                      ) : (
                        p.name
                      )}
                    </div>
                    <div style={{ marginTop: "2px" }}>{p.description}</div>
                    {p.techStack && p.techStack.length > 0 && (
                      <div style={{ marginTop: "4px", fontSize: "9pt", color: "#555" }}>
                        <strong>Stack:</strong> {p.techStack.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </Section>
            )}
          </main>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <header style={{ textAlign: "center", marginBottom: "14px" }}>
        <h1 style={{ fontSize: "22pt", fontWeight: 700, margin: 0, fontFamily: "Georgia, serif" }}>
          {resume.fullName || "Your Name"}
        </h1>
        <div style={{ fontSize: "11pt", marginTop: "2px" }}>{resume.title}</div>
        <div style={{ marginTop: "4px" }}>
          <ContactLine resume={resume} />
        </div>
      </header>

      {resume.summary && (
        <Section title="Professional Summary">
          <p style={{ margin: 0 }}>{resume.summary}</p>
        </Section>
      )}

      {resume.experience && resume.experience.length > 0 && (
        <Section title="Experience">
          {resume.experience.map((x) => (
            <div key={x.id} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>
                  {x.title}, {x.company}
                </div>
                <div style={{ fontStyle: "italic" }}>
                  {x.startDate} – {x.endDate}
                </div>
              </div>
              {x.location && <div style={{ fontStyle: "italic", color: "#666" }}>{x.location}</div>}
              <Bullets items={x.bullets} />
            </div>
          ))}
        </Section>
      )}

      {resume.education && resume.education.length > 0 && (
        <Section title="Education">
          {resume.education.map((e) => (
            <div key={e.id} style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>
                  {e.degree}, {e.school}
                </div>
                <div style={{ fontStyle: "italic" }}>
                  {e.startDate} – {e.endDate}
                </div>
              </div>
              {e.details && <div>{e.details}</div>}
            </div>
          ))}
        </Section>
      )}

      {resume.skills && resume.skills.length > 0 && (
        <Section title="Skills">
          <div>{resume.skills.join(" · ")}</div>
        </Section>
      )}

      {resume.projects && resume.projects.length > 0 && (
        <Section title="Projects">
          {resume.projects.map((p) => (
            <div key={p.id} style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 700 }}>
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                    {p.name}
                  </a>
                ) : (
                  p.name
                )}
              </div>
              <div style={{ marginTop: "2px" }}>{p.description}</div>
              {p.techStack && p.techStack.length > 0 && (
                <div style={{ marginTop: "4px", fontSize: "9pt", color: "#555" }}>
                  <strong>Stack:</strong> {p.techStack.join(", ")}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {resume.certifications && resume.certifications.length > 0 && (
        <Section title="Certifications">
          {resume.certifications.map((c) => (
            <div key={c.id} style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontStyle: "italic" }}>{c.date}</div>
              </div>
              {c.issuer && <div style={{ fontStyle: "italic", color: "#555" }}>{c.issuer}</div>}
            </div>
          ))}
        </Section>
      )}

      {resume.languages && resume.languages.length > 0 && (
        <Section title="Languages">
          <div>
            {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(" · ")}
          </div>
        </Section>
      )}
    </Page>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: "12px" }}>
      <SectionTitle underline>{title}</SectionTitle>
      {children}
    </section>
  );
}
