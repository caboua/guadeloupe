/* ═══════════════════════════════════════════════════════════
   Villa CABOUA — Bouillante, Guadeloupe
   Navigation, galerie, calendrier de disponibilités
   (synchronisé avec Airbnb/Booking via le dépôt Calendrier)
   et estimation du séjour.
   ═══════════════════════════════════════════════════════════ */

/* Source des disponibilités : le calendrier partagé de la villa,
   mis à jour automatiquement depuis les iCal Airbnb et Booking. */
const DISPOS_URL = "https://caboua.github.io/Calendrier/data/reservations.json";

const WHATSAPP = "590690520616";
const MAIL = "villa.caboua@gmail.com";
const MIN_NUITS = 2;
const MAX_PERSONNES = 6;
const MAX_BEBES = 3;

/* Tarif par nuit selon le nombre de voyageurs */
function prixNuit(personnes) {
  if (personnes <= 2) return 120;
  if (personnes === 3) return 140;
  if (personnes === 4) return 160;
  if (personnes === 5) return 180;
  return 200;
}

/* ── Helpers dates ───────────────────────────────────────── */

function toISO(d) {
  return d.getFullYear() + "-"
    + String(d.getMonth() + 1).padStart(2, "0") + "-"
    + String(d.getDate()).padStart(2, "0");
}

function fromISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatFR(iso) {
  if (!iso) return "—";
  return fromISO(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function aujourdISO() {
  return toISO(new Date());
}

/* ── Navigation ──────────────────────────────────────────── */

const nav = document.getElementById("nav");
const navLinks = document.getElementById("navLinks");
const burger = document.getElementById("navBurger");

function majNav() {
  nav.classList.toggle("scrolled", window.scrollY > 60 || navLinks.classList.contains("open"));
}

window.addEventListener("scroll", majNav, { passive: true });

burger.addEventListener("click", () => {
  navLinks.classList.toggle("open");
  majNav();
});

navLinks.querySelectorAll("a").forEach(a =>
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    majNav();
  })
);

/* ── Révélation au scroll ────────────────────────────────── */

const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add("in");
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

/* ── Arrivée directe sur une ancre (lien Instagram, QR code…) ─
   Les photos se chargent après coup et décalent la page : le saut
   natif du navigateur tombe souvent à côté. On refait donc le
   positionnement une fois tout chargé, et on révèle immédiatement
   la section visée (sinon elle reste en opacity 0). */

function allerAncre(hash, comportement) {
  const cible = hash && document.querySelector(hash);
  if (!cible) return;
  if (cible.classList.contains("reveal")) cible.classList.add("in");
  cible.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
  const y = cible.getBoundingClientRect().top + window.scrollY - 76;
  window.scrollTo({ top: Math.max(y, 0), behavior: comportement || "auto" });
  majNav();
}

if (location.hash) {
  const ancreDepart = location.hash;
  allerAncre(ancreDepart);
  window.addEventListener("load", () => {
    allerAncre(ancreDepart);
    setTimeout(() => allerAncre(ancreDepart), 500);
  });
}

/* ── Galerie / lightbox ──────────────────────────────────── */

const figures = Array.from(document.querySelectorAll("#gallery figure"));
const lightbox = document.getElementById("lightbox");
const lbImg = document.getElementById("lbImg");
const lbCaption = document.getElementById("lbCaption");
let lbIndex = 0;

function ouvrirLightbox(i) {
  lbIndex = (i + figures.length) % figures.length;
  const fig = figures[lbIndex];
  const img = fig.querySelector("img");
  lbImg.src = img.src;
  lbImg.alt = img.alt;
  lbCaption.textContent = fig.dataset.caption || "";
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function fermerLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
}

figures.forEach((fig, i) => fig.addEventListener("click", () => ouvrirLightbox(i)));

document.getElementById("lbClose").addEventListener("click", fermerLightbox);
document.getElementById("lbPrev").addEventListener("click", () => ouvrirLightbox(lbIndex - 1));
document.getElementById("lbNext").addEventListener("click", () => ouvrirLightbox(lbIndex + 1));

