'''Paketti vie ulos vain yhdistetyn `Api`-luokan, jota muu sovellus käyttää'''

from .api import Api  # Tuo backend-paketin yhdistetyn API-luokan julkiseen käyttöön

__all__ = ["Api"]
