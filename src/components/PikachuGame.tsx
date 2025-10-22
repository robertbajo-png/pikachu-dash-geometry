import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import pikachuSprite from "@/assets/pikachu-transparent.png";
import charizardSprite from "@/assets/charizard-sprite.png";
import gengarSprite from "@/assets/gengar-sprite.png";
import capybaraSprite from "@/assets/capybara.svg";
import { cn } from "@/lib/utils";

interface GameMode {
  id: string;
  name: string;
  tagline: string;
  description: string;
  sprite: string;
  primaryColor: string;
  secondaryColor: string;
  skyGradient: [string, string];
  groundColor: string;
  obstacleColor: string;
  particleColor: string;
  baseSpeed: number;
  spawnInterval: [number, number];
  jumpStrength: number;
  gravity: number;
  maxJumps: number;
  size: { width: number; height: number };
}

interface Obstacle {
  x: number;
  width: number;
  height: number;
  speed: number;
  kind: "low" | "tall" | "floating";
}

interface RuntimeState {
  playerY: number;
  velocityY: number;
  score: number;
  spawnTimer: number;
  obstacles: Obstacle[];
  lastTimestamp: number | null;
  jumpsUsed: number;
}

const BASE_WIDTH = 720;
const BASE_HEIGHT = 360;
const PLAYER_X = 120;
const GROUND_HEIGHT = 64;

const GAME_MODES: GameMode[] = [
  {
    id: "pikachu",
    name: "Pikachu Dash",
    tagline: "Blixtsnabb precision",
    description: "Klassikern – kvick, lätt och med rapp dubbelhopp för tajta situationer.",
    sprite: pikachuSprite,
    primaryColor: "#facc15",
    secondaryColor: "#f97316",
    skyGradient: ["#0f172a", "#1e293b"],
    groundColor: "#111827",
    obstacleColor: "#fbbf24",
    particleColor: "rgba(250, 204, 21, 0.45)",
    baseSpeed: 6.2,
    spawnInterval: [900, 1400],
    jumpStrength: 14.5,
    gravity: 0.62,
    maxJumps: 2,
    size: { width: 70, height: 70 }
  },
  {
    id: "charizard",
    name: "Charizard Burn",
    tagline: "Aggressiv fart",
    description: "Storma fram i hög fart med tunga hopp och en stark efterglöd.",
    sprite: charizardSprite,
    primaryColor: "#fb923c",
    secondaryColor: "#ef4444",
    skyGradient: ["#1b1a3a", "#2d1f3d"],
    groundColor: "#1f1b2d",
    obstacleColor: "#f97316",
    particleColor: "rgba(248, 113, 113, 0.5)",
    baseSpeed: 7.3,
    spawnInterval: [800, 1200],
    jumpStrength: 15,
    gravity: 0.7,
    maxJumps: 1,
    size: { width: 86, height: 78 }
  },
  {
    id: "gengar",
    name: "Gengar Drift",
    tagline: "Spöklik kontroll",
    description: "Lätt och svävande med mjukare gravitation och tre sprillans hopp.",
    sprite: gengarSprite,
    primaryColor: "#a855f7",
    secondaryColor: "#7c3aed",
    skyGradient: ["#1a1029", "#240a36"],
    groundColor: "#160b22",
    obstacleColor: "#c084fc",
    particleColor: "rgba(168, 85, 247, 0.45)",
    baseSpeed: 5.4,
    spawnInterval: [950, 1500],
    jumpStrength: 13,
    gravity: 0.46,
    maxJumps: 3,
    size: { width: 72, height: 72 }
  },
  {
    id: "capybara",
    name: "Kapibara Cruise",
    tagline: "Lugnt och stabilt",
    description: "Ett zen-läge – mjuk acceleration, långa hopp och en trivsam vibe.",
    sprite: capybaraSprite,
    primaryColor: "#f59e0b",
    secondaryColor: "#f97316",
    skyGradient: ["#0f1c1d", "#123132"],
    groundColor: "#0b1617",
    obstacleColor: "#fbbf24",
    particleColor: "rgba(245, 158, 11, 0.4)",
    baseSpeed: 5.1,
    spawnInterval: [1100, 1700],
    jumpStrength: 15.2,
    gravity: 0.55,
    maxJumps: 2,
    size: { width: 96, height: 66 }
  }
];

const getDimensions = () => {
  if (typeof window === "undefined") {
    return { width: BASE_WIDTH, height: BASE_HEIGHT };
  }
  const maxWidth = Math.min(window.innerWidth - 48, BASE_WIDTH);
  const width = Math.max(320, maxWidth);
  const height = Math.round((BASE_HEIGHT / BASE_WIDTH) * width);
  return { width, height };
};

