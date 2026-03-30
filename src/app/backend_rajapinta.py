# Yhteensopiva vientimoduuli backendin API-luokalle

# Tämän kautta muu sovellus voi importata `Api`-luokan yhdestä paikasta välittämättä backend-paketin sisäisestä rakenteesta

from __future__ import annotations  # Siirtää tyyppivihjeiden tulkinnan myöhemmäksi

from backend.api import Api  # Tuo backend-paketin yhdistetyn API-luokan tämän moduulin kautta vietäväksi

__all__ = ["Api"]
