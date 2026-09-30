# CV de Victor Schmutz

Site statique bilingue (français sur `/`, anglais sur `/en/`) fait avec Astro, servi par Nginx dans un conteneur Docker.

## Lancer en local

```bash
npm install
npm run dev
```

Le site est sur http://localhost:4321 (FR) et http://localhost:4321/en/ (EN).

Deux petits soucis possibles au premier lancement :

- Si `npm install` se plaint de permissions sur le cache, corrige-les une fois pour toutes :
  `sudo chown -R $(id -u):$(id -g) ~/.npm`
- Pour les tests, installe le navigateur de test : `npx playwright install chromium`

Lancer les tests : `npm test`.

## Modifier le contenu (`cv.json`)

Tout le texte du CV est dans `src/data/cv.json` (en français et en anglais). Modifie ce fichier, enregistre : en `npm run dev` la page se met à jour toute seule. Si le fichier est mal rempli (champ manquant, mauvais format), la construction s'arrête avec un message qui dit quel champ corriger.

## Lancer avec Docker (comme en production)

```bash
docker compose up -d --build
```

Le site est sur http://localhost:8080. Pour l'arrêter : `docker compose down`.

Pour vérifier que tout marche (construit l'image, lance un conteneur, teste le site, nettoie) :

```bash
npm run verify:docker
```

Il faut que Docker soit lancé et que le port 8080 soit libre.

## Déployer sur le serveur

Sur le serveur, avec Docker installé :

```bash
git clone <adresse-du-depot> cv && cd cv
SITE_URL=https://cv.exemple.fr docker compose up -d --build
```

`SITE_URL` est l'adresse publique finale du site (elle sert aux liens absolus et au référencement). Sans elle, la valeur par défaut est `http://localhost:8080`.

Pour mettre à jour : `git pull` puis relance la même commande `docker compose up -d --build`. Le conteneur redémarre tout seul si le serveur redémarre (`restart: unless-stopped`).

Le conteneur écoute en HTTP sur le port 8080 de la machine. Devant, place un reverse proxy qui gère le HTTPS. Exemple Nginx (les certificats viennent par exemple de Certbot) :

```nginx
server {
    listen 443 ssl http2;
    server_name cv.exemple.fr;

    ssl_certificate     /etc/letsencrypt/live/cv.exemple.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cv.exemple.fr/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name cv.exemple.fr;
    return 301 https://$host$request_uri;
}
```

## Ce que fait la configuration Nginx

- Compression gzip.
- Cache d'un an pour `/_astro/*` (fichiers dont le nom change à chaque modification) et aucun cache pour les pages HTML.
- Vraie page 404, aussi bilingue.
- En-têtes de sécurité (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`). La CSP autorise uniquement le site lui-même et `api.github.com` (pour les stats GitHub). Les petits scripts intégrés aux pages sont autorisés par leur empreinte, calculée automatiquement à chaque construction de l'image (`scripts/inject-csp.mjs`) : rien à faire à la main.
