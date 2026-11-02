'use client';

import { Component, createRef, type ReactNode } from 'react';

interface GlideProps {
  /** when this value changes, elements marked data-glide slide from where they were to where they now are */
  token: unknown;
  children: ReactNode;
}

const DURATION_MS = 280;

/**
 * The orb moves from the big centred spot to a small one above the conversation when the first words arrive. As a plain layout
 * change that is a 170px jump in one frame (field test, 2 Nov 2026: "it wasn't looking smooth"). Here the old position is read
 * just before React updates the page, and the element is animated from there with a transform, which neither janks the layout
 * nor counts as a layout shift. data-glide-scale also scales it between the two sizes. Reduced motion: no glide.
 */
export class Glide extends Component<GlideProps> {
  private root = createRef<HTMLDivElement>();

  private marked(): HTMLElement[] {
    return Array.from(this.root.current?.querySelectorAll<HTMLElement>('[data-glide]') ?? []);
  }

  getSnapshotBeforeUpdate(prev: GlideProps): Map<string, DOMRect> | null {
    if (Object.is(prev.token, this.props.token)) return null;
    return new Map(this.marked().map((el) => [el.dataset.glide as string, el.getBoundingClientRect()]));
  }

  componentDidUpdate(_prev: GlideProps, _state: unknown, before: Map<string, DOMRect> | null) {
    if (!before || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (const el of this.marked()) {
      const from = before.get(el.dataset.glide as string);
      if (!from || typeof el.animate !== 'function') continue;
      const to = el.getBoundingClientRect();
      const scale = el.dataset.glideScale !== undefined && to.width > 0 ? from.width / to.width : 1;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(scale - 1) < 0.01) continue;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, transformOrigin: 'top left' },
          { transform: 'none', transformOrigin: 'top left' },
        ],
        { duration: DURATION_MS, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
      );
    }
  }

  render() {
    return (
      <div ref={this.root} style={{ display: 'contents' }}>
        {this.props.children}
      </div>
    );
  }
}
