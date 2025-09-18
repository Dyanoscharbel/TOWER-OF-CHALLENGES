import { useState, useEffect } from 'react';
import { Player } from '../../shared/types/player';
import { Stage } from '../../shared/types/stage';
import { Progression } from '../../shared/types/progression';

interface AdminPageProps {
  onHomeClick: () => void;
}

export const AdminPage = ({ onHomeClick }: AdminPageProps) => {
  const [activeTab, setActiveTab] = useState<'players' | 'stages' | 'progressions'>('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // États pour l'édition
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [showCreateStage, setShowCreateStage] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // État pour la confirmation de suppression
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'stage' | 'all-stages' | 'all-progressions' | null;
    id: number | null;
    name: string | null;
  }>({ type: null, id: null, name: null });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      switch (activeTab) {
        case 'players':
          await loadPlayers();
          break;
        case 'stages':
          await loadStages();
          break;
        case 'progressions':
          await loadProgressions();
          break;
      }
    } catch (err) {
      setError(`Erreur lors du chargement des ${activeTab}`);
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    const response = await fetch('/api/admin/players');
    const result = await response.json();
    if (result.status === 'success') {
      setPlayers(result.data);
    }
  };

  const loadStages = async () => {
    const response = await fetch('/api/admin/stages');
    const result = await response.json();
    if (result.status === 'success') {
      setStages(result.data);
    }
  };

  const loadProgressions = async () => {
    const response = await fetch('/api/admin/progressions');
    const result = await response.json();
    if (result.status === 'success') {
      setProgressions(result.data);
    }
  };

  const savePlayer = async (player: Player) => {
    try {
      const response = await fetch(`/api/admin/players/${player.reddit_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(player),
      });
      
      if (response.ok) {
        await loadPlayers();
        setEditingPlayer(null);
      }
    } catch (err) {
      setError('Erreur lors de la sauvegarde du joueur');
    }
  };

  const saveStage = async (stage: Stage) => {
    try {
      const isUpdate = stage.id > 0;
      
      console.log('saveStage called with:', { stage, isUpdate });
      
      // Pour les mises à jour, envoyer l'objet complet avec l'ID
      // Pour les nouvelles créations, ne pas envoyer l'ID
      const stageToSend = isUpdate ? {
        id: stage.id,
        nom: stage.nom,
        description: stage.description,
        regles: stage.regles,
        niveau: stage.niveau,
        target_score: stage.target_score
      } : {
        nom: stage.nom,
        description: stage.description,
        regles: stage.regles,
        niveau: stage.niveau,
        target_score: stage.target_score
      };
      
      console.log('Sending data:', stageToSend);
      console.log('Request URL:', isUpdate ? `/api/admin/stages/${stage.id}` : '/api/admin/stages');
      console.log('Request method:', isUpdate ? 'PUT' : 'POST');
      
      const response = await fetch(
        isUpdate ? `/api/admin/stages/${stage.id}` : '/api/admin/stages',
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stageToSend),
        }
      );
      
      const result = await response.json();
      console.log('Response:', { status: response.status, result });
      
      if (response.ok) {
        await loadStages();
        setEditingStage(null);
        setShowCreateStage(false);
      } else {
        setError(result.message || 'Erreur lors de la sauvegarde de l\'étage');
      }
    } catch (err) {
      console.error('saveStage error:', err);
      setError('Erreur lors de la sauvegarde de l\'étage');
    }
  };

  const deleteStage = async (stageId: number) => {
    const stage = stages.find(s => s.id === stageId);
    setDeleteConfirm({
      type: 'stage',
      id: stageId,
      name: stage?.nom || `Étage ${stageId}`
    });
  };

  const clearAllStages = async () => {
    setDeleteConfirm({
      type: 'all-stages',
      id: null,
      name: `tous les étages (${stages.length} étages)`
    });
  };

  const clearAllProgressions = async () => {
    setDeleteConfirm({
      type: 'all-progressions',
      id: null,
      name: `toutes les progressions (${progressions.length} progressions)`
    });
  };

  const exportStages = () => {
    try {
      // Créer le contenu JSON avec formatage
      const jsonContent = JSON.stringify(stages, null, 2);
      
      // Essayer d'abord le téléchargement automatique
      try {
        // Créer un blob avec le contenu JSON
        const blob = new Blob([jsonContent], { type: 'application/json' });
        
        // Créer un lien de téléchargement
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Générer un nom de fichier avec la date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0]?.replace(/:/g, '-') || 'unknown'; // Format HH-MM-SS
        link.download = `etages_export_${dateStr}_${timeStr}.json`;
        
        // Forcer les attributs pour le téléchargement
        link.style.display = 'none';
        link.target = '_blank';
        
        // Déclencher le téléchargement
        document.body.appendChild(link);
        link.click();
        
        // Nettoyer après un délai
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        }, 1000);
        
        // Ouvrir aussi la modal pour avoir une alternative
        setShowExportModal(true);
        console.log('Export des étages réussi (téléchargement + modal)');
      } catch (downloadError) {
        console.warn('Téléchargement automatique échoué, ouverture de la modal');
        // Fallback : Ouvrir la modal d'export
        setShowExportModal(true);
      }
      
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      setError('Erreur lors de l\'export des étages');
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirm.type === 'stage' && deleteConfirm.id) {
      try {
        console.log('Attempting to delete stage with ID:', deleteConfirm.id);
        const response = await fetch(`/api/admin/stages/${deleteConfirm.id}`, {
          method: 'DELETE',
        });
        
        console.log('Delete response status:', response.status);
        const result = await response.json();
        console.log('Delete response result:', result);
        
        if (response.ok) {
          console.log('Stage deleted successfully, reloading stages...');
          await loadStages();
        } else {
          setError(result.message || 'Erreur lors de la suppression de l\'étage');
        }
      } catch (err) {
        console.error('Error during deletion:', err);
        setError('Erreur lors de la suppression de l\'étage');
      }
    } else if (deleteConfirm.type === 'all-stages') {
      try {
        console.log('Attempting to clear all stages...');
        const response = await fetch('/api/admin/stages', {
          method: 'DELETE',
        });
        
        console.log('Clear all response status:', response.status);
        const result = await response.json();
        console.log('Clear all response result:', result);
        
        if (response.ok) {
          console.log('All stages cleared successfully, reloading stages...');
          await loadStages();
          await loadProgressions(); // Recharger aussi les progressions car elles sont supprimées
        } else {
          setError(result.message || 'Erreur lors de la suppression de tous les étages');
        }
      } catch (err) {
        console.error('Error during clear all:', err);
        setError('Erreur lors de la suppression de tous les étages');
      }
    } else if (deleteConfirm.type === 'all-progressions') {
      try {
        console.log('Attempting to clear all progressions...');
        const response = await fetch('/api/admin/progressions', {
          method: 'DELETE',
        });
        
        console.log('Clear all progressions response status:', response.status);
        const result = await response.json();
        console.log('Clear all progressions response result:', result);
        
        if (response.ok) {
          console.log('All progressions cleared successfully, reloading progressions...');
          await loadProgressions();
        } else {
          setError(result.message || 'Erreur lors de la suppression de toutes les progressions');
        }
      } catch (err) {
        console.error('Error during clear all progressions:', err);
        setError('Erreur lors de la suppression de toutes les progressions');
      }
    }
    
    setDeleteConfirm({ type: null, id: null, name: null });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ type: null, id: null, name: null });
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
        <button
          onClick={onHomeClick}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
        >
       ← Back
        </button>
        
        <h1 className="text-2xl font-bold">Administration Base de Données</h1>
        
        <div className="w-20"></div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 px-4 flex gap-1 border-b border-gray-700">
        {(['players', 'stages', 'progressions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium capitalize ${
              activeTab === tab
                ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            {tab === 'players' ? 'Joueurs' : tab === 'stages' ? 'Étages' : 'Progressions'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="bg-red-600 text-white p-3 rounded mb-4">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-xl">Chargement...</div>
          </div>
        )}

        {/* Contenu des onglets */}
        {!loading && (
          <>
            {activeTab === 'players' && (
              <PlayersTab
                players={players}
                editingPlayer={editingPlayer}
                setEditingPlayer={setEditingPlayer}
                onSave={savePlayer}
              />
            )}

            {activeTab === 'stages' && (
              <StagesTab
                stages={stages}
                editingStage={editingStage}
                setEditingStage={setEditingStage}
                showCreateStage={showCreateStage}
                setShowCreateStage={setShowCreateStage}
                onSave={saveStage}
                onDelete={deleteStage}
                onClearAll={clearAllStages}
                onExport={exportStages}
                setError={setError}
              />
            )}

            {activeTab === 'progressions' && (
              <ProgressionsTab progressions={progressions} onClearAll={clearAllProgressions} />
            )}
          </>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      {deleteConfirm.type && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4 text-red-400">
              Confirmer la suppression
            </h3>
            
            <p className="text-gray-300 mb-6">
              {deleteConfirm.type === 'stage' ? (
                <>
                  Êtes-vous sûr de vouloir supprimer l'étage{' '}
                  <span className="font-bold text-white">"{deleteConfirm.name}"</span> ?
                </>
              ) : deleteConfirm.type === 'all-stages' ? (
                <>
                  Êtes-vous sûr de vouloir supprimer{' '}
                  <span className="font-bold text-red-400">{deleteConfirm.name}</span> ?
                  <br />
                  <span className="text-sm text-orange-300 mt-2 block">
                    ⚠️ Cela supprimera aussi toutes les progressions associées !
                  </span>
                </>
              ) : deleteConfirm.type === 'all-progressions' ? (
                <>
                  Êtes-vous sûr de vouloir supprimer{' '}
                  <span className="font-bold text-red-400">{deleteConfirm.name}</span> ?
                  <br />
                  <span className="text-sm text-orange-300 mt-2 block">
                    ⚠️ Cette action est irréversible !
                  </span>
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir supprimer cet élément{' '}
                  <span className="font-bold text-white">"{deleteConfirm.name}"</span> ?
                </>
              )}
              <br />
              <span className="text-sm text-red-300 mt-2 block">
                Cette action est irréversible.
              </span>
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                {deleteConfirm.type === 'all-stages' ? 'Vider la table' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'export des étages */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-[600px] max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-green-400">Export des Étages JSON</h3>
              <button 
                className="text-gray-400 hover:text-white text-xl leading-none"
                onClick={() => setShowExportModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-300 mb-3">
                Copiez le contenu JSON ci-dessous et sauvegardez-le dans un fichier .json :
              </p>
              <textarea
                className="w-full h-[400px] p-3 bg-gray-700 text-white font-mono text-sm rounded border border-gray-600 resize-none"
                value={JSON.stringify(stages, null, 2)}
                readOnly
                onClick={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.select();
                  navigator.clipboard.writeText(target.value).catch(() => {});
                }}
                placeholder="Le contenu JSON apparaîtra ici..."
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button 
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(stages, null, 2))
                    .then(() => alert('JSON copié dans le presse-papiers !'))
                    .catch(() => alert('Impossible de copier automatiquement. Sélectionnez le texte manuellement.'));
                }}
              >
                📋 Copier dans le presse-papiers
              </button>
              <button 
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                onClick={() => setShowExportModal(false)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant pour l'onglet joueurs
const PlayersTab = ({ 
  players, 
  editingPlayer, 
  setEditingPlayer, 
  onSave 
}: {
  players: Player[];
  editingPlayer: Player | null;
  setEditingPlayer: (player: Player | null) => void;
  onSave: (player: Player) => void;
}) => {
  const [editForm, setEditForm] = useState<Player | null>(null);

  useEffect(() => {
    setEditForm(editingPlayer);
  }, [editingPlayer]);

  const handleSave = () => {
    if (editForm) {
      onSave(editForm);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Joueurs ({players.length})</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">Reddit ID</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Score Global</th>
              <th className="px-4 py-3 text-left">Étage Actuel</th>
              <th className="px-4 py-3 text-left">Créé le</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.reddit_id} className="border-b border-gray-700">
                <td className="px-4 py-3 text-sm">{player.reddit_id}</td>
                <td className="px-4 py-3">{player.username}</td>
                <td className="px-4 py-3">{player.score_global}</td>
                <td className="px-4 py-3">{player.etage_actuel}</td>
                <td className="px-4 py-3 text-sm">
                  {new Date(player.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEditingPlayer(player)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Éditer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal d'édition */}
      {editingPlayer && editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Éditer Joueur</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Score Global</label>
                <input
                  type="number"
                  value={editForm.score_global}
                  onChange={(e) => setEditForm({ ...editForm, score_global: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Étage Actuel</label>
                <input
                  type="number"
                  value={editForm.etage_actuel}
                  onChange={(e) => setEditForm({ ...editForm, etage_actuel: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Sauvegarder
              </button>
              <button
                onClick={() => setEditingPlayer(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant pour l'onglet étages
const StagesTab = ({
  stages,
  editingStage,
  setEditingStage,
  showCreateStage,
  setShowCreateStage,
  onSave,
  onDelete,
  onClearAll,
  onExport,
  setError
}: {
  stages: Stage[];
  editingStage: Stage | null;
  setEditingStage: (stage: Stage | null) => void;
  showCreateStage: boolean;
  setShowCreateStage: (show: boolean) => void;
  onSave: (stage: Stage) => void;
  onDelete: (stageId: number) => void;
  onClearAll: () => void;
  onExport: () => void;
  setError: (error: string | null) => void;
}) => {
  const [editForm, setEditForm] = useState<Stage | null>(null);

  useEffect(() => {
    if (editingStage) {
      setEditForm(editingStage);
    } else if (showCreateStage) {
      // Trouver le prochain niveau disponible
      const existingLevels = stages.map(s => s.niveau).sort((a, b) => a - b);
      let nextLevel = 1;
      for (const level of existingLevels) {
        if (level === nextLevel) {
          nextLevel++;
        } else {
          break;
        }
      }
      
      setEditForm({
        id: 0,
        nom: '',
        description: '',
        regles: '',
        niveau: nextLevel,
        target_score: 1000
      });
    }
  }, [editingStage, showCreateStage, stages]);

  const handleSave = () => {
    if (editForm) {
      // Validation côté client pour les niveaux uniques
      const existingStageAtLevel = stages.find(s => 
        s.niveau === editForm.niveau && s.id !== editForm.id
      );
      
      if (existingStageAtLevel) {
        setError(`Un étage existe déjà au niveau ${editForm.niveau} (${existingStageAtLevel.nom})`);
        return;
      }
      
      // Validation des champs requis
      if (!editForm.nom.trim()) {
        setError('Le nom de l\'étage est requis');
        return;
      }
      
      if (editForm.niveau < 1) {
        setError('Le niveau doit être supérieur à 0');
        return;
      }
      
      if (editForm.target_score < 1) {
        setError('Le score cible doit être supérieur à 0');
        return;
      }
      
      onSave(editForm);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Étages ({stages.length})</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateStage(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + Nouvel Étage
          </button>
          {stages.length > 0 && (
            <>
              <button
                onClick={onExport}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                📥 Exporter JSON
              </button>
              <button
                onClick={onClearAll}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                🗑️ Vider la table
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Niveau</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Score Max</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stages.sort((a, b) => a.niveau - b.niveau).map((stage) => (
              <tr key={stage.id} className="border-b border-gray-700">
                <td className="px-4 py-3">{stage.id}</td>
                <td className="px-4 py-3">{stage.niveau}</td>
                <td className="px-4 py-3">{stage.nom}</td>
                <td className="px-4 py-3 max-w-xs truncate">{stage.description}</td>
                <td className="px-4 py-3">{stage.target_score}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingStage(stage)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => onDelete(stage.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal d'édition/création */}
      {(editingStage || showCreateStage) && editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingStage ? 'Éditer Étage' : 'Nouvel Étage'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Niveau</label>
                <input
                  type="number"
                  value={editForm.niveau}
                  onChange={(e) => setEditForm({ ...editForm, niveau: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Nom</label>
                <input
                  type="text"
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded h-20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Règles</label>
                <textarea
                  value={editForm.regles}
                  onChange={(e) => setEditForm({ ...editForm, regles: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded h-20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Score Cible</label>
                <input
                  type="number"
                  value={editForm.target_score}
                  onChange={(e) => setEditForm({ ...editForm, target_score: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Sauvegarder
              </button>
              <button
                onClick={() => {
                  setEditingStage(null);
                  setShowCreateStage(false);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant pour l'onglet progressions
const ProgressionsTab = ({ progressions, onClearAll }: { progressions: Progression[]; onClearAll: () => void }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Progressions ({progressions.length})</h2>
        {progressions.length > 0 && (
          <button
            onClick={onClearAll}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            🗑️ Supprimer toutes les progressions
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Joueur ID</th>
              <th className="px-4 py-3 text-left">Étage ID</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Complété</th>
              <th className="px-4 py-3 text-left">Joué le</th>
            </tr>
          </thead>
          <tbody>
            {progressions.map((progression) => (
              <tr key={progression.id} className="border-b border-gray-700">
                <td className="px-4 py-3">{progression.id}</td>
                <td className="px-4 py-3">{progression.joueur_id}</td>
                <td className="px-4 py-3">{progression.etage_id}</td>
                <td className="px-4 py-3">{progression.score}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    progression.completed 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-600 text-gray-300'
                  }`}>
                    {progression.completed ? 'Oui' : 'Non'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {new Date(progression.played_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
