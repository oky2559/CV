# SPEC — CV de Victor Schmutz en site web

## Objectif

Un CV en ligne, **original et mémorable**, qui donne envie à un recruteur tech de contacter Victor.
Style « éditorial animé » : typographie géante, fond sombre avec un accent néon, animations au scroll soignées, avec quelques clins d'œil pour développeurs (terminal caché, stats GitHub live).
Le site est **statique**, bilingue **FR / EN**, et tourne dans un **conteneur Docker** sur le serveur de Victor.

Public principal : recruteurs et équipes tech (stage, alternance, emploi en développement). Ils doivent trouver l'essentiel en moins de 10 secondes, même si l'effet « waouh » est là.

## Périmètre

### Ce que fait la v1

- **Hero** : nom, titre, accroche, révélation animée du nom lettre par lettre, indicateur de scroll.
- **À propos** : courte bio, photo (ou initiales si pas de photo), localisation.
- **Expériences + formation** : timeline verticale animée (poste, entreprise, dates, description, technos).
- **Projets** : cartes avec titre, description, stack, liens GitHub / démo, effet au survol.
- **Compétences** : stack technique groupée par catégorie, langues parlées.
- **Contact** : email (lien `mailto:` + bouton « copier »), GitHub, LinkedIn.
- **Bilingue FR / EN** : `/` en français, `/en/` en anglais, bouton de bascule qui garde la section courante.
- **Animations** : scroll fluide, apparitions au scroll, curseur personnalisé (desktop), grain léger. Tout est désactivé proprement si l'utilisateur a demandé « réduire les animations ». Animations courtes : l'essentiel du haut de page est lisible en moins de 1 s, une section est lisible dès qu'on y arrive.
- **Thème jour / nuit** : thème sombre et thème clair, bouton soleil/lune dans la navigation. Par défaut, le réglage du système du visiteur ; son choix est retenu. Pas de flash de mauvais thème au chargement.
- **Bouton « Télécharger en PDF »** : feuille de style d'impression dédiée ; le bouton ouvre l'impression du navigateur, qui produit un PDF propre, sobre, sur 1 à 2 pages A4.
- **Easter egg terminal** : la touche `` ` `` (ou `Ctrl+K`) ouvre un mini-terminal par-dessus la page. Commandes : `help`, `whoami`, `experience`, `projects`, `skills`, `contact`, `lang fr|en`, `github`, `clear`, `exit`, et `sudo hire-victor` (surprise). Un petit indice discret en bas de page invite à le trouver.
- **Stats GitHub live** (compte `oky2559`) : nombre de repos publics, top langages, dernière activité. Récupérées dans le navigateur via l'API publique GitHub, mises en cache 1 h. En cas d'échec (réseau, limite d'API), le bloc disparaît sans erreur visible.
- **Contenu dans un seul fichier** `src/data/cv.json`, validé au build : une faute de structure fait échouer le build avec un message clair.
- **Docker** : image multi-étapes (build Node → Nginx), une commande pour lancer, en-têtes de sécurité et compression.
- **Bases qualité** : métadonnées SEO et Open Graph, favicon, lisible sans JavaScript, responsive dès 360 px, contrastes accessibles.

### Hors périmètre (v2 éventuelle)

- Back-office / édition en ligne du contenu.
- Formulaire de contact avec envoi serveur (on reste sur `mailto:`).
- Scène 3D, mini-jeu.
- Blog, pages de détail par projet.
- Génération PDF côté serveur (on utilise l'impression du navigateur).
- Analytics, cookies.
- HTTPS et nom de domaine : gérés par le serveur existant (reverse proxy) devant le conteneur.

## Stack et dépendances

| Rôle | Choix | Pourquoi |
|---|---|---|
| Générateur de site | **Astro 5** (sortie 100 % statique) | Éprouvé, HTML statique ultra rapide, i18n intégré, validation de contenu avec zod |
| Langage | TypeScript | Sécurité sur le contenu et la logique du terminal |
| Style | CSS natif (variables, `@layer`), pas de framework | Contrôle total pour un design sur mesure |
| Polices | Auto-hébergées via `@fontsource` (une display type *Clash Display* / *Space Grotesk*, une mono type *JetBrains Mono*) | Pas d'appel à Google Fonts, pas de souci RGPD |
| Animations | **GSAP** (+ ScrollTrigger, SplitText, gratuits) et **Lenis** (scroll fluide) | Standards du web créatif, fiables |
| Tests unitaires | **Vitest** | Rapide, natif avec Vite/Astro |
| Tests bout en bout | **Playwright** (Chromium) | Vérifie le vrai site construit, desktop + mobile |
| Service | **Docker** : `node:22-alpine` pour builder, `nginx:alpine` pour servir | Une image autonome, facile à déployer |

Prérequis locaux : Node 22+, npm, Docker.

## Structure des fichiers

```
CV/
├── SPEC.md
├── README.md                     # lancer, modifier le contenu, déployer
├── package.json
├── astro.config.mjs              # i18n fr (défaut) / en, sortie statique
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts          # build + preview puis tests
├── Dockerfile
├── docker-compose.yml            # port 8080 → 80
├── nginx.conf                    # gzip, cache, en-têtes de sécurité, 404
├── .dockerignore
├── content-source/
│   └── linkedin.pdf              # export LinkedIn déposé par Victor (non publié)
├── public/
│   ├── favicon.svg
│   ├── og-image.png
│   └── photo.jpg                 # optionnel ; sinon initiales
├── src/
│   ├── data/
│   │   ├── cv.json               # TOUT le contenu, champs { fr, en }
│   │   └── schema.ts             # schéma zod + type CV
│   ├── i18n/
│   │   └── ui.ts                 # libellés d'interface FR/EN
│   ├── lib/
│   │   ├── cv.ts                 # charge + valide cv.json, helpers par langue
│   │   ├── terminal.ts           # logique pure des commandes (testable)
│   │   └── github.ts             # fetch + cache + agrégation des stats
│   ├── scripts/
│   │   ├── motion.ts             # GSAP, Lenis, curseur, reduced-motion
│   │   ├── terminal-ui.ts        # branche terminal.ts au DOM
│   │   └── github-ui.ts          # affiche / masque le bloc stats
│   ├── styles/
│   │   ├── tokens.css            # couleurs, typo, espacements
│   │   ├── global.css
│   │   └── print.css             # version PDF
│   ├── components/
│   │   ├── Hero.astro  About.astro  Timeline.astro  Projects.astro
│   │   ├── Skills.astro  Contact.astro  GithubStats.astro
│   │   ├── Terminal.astro  LangSwitch.astro  Nav.astro  Seo.astro
│   ├── layouts/
│   │   └── Base.astro
│   └── pages/
│       ├── index.astro           # FR
│       ├── en/index.astro        # EN
│       └── 404.astro
└── tests/
    ├── unit/                     # schema, terminal, github
    └── e2e/                      # smoke, i18n, terminal, print, reduced-motion