lightbox.addEventListener("click", e => {
  if (e.target === lightbox) fermerLightbox();
});

document.addEventListener("keydown", e => {
  if (lightbox.hidden) return;
  if (e.key === "Escape") fermerLightbox();
  if (e.key === "ArrowLeft") ouvrirLightbox(lbIndex - 1);
  if (e.key === "ArrowRight") ouvrirLightbox(lbIndex + 1);
});

/* ── Disponibilités ──────────────────────────────────────── */

const bloquees = new Set();   /* dates ISO occupées */
let disposChargees = false;

async function chargerDispos() {
  const info = document.getElementById("calSync");
  try {
    const res = await fetch(DISPOS_URL + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rows = await res.json();

    rows.forEach(r => {
      if (!r.start || !r.end) return;
      const fin = fromISO(r.end);            /* fin exclusive (norme iCal) */
      for (let d = fromISO(r.start); d < fin; d.setDate(d.getDate() + 1)) {
        bloquees.add(toISO(d));
      }
    });

    disposChargees = true;
    info.textContent = "Disponibilités synchronisées avec Airbnb et Booking.";
  } catch {
    info.textContent = "Disponibilités indicatives — confirmez vos dates par WhatsApp.";
  }
  rendreCalendrier();
}

/* ── Calendrier ──────────────────────────────────────────── */

const calGrid = document.getElementById("calGrid");
const calTitle = document.getElementById("calTitle");

let moisAffiche = new Date();
moisAffiche.setDate(1);

let selStart = null;   /* ISO arrivée */
let selEnd = null;     /* ISO départ  */

function rendreCalendrier() {
  const annee = moisAffiche.getFullYear();
  const mois = moisAffiche.getMonth();

  calTitle.textContent = moisAffiche.toLocaleDateString("fr-FR", {
    month: "long", year: "numeric"
  });

  const premier = new Date(annee, mois, 1);
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const decalage = (premier.getDay() + 6) % 7;   /* lundi = 0 */
  const todayISO = aujourdISO();

  calGrid.innerHTML = "";

  for (let i = 0; i < decalage; i++) {
    const off = document.createElement("div");
    off.className = "cal-day off";
    calGrid.appendChild(off);
  }

  for (let j = 1; j <= nbJours; j++) {
    const iso = toISO(new Date(annee, mois, j));
    const el = document.createElement("div");
    el.className = "cal-day";
    el.textContent = j;

    if (iso === todayISO) el.classList.add("today");

    if (iso < todayISO) {
      el.classList.add("past");
    } else if (bloquees.has(iso) && !(selStart && iso === selStart)) {
      /* Une date de départ peut tomber sur le 1er jour d'une résa existante,
         mais pour rester simple on bloque la sélection des jours occupés. */
      el.classList.add("blocked");
    } else {
      el.addEventListener("click", () => choisirDate(iso));
    }

    if (selStart && iso === selStart) el.classList.add("sel-start");
    if (selEnd && iso === selEnd) el.classList.add("sel-end");
    if (selStart && selEnd && iso > selStart && iso < selEnd) el.classList.add("in-range");

    calGrid.appendChild(el);
  }
}

function plageLibre(startISO, endISO) {
  for (let d = fromISO(startISO); toISO(d) < endISO; d.setDate(d.getDate() + 1)) {
    if (bloquees.has(toISO(d))) return false;
  }
  return true;
}

function choisirDate(iso) {
  if (!selStart || (selStart && selEnd)) {
    selStart = iso;
    selEnd = null;
  } else if (iso <= selStart) {
    selStart = iso;
  } else {
    selEnd = iso;
    if (!plageLibre(selStart, selEnd)) {
      selEnd = null;
      selStart = iso;
      afficherFacture("chevauche");
      rendreCalendrier();
      majDatesAffichees();
      return;
    }
  }
  rendreCalendrier();
  majDatesAffichees();
  afficherFacture();
}

document.getElementById("calPrev").addEventListener("click", () => {
  moisAffiche.setMonth(moisAffiche.getMonth() - 1);
  rendreCalendrier();
});

document.getElementById("calNext").addEventListener("click", () => {
  moisAffiche.setMonth(moisAffiche.getMonth() + 1);
  rendreCalendrier();
});

/* ── Estimation du séjour ────────────────────────────────── */

let personnes = 2;
let bebes = 0;

const persCount = document.getElementById("persCount");
const babyCount = document.getElementById("babyCount");
const billing = document.getElementById("bkBilling");

const texteBase = `
  <p class="bk-base"><strong>À partir de 120&nbsp;€ / nuit</strong> pour 2 personnes.</p>
  <p class="bk-note">Minimum ${MIN_NUITS} nuits · bébés gratuits (lit parapluie fourni, ${MAX_BEBES} max) · aucun frais caché.</p>
`;

function majDatesAffichees() {
  document.getElementById("bkStart").textContent = formatFR(selStart);
  document.getElementById("bkEnd").textContent = formatFR(selEnd);
}

function nuitsSelection() {
  if (!selStart || !selEnd) return 0;
  return Math.round((fromISO(selEnd) - fromISO(selStart)) / 86400000);
}

function afficherFacture(erreur) {
  if (erreur === "chevauche") {
    billing.innerHTML = texteBase +
      `<p class="bk-warn">Ces dates englobent un séjour déjà réservé — la sélection a été réinitialisée.</p>`;
    return;
  }

  const nuits = nuitsSelection();

  if (!nuits) {
    billing.innerHTML = texteBase;
    return;
  }

  if (nuits < MIN_NUITS) {
    billing.innerHTML = texteBase +
      `<p class="bk-warn">Séjour minimum : ${MIN_NUITS} nuits.</p>`;
    return;
  }

  const pn = prixNuit(personnes);
  const total = pn * nuits;

  billing.innerHTML = `
    <div class="bk-row"><span>${personnes} voyageur${personnes > 1 ? "s" : ""}${bebes ? ` + ${bebes} bébé${bebes > 1 ? "s" : ""}` : ""}</span></div>
    <div class="bk-row"><span>${nuits} nuit${nuits > 1 ? "s" : ""} × ${pn}&nbsp;€</span><span>${total}&nbsp;€</span></div>
    <div class="bk-total"><span>Total</span><span>${total}&nbsp;€</span></div>
    <p class="bk-note">Aucun frais supplémentaire.</p>
  `;

  majLiens(nuits, pn, total);
}

function messageReservation(nuits, pn, total) {
  return `Bonjour,

Je souhaite réserver la Villa CABOUA.

Arrivée : ${formatFR(selStart)}
Départ : ${formatFR(selEnd)}
${nuits} nuit(s) — ${personnes} voyageur(s)${bebes ? " + " + bebes + " bébé(s)" : ""}

Tarif : ${nuits} × ${pn} € = ${total} €

Merci !`;
}

function majLiens(nuits, pn, total) {
  const msg = encodeURIComponent(messageReservation(nuits, pn, total));
  document.getElementById("btnWhatsApp").href = `https://wa.me/${WHATSAPP}?text=${msg}`;
  document.getElementById("btnMail").href =
    `mailto:${MAIL}?subject=${encodeURIComponent("Réservation Villa CABOUA")}&body=${msg}`;
}

function majCompteurs() {
  persCount.textContent = personnes;
  babyCount.textContent = bebes;
  afficherFacture();
}

document.getElementById("persPlus").addEventListener("click", () => {
  if (personnes < MAX_PERSONNES) personnes++;
  majCompteurs();
});

document.getElementById("persMinus").addEventListener("click", () => {
  if (personnes > 1) personnes--;
  majCompteurs();
});

document.getElementById("babyPlus").addEventListener("click", () => {
  if (bebes < MAX_BEBES) bebes++;
  majCompteurs();
});

document.getElementById("babyMinus").addEventListener("click", () => {
  if (bebes > 0) bebes--;
  majCompteurs();
});

/* ── Init ────────────────────────────────────────────────── */

majNav();
rendreCalendrier();
chargerDispos();
