export type Role = 'dg' | 'daf' | 'do' | 'dam' | 'drh';

export interface Profile {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  telephone: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Moto {
  id: string;
  matricule: string;
  marque: string;
  modele: string;
  annee: number;
  date_achat: string;
  prix_achat: number;
  statut: 'active' | 'en_panne' | 'immobilisee' | 'disponible';
  proprietaire: 'takk' | 'investisseur';
  investisseur_id: string | null;
  locataire_id: string | null;
  gps_identifiant: string | null;
  gps_lat: number;
  gps_lng: number;
  gps_derniere_maj: string;
  gps_status: 'connecte' | 'non_connecte' | 'hors_ligne';
  kilometrage: number;
  notes: string;
  created_at: string;
  updated_at: string;
  locataires?: Locataire;
  investisseurs?: Investisseur;
}

export interface Locataire {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string;
  date_naissance: string | null;
  date_recrutement: string;
  numero_contrat: string | null;
  statut: 'actif' | 'suspendu' | 'termine' | 'en_cours_recrutement';
  indice_fiabilite: number;
  solde_impaye: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Investisseur {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
  date_entree: string;
  statut: 'actif' | 'inactif' | 'prospect';
  total_commissions_versees: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Recette {
  id: string;
  moto_id: string;
  locataire_id: string | null;
  semaine_debut: string;
  jours_travailles: number;
  montant_attendu: number;
  montant_recu: number;
  date_paiement: string | null;
  statut: 'en_attente' | 'partiel' | 'paye' | 'impaye';
  notes: string;
  created_at: string;
  updated_at: string;
  motos?: Moto;
  locataires?: Locataire;
}

export interface Absence {
  id: string;
  locataire_id: string;
  moto_id: string | null;
  date_absence: string;
  motif: string;
  justifie: boolean;
  justificatif_url: string;
  valide_par: string | null;
  valide_le: string | null;
  created_at: string;
  locataires?: Locataire;
}

export interface Pret {
  id: string;
  institution: string;
  montant: number;
  taux_mensuel: number;
  duree_mois: number;
  date_debut: string;
  capital_restant: number;
  statut: 'en_cours' | 'rembourse' | 'en_defaut';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface EcheancePret {
  id: string;
  pret_id: string;
  numero_echeance: number;
  date_echeance: string;
  capital_debut: number;
  interet: number;
  capital_rembourse: number;
  mensualite: number;
  capital_fin: number;
  statut: 'a_payer' | 'paye' | 'en_retard';
  date_paiement: string | null;
  created_at: string;
}

export interface Maintenance {
  id: string;
  moto_id: string;
  type_maintenance: 'preventive' | 'corrective' | 'revision';
  titre: string;
  description: string;
  date_prevue: string | null;
  date_realisation: string | null;
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule';
  cout: number;
  technicien: string;
  created_at: string;
  updated_at: string;
  motos?: Moto;
}

export interface Reparation {
  id: string;
  moto_id: string;
  description: string;
  date_debut: string;
  date_fin: string | null;
  statut: 'en_cours' | 'termine' | 'en_attente_pieces';
  cout: number;
  notes: string;
  created_at: string;
  motos?: Moto;
}

export interface Incident {
  id: string;
  moto_id: string | null;
  locataire_id: string | null;
  type_incident: 'accident' | 'vol' | 'litige' | 'infraction' | 'panne' | 'autre';
  titre: string;
  description: string;
  date_incident: string;
  statut: 'ouvert' | 'en_cours' | 'resolu' | 'ferme';
  gravite: 'faible' | 'moyenne' | 'elevee' | 'critique';
  cout_estime: number;
  created_at: string;
  motos?: Moto;
  locataires?: Locataire;
}

export interface Notification {
  id: string;
  destinataire_role: string;
  titre: string;
  message: string;
  type: 'info' | 'alerte' | 'urgence' | 'succes';
  lue: boolean;
  lue_le: string | null;
  reference_type: string;
  reference_id: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  expediteur_id: string;
  destinataire_id: string | null;
  sujet: string;
  contenu: string;
  lu: boolean;
  lu_le: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string;
  user_role: string;
  action: string;
  table_concernee: string;
  reference_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface PieceStock {
  id: string;
  reference: string;
  nom: string;
  description: string;
  quantite: number;
  quantite_min: number;
  prix_unitaire: number;
  fournisseur_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Fournisseur {
  id: string;
  nom: string;
  contact: string;
  telephone: string;
  email: string;
  adresse: string;
  type_fourniture: 'motos' | 'pieces' | 'services' | 'autre';
  statut: 'actif' | 'inactif';
  notes: string;
  created_at: string;
}

export interface Reinvestissement {
  id: string;
  periode: string;
  recettes_brutes: number;
  charges_roulement: number;
  revenu_net: number;
  solde_reinvest: number;
  solde_amortissement: number;
  motos_achetees: number;
  created_at: string;
}

export interface Commande {
  id: string;
  fournisseur_id: string | null;
  type_commande: 'moto' | 'piece' | 'service';
  description: string;
  quantite: number;
  prix_unitaire: number;
  montant_total: number;
  statut: 'en_attente' | 'validee' | 'livree' | 'annulee';
  date_commande: string;
  date_livraison_prevue: string | null;
  date_livraison_reelle: string | null;
  created_at: string;
  fournisseurs?: Fournisseur;
}

export const ROLE_LABELS: Record<Role, string> = {
  dg: 'Directeur Général',
  daf: 'Directeur Financier',
  do: 'Directeur des Opérations',
  dam: 'Directeur Appro. & Maintenance',
  drh: 'Directeur RH & Développement',
};

export const ROLE_COLORS: Record<Role, string> = {
  dg: 'bg-[#1B2A4A]',
  daf: 'bg-emerald-700',
  do: 'bg-blue-700',
  dam: 'bg-orange-700',
  drh: 'bg-purple-700',
};

export const formatCFA = (amount: number): string => {
  return new Intl.NumberFormat('fr-CI', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
};

export const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-CI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const TEAM_ACCOUNTS = [
  { role: 'dg' as Role, email: 'freddymarc.k001@icloud.com', password: 'Takk2026', label: 'Directeur Général', nom: 'Kouassi', prenom: 'Freddy Marc' },
  { role: 'daf' as Role, email: 'freddymarc.k001@gmail.com', password: 'Takk2026', label: 'Directeur Financier', nom: 'Kouassi', prenom: 'Freddy' },
  { role: 'do' as Role, email: 'fobah.tanoh@gmail.com', password: 'Takk2026', label: 'Directeur des Opérations', nom: 'Tanoh', prenom: 'Christian' },
  { role: 'dam' as Role, email: 'alyothniel@icloud.com', password: 'Takk2026', label: 'Dir. Appro. & Maintenance', nom: 'Kouamé', prenom: 'Othniel' },
  { role: 'drh' as Role, email: 'attasylvestre6@gmail.com', password: 'Takk2026', label: 'Directeur RH & Développement', nom: 'Atta', prenom: 'Sylvestre' },
];