```

## Hypothèses prises

1. **Ambiance** (choisie pour toi) : fond quasi noir `#0B0B0C`, texte crème `#F2EFE8`, accent néon vert-citron `#C6FF3D`. Titres en grande typo display (sans écraser le contenu : le haut de page tient sur un écran avec nom, métier et accroche lisibles), détails en mono pour le côté « dev ». Thème clair : fond crème `#F4F1EA`, texte quasi noir, accent vert foncé lisible sur fond clair.
2. **Contenu** : extrait de `content-source/linkedin.pdf` (export « Enregistrer au format PDF » de LinkedIn), puis traduit pour avoir FR + EN. **Si le PDF n'est pas encore déposé**, la section 3 met un contenu fictif réaliste marqué `TODO` et le reste du travail n'est pas bloqué.
3. **Projets** : l'export LinkedIn en contient peu ; on complète avec les repos publics les plus pertinents de `oky2559` (lus via l'API GitHub au moment de remplir le contenu). Victor valide ensuite.
4. **Photo** : l'export LinkedIn n'en contient pas. Si `public/photo.jpg` existe, on l'affiche ; sinon un monogramme animé « VS ».
5. **Langue par défaut** : français sur `/`, anglais sur `/en/`. Pas de redirection automatique selon le navigateur (évite les surprises et les soucis de cache) ; le bouton de bascule suffit.
6. **Contact** : pas de formulaire, `mailto:` + bouton copier. L'email est celui du PDF LinkedIn (ou à renseigner dans `cv.json`).
7. **Stats GitHub** : appel direct depuis le navigateur à l'API publique (60 requêtes/h par visiteur, largement suffisant), cache `sessionStorage` 1 h, aucun jeton.
8. **Sans JavaScript** : tout le contenu est lisible (HTML statique) ; seuls les animations, le terminal et les stats GitHub en dépendent.
9. **Hébergement** : le conteneur écoute en HTTP sur le port 80 (exposé en 8080). HTTPS et domaine sont gérés par le reverse proxy déjà présent sur le serveur. L'URL publique du site est lue dans la variable `SITE_URL` au build (défaut `http://localhost:8080`) pour les balises SEO.
10. **Navigateurs** : 2 dernières versions de Chrome, Firefox, Safari, Edge ; mobile iOS/Android.

