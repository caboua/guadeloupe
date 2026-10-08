/* ═══════════════════════════════════════════════════════════
   Livret Villa CABOUA — déverrouillage du contenu voyageurs.
   Le contenu privé n'est pas caché par du JavaScript : il est
   réellement chiffré (AES-256-GCM, clé dérivée du code par
   PBKDF2-SHA256). Sans le code, le fichier data/livret.bin est
   illisible, même en regardant le source de la page.
   Re-chiffrement : node outils/chiffrer.js VOTRECODE
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var ITERATIONS = 210000;
  var CLE_STOCKAGE = 'caboua-livret-code';
  var FICHIER_LIVRET = 'data/livret.bin';

  var form = document.getElementById('codeForm');
  var input = document.getElementById('codeInput');
  var bouton = document.getElementById('codeBtn');
  var message = document.getElementById('lockMsg');
  var section = document.getElementById('espace-voyageurs');
  var cible = document.getElementById('livretPrive');
  var carte = document.querySelector('.lock-card');

  /* Normalise le code : sans accents, sans espaces, en majuscules. */
  function normaliser(code) {
    return (code || '')
      .normalize('NFD')
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function dire(texte, type) {
    message.textContent = texte;
    message.className = 'lock-msg' + (type ? ' ' + type : '');
  }

  async function deriverCle(code, sel) {
    var base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: sel, iterations: ITERATIONS, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }

  /* Format binaire : [sel 16][iv 12][chiffré ...] */
  async function dechiffrer(url, code) {
    var reponse = await fetch(url, { cache: 'no-cache' });
    if (!reponse.ok) throw new Error('fichier introuvable');
    var octets = new Uint8Array(await reponse.arrayBuffer());
    var cle = await deriverCle(code, octets.slice(0, 16));
    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: octets.slice(16, 28) }, cle, octets.slice(28));
  }

  function barreDeverrouillee() {
    var barre = document.createElement('div');
    barre.className = 'unlocked-bar';
    barre.innerHTML =
      '<div class="container">' +
      '<p>✅ Livret déverrouillé<small>Bon séjour à la Villa CABOUA !</small></p>' +
      '<div class="unlocked-actions">' +
      '<button class="btn btn-line" id="btnVerrouiller" type="button">Verrouiller</button>' +
      '</div></div>';
    return barre;
  }

  function ouvrir(html) {
    cible.innerHTML = html;
    cible.hidden = false;
    var barre = barreDeverrouillee();
    section.replaceWith(barre);
    barre.querySelector('#btnVerrouiller').addEventListener('click', function () {
      try { localStorage.removeItem(CLE_STOCKAGE); } catch (e) {}
      location.reload();
    });
    var nav = document.querySelector('.navlinks');
    if (nav) {
      var liens = [['#maison', 'La maison'], ['#arrivee', 'Arrivée'], ['#wifi', 'Wi-Fi'],
                   ['#visites', 'Bons plans'], ['#restaurants', 'Restaurants'], ['#urgences', 'Urgences']];
      nav.innerHTML = liens.map(function (l) {
        return '<a href="' + l[0] + '">' + l[1] + '</a>';
      }).join('') + '<a href="../" class="btn btn-dark btn-nav">Le site</a>';
    }
  }

  async function essayer(code, discret) {
    var propre = normaliser(code);
    if (!propre) { dire('Merci d\'indiquer votre code.', 'error'); return false; }
    if (!window.crypto || !crypto.subtle) {
      dire('Votre navigateur ne permet pas d\'ouvrir le livret. Essayez Chrome ou Safari à jour.', 'error');
      return false;
    }
    if (bouton) { bouton.disabled = true; bouton.textContent = 'Ouverture…'; }
    if (!discret) dire('Vérification du code…', '');
    try {
      var donnees = await dechiffrer(FICHIER_LIVRET, propre);
      var html = new TextDecoder().decode(donnees);
      try { localStorage.setItem(CLE_STOCKAGE, propre); } catch (e) {}
      ouvrir(html);
      return true;
    } catch (e) {
      if (bouton) { bouton.disabled = false; bouton.textContent = 'Déverrouiller le livret'; }
      if (!discret) {
        dire('Ce code ne correspond pas. Vérifiez votre message de réservation.', 'error');
        if (carte) {
          carte.classList.remove('shake');
          void carte.offsetWidth;
          carte.classList.add('shake');
        }
        if (input) input.select();
      } else {
        dire('', '');
      }
      try { localStorage.removeItem(CLE_STOCKAGE); } catch (e) {}
      return false;
    }
  }

  if (form) {
    form.addEventListener('submit', function (evenement) {
      evenement.preventDefault();
      essayer(input.value, false);
    });
  }

  /* Lien direct : livret/#code=XXXXX (le # ne part jamais vers un serveur) */
  var depuisLien = /(?:^|[#&])code=([^&]+)/.exec(location.hash);
  var memorise = null;
  try { memorise = localStorage.getItem(CLE_STOCKAGE); } catch (e) {}

  if (depuisLien) {
    history.replaceState(null, '', location.pathname + location.search);
    essayer(decodeURIComponent(depuisLien[1]), false);
  } else if (memorise) {
    essayer(memorise, true);
  }
})();
