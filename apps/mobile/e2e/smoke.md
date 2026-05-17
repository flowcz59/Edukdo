# EDUKDO — Smoke Test Manuel (Mobile)

> Protocole de validation à exécuter sur **simulateur iOS** et **émulateur Android**  
> avant chaque livraison. Durée estimée : 20 minutes par plateforme.

---

## Prérequis

- Backend API démarré et accessible (`npm run start:dev` depuis `apps/api/`)
- Base de données initialisée et seedée (`npx prisma db seed`)
- Variable `EXPO_PUBLIC_API_URL` pointant vers le backend (ex: `http://localhost:3000`)
- App lancée via `npx expo start` et rechargée sur le simulateur/émulateur cible

**Comptes de test disponibles après seed :**

| Rôle    | Email              | Mot de passe |
|---------|--------------------|--------------|
| Élève   | eleve@test.fr      | Test1234!    |
| Parent  | parent@test.fr     | Test1234!    |

---

## BLOC A — Authentification

### A-01 : Affichage de l'écran de connexion

**Action :** Lancer l'application à froid (pas de session active).  
**Résultat attendu :** L'écran de connexion s'affiche avec le logo EDUKDO, le champ email, le champ mot de passe et le bouton "Se connecter".  
**Critère visuel :** Fond sombre (#0A0F1E), champs arrondis, aucun spinner visible.  
**Statut :** ☐ iOS / ☐ Android

---

### A-02 : Connexion avec identifiants valides

**Action :** Saisir `eleve@test.fr` / `Test1234!` et appuyer sur "Se connecter".  
**Résultat attendu :** Redirection immédiate vers le Dashboard (onglet Accueil).  
**Critère visuel :** Barre de navigation inférieure visible (Accueil, Soumettre, Boutique, Profil). Le solde de points s'affiche en haut.  
**Statut :** ☐ iOS / ☐ Android

---

### A-03 : Connexion avec mauvais mot de passe

**Action :** Saisir `eleve@test.fr` / `MotDePasseFaux` et appuyer sur "Se connecter".  
**Résultat attendu :** Message d'erreur affiché ("Identifiants invalides"). L'utilisateur reste sur l'écran de connexion.  
**Critère visuel :** Message en rouge (#F87171), aucun crash.  
**Statut :** ☐ iOS / ☐ Android

---

### A-04 : Inscription d'un nouveau compte élève

**Action :** Appuyer sur "Créer un compte", saisir un email unique, mot de passe `NouveauTest1!`, rôle Élève, prénom, nom, date de naissance, niveau Seconde.  
**Résultat attendu :** Redirection vers le Dashboard avec solde = 0 pts.  
**Critère visuel :** Solde affiché "0 pts" ou "0 EDUKDO". Profil visible avec le prénom saisi.  
**Statut :** ☐ iOS / ☐ Android

---

### A-05 : Validation des champs d'inscription

**Action :** Tenter de s'inscrire avec un email invalide (ex: `pasunemail`).  
**Résultat attendu :** Erreur "Email invalide" affichée sous le champ. Bouton de confirmation désactivé ou erreur immédiate.  
**Critère visuel :** Indicateur d'erreur rouge visible, le formulaire ne se soumet pas.  
**Statut :** ☐ iOS / ☐ Android

---

## BLOC B — Dashboard (Accueil)

### B-01 : Affichage du solde de points

**Action :** Se connecter avec `eleve@test.fr` (3 bulletins historiques seedés).  
**Résultat attendu :** Le solde de points s'affiche correctement en haut de l'écran.  
**Critère visuel :** Couleur or (#F5C842) pour l'affichage du solde, chiffre lisible.  
**Statut :** ☐ iOS / ☐ Android

---

### B-02 : Liste des derniers bulletins

**Action :** Observer la section "Derniers bulletins" sur le Dashboard.  
**Résultat attendu :** Les 3 bulletins seedés apparaissent (T1, T2, T3) avec leur statut VALIDÉ en badge vert.  
**Critère visuel :** Badges colorés (vert = VALIDÉ, orange = EN ATTENTE, rouge = REJETÉ). Scroll horizontal si plus de 3 bulletins.  
**Statut :** ☐ iOS / ☐ Android

---

### B-03 : Section "Derniers gains"

**Action :** Observer la section "Derniers gains" sous la liste des bulletins.  
**Résultat attendu :** Les PointEvents correspondant aux bulletins seedés sont visibles avec leur montant et description.  
**Critère visuel :** Montants en vert (#34D399), descriptions lisibles, au maximum 5 événements affichés.  
**Statut :** ☐ iOS / ☐ Android

---

### B-04 : Bouton flottant de soumission

**Action :** Observer le bas de l'écran Dashboard.  
**Résultat attendu :** Bouton "📷 Soumettre un bulletin" flottant visible.  
**Critère visuel :** Bouton en couleur accent (or ou teal), positionné en bas à droite ou centré en bas.  
**Statut :** ☐ iOS / ☐ Android

---

## BLOC C — Soumission de bulletin

### C-01 : Navigation vers l'écran de soumission

**Action :** Appuyer sur l'onglet "Soumettre" dans la barre de navigation.  
**Résultat attendu :** Écran de sélection du type de document (2 grandes cartes : "Bulletin trimestriel" / "Devoir noté").  
**Critère visuel :** Cartes larges avec icônes, fond #111827, texte blanc.  
**Statut :** ☐ iOS / ☐ Android

---

### C-02 : Sélection "Bulletin trimestriel" et formulaire contextuel

**Action :** Appuyer sur la carte "Bulletin trimestriel".  
**Résultat attendu :** Formulaire contextuel affichant les champs Trimestre (1/2/3) et Année scolaire.  
**Critère visuel :** Formulaire de saisie clair, transitions fluides entre étapes.  
**Statut :** ☐ iOS / ☐ Android

---

### C-03 : Sélection "Devoir noté" et formulaire contextuel

**Action :** Revenir en arrière et appuyer sur "Devoir noté".  
**Résultat attendu :** Formulaire affichant uniquement le champ "Matière".  
**Critère visuel :** Le champ Trimestre/Année n'est PAS affiché (contextuel).  
**Statut :** ☐ iOS / ☐ Android

---

### C-04 : Prise de photo / sélection depuis la galerie

**Action :** Depuis l'étape 2 (après avoir rempli le formulaire "Bulletin trimestriel T1"), appuyer sur "Prendre une photo" ou "Choisir depuis la galerie".  
**Résultat attendu :** Le sélecteur d'image s'ouvre (caméra ou galerie selon le choix). Une image peut être sélectionnée.  
**Critère visuel :** Aperçu de la photo sélectionnée affiché à l'étape suivante.  
**Statut :** ☐ iOS / ☐ Android

---

### C-05 : Écran de confirmation et upload

**Action :** Avec une photo sélectionnée, appuyer sur "Soumettre".  
**Résultat attendu :** Animation de chargement visible pendant l'upload. Après ~2-3 secondes, écran de succès affiché avec les points estimés.  
**Critère visuel :** Spinner ou barre de progression visible, puis écran de succès avec un nombre de points en or.  
**Statut :** ☐ iOS / ☐ Android

---

### C-06 : Retour au Dashboard après soumission

**Action :** Appuyer sur "Retour au Dashboard" depuis l'écran de succès.  
**Résultat attendu :** Le Dashboard se recharge avec le nouveau bulletin visible (statut EN ATTENTE puis VALIDÉ après traitement).  
**Critère visuel :** Le solde de points est mis à jour automatiquement ou après un pull-to-refresh.  
**Statut :** ☐ iOS / ☐ Android

---

## BLOC D — Boutique

### D-01 : Affichage du catalogue

**Action :** Appuyer sur l'onglet "Boutique".  
**Résultat attendu :** En-tête avec le solde de points de l'utilisateur. Grille 2 colonnes avec les récompenses disponibles.  
**Critère visuel :** Images des récompenses visibles, noms des partenaires (Pathé, Netflix, etc.), coûts en points.  
**Statut :** ☐ iOS / ☐ Android

---

### D-02 : Filtres par catégorie

**Action :** Appuyer sur le filtre "Cinéma" dans la liste de chips horizontaux.  
**Résultat attendu :** La grille affiche uniquement les récompenses de catégorie CINEMA.  
**Critère visuel :** Chip "Cinéma" actif (couleur accentuée), autres catégories non sélectionnées.  
**Statut :** ☐ iOS / ☐ Android

---

### D-03 : Récompenses hors de portée grisées

**Action :** Avec un solde inférieur à 1000 pts, observer les récompenses coûteuses.  
**Résultat attendu :** Les récompenses trop chères sont visibles mais légèrement grisées (opacity réduite).  
**Critère visuel :** Opacité ~0.5, sans masquer complètement la récompense (effet "motivation").  
**Statut :** ☐ iOS / ☐ Android

---

### D-04 : Détail d'une récompense (bottom sheet)

**Action :** Appuyer sur une récompense à portée de budget.  
**Résultat attendu :** Bottom sheet s'ouvre avec le nom, la description, le partenaire, le coût, et le bouton "Échanger contre X pts".  
**Critère visuel :** Bottom sheet bien animé, fond #111827, bouton prominent.  
**Statut :** ☐ iOS / ☐ Android

---

### D-05 : Échange de récompense

**Action :** Dans le bottom sheet d'une récompense accessible, appuyer sur "Échanger".  
**Résultat attendu :** Confirmation demandée. Après confirmation, commande créée, solde mis à jour.  
**Critère visuel :** Toast ou message de succès, solde décrémenté dans l'en-tête de la boutique.  
**Statut :** ☐ iOS / ☐ Android

---

### D-06 : Tentative d'achat avec points insuffisants

**Action :** Tenter d'échanger une récompense dont le coût dépasse le solde actuel.  
**Résultat attendu :** Message d'erreur "Solde insuffisant" ou similaire. Aucune déduction de points.  
**Critère visuel :** Message d'erreur rouge, bottom sheet reste ouvert pour permettre de choisir une autre récompense.  
**Statut :** ☐ iOS / ☐ Android

---

## BLOC E — Profil

### E-01 : Affichage des informations de profil

**Action :** Appuyer sur l'onglet "Profil".  
**Résultat attendu :** Prénom, nom, niveau scolaire et établissement (si renseigné) affichés. Avatar avec initiales (pas de photo en MVP).  
**Critère visuel :** Initiales en grand dans un cercle coloré, informations lisibles.  
**Statut :** ☐ iOS / ☐ Android

---

### E-02 : Statistiques globales

**Action :** Observer la section statistiques sur l'écran Profil.  
**Résultat attendu :** Total de points gagnés, nombre de bulletins soumis, et streak de régularité affichés.  
**Critère visuel :** Cartes de stats avec icônes, couleur teal (#2DD4BF) pour les valeurs positives.  
**Statut :** ☐ iOS / ☐ Android

---

### E-03 : Déconnexion

**Action :** Appuyer sur le bouton "Se déconnecter".  
**Résultat attendu :** Retour à l'écran de connexion. Aucune donnée personnelle résiduelle dans l'app.  
**Critère visuel :** Écran de connexion vide (champs email/mot de passe vides).  
**Statut :** ☐ iOS / ☐ Android

---

## BLOC F — Robustesse réseau

### F-01 : Mode avion pendant l'upload

**Action :** Démarrer un upload de bulletin, puis activer le mode avion à mi-chemin.  
**Résultat attendu :** Message d'erreur réseau affiché. L'application ne crashe pas. L'utilisateur peut réessayer.  
**Critère visuel :** Toast ou alerte "Erreur réseau", bouton "Réessayer" visible.  
**Statut :** ☐ iOS / ☐ Android

---

### F-02 : Rechargement après déconnexion réseau

**Action :** Couper le réseau, naviguer entre les onglets, puis rétablir le réseau.  
**Résultat attendu :** Les données en cache (points, bulletins) restent visibles. Après rétablissement du réseau, les données se rechargent automatiquement ou sur pull-to-refresh.  
**Critère visuel :** Pas de page blanche, indicateur de chargement visible lors du rechargement.  
**Statut :** ☐ iOS / ☐ Android

---

## Résultat du smoke test

| Plateforme | Blocs passés | Blocs échoués | Résultat global |
|------------|--------------|---------------|-----------------|
| iOS        | /16          | /16           | ☐ GO / ☐ NO-GO |
| Android    | /16          | /16           | ☐ GO / ☐ NO-GO |

**Signature du testeur :** ____________________  
**Date :** ____________________  
**Version testée :** ____________________

> **GO** si tous les blocs A-E passent. Les blocs F sont souhaitables mais non bloquants pour le MVP.
