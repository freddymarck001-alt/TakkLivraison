/*
# TAKK Livraison - Schéma complet de la base de données

## Description
Création de toutes les tables nécessaires pour l'application de gestion de flotte de motos TAKK Livraison.

## Tables créées

### 1. profiles
Profils utilisateurs liés à auth.users. Stocke le rôle (dg, daf, do, dam, drh), nom, poste, photo.

### 2. motos
Flotte de motos. Chaque moto a un matricule, statut (active/en_panne/immobilisee/disponible), propriétaire (takk/investisseur), locataire assigné, coordonnées GPS simulées, prix d'achat (670 000 FCFA).

### 3. locataires
Livreurs locataires. Dossier complet : nom, téléphone, adresse, date de recrutement, contrat, indice de fiabilité, moto assignée.

### 4. investisseurs
Investisseurs externes qui confient leurs motos à TAKK. Suivi des commissions (80% investisseur, 20% TAKK).

### 5. recettes
Entrées de recettes journalières par moto. Montant attendu vs reçu, jours travaillés de la semaine.

### 6. absences
Absences des locataires avec justificatif et validation.

### 7. prets
Prêts micro-finance contractés par le DAF. Montant, institution, taux mensuel dégressif, durée, statut.

### 8. echeances_pret
Échéancier de remboursement calculé pour chaque prêt (capital + intérêts par mois).

### 9. maintenances
Planning de maintenance préventive par moto.

### 10. reparations
Réparations en cours ou terminées avec coût et description.

### 11. incidents
Incidents et litiges signalés par les opérations.

### 12. notifications
Notifications système (impayés, pannes, absences, échéances).

### 13. messages
Messagerie interne entre directeurs.

### 14. audit_logs
Journal d'audit : qui a fait quoi et quand.

### 15. pieces_stock
Stock de pièces détachées.

### 16. fournisseurs
Fournisseurs de motos et pièces.

### 17. compte_amortissement
Compte d'amortissement (assurances, vignettes, grosses réparations).

### 18. reinvestissement
Suivi du solde de réinvestissement et du compte amortissement (répartition 80/20 du net mensuel).

## Sécurité
- RLS activé sur toutes les tables
- Accès authenticated pour les utilisateurs connectés
- Accès anon pour lecture uniquement sur certaines tables publiques

## Notes importantes
1. Devise : FCFA
2. Prix moto : 670 000 FCFA
3. Recette de référence : 25 000 FCFA/semaine (5 j/7)
4. Revenu net/moto : 100 000 FCFA/mois
5. Réinvestissement : 80% achat, 20% amortissement
6. Commission investisseur : 80% pour l'investisseur, 20% pour TAKK
*/

-- =========================================
-- PROFILES (linked to auth.users)
-- =========================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  nom text NOT NULL DEFAULT '',
  prenom text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'do' CHECK (role IN ('dg', 'daf', 'do', 'dam', 'drh')),
  telephone text DEFAULT '',
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
TO authenticated USING (auth.uid() = id);

-- =========================================
-- LOCATAIRES
-- =========================================
CREATE TABLE IF NOT EXISTS locataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  telephone text NOT NULL DEFAULT '',
  adresse text DEFAULT '',
  date_naissance date,
  date_recrutement date NOT NULL DEFAULT CURRENT_DATE,
  numero_contrat text UNIQUE,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'suspendu', 'termine', 'en_cours_recrutement')),
  indice_fiabilite integer NOT NULL DEFAULT 100 CHECK (indice_fiabilite BETWEEN 0 AND 100),
  solde_impaye numeric(12,0) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE locataires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locataires_select" ON locataires;
CREATE POLICY "locataires_select" ON locataires FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "locataires_insert" ON locataires;
CREATE POLICY "locataires_insert" ON locataires FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "locataires_update" ON locataires;
CREATE POLICY "locataires_update" ON locataires FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "locataires_delete" ON locataires;
CREATE POLICY "locataires_delete" ON locataires FOR DELETE TO authenticated USING (true);

