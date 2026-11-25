'use client'

import { useEffect, useRef, useState } from 'react'
import type { OrbPresentationState } from '@/lib/orbPresentation'
import { PALETTES } from '@/lib/appearance'

/** The orb from Eddie's "Codex Glass Direction" board (2026-10-30): a violet/
 *  teal fbm sphere with a rim, an orbiting teal sweep while thinking, and an
 *  outer ring while listening. No audio input.
 *
 *  Ember (#FFB05C) is reserved for a proven boomerang: a lesson that verifiably
 *  carried into a different mission. No such event exists yet, so the orb never
 *  shows ember. Do not use it for an ordinary finished reply (Eddie, 2026-10-30). */

export type CodexOrbState = 'idle' | 'listening' | 'thinking' | 'acting'

/** Codex states → orb modes. The board's `speaking` mode is never used:
 *  Codex has no real spoken reply. Ready/blocked/completed rest in idle;
 *  their meaning is carried by the host's live status text. */
export function codexOrbState(state: OrbPresentationState): CodexOrbState {
  if (state === 'listening' || state === 'thinking' || state === 'acting') return state
  return 'idle'
}

type Uniforms = { flow: number; rim: number; sweep: number; bright: number; ring: number; tintMix: number; tr: number; tg: number; tb: number }

/** Visual tone derived strictly from actual presentation/cognition states.
 *  - Ready / Idle: calm ambient movement; settled recommendation gets luminous clarity
 *  - Listening: responsive outer aura ring + heightened cyan-teal rim
 *  - Reconstructing / Acting: subtle violet-indigo illumination while assembling context
 *  - Thinking / Evaluating: focused warm luminous highlight + orbiting sweep (never #FFB05C Ember)
 *  - Interrupted (blocked): restrained, still, muted rose-slate state */
function targetUniforms(state: OrbPresentationState, cognition?: string): Uniforms {
  if (state === 'listening') {
    return { flow: 0.62, rim: 1.0, sweep: 0.08, bright: 0.98, ring: 1.0, tintMix: 0.22, tr: 0.14, tg: 0.86, tb: 0.80 }
  }
  if (state === 'blocked') {
    return { flow: 0.08, rim: 0.22, sweep: 0.0, bright: 0.58, ring: 0.0, tintMix: 0.55, tr: 0.78, tg: 0.36, tb: 0.44 }
  }
  if (state === 'thinking') {
    return { flow: 1.12, rim: 0.76, sweep: 1.0, bright: 1.06, ring: 0.12, tintMix: 0.32, tr: 0.89, tg: 0.75, tb: 0.41 }
  }
  if (state === 'acting') {
    const reconstructing = cognition === 'reconstructing'
    return reconstructing
      ? { flow: 0.68, rim: 0.82, sweep: 0.42, bright: 1.0, ring: 0.35, tintMix: 0.36, tr: 0.56, tg: 0.45, tb: 1.0 }
      : { flow: 0.78, rim: 0.96, sweep: 0.48, bright: 1.04, ring: 0.58, tintMix: 0.24, tr: 0.22, tg: 0.84, tb: 0.86 }
  }
  if (state === 'ready') {
    return { flow: 0.26, rim: 0.56, sweep: 0.0, bright: 0.96, ring: 0.0, tintMix: 0.14, tr: 0.20, tg: 0.84, tb: 0.78 }
  }
  return { flow: 0.34, rim: 0.36, sweep: 0.0, bright: 0.86, ring: 0.0, tintMix: 0.0, tr: 0.42, tg: 0.36, tb: 1.0 }
}

const FRAG = `precision mediump float;
uniform vec2 uRes;uniform vec3 uPrimary,uSecondary,uTint;uniform float uPhase,uTime,uRim,uSweep,uBright,uRing,uTintMix,uLevel;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){vec2 p=(gl_FragCoord.xy*2.-uRes)/uRes.y;vec2 q=p/.82;float rr=length(q);float disc=1.-smoothstep(.985,1.,rr);
vec2 w=vec2(fbm(q*1.4+uPhase*.25),fbm(q*1.4+vec2(5.2,1.3)-uPhase*.2));float f=fbm(q*1.6+w*1.8+vec2(uPhase*.15,-uPhase*.1));
vec3 violet=mix(uPrimary,uTint,uTintMix*.65),teal=mix(uSecondary,uTint,uTintMix*.55),ink=vec3(.05,.06,.14);
vec3 col=mix(ink,violet,smoothstep(.25,.7,f));col=mix(col,teal,smoothstep(.5,.95,fbm(q*2.+w*2.-uPhase*.2))*.9);
float wave=sin(q.y*3.+f*6.+uPhase*.8)*.5+.5;col+=teal*wave*(.16+.12*uLevel)*uBright;
float rim=smoothstep(.55,1.,rr)*disc;col+=mix(violet,teal,.5+.5*sin(uPhase))*rim*(.35+.9*uRim+.28*uLevel);
float a=atan(q.y,q.x);float s=pow(max(0.,cos(a-uPhase*2.2)),8.);col+=mix(teal,uTint,uTintMix)*s*rim*1.45*uSweep;
col*=(uBright+.14*uLevel)*(.85+.3*f);float ringR=1.12+.04*sin(uTime*2.)+.045*uLevel;float ring=exp(-pow((rr-ringR)*14.,2.))*max(uRing,uLevel*.75);
float alpha=max(disc,ring*.7);vec3 o=col*disc+mix(teal,uTint,uTintMix*.5)*ring*.7+(h(gl_FragCoord.xy+uTime)-.5)*.04*disc;
gl_FragColor=vec4(min(max(o,0.),vec3(alpha)),alpha);}`
const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'
const UNIFORMS = ['uRes', 'uPrimary', 'uSecondary', 'uTint', 'uPhase', 'uTime', 'uRim', 'uSweep', 'uBright', 'uRing', 'uTintMix', 'uLevel'] as const

