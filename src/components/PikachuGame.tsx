import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import gengarSprite from "@/assets/gengar-sprite.png";
import charizardSprite from "@/assets/charizard-sprite.png";
import { getTopScores, addHighScore, clearHighScores, type HighScore } from "@/lib/supabase";

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Spike extends GameObject {
  id: number;
}

interface FlyingObstacle extends GameObject {
  id: number;
  speed: number;
}

interface PowerUp extends GameObject {
  id: number;
  type: 'shield';
}

// Responsive game dimensions
const getGameDimensions = () => {
  const isMobile = window.innerWidth < 768;
  return {
    width: isMobile ? Math.min(window.innerWidth - 20, 400) : 800,
    height: isMobile ? 300 : 400
  };
};

const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const GROUND_HEIGHT = 50;
const PLAYER_SIZE = 50;
const SPIKE_WIDTH = 25;
const SPIKE_HEIGHT = 30;
const GAME_SPEED = 2.5;
const FLYING_OBSTACLE_SIZE = 35;
const CHARIZARD_SIZE = 50;
const POWER_UP_SIZE = 32;
const POWER_UP_DURATION = 5000;

type Lane = 'ground' | 'low' | 'mid' | 'high' | 'ceiling';

type LevelEvent =
  | { offset: number; type: 'groundSpikes'; count: number; spacing?: number; startOffset?: number }
  | { offset: number; type: 'ceilingSpikes'; count: number; spacing?: number }
  | { offset: number; type: 'mode'; mode: 'ground' | 'flying' | 'gengar' }
  | { offset: number; type: 'flyingObstacles'; lanes: Lane[]; speedOffset?: number }
  | { offset: number; type: 'powerUp'; lane: Lane }
  | { offset: number; type: 'speed'; multiplier: number };

const LEVEL_SCRIPT: LevelEvent[] = [
  { offset: 140, type: 'groundSpikes', count: 1 },
  { offset: 160, type: 'groundSpikes', count: 2, spacing: 36 },
  { offset: 200, type: 'groundSpikes', count: 3, spacing: 42 },
  { offset: 160, type: 'powerUp', lane: 'mid' },
  { offset: 200, type: 'groundSpikes', count: 4, spacing: 36 },
  { offset: 240, type: 'ceilingSpikes', count: 2, spacing: 80 },
  { offset: 260, type: 'mode', mode: 'flying' },
  { offset: 140, type: 'flyingObstacles', lanes: ['low', 'mid'] },
  { offset: 160, type: 'flyingObstacles', lanes: ['mid', 'high'], speedOffset: 0.8 },
  { offset: 200, type: 'powerUp', lane: 'high' },
  { offset: 220, type: 'flyingObstacles', lanes: ['low', 'mid', 'high'] },
  { offset: 240, type: 'mode', mode: 'ground' },
  { offset: 180, type: 'groundSpikes', count: 2, spacing: 70 },
  { offset: 200, type: 'mode', mode: 'gengar' },
  { offset: 160, type: 'ceilingSpikes', count: 3, spacing: 50 },
  { offset: 200, type: 'powerUp', lane: 'mid' },
  { offset: 220, type: 'mode', mode: 'ground' },
  { offset: 240, type: 'groundSpikes', count: 4, spacing: 38 },
  { offset: 260, type: 'speed', multiplier: 1.1 },
  { offset: 220, type: 'groundSpikes', count: 3, spacing: 44 },
  { offset: 280, type: 'ceilingSpikes', count: 2, spacing: 90 },
  { offset: 320, type: 'mode', mode: 'flying' },
  { offset: 160, type: 'flyingObstacles', lanes: ['low', 'mid'] },
  { offset: 160, type: 'flyingObstacles', lanes: ['mid'], speedOffset: 1.2 },
  { offset: 200, type: 'mode', mode: 'ground' },
  { offset: 300, type: 'speed', multiplier: 1.15 },
  { offset: 260, type: 'powerUp', lane: 'ground' },
  { offset: 320, type: 'groundSpikes', count: 5, spacing: 34 },
  { offset: 340, type: 'ceilingSpikes', count: 3, spacing: 60 },
  { offset: 420, type: 'mode', mode: 'ground' }
];

