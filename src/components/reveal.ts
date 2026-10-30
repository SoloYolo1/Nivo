// Scroll reveal from 3.x: the cards of a page start slightly lowered and transparent, then rise into place
// one after another as they come into view, and their headline numbers count up.
import { useLayoutEffect, type RefObject } from 'react';

const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Count the number in an element's last text node up from zero, without replacing the node React owns. */
export function countUp(el: Element): void {
  const nodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && /\d/.test(n.nodeValue || ''));
  const node = nodes[nodes.length - 1] as Text | undefined;
  if (!node) return;
  const t = node.nodeValue || '';
  const m = t.match(/\d[\d,]*\.?\d*/);
  if (!m || m.index == null) return;
  const num = parseFloat(m[0].replace(/,/g, ''));
  if (!isFinite(num) || num === 0) return;
  const dec = (m[0].split('.')[1] || '').length, comma = m[0].includes(','), pre = t.slice(0, m.index), suf = t.slice(m.index + m[0].length);
  const t0 = performance.now();
  let last = t;
  const step = (now: number) => {
    if (node.nodeValue !== last) return; // React changed it meanwhile: leave its value alone
    const k = Math.min(1, (now - t0) / 900), v = num * (1 - Math.pow(1 - k, 3));
    if (k < 1) {
      last = node.nodeValue = pre + (comma ? v.toLocaleString('en-PK', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + suf;
      requestAnimationFrame(step);
    } else node.nodeValue = t;
  };
  requestAnimationFrame(step);
}

const KINDS = ['cd', 'g', 'qa', 'cap'];

export function useReveal(ref: RefObject<HTMLElement | null>, key: string): void {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduce() || typeof IntersectionObserver !== 'function') return undefined;
    const kids = Array.from(root.querySelectorAll(':scope > .pg > *')).filter((c) => KINDS.some((k) => c.classList.contains(k))) as HTMLElement[];
    kids.forEach((c) => { c.classList.add('rvw'); c.classList.remove('rv'); });
    let n = 0;
    const timers: number[] = [];
    const show = (c: HTMLElement) => {
      if (c.classList.contains('rv')) return;
      const d = Math.min(n++, 6) * 0.07;
      c.style.setProperty('--d', d + 's');
      if (c.classList.contains('g')) Array.from(c.children).forEach((k, i) => (k as HTMLElement).style.setProperty('--i', String(i)));
      c.classList.add('rv');
      timers.push(window.setTimeout(() => { n = Math.max(0, n - 1); }, 500));
      c.querySelectorAll('.v,.mh-v,.bignum b,.tri b').forEach(countUp);
      // once it has settled, hand the element back to plain styles
      timers.push(window.setTimeout(() => { c.classList.remove('rvw', 'rv'); c.style.removeProperty('--d'); }, d * 1000 + 1500));
    };
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); show(en.target as HTMLElement); } }), { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    kids.forEach((c) => io.observe(c));
    timers.push(window.setTimeout(() => kids.forEach(show), 3500));
    return () => { io.disconnect(); timers.forEach(clearTimeout); kids.forEach((c) => { c.classList.remove('rvw', 'rv'); c.style.removeProperty('--d'); }); };
  }, [key]);
}
