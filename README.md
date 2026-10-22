# 🔐 CryptoLab

**Xifra, codifica i resum qualsevol text o fitxer — 100 % dins del teu navegador.**

CryptoLab és una aplicació web estàtica (sense servidor, sense comptes, sense telemetria) que reuneix
63 eines de criptografia, codificació i compressió en una sola interfície. Les claus, les contrasenyes
i els fitxers **no surten mai del dispositiu**: tot es calcula amb WebCrypto, mòduls JavaScript i WASM
que s'executen a la pàgina.

> Interfície en **català** (per defecte), **castellà** i **anglès**.

---

## Eines incloses

| Categoria | Eines |
| --- | --- |
| **Xifrat simètric** | AES-256-GCM, ChaCha20-Poly1305, XChaCha20-Poly1305, XSalsa20-Poly1305, AES-256-CBC, AES-256-CTR, ChaCha20, Salsa20 |
| **Xifrat asimètric** | RSA-OAEP híbrid (2048+), ECIES (ECDH P-256 + AES-256-GCM), intercanvi de secret ECDH, generador de claus RSA/P-256/P-384/Ed25519 |
| **Hashes i signatures** | MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-512, BLAKE2b, BLAKE3, CRC-32, HMAC-SHA256/512, bcrypt, Argon2id, scrypt |
| **Signatures** | Ed25519, ECDSA P-256/P-384, RSA-PSS (signa i verifica) |
| **Codificacions** | Base64, Base64 URL, Base32, Base58, Base62, Ascii85, hex, binari, octal, decimal, percent-encoding, entitats HTML, escapat Unicode, A1Z26, Morse, Bacon |
| **Xifrat clàssic** | Cèsar (amb força bruta), ROT13, ROT47, Atbash, Vigenère, Afí, Playfair, Rail Fence, transposició columnar, XOR, One-Time Pad |
| **Derivació de claus** | PBKDF2-SHA256, scrypt, Argon2id, generador de contrasenyes/bytes/UUID |
| **Compressió** | GZIP, DEFLATE (zlib), Brotli (WASM sota demanda) |

### Contenidor `.clab`

Quan xifres amb contrasenya, CryptoLab genera un fitxer `.clab`:

```
"CLAB" | versió | capçalera JSON | payload xifrat
```

La capçalera inclou l'algorisme, l'IV/nonce, el KDF i els seus paràmetres (iteracions, N de scrypt,
memòria d'Argon2id), el salt, el nom original i el tipus MIME. Per desxifrar només cal la contrasenya:
la resta es detecta automàticament.

---

## Desenvolupament

Requisits: Node.js 20+ i npm.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript
npm test           # 69 tests de round-trip amb Vitest
npm run build      # producció a docs/
npm run preview    # serveix docs/
```

### Stack

- **Vite 8** + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- [`@noble/ciphers`](https://github.com/paulmillr/noble-ciphers) i [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) — ChaCha20, Salsa20, BLAKE, SHA-3…
- [`hash-wasm`](https://github.com/Daninet/hash-wasm) — Argon2id, bcrypt, scrypt
- **WebCrypto** — AES, RSA, ECDH, ECDSA, Ed25519, PBKDF2, HMAC
- [`brotli-wasm`](https://github.com/httptoolkit/brotli-wasm) — Brotli (carregat només quan s'usa)

Totes les dependències criptogràfiques són auditades o estàndard; no hi ha cap crida de xarxa en temps
d'execució (excepte la descàrrega opcional del mòdul WASM de Brotli si el serveixes tu mateix).

---

## Seguretat i límits

- **Zero servidors.** No hi ha backend, ni analítiques, ni cap petició amb les teves dades.
- Les claus i els fitxers viuen a la memòria del navegador i desapareixen en recarregar la pàgina.
- Els contenidors `.clab` inclouen autenticació (AEAD) quan l'algorisme la suporta: una contrasenya
  incorrecta o un fitxer manipulat fallen en lloc de retornar dades esbiaixades.
- La generació aleatòria usa `crypto.getRandomValues()`.
- **Avisos:** MD5, SHA-1, AES-CBC/CTR sense AEAD, XOR, OTP manual i els xifrats clàssics s'inclouen amb
  finalitat educativa i **no** són adequats per protegir secrets reals. Fes servir AES-256-GCM,
  ChaCha20-Poly1305 o XChaCha20-Poly1305.
- Cap eina pot protegir-te d'un navegador compromès, d'extensions malicioses o d'un atacant amb accés
  físic al dispositiu.
- Els hashes de contrasenyes (bcrypt, Argon2id, scrypt) són d'un sol sentit: no es poden revertir.

---

## Llicència

[MIT](LICENSE) © 2026 CryptoLab