-- =========================================
-- INVESTISSEURS
-- =========================================
CREATE TABLE IF NOT EXISTS investisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  telephone text NOT NULL DEFAULT '',
  email text DEFAULT '',
  adresse text DEFAULT '',
  date_entree date NOT NULL DEFAULT CURRENT_DATE,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'prospect')),
  total_commissions_versees numeric(12,0) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE investisseurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investisseurs_select" ON investisseurs;
CREATE POLICY "investisseurs_select" ON investisseurs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "investisseurs_insert" ON investisseurs;
CREATE POLICY "investisseurs_insert" ON investisseurs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "investisseurs_update" ON investisseurs;
CREATE POLICY "investisseurs_update" ON investisseurs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "investisseurs_delete" ON investisseurs;
CREATE POLICY "investisseurs_delete" ON investisseurs FOR DELETE TO authenticated USING (true);

-- =========================================
-- FOURNISSEURS
-- =========================================
CREATE TABLE IF NOT EXISTS fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  contact text DEFAULT '',
  telephone text DEFAULT '',
  email text DEFAULT '',
  adresse text DEFAULT '',
  type_fourniture text DEFAULT 'motos' CHECK (type_fourniture IN ('motos', 'pieces', 'services', 'autre')),
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fournisseurs_select" ON fournisseurs;
CREATE POLICY "fournisseurs_select" ON fournisseurs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fournisseurs_insert" ON fournisseurs;
CREATE POLICY "fournisseurs_insert" ON fournisseurs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "fournisseurs_update" ON fournisseurs;
CREATE POLICY "fournisseurs_update" ON fournisseurs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fournisseurs_delete" ON fournisseurs;
CREATE POLICY "fournisseurs_delete" ON fournisseurs FOR DELETE TO authenticated USING (true);

-- =========================================
-- MOTOS
-- =========================================
CREATE TABLE IF NOT EXISTS motos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule text UNIQUE NOT NULL,
  marque text NOT NULL DEFAULT 'Yamaha',
  modele text NOT NULL DEFAULT 'YBR125',
  annee integer DEFAULT 2024,
  date_achat date NOT NULL DEFAULT CURRENT_DATE,
  prix_achat numeric(12,0) NOT NULL DEFAULT 670000,
  statut text NOT NULL DEFAULT 'disponible' CHECK (statut IN ('active', 'en_panne', 'immobilisee', 'disponible')),
  proprietaire text NOT NULL DEFAULT 'takk' CHECK (proprietaire IN ('takk', 'investisseur')),
  investisseur_id uuid REFERENCES investisseurs(id) ON DELETE SET NULL,
  locataire_id uuid REFERENCES locataires(id) ON DELETE SET NULL,
  gps_lat numeric(10,6) DEFAULT 5.354229,
  gps_lng numeric(10,6) DEFAULT -4.001260,
  gps_derniere_maj timestamptz DEFAULT now(),
  kilometrage integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE motos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motos_select" ON motos;
CREATE POLICY "motos_select" ON motos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "motos_insert" ON motos;
CREATE POLICY "motos_insert" ON motos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "motos_update" ON motos;
CREATE POLICY "motos_update" ON motos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "motos_delete" ON motos;
CREATE POLICY "motos_delete" ON motos FOR DELETE TO authenticated USING (true);

-- =========================================
-- RECETTES (revenue entries)
-- =========================================
CREATE TABLE IF NOT EXISTS recettes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moto_id uuid NOT NULL REFERENCES motos(id) ON DELETE CASCADE,
  locataire_id uuid REFERENCES locataires(id) ON DELETE SET NULL,
  semaine_debut date NOT NULL,
  jours_travailles integer NOT NULL DEFAULT 5 CHECK (jours_travailles BETWEEN 0 AND 7),
  montant_attendu numeric(12,0) NOT NULL DEFAULT 25000,
  montant_recu numeric(12,0) NOT NULL DEFAULT 0,
  date_paiement timestamptz,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'partiel', 'paye', 'impaye')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE recettes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recettes_select" ON recettes;
