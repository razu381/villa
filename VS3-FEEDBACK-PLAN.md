# Client feedback VS3 (2026-10-29) — classic site and shared components

Source: `client provided assets/Comments-ROD-VS3.pdf` (6 pages, PT notes on VS3 screenshots; checked visually against the assets and current code). **Shared changes may also affect the 3D route; this is approved.** Fonts, brand assets, the calendar/invitation, root layout and GTM can be updated in their existing shared locations. Include a 3D smoke check when those change.

Updated 2026-10-29 after the client's asset drop and review. `client provided assets/updated client assets/` contains added assets alongside copies of older material; "updated" describes the delivery, not a complete post-feedback redesign. Inventory includes the rest of `client provided assets/`, especially the original Phidias logos; see §1b.

Approved decisions: use a separate `--font-script` variable; all three "Request brochure" CTAs continue to the existing visit form for now; remove the Phidias-logo dependency; correct logo/map measurements and expand the PT/EN checklist. The site is currently not shared with the public, so publishing an empty privacy page and leaving legal content pending is allowed for this stage.

## 1. Client inputs still pending

*The DOCX supplies bilingual story copy, and the layouts contain placeholder contacts (`+351 912 345 678`, `hello@phidi.as`, `info@phidias.com`), rather than verified advisor details. Original Phidias logos with tagline are already available under `new assets/logo-phidias/logo-phidias_RGB/`. No brochure file, policy/legal copy or social profile URLs were found. These content follow-ups do not block the approved nonpublic preview; leave unresolved content pending rather than inventing it.*

