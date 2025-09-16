import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { PlayerService } from './services/PlayerService.js';
import { AdminService } from './services/AdminService.js';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// Créer une instance du service de joueur
const playerService = new PlayerService();
const adminService = new AdminService();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

// Routes pour les données des joueurs
router.get('/api/player/init', async (_req, res): Promise<void> => {
  try {
    const player = await playerService.initializePlayerOnLevelsPage();
    if (!player) {
      res.status(401).json({
        status: 'error',
        message: 'Unable to get current user information'
      });
      return;
    }

    res.json({
      status: 'success',
      data: player
    });
  } catch (error) {
    console.error('Error initializing player:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initialize player'
    });
  }
});

router.get('/api/player/:redditId', async (req, res): Promise<void> => {
  try {
    const { redditId } = req.params;
    const player = await playerService.getPlayer(redditId);
    
    if (!player) {
      res.status(404).json({
        status: 'error',
        message: 'Player not found'
      });
      return;
    }

    res.json({
      status: 'success',
      data: player
    });
  } catch (error) {
    console.error('Error getting player:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get player data'
    });
  }
});

router.get('/api/player/:redditId/stats', async (req, res): Promise<void> => {
  try {
    const { redditId } = req.params;
    const stats = await playerService.getPlayerStats(redditId);
    
    if (!stats) {
      res.status(404).json({
        status: 'error',
        message: 'Player stats not found'
      });
      return;
    }

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    console.error('Error getting player stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get player stats'
    });
  }
});

router.post('/api/player/:redditId/complete-level', async (req, res): Promise<void> => {
  try {
    const { redditId } = req.params;
    const { level, stars } = req.body;

    if (!level || !stars) {
      res.status(400).json({
        status: 'error',
        message: 'Level and stars are required'
      });
      return;
    }

    await playerService.completeLevel(redditId, parseInt(level), parseInt(stars));
    const updatedPlayer = await playerService.getPlayer(redditId);

    res.json({
      status: 'success',
      data: updatedPlayer
    });
  } catch (error) {
    console.error('Error completing level:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete level'
    });
  }
});

router.post('/api/player/:redditId/update-stage', async (req, res): Promise<void> => {
  try {
    const { redditId } = req.params;
    const { stage } = req.body;

    if (!stage) {
      res.status(400).json({
        status: 'error',
        message: 'Stage is required'
      });
      return;
    }

    await playerService.updatePlayerStage(redditId, parseInt(stage));
    const updatedPlayer = await playerService.getPlayer(redditId);

    res.json({
      status: 'success',
      data: updatedPlayer
    });
  } catch (error) {
    console.error('Error updating stage:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update stage'
    });
  }
});

router.get('/api/leaderboard', async (_req, res): Promise<void> => {
  try {
    const leaderboard = await playerService.getGlobalLeaderboard(10);

    res.json({
      status: 'success',
      data: leaderboard
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get leaderboard'
    });
  }
});

// === ROUTES D'ADMINISTRATION ===

// Initialiser les données par défaut
router.post('/api/admin/initialize', async (_req, res): Promise<void> => {
  try {
    await adminService.initializeDefaultStages();
    res.json({
      status: 'success',
      message: 'Default data initialized'
    });
  } catch (error) {
    console.error('Error initializing default data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to initialize default data'
    });
  }
});

// Routes pour les joueurs
router.get('/api/admin/players', async (_req, res): Promise<void> => {
  try {
    const players = await adminService.getAllPlayers();
    res.json({
      status: 'success',
      data: players
    });
  } catch (error) {
    console.error('Error getting players:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get players'
    });
  }
});

router.put('/api/admin/players/:redditId', async (req, res): Promise<void> => {
  try {
    const { redditId } = req.params;
    const playerData = req.body;
    
    const success = await adminService.updatePlayer(redditId, playerData);
    
    if (success) {
      res.json({
        status: 'success',
        message: 'Player updated successfully'
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'Player not found'
      });
    }
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update player'
    });
  }
});

// Route publique pour récupérer les étages
router.get('/api/stages', async (_req, res): Promise<void> => {
  try {
    const stages = await adminService.getAllStages();
    res.json({
      status: 'success',
      data: stages
    });
  } catch (error) {
    console.error('Error getting stages:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get stages'
    });
  }
});

// Routes pour les étages (admin)
router.get('/api/admin/stages', async (_req, res): Promise<void> => {
  try {
    const stages = await adminService.getAllStages();
    res.json({
      status: 'success',
      data: stages
    });
  } catch (error) {
    console.error('Error getting stages:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get stages'
    });
  }
});

router.post('/api/admin/stages', async (req, res): Promise<void> => {
  try {
    const stageData = req.body;
    const newStage = await adminService.createStage(stageData);
    
    if (newStage) {
      res.json({
        status: 'success',
        data: newStage
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Failed to create stage'
      });
    }
  } catch (error) {
    console.error('Error creating stage:', error);
    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create stage'
    });
  }
});

router.put('/api/admin/stages/:stageId', async (req, res): Promise<void> => {
  try {
    const stageId = parseInt(req.params.stageId);
    const stageData = req.body;
    
    console.log('PUT /api/admin/stages/:stageId called with:', { stageId, stageData });
    
    const success = await adminService.updateStage(stageId, stageData);
    
    console.log('updateStage result:', success);
    
    if (success) {
      res.json({
        status: 'success',
        message: 'Stage updated successfully'
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'Stage not found'
      });
    }
  } catch (error) {
    console.error('Error updating stage:', error);
    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update stage'
    });
  }
});

