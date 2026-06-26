import hashlib
_orig_md5 = hashlib.md5
def _patched_md5(*args, **kwargs):
    kwargs.pop('usedforsecurity', None)
    return _orig_md5(*args, **kwargs)
hashlib.md5 = _patched_md5

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

NAVY = colors.HexColor("#1F2937")
ACCENT = colors.HexColor("#2E5BBA")
GRAY = colors.HexColor("#555555")
TEXT = colors.HexColor("#222222")


def _styles():
    ss = getSampleStyleSheet()
    return {
        "name": ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=18,
                                alignment=TA_CENTER, textColor=NAVY, spaceAfter=4),
        "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=11,
                                 alignment=TA_CENTER, textColor=ACCENT, spaceAfter=4),
        "contact": ParagraphStyle("contact", fontName="Helvetica", fontSize=9,
                                   alignment=TA_CENTER, textColor=GRAY, spaceAfter=10),
        "section": ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=11,
                                   textColor=NAVY, spaceBefore=10, spaceAfter=4,
                                   borderColor=ACCENT, borderWidth=0, leading=14),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5,
                                textColor=TEXT, leading=13),
        "bullet": ParagraphStyle("bullet", fontName="Helvetica", fontSize=9.5,
                                  textColor=TEXT, leading=13, leftIndent=12),
        "jobline": ParagraphStyle("jobline", fontName="Helvetica-Bold", fontSize=10.5,
                                   textColor=NAVY, spaceAfter=1),
        "dateline": ParagraphStyle("dateline", fontName="Helvetica-Oblique", fontSize=9,
                                    textColor=GRAY, alignment=TA_LEFT),
        "stack": ParagraphStyle("stack", fontName="Helvetica-Oblique", fontSize=8.5,
                                 textColor=GRAY, spaceAfter=6),
    }


def _section_heading(text, styles):
    """Section header with a bottom rule, built from a bordered table-free Paragraph + HR via a thin Spacer trick."""
    from reportlab.platypus import HRFlowable
    return [
        Paragraph(text.upper(), styles["section"]),
        HRFlowable(width="100%", thickness=1.3, color=ACCENT, spaceAfter=6, spaceBefore=0),
    ]


