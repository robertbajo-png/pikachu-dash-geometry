import { useState, useEffect, useCallback, useRef } from "react";
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
 codex/continue-coding-pikachu-dash-0g4c6g
const JUMP_HEIGHT = 120;
const GAME_SPEED = 2.2;
 codex/continue-coding-pikachu-dash-27rucm
const FLYING_OBSTACLE_SIZE = 35;
const FLYING_MODE_THRESHOLD = 1500;
const GENGAR_MODE_THRESHOLD = 6000;
=======
 codex/continue-coding-pikachu-dash-hwbk3v
const FLYING_OBSTACLE_SIZE = 35;
const FLYING_MODE_THRESHOLD = 1500;
const GENGAR_MODE_THRESHOLD = 6000;
=======
const FLYING_OBSTACLE_SIZE = 35;
const FLYING_MODE_THRESHOLD = 1500;
const GENGAR_MODE_THRESHOLD = 6000;
=======
const GAME_SPEED = 2.5;
const FLYING_OBSTACLE_SIZE = 35;
 main
main
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
    const deltaY = touch.clientY - touchStart.y;
    const minSwipeDistance = 30;

    // Detect tap (short swipe distance)
    if (Math.abs(deltaY) < minSwipeDistance) {
      jump();
 codex/continue-coding-pikachu-dash-27rucm
    } else if (isFlying) {
=======
codex/continue-coding-pikachu-dash-hwbk3v
    } else if (isFlying) {
=======
 codex/continue-coding-pikachu-dash-0g4c6g
    } else if (isFlying) {
=======
    } else if (isFlying && Math.abs(deltaY) > Math.abs(deltaX)) {
 main
 main
 main
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
 codex/continue-coding-pikachu-dash-27rucm
      x: 80,
=======
 codex/continue-coding-pikachu-dash-hwbk3v
      x: 80,
=======
 codex/continue-coding-pikachu-dash-0g4c6g
      x: 80,
=======
      x: 90,
 main
 main
 main
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
        const maxX = gameWidth - (isFlying ? CHARIZARD_SIZE : isGengar ? PLAYER_SIZE - 14 : PLAYER_SIZE);
        const targetX = isFlying ? 120 : isGengar ? 90 : 80;
        const newX = Math.min(Math.max(40, targetX), Math.max(40, maxX));
        let newJumpVelocity = jumpVelocity;

 codex/continue-coding-pikachu-dash-27rucm
=======
 codex/continue-coding-pikachu-dash-hwbk3v
=======
 codex/continue-coding-pikachu-dash-0g4c6g
=======
        const anchorX = isFlying ? 120 : 90;
        newX = newX + (anchorX - newX) * 0.15;

 main
 main
 main
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

 codex/continue-coding-pikachu-dash-0g4c6g
      // Add new spikes (more frequent in flying mode)
      setSpikes(prevSpikes => {
        const lastSpike = prevSpikes[prevSpikes.length - 1];
        const spikeDistance = isFlying ? 320 : 480;
        
        // Check grace periods
        const isInFlyingGracePeriod = flyingModeChangedAt && (Date.now() - flyingModeChangedAt) < 3000 && isFlying;
        const isInGengarGracePeriod = gengarModeChangedAt && (Date.now() - gengarModeChangedAt) < 6000 && isGengar;
        
        if (!isInFlyingGracePeriod && !isInGengarGracePeriod && (!lastSpike || lastSpike.x < gameWidth - spikeDistance)) {
          const spikes = [];
          
          // Ground spikes
          spikes.push({
            id: spikeIdCounter.current++,
            x: gameWidth,
            y: groundY - SPIKE_HEIGHT,
            width: SPIKE_WIDTH,
            height: SPIKE_HEIGHT
          });
          
          // In flying mode, add ceiling spikes
          if (isFlying && Math.random() < 0.45) {
            spikes.push({
              id: spikeIdCounter.current++,
              x: gameWidth + (Math.random() * 100),
              y: 0,
              width: SPIKE_WIDTH,
              height: SPIKE_HEIGHT * 2
            });
=======
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
 main
          }
          return true;
        });

        if (collected) {
          activatePowerUp();
        }

        return remaining;
      });
 codex/continue-coding-pikachu-dash-0g4c6g
      // Add new flying obstacles (more in flying mode and even more in Gengar mode)
      setFlyingObstacles(prevObstacles => {
        const lastObstacle = prevObstacles[prevObstacles.length - 1];
        const obstacleDistance = isGengar ? 240 : (isFlying ? 360 : 520);
        
        // Check grace periods
        const isInFlyingGracePeriod = flyingModeChangedAt && (Date.now() - flyingModeChangedAt) < 3000 && isFlying;
        const isInGengarGracePeriod = gengarModeChangedAt && (Date.now() - gengarModeChangedAt) < 6000 && isGengar;
        
        if (!isInFlyingGracePeriod && !isInGengarGracePeriod && (!lastObstacle || lastObstacle.x < gameWidth - obstacleDistance)) {
          const obstacles = [];
          
          if (isGengar) {
            // Gengar mode - many obstacles at different heights
            const heights = [80, 140, 200, 260, groundY - 80, groundY - 140];
            const numObstacles = Math.random() < 0.6 ? 2 : 1;
            
            for (let i = 0; i < numObstacles; i++) {
              const randomHeight = heights[Math.floor(Math.random() * heights.length)];
              obstacles.push({
                id: flyingObstacleIdCounter.current++,
                x: gameWidth + (i * 60),
                y: randomHeight,
                width: FLYING_OBSTACLE_SIZE - 10,
                height: FLYING_OBSTACLE_SIZE - 10,
                speed: currentSpeed + Math.random() * 2.5
              });
            }
          } else if (isFlying) {
            // Multiple height levels in flying mode
            const heights = [80, 160, groundY - 100, groundY - 150];
            const numObstacles = Math.random() < 0.5 ? 2 : 1;
            
            for (let i = 0; i < numObstacles; i++) {
              const randomHeight = heights[Math.floor(Math.random() * heights.length)];
              obstacles.push({
                id: flyingObstacleIdCounter.current++,
                x: gameWidth + (i * 80),
                y: randomHeight,
                width: FLYING_OBSTACLE_SIZE,
                height: FLYING_OBSTACLE_SIZE,
                speed: currentSpeed + Math.random() * 2
              });
            }
          } else {
            const heights = [groundY - 80, groundY - 120, groundY - 160];
            const randomHeight = heights[Math.floor(Math.random() * heights.length)];
            obstacles.push({
              id: flyingObstacleIdCounter.current++,
              x: gameWidth,
              y: randomHeight,
              width: FLYING_OBSTACLE_SIZE,
              height: FLYING_OBSTACLE_SIZE,
              speed: currentSpeed + Math.random() * 1.5
            });
=======
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
 main
          }
          setCurrentSpeed(prev => Math.min(prev + 0.2, GAME_SPEED + 3 + levelLoopRef.current * 0.6));
          eventCountdownRef.current += LEVEL_SCRIPT[0]?.offset ?? Infinity;
        } else {
          eventCountdownRef.current += LEVEL_SCRIPT[nextEventIndexRef.current].offset;
        }
      }

 codex/continue-coding-pikachu-dash-0g4c6g
      // Increase speed over time
      setCurrentSpeed(prevSpeed => Math.min(prevSpeed + 0.0006, 4.2));

      // Update score (pause during grace periods)
      const isInFlyingGracePeriod = flyingModeChangedAt && (Date.now() - flyingModeChangedAt) < 3000 && isFlying;
      const isInGengarGracePeriod = gengarModeChangedAt && (Date.now() - gengarModeChangedAt) < 6000 && isGengar;
      if (!isInFlyingGracePeriod && !isInGengarGracePeriod) {
        setScore(prevScore => prevScore + 3);
      }
=======
      // Increase speed over time toward the current loop cap
      setCurrentSpeed(prevSpeed => {
        const cap = GAME_SPEED + 2 + (levelLoopRef.current - 1) * 0.5;
        const next = prevSpeed + 0.0015;
        return next > cap ? cap : next;
      });

      const nextScore = Math.floor(totalRunDistanceRef.current / 5);
      setScore(prevScore => (nextScore > prevScore ? nextScore : prevScore));
 main

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
 codex/continue-coding-pikachu-dash-27rucm
  }, [gameState, isJumping, jumpVelocity, player, score, groundY, currentSpeed, flyingObstacles, keys, isFlying, isGengar, gravityUp, gameWidth, flyingModeChangedAt, gengarModeChangedAt, isTopScore]);