router.delete('/api/admin/stages/:stageId', async (req, res): Promise<void> => {
  try {
    const stageId = parseInt(req.params.stageId);
    const success = await adminService.deleteStage(stageId);
    
    if (success) {
      res.json({
        status: 'success',
        message: 'Stage deleted successfully'
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'Stage not found'
      });
    }
  } catch (error) {
    console.error('Error deleting stage:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete stage'
    });
  }
});

router.delete('/api/admin/stages', async (_req, res): Promise<void> => {
  try {
    const success = await adminService.clearAllStages();
    
    if (success) {
      res.json({
        status: 'success',
        message: 'All stages cleared successfully'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to clear stages'
      });
    }
  } catch (error) {
    console.error('Error clearing all stages:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear stages'
    });
  }
});

// Routes pour les progressions
router.get('/api/admin/progressions', async (_req, res): Promise<void> => {
  try {
    const progressions = await adminService.getAllProgressions();
    res.json({
      status: 'success',
      data: progressions
    });
  } catch (error) {
    console.error('Error getting progressions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get progressions'
    });
  }
});

// Route pour supprimer toutes les progressions
router.delete('/api/admin/progressions', async (_req, res): Promise<void> => {
  try {
    await adminService.clearAllProgressions();
    res.json({
      status: 'success',
      message: 'All progressions deleted successfully'
    });
  } catch (error) {
    console.error('Error clearing all progressions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear all progressions'
    });
  }
});

// Route pour récupérer une progression spécifique par joueur et étage
router.get('/api/progression', async (req, res): Promise<void> => {
  try {
    const { joueur_id, etage_id } = req.query;

    if (!joueur_id || !etage_id) {
      res.status(400).json({
        status: 'error',
        message: 'joueur_id and etage_id are required'
      });
      return;
    }

    const progressions = await adminService.getAllProgressions();
    const progression = progressions.find(p => 
      p.joueur_id.toString() === joueur_id.toString() && 
      p.etage_id === parseInt(etage_id as string)
    );

    if (!progression) {
      res.status(404).json({
        status: 'error',
        message: 'Progression not found'
      });
      return;
    }

    res.json({
      status: 'success',
      data: progression
    });
  } catch (error) {
    console.error('Error getting progression:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get progression'
    });
  }
});

// Route pour créer une progression
router.post('/api/progression/create', async (req, res): Promise<void> => {
  try {
    const { joueur_id, etage_id, score, completed } = req.body;

    if (!joueur_id || !etage_id || score === undefined) {
      res.status(400).json({
        status: 'error',
        message: 'joueur_id, etage_id, and score are required'
      });
      return;
    }

    const progression = await adminService.createProgression({
      joueur_id,
      etage_id,
      score,
      completed: completed || false
    });

    if (!progression) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to create progression'
      });
      return;
    }

    res.json({
      status: 'success',
      data: progression
    });
  } catch (error) {
    console.error('Error creating progression:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create progression'
    });
  }
});

// Route pour mettre à jour une progression
router.post('/api/progression/update', async (req, res): Promise<void> => {
  try {
    const { joueur_id, etage_id, score, completed } = req.body;

    if (!joueur_id || !etage_id) {
      res.status(400).json({
        status: 'error',
        message: 'joueur_id and etage_id are required'
      });
      return;
    }

    // Trouver la progression existante
    const progressions = await adminService.getAllProgressions();
    const progression = progressions.find(p => 
      p.joueur_id.toString() === joueur_id.toString() && 
      p.etage_id === parseInt(etage_id)
    );

    if (!progression) {
      res.status(404).json({
        status: 'error',
        message: 'Progression not found'
      });
      return;
    }

    const success = await adminService.updateProgression(progression.id, {
      score,
      completed
    });

    if (!success) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to update progression'
      });
      return;
    }

    res.json({
      status: 'success',
      message: 'Progression updated successfully'
    });
  } catch (error) {
    console.error('Error updating progression:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update progression'
    });
  }
});

// Route pour mettre à jour un joueur
router.post('/api/player/update', async (req, res): Promise<void> => {
  try {
    const { etage_actuel } = req.body;

    if (etage_actuel === undefined) {
      res.status(400).json({
        status: 'error',
        message: 'etage_actuel is required'
      });
      return;
    }

    // Récupérer l'utilisateur actuel
    const currentUser = await reddit.getCurrentUser();
    if (!currentUser) {
      res.status(401).json({
        status: 'error',
        message: 'User not authenticated'
      });
      return;
    }

    const success = await adminService.updatePlayer(currentUser.id, {
      etage_actuel: parseInt(etage_actuel)
    });

    if (!success) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to update player'
      });
      return;
    }

    res.json({
      status: 'success',
      message: 'Player updated successfully'
    });
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update player'
    });
  }
});

// Statistiques d'administration
router.get('/api/admin/stats', async (_req, res): Promise<void> => {
  try {
    const stats = await adminService.getAdminStats();
    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get admin stats'
    });
  }
});

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
