// Céleste — catalogue tarifaire serveur (source de vérité fournie le 13/11/2026)
export const PRODUCTS = Object.freeze({
  ancrage_du_jour: {label:"L'Ancrage du Jour", cents:0, kind:"free", discountEligible:false},
  conseil_de_la_lune: {label:"Conseil de la Lune", cents:300, kind:"formula", discountEligible:true},
  voeu_magique: {label:"Le Vœu Magique", cents:300, kind:"formula", discountEligible:true},
  aura_flash: {label:"L'Aura Flash", cents:300, kind:"formula", discountEligible:true},
  pendule: {label:"Pendule", cents:500, kind:"formula", discountEligible:true},
  boule_de_cristal: {label:"Boule de cristal", cents:500, kind:"formula", discountEligible:true},
  cartes_oui_non: {label:"Cartes oui/non", cents:500, kind:"formula", discountEligible:true},
  echo_des_vies: {label:"L'Écho des Vies", cents:500, kind:"formula", discountEligible:true},
  miroir_voile: {label:"Le Miroir Voilé", cents:500, kind:"formula", discountEligible:true},
  rituel_kintsugi: {label:"Le Rituel du Kintsugi", cents:600, kind:"formula", discountEligible:true},
  runes_du_destin: {label:"Les Runes du Destin", cents:600, kind:"formula", discountEligible:true},
  pierre_correspondante: {label:"Découvre la pierre qui te correspond", cents:800, kind:"formula_physical", discountEligible:true},
  annee_2027: {label:"Ton Année 2027", cents:900, kind:"formula", discountEligible:true},
  voix_de_l_ame: {label:"La Voix de l'Âme", cents:900, kind:"formula", discountEligible:true},
  lampe_du_djinn: {label:"La Lampe du Djinn", cents:900, kind:"formula", discountEligible:true},
  chiromancie: {label:"Chiromancie", cents:1200, kind:"formula", discountEligible:true},
  grimoire_des_lignees: {label:"Le Grimoire des Lignées", cents:1200, kind:"formula", discountEligible:true},
  talisman_manifestation: {label:"Le Talisman de Manifestation", cents:1200, kind:"formula", discountEligible:true},
  decision_supreme: {label:"La Décision Suprême", cents:1200, kind:"formula", discountEligible:true},
  futur_revele: {label:"Le Futur Révélé", cents:1200, kind:"formula", discountEligible:true},
  union_des_ames: {label:"L'Union des Âmes", cents:1200, kind:"formula", discountEligible:true},
  visage_revele: {label:"Le Visage Révélé", cents:1200, kind:"formula", discountEligible:true},
  coeur_revele: {label:"Le Cœur Révélé", cents:1200, kind:"formula", discountEligible:true},
  tarot_celeste: {label:"Tarot Céleste", cents:1900, kind:"formula", discountEligible:true},
  theme_astral_celeste: {label:"Le Thème Astral Céleste", cents:1900, kind:"formula", discountEligible:true},
  ciel_de_ta_naissance: {label:"Le Ciel de ta Naissance", cents:2900, kind:"formula", discountEligible:true},
  celeste: {label:"Céleste", cents:3900, kind:"formula", discountEligible:true},
  grand_oracle_celeste: {label:"Le Grand Oracle de Céleste", cents:3900, kind:"formula", discountEligible:true},
  pass_illimite: {label:"Pass Illimité", cents:8900, kind:"subscription_monthly", discountEligible:false},
  etoile_19: {label:"Étoile à nommer — 19 €", cents:1900, kind:"star", discountEligible:false},
  etoile_29: {label:"Étoile à nommer — 29 €", cents:2900, kind:"star", discountEligible:false},
  etoile_39: {label:"Étoile à nommer — 39 €", cents:3900, kind:"star", discountEligible:false},
});

export function resolveProduct(productId, discoveryDay=false) {
  const product = PRODUCTS[productId];
  if (!product) return null;
  if (product.kind === "free") return {...product, productId, amount:"0.00"};
  if (product.kind === "subscription_monthly") return {...product, productId, amount:(product.cents/100).toFixed(2)};
  const cents = discoveryDay && product.discountEligible ? Math.round(product.cents * 0.30) : product.cents;
  return {...product, productId, amount:(cents/100).toFixed(2), discoveryDay:discoveryDay && product.discountEligible};
}