## Sections de travail

Chaque section se termine par `npm test` au vert.

### 1. Squelette du projet et outillage de tests
Modèle: sonnet | Effort: medium
Pourquoi: installation standard d'Astro, Vitest et Playwright, bien balisée mais avec plusieurs outils à faire cohabiter.

- Initialiser Astro 5 (TypeScript strict, sortie statique), i18n `fr` (défaut, sans préfixe) et `en`.
- Scripts npm : `dev`, `build`, `preview`, `test` (voir plus bas).
- Vitest + un test trivial ; Playwright (Chromium, projets desktop et mobile) qui construit puis sert le site.
- Pages `/` et `/en/` minimales affichant « Victor Schmutz ».
- **Visible** : `npm run dev` affiche la page ; `npm test` passe (1 test unitaire + 1 test e2e qui vérifie le titre sur `/` et `/en/`).

### 2. Schéma de contenu et chargement
Modèle: sonnet | Effort: medium
Pourquoi: modélisation de données simple avec zod, sans logique complexe.

- `src/data/schema.ts` : schéma zod de tout le CV (identité, bio, expériences, formations, projets, compétences, langues, liens), chaque texte sous forme `{ fr, en }`.
- `src/lib/cv.ts` : charge `cv.json`, valide, expose `getCV(lang)` qui renvoie les textes dans la bonne langue ; expériences triées de la plus récente à la plus ancienne.
- `cv.json` initial avec contenu fictif minimal valide.
- Tests unitaires : JSON valide accepté ; champ manquant → erreur lisible qui indique le chemin fautif ; tri des dates ; bascule de langue.
- **Visible** : les pages affichent le nom et le titre tirés de `cv.json`.

### 3. Remplissage du contenu depuis l'export LinkedIn
Modèle: sonnet | Effort: medium
Pourquoi: extraction et traduction de texte vers un format déjà défini, sans logique de code.

- Lire `content-source/linkedin.pdf` ; remplir `cv.json` (FR + EN, traduction naturelle, pas mot à mot).
- Compléter les projets avec 3 à 6 repos publics pertinents de `oky2559`.
- Réécrire l'accroche et la bio pour qu'elles sonnent humaines et percutantes (courtes).
- Si le PDF est absent : contenu fictif réaliste, chaque champ inventé marqué `"TODO: "`, et un test qui **avertit** (sans échouer) s'il reste des `TODO`.
- Exclure `content-source/` du dépôt public et de l'image Docker.
- **Visible** : `cv.json` rempli ; `npm test` passe ; la liste des champs à relire par Victor est donnée en fin de section.

### 4. Design system, mise en page et bascule de langue
Modèle: opus | Effort: medium
Pourquoi: c'est la base de l'effet « waouh », demande du goût et de la cohérence, mais sans logique délicate.

- `tokens.css` (couleurs, échelle typographique fluide avec `clamp()`, espacements, rayon, durées), polices auto-hébergées, grain de fond en CSS/SVG.
- `Base.astro` : `<html lang>`, `Seo.astro` (title, description, Open Graph, `hreflang`), navigation fixe discrète, lien d'évitement « aller au contenu ».
- `LangSwitch.astro` : bascule FR/EN qui conserve l'ancre de la section courante.
- Page 404 stylée dans les deux langues.
- Tests e2e : `lang="fr"` sur `/`, `lang="en"` sur `/en/` ; le bouton de langue mène à l'autre version ; balises `hreflang` présentes.
- **Visible** : une page vide mais déjà « habillée » (typo, couleurs, nav, bascule de langue).

