from os import path

def get_tutkinnot():
    with open(path.join(path.dirname(__file__), 'tutkinnot.json'), 'r', encoding='utf-8') as file:
        data = file.read()
    return data

# hae tietty tutkinto nimike
def get_tutkintonimikkeet(tutkinto_nimi):
    with open(path.join(path.dirname(__file__), 'tutkinnot.json'), 'r', encoding='utf-8') as file:
        data = file.read()
    import json
    tutkinnot_data = json.loads(data)
    for tutkinto in tutkinnot_data['tutkinnot']:
        if tutkinto['nimi'] == tutkinto_nimi:
            return tutkinto['tutkintonimikkeet']
    return None

# hae tietty tutkinto
def get_tutkinto(tutkinto_nimi):
    with open(path.join(path.dirname(__file__), 'tutkinnot.json'), 'r', encoding='utf-8') as file:
        data = file.read()
    import json
    tutkinnot_data = json.loads(data)
    for tutkinto in tutkinnot_data['tutkinnot']:
        if tutkinto['nimi'] == tutkinto_nimi:
            return tutkinto
    return None

"""""
 json tiedosto esimerkki

 {
  "tutkinnot": [
    {
      "nimi": "Puhtaus- ja kiinteistöpalvelualan perustutkinto",
      "desc": "Puhtaus- ja kiinteistöpalvelualan perustutkinnon suorittanut osaa toimia asiakaskohteessa puhtaus- ja kiinteistöpalvelualan työtehtävissä ja asiakaspalvelutilanteissa asiakaskohteen palvelusopimuksen mukaisesti. Tutkinnon suorittanut voi suunnata ammatillista osaamistaan kiinteistönhoitoon, kotityöpalveluihin tai toimitilahuoltoon osaamisalansa mukaisesti.",
      "tutkintonimikkeet": [
        {
          "nimi": "Kiinteistönhoitaja",
          "linkki": "https://eperusteet.opintopolku.fi/#/fi/tiedot/9723361/tekstikappale/9723355"
        },
        {
          "nimi": "Kotityöpalvelujen osaamisala",
          "linkki": "https://eperusteet.opintopolku.fi/#/fi/tiedot/9723361/tekstikappale/9723356"
        },
        {
        "nimi": "Toimitilahuoltaja",
        "linkki": "https://eperusteet.opintopolku.fi/#/fi/tiedot/9723361/tekstikappale/9723357"
        }
      ]
    },
}

"""