=======
 codex/continue-coding-pikachu-dash-hwbk3v
  }, [gameState, isJumping, jumpVelocity, player, score, groundY, currentSpeed, flyingObstacles, keys, isFlying, isGengar, gravityUp, gameWidth, flyingModeChangedAt, gengarModeChangedAt, isTopScore]);
=======
 codex/continue-coding-pikachu-dash-0g4c6g
  }, [gameState, isJumping, jumpVelocity, player, score, groundY, currentSpeed, flyingObstacles, keys, isFlying, isGengar, gravityUp, gameWidth, flyingModeChangedAt, gengarModeChangedAt, isTopScore]);
=======
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
 main
 main
 main

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
 codex/continue-coding-pikachu-dash-27rucm
      <div className="flex min-h-screen flex-col items-center justify-center bg-hero pattern-grid px-4 py-12">
        <div className="panel-glass max-w-xl rounded-3xl px-10 py-12 text-center shadow-[0_32px_95px_-48px_hsla(230,52%,8%,0.88)]">
          <h1 className="game-title">PIKACHU DASH</h1>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-brand-soft">
            Glide through aurora-lit skylines, time your jumps with measured cadence, and ease into the Geometry Dash rhythm.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Button
              onClick={startGame}
              className="rounded-full bg-primary px-10 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/35 transition hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Begin run
            </Button>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                Press <span className="font-medium text-foreground">SPACE</span> or click to jump.
              </div>
              <div className="text-xs uppercase tracking-[0.32em] text-brand-accent">1500 unlocks flight</div>
              <div className="text-xs uppercase tracking-[0.32em] text-destructive">6000 unlocks Gengar mode</div>