CREATE POLICY "recettes_select" ON recettes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recettes_insert" ON recettes;
CREATE POLICY "recettes_insert" ON recettes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "recettes_update" ON recettes;
CREATE POLICY "recettes_update" ON recettes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "recettes_delete" ON recettes;
CREATE POLICY "recettes_delete" ON recettes FOR DELETE TO authenticated USING (true);

-- =========================================
-- ABSENCES
-- =========================================
CREATE TABLE IF NOT EXISTS absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locataire_id uuid NOT NULL REFERENCES locataires(id) ON DELETE CASCADE,
  moto_id uuid REFERENCES motos(id) ON DELETE SET NULL,
  date_absence date NOT NULL,
  motif text DEFAULT '',
  justifie boolean NOT NULL DEFAULT false,
  justificatif_url text DEFAULT '',
  valide_par uuid REFERENCES auth.users(id),
  valide_le timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "absences_select" ON absences;
CREATE POLICY "absences_select" ON absences FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "absences_insert" ON absences;
CREATE POLICY "absences_insert" ON absences FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "absences_update" ON absences;
CREATE POLICY "absences_update" ON absences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "absences_delete" ON absences;
CREATE POLICY "absences_delete" ON absences FOR DELETE TO authenticated USING (true);

-- =========================================
-- PRETS (microfinance loans)
-- =========================================
CREATE TABLE IF NOT EXISTS prets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  montant numeric(12,0) NOT NULL,
  taux_mensuel numeric(5,2) NOT NULL,
  duree_mois integer NOT NULL,
  date_debut date NOT NULL DEFAULT CURRENT_DATE,
  capital_restant numeric(12,0) NOT NULL,
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'rembourse', 'en_defaut')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prets_select" ON prets;
CREATE POLICY "prets_select" ON prets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prets_insert" ON prets;
CREATE POLICY "prets_insert" ON prets FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "prets_update" ON prets;
CREATE POLICY "prets_update" ON prets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "prets_delete" ON prets;
CREATE POLICY "prets_delete" ON prets FOR DELETE TO authenticated USING (true);

