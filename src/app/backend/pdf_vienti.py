from __future__ import annotations

from html import escape
from pathlib import Path


def format_iso_timestamp(value: str | None) -> str:
    # Muuntaa ISO-aikaleiman käyttäjälle luettavampaan muotoon PDF-vientiä varten
    if not value:
        return "-"

    normalized = str(value).strip()
    if not normalized:
        return "-"

    return normalized.replace("T", " ").replace("Z", " UTC")


def format_plan_priority(value: str | None) -> str:
    labels = {
        "ensisijainen": "Ensisijainen",
        "selvitettava": "Selvitettava",
        "varavaihtoehto": "Varavaihtoehto",
    }
    return labels.get(str(value or "").strip(), "-")


def format_plan_status(value: str | None) -> str:
    labels = {
        "en-tieda-viela": "En tieda viela",
        "haluan-selvittaa-lisaa": "Haluan selvittaa lisaa",
        "vahva-vaihtoehto": "Vahva vaihtoehto",
    }
    return labels.get(str(value or "").strip(), "-")


def _paragraph(text: str) -> str:
    return f"<p>{escape(text)}</p>"


def _definition_rows(rows: list[tuple[str, str]]) -> str:
    items = "".join(
        f"<tr><th>{escape(label)}</th><td>{escape(value)}</td></tr>"
        for label, value in rows
    )
    return f'<table class="meta-table">{items}</table>'


def _empty_state(message: str) -> str:
    return f'<p class="empty-state">{escape(message)}</p>'


def _unordered_list(items: list[str]) -> str:
    content = "".join(f"<li>{item}</li>" for item in items)
    return f"<ul>{content}</ul>"


def _format_scalar(value) -> str:
    if value is None or value == "":
        return "-"
    if isinstance(value, bool):
        return "Kyllä" if value else "Ei"
    return str(value)


def _render_data_value(value) -> str:
    if isinstance(value, dict):
        if not value:
            return "<p>-</p>"
        rows = "".join(
            (
                "<tr>"
                f"<th>{escape(str(key))}</th>"
                f"<td>{_render_data_value(nested_value)}</td>"
                "</tr>"
            )
            for key, nested_value in value.items()
        )
        return f'<table class="nested-table">{rows}</table>'

    if isinstance(value, list):
        if not value:
            return "<p>-</p>"
        return _unordered_list([_render_data_value(item) for item in value])

    return f"<p>{escape(_format_scalar(value))}</p>"


def _render_saved_items(items: list[dict]) -> str:
    if not items:
        return _empty_state("Tallennettuja tutkintonimikkeitä ei ole.")

    cards = []
    for item in items:
        cards.append(
            (
                '<section class="item-card">'
                f"<h3>{escape(item['nimi'])}</h3>"
                f"<p class=\"item-subtitle\">{escape(item['tutkinto_nimi'])}</p>"
                f"{_definition_rows([('Tallennettu', format_iso_timestamp(item.get('savedAt'))), ('Piilotettu sovelluksessa', _format_scalar(item.get('isHidden'))), ('Prioriteetti', format_plan_priority(item.get('planPriority'))), ('Tila', format_plan_status(item.get('planStatus'))), ('Suunnitelma päivitetty', format_iso_timestamp(item.get('planUpdatedAt')))])}"
                f"<p><strong>Seuraava askel:</strong> {escape(str(item.get('nextStep') or '-'))}</p>"
                "</section>"
            )
        )
    return "".join(cards)


def _render_notes(items: list[dict]) -> str:
    if not items:
        return _empty_state("Muistiinpanoja ei ole.")

    cards = []
    for item in items:
        cards.append(
            (
                '<section class="item-card">'
                f"<h3>{escape(item['nimi'])}</h3>"
                f"<p class=\"item-subtitle\">{escape(item['tutkinto_nimi'])}</p>"
                f"{_definition_rows([('Paivitetty', format_iso_timestamp(item.get('updatedAt'))), ('Piilotettu sovelluksessa', _format_scalar(item.get('isHidden')))])}"
                f"<div class=\"note-body\">{_paragraph(str(item.get('noteText') or '-'))}</div>"
                "</section>"
            )
        )
    return "".join(cards)


def _render_hidden_tutkinnot(items: list[dict]) -> str:
    if not items:
        return _empty_state("Piilotettuja tutkintoja ei ole.")

    return _unordered_list(
        [
            (
                f"<strong>{escape(item['nimi'])}</strong>"
                f"<br/>Piilotettu: {escape(format_iso_timestamp(item.get('hiddenAt')))}"
                f"<br/>Tutkintonimikkeita: {escape(str(item.get('tutkintonimikeCount', 0)))}"
            )
            for item in items
        ]
    )


def _render_hidden_nimikkeet(items: list[dict]) -> str:
    if not items:
        return _empty_state("Piilotettuja tutkintonimikkeita ei ole.")

    return _unordered_list(
        [
            (
                f"<strong>{escape(item['nimi'])}</strong> "
                f"({escape(item['tutkinto_nimi'])})"
                f"<br/>Piilotettu: {escape(format_iso_timestamp(item.get('hiddenAt')))}"
            )
            for item in items
        ]
    )


