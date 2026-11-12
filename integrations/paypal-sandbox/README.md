# Céleste — préparation PayPal Sandbox (non déployée)

Ce répertoire est un **prototype technique isolé**, pas un paiement opérationnel.
Il n'altère pas la version publiée de Céleste, l'archive chiffrée, la borne Android, ni les autres travaux de Claude.

## Source de vérité et publication
- Application en développement sur le Linux de Michael ; la branche `gh-pages` du dépôt `Momolscode/ebc-app` est un artefact de publication chiffré.
- Ne pas intégrer directement dans le chargeur `index.html` ni lancer `cycle.sh` depuis cette branche.
- La mise en ligne nécessite le processus d'audit et l'accord du propriétaire (lot nommé).
- Le README de la branche `main` précise que le paiement en ligne n'est pas activé.

## Environnement Sandbox uniquement
Le fichier `server.mjs` expose localement `POST /api/paypal/orders` et `POST /api/paypal/capture`.
Il utilise exclusivement `https://api-m.sandbox.paypal.com`. Le point `POST /api/paypal/webhook` vérifie la signature via l'API PayPal et accuse réception sans débloquer de service. Aucune clé n'est stockée dans Git.

Variables à configurer **côté serveur**, sans les committer :
- `PAYPAL_CLIENT_ID` — identifiant de l'application Sandbox.
- `PAYPAL_CLIENT_SECRET` — secret Sandbox, uniquement dans le coffre/variables privées du service.
- `PAYPAL_WEBHOOK_ID` — identifiant du webhook Sandbox créé dans PayPal Developer.
- `CELESTE_TEST_PRICE_EUR` — montant approuvé, au format `1.00` ; aucune valeur par défaut.
- `CELESTE_ALLOWED_ORIGIN` — origine exacte de l'interface de test.
- `PORT` — optionnel, 8787.

Démarrer avec Node 20+ : `node server.mjs`. Tests sans identifiants : `node --test server.test.mjs`. Ne **pas** exposer ce prototype à Internet :
il ne possède encore ni persistance, ni authentification de session, ni contrôle d'achat, ni protection complète contre les abus. La vérification de signature webhook ne suffit pas à activer un droit payant.
Ne pas utiliser de compte PayPal Live.

## Étapes nécessaires avant un vrai paiement
1. Rapprocher les sources Céleste actuelles et les ZIP de développement du Drive avec la copie Linux.
2. Faire valider offres, tarifs, fiscalité, compte marchand destinataire et conditions de vente.
3. Déployer un backend HTTPS avec stockage durable des commandes et des captures, contrôle serveur du montant et du destinataire, reprise idempotente, limitation de débit et traçabilité.
4. Configurer l'URL du webhook PayPal dans la **même** application Sandbox, enregistrer son webhook ID en secret et vérifier chaque signature. Rejeter les événements non vérifiés ; dédupliquer par event ID.
5. Ne donner l'accès payant qu'après confirmation de capture `COMPLETED` vérifiée côté serveur (montant, devise, bénéficiaire, commande). Gérer remboursements, litiges et délais.
6. Tester commandes, annulations, doubles appels, échecs, remboursements et webhooks avant toute demande de publication.
7. N'activer Live que dans une phase distincte et approuvée par le propriétaire.

**État:** préparation de l'intégration seulement, aucun paiement réel possible ici.
