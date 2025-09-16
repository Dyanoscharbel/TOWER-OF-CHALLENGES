// Types pour le modèle de données des joueurs
export interface Player {
  reddit_id: string; // Clé primaire unique
  username: string;
  avatar_url: string;
  score_global: number;
  etage_actuel: number;
  created_at: string; // ISO string date
}

export interface PlayerStats {
  score_global: number;
  etage_actuel: number;
  levels_completed: number[]; // IDs des niveaux complétés (ancienne version)
  completed_stages: number[]; // IDs des étages complétés (nouvelle version)
  stars_per_level: Record<number, number>; // niveau -> nombre d'étoiles (ancienne version)
  scores_per_stage: Record<number, number>; // etage_id -> meilleur score (nouvelle version)
}

export interface CreatePlayerData {
  reddit_id: string;
  username: string;
  avatar_url?: string;
}
