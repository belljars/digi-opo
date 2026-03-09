# digi-opo — Työpöytäsovellus

## Yleiskuvaus

**digi-opo** on paikallinen pywebview-työpöytäsovellus suomalaisten tutkintojen selailuun.

Sovellus sisältää tällä hetkellä viisi näkymää:
- `Etusivu` (`src/ui/pages/home.html`)
- `Tutkintopankki` (`src/ui/pages/index.html`)
- `Opintopolut` (`src/ui/pages/opintopolut.html`)
- `Opintopolku-kysely` (`src/ui/pages/quiz.html`)
- `Amis-korttivertailu` (`src/ui/pages/amis-quiz.html`)

## Mitä sovellus tekee nyt

- Alustaa SQLite-tietokannan tiedostoon `data/tutkinnot.db`.
- Tuo `src/data/ammatit.json`-datan tietokantaan ensimmäisellä ajolla ja päivittää sisällön automaattisesti, jos lähde-JSON muuttuu.
- Näyttää tutkintolistan ja valitun tutkinnon tutkintonimikkeet.
- Mahdollistaa kahden tutkintonimikkeen korttivertailun (`Vertailu`).
- Lataa `Opintopolut`-näkymän sisällön tiedostosta `src/data/opiskeluSuunnat.json`.

Huomio:
- API:ssa on myös `search_tutkinnot`, mutta sitä ei tällä hetkellä käytetä UI:ssa.
- Repossa voi olla vanhoja tietokantatiedostoja (esim. `data/ammatit.db`), mutta appi käyttää `data/tutkinnot.db`-tiedostoa.

## Teknologiat

- Python + `pywebview`
- PyQt6 + Qt WebEngine
- TypeScript + HTML + CSS
- SQLite

## Vaatimukset

- Python 3
- Node.js + npm
- Linuxissa Qt-riippuvuudet järjestelmätasolla
- Windowsissa ajoskripti tukee Pythonia 3.11/3.12

Python-riippuvuudet asennetaan tiedostosta `requirements.txt`.
TypeScript buildataan komennolla `npm run build`.
Repositorio on TypeScript-painotteinen: lähdekoodi pidetään `.ts`-tiedostoissa, ja buildatut `.js`-tiedostot jätetään pois versiosta.

## Ajaminen paikallisesti

Linux:

```bash
./run_linux.sh
```

Makefile-komennot:

```bash
make check
make run
```

NixOS (suositus):

```bash
nix --extra-experimental-features "nix-command flakes" develop path:.
./run_linux.sh
```

Huom:
- Nix shellissa `run_linux.sh` ei luo `.venv`:iä eikä aja `pip install`, vaan käyttää Nixin Python-paketteja.
- Projektiin on lisätty `flake.nix` ja `shell.nix`, joten myös `nix-shell` toimii.

Windows:

```bat
run_windows.bat
```

Skriptit tekevät nämä vaiheet:
1. Luo `.venv` (tarvittaessa)
2. Asentaa Python-riippuvuudet
3. Ajaa TypeScript-buildin (`npm run build`)
4. Kopioi buildatut JS-tiedostot `dist/ui/scripts/` -> `src/ui/scripts/`
5. Käynnistää appin (`python3 src/app/app.py` / `.venv\\Scripts\\python.exe src\\app\\app.py`)

## Projektin rakenne

```text
digi-opo/
├── src/
│   ├── app/              # pywebview app + Python API
│   ├── ui/               # HTML/CSS/TS näkymät
│   │   ├── pages/        # HTML-näkymät
│   │   ├── scripts/      # TypeScript
│   │   ├── styles/       # CSS
│   │   └── assets/       # kuvat ja muut staattiset
│   └── data/             # JSON-lähdedata
├── data/                 # SQLite-tiedostot
├── run_linux.sh
├── run_windows.bat
├── requirements.txt
├── package.json
└── README.md
```

## To-do lista
Tehdyt
- [x] Tutkintopankki (amis)
- [x] Opintopolut (peruskoulun jälkeen)
- [ ] Opintopolku-kysely (interaktiivinen)
- [ ] Amis-tutkinto kortti vertailu (interaktiivinen)

Korjattava
- [x] Amistutkinto kortti vertailu (jatkuu nyt ikuisesti, loppuu kun on voittaja ammatti nimike)
	- [ ] Top 3
	- [ ] Näyttää listan kaikista ammateista järjestyksenä, minkä käyttäjän valitsi eniten
- [ ] Opintopolku-kysely vastaus tallennus

Seuraava
- [ ] Tekoäly-integrointi ja suunittelu

Lisättävää
- [ ] Mahdollisuus tallentaa eri tutkintonimikkeet
	- [ ] Nähdä tallennettu tutkintonimikkeet
		- [ ] Aakkoset (laskeva ja nouseva)
		- [ ] Viimeiseksi lisätty
		- [ ] Ensimmäisenä lisätty
		- [ ] Tutkinto kategoriana (aakkoset, laskeva)
- [ ] Estää joidenkin tutkintonimikkeiden/perustutkintojen ilmestyminen kokonaan

Loppuvaihe
- [ ] Lisää muut tutkinnot

## Lisenssi

Katso `LICENSE`.
