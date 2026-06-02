'''Vastaa käyttäjätietojen PDF-viennistä'''

from __future__ import annotations

from html import escape
from pathlib import Path


def format_iso_timestamp(value: str | None) -> str:
    '''Muuntaa ISO-aikaleiman luettavaksi tekstiksi'''

    if not value:
        return "-"

    normalized = str(value).strip()
    if not normalized:
        return "-"

    return normalized.replace("T", " ").replace("Z", " UTC")


def format_plan_priority(value: str | None) -> str:
    '''Muuntaa suunnitelman tärkeyden koodiarvon luettavaksi tekstiksi'''

    labels = {
        "ensisijainen": "Ensisijainen",
        "selvitettava": "Selvitettava",
        "varavaihtoehto": "Varavaihtoehto",
    }
    return labels.get(str(value or "").strip(), "-")


def format_plan_status(value: str | None) -> str:
    '''Muuntaa suunnitelman tilan koodiarvon luettavaksi tekstiksi'''

    labels = {
        "en-tieda-viela": "En tiedä vielä",
        "haluan-selvittaa-lisaa": "Haluan selvittää lisää",
        "vahva-vaihtoehto": "Vahva vaihtoehto",
    }
    return labels.get(str(value or "").strip(), "-")


def _paragraph(text: str) -> str:
    return f"<p>{escape(text)}</p>"


def _definition_rows(rows: list[tuple[str, str]]) -> str:
    items = "".join(
        f'<li><strong>{escape(label)}:</strong> {escape(value)}</li>' for label, value in rows
    )
    return f"<ul>{items}</ul>"


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


def _format_quiz_label(value: str | None) -> str:
    labels = {
        "tutkinto-kysely": "Amis-korttivertailu",
        "opintopolku": "Opintopolku-kysely",
    }
    normalized = str(value or "").strip()
    return labels.get(normalized, normalized or "-")


def _format_export_label(key: str) -> str:
    labels = {
        "answerCount": "Vastausten määrä",
        "answers": "Vastaukset",
        "comparisons": "Vertailujen määrä",
        "count": "Vaihtoehtojen määrä",
        "createdAt": "Tallennettu",
        "currentIndex": "Nykyinen kysymys",
        "durationMs": "Käytetty aika (ms)",
        "optionId": "Valittu vaihtoehto",
        "questionId": "Kysymys",
        "quizId": "Kysely",
        "rankingIds": "Vaihtoehtojen tunnisteet järjestyksessä",
        "rankingNames": "Vaihtoehdot järjestyksessä",
        "result": "Tulos",
        "runnerUpPathId": "Toiseksi sopivin opintopolku (tunniste)",
        "runnerUpPathLabel": "Toiseksi sopivin opintopolku",
        "scores": "Pisteet",
        "session": "Tallennettu keskeneräinen tila",
        "topId": "Suosikin tunniste",
        "topName": "Suosikki",
        "topPathId": "Sopivin opintopolku (tunniste)",
        "topPathLabel": "Sopivin opintopolku",
        "updatedAt": "Päivitetty",
        "winnerId": "Voittanut vaihtoehto (tunniste)",
    }
    return labels.get(key, key)


def _format_export_scalar(value, key: str | None = None) -> str:
    if key == "quizId":
        return _format_quiz_label(value)
    return _format_scalar(value)


def _render_data_value(value, key: str | None = None) -> str:
    if isinstance(value, dict):
        if not value:
            return "<p>-</p>"
        rows = "".join(
            (
                "<li>"
                f"<strong>{escape(_format_export_label(str(child_key)))}:</strong> "
                f"{_render_data_value(nested_value, str(child_key))}"
                "</li>"
            )
            for child_key, nested_value in value.items()
        )
        return f'<ul class="plain-list">{rows}</ul>'

    if isinstance(value, list):
        if not value:
            return "<p>-</p>"
        return _unordered_list([_render_data_value(item, key) for item in value])

    return escape(_format_export_scalar(value, key))


