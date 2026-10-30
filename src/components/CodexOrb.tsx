'use client'

import { useEffect, useRef, useState } from 'react'
import type { OrbPresentationState } from '@/lib/orbPresentation'

/** The orb from Eddie's "Codex Glass Direction" board (2026-10-30): a violet/
 *  teal fbm sphere with a rim, an orbiting teal sweep while thinking, and an
 *  outer ring while listening. No audio input.
 *
 *  Ember (#FFB05C) is reserved for a proven boomerang: a lesson that verifiably
 *  carried into a different mission. No such event exists yet, so the orb never
 *  shows ember. Do not use it for an ordinary finished reply (Eddie, 2026-10-30). */

export type CodexOrbState = 'idle' | 'listening' | 'thinking'

/** Codex states → orb modes. The board's `speaking` mode is never used:
 *  Codex has no real spoken reply. Ready/blocked/completed rest in idle;
 *  their meaning is carried by the host's live status text. */
export function codexOrbState(state: OrbPresentationState): CodexOrbState {
  if (state === 'listening' || state === 'thinking') return state
  return 'idle'
}

type Uniforms = { flow: number; rim: number; sweep: number; bright: number; ring: number }
const TARGETS: Record<CodexOrbState, Uniforms> = {
  idle: { flow: 0.35, rim: 0.35, sweep: 0, bright: 0.85, ring: 0 },
  listening: { flow: 0.6, rim: 1.0, sweep: 0, bright: 0.95, ring: 1 },
  thinking: { flow: 1.1, rim: 0.6, sweep: 1, bright: 1.0, ring: 0 },
}

const FRAG = `precision mediump float;
uniform vec2 uRes;uniform float uPhase,uTime,uRim,uSweep,uBright,uRing;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){vec2 p=(gl_FragCoord.xy*2.-uRes)/uRes.y;vec2 q=p/.72;float rr=length(q);float disc=smoothstep(1.,.985,rr);
vec2 w=vec2(fbm(q*1.4+uPhase*.25),fbm(q*1.4+vec2(5.2,1.3)-uPhase*.2));float f=fbm(q*1.6+w*1.8+vec2(uPhase*.15,-uPhase*.1));
vec3 violet=vec3(.416,.361,1.),teal=vec3(.133,.827,.745),ink=vec3(.05,.06,.14);
vec3 col=mix(ink,violet,smoothstep(.25,.7,f));col=mix(col,teal,smoothstep(.5,.95,fbm(q*2.+w*2.-uPhase*.2))*.9);
float wave=sin(q.y*3.+f*6.+uPhase*.8)*.5+.5;col+=teal*wave*.16*uBright;
float rim=smoothstep(.55,1.,rr)*disc;col+=mix(violet,teal,.5+.5*sin(uPhase))*rim*(.35+.9*uRim);
float a=atan(q.y,q.x);float s=pow(max(0.,cos(a-uPhase*2.2)),8.);col+=teal*s*rim*1.4*uSweep;
col*=uBright*(.85+.3*f);float ringR=1.12+.05*sin(uTime*2.);float ring=exp(-pow((rr-ringR)*14.,2.))*uRing;
float alpha=max(disc,ring*.7);vec3 o=col*disc+teal*ring*.7+(h(gl_FragCoord.xy+uTime)-.5)*.04*disc;
gl_FragColor=vec4(min(max(o,0.),vec3(alpha)),alpha);}`
const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'
const UNIFORMS = ['uRes', 'uPhase', 'uTime', 'uRim', 'uSweep', 'uBright', 'uRing'] as const

/** Codex's calm control (`data-reduced-motion`) or the OS setting. */
function useStill() {
  const [still, setStill] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setStill(media.matches || root.dataset.reducedMotion === 'true')
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    media.addEventListener('change', read)
    return () => { observer.disconnect(); media.removeEventListener('change', read) }
  }, [])
  return still
}

export default function CodexOrb({ state }: { state: OrbPresentationState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef<Uniforms>(TARGETS.idle)
  const kickRef = useRef<() => void>(() => {})
  const [fallback, setFallback] = useState(false)
  const still = useStill()
  const mode = codexOrbState(state)

  useEffect(() => {
    targetRef.current = TARGETS[mode]
    kickRef.current()
  }, [mode])

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
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT))
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { setFallback(true); return }
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
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

    const draw = (t: number) => {
      if (lost) return
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(U.uRes, canvas.width, canvas.height)
      gl.uniform1f(U.uPhase, phase)
      gl.uniform1f(U.uTime, t)
      gl.uniform1f(U.uRim, cur.rim)
      gl.uniform1f(U.uSweep, cur.sweep)
      gl.uniform1f(U.uBright, cur.bright)
      gl.uniform1f(U.uRing, cur.ring)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const frame = (ts: number) => {
      const dt = Math.min((ts - last) / 1000, 0.05)
      last = ts
      const k = Math.min(1, dt * 5)
      const tgt = targetRef.current
      for (const key of Object.keys(cur) as (keyof Uniforms)[]) cur[key] += (tgt[key] - cur[key]) * k
      phase += dt * cur.flow
      draw(ts / 1000)
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
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      document.removeEventListener('visibilitychange', kick)
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