=======
      <div className="flex min-h-screen flex-col items-center justify-center bg-hero pattern-grid px-4 py-10">
        <div className="panel-glass max-w-xl rounded-3xl border border-border px-10 py-12 text-center shadow-2xl shadow-black/40">
          <h1 className="game-title">PIKACHU DASH</h1>
 codex/continue-coding-pikachu-dash-hwbk3v
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-brand-soft">
            Sprint through polished synth cityscapes, vault over spikes, and glide beyond the skyline as the beat builds.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
=======
          <div className="text-cyber text-lg">Auto-run through neon stages, leap the spikes, and glide past the ghosts!</div>
          <div className="space-y-4">
 main
            <Button
              onClick={startGame}
              className="rounded-full bg-primary px-10 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Start run
            </Button>
 codex/continue-coding-pikachu-dash-hwbk3v
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>Press <span className="font-medium text-foreground">SPACE</span> or click to jump.</div>
              <div className="text-xs uppercase tracking-[0.25em] text-brand-accent">Reach 1500 to unlock flight</div>
              <div className="text-xs uppercase tracking-[0.25em] text-destructive">Reach 6000 to enter Gengar mode</div>
=======
            <div className="text-muted-foreground">
 codex/continue-coding-pikachu-dash-0g4c6g
              <div className="text-sm mt-2">Press SPACE or click to jump</div>
              <div className="text-xs mt-1 text-fire">Reach 1500 for FLYING MODE!</div>
              <div className="text-xs mt-1 text-destructive">Reach 6000 for GENGAR MODE!</div>
