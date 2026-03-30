# Backend-API:n kokoaminen mixin-luokista

# Tämä moduuli yhdistää eri vastuualueet omista mixin-luokistaan yhdeksi API-luokaksi, jonka käyttöliittymä näkee yhtenä kokonaisuutena

from __future__ import annotations  # Siirtää tyyppivihjeiden tulkinnan myöhemmäksi

from .asetukset import AsetuksetApiMixin  # Lisää asetusten ja piilotusten hallintametodit
from .perusta import BackendBase  # Tarjoaa tietokantayhteyden ja yhteiset tallennusapumetodit
from .quizit import QuizitApiMixin  # Lisää visatulosten ja -istuntojen käsittelyn
from .sisalto import SisaltoApiMixin  # Lisää staattisen sisältödatan lukemisen JSON-lähteistä
from .tutkinnot import TutkinnotApiMixin  # Lisää tutkintojen, suosikkien ja muistiinpanojen hallinnan


class Api(
    BackendBase,
    TutkinnotApiMixin,
    AsetuksetApiMixin,
    QuizitApiMixin,
    SisaltoApiMixin,
):
    # Sovelluksen varsinainen backend-API yhdistettynä useasta osa-alueesta

    pass
