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
const JUMP_HEIGHT = 120;
const GAME_SPEED = 2.2;
const FLYING_OBSTACLE_SIZE = 35;
const FLYING_MODE_THRESHOLD = 1500;
const GENGAR_MODE_THRESHOLD = 6000;
const CHARIZARD_SIZE = 50;

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
  const [isJumping, setIsJumping] = useState(false);
  const [jumpVelocity, setJumpVelocity] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(GAME_SPEED);
  const [keys, setKeys] = useState<{[key: string]: boolean}>({});
  const [isFlying, setIsFlying] = useState(false);
  const [flyingY, setFlyingY] = useState(0);
  const [isGengar, setIsGengar] = useState(false);
  const [gravityUp, setGravityUp] = useState(false);
  const [flyingModeChangedAt, setFlyingModeChangedAt] = useState<number | null>(null);
  const [gengarModeChangedAt, setGengarModeChangedAt] = useState<number | null>(null);
  
  const gameLoopRef = useRef<number>();
  const spikeIdCounter = useRef(0);
  const flyingObstacleIdCounter = useRef(0);
  
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
    } else if (isFlying) {
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
      x: 80,
      y: groundY - PLAYER_SIZE,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE
    });
    setSpikes([]);
    setFlyingObstacles([]);
    setScore(0);
    setIsJumping(false);
    setJumpVelocity(0);
    setCurrentSpeed(GAME_SPEED);
    setIsFlying(false);
    setFlyingY(0);
    setIsGengar(false);
    setGravityUp(false);
    setFlyingModeChangedAt(null);
    setGengarModeChangedAt(null);
    spikeIdCounter.current = 0;
    flyingObstacleIdCounter.current = 0;
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

  const checkCollision = (rect1: GameObject, rect2: GameObject) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  // Check if flying mode should be activated
  useEffect(() => {
    if (score >= FLYING_MODE_THRESHOLD && !isFlying && !isGengar) {
      setIsFlying(true);
      setFlyingModeChangedAt(Date.now());
      setFlyingY(groundY - 150);
      setPlayer(prev => ({
        ...prev,
        y: groundY - 150,
        width: CHARIZARD_SIZE,
        height: CHARIZARD_SIZE
      }));
    }
  }, [score, isFlying, groundY, isGengar]);

  // Check if Gengar mode should be activated
  useEffect(() => {
    if (score >= GENGAR_MODE_THRESHOLD && !isGengar) {
      setIsGengar(true);
      setGengarModeChangedAt(Date.now());
      setIsFlying(false);
      setFlyingModeChangedAt(null); // Clear flying mode grace period
      setFlyingY(0);
      setPlayer(prev => ({
        ...prev,
        y: groundY - (PLAYER_SIZE - 14),
        width: PLAYER_SIZE - 14,
        height: PLAYER_SIZE - 14
      }));
    }
  }, [score, isGengar, groundY]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      setPlayer(prevPlayer => {
        let newY = prevPlayer.y;
        const maxX = gameWidth - (isFlying ? CHARIZARD_SIZE : isGengar ? PLAYER_SIZE - 14 : PLAYER_SIZE);
        const targetX = isFlying ? 120 : isGengar ? 90 : 80;
        const newX = Math.min(Math.max(40, targetX), Math.max(40, maxX));
        let newJumpVelocity = jumpVelocity;

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

        return { ...prevPlayer, y: newY, x: newX };
      });

      // Move spikes and check collisions
      setSpikes(prevSpikes => {
        const newSpikes = prevSpikes
          .map(spike => ({ ...spike, x: spike.x - currentSpeed }))
          .filter(spike => spike.x + spike.width > 0);

        // Check collisions with player
        const collision = newSpikes.some(spike => checkCollision(player, spike));
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
        const collision = newObstacles.some(obstacle => checkCollision(player, obstacle));
        if (collision) {
          if (isTopScore(score)) {
            setGameState('nameInput');
          } else {
            setGameState('gameOver');
          }
        }

        return newObstacles;
      });

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
          }
          
          return [...prevSpikes, ...spikes];
        }
        return prevSpikes;
      });

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
          }
          
          return [...prevObstacles, ...obstacles];
        }
        return prevObstacles;
      });

      // Increase speed over time
      setCurrentSpeed(prevSpeed => Math.min(prevSpeed + 0.0006, 4.2));

      // Update score (pause during grace periods)
      const isInFlyingGracePeriod = flyingModeChangedAt && (Date.now() - flyingModeChangedAt) < 3000 && isFlying;
      const isInGengarGracePeriod = gengarModeChangedAt && (Date.now() - gengarModeChangedAt) < 6000 && isGengar;
      if (!isInFlyingGracePeriod && !isInGengarGracePeriod) {
        setScore(prevScore => prevScore + 3);
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, isJumping, jumpVelocity, player, score, groundY, currentSpeed, flyingObstacles, keys, isFlying, isGengar, gravityUp, gameWidth, flyingModeChangedAt, gengarModeChangedAt, isTopScore]);

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-hero pattern-grid px-4 py-10">
        <div className="panel-glass max-w-xl rounded-3xl border border-border px-10 py-12 text-center shadow-2xl shadow-black/40">
          <h1 className="game-title">PIKACHU DASH</h1>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-brand-soft">
            Sprint through polished synth cityscapes, vault over spikes, and glide beyond the skyline as the beat builds.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Button
              onClick={startGame}
              className="rounded-full bg-primary px-10 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Start run
            </Button>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>Press <span className="font-medium text-foreground">SPACE</span> or click to jump.</div>
              <div className="text-xs uppercase tracking-[0.25em] text-brand-accent">Reach 1500 to unlock flight</div>
              <div className="text-xs uppercase tracking-[0.25em] text-destructive">Reach 6000 to enter Gengar mode</div>
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
        className={`absolute right-6 top-6 panel-glass rounded-2xl border border-border shadow-xl shadow-black/40 backdrop-blur ${isMobile ? 'px-3 py-3 text-xs' : 'px-5 py-4 text-sm'}`}
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
              className={`flex items-center justify-between gap-4 ${isMobile ? 'min-w-[120px]' : 'min-w-[160px]'}`}
            >
              <span className="font-semibold text-brand-soft">{index + 1}. {entry.name}</span>
              <span className="font-semibold text-foreground/90">{entry.score}</span>
            </div>
          ))
        ) : (
          <div className="text-muted-foreground">No scores yet</div>
        )}
      </div>

      <div className="mb-6 flex gap-10 text-center text-brand-soft">
        <div>
          <div className="text-3xl font-semibold text-foreground">{score}</div>
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
        </div>
      </div>
      
      <div
        className="panel-glass relative overflow-hidden rounded-[32px] border border-border shadow-[0_35px_90px_-45px_rgba(6,7,16,0.9)]"
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
          {isFlying ? (
            <div className="relative">
              <img 
                src={charizardSprite}
                alt="Charizard" 
                className="w-full h-full object-contain animate-focus-glow bg-transparent"
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
              className="w-full h-full object-contain animate-focus-glow bg-transparent"
            />
          ) : (
            <img 
              src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
              alt="Pikachu" 
              className="w-full h-full object-contain animate-focus-glow bg-transparent"
            />
          )}
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

        {gameState === 'nameInput' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="panel-glass w-full max-w-sm rounded-2xl border border-border px-6 py-7 text-center shadow-xl shadow-black/40">
              <h2 className="text-2xl font-semibold text-brand-accent">Top 3 score!</h2>
              <div className="text-brand-soft text-lg">Score: {score}</div>
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
            <div className="panel-glass rounded-2xl border border-border px-8 py-6 text-center shadow-xl shadow-black/40">
              <h2 className="text-3xl font-semibold text-brand-accent">Paused</h2>
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
            <div className="panel-glass rounded-2xl border border-border px-8 py-7 text-center shadow-xl shadow-black/40">
              <h2 className="text-3xl font-semibold text-destructive">Game over</h2>
              <div className="text-brand-soft text-xl">Final Score: {score}</div>
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
            className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
          >
            {isGengar || isFlying ? "Flip" : "Jump"}
          </Button>
        </div>
      )}
    </div>
  );
};
