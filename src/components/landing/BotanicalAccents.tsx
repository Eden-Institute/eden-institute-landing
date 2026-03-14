/**
 * Decorative botanical SVG line-art for background use.
 * Pure visual component — no functional logic.
 */

export const BotanicalLeafTopRight = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" strokeWidth="0.8" strokeLinecap="round">
      {/* Main stem */}
      <path d="M380 20 C340 80, 300 140, 260 220 C240 260, 220 300, 200 380" />
      {/* Leaf pairs */}
      <path d="M340 70 C320 50, 290 45, 270 55 C290 60, 310 70, 340 70Z" />
      <path d="M350 65 C360 40, 370 20, 380 10" />
      <path d="M320 110 C300 90, 270 85, 250 95 C270 100, 290 110, 320 110Z" />
      <path d="M310 115 C290 95, 260 90, 240 100" />
      <path d="M300 155 C280 135, 250 130, 230 140 C250 145, 270 155, 300 155Z" />
      <path d="M290 160 C270 140, 240 135, 220 145" />
      <path d="M280 200 C260 180, 230 175, 210 185 C230 190, 250 200, 280 200Z" />
      {/* Right-side leaves */}
      <path d="M360 85 C380 70, 395 60, 400 40" />
      <path d="M340 130 C360 115, 380 100, 390 80" />
      <path d="M320 170 C340 155, 360 140, 375 120" />
      {/* Smaller detail leaves */}
      <path d="M260 240 C240 225, 215 222, 200 230 C215 234, 235 240, 260 240Z" />
      <path d="M240 280 C220 265, 195 262, 180 270 C195 274, 215 280, 240 280Z" />
      {/* Tendril curls */}
      <path d="M270 210 C275 195, 285 185, 300 180" />
      <path d="M250 250 C255 235, 265 225, 280 220" />
    </g>
  </svg>
);

export const BotanicalLeafBottomLeft = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" strokeWidth="0.8" strokeLinecap="round">
      {/* Main stem curving up from bottom-left */}
      <path d="M20 380 C60 320, 100 260, 140 180 C160 140, 170 100, 180 40" />
      {/* Leaf pairs - left side */}
      <path d="M55 330 C75 350, 105 355, 125 345 C105 340, 85 330, 55 330Z" />
      <path d="M75 290 C95 310, 125 315, 145 305 C125 300, 105 290, 75 290Z" />
      <path d="M95 250 C115 270, 145 275, 165 265 C145 260, 125 250, 95 250Z" />
      <path d="M115 210 C135 230, 165 235, 185 225 C165 220, 145 210, 115 210Z" />
      {/* Right side leaves */}
      <path d="M40 345 C20 355, 10 370, 5 385" />
      <path d="M60 305 C40 315, 25 330, 15 350" />
      <path d="M80 265 C60 275, 45 290, 35 310" />
      {/* Smaller detail leaves */}
      <path d="M135 170 C155 185, 180 188, 195 180 C180 176, 160 170, 135 170Z" />
      <path d="M155 130 C175 145, 200 148, 215 140 C200 136, 180 130, 155 130Z" />
      {/* Berry/seed clusters */}
      <circle cx="30" cy="360" r="3" />
      <circle cx="22" cy="368" r="2.5" />
      <circle cx="38" cy="370" r="2" />
    </g>
  </svg>
);

export const BotanicalSprig = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" strokeWidth="0.6" strokeLinecap="round">
      {/* Central horizontal stem */}
      <path d="M10 30 C50 30, 150 30, 190 30" />
      {/* Small leaves along stem */}
      <path d="M40 30 C35 20, 30 15, 25 12 C30 18, 35 25, 40 30Z" />
      <path d="M40 30 C35 40, 30 45, 25 48 C30 42, 35 35, 40 30Z" />
      <path d="M70 30 C65 18, 60 12, 55 8 C60 15, 65 23, 70 30Z" />
      <path d="M70 30 C65 42, 60 48, 55 52 C60 45, 65 37, 70 30Z" />
      <path d="M100 30 C95 20, 90 15, 85 12 C90 18, 95 25, 100 30Z" />
      <path d="M100 30 C95 40, 90 45, 85 48 C90 42, 95 35, 100 30Z" />
      <path d="M130 30 C125 18, 120 12, 115 8 C120 15, 125 23, 130 30Z" />
      <path d="M130 30 C125 42, 120 48, 115 52 C120 45, 125 37, 130 30Z" />
      <path d="M160 30 C155 20, 150 15, 145 12 C150 18, 155 25, 160 30Z" />
      <path d="M160 30 C155 40, 150 45, 145 48 C150 42, 155 35, 160 30Z" />
    </g>
  </svg>
);

export const GoldDivider = () => (
  <div className="w-full flex items-center justify-center py-1">
    <div className="flex items-center gap-3 w-full max-w-2xl mx-auto px-6">
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--eden-gold)))" }} />
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0" style={{ color: "hsl(var(--eden-gold))" }}>
        <path d="M10 2 L12 8 L18 10 L12 12 L10 18 L8 12 L2 10 L8 8Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.15" />
      </svg>
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(var(--eden-gold)), transparent)" }} />
    </div>
  </div>
);