def _render_saved_items(items: list[dict]) -> str:
    if not items:
        return _empty_state("Tallennettuja tutkintonimikkeitä ei ole.")

    cards = []
    for item in items:
        cards.append(
            (
                "<section>"
                f"<h3>{escape(item['nimi'])}</h3>"
                f"<p>{escape(item['tutkinto_nimi'])}</p>"
                f"{_definition_rows([('Tallennettu', format_iso_timestamp(item.get('savedAt'))), ('Piilotettu sovelluksessa', _format_scalar(item.get('isHidden'))), ('Suunnitelman tärkeys', format_plan_priority(item.get('planPriority'))), ('Suunnitelman tila', format_plan_status(item.get('planStatus'))), ('Suunnitelma päivitetty', format_iso_timestamp(item.get('planUpdatedAt')))])}"
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
                "<section>"
                f"<h3>{escape(item['nimi'])}</h3>"
                f"<p>{escape(item['tutkinto_nimi'])}</p>"
                f"{_definition_rows([('Päivitetty', format_iso_timestamp(item.get('updatedAt'))), ('Piilotettu sovelluksessa', _format_scalar(item.get('isHidden')))])}"
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


def _render_hidden_paikkakunnat(items: list[dict]) -> str:
    if not items:
        return _empty_state("Piilotettuja paikkakuntia ei ole.")

    return _unordered_list(
        [
            (
                f"<strong>{escape(item['paikkakunta'])}</strong>"
                f"<br/>Piilotettu: {escape(format_iso_timestamp(item.get('hiddenAt')))}"
                f"<br/>Tutkintonimikkeita: {escape(str(item.get('tutkintonimikeCount', 0)))}"
            )
            for item in items
        ]
    )


def _render_top_items(items: list[str], max_items: int = 5) -> str:
    if not items:
        return "<p>-</p>"
    limited_items = items[:max_items]
    rows = [escape(str(item)) for item in limited_items]
    return _unordered_list(rows)


def _render_quiz_result_body(item: dict) -> str:
    result = item.get("result")
    if not isinstance(result, dict):
        return _render_data_value(result, "result")

    quiz_id = str(item.get("quizId") or "").strip()
    details: list[str] = []

    if quiz_id == "opintopolku":
        details.append(
            f"<p><strong>Sopivin opintopolku:</strong> {escape(str(result.get('topPathLabel') or result.get('topPathId') or '-'))}</p>"
        )
        runner_up = result.get("runnerUpPathLabel") or result.get("runnerUpPathId")
        if runner_up:
            details.append(
                f"<p><strong>Toiseksi sopivin opintopolku:</strong> {escape(str(runner_up))}</p>"
            )
        details.append(
            f"<p><strong>Vastausten määrä:</strong> {escape(_format_scalar(result.get('answerCount')))}</p>"
        )
        scores = result.get("scores")
        if isinstance(scores, dict) and scores:
            sorted_scores = sorted(
                scores.items(),
                key=lambda entry: (-int(entry[1]), str(entry[0])),
            )
            details.append("<p><strong>Top 5:</strong></p>")
            details.append(
                _unordered_list(
                    [
                        f"{escape(str(path_id))}: {escape(str(score))} pistettä"
                        for path_id, score in sorted_scores[:5]
                    ]
                )
            )
        return "".join(details)

    if quiz_id == "tutkinto-kysely":
        details.append(
            f"<p><strong>Suosikki:</strong> {escape(str(result.get('topName') or '-'))}</p>"
        )
        details.append(
            f"<p><strong>Vertailujen määrä:</strong> {escape(_format_scalar(result.get('comparisons')))}</p>"
        )
        details.append(
            f"<p><strong>Vaihtoehtojen määrä:</strong> {escape(_format_scalar(result.get('count')))}</p>"
        )
        ranking_names = result.get("rankingNames")
        if isinstance(ranking_names, list):
            details.append("<p><strong>Top 5:</strong></p>")
            details.append(_render_top_items([str(item) for item in ranking_names], 5))
        return "".join(details)

    return _render_data_value(result, "result")


def _render_quiz_entries(items: list[dict], title_timestamp_key: str) -> str:
    if not items:
        return _empty_state("Tallennuksia ei ole.")

    cards = []
    for item in items:
        cards.append(
            (
                "<section>"
                f"<h3>{escape(_format_quiz_label(item.get('quizId')))}</h3>"
                f"{_definition_rows([(title_timestamp_key, format_iso_timestamp(item.get('createdAt') or item.get('updatedAt')))])}"
                f"{_render_quiz_result_body(item)}"
                "</section>"
            )
        )
    return "".join(cards)


def build_user_export_html(payload: dict) -> str:
    '''Rakentaa käyttäjätietojen PDF-viennin HTML-muodossa'''

    summary = payload["summary"]
    sections = payload["sections"]
    return f"""<!doctype html>
<html lang="fi">
  <head>
    <meta charset="utf-8" />
    <title>Kayttajatiedot</title>
    <style>
      @page {{
        size: A4;
        margin: 18mm 16mm;
      }}
      body {{
        font-family: "Times New Roman", Times, serif;
        font-size: 11pt;
        line-height: 1.45;
      }}
      h1, h2, h3 {{ margin: 0 0 8px 0; }}
      p {{
        margin: 0 0 8px 0;
      }}
      ul {{
        margin: 0 0 10px 18px;
        padding: 0;
      }}
      section {{
        margin-bottom: 16px;
        page-break-inside: avoid;
      }}
      .note-body {{
        white-space: pre-wrap;
      }}
    </style>
  </head>
  <body>
    <header>
      <h1>Käyttäjätiedot</h1>
      <p>Luotu {format_iso_timestamp(payload.get("exportedAt"))}</p>
    </header>

    <section>
      <h2>Yhteenveto</h2>
      <ul>
        <li>Tallennettuja tutkintonimikkeitä: {summary['savedCount']}</li>
        <li>Muistiinpanoja: {summary['noteCount']}</li>
        <li>Piilotettuja tutkintoja: {summary['hiddenTutkinnotCount']}</li>
        <li>Piilotettuja tutkintonimikkeitä: {summary['hiddenTutkintonimikkeetCount']}</li>
        <li>Piilotettuja paikkakuntia: {summary['hiddenPaikkakunnatCount']}</li>
        <li>Valmiita kyselytuloksia: {summary['quizResultCount']}</li>
      </ul>
    </section>

    <section>
      <h2>Tallennetut tutkintonimikkeet</h2>
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
      <h2>Piilotetut paikkakunnat</h2>
      {_render_hidden_paikkakunnat(sections["hiddenPaikkakunnat"])}
    </section>

    <section>
      <h2>Valmiit kyselytulokset</h2>
      {_render_quiz_entries(sections["quizResults"], "Tallennettu")}
    </section>
  </body>
</html>
"""


def render_html_to_pdf(html: str, output_path: Path) -> None:
    '''Renderöi HTML-koodi PDF-tiedostoksi käyttäen PyQt:n renderöintimoottoria'''

    from PyQt6.QtGui import QTextDocument  # pylint: disable=no-name-in-module
    from PyQt6.QtPrintSupport import QPrinter  # pylint: disable=no-name-in-module

    output_path.parent.mkdir(parents=True, exist_ok=True)
    document = QTextDocument()
    document.setHtml(html)

    printer = QPrinter()
    printer.setOutputFormat(QPrinter.OutputFormat.PdfFormat)
    printer.setOutputFileName(str(output_path))
    document.print(printer)

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError("PDF-vienti epäonnistui")