=======
              <div className="text-sm mt-2">Press SPACE or tap to stay on beat—Pikachu dashes automatically.</div>
              <div className="text-xs mt-1 text-neon-cyan">Ride the rockets, steer flight tunnels, and flip gravity like Geometry Dash.</div>
              <div className="text-xs mt-1 text-destructive">Memorise the pattern—one crash resets the whole loop.</div>
 main
 main
 main
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex min-h-screen flex-col items-center justify-center ${isFlying ? 'bg-hero-alt pattern-grid-soft' : 'bg-hero pattern-grid'}`}>
      {/* Top 3 High Scores - Responsive positioning */}
      <div
 codex/continue-coding-pikachu-dash-27rucm
        className={`absolute right-6 top-6 panel-glass rounded-2xl shadow-[0_22px_70px_-42px_hsla(230,46%,6%,0.85)] backdrop-blur ${isMobile ? 'px-3 py-3 text-xs' : 'px-5 py-4 text-sm'}`}
=======
        className={`absolute right-6 top-6 panel-glass rounded-2xl border border-border shadow-xl shadow-black/40 backdrop-blur ${isMobile ? 'px-3 py-3 text-xs' : 'px-5 py-4 text-sm'}`}
 main
      >
        <div className={`mb-2 text-center text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground ${isMobile ? '' : 'mb-3 text-sm'}`}>
          Top scores
        </div>
        {isLoadingScores ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : topScores.length > 0 ? (
          topScores.map((entry, index) => (
            <div
              key={index}
 codex/continue-coding-pikachu-dash-27rucm
              className={`flex items-center justify-between gap-4 ${isMobile ? 'min-w-[120px]' : 'min-w-[180px]'}`}
            >
              <span
                className={`font-semibold ${index === 0 ? 'text-brand-accent' : index === 1 ? 'text-brand-soft' : 'text-muted-foreground'}`}
              >
                {index + 1}. {entry.name}
              </span>
              <span className="font-semibold text-foreground">{entry.score}</span>
=======
              className={`flex items-center justify-between gap-4 ${isMobile ? 'min-w-[120px]' : 'min-w-[160px]'}`}
            >
              <span className="font-semibold text-brand-soft">{index + 1}. {entry.name}</span>
              <span className="font-semibold text-foreground/90">{entry.score}</span>
 main
            </div>
          ))
        ) : (
          <div className="text-muted-foreground">No scores yet</div>
        )}
      </div>

 codex/continue-coding-pikachu-dash-27rucm
      <div className="mb-6 flex gap-10 text-center text-brand-soft">
        <div>
          <div className="text-3xl font-semibold text-brand-ice">{score}</div>
=======
 codex/continue-coding-pikachu-dash-hwbk3v
      <div className="mb-6 flex gap-10 text-center text-brand-soft">
        <div>
          <div className="text-3xl font-semibold text-foreground">{score}</div>
 main
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">Score</div>
          {isFlying && (
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">
              Flying mode
            </div>
          )}
          {isGengar && (
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
              Gengar mode
            </div>
          )}
codex/continue-coding-pikachu-dash-27rucm
=======
=======
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
 main
 main
        </div>
      </div>
      
      <div
 codex/continue-coding-pikachu-dash-27rucm
        className="panel-glass relative overflow-hidden rounded-[32px] shadow-[0_35px_92px_-50px_hsla(230,50%,7%,0.92)]"
=======
        className="panel-glass relative overflow-hidden rounded-[32px] border border-border shadow-[0_35px_90px_-45px_rgba(6,7,16,0.9)]"
 main
        style={{ width: gameWidth, height: gameHeight }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile Pause Button */}
        {isMobile && (gameState === 'playing' || gameState === 'paused') && (
          <Button
            onClick={() => setGameState(gameState === 'playing' ? 'paused' : 'playing')}
            className="absolute right-4 top-4 z-10 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            {gameState === 'playing' ? '⏸️' : '▶️'}
          </Button>
        )}

        {/* Ground */}
        <div
          className="absolute bottom-0 w-full border-t border-primary/30 bg-primary/10"
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
 codex/continue-coding-pikachu-dash-hwbk3v
          {isFlying ? (
            <div className="relative">
              <img 
                src={charizardSprite}
                alt="Charizard" 
                className="w-full h-full object-contain animate-focus-glow bg-transparent"
 codex/continue-coding-pikachu-dash-27rucm
=======
=======
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
 main
 main
              />
            ) : (
              <img
                src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
                alt="Pikachu"
                className="w-full h-full object-contain animate-pulse-neon bg-transparent"
              />
codex/continue-coding-pikachu-dash-hwbk3v
            </div>
          ) : isGengar ? (
            <img 
              src={gengarSprite}
              alt="Gengar" 
              className="w-full h-full object-contain animate-focus-glow bg-transparent"
            />
          ) : (
            <img 
              src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
              alt="Pikachu" 
              className="w-full h-full object-contain animate-focus-glow bg-transparent"
            />
          )}
=======
            )}
          </div>
 main
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
codex/continue-coding-pikachu-dash-27rucm
            <div className="panel-glass w-full max-w-sm rounded-2xl px-6 py-7 text-center shadow-[0_28px_70px_-40px_hsla(230,52%,8%,0.85)]">
              <h2 className="text-2xl font-semibold text-brand-gold">Top 3 score!</h2>
              <div className="text-brand-ice text-lg">Score: {score}</div>
=======
            <div className="panel-glass w-full max-w-sm rounded-2xl border border-border px-6 py-7 text-center shadow-xl shadow-black/40">
              <h2 className="text-2xl font-semibold text-brand-accent">Top 3 score!</h2>
              <div className="text-brand-soft text-lg">Score: {score}</div>
 main
              <div className="text-sm text-muted-foreground">Enter your name (max 10 letters):</div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                maxLength={10}
                className="w-full rounded-lg border border-border bg-background/70 px-3 py-2 text-center text-base uppercase text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="YOUR NAME"
                autoFocus
              />
              <Button
                onClick={handleNameSubmit}
                disabled={!playerName.trim()}
                className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-50"
              >
                Save score
              </Button>
            </div>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
 codex/continue-coding-pikachu-dash-27rucm
            <div className="panel-glass rounded-2xl px-8 py-6 text-center shadow-[0_26px_72px_-44px_hsla(230,52%,8%,0.86)]">
              <h2 className="text-3xl font-semibold text-brand-ice">Paused</h2>
=======
            <div className="panel-glass rounded-2xl border border-border px-8 py-6 text-center shadow-xl shadow-black/40">
              <h2 className="text-3xl font-semibold text-brand-accent">Paused</h2>
 main
              <div className="text-brand-soft text-lg">Score: {score}</div>
              <Button
                onClick={() => setGameState('playing')}
                className="mt-4 rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
              >
                Resume run
              </Button>
              <div className="mt-3 text-sm text-muted-foreground">Press ESC to resume</div>
            </div>
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-sm">
 codex/continue-coding-pikachu-dash-27rucm
            <div className="panel-glass rounded-2xl px-8 py-7 text-center shadow-[0_26px_72px_-44px_hsla(230,52%,8%,0.86)]">
              <h2 className="text-3xl font-semibold text-destructive">Game over</h2>
              <div className="text-brand-ice text-xl">Final Score: {score}</div>
=======
            <div className="panel-glass rounded-2xl border border-border px-8 py-7 text-center shadow-xl shadow-black/40">
              <h2 className="text-3xl font-semibold text-destructive">Game over</h2>
              <div className="text-brand-soft text-xl">Final Score: {score}</div>
 main
              <div className="mt-5 flex flex-wrap justify-center gap-4">
                <Button
                  onClick={startGame}
                  className="rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
                >
                  Play again
                </Button>
                <Button
                  onClick={resetHighScore}
                  variant="outline"
                  className="rounded-full border border-destructive px-6 py-3 font-semibold text-destructive transition hover:bg-destructive hover:text-white"
                >
                  Reset scores
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
 codex/continue-coding-pikachu-dash-27rucm
      <div className="mt-5 max-w-xl text-center text-sm text-muted-foreground">
        {isMobile ? (
          isGengar
            ? "Tap anywhere to flip gravity and weave through the mirrored lanes."
            : isFlying
              ? "Tap to jump, then swipe up or down to sculpt your glide path."
              : "Tap anywhere to vault over rhythm spikes while Pikachu auto-runs."
        ) : (
          isGengar
            ? "Press SPACE or click to invert gravity and thread the aurora gaps."
            : isFlying
              ? "Hold ARROW UP/W to climb, release to descend across the glide route."
              : "Press SPACE or click to jump—Pikachu sustains the forward pace."
        )}
=======
 codex/continue-coding-pikachu-dash-hwbk3v
      <div className="mt-5 max-w-xl text-center text-sm text-muted-foreground">
        {isMobile ? (
          isGengar
            ? "Tap anywhere to flip gravity and glide between the ceiling and floor."
            : isFlying
              ? "Tap to jump, then swipe up or down to guide your glide ship."
              : "Tap anywhere to vault over obstacles while Pikachu keeps the pace."
        ) : (
          isGengar
            ? "Press SPACE or click to invert gravity and thread the gaps."
            : isFlying
              ? "Hold ARROW UP/W to climb and release to descend through the aerial course."
              : "Press SPACE or click to jump—Pikachu handles the forward momentum."
        )}
=======
      <div className="mt-4 text-muted-foreground text-center">
        <div>
 codex/continue-coding-pikachu-dash-0g4c6g
          {isMobile ? (
            isGengar ? "Tap the screen to flip gravity and glide between ceiling and floor" : (isFlying ? "Tap to jump, swipe up/down, or use the arrows to steer the ship" : "Tap anywhere to jump over the spikes")
          ) : (
            isGengar ? "Press SPACE or click to flip gravity and dodge hazards" : (isFlying ? "Hold ARROW UP/W to rise, release to fall" : "Press SPACE or click to jump while Pikachu auto-runs")
          )}
=======
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
 main
        </div>
 main
 main
      </div>

      {/* Mobile Control Buttons */}
      {isMobile && gameState === 'playing' && (
        <div className="mt-6 flex flex-col items-center gap-4">
          {isFlying && (
            <div className="flex gap-4">
              <Button
                onTouchStart={() => setKeys(prev => ({ ...prev, ArrowUp: true }))}
                onTouchEnd={() => setKeys(prev => ({ ...prev, ArrowUp: false }))}
                className="rounded-full border border-border bg-secondary/80 px-4 py-2 text-sm text-foreground shadow-sm transition hover:bg-secondary"
              >
                ↑
              </Button>
              <Button
                onTouchStart={() => setKeys(prev => ({ ...prev, ArrowDown: true }))}
                onTouchEnd={() => setKeys(prev => ({ ...prev, ArrowDown: false }))}
                className="rounded-full border border-border bg-secondary/80 px-4 py-2 text-sm text-foreground shadow-sm transition hover:bg-secondary"
              >
                ↓
              </Button>
            </div>
          )}
          <Button
            onTouchStart={jump}
 codex/continue-coding-pikachu-dash-27rucm
            className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
          >
            {isGengar || isFlying ? "Flip" : "Jump"}
=======
 codex/continue-coding-pikachu-dash-hwbk3v
            className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
          >
            {isGengar || isFlying ? "Flip" : "Jump"}
=======
codex/continue-coding-pikachu-dash-0g4c6g
            className="bg-neon-green text-black border-neon font-bold px-6 py-2 text-sm"
          >
            {isGengar || isFlying ? "FLIP" : "JUMP"}
=======
            className="bg-neon-green text-black border-neon font-bold px-8 py-2 text-sm"
          >
            JUMP
 main
 main
 main
          </Button>
        </div>
      )}
    </div>
  );
};