def _render_quiz_entries(items: list[dict], title_timestamp_key: str, body_key: str) -> str:
    if not items:
        return _empty_state("Tallennuksia ei ole.")

    cards = []
    for item in items:
        cards.append(
            (
                '<section class="item-card">'
                f"<h3>{escape(str(item.get('quizId') or 'Tuntematon visa'))}</h3>"
                f"{_definition_rows([(title_timestamp_key, format_iso_timestamp(item.get('createdAt') or item.get('updatedAt')))])}"
                f"{_render_data_value(item.get(body_key))}"
                "</section>"
            )
        )
    return "".join(cards)


def build_user_export_html(payload: dict) -> str:
    summary = payload["summary"]
    sections = payload["sections"]
    return f"""<!doctype html>
<html lang="fi">
  <head>
    <meta charset="utf-8" />
    <title>digi-opo - Kayttajatietojen PDF-vienti</title>
    <style>
      @page {{
        size: A4;
        margin: 18mm 16mm;
      }}
      body {{
        font-family: Arial, sans-serif;
        color: #1b1b1b;
        font-size: 11pt;
        line-height: 1.45;
      }}
      h1, h2, h3 {{
        color: #0f2f57;
        margin: 0 0 8px 0;
      }}
      h1 {{
        font-size: 22pt;
      }}
      h2 {{
        font-size: 15pt;
        margin-top: 22px;
        padding-bottom: 4px;
        border-bottom: 1px solid #c7d5e6;
      }}
      h3 {{
        font-size: 12pt;
      }}
      p {{
        margin: 0 0 8px 0;
      }}
      ul {{
        margin: 0;
        padding-left: 18px;
      }}
      li {{
        margin-bottom: 8px;
      }}
      .lead {{
        margin-bottom: 18px;
      }}
      .summary-grid {{
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
      }}
      .summary-grid th,
      .summary-grid td,
      .meta-table th,
      .meta-table td,
      .nested-table th,
      .nested-table td {{
        border: 1px solid #c7d5e6;
        padding: 6px 8px;
        text-align: left;
        vertical-align: top;
      }}
      .summary-grid th,
      .meta-table th,
      .nested-table th {{
        width: 35%;
        background: #eef4fb;
      }}
      .meta-table,
      .nested-table {{
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 12px;
      }}
      .item-card {{
        border: 1px solid #c7d5e6;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 12px;
        page-break-inside: avoid;
      }}
      .item-subtitle {{
        color: #475569;
      }}
      .empty-state {{
        color: #5b6470;
        font-style: italic;
      }}
      .note-body {{
        white-space: pre-wrap;
      }}
    </style>
  </head>
  <body>
    <header>
      <h1>digi-opo - kayttajatietojen vienti</h1>
      <p class="lead">Tama PDF kokoaa sovellukseen tallennetut kayttajatiedot yhteen helposti luettavaan muotoon.</p>
      {_definition_rows([("Vienti luotu", format_iso_timestamp(payload.get("exportedAt"))), ("PDF-tiedosto", str(payload.get("fileName") or "-"))])}
      <table class="summary-grid">
        <tr><th>Osio</th><th>Maara</th></tr>
        <tr><td>Tallennetut tutkintonimikkeet</td><td>{summary['savedCount']}</td></tr>
        <tr><td>Muistiinpanot</td><td>{summary['noteCount']}</td></tr>
        <tr><td>Piilotetut tutkinnot</td><td>{summary['hiddenTutkinnotCount']}</td></tr>
        <tr><td>Piilotetut tutkintonimikkeet</td><td>{summary['hiddenTutkintonimikkeetCount']}</td></tr>
        <tr><td>Visatulokset</td><td>{summary['quizResultCount']}</td></tr>
        <tr><td>Keskeneraiset visat</td><td>{summary['quizSessionCount']}</td></tr>
      </table>
    </header>

    <section>
      <h2>Tallennetut tutkintonimikkeet ja suunnitelmat</h2>
      {_render_saved_items(sections["savedTutkintonimikkeet"])}
    </section>

    <section>
      <h2>Muistiinpanot</h2>
      {_render_notes(sections["notes"])}
    </section>

    <section>
      <h2>Piilotetut tutkinnot</h2>
      {_render_hidden_tutkinnot(sections["hiddenTutkinnot"])}
    </section>

    <section>
      <h2>Piilotetut tutkintonimikkeet</h2>
      {_render_hidden_nimikkeet(sections["hiddenTutkintonimikkeet"])}
    </section>

    <section>
      <h2>Visatulokset</h2>
      {_render_quiz_entries(sections["quizResults"], "Tallennettu", "result")}
    </section>

    <section>
      <h2>Keskeneraiset visat</h2>
      {_render_quiz_entries(sections["quizSessions"], "Paivitetty", "session")}
    </section>
  </body>
</html>
"""


def render_html_to_pdf(html: str, output_path: Path) -> None:
    # Luo PDF-tiedoston Qt:n omalla HTML-tulostuksella, jotta uusia riippuvuuksia ei tarvita
    from PyQt6.QtGui import QTextDocument
    from PyQt6.QtPrintSupport import QPrinter

    output_path.parent.mkdir(parents=True, exist_ok=True)
    document = QTextDocument()
    document.setHtml(html)

    printer = QPrinter()
    printer.setOutputFormat(QPrinter.OutputFormat.PdfFormat)
    printer.setOutputFileName(str(output_path))
    document.print(printer)

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError("PDF-vienti epäonnistui")