const loadSprite = (src: string) => {
  if (typeof window === "undefined") {
    return null;
  }
  const image = new Image();
  image.src = src;
  return image;
};

export const PikachuGame = () => {
  const [gameState, setGameState] = useState<"menu" | "playing" | "gameOver">("menu");
  const [selectedMode, setSelectedMode] = useState<GameMode>(GAME_MODES[0]);
  const [displayScore, setDisplayScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [highScores, setHighScores] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const stored = window.localStorage.getItem("pikachu-dash-highscores");
      if (!stored) return {};
      return JSON.parse(stored) as Record<string, number>;
    } catch (error) {
      console.warn("Kunde inte läsa sparade poäng", error);
      return {};
    }
  });
  const [dimensions, setDimensions] = useState(() => getDimensions());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>();
  const runtimeRef = useRef<RuntimeState | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(loadSprite(selectedMode.sprite));

  const highScoreForMode = highScores[selectedMode.id] ?? 0;

  const saveHighScores = useCallback((scores: Record<string, number>) => {
    setHighScores(scores);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pikachu-dash-highscores", JSON.stringify(scores));
      }
    } catch (error) {
      console.warn("Kunde inte spara poäng", error);
    }
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions(getDimensions());
    };

    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    spriteRef.current = loadSprite(selectedMode.sprite);
  }, [selectedMode]);

  const resetRuntime = useCallback((): RuntimeState => {
    const height = dimensions.height;
    return {
      playerY: height - GROUND_HEIGHT,
      velocityY: 0,
      score: 0,
      spawnTimer: 0,
      obstacles: [],
      lastTimestamp: null,
      jumpsUsed: 0
    };
  }, [dimensions.height]);

  const spawnObstacle = useCallback((mode: GameMode, width: number, height: number, speed: number): Obstacle => {
    const baseKind = height > 72 ? "tall" : height < 54 ? "floating" : "low";
    return {
      x: dimensions.width + width,
      width,
      height,
      speed,
      kind: baseKind
    };
  }, [dimensions.width]);

  const drawScene = useCallback((runtime: RuntimeState, mode: GameMode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const groundY = height - GROUND_HEIGHT;

    const [skyTop, skyBottom] = mode.skyGradient;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, skyTop);
    gradient.addColorStop(1, skyBottom);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = mode.groundColor;
    ctx.fillRect(0, groundY, width, GROUND_HEIGHT);

    ctx.strokeStyle = `${mode.primaryColor}33`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 0.5);
    ctx.lineTo(width, groundY + 0.5);
    ctx.stroke();

    ctx.fillStyle = mode.obstacleColor;
    runtime.obstacles.forEach((obstacle) => {
      const baseY = groundY;
      let y = baseY - obstacle.height;
      if (obstacle.kind === "floating") {
        y -= 36;
      }
      const radius = 12;
      ctx.beginPath();
      ctx.moveTo(obstacle.x + radius, y);
      ctx.lineTo(obstacle.x + obstacle.width - radius, y);
      ctx.quadraticCurveTo(obstacle.x + obstacle.width, y, obstacle.x + obstacle.width, y + radius);
      ctx.lineTo(obstacle.x + obstacle.width, y + obstacle.height - radius);
      ctx.quadraticCurveTo(
        obstacle.x + obstacle.width,
        y + obstacle.height,
        obstacle.x + obstacle.width - radius,
        y + obstacle.height
      );
      ctx.lineTo(obstacle.x + radius, y + obstacle.height);
      ctx.quadraticCurveTo(obstacle.x, y + obstacle.height, obstacle.x, y + obstacle.height - radius);
      ctx.lineTo(obstacle.x, y + radius);
      ctx.quadraticCurveTo(obstacle.x, y, obstacle.x + radius, y);
      ctx.closePath();
      ctx.fill();
    });

    const playerHeight = mode.size.height;
    const playerWidth = mode.size.width;
    const playerBottom = runtime.playerY;
    const playerTop = playerBottom - playerHeight;
    const playerLeft = PLAYER_X - playerWidth / 2;

    ctx.fillStyle = mode.particleColor;
    ctx.beginPath();
    ctx.ellipse(PLAYER_X, playerBottom - 12, playerWidth * 0.55, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    const sprite = spriteRef.current;
    if (sprite?.complete) {
      ctx.drawImage(sprite, playerLeft, playerTop, playerWidth, playerHeight);
    } else {
      ctx.fillStyle = mode.primaryColor;
      ctx.fillRect(playerLeft, playerTop, playerWidth, playerHeight);
    }

    const glowGradient = ctx.createLinearGradient(playerLeft, playerTop, playerLeft, playerTop + playerHeight);
    glowGradient.addColorStop(0, `${mode.secondaryColor}99`);
    glowGradient.addColorStop(1, `${mode.primaryColor}11`);
    ctx.fillStyle = glowGradient;
    ctx.fillRect(playerLeft, playerTop, playerWidth, playerHeight);
  }, []);

  const endGame = useCallback((runtime: RuntimeState) => {
    const roundedScore = Math.floor(runtime.score);
    setFinalScore(roundedScore);
    setDisplayScore(roundedScore);
    setGameState("gameOver");

    const previousBest = highScores[selectedMode.id] ?? 0;
    if (roundedScore > previousBest) {
      const next = { ...highScores, [selectedMode.id]: roundedScore };
      saveHighScores(next);
    }
  }, [highScores, saveHighScores, selectedMode.id]);

  const updateFrame = useCallback((timestamp: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (runtime.lastTimestamp == null) {
      runtime.lastTimestamp = timestamp;
    }
    const deltaMs = timestamp - runtime.lastTimestamp;
    runtime.lastTimestamp = timestamp;
    const delta = Math.min(deltaMs, 48);

    const mode = selectedMode;
    runtime.spawnTimer += delta;

    const spawnInterval = mode.spawnInterval[0] + Math.random() * (mode.spawnInterval[1] - mode.spawnInterval[0]);
    if (runtime.spawnTimer >= spawnInterval) {
      runtime.spawnTimer = 0;
      const sizeFactor = 0.8 + Math.random() * 0.6;
      const obstacleHeight = 52 + Math.random() * 48;
      const speedVariance = 0.75 + Math.random() * 0.4;
      const obstacle = spawnObstacle(
        mode,
        36 + Math.random() * 28,
        obstacleHeight * sizeFactor,
        mode.baseSpeed * speedVariance
      );
      runtime.obstacles.push(obstacle);
    }

    const groundY = canvas.height - GROUND_HEIGHT;

    runtime.obstacles = runtime.obstacles
      .map((obstacle) => ({
        ...obstacle,
        x: obstacle.x - obstacle.speed * (delta / 16.67)
      }))
      .filter((obstacle) => obstacle.x + obstacle.width > -40);

    runtime.velocityY += mode.gravity * (delta / 16.67);
    runtime.playerY += runtime.velocityY * (delta / 16.67);

    if (runtime.playerY >= groundY) {
      runtime.playerY = groundY;
      runtime.velocityY = 0;
      runtime.jumpsUsed = 0;
    }

    const playerHeight = mode.size.height;
    const playerWidth = mode.size.width;
    const playerRect = {
      x: PLAYER_X - playerWidth / 2,
      y: runtime.playerY - playerHeight,
      width: playerWidth,
      height: playerHeight
    };

    const collision = runtime.obstacles.some((obstacle) => {
      const baseY = groundY;
      let obstacleY = baseY - obstacle.height;
      if (obstacle.kind === "floating") {
        obstacleY -= 36;
      }
      return !(
        playerRect.x + playerRect.width < obstacle.x ||
        playerRect.x > obstacle.x + obstacle.width ||
        playerRect.y + playerRect.height < obstacleY ||
        playerRect.y > obstacleY + obstacle.height
      );
    });

    if (collision) {
      cancelAnimationFrame(animationRef.current!);
      endGame(runtime);
      return;
    }

    runtime.score += (mode.baseSpeed * delta) / 120;
    setDisplayScore(Math.floor(runtime.score));

    drawScene(runtime, mode);
    animationRef.current = requestAnimationFrame(updateFrame);
  }, [drawScene, endGame, selectedMode, spawnObstacle]);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const runtime = resetRuntime();
    runtimeRef.current = runtime;
    setGameState("playing");
    setDisplayScore(0);
    setFinalScore(0);

    drawScene(runtime, selectedMode);
    animationRef.current = requestAnimationFrame(updateFrame);
  }, [dimensions.height, dimensions.width, drawScene, resetRuntime, selectedMode, updateFrame]);

  const stopGame = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (runtimeRef.current) {
      endGame(runtimeRef.current);
    }
  }, [endGame]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleJump = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime || gameState !== "playing") return;
    const mode = selectedMode;
    if (runtime.jumpsUsed >= mode.maxJumps) return;

    runtime.velocityY = -mode.jumpStrength;
    runtime.jumpsUsed += 1;
  }, [gameState, selectedMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if ([" ", "Spacebar", "Space", "ArrowUp", "w", "W"].includes(event.key)) {
        event.preventDefault();
        if (gameState === "menu") {
          startGame();
        } else if (gameState === "playing") {
          handleJump();
        } else if (gameState === "gameOver") {
          startGame();
        }
      } else if (event.key === "Escape" && gameState === "playing") {
        stopGame();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameState, handleJump, startGame, stopGame]);

  useEffect(() => {
    if (gameState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointer = () => handleJump();
    canvas.addEventListener("pointerdown", handlePointer);
    return () => canvas.removeEventListener("pointerdown", handlePointer);
  }, [gameState, handleJump]);

  const menuCards = useMemo(() => {
    return GAME_MODES.map((mode) => {
      const isActive = selectedMode.id === mode.id;
      return (
        <Card
          key={mode.id}
          className={cn(
            "relative overflow-hidden border transition-all duration-300",
            isActive
              ? "border-transparent shadow-xl shadow-black/40"
              : "border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-black/30"
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background: `linear-gradient(135deg, ${mode.primaryColor}22, ${mode.secondaryColor}33)`
            }}
          />
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center justify-between text-xl">
              <span>{mode.name}</span>
              {selectedMode.id === mode.id ? (
                <Badge className="bg-white/20 text-white">Vald</Badge>
              ) : (
                <Badge variant="secondary" className="bg-white/10 text-white">
                  {mode.maxJumps} hopp
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-slate-200/80">
              {mode.tagline}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-2">
                <img
                  src={mode.sprite}
                  alt={mode.name}
                  className="h-full w-full object-contain drop-shadow-lg"
                />
              </div>
              <div className="text-sm text-slate-200/80">
                <p>{mode.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs uppercase tracking-wide text-slate-300/70">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] text-slate-300/60">Fart</p>
                <p className="text-sm font-semibold text-white">{mode.baseSpeed.toFixed(1)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] text-slate-300/60">Gravitation</p>
                <p className="text-sm font-semibold text-white">{mode.gravity.toFixed(2)}</p>
              </div>
            </div>
            <Button
              variant={isActive ? "default" : "secondary"}
              className={cn(
                "justify-center",
                isActive
                  ? "bg-white text-slate-900 hover:bg-slate-200"
                  : "border border-white/20 bg-transparent text-white hover:bg-white/10"
              )}
              onClick={() => setSelectedMode(mode)}
            >
              {isActive ? "Valt läge" : "Välj läge"}
            </Button>
          </CardContent>
        </Card>
      );
    });
  }, [selectedMode]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.12),_rgba(15,23,42,0.95))] px-4 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-white/60">Poké Dash Reimagined</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Välj din hjälte och storma banan</h1>
          <p className="mx-auto max-w-2xl text-sm text-white/70 md:text-base">
            Hoppa, sväva och cruisa genom neonbelysta hinder. Varje spel-läge har egna egenskaper – lär känna deras rytm,
            maxa dina hopp och jaga ett nytt personbästa.
          </p>
        </header>

        {gameState === "menu" && (
          <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
            {menuCards}
          </div>
        )}

        <div
          className={cn(
            "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/40 backdrop-blur",
            gameState === "playing" ? "ring-2 ring-white/40" : ""
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/5" aria-hidden />
          <div className="relative z-10 flex flex-col gap-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Aktivt läge</p>
                <h2 className="text-2xl font-semibold">{selectedMode.name}</h2>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60">Poäng</p>
                  <p className="text-2xl font-semibold text-white">{displayScore}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60">Personbästa</p>
                  <p className="text-2xl font-semibold text-white">{highScoreForMode}</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <canvas ref={canvasRef} className="h-full w-full" style={{ width: "100%", height: dimensions.height }} />
              {gameState === "menu" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 text-center">
                  <p className="text-lg font-semibold">Redo när du är det</p>
                  <p className="max-w-xs text-sm text-white/70">
                    Tryck på <span className="font-semibold">MELLANSLAG</span> eller klicka på start för att dra igång.
                  </p>
                </div>
              )}
              {gameState === "gameOver" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/70 text-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Loppet tog slut</p>
                    <p className="text-3xl font-bold">{finalScore} poäng</p>
                    {finalScore > highScoreForMode && (
                      <p className="mt-2 text-sm font-medium text-amber-300">Nytt personbästa! ✨</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={startGame} className="bg-white text-slate-900 hover:bg-slate-200">
                      Försök igen
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setGameState("menu")}
                      className="border border-white/20 bg-transparent text-white hover:bg-white/10"
                    >
                      Tillbaka till meny
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
              <p>
                <span className="font-semibold text-white">Kontroller:</span> Mellanslag, W eller pil upp för att hoppa.
                Klicka på banan på mobil. ESC avslutar rundan.
              </p>
              {gameState !== "playing" ? (
                <Button onClick={startGame} className="bg-white text-slate-900 hover:bg-slate-200">
                  Starta {selectedMode.name}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={stopGame}
                  className="border border-white/20 bg-transparent text-white hover:bg-white/10"
                >
                  Avsluta rundan
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
