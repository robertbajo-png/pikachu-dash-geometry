import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import gengarSprite from "@/assets/gengar-sprite.png";

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

export const PikachuGame = () => {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('pikachu-high-score');
    return saved ? parseInt(saved) : 0;
  });
  
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
    spikeIdCounter.current = 0;
    flyingObstacleIdCounter.current = 0;
  }, [groundY]);

  const startGame = () => {
    resetGame();
    setGameState('playing');
  };

  const jump = useCallback(() => {
    if (!isJumping && gameState === 'playing') {
      setIsJumping(true);
      setJumpVelocity(-22);
    }
  }, [isJumping, gameState]);

  const checkCollision = (rect1: GameObject, rect2: GameObject) => {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  };

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      setPlayer(prevPlayer => {
        let newY = prevPlayer.y;
        let newJumpVelocity = jumpVelocity;

        if (isJumping) {
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

        return { ...prevPlayer, y: newY };
      });

      // Move spikes and check collisions
      setSpikes(prevSpikes => {
        const newSpikes = prevSpikes
          .map(spike => ({ ...spike, x: spike.x - currentSpeed }))
          .filter(spike => spike.x + spike.width > 0);

        // Check collisions with player
        const collision = newSpikes.some(spike => checkCollision(player, spike));
        if (collision) {
          setGameState('gameOver');
          const newHighScore = Math.max(score, highScore);
          setHighScore(newHighScore);
          localStorage.setItem('pikachu-high-score', newHighScore.toString());
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
          setGameState('gameOver');
          const newHighScore = Math.max(score, highScore);
          setHighScore(newHighScore);
          localStorage.setItem('pikachu-high-score', newHighScore.toString());
        }

        return newObstacles;
      });

      // Add new spikes
      setSpikes(prevSpikes => {
        const lastSpike = prevSpikes[prevSpikes.length - 1];
        if (!lastSpike || lastSpike.x < GAME_WIDTH - 350) {
          const newSpike: Spike = {
            id: spikeIdCounter.current++,
            x: GAME_WIDTH,
            y: groundY - SPIKE_HEIGHT,
            width: SPIKE_WIDTH,
            height: SPIKE_HEIGHT
          };
          return [...prevSpikes, newSpike];
        }
        return prevSpikes;
      });

      // Add new flying obstacles
      setFlyingObstacles(prevObstacles => {
        const lastObstacle = prevObstacles[prevObstacles.length - 1];
        if (!lastObstacle || lastObstacle.x < GAME_WIDTH - 400) {
          const heights = [groundY - 80, groundY - 120, groundY - 160];
          const randomHeight = heights[Math.floor(Math.random() * heights.length)];
          const newObstacle: FlyingObstacle = {
            id: flyingObstacleIdCounter.current++,
            x: GAME_WIDTH,
            y: randomHeight,
            width: FLYING_OBSTACLE_SIZE,
            height: FLYING_OBSTACLE_SIZE,
            speed: currentSpeed + Math.random() * 1.5
          };
          return [...prevObstacles, newObstacle];
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
  }, [gameState, isJumping, jumpVelocity, player, score, highScore, groundY, currentSpeed, flyingObstacles]);

  // Controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };

    const handleClick = () => {
      jump();
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('click', handleClick);
    };
  }, [jump]);

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
              <div>High Score: {highScore}</div>
              <div className="text-sm mt-2">Press SPACE or click to jump</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-electric bg-grid">
      <div className="mb-4 flex gap-8 text-center">
        <div className="text-cyber">
          <div className="text-2xl font-bold">{score}</div>
          <div className="text-sm">SCORE</div>
        </div>
        <div className="text-neon">
          <div className="text-2xl font-bold">{highScore}</div>
          <div className="text-sm">HIGH SCORE</div>
        </div>
      </div>
      
      <div className="relative overflow-hidden" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
        {/* Ground */}
        <div 
          className="absolute bottom-0 w-full bg-neon-green/20 border-t border-neon-green"
          style={{ height: GROUND_HEIGHT }}
        />
        
        {/* Player (Pikachu) */}
        <div
          className={`absolute transition-none bg-transparent ${isJumping ? 'animate-float' : ''}`}
          style={{
            left: player.x,
            bottom: GAME_HEIGHT - player.y - player.height,
            width: player.width,
            height: player.height,
          }}
        >
          <img 
            src="/lovable-uploads/2c373f45-ab6b-45ba-a70a-8609e02d54cd.png"
            alt="Pikachu" 
            className="w-full h-full object-contain animate-pulse-neon bg-transparent"
          />
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
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
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

        {gameState === 'gameOver' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h2 className="text-destructive text-3xl font-bold">GAME OVER</h2>
              <div className="text-cyber text-xl">Final Score: {score}</div>
              {score === highScore && (
                <div className="text-neon animate-pulse-neon">NEW HIGH SCORE!</div>
              )}
              <Button 
                onClick={startGame}
                className="bg-neon-green text-black border-neon font-bold px-6 py-3 hover:bg-neon-green/80"
              >
                PLAY AGAIN
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-muted-foreground text-center">
        <div>Press SPACE or click anywhere to jump</div>
      </div>
    </div>
  );
};
