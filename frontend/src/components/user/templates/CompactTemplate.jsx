import React from "react";
import { Page, SectionTitle, Bullets, ContactLine } from "./shared";

const ACCENT = "#0b8043";

export function CompactTemplate({ resume }) {
  const columns = resume.columns || 2;

  if (columns === 1) {
    return (
      <Page>
        <header style={{ borderBottom: `2px solid ${ACCENT}`, paddingBottom: "8px", marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h1 style={{ fontSize: "18pt", fontWeight: 700, margin: 0 }}>
              {resume.fullName || "Your Name"}
            </h1>
            <div style={{ color: ACCENT, fontWeight: 600 }}>{resume.title}</div>
          </div>
          <div style={{ marginTop: "2px" }}>
            <ContactLine resume={resume} />
          </div>
        </header>

        {resume.summary && (
          <p style={{ marginTop: 0, marginBottom: "10px", fontSize: "10pt" }}>{resume.summary}</p>
        )}

        {resume.experience && resume.experience.length > 0 && (
          <section style={{ marginBottom: "10px" }}>
            <SectionTitle color={ACCENT}>Experience</SectionTitle>
            {resume.experience.map((x) => (
              <div key={x.id} style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: "10pt" }}>
                    {x.title}, {x.company}
                  </div>
                  <div style={{ fontSize: "9pt", color: "#666" }}>
                    {x.startDate}–{x.endDate}
                  </div>
                </div>
                <Bullets items={x.bullets} />
              </div>
            ))}
          </section>
        )}

        {resume.projects && resume.projects.length > 0 && (
          <section style={{ marginBottom: "10px" }}>
            <SectionTitle color={ACCENT}>Projects</SectionTitle>
            {resume.projects.map((p) => (
              <div key={p.id} style={{ marginBottom: "8px", fontSize: "9.5pt" }}>
                <div style={{ fontWeight: 600 }}>
                  {p.link ? (
                    <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none" }} className="hover:underline">
                      {p.name} ↗
                    </a>
                  ) : (
                    p.name
                  )}
                </div>
                <div style={{ color: "#333", marginTop: "1px" }}>{p.description}</div>
                {p.techStack && p.techStack.length > 0 && (
                  <div style={{ marginTop: "2px", color: "#555", fontSize: "9pt" }}>
                    <strong>Stack:</strong> {p.techStack.join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {resume.skills && resume.skills.length > 0 && (
          <section style={{ marginBottom: "10px" }}>
            <SectionTitle color={ACCENT}>Skills</SectionTitle>
            <div style={{ fontSize: "9.5pt" }}>{resume.skills.join(" · ")}</div>
          </section>
        )}

        {resume.education && resume.education.length > 0 && (
          <section style={{ marginBottom: "10px" }}>
            <SectionTitle color={ACCENT}>Education</SectionTitle>
            {resume.education.map((e) => (
              <div key={e.id} style={{ marginBottom: "4px", fontSize: "9.5pt" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600 }}>{e.degree}, {e.school}</div>
                  <div style={{ color: "#666", fontSize: "9pt" }}>{e.startDate}–{e.endDate}</div>
                </div>
              </div>
            ))}
          </section>
        )}

        {resume.certifications && resume.certifications.length > 0 && (
          <section style={{ marginBottom: "10px" }}>
            <SectionTitle color={ACCENT}>Certifications</SectionTitle>
            {resume.certifications.map((c) => (
              <div key={c.id} style={{ marginBottom: "4px", fontSize: "9.5pt" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600 }}>{c.name} ({c.issuer})</div>
                  <div style={{ color: "#666", fontSize: "9pt" }}>{c.date}</div>
                </div>
              </div>
            ))}
          </section>
        )}

        {resume.languages && resume.languages.length > 0 && (
          <section style={{ marginBottom: "10px" }}>
            <SectionTitle color={ACCENT}>Languages</SectionTitle>
            <div style={{ fontSize: "9.5pt" }}>
              {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(" · ")}
            </div>
          </section>
        )}
      </Page>
    );
  }

  return (
    <Page>
      <header style={{ borderBottom: `2px solid ${ACCENT}`, paddingBottom: "8px", marginBottom: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 style={{ fontSize: "18pt", fontWeight: 700, margin: 0 }}>
            {resume.fullName || "Your Name"}
          </h1>
          <div style={{ color: ACCENT, fontWeight: 600 }}>{resume.title}</div>
        </div>
        <div style={{ marginTop: "2px" }}>
          <ContactLine resume={resume} />
        </div>
      </header>

      {resume.summary && (
        <p style={{ marginTop: 0, marginBottom: "10px", fontSize: "10pt" }}>{resume.summary}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px" }}>
        <div>
          {resume.experience && resume.experience.length > 0 && (
            <section>
              <SectionTitle color={ACCENT}>Experience</SectionTitle>
              {resume.experience.map((x) => (
                <div key={x.id} style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 600, fontSize: "10pt" }}>
                      {x.title}, {x.company}
                    </div>
                    <div style={{ fontSize: "9pt", color: "#666" }}>
                      {x.startDate}–{x.endDate}
                    </div>
                  </div>
                  <Bullets items={x.bullets} />
                </div>
              ))}
            </section>
          )}
        </div>
        <div>
          {resume.skills && resume.skills.length > 0 && (
            <section style={{ marginBottom: "10px" }}>
              <SectionTitle color={ACCENT}>Skills</SectionTitle>
              <div style={{ fontSize: "9.5pt" }}>{resume.skills.join(" · ")}</div>
            </section>
          )}
          {resume.education && resume.education.length > 0 && (
            <section style={{ marginBottom: "10px" }}>
              <SectionTitle color={ACCENT}>Education</SectionTitle>
              {resume.education.map((e) => (
                <div key={e.id} style={{ marginBottom: "4px", fontSize: "9.5pt" }}>
                  <div style={{ fontWeight: 600 }}>{e.degree}</div>
                  <div>{e.school}</div>
                  <div style={{ color: "#666", fontSize: "9pt" }}>
                    {e.startDate}–{e.endDate}
                  </div>
                </div>
              ))}
            </section>
          )}
          {resume.projects && resume.projects.length > 0 && (
            <section style={{ marginBottom: "10px" }}>
              <SectionTitle color={ACCENT}>Projects</SectionTitle>
              {resume.projects.map((p) => (
                <div key={p.id} style={{ marginBottom: "8px", fontSize: "9.5pt" }}>
                  <div style={{ fontWeight: 600 }}>
                    {p.link ? (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none" }} className="hover:underline">
                        {p.name} ↗
                      </a>
                    ) : (
                      p.name
                    )}
                  </div>
                  <div style={{ color: "#333", marginTop: "1px" }}>{p.description}</div>
                  {p.techStack && p.techStack.length > 0 && (
                    <div style={{ marginTop: "2px", color: "#555", fontSize: "9pt" }}>
                      {p.techStack.join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
          {resume.certifications && resume.certifications.length > 0 && (
            <section style={{ marginBottom: "10px" }}>
              <SectionTitle color={ACCENT}>Certifications</SectionTitle>
              {resume.certifications.map((c) => (
                <div key={c.id} style={{ marginBottom: "4px", fontSize: "9.5pt" }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: "#666", fontSize: "9pt" }}>{c.issuer} ({c.date})</div>
                </div>
              ))}
            </section>
          )}
          {resume.languages && resume.languages.length > 0 && (
            <section>
              <SectionTitle color={ACCENT}>Languages</SectionTitle>
              <div style={{ fontSize: "9.5pt" }}>
                {resume.languages.map((l) => `${l.name} (${l.proficiency})`).join(" · ")}
              </div>
            </section>
          )}
        </div>
      </div>
    </Page>
  );
}