### 5. Sections de contenu
Modèle: opus | Effort: medium
Pourquoi: six composants de présentation dont la mise en page éditoriale doit être soignée et responsive.

- `Hero`, `About`, `Timeline` (expériences + formation), `Projects`, `Skills`, `Contact`, tous alimentés par `getCV(lang)`.
- Mise en page éditoriale : grands numéros de section, typo géante, asymétries maîtrisées ; responsive de 360 px à 1920 px sans défilement horizontal.
- Contact : `mailto:` + bouton « copier l'email » avec retour visuel.
- Photo ou monogramme « VS » selon la présence de `public/photo.jpg`.
- Tests e2e : chaque section est présente et contient les données de `cv.json` dans les deux langues ; aucun débordement horizontal en mobile (largeur de page = largeur de fenêtre) ; le site est lisible avec JavaScript désactivé.
- **Visible** : le CV complet et lisible, statique, dans les deux langues.

### 6. Animations et interactions
Modèle: opus | Effort: high
Pourquoi: nombreuses cases limites (mobile, tactile, réduction des animations, contenu jamais caché si le script échoue) et c'est ce qui fait l'impression.

- `motion.ts` : Lenis (scroll fluide), révélation du nom au chargement (SplitText), apparitions au scroll (ScrollTrigger), ligne de la timeline qui se dessine, légère parallaxe des grands titres, effet magnétique sur les boutons, curseur personnalisé (souris uniquement, jamais sur écran tactile).
- Le contenu est visible par défaut ; l'état « caché avant animation » n'est appliqué que quand le script a bien démarré (classe `js-motion` sur `<html>`).
- `prefers-reduced-motion: reduce` → pas de Lenis, pas de parallaxe, pas de curseur, simples fondus instantanés.
- Les liens d'ancre de la nav fonctionnent avec Lenis.
- Tests e2e : avec réduction des animations, tout le contenu est visible immédiatement ; sans JS, tout est visible ; aucune erreur console sur `/` et `/en/`.
- **Visible** : le site s'anime au chargement et au scroll.

### 7. Version imprimable / « Télécharger en PDF »
Modèle: sonnet | Effort: medium
Pourquoi: feuille de style d'impression et un bouton, travail bien balisé.

- `print.css` : fond blanc, texte noir, une colonne, pas d'animations ni de nav/terminal/stats, URL des liens affichées, sauts de page propres, 1 à 2 pages A4.
- Bouton « Télécharger en PDF » / « Download PDF » qui appelle `window.print()`.
- Test e2e : `page.pdf()` en média print génère un PDF de 1 ou 2 pages contenant le nom et le titre.
- **Visible** : cliquer sur le bouton ouvre l'impression avec un CV sobre.

### 8. Easter egg terminal
Modèle: opus | Effort: medium
Pourquoi: fonctionnalité avec sa propre logique (analyse de commandes, historique, clavier), périmètre clair.

- `terminal.ts` (logique pure) : analyse de la ligne, commandes listées dans le périmètre, commande inconnue → message + suggestion la plus proche, historique ↑/↓, autocomplétion `Tab`, sorties tirées de `cv.json` dans la langue courante.
- `terminal-ui.ts` + `Terminal.astro` : ouverture par `` ` `` ou `Ctrl+K` (pas quand on tape dans un champ), fermeture par `Échap` ou `exit`, focus piégé dans le terminal tant qu'il est ouvert, retour du focus à la fermeture, `role="dialog"`.
- `lang en` bascule vers `/en/` (et inversement) ; `github` ouvre le profil ; `sudo hire-victor` affiche une petite animation + le mail.
- Indice discret en pied de page : « psst… appuie sur ` ».
- Tests unitaires : chaque commande, commande inconnue, suggestion, historique. Test e2e : ouvrir, taper `whoami`, lire le nom, fermer avec Échap.
- **Visible** : le terminal s'ouvre et répond.

