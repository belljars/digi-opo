'''Yhdistää eri vastuualueet omista mixin-luokistaan yhdeksi API-luokaksi, jonka käyttöliittymä näkee yhtenä kokonaisuutena'''

from __future__ import annotations
from .asetukset import AsetuksetApiMixin
from .perusta import BackendBase
from .quiz import QuizitApiMixin
from .sisalto import SisaltoApiMixin
from .tutkinnot import TutkinnotApiMixin
from .vienti import VientiApiMixin

class Api(
    BackendBase,
    TutkinnotApiMixin,
    AsetuksetApiMixin,
    QuizitApiMixin,
    SisaltoApiMixin,
    VientiApiMixin,
):

    pass