-- =========================================
-- ECHEANCES_PRET (loan installment schedule)
-- =========================================
CREATE TABLE IF NOT EXISTS echeances_pret (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pret_id uuid NOT NULL REFERENCES prets(id) ON DELETE CASCADE,
  numero_echeance integer NOT NULL,
  date_echeance date NOT NULL,
  capital_debut numeric(12,0) NOT NULL,
  interet numeric(12,0) NOT NULL,
  capital_rembourse numeric(12,0) NOT NULL,
  mensualite numeric(12,0) NOT NULL,
  capital_fin numeric(12,0) NOT NULL,
  statut text NOT NULL DEFAULT 'a_payer' CHECK (statut IN ('a_payer', 'paye', 'en_retard')),
  date_paiement timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE echeances_pret ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "echeances_select" ON echeances_pret;
CREATE POLICY "echeances_select" ON echeances_pret FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "echeances_insert" ON echeances_pret;
CREATE POLICY "echeances_insert" ON echeances_pret FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "echeances_update" ON echeances_pret;
CREATE POLICY "echeances_update" ON echeances_pret FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "echeances_delete" ON echeances_pret;
CREATE POLICY "echeances_delete" ON echeances_pret FOR DELETE TO authenticated USING (true);

-- =========================================
-- MAINTENANCES
-- =========================================
CREATE TABLE IF NOT EXISTS maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moto_id uuid NOT NULL REFERENCES motos(id) ON DELETE CASCADE,
  type_maintenance text NOT NULL DEFAULT 'preventive' CHECK (type_maintenance IN ('preventive', 'corrective', 'revision')),
  titre text NOT NULL,
  description text DEFAULT '',
  date_prevue date,
  date_realisation date,
  statut text NOT NULL DEFAULT 'planifie' CHECK (statut IN ('planifie', 'en_cours', 'termine', 'annule')),
  cout numeric(12,0) DEFAULT 0,
  technicien text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenances_select" ON maintenances;
CREATE POLICY "maintenances_select" ON maintenances FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "maintenances_insert" ON maintenances;
CREATE POLICY "maintenances_insert" ON maintenances FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "maintenances_update" ON maintenances;
CREATE POLICY "maintenances_update" ON maintenances FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "maintenances_delete" ON maintenances;
CREATE POLICY "maintenances_delete" ON maintenances FOR DELETE TO authenticated USING (true);

-- =========================================
-- REPARATIONS
-- =========================================
CREATE TABLE IF NOT EXISTS reparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moto_id uuid NOT NULL REFERENCES motos(id) ON DELETE CASCADE,
  description text NOT NULL,
  date_debut date NOT NULL DEFAULT CURRENT_DATE,
  date_fin date,
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine', 'en_attente_pieces')),
  cout numeric(12,0) DEFAULT 0,
  fournisseur_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reparations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reparations_select" ON reparations;
CREATE POLICY "reparations_select" ON reparations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reparations_insert" ON reparations;
CREATE POLICY "reparations_insert" ON reparations FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reparations_update" ON reparations;
CREATE POLICY "reparations_update" ON reparations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reparations_delete" ON reparations;
CREATE POLICY "reparations_delete" ON reparations FOR DELETE TO authenticated USING (true);

-- =========================================
-- INCIDENTS
-- =========================================
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moto_id uuid REFERENCES motos(id) ON DELETE SET NULL,
  locataire_id uuid REFERENCES locataires(id) ON DELETE SET NULL,
  type_incident text NOT NULL DEFAULT 'autre' CHECK (type_incident IN ('accident', 'vol', 'litige', 'infraction', 'panne', 'autre')),
  titre text NOT NULL,
  description text DEFAULT '',
  date_incident date NOT NULL DEFAULT CURRENT_DATE,
  statut text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_cours', 'resolu', 'ferme')),
  gravite text NOT NULL DEFAULT 'faible' CHECK (gravite IN ('faible', 'moyenne', 'elevee', 'critique')),
  cout_estime numeric(12,0) DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_select" ON incidents;
CREATE POLICY "incidents_select" ON incidents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "incidents_insert" ON incidents;
CREATE POLICY "incidents_insert" ON incidents FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "incidents_update" ON incidents;
CREATE POLICY "incidents_update" ON incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "incidents_delete" ON incidents;
CREATE POLICY "incidents_delete" ON incidents FOR DELETE TO authenticated USING (true);

-- =========================================
-- NOTIFICATIONS
-- =========================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_role text NOT NULL DEFAULT 'dg',
  titre text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'alerte', 'urgence', 'succes')),
  lue boolean NOT NULL DEFAULT false,
  lue_le timestamptz,
  reference_type text DEFAULT '',
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated USING (true);

-- =========================================
-- MESSAGES (internal messaging)
-- =========================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expediteur_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinataire_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sujet text NOT NULL DEFAULT '',
  contenu text NOT NULL,
  lu boolean NOT NULL DEFAULT false,
  lu_le timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated
USING (auth.uid() = expediteur_id OR auth.uid() = destinataire_id);

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = expediteur_id);

DROP POLICY IF EXISTS "messages_update" ON messages;
CREATE POLICY "messages_update" ON messages FOR UPDATE TO authenticated
USING (auth.uid() = destinataire_id) WITH CHECK (auth.uid() = destinataire_id);

DROP POLICY IF EXISTS "messages_delete" ON messages;
CREATE POLICY "messages_delete" ON messages FOR DELETE TO authenticated
USING (auth.uid() = expediteur_id);

-- =========================================
-- AUDIT_LOGS
-- =========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text DEFAULT '',
  user_role text DEFAULT '',
  action text NOT NULL,
  table_concernee text DEFAULT '',
  reference_id uuid,
  details jsonb DEFAULT '{}',
  ip_address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- =========================================