### 9. Stats GitHub live
Modèle: opus | Effort: high
Pourquoi: intégration d'un service externe avec cache, limite de requêtes et plusieurs cas d'échec à gérer sans rien casser.

- `github.ts` : appel `users/oky2559` + `users/oky2559/repos?per_page=100`, calcul (repos publics hors forks, top 3 langages par nombre de repos, date du dernier push, étoiles totales), cache `sessionStorage` 1 h, délai max 5 s.
- `GithubStats.astro` + `github-ui.ts` : bloc masqué par défaut, affiché seulement si les données arrivent ; compteurs animés (sauf réduction des animations) ; date relative dans la langue courante.
- Cas d'échec : réseau coupé, HTTP 403/429 (limite atteinte), JSON inattendu, `sessionStorage` indisponible → bloc masqué, aucune erreur console.
- Tests unitaires (fetch simulé) : agrégation correcte, cache utilisé, chaque cas d'échec. Test e2e avec requêtes GitHub interceptées : bloc visible avec données simulées ; bloc absent si l'API renvoie 403.
- **Visible** : les stats réelles s'affichent dans la section Compétences ou Contact.

### 10. Conteneur Docker et Nginx
Modèle: sonnet | Effort: medium
Pourquoi: configuration standard mais qui touche à la sécurité (en-têtes) et doit être vérifiée de bout en bout.

- `Dockerfile` multi-étapes (`node:22-alpine` → `nginx:alpine`), `ARG SITE_URL`, image finale ne contenant que `dist/` et `nginx.conf`.
- `nginx.conf` : gzip, cache long pour `/_astro/*` (fichiers versionnés), pas de cache pour le HTML, vraie page 404, en-têtes `Content-Security-Policy` (autorise `api.github.com` en `connect-src`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`.
- `docker-compose.yml` : service `cv`, port `8080:80`, `restart: unless-stopped`.
- `README.md` : lancer en local, modifier `cv.json`, déployer sur le serveur (build, run, exemple de bloc reverse proxy).
- Script `npm run verify:docker` (voir vérification de bout en bout).
- **Visible** : `docker compose up -d --build` puis http://localhost:8080 affiche le CV.

### 11. Finitions : performance, accessibilité, SEO
Modèle: sonnet | Effort: medium
Pourquoi: passe de contrôle et petits correctifs sur des critères bien connus.

- `favicon.svg`, `og-image.png` (1200×630 aux couleurs du site), `robots.txt`, `sitemap` (intégration Astro).
- Test e2e d'accessibilité avec `@axe-core/playwright` : zéro violation « serious » ou « critical » sur `/` et `/en/`.
- Vérifier : images en bonnes dimensions, polices préchargées, pas de décalage de mise en page au chargement, poids JS total < 150 Ko compressé (test qui échoue au-delà).
- **Visible** : `npm test` vert avec les tests d'accessibilité et de poids.

## Commande pour lancer

```bash
npm install && npm run dev
```

Site sur http://localhost:4321 (FR) et http://localhost:4321/en/ (EN).

En production locale via Docker :

```bash
docker compose up -d --build
```

Site sur http://localhost:8080.

## Commande de tests

```bash
npm test
```

Lance dans l'ordre : `astro check` (types et contenu), `vitest run` (tests unitaires), puis `playwright test` (construit le site, le sert, et lance les tests e2e desktop + mobile).
Au premier lancement, installer le navigateur de test : `npx playwright install chromium`.

## Vérification de bout en bout

```bash
npm run verify:docker
```

Ce script construit l'image, lance le conteneur sur le port 8080, interroge le site, puis arrête et supprime le conteneur. Sortie attendue (codes HTTP et contenus réels) :

```
✔ image cv:latest construite
✔ GET /        → 200  contient "Victor Schmutz"  lang="fr"
✔ GET /en/     → 200  contient "Victor Schmutz"  lang="en"
✔ GET /nope    → 404  page 404 personnalisée
✔ en-têtes     → Content-Security-Policy, X-Content-Type-Options présents
✔ gzip         → Content-Encoding: gzip sur /
✔ conteneur arrêté
OK — le CV est prêt à être déployé
```

Le script sort avec le code 0 si tout passe, 1 sinon (avec la ligne en échec marquée ✘).
