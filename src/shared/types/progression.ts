// Modèle pour la table 'progression'
export interface Progression {
  id: number;
  joueur_id: number;
  etage_id: number;
  score: number;
  completed: boolean;
  played_at: string;
}

// Interface pour créer une nouvelle progression
export interface CreateProgressionData {
  joueur_id: number;
  etage_id: number;
  score: number;
  completed?: boolean;
}

// Interface pour mettre à jour une progression
export interface UpdateProgressionData {
  score?: number;
  completed?: boolean;
}

// Interface pour les statistiques de progression d'un joueur
export interface PlayerProgressionStats {
  total_stages: number;
  completed_stages: number;
  total_score: number;
  average_score: number;
  best_scores: Array<{
    etage_id: number;
    stage_name: string;
    score: number;
    target_score: number;
    percentage: number;
  }>;
}
