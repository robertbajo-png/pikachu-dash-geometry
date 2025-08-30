import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import gengarSprite from "@/assets/gengar-sprite.png";
import charizardSprite from "@/assets/charizard-sprite.png";

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

const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const GROUND_HEIGHT = 50;
const PLAYER_SIZE = 50;
const SPIKE_WIDTH = 25;
const SPIKE_HEIGHT = 30;
const JUMP_HEIGHT = 120;
const GAME_SPEED = 2.5;
const FLYING_OBSTACLE_SIZE = 35;
const FLYING_MODE_THRESHOLD = 1000;
const CHARIZARD_SIZE = 80;

export const PikachuGame = () => {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver' | 'nameInput'>('menu');
  const [score, setScore] = useState(0);
  const [topScores, setTopScores] = useState<{name: string, score: number}[]>(() => {
    const saved = localStorage.getItem('pikachu-top-scores');
    return saved ? JSON.parse(saved) : [];
  });
  const [playerName, setPlayerName] = useState('');
  
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
  
  const gameLoopRef = useRef<number>();
  const spikeIdCounter = useRef(0);
  const flyingObstacleIdCounter = useRef(0);
  
  const groundY = GAME_HEIGHT - GROUND_HEIGHT;

  const resetGame = useCallback(() => {
    setPlayer({
      x: 100,
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
    spikeIdCounter.current = 0;
    flyingObstacleIdCounter.current = 0;
  }, [groundY]);

  const startGame = () => {
    resetGame();
    setGameState('playing');
  };

  const resetHighScore = () => {
    setTopScores([]);
    localStorage.setItem('pikachu-top-scores', '[]');
  };

  const isTopScore = (currentScore: number) => {
    return topScores.length < 3 || currentScore > topScores[topScores.length - 1].score;
  };

  const addTopScore = (name: string, score: number) => {
    const newTopScores = [...topScores, { name: name.slice(0, 3).toUpperCase(), score }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    setTopScores(newTopScores);
    localStorage.setItem('pikachu-top-scores', JSON.stringify(newTopScores));
  };

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      addTopScore(playerName.trim(), score);
      setPlayerName('');
      setGameState('gameOver');
    }
  };

  const jump = useCallback(() => {
    if (!isJumping && gameState === 'playing' && !isFlying) {
      setIsJumping(true);
      setJumpVelocity(-15);
    }
  }, [isJumping, gameState, isFlying]);

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
    if (score >= FLYING_MODE_THRESHOLD && !isFlying) {
      setIsFlying(true);
      setFlyingY(groundY - 150);
      setPlayer(prev => ({
        ...prev,
        y: groundY - 150,
        width: CHARIZARD_SIZE,
        height: CHARIZARD_SIZE
      }));
    }
  }, [score, isFlying, groundY]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      setPlayer(prevPlayer => {
        let newY = prevPlayer.y;
        let newX = prevPlayer.x;
        let newJumpVelocity = jumpVelocity;

        // Handle horizontal movement
        if (keys['ArrowLeft'] || keys['KeyA']) {
          newX = Math.max(0, newX - 6);
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
          newX = Math.min(GAME_WIDTH - (isFlying ? CHARIZARD_SIZE : PLAYER_SIZE), newX + 6);
        }

        if (isFlying) {
          // Flying mode controls
          if (keys['ArrowUp'] || keys['KeyW']) {
            newY = Math.max(50, newY - 4);
          }
          if (keys['ArrowDown'] || keys['KeyS']) {
            newY = Math.min(groundY - CHARIZARD_SIZE, newY + 4);
          }
          setFlyingY(newY);
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
        const spikeDistance = isFlying ? 200 : 350;
        if (!lastSpike || lastSpike.x < GAME_WIDTH - spikeDistance) {
          const spikes = [];
          
          // Ground spikes
          spikes.push({
            id: spikeIdCounter.current++,
            x: GAME_WIDTH,
            y: groundY - SPIKE_HEIGHT,
            width: SPIKE_WIDTH,
            height: SPIKE_HEIGHT
          });
          
          // In flying mode, add ceiling spikes
          if (isFlying && Math.random() < 0.6) {
            spikes.push({
              id: spikeIdCounter.current++,
              x: GAME_WIDTH + (Math.random() * 100),
              y: 0,
              width: SPIKE_WIDTH,
              height: SPIKE_HEIGHT * 2
            });
          }
          
          return [...prevSpikes, ...spikes];
        }
        return prevSpikes;
      });

      // Add new flying obstacles (more in flying mode)
      setFlyingObstacles(prevObstacles => {
        const lastObstacle = prevObstacles[prevObstacles.length - 1];
        const obstacleDistance = isFlying ? 250 : 400;
        if (!lastObstacle || lastObstacle.x < GAME_WIDTH - obstacleDistance) {
          const obstacles = [];
          
          if (isFlying) {
            // Multiple height levels in flying mode
            const heights = [50, 120, 200, groundY - 80, groundY - 120, groundY - 160];
            const numObstacles = Math.random() < 0.7 ? 2 : 1;
            
            for (let i = 0; i < numObstacles; i++) {
              const randomHeight = heights[Math.floor(Math.random() * heights.length)];
              obstacles.push({
                id: flyingObstacleIdCounter.current++,
                x: GAME_WIDTH + (i * 80),
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
              x: GAME_WIDTH,
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
      setCurrentSpeed(prevSpeed => Math.min(prevSpeed + 0.001, 5));

      // Update score
      setScore(prevScore => prevScore + 1);

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, isJumping, jumpVelocity, player, score, groundY, currentSpeed, flyingObstacles, keys, isFlying]);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
              <div className="text-sm mt-2">Press SPACE or click to jump</div>
              <div className="text-xs mt-1 text-fire">Reach 1000 for FLYING MODE!</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen ${isFlying ? 'bg-fire bg-fire-grid' : 'bg-electric bg-grid'}`}>
      {/* Top 3 High Scores - Upper Right Corner */}
      <div className="absolute top-4 right-4 bg-black/50 p-3 rounded border border-neon-cyan">
        <div className="text-center text-cyber text-sm font-bold mb-2">TOP 3</div>
        {topScores.length > 0 ? (
          topScores.map((entry, index) => (
            <div key={index} className="flex justify-between items-center text-xs mb-1">
              <span className="text-neon-green">{index + 1}. {entry.name}</span>
              <span className="text-cyber ml-2">{entry.score}</span>
            </div>
          ))
        ) : (
          <div className="text-muted-foreground text-xs">No scores yet</div>
        )}
      </div>

      <div className="mb-4 flex gap-8 text-center">
        <div className="text-cyber">
          <div className="text-2xl font-bold">{score}</div>
          <div className="text-sm">SCORE</div>
          {isFlying && <div className="text-xs text-neon animate-pulse">FLYING MODE!</div>}
        </div>
      </div>
      
      <div className="relative overflow-hidden" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
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
            bottom: GAME_HEIGHT - player.y - player.height,
            width: player.width,
            height: player.height,
          }}
        >
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
          ) : (
            <img 
              src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
              alt="Pikachu" 
              className="w-full h-full object-contain animate-pulse-neon bg-transparent"
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
              bottom: GAME_HEIGHT - spike.y - spike.height,
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
              bottom: GAME_HEIGHT - obstacle.y - obstacle.height,
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
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center space-y-4 bg-card p-6 rounded border border-neon-cyan">
              <h2 className="text-neon text-2xl font-bold">TOP 3 SCORE!</h2>
              <div className="text-cyber text-lg">Score: {score}</div>
              <div className="text-muted-foreground">Enter your name (max 3 letters):</div>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                maxLength={3}
                className="bg-input text-foreground px-3 py-2 rounded border border-border text-center uppercase"
                placeholder="ABC"
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
          {isFlying 
            ? "Use ARROW KEYS or WASD to fly up/down/left/right" 
            : "Press SPACE or click anywhere to jump"
          }
        </div>
      </div>
    </div>
  );
};
