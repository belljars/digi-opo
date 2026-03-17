from __future__ import annotations

from .asetukset import AsetuksetApiMixin
from .perusta import BackendBase
from .quizit import QuizitApiMixin
from .sisalto import SisaltoApiMixin
from .tutkinnot import TutkinnotApiMixin


class Api(
    BackendBase,
    TutkinnotApiMixin,
    AsetuksetApiMixin,
    QuizitApiMixin,
    SisaltoApiMixin,
):
    pass
