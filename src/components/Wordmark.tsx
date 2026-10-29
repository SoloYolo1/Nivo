// The Nivo wordmark. The viewBox is cut tight to the letters and the gold dot so it centres exactly.
export function Wordmark({ className, label = 'Nivo' }: { className?: string; label?: string }) {
  return (
    <svg className={className} viewBox="76.1 163.9 364.1 164.5" role="img" aria-label={label} style={{ overflow: 'visible' }}>
      <defs><linearGradient id="nv-gold" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#d9a84e" /><stop offset="1" stopColor="#ffe7a3" /></linearGradient></defs>
      <path d="M109.734375 269.9453125C109.734375 255.8828125 116.5703125 249.33984375 127.21484375 249.33984375C137.859375 249.33984375 144.01171875 255.98046875 144.01171875 268.1875V326.0H177.60546875V261.15625C177.60546875 235.765625 164.51953125 220.62890625 142.15625 220.62890625C126.62890625 220.62890625 116.1796875 227.7578125 109.34375 239.57421875V222.875H76.140625V326.0H109.734375Z" fill="currentColor" />
      <path d="M187.35546875 326.0H220.94921875V222.875H187.35546875Z" fill="#8e9bff" />
      <path d="M259.3125 326.0H297.49609375L335.09375 222.875H300.328125L285.6796875 270.3359375C283.3359375 278.5390625 281.08984375 286.64453125 278.84375 294.75C276.59765625 286.64453125 274.25390625 278.5390625 271.8125 270.3359375L256.87109375 222.875H221.71484375Z" fill="currentColor" />
      <path d="M385.95703125 328.34375C418.28125 328.34375 440.15625 307.15234375 440.15625 274.4375C440.15625 241.91796875 418.28125 220.53125 385.95703125 220.53125C353.6328125 220.53125 331.66015625 241.91796875 331.66015625 274.4375C331.66015625 307.15234375 353.6328125 328.34375 385.95703125 328.34375ZM385.95703125 301.5859375C374.140625 301.5859375 365.7421875 291.91796875 365.7421875 274.4375C365.7421875 257.0546875 374.23828125 247.2890625 385.95703125 247.2890625C397.67578125 247.2890625 406.171875 257.0546875 406.171875 274.4375C406.171875 291.91796875 397.67578125 301.5859375 385.95703125 301.5859375Z" fill="currentColor" />
      <circle cx="204.2" cy="184.9" r="42" fill="#ffe7a3" opacity=".16" />
      <circle cx="204.2" cy="184.9" r="21" fill="url(#nv-gold)" />
    </svg>
  );
}

/** Top row of a dark summary card: the nivo logo on the left like a card brand mark, an optional chip on the right,
 *  and what the card shows on the line below. */
export function HeroHead({ label, chip }: { label: React.ReactNode; chip?: React.ReactNode }) {
  return (
    <>
      <div className="hh"><Wordmark className="cw" />{chip != null && chip !== false && <span className="hd">{chip}</span>}</div>
      <div className="hl">{label}</div>
    </>
  );
}
