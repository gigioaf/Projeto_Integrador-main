import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Medal, Star } from 'lucide-react';
import './RocketPodium.css';

interface RankerUser {
  id: string;
  name: string;
  points: number;
  role: 'gestor' | 'admin' | 'membro';
  avColor: string;
}

interface RocketPodiumProps {
  top3: [RankerUser, RankerUser, RankerUser]; // [2º, 1º, 3º]
  fullList: RankerUser[];
  currentUserId?: string;
}

interface Point {
  x: number;
  y: number;
}

interface RocketDef {
  id: string;
  color: string;
  avColor: string;
  initials: string;
  slot: string;
  infoId: string;
  delay: number;
}

// ============ MATHEMATICAL FUNCTIONS ============

function cbz(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const u3 = u * u * u;
  const u2 = u * u;
  const t3 = t * t * t;
  const t2 = t * t;
  
  return {
    x: u3 * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t3 * p3.x,
    y: u3 * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t3 * p3.y
  };
}

function cbzT(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const u2 = u * u;
  const t2 = t * t;
  
  return {
    x: 3 * (u2 * (p1.x - p0.x) + 2 * u * t * (p2.x - p1.x) + t2 * (p3.x - p2.x)),
    y: 3 * (u2 * (p1.y - p0.y) + 2 * u * t * (p2.y - p1.y) + t2 * (p3.y - p2.y))
  };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ============ SMOKE FUNCTION ============

function smoke(x: number, y: number): void {
  const sz = Math.random() * 14 + 8; // 8-22px
  const div = document.createElement('div');
  
  div.style.position = 'fixed';
  div.style.zIndex = '9998';
  div.style.left = `${x - sz / 2}px`;
  div.style.top = `${y - sz / 2}px`;
  div.style.width = `${sz}px`;
  div.style.height = `${sz}px`;
  div.style.borderRadius = '50%';
  div.style.background = 'rgba(160, 140, 220, 0.15)';
  div.style.pointerEvents = 'none';
  div.style.animation = 'smokeOut 0.6s ease-out forwards';
  
  document.body.appendChild(div);
  
  setTimeout(() => {
    div.remove();
  }, 650);
}

// ============ GET SLOT FUNCTION ============

function getSlot(colSelector: string): Point {
  const col = document.querySelector(colSelector.replace('.rp-placeholder', '.rp-block')) as HTMLElement;
  if (!col) return { x: 0, y: 0 };
  const rect = col.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - 24,
    y: rect.top - 56
  };
}