| Need | For item | Note |
|---|---|---|
| Verified advisor phone, email and WhatsApp number | advisor contacts + WhatsApp link | `ADVISOR.phone`, `ADVISOR.email` and `ADVISOR.whatsapp` still use layout placeholders. "Verificar número com Amina." |
| Brochure file or final delivery destination | brochure CTA | Pending for a later stage. Approved now: the menu, header and footer buttons all open the existing visit form. |
| Which social icons + profile URLs | footer socials | "Confirmar com Amina quais ícones inserir." |
| Legal text for the footer | footer legal | Replaces "Artistic interpretation. Not to scale."; leave the replacement pending on the current nonpublic site. |
| Privacy policy content | footer links | Approved now: publish the empty route, footer link and sitemap entry on the nonpublic site. Final content remains a follow-up before public launch. |
| Partner URLs | footer links | **Found online (2026-10-29), pending client confirm:** FCM → `https://www.fcm.pt` (Grupo FCM / FCM Construções S.A., contractor, residential builds in Cascais area); BPI → `https://www.bpi.pt` (Banco BPI); Porta da Frente → `https://www.portadafrente.com` (Porta da Frente Christie's International Real Estate, AMI 6335, has an Oeiras office). All three fetched and confirmed live. |
| **Tagline spelling** | tagline swap | The supplied script lockups (Ativo 7/8/9) read **"Leaving in harmony"** — typo or intended? Site copy says "Living in harmony". Confirm before the script tagline ships. |
| Additional grafismos scope | grafismos | Layouts are placement references, not a complete post-feedback specification. `bola-view.png` belongs to Gallery. Additional placements stay in §2b. |
| Font web licence | fonts | Zip has no standalone licence file, but Normalidad's embedded licence text mentions a separate web-embedding upgrade. Confirm entitlement; WOFF2 availability alone does not establish it. |

## 1b. Assets received — checked inventory

| File (in `updated client assets/`) | Is |
|---|---|
| `FONTS/FONTS/Adventures-Unlimited-Script-Regular.otf` | The "Adventure" script font — actually **Adventures Unlimited Script**, Regular, OTF. Tested Portuguese accented characters are present. |
| `FONTS/normalidad.zip` | **Normalidad Compact** family, Thin→Black, TTF/WOFF/WOFF2 + a `NormalidadVar-Regular`. Use the Compact cuts. |
| `NOVA-LOGO-VL/Logo-VilaLeku-Versao-Nova-Green.png` / `-White.png` (3508×897) | Supplied geometric monoline `VILALEKU` wordmark, olive / white, with large transparent margins. Visible artwork bounds: `(226, 267)` to `(3355, 691)`, **3129×424 ≈ 7.38:1**; existing mark ≈ 7.34:1. Crop before replacing `brand/wordmark.png`. |
| `NOVA-LOGO-VL/Ativo 5.png` / `Grafismos-Site/Ativo 6.png` (156×70) | The leaf/lens emblem, black / white. |
| `NOVA-LOGO-VL/Ativo 7/8/9.png` (approximately 648×75) | Script tagline lockup **"Leaving in harmony"**, olive-grey / black / white; spelling follow-up in §1. |
| `Grafismos-Site/FAVICON.png` (A4 canvas) | The leaf emblem, olive outline, big margins → crop. |
| `Grafismos-Site/LOGO-VL-Principal-Nova.png` | Wordmark on A4 canvas (same shapes as the Green/White files). |
| `Grafismos-Site/simbolo-3vezes.png` (744×258) | The arch triptych in sage, matching the artwork used by `brand/arches.png`. Canonical trio reference. |
| `Grafismos-Site/simbolo-lateral-branco.png` (414×389) | Single white corner arch (top bar + quarter arc), flush crop. |
| `Grafismos-Site/faixa-rodape-1.png` (1926×541) | Solid sage footer band. |
| `Grafismos-Site/barra-superior.png` (1926×120) | Solid light-sage top strip. |
| `Grafismos-Site/bola-view.png` (90×89) | Sage circle badge, white "View"; shown in Gallery in the desktop layout. |
| `Grafismos-Site/lettering-Villas.png` (899×251) | "VILLAS" in the geometric logo lettering (not script). |
| `SITE-IMAGENS/Helen Morais -35.jpg` (1024×1536) | New advisor portrait, head+torso, 2:3 — vision check says ideal crop for the arch frame. |
| `SITE-IMAGENS/MAP/mapa12.png` (5700×4788) | Illustrated watercolour map, North-up. Pin-circle centre is approximately **x: 63.4%, y: 51.5%** of the full image. POI labels and 15/25-min travel pills are **baked into the artwork** (Taguspark, Lagoas Park, Oeiras Parque, beaches, Cascais, Lisbon, airport…). |
| `GA4/Vilaleku - GA4.txt` | Google Tag Manager container **GTM-K59NNWBH** (head script + noscript). |
| `DESKTOP-LAYOUT/Vila-Leku-Desktop(1).ai`, `Vila-Leku-Desktop.ai`, `Vila-Leku-Mobile.ai`, `Vila-Leku-Desktop_compressed.pdf` | Layout references delivered with the added assets. Both desktop AIs are byte-for-byte identical to each other; the compressed PDF is byte-for-byte identical to the original delivery's PDF. Embedded layout dates precede VS3 feedback. Use the VS3 comments and DOCX wherever the older layouts disagree. |
| `IMAGENS - VILA LEKU/10.Rev05/**` (HR + EM BAIXA) | Rev05 renders: V4 living/dining/bedroom/garden/garage/elevator hall, V3 living/dining/master/bedroom, facades, pool, gym, coworking, river-view aerial, aerial 2. |
| `IMAGENS - VILA LEKU/12. Imagens_Dinamicas/**` | Dynamic perspective videos: V4 living room, suite balcony (MP4 + AFT project). |

Also received outside `updated client assets/`: `new assets/logo-phidias/logo-phidias_RGB/` contains original full-logo and lettering-only lockups, with and without tagline, in colour/positive/negative variants (for example `logo-phidias-negative-tagline.png` and `logo-phidias-lettering-tagline-color.png`). No further Phidias-logo delivery is needed.

## 2. Implementation work — nonpublic preview approved

**Status 2026-10-29: implemented** (commits `b3369e8`…`4041024`): items 1–8, 10–20 and §3 and §4 in full; §5.5 checks passed (typecheck, `npm run build`, static export verified: fonts, map WebP set, icon.png, privacy route, GTM script + noscript, 3D route smoke). Item 9 (footer socials) stays blocked on §1 (icons + URLs). §2b optional additions not in this pass.

Keep related changes together. Typecheck + classic desktop/mobile screenshots before landing; smoke-check the 3D route for shared changes. §1 tracks pending inputs without blocking unrelated work or the approved empty privacy page. Run the production export check in §5 before publishing the preview.

1. **Favicon → the leaf.** Crop the emblem from `Grafismos-Site/FAVICON.png` (olive outline on transparent — keep alpha; pad square). Replaces `app/icon.svg` (arch "L" mark).
2. **Tagline disappears when the wordmark docks.** `components/classic/Hero.tsx`: `.vc-hero__tagline` fades in at `data-phase="2"` (`app/classic.css:420,458`) and stays. Tie its opacity to the same dock progress `p` in `Hero.tsx` `update()` (fade out over `p` 0 → ~0.35; hidden by `p ≥ 1`, like the mark).
3. **Menu CTA "Private visit" → "Request brochure"**: `CLASSIC.visitCta` (`lib/classic-content.ts:58`) — menu panel CTA, header bar button, footer. Approved: change all three and keep their existing `#visit` destination and name-field focus. The visit section and form remain as they are for now; submission currently shows a demo invitation without sending a request. Brochure delivery is a later follow-up, not part of this change.
4. **Calendar "Golden hour" → "Evening"**: `UI.form.timeOptions` (`lib/ui-copy.ts:81`, id `golden` → `evening`), `TIME_WORDS` ("at golden hour" → "in the evening"), initial form state `Invitation.tsx:42` and demo invite `:56`. Shared with the 3D demo's identical form — it inherits; approved.
5. **Calendar: remove "Not sure yet"**: `UI.form.homeOptions` (`lib/ui-copy.ts:74`, drop id `any`); new default `home: "v3"` (`Invitation.tsx:42`); walk `VisitRequest` type + `InvitationCard` + `requestVisit` flows.
6. **Use an original Phidias lockup.** Remove the separately rendered `UI.footer.signature` from `ClassicFooter` (`vc-footer__dev`) and use the already supplied original negative/positive logo with tagline as appropriate for the footer background. Keep its proportions and ensure the tagline appears only once. Shared `PhidiasMark` changes may also affect the 3D footer; approved, check that caller too.
7. **Footer legal text**: remove `BRAND.disclaimer` ("Artistic interpretation. Not to scale.", `lib/content.ts:12`) from `vc-footer__legal`; keep the © line. Approved for the current nonpublic site: leave replacement legal text empty until the client provides it.
8. **Footer links: privacy + livro de reclamações + partners.** Livro de reclamações → `https://www.livroreclamacoes.pt`. Privacy: static route (`app/privacy/page.tsx`), empty policy content for now; publish its footer link and `public/sitemap.xml` entry on the current nonpublic site as approved. Final policy copy remains a follow-up before public launch. Partners: link each `PARTNERS` name → FCM `https://www.fcm.pt`, BPI `https://www.bpi.pt`, Porta da Frente `https://www.portadafrente.com` (client confirmation still tracked in §1).
9. **Footer social icons**: contact column, uniform size, inline SVGs in `currentColor`; icons + URLs §1.
10. **Space → separator line (PDF p. 3).** The highlighted gap is between Village Heart and the Villas heading. Check `.vc-heart__inner` bottom spacing, the desktop pin/mobile sticky handover, and `.vc-villas` `padding-top` (`app/classic.css:607+`, `:989+`); reduce the actual gap and add a hairline (`--vc-line`) full content width. Verify normal and reduced-motion layouts.
11. **Remove the footer arches (PDF p. 6).** Confirmed: the three arch outlines top-right of the beige footer — `vc-footer__arches` (`ClassicFooter.tsx:75`). Delete svg + CSS. (Note: the client also supplied `simbolo-3vezes.png`, the canonical trio — it belongs to the Visit trio, item 13, not back into the footer.)
12. **Advisor photo: arch line must cover the whole photo (PDF p. 5).** `Visit.tsx`: `is-3` arch is `inset: 0` over `.vc-visit__clip` (`inset: 3.3% 3.7% 0`, `classic.css:1748`). Adjust clip/arch so the stroke frames the photo's full edge; verify desktop + mobile.
13. **Visit arch trio the same size (PDF p. 5).** The three arches left of Helen's portrait (`is-1`/`is-2`/`is-3`, `classic.css:1737`) become one size — three identical arches as in `simbolo-3vezes.png`.
14. **Reuse the Visit→footer transition (PDF p. 6).** Confirmed: how the light Visit section hands over into the beige footer (`ClassicFooter` gsap scrub + veil). Lift the same pattern to other section joins (concept→heart, heart→villas, location→gallery): next section rises from beneath with a soft colour handover.
15. **Wordmark asset swap** (assets in). Crop the supplied Green/White PNG's transparent margins to its **3129×424 visible artwork (≈ 7.38:1)** before replacing `public/media/brand/wordmark.png`. Update the shared `.vl-wordmark` aspect ratio to the cropped asset's dimensions; its previous ratio is ≈ 7.34:1, so start with the existing sizes and adjust only if screenshots show a need. Reuse the current `currentColor` mask for white/green presentation. Check hero docking, header, footer, map card and 3D/invitation callers.
16. **Tagline → Adventures script** (assets in, spelling §1). Render `.vc-hero__tagline` (and the header script line if kept) as live text using the separate `--font-script` variable in §4, so PT/EN stays possible. Use Ativo 7/8/9 as the artwork reference only. Keep `BRAND.tagline` copy as "Living in harmony" until the client answers the spelling question.
17. **Helen photo swap** (asset in). Replace `public/media/classic/advisor.jpg` with `Helen Morais -35.jpg` (crop to the arch's 108:120; head+torso fits). Update `PHOTOS.advisor` w/h.
18. **Map swap** (asset in). Convert `mapa12.png` to a JPEG source at `public/media/classic/map.jpg`, update `PHOTOS.map` dimensions, and let `scripts/export-images.mjs` generate responsive WebP files. The exporter currently discovers JPEG originals only. The POI labels and travel pills are baked in: drop the `MAP_SPOTS` overlays, SVG lines and unused hover state (`Location.tsx`, `classic-content.ts:150`); render the drive-time list as plain text. Keep the VilaLeku marker card. Set the pin centre near **x: 63.4%, y: 51.5%**, measure the green label bounds for `MAP_MARKER.box`, and verify the hit area/card placement after image conversion on desktop/mobile. Keep the supplied map artwork for both languages for now; its baked-in English labels do not change with the switcher.
19. **GTM** (asset in). Add the head script + body noscript from `GA4/Vilaleku - GA4.txt` (container `GTM-K59NNWBH`) to the shared root layout (`app/layout.tsx` via `next/script`). Loading on both the classic and 3D routes is approved. Verify it in the static export.
20. **WhatsApp number on the V3 button**: already wired (`whatsappLink()` in `Villas.tsx:130`, `Visit.tsx:87`); blocked only on the real number (§1).

### 2b. Optional additions (assets in; layouts remain references)

- **Rev05 render swaps** where the classic site uses older cuts: V3 dining/master/bedroom/living, V4 living/bedroom/garden/facades, pool, gym, cowork, aerials; new: garage, elevator hall, river-view aerial. Use the delivered layouts as photo references without reinstating older copy or superseded feedback (touching `PHOTOS` in `lib/classic-content.ts` + JPEG conversion).
- **Grafismos placement** using the delivered layouts: `barra-superior.png` (top strip), `faixa-rodape-1.png` (footer band), `bola-view.png` ("View" badge in Gallery), `lettering-Villas.png` (Villas title lettering), `simbolo-lateral-branco.png` (white corner arch — photo/section corner frame). Additional placements remain optional scope.
- **Dynamic videos** (V4 living, suite balcony): candidate section media or hero alternates. Pitch-grade; decide with the client.

## 3. PT / EN switcher in the menu (PDF p. 1) — the big one, staged

- **Copy source exists, with gaps**: `Site Vila Leku_textos.docx` contains PT-PT/EN concept copy, pillars, amenities, floor descriptions and distances. Extract those approved pairs into dictionaries. Translate remaining headings, home names/specifications/status, location intro, visit copy, navigation, buttons, footer, form, validation messages, confirmation text, image descriptions and accessible labels; client wording review remains tracked.
- **Plumbing**: story copy in `lib/content.ts` + `lib/classic-content.ts`; shared interface strings in `lib/ui-copy.ts`. Use `{ en, pt }` dictionaries + a small zustand language store and `useLang()`. Reuse the existing shared form/card and request types; no mandatory fork to preserve the old 3D labels. Persist the choice in `localStorage`, initialise browser/storage preferences after hydration, and set `<html lang>` to `pt-PT` / `en`. Proposed default remains **PT** for PT browsers / **EN** otherwise (confirm).
- **Menu**: "PT | EN" toggle in the desktop nav panel and mobile sheet, current language marked.
- **Dates and generated text**: make `formatVisitDate()` and `visitDays()` in `lib/ui-time.ts` use the selected `pt-PT` / `en-GB` locale for weekdays, months and full dates. Use that same locale/copy in `Invitation`, `InvitationCard`, validation and screen-reader announcements; language changes must keep entered form values.
- **Headings and animation**: replace English-dependent fragments such as `split(" around ")` in `VillageHeart` and the hardcoded `around` / `Vila` joins in headings with explicit translated text/accent parts. Check `Concept`, `Location`, `Gallery` and `Visit`; refresh text-splitting/scroll measurements when language changes so old words or animation spans cannot return.
- **Script coverage checked**: the supplied Adventures OTF contains the tested Portuguese accented characters (ã, ç, é and their common accented/uppercase counterparts). Preserve them when subsetting; visual-check the Portuguese copy.
- **Acceptance**: switch both ways on desktop/mobile, reload the saved choice, inspect dates/errors/confirmation/accessibility text, and verify headings and form values survive switching. The supplied map's baked-in English labels remain an explicit asset limitation; a translated map would require another asset or separate follow-up. Full translation of the 3D story is outside this request, while shared updates there are allowed.
- **Later / optional**: static `/pt` route or `?lang=` + `hreflang` for SEO. Skip for now.

## 4. Fonts (PDF p. 1–2) — assets in, licence confirm §1, one commit

Replace the Instrument font imports in `app/layout.tsx` once their remaining uses are migrated. Shared font changes affecting the 3D route are approved. Self-host the supplied fonts, subject to licence confirmation in §1:

- **Normalidad Compact** — use the supplied WOFF2 cuts and load only the weights actually used. Set **both `--font-sans` and `--font-display` to Normalidad** in `app/globals.css`, so standard text and headings use the requested family. Keep paragraphs (`.vc-ink` included), villa names/area figures, gallery controls, advisor names and mobile navigation on Normalidad.
- **Adventures Unlimited Script** — add a **separate `--font-script`** variable. Convert/subset the OTF to WOFF2 where permitted, preserving Portuguese characters. Apply `var(--font-script)` explicitly to `.vc-hero__tagline`, the handwritten `<em>` accents in `.vc-title`, and designated handwritten captions. Do not assign the script to `--font-display` or every existing display-font selector. Use normal font style, no forced uppercase, suitable letter spacing and a taller line-height for script text.
- Retune sizes/line-height across `classic.css`; full classic desktop/mobile screenshot pass (hero, titles, pillars, form, footer) plus the affected shared 3D typography and invitation card.

## 5. Order

1. Start the §3 DOCX extraction and string inventory early. Resolve the font entitlement in parallel; implement §4 font variables/families before final spacing and screenshot tuning.
2. §2 items 1–11, 15–19, 20: quick fixes, existing original Phidias logo, cropped wordmark, portrait/map assets, shared GTM and approved brochure-to-form links. Publish the empty privacy route/link/sitemap entry on the current nonpublic site. Apply pending client inputs when supplied; keep unrelated work moving.
3. §2 items 12–14: visual fixes and additional transitions; before/after screenshots on desktop/mobile and reduced-motion checks, especially around the pinned/sticky Village Heart section.
4. Finish §3 PT/EN and its acceptance checks with the final fonts. Smoke-check the affected 3D components as well as the classic site.
5. Before preview publication: run `npm run typecheck` and `npm run build`; verify generated responsive-image URLs, map marker/card alignment, logo docking, the linked empty privacy route, brochure-to-form focus and GTM in the static export. Brochure requests still use the demo form; no delivery/backend is added in this phase.
6. §2b optional render/grafismos/video additions remain separate from the VS3 fixes. Track approved legal/privacy content, verified contacts/socials/partner destinations and final brochure delivery for the public-launch stage.
