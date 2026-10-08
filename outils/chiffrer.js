/* ═══════════════════════════════════════════════════════════
   Chiffrement du livret voyageurs — Villa CABOUA
   ───────────────────────────────────────────────────────────
   Usage :   node outils/chiffrer.js VOTRECODE
   Le code n'est écrit nulle part dans le dépôt : il est demandé en argument
   et rappelé dans outils/prive/CODE.txt (non publié).

   Lit  : outils/prive/livret-prive.html   (contenu réservé)
   Écrit: livret/data/livret.bin

   Format : [sel 16 octets][iv 12 octets][AES-256-GCM]
   Clé    : PBKDF2-SHA256, 210 000 itérations.
   Le fichier .bin est illisible sans le code : il peut
   donc être publié sans risque sur GitHub Pages.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ITERATIONS = 210000;
const racine = path.join(__dirname, '..');

function normaliser(code) {
  return code.normalize('NFD').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function chiffrer(donnees, code) {
  const sel = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cle = crypto.pbkdf2Sync(Buffer.from(code, 'utf8'), sel, ITERATIONS, 32, 'sha256');
  const chiffreur = crypto.createCipheriv('aes-256-gcm', cle, iv);
  const corps = Buffer.concat([chiffreur.update(donnees), chiffreur.final()]);
  return Buffer.concat([sel, iv, corps, chiffreur.getAuthTag()]);
}

const code = normaliser(process.argv[2] || '');
if (!code) {
  console.error('Indiquez le code : node outils/chiffrer.js VOTRECODE');
  process.exit(1);
}

const sortie = path.join(racine, 'livret', 'data');
fs.mkdirSync(sortie, { recursive: true });

const travaux = [
  ['prive/livret-prive.html', 'livret.bin', 'contenu du livret'],
];

for (const [source, cible, libelle] of travaux) {
  const chemin = path.join(__dirname, source);
  if (!fs.existsSync(chemin)) {
    console.error('  ! introuvable : ' + source + ' (' + libelle + ' non mis à jour)');
    continue;
  }
  const resultat = chiffrer(fs.readFileSync(chemin), code);
  fs.writeFileSync(path.join(sortie, cible), resultat);
  console.log('  + livret/data/' + cible + '  (' + libelle + ', ' +
    Math.round(resultat.length / 1024) + ' Ko)');
}

console.log('\nCode d\'acces : ' + code);
console.log('Lien direct  : https://caboua.github.io/guadeloupe/livret/#code=' + code);
console.log('(a garder pour vous : ne publiez pas ce code)');
