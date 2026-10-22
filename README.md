# 🔐 CryptoLab

**Xifra, codifica i resumeix qualsevol text o fitxer — 100 % dins del teu navegador.**

[![Llicència: MIT](https://img.shields.io/badge/llic%C3%A8ncia-MIT-3ddc97?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-69%20passant-3ddc97?style=flat-square)](src/lib/tools/tools.test.ts)
[![Desplegat a Cloudflare](https://img.shields.io/badge/desplegat-Cloudflare-f38020?style=flat-square)](https://cryptolab.ivanblogger15.workers.dev)

**En línia:** <https://cryptolab.ivanblogger15.workers.dev> · mirall a GitHub Pages:
<https://ivanblogger15-maker.github.io/cryptolab/>

CryptoLab és una aplicació web estàtica (sense servidor, sense comptes, sense telemetria) que reuneix
**63 eines** de criptografia, codificació i compressió en una sola interfície. Les claus, les
contrasenyes i els fitxers **no surten mai del dispositiu**: tot es calcula amb WebCrypto, mòduls
JavaScript i WASM que s'executen a la pàgina.

> Interfície en **català** (per defecte), **castellà** i **anglès**. El català és el valor inicial
> encara que el navegador estigui configurat en una altra llengua; la tria es recorda a `localStorage`.

---

## Contingut

- [Eines incloses](#eines-incloses)
- [Contenidor `.clab`](#contenidor-clab)
- [Arquitectura](#arquitectura)
- [Desenvolupament](#desenvolupament)
- [Estructura del projecte](#estructura-del-projecte)
- [Proves](#proves)
- [Desplegament](#desplegament)
- [Privadesa i seguretat](#privadesa-i-seguretat)
- [Compatibilitat](#compatibilitat)
- [Llicència](#llicència)

---

## Eines incloses

| Categoria | Eines |
| --- | --- |
| **Xifrat simètric** (8) | AES-256-GCM, ChaCha20-Poly1305, XChaCha20-Poly1305, XSalsa20-Poly1305, AES-256-CBC, AES-256-CTR, ChaCha20, Salsa20 |
| **Xifrat asimètric** (7) | RSA-OAEP híbrid (2048+), ECIES (ECDH P-256 + AES-256-GCM), intercanvi de secret ECDH, generador de claus RSA/P-256/P-384/Ed25519 |
| **Hashes i signatures** (14) | MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-512, BLAKE2b, BLAKE3, CRC-32, HMAC-SHA256/512, bcrypt, Argon2id, scrypt |
| **Signatures** (3) | Ed25519, ECDSA P-256/P-384, RSA-PSS (signa i verifica) |
| **Codificacions** (17) | Base64, Base64 URL, Base32, Base58, Base62, Ascii85, hex, binari, octal, decimal, percent-encoding, entitats HTML, escapat Unicode, A1Z26, Morse, Bacon |
| **Xifrat clàssic** (11) | Cèsar (amb força bruta), ROT13, ROT47, Atbash, Vigenère, Afí, Playfair, Rail Fence, transposició columnar, XOR, One-Time Pad |
| **Derivació de claus** (4) | PBKDF2-SHA256, scrypt, Argon2id, generador de contrasenyes/bytes/UUID |
| **Compressió** (3) | GZIP, DEFLATE (zlib), Brotli (WASM carregat sota demanda) |

Cada eina funciona en **mode text** o **mode fitxer**, i moltes són reversibles (xifrar/desxifrar,
codificar/descodificar, comprimir/descomprimir).

### Contenidor `.clab`

Quan xifres amb contrasenya, CryptoLab genera un fitxer `.clab`:

```
"CLAB" | versió (1 byte) | longitud de la capçalera (4 bytes BE) | capçalera JSON | payload xifrat
```

La capçalera inclou l'algorisme, l'IV/nonce, el KDF i els seus paràmetres (iteracions de PBKDF2,
N/r/p d'scrypt, memòria d'Argon2id), el salt, el nom original i el tipus MIME. Per desxifrar només cal
la contrasenya: **la resta es detecta automàticament** i s'indica a la interfície.

Els algorismes amb AEAD (AES-GCM, ChaCha20-Poly1305, XChaCha20, XSalsa20) autentiquen el contingut:
una contrasenya incorrecta o un fitxer manipulat fallen en lloc de retornar dades esbiaixades.

---

## Arquitectura

- **100 % client-side.** No hi ha backend, ni API, ni analítiques. Un cop carregada la pàgina, cap
  petició conté dades de l'usuari.
- **WebCrypto** per a AES, RSA, ECDH, ECDSA, Ed25519, PBKDF2 i HMAC.
- **`@noble/ciphers` / `@noble/hashes`** per als algorismes que WebCrypto no cobreix (ChaCha20, Salsa20, XChaCha20, BLAKE2b, BLAKE3, SHA-3…).
- **`hash-wasm`** per a Argon2id, bcrypt i scrypt (WASM).
- **`brotli-wasm`** per a Brotli, amb `import()` dinàmic: el mòdul només es descarrega quan es fa
  servir l'eina.
- **Build autocontinguda.** `assetsInlineLimit: 2_000_000` incrusta el WASM de Brotli com a `data:`
  URL dins del chunk, de manera que el desplegament no necessita cap fitxer binari addicional.
- **`base: './'`** perquè la mateixa build funcioni a l'arrel d'un domini, en un subdirectori
  (GitHub Pages) o en un servidor local.

---

## Desenvolupament

Requisits: **Node.js 20.19+ o 22.12+** (el projecte fixa `22` a `.nvmrc`) i npm.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript (tsc -b)
npm run lint       # oxlint
npm test           # 69 tests de round-trip i vectors amb Vitest
npm run build      # build de producció a docs/
npm run preview    # serveix la build de docs/
```

### Stack

| Peça | Tecnologia |
| --- | --- |
| Build | Vite 8 (Rolldown) |
| UI | React 19 + TypeScript |
| Estils | Tailwind CSS v4 (`@utility` per a `btn`/`field`) |
| Icones | lucide-react |
| Criptografia | WebCrypto + `@noble/ciphers` + `@noble/hashes` |
| KDF/hashes WASM | `hash-wasm` |
| Compressió | Compression Streams (gzip/zlib) + `brotli-wasm` |
| Tests | Vitest (entorn Node) |

---

## Estructura del projecte

```
.
├─ src/
│  ├─ components/        Header, Sidebar, ToolPanel, InputPane, OutputPane, ParamsPanel, Footer…
│  ├─ i18n/              ca.ts, es.ts, en.ts i el provider (detectLang → català per defecte)
│  ├─ lib/
│  │  ├─ tools/          Les 63 eines, en 7 mòduls + index.ts
│  │  │  ├─ symmetric.ts     AES, ChaCha20, Salsa20…
│  │  │  ├─ asymmetric.ts    RSA-OAEP, ECIES, ECDH, Ed25519, ECDSA, RSA-PSS
│  │  │  ├─ hashes.ts        SHA, BLAKE, HMAC, bcrypt, Argon2id, scrypt, CRC-32
│  │  │  ├─ encodings.ts     Base64/32/58/62/85, hex, binari, Morse…
│  │  │  ├─ classical.ts     Cèsar, Vigenère, Playfair, Rail Fence…
│  │  │  ├─ keys.ts          PBKDF2, scrypt, Argon2id, generador aleatori
│  │  │  └─ compression.ts   GZIP, DEFLATE, Brotli
│  │  ├─ seal.ts         Contenidor .clab (magic, versió, capçalera, payload)
│  │  ├─ kdf.ts          Especificació i derivació de claus
│  │  ├─ pem.ts          Importació/exportació de claus PEM
│  │  ├─ bases.ts        Codificacions de base (Base32/58/62/85…)
│  │  ├─ bytes.ts        UTF-8, hex, Base64, helpers binaris
│  │  ├─ webcrypto.ts    Wrappers de WebCrypto
│  │  ├─ errors.ts       Errors tipats (ToolError) i missatges i18n
│  │  └─ types.ts        Tool, RunContext, ToolOutput, Params…
│  ├─ App.tsx            Estat global: eina, direcció, mode text/fitxer, resultat
│  ├─ index.css          Tailwind + utilitats i components
│  └─ main.tsx
├─ public/
│  ├─ favicon.svg
│  ├─ icons.svg
│  └─ _headers           Capçaleres de seguretat i caché (Cloudflare)
├─ docs/                 Build de producció (versionada; la serveix GitHub Pages)
├─ vite.config.ts        base './', outDir 'docs', WASM inline
├─ vitest.config.ts      Entorn Node + alias del build de Node de brotli-wasm
└─ .nvmrc                22 (Node per a la build al núvol)
```

---

## Proves

```bash
npm test
```

La suite (`src/lib/tools/tools.test.ts`) fa **69 comprovacions** de round-trip i vectors coneguts:
xifrat/desxifrat simètric i asimètric, signatures, hashes, codificacions, xifrats clàssics, KDF,
compressió i el contenidor `.clab`. També cobreix els casos d'error (contrasenya buida, dades
manipulades, paràmetres no vàlids).

`vitest.config.ts` redirigeix `brotli-wasm` al build de Node perquè el mateix codi funcioni fora del
navegador durant els tests.

---

## Desplegament

La build és **estàtica pura**: no cal cap servidor, variable secreta ni base de dades.

### Cloudflare Workers (producció, actualització automàtica)

<https://cryptolab.ivanblogger15.workers.dev>

El Worker està connectat al repositori de GitHub, així que **cada push a `main` compila i desplega
sol**:

| Paràmetre | Valor |
| --- | --- |
| Repositori | `ivanblogger15-maker/cryptolab` |
| Branca de producció | `main` |
| Build command | `npm run build` |
| Directori de sortida (assets) | `docs` |
| Variable d'entorn | `NODE_VERSION=22` |

Els fitxers estàtics del Worker són **gratis i il·limitats** (no compten contra el límit de requests
del pla gratuït, perquè no s'executa codi de Worker per a ells). `public/_headers` es copia a
`docs/_headers` i Cloudflare l'aplica: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Permissions-Policy` i caché immutable d'un any per a `/assets/*`.

> No activis *Cloudflare Access* en aquest Worker: posaria un login i la web deixaria de ser pública.

### GitHub Pages (mirall)

<https://ivanblogger15-maker.github.io/cryptolab/>

GitHub Pages serveix la carpeta `docs/` de la branca `main` (*Settings → Pages → Deploy from a branch
→ main /docs*). Com que publica el que hi ha al repositori, després de cada canvi cal compilar i
committejar la build:

```bash
npm run build
git add docs
git commit -m "build: publica la versió web"
git push
```

Cloudflare, en canvi, compila des del codi font i no necessita el commit de `docs/`.

---

## Privadesa i seguretat

- **Zero servidors.** No hi ha backend, ni analítiques, ni cap petició amb les teves dades.
- Les claus i els fitxers viuen a la memòria del navegador i desapareixen en recarregar la pàgina.
- La generació aleatòria usa `crypto.getRandomValues()`.
- Els contenidors `.clab` inclouen autenticació (AEAD) quan l'algorisme la suporta.
- **Avisos:** MD5, SHA-1, AES-CBC/CTR sense AEAD, XOR, OTP manual i els xifrats clàssics s'inclouen
  amb finalitat educativa i **no** són adequats per protegir secrets reals. Fes servir AES-256-GCM,
  ChaCha20-Poly1305 o XChaCha20-Poly1305.
- Cap eina pot protegir-te d'un navegador compromès, d'extensions malicioses o d'un atacant amb accés
  físic al dispositiu.
- Els hashes de contrasenyes (bcrypt, Argon2id, scrypt) són d'un sol sentit: no es poden revertir.
- El codi és obert i auditable; les dependències criptogràfiques són estàndard o auditades
  (`@noble`, `hash-wasm`, WebCrypto).

---

## Compatibilitat

Cal un navegador modern amb **WebCrypto**, **WebAssembly** i **Compression Streams**:

- Chrome / Edge 111+
- Firefox 113+
- Safari 16.4+

Funciona igual en escriptori i mòbil. No requereix instal·lació ni permisos especials; el mode fitxer
fa servir només `File`/`Blob` locals (els fitxers no s'envien enlloc).

---

## Contribuir

1. Fes un fork i una branca (`feat/nova-eina`).
2. Afegeix l'eina a `src/lib/tools/`, el text a `src/i18n/{ca,es,en}.ts` i un test de round-trip.
3. Comprova `npm run typecheck && npm test && npm run build`.
4. Obre un pull request.

---

## Llicència

[MIT](LICENSE) © 2026 CryptoLab