/** Codex's calm control (`data-reduced-motion`) or the OS setting. */
function useStill() {
  const [still, setStill] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setStill(media.matches || (root.dataset.reducedMotion === 'true' || root.dataset.motion === 'reduced'))
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['data-reduced-motion', 'data-motion'] })
    media.addEventListener('change', read)
    return () => { observer.disconnect(); media.removeEventListener('change', read) }
  }, [])
  return still
}

export default function CodexOrb({ state, cognition }: { state: OrbPresentationState; cognition?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef<Uniforms>(targetUniforms(state, cognition))
  const kickRef = useRef<() => void>(() => {})
  const [fallback, setFallback] = useState(false)
  const still = useStill()

  useEffect(() => {
    targetRef.current = targetUniforms(state, cognition)
    kickRef.current()
  }, [state, cognition])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
    if (!gl) { setFallback(true); return }

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const program = gl.createProgram()!
    const vertexShader = shader(gl.VERTEX_SHADER, VERT)
    const fragmentShader = shader(gl.FRAGMENT_SHADER, FRAG)
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteShader(vertexShader); gl.deleteShader(fragmentShader); gl.deleteProgram(program); setFallback(true); return }
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const U = Object.fromEntries(UNIFORMS.map(k => [k, gl.getUniformLocation(program, k)])) as Record<typeof UNIFORMS[number], WebGLUniformLocation | null>

    const cur: Uniforms = { ...targetRef.current }
    let phase = 3
    let last = 0
    let raf = 0
    let visible = true
    let lost = false
    let primary: readonly number[] = [0.416, 0.361, 1]
    let secondary: readonly number[] = [0.133, 0.827, 0.745]
    let motion = 1
    const paletteObserver = new MutationObserver(() => { readPalette(); kick() })
    const readPalette = () => {
      const id = document.documentElement.dataset.palette as keyof typeof PALETTES
      const palette = PALETTES[id] ?? PALETTES.aurora
      const rgb = (hex: string) => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255)
      primary = rgb(palette.primary)
      secondary = rgb(palette.secondary)
      motion = document.documentElement.dataset.motion === 'soft' ? 0.35 : 1
    }
    readPalette()
    paletteObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette', 'data-motion'] })

    let level = 0
    const draw = (t: number) => {
      if (lost) return
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(U.uRes, canvas.width, canvas.height)
      gl.uniform3f(U.uPrimary, primary[0], primary[1], primary[2])
      gl.uniform3f(U.uSecondary, secondary[0], secondary[1], secondary[2])
      gl.uniform3f(U.uTint, cur.tr, cur.tg, cur.tb)
      gl.uniform1f(U.uPhase, phase)
      gl.uniform1f(U.uTime, t)
      gl.uniform1f(U.uRim, cur.rim)
      gl.uniform1f(U.uSweep, cur.sweep)
      gl.uniform1f(U.uBright, cur.bright)
      gl.uniform1f(U.uRing, cur.ring)
      gl.uniform1f(U.uTintMix, cur.tintMix)
      gl.uniform1f(U.uLevel, still ? 0 : level)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const frame = (ts: number) => {
      const dt = Math.min((ts - last) / 1000, 0.05)
      last = ts
      const k = Math.min(1, dt * 5)
      const tgt = targetRef.current
      for (const key of Object.keys(cur) as (keyof Uniforms)[]) cur[key] += (tgt[key] - cur[key]) * k
      // Read actual real-time microphone/playback amplitude published by CodexLiveVoice (0 when idle).
      const rawLevel = Number.parseFloat(document.documentElement.style.getPropertyValue('--codex-voice-level') || '0')
      const targetLevel = Number.isFinite(rawLevel) ? Math.max(0, Math.min(1, rawLevel)) : 0
      level += (targetLevel - level) * Math.min(1, dt * 12)
      phase += dt * (cur.flow + level * 0.45) * motion
      draw(phase)
      raf = 0
      kick()
    }
    const kick = () => {
      if (still) { Object.assign(cur, targetRef.current); draw(0); return }
      if (!raf && visible && !document.hidden && !lost) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    kickRef.current = kick

    // The host resizes this same canvas between the Mission stage and the
    // dock; resizing clears it, so redraw at the new size.
    const resize = () => {
      // Layout size, not getBoundingClientRect: the host glides with a scale
      // transform, and a mid-glide rect would lock in a tiny buffer.
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      if (!cw || !ch) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(cw * dpr)
      const h = Math.round(ch * dpr)
      if (canvas.width === w && canvas.height === h) return
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      draw(performance.now() / 1000)
    }
    resize()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    ro?.observe(canvas)
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true
      kick()
    })
    io?.observe(canvas)
    const onLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(raf); raf = 0 }
    const onRestored = () => setFallback(true)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    document.addEventListener('visibilitychange', kick)
    kick()

    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      paletteObserver.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      document.removeEventListener('visibilitychange', kick)
      gl.deleteBuffer(buffer)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteProgram(program)
      kickRef.current = () => {}
    }
  }, [still])

  return (
    <div className="codex-orb-stage" aria-hidden="true">
      {fallback
        ? <div className="codex-orb codex-orb-fallback" />
        : (
          // The box sets the size; the canvas fills it, so its pixel size
          // can never feed back into layout.
          <div className="codex-orb"><canvas ref={canvasRef} /></div>
        )}
    </div>
  )
}
