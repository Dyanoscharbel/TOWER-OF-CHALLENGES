// Modèle pour la table 'etages'
export interface Stage {
  id: number;
  nom: string;
  description: string;
  regles: string;
  niveau: number;
  target_score: number;
}

// Interface pour créer un nouvel étage
export interface CreateStageData {
  nom: string;
  description: string;
  regles: string;
  niveau: number;
  target_score: number;
}

// Interface pour mettre à jour un étage
export interface UpdateStageData {
  nom?: string;
  description?: string;
  regles?: string;
  niveau?: number;
  target_score?: number;
}
