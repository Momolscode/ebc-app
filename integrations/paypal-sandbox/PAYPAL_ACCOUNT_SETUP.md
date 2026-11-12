# Compte PayPal Developer — Céleste / L'Étoile du Berger

État au 12 novembre 2026 : **configuration Sandbox seulement ; aucun paiement réel n'est activé.**

## Application

- Nom de l'application créé par le titulaire : `Celeste-Etoile-du-Berger`.
- Type : **Merchant** ; environnement : **Sandbox**.
- Vérifier que le marchand Sandbox lié à l'application est le bon, et récupérer son **Merchant ID**.
- Conserver `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` et `PAYPAL_MERCHANT_ID` exclusivement dans les variables privées du service Render, **jamais** dans ce dépôt, dans un message ou une URL.
- Le compte PayPal Live/Business est distinct du compte de test ; son éligibilité, identité, devise EUR et capacités de réception restent à vérifier auprès du titulaire.

## Notifications PayPal (Webhooks)

Sur la fiche de **cette application Sandbox**, ajouter la future URL :

`https://celeste-paypal-sandbox-check.onrender.com/api/paypal/webhook`

**Ne pas l'enregistrer tant que le serveur est désactivé et ne retourne pas HTTP 2xx pour les événements valides : PayPal réessaie les notifications rejetées.**

Événements à surveiller :
- `CHECKOUT.ORDER.APPROVED`
- `CHECKOUT.PAYMENT-APPROVAL.REVERSED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED` (si disponible pour cette application)
- `CUSTOMER.DISPUTE.CREATED` (avant production)

Après enregistrement, placer le **Webhook ID** dans une variable privée `PAYPAL_WEBHOOK_ID` sur Render. Ne pas traiter l'URL ou l'ID comme une preuve de paiement : vérifier les signatures côté serveur, dédupliquer les événements et contrôler l'identité du marchand, l'offre et le montant avant tout accès payant.

## À terminer avant connexion au site

1. Vérifier la fiche professionnelle, l'identité de l'entité bénéficiaire, les exigences PayPal et les capacités de paiement de son compte.
2. Valider le catalogue d'offres Céleste, les prix TTC, la devise EUR, le traitement TVA/CGV et les règles d'annulation/remboursement.
3. Raccorder à Céleste un serveur de paiement sécurisé, avec sessions, anti-abus, stockage persistant et vérification du statut final. La branche présente est un prototype non audité.
4. Faire un cycle de test Sandbox complet avec un compte acheteur de test, capturer, traiter les notifications, simuler les retards, échecs, remboursements et doubles clics.
5. N'activer PayPal Live qu'avec les vrais identifiants Live, après validation du propriétaire et publication contrôlée de la nouvelle version de Céleste.

Références PayPal :
- https://developer.paypal.com/api/rest/webhooks/
- https://developer.paypal.com/payment-methods/webhooks/