const RocketPodium: React.FC<RocketPodiumProps> = ({
  top3: [runner2, runner1, runner3],
  fullList,
  currentUserId
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const rocketRefsRef = useRef<Array<HTMLDivElement | null>>([null, null, null]);
  const [stars, setStars] = useState<Array<{ id: number; style: React.CSSProperties }>>([]);
  const [rockets, setRockets] = useState<Array<{ id: number; active: boolean; landed: boolean }>>([
    { id: 0, active: false, landed: false },
    { id: 1, active: false, landed: false },
    { id: 2, active: false, landed: false }
  ]);

  const rocketDefs: RocketDef[] = [
    {
      id: 'rocket-0',
      color: '#b8841a',
      avColor: runner2.avColor,
      initials: runner2.name.charAt(0).toUpperCase(),
      slot: '.rp-col:nth-child(1) .rp-placeholder',
      infoId: '.rp-col:nth-child(1) .rp-info',
      delay: 200
    },
    {
      id: 'rocket-1',
      color: '#5038a0',
      avColor: runner1.avColor,
      initials: runner1.name.charAt(0).toUpperCase(),
      slot: '.rp-col:nth-child(2) .rp-placeholder',
      infoId: '.rp-col:nth-child(2) .rp-info',
      delay: 500
    },
    {
      id: 'rocket-2',
      color: '#8a5018',
      avColor: runner3.avColor,
      initials: runner3.name.charAt(0).toUpperCase(),
      slot: '.rp-col:nth-child(3) .rp-placeholder',
      infoId: '.rp-col:nth-child(3) .rp-info',
      delay: 350
    }
  ];


  // Gerar 55 estrelas
  useEffect(() => {
    const generatedStars = Array.from({ length: 55 }, (_, i) => {
      const size = Math.random() * 2 + 0.5;
      const duration = Math.random() * 3 + 2;
      const delay = Math.random() * 4;
      const opacity = Math.random() * 0.5 + 0.25;

      return {
        id: i,
        style: {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: size,
          height: size,
          '--d': `${duration}s`,
          '--dl': `${delay}s`,
          '--op': opacity
        } as React.CSSProperties
      };
    });
    setStars(generatedStars);
  }, []);

  // ============ LAUNCH FUNCTION ============

  const launch = () => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const DURATION = 1800; // ms - single flight phase
    const start: Point = { x: -90, y: window.innerHeight + 60 };

    rocketDefs.forEach((def, idx) => {
      const rktEl = rocketRefsRef.current[idx];
      if (!rktEl) return;

      setRockets(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], active: true };
        return next;
      });

      rktEl.style.opacity = '1';

      const bodyEl = rktEl.querySelector('.rkt-body') as HTMLDivElement;
      const flamesEl = rktEl.querySelector('.rkt-flames') as HTMLDivElement;

      // ========== SINGLE PHASE: DIRECT FLIGHT ==========
      const tgt = getSlot(def.slot);
      const p0 = start;
      const p1: Point = {
        x: start.x + window.innerWidth * 0.18,
        y: start.y - window.innerHeight * 0.55
      };
      const p2: Point = {
        x: tgt.x,
        y: tgt.y - 40
      };
      const p3 = tgt;

      let startTime: number | null = null;

      const flightFrame = (timestamp: number) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const rawT = Math.min(elapsed / DURATION, 1);
        const t = easeOutCubic(rawT);

        const pos = cbz(p0, p1, p2, p3, t);
        const tangent = cbzT(p0, p1, p2, p3, t);
        let angle = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI + 90;

        // Gradually straighten the rocket
        angle = angle * (1 - easeOutCubic(rawT));

        if (rktEl) {
          rktEl.style.left = `${pos.x}px`;
          rktEl.style.top = `${pos.y}px`;
        }

        if (bodyEl) {
          bodyEl.style.transform = `rotate(${angle}deg)`;
        }

        // Fade out flames
        if (flamesEl) {
          flamesEl.style.opacity = String(1 - rawT * 0.8);
        }

        // Smoke emission (18% probability)
        if (Math.random() < 0.18) {
          smoke(pos.x + 32, pos.y + 88);
        }

        if (rawT < 1) {
          requestAnimationFrame(flightFrame);
        } else {
          // ========== LANDING ==========
          if (rktEl) {
            rktEl.style.left = `${tgt.x}px`;
            rktEl.style.top = `${tgt.y}px`;
          }

          if (bodyEl) {
            bodyEl.style.transform = 'rotate(0deg)';
            bodyEl.style.transition = 'opacity 0.35s ease';
            bodyEl.style.opacity = '0';
          }

          setRockets(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], landed: true };
            return next;
          });

          // After 350ms: show landed icon and info
          setTimeout(() => {
            if (rktEl) {
              rktEl.style.opacity = '1';
              rktEl.style.zIndex = '10001';
            }

            const landedEl = rktEl.querySelector('.rkt-landed') as HTMLDivElement;
            if (landedEl) {
              landedEl.style.display = 'flex';
              landedEl.style.opacity = '1';
              landedEl.classList.add('pop');
            }

            // Convert from fixed to absolute positioning relative to stage
            const stageEl = stageRef.current;
            if (rktEl && stageEl) {
              const stageRect = stageEl.getBoundingClientRect();
              const currentLeft = parseFloat(rktEl.style.left);
              const currentTop = parseFloat(rktEl.style.top);
              rktEl.style.position = 'absolute';
              rktEl.style.left = `${currentLeft - stageRect.left}px`;
              rktEl.style.top = `${currentTop - stageRect.top}px`;
            }

            setTimeout(() => {
              const infoEl = document.querySelector(def.infoId) as HTMLDivElement;
              if (infoEl) {
                infoEl.classList.add('show');
              }
            }, 400);
          }, 350);
        }
      };

      requestAnimationFrame(flightFrame);
    });
  };

  // Trigger launch after 1800ms
  useEffect(() => {
    const timer = setTimeout(() => {
      launch();
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const getRocketColor = (idx: number): string => {
    const colors = ['#b8841a', '#5038a0', '#8a5018'];
    return colors[idx];
  };

  const getRocketData = (idx: number) => {
    const order = [runner2, runner1, runner3];
    return order[idx];
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      gestor: 'Gestor',
      admin: 'Admin',
      membro: 'Membro'
    };
    return labels[role] || 'Membro';
  };

  const RocketSVG = ({ color }: { color: string }) => (
    <svg viewBox="0 0 64 100" className="rkt-svg">
      {/* Corpo principal */}
      <path d="M32 6 Q48 22 50 72 L32 80 L14 72 Q16 22 32 6Z" fill={color} />
      
      {/* Reflexo */}
      <path d="M32 6 Q48 22 50 46 L32 46 L14 46 Q16 22 32 6Z" fill={color} opacity="0.55" />
      
      {/* Mini-janela */}
      <ellipse cx="24" cy="29" rx="4" ry="10" fill="rgba(255,255,255,0.12)" transform="rotate(-14 24 29)" />
      
      {/* Janela principal */}
      <circle cx="32" cy="50" r="10" fill="#08081a" strokeWidth="1.8" stroke="rgba(255,255,255,0.22)" />
      <circle cx="29" cy="47" r="3.5" fill="rgba(255,255,255,0.1)" />
      
      {/* Aleta esquerda */}
      <path d="M14 62 Q3 76 7 86 L14 76Z" fill={color} opacity="0.7" />
      
      {/* Aleta direita */}
      <path d="M50 62 Q61 76 57 86 L50 76Z" fill={color} opacity="0.7" />
      
      {/* Base */}
      <rect x="25" y="80" width="14" height="9" rx="3" fill="#0a0a18" />
    </svg>
  );

  return (
    <div className="rp-container">
      {/* STAGE */}
      <div className="rp-stage" ref={stageRef}>
        {/* Stars */}
        {stars.map(star => (
          <div key={star.id} className="rp-star" style={star.style} />
        ))}

        {/* Rockets (overlay) */}
        {rockets.map((rocket, idx) => {
          const data = getRocketData(idx);
          const color = getRocketColor(idx);
          const colIdx = idx === 1 ? 1 : (idx === 0 ? 0 : 2); // Map to col position

          return (
            <div
              key={rocket.id}
              ref={(el) => {
                if (el) rocketRefsRef.current[idx] = el;
              }}
              className={`rkt ${rocket.active ? 'flying' : ''}`}
            >
              {!rocket.landed ? (
                // Flying state
                <div className="rkt-body">
                  <RocketSVG color={color} />
                  <div className="rkt-avatar" style={{ background: data.avColor }}>
                    {data.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="rkt-flames">
                    <div className="rkt-flame-center" />
                    <div className="rkt-flame-outer" />
                  </div>
                </div>
              ) : (
                // Landed state
                <div className={`rkt-landed ${rocket.landed ? 'pop' : ''}`}>
                  <div className="rkt-fins">
                    <div className="rkt-avatar-big" style={{ background: data.avColor, color: 'white' }}>
                      {data.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Podium columns (Order: 2nd, 1st, 3rd) */}
        <div className="rp-columns">
          {[runner2, runner1, runner3].map((runner, idx) => {
            const colIdx = idx === 1 ? 1 : (idx === 0 ? 0 : 2);
            const blockClass = idx === 1 ? 'pb1' : (idx === 0 ? 'pb2' : 'pb3');
            const rankNum = idx === 1 ? 1 : (idx === 0 ? 2 : 3);
            const rankLabel = idx === 1 ? '#1 Campeão' : `#${rankNum}`;

            return (
              <div key={runner.id} className="rp-col">
                <div className="rp-placeholder" />
                <div className={`rp-block ${blockClass}`}>
                  {rankNum === 1 ? (
                    <Trophy size={24} className="text-warning" />
                  ) : rankNum === 2 ? (
                    <Medal size={24} className="text-gray-400" />
                  ) : (
                    <Medal size={24} className="text-orange-700" />
                  )}
                </div>
                <div className={`rp-info ${rockets[idx].landed ? 'show' : ''}`}>
                  <div className={`rp-rank ${idx === 1 ? 'rank1' : ''}`}>
                    {rankLabel}
                  </div>
                  <div className="rp-name">{runner.name.split(' ')[0]}</div>
                  <div className="rp-pts">
                    <Star size={14} className="inline-block mr-1 text-warning" />
                    {runner.points}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RANKING LIST */}
      <div className="rp-list">
        {fullList.map((user, idx) => {
          const isMeUser = user.id === currentUserId;
          let posIcon = null;
          
          if (idx === 0) {
            posIcon = <Trophy size={14} className="text-warning" />;
          } else if (idx === 1) {
            posIcon = <Medal size={14} className="text-gray-400" />;
          } else if (idx === 2) {
            posIcon = <Medal size={14} className="text-orange-700" />;
          }

          return (
            <div key={user.id} className={`rp-item ${isMeUser ? 'me' : ''}`}>
              <div className={`rp-num`}>
                {posIcon || <span className="text-gray-600">{idx + 1}</span>}
              </div>
              <div className="rp-avatar" style={{ background: user.avColor }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="rp-name-badge">
                <span className="rp-name">{user.name}</span>
                {isMeUser && <span className="rp-me-badge">você</span>}
              </div>
              <span className="rp-role">{getRoleLabel(user.role)}</span>
              <div className="rp-pts-container">
                <Star size={12} className="text-warning" />
                <span>{user.points}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RocketPodium;
