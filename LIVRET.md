# Livret d'accueil & bons plans — mode d'emploi

En ligne : **https://caboua.github.io/guadeloupe/livret/**
Lien direct déjà déverrouillé (à envoyer aux voyageurs), avec votre code à la place de VOTRECODE :
`https://caboua.github.io/guadeloupe/livret/#code=VOTRECODE`

> ⚠️ Le dépôt GitHub est public : ne jamais écrire le code d'accès dans un
> fichier versionné. Il est noté dans `outils/prive/CODE.txt`, qui reste sur
> votre ordinateur.

## Ce que voit un visiteur

Sans le code, la page ne montre que la porte d'entrée : le bandeau de bienvenue,
le résumé de la villa et le champ où saisir le code. **Aucun contenu du livret
n'est présent dans la page** — ni les bons plans, ni les restaurants, ni le
pratique de la maison.

Avec le code, le livret complet s'affiche : la maison, vos coordonnées d'hôtes,
l'arrivée et le départ, le Wi-Fi, le bon à savoir, les règles, la cuisine, le
linge, les visites et bons plans de Bouillante, les commerces, les restaurants,
les numéros d'urgence, la check-list de départ et l'invitation à laisser un avis.

Le contenu n'est pas simplement caché : il est **chiffré en AES-256** (clé
dérivée du code par PBKDF2, 210 000 itérations). Le fichier publié
`livret/data/livret.bin` est illisible sans le code, même pour quelqu'un qui
regarde le code source de la page. La page porte aussi un `noindex` : Google ne
référence pas une page vide.

## Changer le code d'accès

```bash
node outils/chiffrer.js NOUVEAUCODE
```

Puis publier (voir plus bas). Le code est insensible aux majuscules, aux
accents et aux espaces : « mon code » ouvre la même porte que « MONCODE ».

## Modifier le contenu

- **La page d'accueil du livret** (bandeau, texte de la porte) : `livret/index.html`.
- **Le livret lui-même** (toutes les sections) :
  `outils/prive/livret-prive.html`, puis relancer `node outils/chiffrer.js VOTRECODE`.

> Le dossier `outils/prive/` contient les versions **en clair**. Il est exclu
> par `.gitignore` : il ne part jamais sur internet. Ne le retirez pas du
> `.gitignore`.

## Publier

```bash
git add -A && git commit -m "Mise a jour du livret" && git push
```

## Aperçu local

Serveur de test : configuration `villa-guadeloupe` → http://localhost:8912/livret/