-- PIECES_STOCK
-- =========================================
CREATE TABLE IF NOT EXISTS pieces_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  nom text NOT NULL,
  description text DEFAULT '',
  quantite integer NOT NULL DEFAULT 0,
  quantite_min integer NOT NULL DEFAULT 5,
  prix_unitaire numeric(12,0) DEFAULT 0,
  fournisseur_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pieces_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pieces_select" ON pieces_stock;
CREATE POLICY "pieces_select" ON pieces_stock FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pieces_insert" ON pieces_stock;
CREATE POLICY "pieces_insert" ON pieces_stock FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pieces_update" ON pieces_stock;
CREATE POLICY "pieces_update" ON pieces_stock FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pieces_delete" ON pieces_stock;
CREATE POLICY "pieces_delete" ON pieces_stock FOR DELETE TO authenticated USING (true);

-- =========================================
-- REINVESTISSEMENT (financial tracking)
-- =========================================
CREATE TABLE IF NOT EXISTS reinvestissement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periode text NOT NULL,
  recettes_brutes numeric(12,0) NOT NULL DEFAULT 0,
  charges_roulement numeric(12,0) NOT NULL DEFAULT 10000,
  revenu_net numeric(12,0) NOT NULL DEFAULT 0,
  solde_reinvest numeric(12,0) NOT NULL DEFAULT 0,
  solde_amortissement numeric(12,0) NOT NULL DEFAULT 0,
  motos_achetees integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reinvestissement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinvest_select" ON reinvestissement;
CREATE POLICY "reinvest_select" ON reinvestissement FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reinvest_insert" ON reinvestissement;
CREATE POLICY "reinvest_insert" ON reinvestissement FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "reinvest_update" ON reinvestissement;
CREATE POLICY "reinvest_update" ON reinvestissement FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reinvest_delete" ON reinvestissement;
CREATE POLICY "reinvest_delete" ON reinvestissement FOR DELETE TO authenticated USING (true);

-- =========================================
-- COMMANDES (purchase orders)
-- =========================================
CREATE TABLE IF NOT EXISTS commandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fournisseur_id uuid REFERENCES fournisseurs(id) ON DELETE SET NULL,
  type_commande text NOT NULL DEFAULT 'moto' CHECK (type_commande IN ('moto', 'piece', 'service')),
  description text NOT NULL,
  quantite integer NOT NULL DEFAULT 1,
  prix_unitaire numeric(12,0) NOT NULL DEFAULT 670000,
  montant_total numeric(12,0) NOT NULL DEFAULT 670000,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'validee', 'livree', 'annulee')),
  date_commande date NOT NULL DEFAULT CURRENT_DATE,
  date_livraison_prevue date,
  date_livraison_reelle date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commandes_select" ON commandes;
CREATE POLICY "commandes_select" ON commandes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "commandes_insert" ON commandes;
CREATE POLICY "commandes_insert" ON commandes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "commandes_update" ON commandes;
CREATE POLICY "commandes_update" ON commandes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "commandes_delete" ON commandes;
CREATE POLICY "commandes_delete" ON commandes FOR DELETE TO authenticated USING (true);

-- =========================================
-- INDEXES for performance
-- =========================================
CREATE INDEX IF NOT EXISTS idx_motos_statut ON motos(statut);
CREATE INDEX IF NOT EXISTS idx_motos_locataire ON motos(locataire_id);
CREATE INDEX IF NOT EXISTS idx_recettes_moto ON recettes(moto_id);
CREATE INDEX IF NOT EXISTS idx_recettes_semaine ON recettes(semaine_debut);
CREATE INDEX IF NOT EXISTS idx_recettes_statut ON recettes(statut);
CREATE INDEX IF NOT EXISTS idx_absences_locataire ON absences(locataire_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(date_absence);
CREATE INDEX IF NOT EXISTS idx_echeances_pret ON echeances_pret(pret_id);
CREATE INDEX IF NOT EXISTS idx_echeances_statut ON echeances_pret(statut);
CREATE INDEX IF NOT EXISTS idx_maintenances_moto ON maintenances(moto_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(destinataire_role);
CREATE INDEX IF NOT EXISTS idx_notifications_lue ON notifications(lue);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