def render_resume_pdf(content: dict, output_path: str):
    """
    content: ResumeDraft.content (same schema as the React template expects)
    output_path: where to write the generated PDF
    """
    styles = _styles()
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        topMargin=0.45 * inch, bottomMargin=0.45 * inch,
        leftMargin=0.55 * inch, rightMargin=0.55 * inch,
    )
    story = []

    personal = content.get("personalInfo", {}) or {}
    summary = content.get("summary", "")
    education = content.get("education", []) or []
    skills = content.get("skills", []) or []
    experience = content.get("experience", []) or []
    projects = content.get("projects", []) or []
    certifications = content.get("certifications", []) or []
    languages = content.get("languages", []) or []

    # Header
    header_flowables = []
    header_flowables.append(Paragraph((personal.get("fullName") or "Your Name").upper(), styles["name"]))
    if personal.get("title"):
        header_flowables.append(Paragraph(personal["title"], styles["title"]))
    contact_line = "  |  ".join(filter(None, [
        personal.get("email"), personal.get("phone"), personal.get("location")
    ]))
    if contact_line:
        header_flowables.append(Paragraph(contact_line, styles["contact"]))

    links = []
    if personal.get("linkedin"):
        links.append(f'<link href="{personal["linkedin"]}" color="#2E5BBA">LinkedIn</link>')
    if personal.get("github"):
        links.append(f'<link href="{personal["github"]}" color="#2E5BBA">GitHub</link>')
    if personal.get("website"):
        links.append(f'<link href="{personal["website"]}" color="#2E5BBA">Portfolio</link>')
    if links:
        header_flowables.append(Paragraph("  |  ".join(links), styles["contact"]))

    columns_count = content.get("columns", 1)
    if columns_count == 2:
        left_story = []
        right_story = []

        # Skills
        if skills:
            left_story += _section_heading("Technical Skills", styles)
            if isinstance(skills, dict):
                for label, items in skills.items():
                    if items:
                        left_story.append(Paragraph(
                            f'<b>{label.title()}:</b> {", ".join(items)}', styles["body"]
                        ))
            else:
                left_story.append(Paragraph(", ".join(skills), styles["body"]))

        # Education
        if education:
            left_story += _section_heading("Education", styles)
            for edu in education:
                degree_line = edu.get("degree", "")
                if edu.get("school"):
                    degree_line += f', {edu["school"]}'
                dates = " – ".join(filter(None, [edu.get("startDate"), edu.get("endDate")]))
                left_story.append(Paragraph(
                    f'<para><b>{degree_line}</b><br/>'
                    f'<font color="#555555"><i>{dates}</i></font></para>',
                    styles["body"]
                ))
                if edu.get("location"):
                    left_story.append(Paragraph(edu["location"], styles["stack"]))
                left_story.append(Spacer(1, 4))

        # Certifications
        if certifications:
            left_story += _section_heading("Certifications", styles)
            for cert in certifications:
                line = cert.get("name", "")
                if cert.get("link"):
                    line = f'<link href="{cert["link"]}" color="#2E5BBA">{line}</link>'
                if cert.get("issuer"):
                    line += f'<br/>{cert["issuer"]}'
                if cert.get("date"):
                    line += f' ({cert["date"]})'
                left_story.append(Paragraph(line, styles["body"]))
                left_story.append(Spacer(1, 4))

        # Languages
        if languages:
            left_story += _section_heading("Languages", styles)
            lang_list = []
            for l in languages:
                name = l.get("name", "")
                prof = l.get("proficiency", "")
                if prof:
                    lang_list.append(f"{name} ({prof})")
                else:
                    lang_list.append(name)
            lang_str = ", ".join(lang_list)
            left_story.append(Paragraph(lang_str, styles["body"]))

        # Summary
        if summary:
            right_story += _section_heading("Professional Summary", styles)
            right_story.append(Paragraph(summary, styles["body"]))

        # Experience
        if experience:
            right_story += _section_heading("Work Experience", styles)
            for exp in experience:
                header = exp.get("title", "")
                if exp.get("company"):
                    header += f' — {exp["company"]}'
                dates = f'{exp.get("startDate", "")} – {exp.get("endDate") or "Present"}'
                right_story.append(Paragraph(
                    f'<para><b>{header}</b>'
                    f'&nbsp;&nbsp;<font color="#555555"><i>{dates}</i></font></para>',
                    styles["jobline"]
                ))
                bullets = exp.get("bullets", []) or []
                if bullets:
                    items = [ListItem(Paragraph(b, styles["bullet"]), leftIndent=12) for b in bullets]
                    right_story.append(ListFlowable(items, bulletType="bullet", start="•",
                                               leftIndent=14, bulletFontSize=8))
                right_story.append(Spacer(1, 4))

        # Projects
        if projects:
            right_story += _section_heading("Projects", styles)
            for proj in projects:
                right_story.append(Paragraph(proj.get("name", ""), styles["jobline"]))
                bullets = proj.get("bullets") or ([proj["description"]] if proj.get("description") else [])
                if bullets:
                    items = [ListItem(Paragraph(b, styles["bullet"]), leftIndent=12) for b in bullets]
                    right_story.append(ListFlowable(items, bulletType="bullet", start="•",
                                               leftIndent=14, bulletFontSize=8))
                tech = proj.get("techStack")
                if tech:
                    tech_str = ", ".join(tech) if isinstance(tech, list) else tech
                    right_story.append(Paragraph(f'<b>Tech Stack:</b> <i>{tech_str}</i>', styles["stack"]))
                right_story.append(Spacer(1, 2))

        # Calculate height of the header
        header_height = 0
        for f in header_flowables:
            w, h = f.wrap(7.4 * inch, 10000)
            header_height += h
        header_height += 15  # buffer for spacing/margins

        from reportlab.lib.pagesizes import letter as letter_size
        avail_height = letter_size[1] - doc.topMargin - doc.bottomMargin
        first_page_avail = avail_height - header_height
        later_page_avail = avail_height

        dummy_canvas = None
        def get_flowable_height(f, width):
            nonlocal dummy_canvas
            if dummy_canvas is None:
                from reportlab.pdfgen import canvas
                from reportlab.lib.pagesizes import letter as letter_size
                dummy_canvas = canvas.Canvas(None, pagesize=letter_size)
            
            # Recursively assign canv to f and child/ListItem flowables if they have list contents
            def assign_canvas(flowable, canv):
                if not hasattr(flowable, 'canv') or flowable.canv is None:
                    flowable.canv = canv
                # For ListFlowable and similar container flowables, also assign to their internal children
                if hasattr(flowable, '_content'):
                    for item in getattr(flowable, '_content', []):
                        assign_canvas(item, canv)
                if hasattr(flowable, 'contents'):
                    for item in getattr(flowable, 'contents', []):
                        assign_canvas(item, canv)

            def remove_canvas(flowable):
                if hasattr(flowable, 'canv') and flowable.canv is dummy_canvas:
                    try:
                        del flowable.canv
                    except AttributeError:
                        flowable.canv = None
                if hasattr(flowable, '_content'):
                    for item in getattr(flowable, '_content', []):
                        remove_canvas(item)
                if hasattr(flowable, 'contents'):
                    for item in getattr(flowable, 'contents', []):
                        remove_canvas(item)

            assign_canvas(f, dummy_canvas)
            try:
                w, h = f.wrap(width, 10000)
                return h
            finally:
                remove_canvas(f)

        # Paginate left and right stories
        left_pages = []
        current_page_left = []
        current_left_height = 0
        current_avail_left = first_page_avail

        for f in left_story:
            h = get_flowable_height(f, 2.25 * inch)
            if current_page_left:
                h += 4
            if not current_page_left or current_left_height + h <= current_avail_left:
                current_page_left.append(f)
                current_left_height += h
            else:
                left_pages.append(current_page_left)
                current_page_left = [f]
                current_left_height = h
                current_avail_left = later_page_avail
        if current_page_left:
            left_pages.append(current_page_left)

        right_pages = []
        current_page_right = []
        current_right_height = 0
        current_avail_right = first_page_avail

        for f in right_story:
            h = get_flowable_height(f, 4.85 * inch)
            if current_page_right:
                h += 4
            if not current_page_right or current_right_height + h <= current_avail_right:
                current_page_right.append(f)
                current_right_height += h
            else:
                right_pages.append(current_page_right)
                current_page_right = [f]
                current_right_height = h
                current_avail_right = later_page_avail
        if current_page_right:
            right_pages.append(current_page_right)

        total_pages = max(len(left_pages), len(right_pages))
        from reportlab.platypus import Table, TableStyle, PageBreak

        story.extend(header_flowables)

        for i in range(total_pages):
            p_left = left_pages[i] if i < len(left_pages) else []
            p_right = right_pages[i] if i < len(right_pages) else []

            # Create table for this page
            t = Table([[p_left, "", p_right]], colWidths=[2.25 * inch, 0.3 * inch, 4.85 * inch])
            t.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('LINEAFTER', (0, 0), (0, 0), 0.5, colors.HexColor("#EEEEEE")),
            ]))
            story.append(t)
            if i < total_pages - 1:
                story.append(PageBreak())
    else:
        story.extend(header_flowables)
        # Summary
        if summary:
            story += _section_heading("Professional Summary", styles)
            story.append(Paragraph(summary, styles["body"]))

        # Education
        if education:
            story += _section_heading("Education", styles)
            for edu in education:
                degree_line = edu.get("degree", "")
                if edu.get("school"):
                    degree_line += f', {edu["school"]}'
                dates = " – ".join(filter(None, [edu.get("startDate"), edu.get("endDate")]))
                story.append(Paragraph(
                    f'<para><b>{degree_line}</b> '
                    f'<font color="#555555"><i>{dates}</i></font></para>',
                    styles["body"]
                ))
                if edu.get("location"):
                    story.append(Paragraph(edu["location"], styles["stack"]))

        # Skills
        if skills:
            story += _section_heading("Technical Skills", styles)
            if isinstance(skills, dict):
                for label, items in skills.items():
                    if items:
                        story.append(Paragraph(
                            f'<b>{label.title()}:</b> {", ".join(items)}', styles["body"]
                        ))
        else:
            story.append(Paragraph(", ".join(skills), styles["body"]))

        # Experience
        if experience:
            story += _section_heading("Work Experience", styles)
            for exp in experience:
                header = exp.get("title", "")
                if exp.get("company"):
                    header += f' — {exp["company"]}'
                dates = f'{exp.get("startDate", "")} – {exp.get("endDate") or "Present"}'
                story.append(Paragraph(
                    f'<para><b>{header}</b>'
                    f'&nbsp;&nbsp;<font color="#555555"><i>{dates}</i></font></para>',
                    styles["jobline"]
                ))
                bullets = exp.get("bullets", []) or []
                if bullets:
                    items = [ListItem(Paragraph(b, styles["bullet"]), leftIndent=12) for b in bullets]
                    story.append(ListFlowable(items, bulletType="bullet", start="•",
                                               leftIndent=14, bulletFontSize=8))
                story.append(Spacer(1, 4))

        # Projects
        if projects:
            story += _section_heading("Projects", styles)
            for proj in projects:
                story.append(Paragraph(proj.get("name", ""), styles["jobline"]))
                bullets = proj.get("bullets") or ([proj["description"]] if proj.get("description") else [])
                if bullets:
                    items = [ListItem(Paragraph(b, styles["bullet"]), leftIndent=12) for b in bullets]
                    story.append(ListFlowable(items, bulletType="bullet", start="•",
                                               leftIndent=14, bulletFontSize=8))
                tech = proj.get("techStack")
                if tech:
                    tech_str = ", ".join(tech) if isinstance(tech, list) else tech
                    story.append(Paragraph(f'<b>Tech Stack:</b> <i>{tech_str}</i>', styles["stack"]))
                story.append(Spacer(1, 2))

        # Certifications
        if certifications:
            story += _section_heading("Certifications", styles)
            for cert in certifications:
                line = cert.get("name", "")
                if cert.get("link"):
                    line = f'<link href="{cert["link"]}" color="#2E5BBA">{line}</link>'
                if cert.get("issuer"):
                    line += f' — {cert["issuer"]}'
                if cert.get("date"):
                    line += f' ({cert["date"]})'
                story.append(Paragraph(line, styles["body"]))

        # Languages
        if languages:
            story += _section_heading("Languages", styles)
            lang_list = []
            for l in languages:
                name = l.get("name", "")
                prof = l.get("proficiency", "")
                if prof:
                    lang_list.append(f"{name} ({prof})")
                else:
                    lang_list.append(name)
            lang_str = ", ".join(lang_list)
            story.append(Paragraph(lang_str, styles["body"]))

    doc.build(story)
    return output_path