const TOTAL_LEVEL_DISTANCE = LEVEL_SCRIPT.reduce((sum, event) => sum + event.offset, 0);

export const PikachuGame = () => {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameOver' | 'nameInput'>('menu');
  const [score, setScore] = useState(0);
  const [topScores, setTopScores] = useState<HighScore[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [gameWidth, setGameWidth] = useState(() => getGameDimensions().width);
  const [gameHeight, setGameHeight] = useState(() => getGameDimensions().height);
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [isLoadingScores, setIsLoadingScores] = useState(true);
  
  const [player, setPlayer] = useState<GameObject>({
    x: 100,
    y: GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE
  });
  
  const [spikes, setSpikes] = useState<Spike[]>([]);
  const [flyingObstacles, setFlyingObstacles] = useState<FlyingObstacle[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpVelocity, setJumpVelocity] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(GAME_SPEED);
  const [keys, setKeys] = useState<{[key: string]: boolean}>({});
  const [isFlying, setIsFlying] = useState(false);
  const [flyingY, setFlyingY] = useState(0);
  const [isGengar, setIsGengar] = useState(false);
  const [gravityUp, setGravityUp] = useState(false);
  const [activePowerUp, setActivePowerUp] = useState<{ type: 'shield'; expiresAt: number } | null>(null);
  const [isInvincible, setIsInvincible] = useState(false);
  const [shieldTimeLeft, setShieldTimeLeft] = useState(0);
  const [levelLoop, setLevelLoop] = useState(1);
  const [loopProgress, setLoopProgress] = useState(0);

  const gameLoopRef = useRef<number>();
  const spikeIdCounter = useRef(0);
  const flyingObstacleIdCounter = useRef(0);
  const powerUpIdCounter = useRef(0);
  const levelDistanceRef = useRef(0);
  const totalRunDistanceRef = useRef(0);
  const levelLoopRef = useRef(1);
  const nextEventIndexRef = useRef(0);
  const eventCountdownRef = useRef(LEVEL_SCRIPT[0]?.offset ?? Infinity);

  const groundY = gameHeight - GROUND_HEIGHT;

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const dimensions = getGameDimensions();
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      setGameWidth(dimensions.width);
      setGameHeight(dimensions.height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const minSwipeDistance = 30;

    // Detect tap (short swipe distance)
    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
      jump();
    } else if (isFlying && Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY < -minSwipeDistance) {
        setKeys(prev => ({ ...prev, ArrowUp: true }));
        setTimeout(() => setKeys(prev => ({ ...prev, ArrowUp: false })), 150);
      } else if (deltaY > minSwipeDistance) {
        setKeys(prev => ({ ...prev, ArrowDown: true }));
        setTimeout(() => setKeys(prev => ({ ...prev, ArrowDown: false })), 150);
      }
    }

    setTouchStart(null);
  };

  const resetGame = useCallback(() => {
    setPlayer({
      x: 90,
      y: groundY - PLAYER_SIZE,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE
    });
    setSpikes([]);
    setFlyingObstacles([]);
    setPowerUps([]);
    setScore(0);
    setIsJumping(false);
    setJumpVelocity(0);
    setCurrentSpeed(GAME_SPEED);
    setIsFlying(false);
    setFlyingY(0);
    setIsGengar(false);
    setGravityUp(false);
    spikeIdCounter.current = 0;
    flyingObstacleIdCounter.current = 0;
    powerUpIdCounter.current = 0;
    setActivePowerUp(null);
    setIsInvincible(false);
    levelDistanceRef.current = 0;
    totalRunDistanceRef.current = 0;
    levelLoopRef.current = 1;
    nextEventIndexRef.current = 0;
    eventCountdownRef.current = LEVEL_SCRIPT[0]?.offset ?? Infinity;
    setLevelLoop(1);
    setLoopProgress(0);
  }, [groundY]);

  const startGame = () => {
    resetGame();
    setGameState('playing');
  };

  // Load high scores from Supabase on component mount
  useEffect(() => {
    const loadScores = async () => {
      setIsLoadingScores(true);
      const scores = await getTopScores();
      setTopScores(scores);
      setIsLoadingScores(false);
    };
    loadScores();
  }, []);

  const resetHighScore = async () => {
    setTopScores([]);
    await clearHighScores();
  };

  const isTopScore = useCallback((currentScore: number) => {
    return topScores.length < 3 || currentScore > topScores[topScores.length - 1].score;
  }, [topScores]);

  const addTopScoreToSupabase = async (name: string, score: number) => {
    await addHighScore(name.trim(), score);
    // Refresh scores after adding
    const updatedScores = await getTopScores();
    setTopScores(updatedScores);
  };

  const handleNameSubmit = async () => {
    if (playerName.trim()) {
      await addTopScoreToSupabase(playerName.trim(), score);
      setPlayerName('');
      setGameState('gameOver');
    }
  };

  const jump = useCallback(() => {
    if (gameState === 'playing') {
      if (isGengar) {
        // In Gengar mode, clicking switches gravity
        setGravityUp(prev => !prev);
      } else if (isFlying) {
        // In flying mode, allow gravity switching
        setGravityUp(prev => !prev);
      } else if (!isJumping) {
        // Normal jump mode
        setIsJumping(true);
        setJumpVelocity(-15);
      } else {
        // Allow gravity switching while jumping
        setJumpVelocity(prev => prev > 0 ? -15 : prev);
      }
    }
  }, [isJumping, gameState, isFlying, isGengar]);

  const activatePowerUp = useCallback(() => {
    setActivePowerUp({ type: 'shield', expiresAt: Date.now() + POWER_UP_DURATION });
    setIsInvincible(true);
    setShieldTimeLeft(POWER_UP_DURATION);
    setSpikes([]);
    setFlyingObstacles([]);
  }, []);

  const checkCollision = (rect1: GameObject, rect2: GameObject) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  const applyMode = useCallback((mode: 'ground' | 'flying' | 'gengar') => {
    if (mode === 'flying') {
      setIsFlying(true);
      setIsGengar(false);
      setGravityUp(false);
      const launchHeight = Math.max(80, groundY - 150);
      setFlyingY(launchHeight);
      setPlayer(prev => ({
        ...prev,
        y: launchHeight,
        width: CHARIZARD_SIZE,
        height: CHARIZARD_SIZE
      }));
    } else if (mode === 'gengar') {
      setIsGengar(true);
      setIsFlying(false);
      setGravityUp(false);
      setFlyingY(0);
      setPlayer(prev => ({
        ...prev,
        y: groundY - (PLAYER_SIZE - 14),
        width: PLAYER_SIZE - 14,
        height: PLAYER_SIZE - 14
      }));
    } else {
      setIsFlying(false);
      setIsGengar(false);
      setGravityUp(false);
      setFlyingY(0);
      setPlayer(prev => ({
        ...prev,
        y: groundY - PLAYER_SIZE,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE
      }));
    }
  }, [groundY]);

  const runLevelEvent = useCallback((event: LevelEvent) => {
    switch (event.type) {
      case 'groundSpikes': {
        const spacing = event.spacing ?? SPIKE_WIDTH + 12;
        const startOffset = event.startOffset ?? 0;
        const spikesToAdd: Spike[] = Array.from({ length: event.count }).map((_, index) => ({
          id: spikeIdCounter.current++,
          x: gameWidth + startOffset + index * spacing,
          y: groundY - SPIKE_HEIGHT,
          width: SPIKE_WIDTH,
          height: SPIKE_HEIGHT
        }));
        if (spikesToAdd.length) {
          setSpikes(prev => [...prev, ...spikesToAdd]);
        }
        break;
      }
      case 'ceilingSpikes': {
        const spacing = event.spacing ?? SPIKE_WIDTH + 24;
        const spikesToAdd: Spike[] = Array.from({ length: event.count }).map((_, index) => ({
          id: spikeIdCounter.current++,
          x: gameWidth + index * spacing,
          y: 0,
          width: SPIKE_WIDTH,
          height: SPIKE_HEIGHT + 12
        }));
        if (spikesToAdd.length) {
          setSpikes(prev => [...prev, ...spikesToAdd]);
        }
        break;
      }
      case 'mode': {
        applyMode(event.mode);
        break;
      }
      case 'flyingObstacles': {
        if (!event.lanes.length) break;
        const spacing = 70;
        const obstacles: FlyingObstacle[] = event.lanes.map((lane, index) => {
          let rawY: number;
          switch (lane) {
            case 'low':
              rawY = groundY - FLYING_OBSTACLE_SIZE - 48;
              break;
            case 'mid':
              rawY = Math.max(groundY - 170, 140);
              break;
            case 'high':
              rawY = 90;
              break;
            case 'ceiling':
              rawY = 50;
              break;
            case 'ground':
            default:
              rawY = groundY - FLYING_OBSTACLE_SIZE - 20;
          }
          const clampedY = Math.max(50, Math.min(rawY, groundY - FLYING_OBSTACLE_SIZE - 10));
          return {
            id: flyingObstacleIdCounter.current++,
            x: gameWidth + index * spacing,
            y: clampedY,
            width: FLYING_OBSTACLE_SIZE,
            height: FLYING_OBSTACLE_SIZE,
            speed: currentSpeed + (event.speedOffset ?? 0) + (levelLoopRef.current - 1) * 0.25
          };
        });
        if (obstacles.length) {
          setFlyingObstacles(prev => [...prev, ...obstacles]);
        }
        break;
      }
      case 'powerUp': {
        let spawnY: number;
        switch (event.lane) {
          case 'high':
            spawnY = 90;
            break;
          case 'mid':
            spawnY = Math.max(groundY - 160, 130);
            break;
          case 'low':
            spawnY = Math.max(groundY - 110, 110);
            break;
          case 'ceiling':
            spawnY = 60;
            break;
          case 'ground':
          default:
            spawnY = groundY - POWER_UP_SIZE - 12;
        }
        const powerUp: PowerUp = {
          id: powerUpIdCounter.current++,
          x: gameWidth + 40,
          y: spawnY,
          width: POWER_UP_SIZE,
          height: POWER_UP_SIZE,
          type: 'shield'
        };
        setPowerUps(prev => [...prev, powerUp]);
        break;
      }
      case 'speed': {
        setCurrentSpeed(prev => {
          const boosted = prev * event.multiplier;
          const loopBonus = (levelLoopRef.current - 1) * 0.2;
          return Math.min(boosted + loopBonus, GAME_SPEED + 4 + levelLoopRef.current * 0.8);
        });
        break;
      }
      default:
        break;
    }
  }, [applyMode, currentSpeed, gameWidth, groundY]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      let updatedPlayer = player;

      setPlayer(prevPlayer => {
        let newY = prevPlayer.y;
        let newX = prevPlayer.x;
        let newJumpVelocity = jumpVelocity;

        const anchorX = isFlying ? 120 : 90;
        newX = newX + (anchorX - newX) * 0.15;

        if (isFlying) {
          // Flying mode controls
          if (keys['ArrowUp'] || keys['KeyW']) {
            newY = Math.max(50, newY - 4);
          }
          if (keys['ArrowDown'] || keys['KeyS']) {
            newY = Math.min(groundY - CHARIZARD_SIZE, newY + 4);
          }
          setFlyingY(newY);
        } else if (isGengar) {
          // Gengar mode - moves between ground and ceiling with gravity switching
          if (gravityUp) {
            newY = Math.max(newY - 4, 50); // Move up faster to ceiling
          } else {
            newY = Math.min(newY + 4, groundY - (PLAYER_SIZE - 14)); // Move down faster to ground
          }
        } else if (isJumping) {
          newY += newJumpVelocity;
          newJumpVelocity += 0.5; // gravity

          if (newY >= groundY - PLAYER_SIZE) {
            newY = groundY - PLAYER_SIZE;
            setIsJumping(false);
            setJumpVelocity(0);
          } else {
            setJumpVelocity(newJumpVelocity);
          }
        }

        const nextPlayer = { ...prevPlayer, y: newY, x: newX };
        updatedPlayer = nextPlayer;
        return nextPlayer;
      });

      // Move spikes and check collisions
      setSpikes(prevSpikes => {
        const newSpikes = prevSpikes
          .map(spike => ({ ...spike, x: spike.x - currentSpeed }))
          .filter(spike => spike.x + spike.width > 0);

        // Check collisions with player
        const collision = !isInvincible && newSpikes.some(spike => checkCollision(updatedPlayer, spike));
        if (collision) {
          if (isTopScore(score)) {
            setGameState('nameInput');
          } else {
            setGameState('gameOver');
          }
        }

        return newSpikes;
      });

      // Move flying obstacles and check collisions
      setFlyingObstacles(prevObstacles => {
        const newObstacles = prevObstacles
          .map(obstacle => ({ ...obstacle, x: obstacle.x - obstacle.speed }))
          .filter(obstacle => obstacle.x + obstacle.width > 0);

        // Check collisions with player
        const collision = !isInvincible && newObstacles.some(obstacle => checkCollision(updatedPlayer, obstacle));
        if (collision) {
          if (isTopScore(score)) {
            setGameState('nameInput');
          } else {
            setGameState('gameOver');
          }
        }

        return newObstacles;
      });

      setPowerUps(prevPowerUps => {
        const movedPowerUps = prevPowerUps
          .map(powerUp => ({ ...powerUp, x: powerUp.x - currentSpeed }))
          .filter(powerUp => powerUp.x + powerUp.width > 0);

        let collected = false;
        const remaining = movedPowerUps.filter(powerUp => {
          const collision = checkCollision(updatedPlayer, powerUp);
          if (collision) {
            collected = true;
            return false;
          }
          return true;
        });

        if (collected) {
          activatePowerUp();
        }

        return remaining;
      });

      levelDistanceRef.current += currentSpeed;
      totalRunDistanceRef.current += currentSpeed;
      eventCountdownRef.current -= currentSpeed;

      if (TOTAL_LEVEL_DISTANCE > 0) {
        const progress = levelDistanceRef.current % TOTAL_LEVEL_DISTANCE;
        if (Math.abs(progress - loopProgress) > 0.5) {
          setLoopProgress(progress);
        }
      }

      while (eventCountdownRef.current <= 0 && LEVEL_SCRIPT.length > 0) {
        const event = LEVEL_SCRIPT[nextEventIndexRef.current];
        runLevelEvent(event);
        nextEventIndexRef.current += 1;

        if (nextEventIndexRef.current >= LEVEL_SCRIPT.length) {
          nextEventIndexRef.current = 0;
          levelLoopRef.current += 1;
          setLevelLoop(levelLoopRef.current);
          if (TOTAL_LEVEL_DISTANCE > 0) {
            levelDistanceRef.current = levelDistanceRef.current % TOTAL_LEVEL_DISTANCE;
            setLoopProgress(levelDistanceRef.current);
          }
          setCurrentSpeed(prev => Math.min(prev + 0.2, GAME_SPEED + 3 + levelLoopRef.current * 0.6));
          eventCountdownRef.current += LEVEL_SCRIPT[0]?.offset ?? Infinity;
        } else {
          eventCountdownRef.current += LEVEL_SCRIPT[nextEventIndexRef.current].offset;
        }
      }

      // Increase speed over time toward the current loop cap
      setCurrentSpeed(prevSpeed => {
        const cap = GAME_SPEED + 2 + (levelLoopRef.current - 1) * 0.5;
        const next = prevSpeed + 0.0015;
        return next > cap ? cap : next;
      });

      const nextScore = Math.floor(totalRunDistanceRef.current / 5);
      setScore(prevScore => (nextScore > prevScore ? nextScore : prevScore));

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, isJumping, jumpVelocity, player, score, groundY, currentSpeed, flyingObstacles, keys, isFlying, isGengar, gravityUp, isInvincible, activePowerUp, activatePowerUp, flyingY, gameWidth, runLevelEvent, loopProgress, isTopScore]);

  useEffect(() => {
    if (!activePowerUp) {
      setIsInvincible(false);
      setShieldTimeLeft(0);
      return;
    }

    setIsInvincible(true);

    const updateShieldTime = () => {
      setShieldTimeLeft(Math.max(activePowerUp.expiresAt - Date.now(), 0));
    };

    updateShieldTime();

    const interval = window.setInterval(updateShieldTime, 100);
    const timeout = window.setTimeout(() => {
      setActivePowerUp(null);
      setIsInvincible(false);
      setShieldTimeLeft(0);
    }, Math.max(activePowerUp.expiresAt - Date.now(), 0));

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [activePowerUp]);

  const shieldSecondsRemaining = Math.max(Math.ceil(shieldTimeLeft / 1000), 0);
  const progressPercent = TOTAL_LEVEL_DISTANCE > 0 ? Math.min(100, Math.floor((loopProgress / TOTAL_LEVEL_DISTANCE) * 100)) : 0;
  const speedDisplay = currentSpeed.toFixed(1);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
        return;
      }
      
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
      if (gameState === 'playing') {
        setKeys(prev => ({ ...prev, [e.code]: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => ({ ...prev, [e.code]: false }));
    };

    const handleClick = () => {
      jump();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('click', handleClick);
    };
  }, [jump, gameState]);

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-electric bg-grid">
        <div className="text-center space-y-8">
          <h1 className="game-title">PIKACHU DASH</h1>
          <div className="text-cyber text-lg">Avoid the spikes and flying obstacles!</div>
          <div className="space-y-4">
            <Button
              onClick={startGame}
              className="bg-neon-green text-black border-neon font-bold px-8 py-4 text-lg hover:bg-neon-green/80"
            >
              START GAME
            </Button>
            <div className="text-muted-foreground">
              <div className="text-sm mt-2">Press SPACE or tap to stay on beat—Pikachu dashes automatically.</div>
              <div className="text-xs mt-1 text-neon-cyan">Ride the rockets, steer flight tunnels, and flip gravity like Geometry Dash.</div>
              <div className="text-xs mt-1 text-destructive">Memorise the pattern—one crash resets the whole loop.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen ${isFlying ? 'bg-fire bg-fire-grid' : 'bg-electric bg-grid'}`}>
      {/* Top 3 High Scores - Responsive positioning */}
      <div className={`absolute top-4 right-4 bg-black/80 rounded-lg border-2 border-neon-cyan shadow-lg ${isMobile ? 'p-2 text-xs' : 'p-4'}`}>
        <div className={`text-center text-cyber font-bold mb-2 ${isMobile ? 'text-sm' : 'text-lg mb-3'}`}>TOP 3 🏆</div>
        {isLoadingScores ? (
          <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>Loading...</div>
        ) : topScores.length > 0 ? (
          topScores.map((entry, index) => (
            <div key={index} className={`flex justify-between items-center mb-1 ${isMobile ? 'text-xs min-w-[120px]' : 'text-sm mb-2 min-w-[150px]'}`}>
              <span className="text-neon-green font-bold">{index + 1}. {entry.name}</span>
              <span className={`text-cyber ${isMobile ? 'ml-2' : 'ml-3'}`}>{entry.score}</span>
            </div>
          ))
        ) : (
          <div className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>No scores yet</div>
        )}
      </div>

      <div className={`mb-4 flex flex-wrap items-stretch justify-center gap-4 text-center ${isMobile ? 'max-w-sm' : ''}`}>
        <div className="text-cyber bg-black/40 border border-neon/40 rounded-lg px-4 py-3 min-w-[140px]">
          <div className="text-2xl font-bold">{score}</div>
          <div className="text-xs tracking-[0.3em] text-muted-foreground">SCORE</div>
          {isFlying && <div className="mt-1 text-xs text-neon animate-pulse">FLYING SECTION</div>}
          {isGengar && <div className="mt-1 text-xs text-destructive animate-pulse">GRAVITY FLIP</div>}
          {activePowerUp && (
            <div className="mt-1 text-xs text-neon-cyan animate-pulse">
              SHIELD {shieldSecondsRemaining > 0 ? `${shieldSecondsRemaining}s` : 'ACTIVE'}
            </div>
          )}
        </div>
        <div className="text-cyber bg-black/40 border border-neon/40 rounded-lg px-4 py-3 min-w-[140px]">
          <div className="text-2xl font-bold">Loop {levelLoop}</div>
          <div className="text-xs tracking-[0.3em] text-muted-foreground">INTENSITY</div>
          <div className="mt-1 text-xs text-neon">Tempo {speedDisplay}×</div>
        </div>
        <div className="text-cyber bg-black/40 border border-neon/40 rounded-lg px-4 py-3 min-w-[140px]">
          <div className="text-2xl font-bold">{progressPercent}%</div>
          <div className="text-xs tracking-[0.3em] text-muted-foreground">PROGRESS</div>
          <div className="mt-2 h-2 w-32 max-w-full overflow-hidden rounded-full border border-neon/40 bg-black/60">
            <div
              className="h-full bg-neon-green transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      
      <div 
        className="relative overflow-hidden" 
        style={{ width: gameWidth, height: gameHeight }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile Pause Button */}
        {isMobile && (gameState === 'playing' || gameState === 'paused') && (
          <Button
            onClick={() => setGameState(gameState === 'playing' ? 'paused' : 'playing')}
            className="absolute top-2 right-2 z-10 bg-neon/20 border border-neon text-cyber px-3 py-1 text-sm hover:bg-neon/30"
          >
            {gameState === 'playing' ? '⏸️' : '▶️'}
          </Button>
        )}
        
        {/* Ground */}
        <div 
          className="absolute bottom-0 w-full bg-neon-green/20 border-t border-neon-green"
          style={{ height: GROUND_HEIGHT }}
        />
        
        {/* Player (Pikachu or Charizard) */}
        <div
          className={`absolute transition-none bg-transparent ${isJumping ? 'animate-float' : ''} ${isFlying ? 'animate-bounce' : ''}`}
          style={{
            left: player.x,
            bottom: gameHeight - player.y - player.height,
            width: player.width,
            height: player.height,
          }}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {activePowerUp && (
              <>
                <div className="absolute inset-[-10px] rounded-full border-2 border-neon-cyan/60 animate-pulse" />
                <div className="absolute inset-[-18px] rounded-full border border-neon-cyan/30 animate-ping" />
              </>
            )}
            {isFlying ? (
              <div className="relative">
                <img
                  src={charizardSprite}
                  alt="Charizard"
                  className="w-full h-full object-contain animate-pulse-neon bg-transparent"
                />
                <img
                  src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
                  alt="Pikachu"
                  className="absolute top-2 left-1/2 transform -translate-x-1/2 w-6 h-6 object-contain"
                />
              </div>
            ) : isGengar ? (
              <img
                src={gengarSprite}
                alt="Gengar"
                className="w-full h-full object-contain animate-pulse-neon bg-transparent"
              />
            ) : (
              <img
                src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
                alt="Pikachu"
                className="w-full h-full object-contain animate-pulse-neon bg-transparent"
              />
            )}
          </div>
        </div>

        {/* Spikes */}
        {spikes.map(spike => (
          <div
            key={spike.id}
            className="absolute bg-destructive"
            style={{
              left: spike.x,
              bottom: gameHeight - spike.y - spike.height,
              width: spike.width,
              height: spike.height,
              clipPath: spike.y === 0 ? 'polygon(50% 100%, 0% 0%, 100% 0%)' : 'polygon(50% 0%, 0% 100%, 100% 100%)',
            }}
          />
        ))}

        {/* Flying Obstacles */}
        {flyingObstacles.map(obstacle => (
          <div
            key={obstacle.id}
            className="absolute"
            style={{
              left: obstacle.x,
              bottom: gameHeight - obstacle.y - obstacle.height,
              width: obstacle.width,
              height: obstacle.height,
            }}
          >
            <img
              src={gengarSprite}
              alt="Gengar"
              className="w-full h-full object-contain animate-pulse bg-transparent"
            />
          </div>
        ))}

        {/* Power Ups */}
        {powerUps.map(powerUp => (
          <div
            key={powerUp.id}
            className="absolute flex items-center justify-center rounded-full border-2 border-neon-cyan bg-neon-cyan/20 shadow-lg"
            style={{
              left: powerUp.x,
              bottom: gameHeight - powerUp.y - powerUp.height,
              width: powerUp.width,
              height: powerUp.height,
            }}
          >
            <span className="text-neon-cyan text-lg font-black">⚡</span>
          </div>
        ))}

        {gameState === 'nameInput' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center space-y-4 bg-card p-6 rounded border border-neon-cyan">
              <h2 className="text-neon text-2xl font-bold">TOP 3 SCORE!</h2>
              <div className="text-cyber text-lg">Score: {score}</div>
              <div className="text-muted-foreground">Enter your name (max 10 letters):</div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                maxLength={10}
                className="bg-input text-foreground px-3 py-2 rounded border border-border text-center uppercase"
                placeholder="YOUR NAME"
                autoFocus
              />
              <Button 
                onClick={handleNameSubmit}
                disabled={!playerName.trim()}
                className="bg-neon-green text-black border-neon font-bold px-6 py-3 hover:bg-neon-green/80"
              >
                SAVE SCORE
              </Button>
            </div>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h2 className="text-neon text-3xl font-bold">PAUSED</h2>
              <div className="text-cyber text-lg">Score: {score}</div>
              <Button 
                onClick={() => setGameState('playing')}
                className="bg-neon-green text-black border-neon font-bold px-6 py-3 hover:bg-neon-green/80"
              >
                RESUME
              </Button>
              <div className="text-muted-foreground text-sm">Press ESC to resume</div>
            </div>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h2 className="text-destructive text-3xl font-bold">GAME OVER</h2>
              <div className="text-cyber text-xl">Final Score: {score}</div>
              <div className="flex gap-4 justify-center">
                <Button 
                  onClick={startGame}
                  className="bg-neon-green text-black border-neon font-bold px-6 py-3 hover:bg-neon-green/80"
                >
                  PLAY AGAIN
                </Button>
                <Button 
                  onClick={resetHighScore}
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-white px-4 py-3"
                >
                  RESET SCORES
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-muted-foreground text-center">
        <div>
          {isMobile
            ? isGengar
              ? 'Tap anywhere to flip gravity between floor and ceiling.'
              : isFlying
                ? 'Tap to boost forward and swipe up or down to steer the jet run.'
                : 'Tap anywhere to jump—Pikachu dashes on its own.'
            : isGengar
              ? 'Press SPACE or click to flip gravity—ride the ceiling like Geometry Dash.'
              : isFlying
                ? 'Hold SPACE to soar and use ↑/↓ to thread the flight tunnels.'
                : 'Press SPACE or click anywhere to jump—keep the rhythm alive.'}
        </div>
        <div className="text-xs text-neon-cyan mt-2">
          Collect ⚡ orbs to trigger a screen-clearing shield—perfect for memorising tough patterns.
        </div>
      </div>

      {/* Mobile Control Buttons */}
      {isMobile && gameState === 'playing' && (
        <div className="mt-4 flex flex-col items-center gap-3">
          {isFlying && (
            <div className="flex gap-4">
              <Button
                onTouchStart={() => setKeys(prev => ({ ...prev, ArrowUp: true }))}
                onTouchEnd={() => setKeys(prev => ({ ...prev, ArrowUp: false }))}
                className="bg-neon/20 border border-neon text-cyber px-4 py-2 text-sm"
              >
                ↑
              </Button>
              <Button
                onTouchStart={() => setKeys(prev => ({ ...prev, ArrowDown: true }))}
                onTouchEnd={() => setKeys(prev => ({ ...prev, ArrowDown: false }))}
                className="bg-neon/20 border border-neon text-cyber px-4 py-2 text-sm"
              >
                ↓
              </Button>
            </div>
          )}
          <Button
            onTouchStart={jump}
            className="bg-neon-green text-black border-neon font-bold px-8 py-2 text-sm"
          >
            JUMP
          </Button>
        </div>
      )}
    </div>
  );
};
