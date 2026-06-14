// Landing page del prototipo ai.udit_, convertita a Next.js client component.
// Sezioni: Nav, Hero, Ticker, Problem, HowItWorks, SampleReport, Comparison,
// Pricing, FAQ, Footer. Stili inline preservati identici al prototipo.

"use client"

import Link from "next/link"
import { useState, type CSSProperties } from "react"
import { ScoreGauge, RadarChart5D } from "@/components/visuals"

const navLinkStyle: CSSProperties = {
  color: "#a3a3a3",
  textDecoration: "none",
  fontSize: 12,
  letterSpacing: "0.04em",
}

function Nav() {
  return (
    <div
      style={{
        borderBottom: "1px solid #1f1f1f",
        padding: "16px 48px",
        display: "flex",
        alignItems: "center",
        gap: 32,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        color: "#a3a3a3",
        position: "sticky",
        top: 0,
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 50,
      }}
    >
      <span
        style={{
          color: "#fafafa",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.08em",
        }}
      >
        ai.udit<span style={{ color: "#22e36a" }}>_</span>
      </span>
      <span style={{ color: "#404040" }}>·</span>
      <span style={{ fontSize: 11, letterSpacing: "0.18em", color: "#525252" }}>
        VALIDAZIONE PRODOTTI · DROPSHIPPING & ECOM
      </span>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          gap: 24,
          alignItems: "center",
        }}
      >
        <a href="#come-funziona" style={navLinkStyle}>
          Come funziona
        </a>
        <a href="#confronto" style={navLinkStyle}>
          Confronto
        </a>
        <a href="#prezzi" style={navLinkStyle}>
          Prezzi
        </a>
        <a href="#faq" style={navLinkStyle}>
          FAQ
        </a>
        <Link
          href="/analyze"
          style={{
            background: "#22e36a",
            border: "none",
            color: "#0a0a0a",
            padding: "10px 20px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.18em",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          ANALIZZA UN PRODOTTO →
        </Link>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <div
      style={{
        padding: "100px 48px 80px",
        maxWidth: 1280,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            background: "#22e36a",
            borderRadius: 999,
            boxShadow: "0 0 8px #22e36a",
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "#22e36a",
          }}
        >
          AGENTE AI · 5 WORKER · 60-180 SECONDI
        </span>
      </div>

      <h1
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 110,
          fontWeight: 400,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          margin: 0,
          marginBottom: 32,
          color: "#fafafa",
        }}
      >
        Sai se questo prodotto<br />
        venderà davvero.<br />
        <span style={{ fontStyle: "italic", color: "#737373" }}>
          In due minuti.
        </span>
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 64,
          alignItems: "flex-end",
          marginTop: 56,
        }}
      >
        <div>
          <p
            style={{
              color: "#a3a3a3",
              fontSize: 18,
              lineHeight: 1.55,
              maxWidth: 520,
              marginBottom: 32,
            }}
          >
            Minea ti dice <em>cosa</em> sta vendendo. Noi ti diciamo se va bene{" "}
            <strong style={{ color: "#fafafa" }}>
              per il tuo budget, il tuo canale, le tue capacità creative
            </strong>
            . Niente liste di prodotti virali. Un verdetto operativo, calibrato
            sul tuo setup.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link
              href="/analyze"
              style={{
                background: "#22e36a",
                border: "none",
                color: "#0a0a0a",
                padding: "20px 32px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                letterSpacing: "0.2em",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              ANALIZZA UN PRODOTTO →
            </Link>
            <Link
              href="/esempio"
              style={{
                background: "transparent",
                border: "1px solid #1f1f1f",
                color: "#fafafa",
                padding: "20px 28px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                letterSpacing: "0.2em",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              VEDI UN ESEMPIO
            </Link>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#525252",
              letterSpacing: "0.18em",
              marginTop: 20,
            }}
          >
            €9,90 UNA TANTUM · NO SUBSCRIPTION · NO BULLSHIT
          </div>
        </div>

        <div style={{ borderLeft: "1px solid #1f1f1f", paddingLeft: 32 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.28em",
              color: "#525252",
              marginBottom: 16,
            }}
          >
            ANALISI #2247 · MASSAGGIATORE CERVICALE · TIKTOK SHOP IT
          </div>
          <div style={{ marginLeft: -16 }}>
            <ScoreGauge score={57} color="giallo" size={280} animated />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 4,
              marginTop: 16,
            }}
          >
            {[
              { l: "DEM", v: 49, c: "#f97316" },
              { l: "SAT", v: 25, c: "#ef4444" },
              { l: "ECO", v: 67, c: "#eab308" },
              { l: "FIT", v: 58, c: "#eab308" },
              { l: "RSK", v: 90, c: "#22e36a" },
            ].map((d) => (
              <div key={d.l} style={{ borderTop: `2px solid ${d.c}`, paddingTop: 8 }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "#525252",
                    letterSpacing: "0.2em",
                  }}
                >
                  {d.l}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 16,
                    color: d.c,
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 2,
                  }}
                >
                  {d.v}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              padding: "12px 14px",
              border: "1px solid #1f1f1f",
              background: "#0c0c0c",
              fontFamily: "'Fraunces', serif",
              fontSize: 13,
              lineHeight: 1.5,
              color: "#a3a3a3",
            }}
          >
            <span style={{ color: "#eab308" }}>"</span> Economicamente solido ma
            capacità creativa inadeguata per TikTok Shop.{" "}
            <span style={{ color: "#fafafa" }}>Evita il test immediato.</span>{" "}
            <span style={{ color: "#eab308" }}>"</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Ticker() {
  return (
    <div
      style={{
        borderTop: "1px solid #1f1f1f",
        borderBottom: "1px solid #1f1f1f",
        padding: "16px 0",
        overflow: "hidden",
        background: "#0c0c0c",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 56,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#525252",
          letterSpacing: "0.22em",
          whiteSpace: "nowrap",
          animation: "marquee 40s linear infinite",
        }}
      >
        {[0, 1, 2].map((k) => (
          <div key={k} style={{ display: "flex", gap: 56 }}>
            <span>
              · DEMAND <span style={{ color: "#22e36a" }}>+12%</span>
            </span>
            <span>
              · META AD LIBRARY <span style={{ color: "#fafafa" }}>SCANNED</span>
            </span>
            <span>
              · TIKTOK SHOP IT{" "}
              <span style={{ color: "#eab308" }}>15K SKU TRACKED</span>
            </span>
            <span>
              · VETO RULES <span style={{ color: "#ef4444" }}>87 ATTIVE</span>
            </span>
            <span>
              · COSTO MEDIO ANALISI{" "}
              <span style={{ color: "#22e36a" }}>€0,15</span>
            </span>
            <span>
              · FONTI MEDIE <span style={{ color: "#fafafa" }}>~47</span>
            </span>
            <span>
              · DURATA MEDIANA <span style={{ color: "#fafafa" }}>01:42</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Problem() {
  return (
    <div style={{ padding: "120px 48px", maxWidth: 1280, margin: "0 auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.4fr 1fr",
          gap: 48,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "#525252",
            paddingTop: 16,
          }}
        >
          § PROBLEMA
        </div>
        <div>
          <h2
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 56,
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              margin: 0,
              marginBottom: 32,
              color: "#fafafa",
            }}
          >
            Gli "spy tools" mostrano cosa vende. Ma{" "}
            <span style={{ fontStyle: "italic", color: "#22e36a" }}>
              vendere agli altri
            </span>{" "}
            non significa{" "}
            <span style={{ fontStyle: "italic", color: "#22e36a" }}>
              vendere a te
            </span>
            .
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              background: "#1f1f1f",
              border: "1px solid #1f1f1f",
              marginTop: 32,
            }}
          >
            <div style={{ background: "#0a0a0a", padding: 32 }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  color: "#ef4444",
                  marginBottom: 12,
                }}
              >
                SENZA VALIDAZIONE
              </div>
              <p style={{ fontSize: 16, lineHeight: 1.55, color: "#d4d4d4", margin: 0 }}>
                Vedi un prodotto trending su Minea. Lanci 800€ in ads. Dopo 10
                giorni il ROAS è 0.8 e scopri che ti serviva UGC video, che il
                margine non reggeva il CPM, o che il tuo canale era saturo.{" "}
                <span style={{ color: "#fafafa" }}>
                  Bruci 600€ per imparare quello che potevi sapere prima.
                </span>
              </p>
            </div>
            <div style={{ background: "#0a0a0a", padding: 32 }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  color: "#22e36a",
                  marginBottom: 12,
                }}
              >
                CON AI.UDIT
              </div>
              <p style={{ fontSize: 16, lineHeight: 1.55, color: "#d4d4d4", margin: 0 }}>
                Inserisci il prodotto e il tuo setup (budget, canale, capacità
                creative). 5 worker AI in parallelo controllano domanda,
                saturazione, economia, fit operativo, rischio.{" "}
                <span style={{ color: "#22e36a" }}>
                  Ricevi un verdetto operativo in 2 minuti, calibrato su di te.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Inserisci il prodotto",
      d: "Nome, link opzionale, COGS stimato. Più dati metti, più precisa la validazione — ma nessun campo richiesto oltre nome e budget.",
      focus: "INPUT · 90 SECONDI",
    },
    {
      n: "02",
      t: "L'agente lavora in parallelo",
      d: "5 worker AI (domanda, saturazione, economia, fit, rischio) interrogano Google Trends, TikTok, Meta Ad Library, Amazon, fonti normative. Vedi lo stream di pensieri in diretta.",
      focus: "ANALISI · 60-180 SECONDI",
    },
    {
      n: "03",
      t: "Ricevi il verdetto",
      d: "Score 0-100 con colore, radar 5D, breakdown per dimensione con confidenza dei dati, strengths/risks, raccomandazione operativa narrativa, deep-dive economico se i dati sono solidi.",
      focus: "REPORT · IMMEDIATO",
    },
  ]
  return (
    <div
      id="come-funziona"
      style={{
        padding: "120px 48px",
        maxWidth: 1280,
        margin: "0 auto",
        borderTop: "1px solid #1f1f1f",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 56 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "#525252",
          }}
        >
          § COME FUNZIONA
        </span>
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 48,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "#fafafa",
          }}
        >
          Tre passaggi, due minuti.
        </h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "#1f1f1f",
          border: "1px solid #1f1f1f",
        }}
      >
        {steps.map((s) => (
          <div
            key={s.n}
            style={{ background: "#0a0a0a", padding: "40px 32px 36px", position: "relative" }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.28em",
                color: "#22e36a",
                marginBottom: 16,
              }}
            >
              {s.focus}
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 88,
                color: "#1f1f1f",
                lineHeight: 0.85,
                marginBottom: 12,
                fontWeight: 400,
              }}
            >
              {s.n}
            </div>
            <h3
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 26,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                margin: 0,
                marginBottom: 12,
                color: "#fafafa",
              }}
            >
              {s.t}
            </h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a3a3a3", margin: 0 }}>
              {s.d}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SampleReport() {
  return (
    <div
      style={{
        padding: "120px 48px",
        maxWidth: 1280,
        margin: "0 auto",
        borderTop: "1px solid #1f1f1f",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 24 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "#525252",
          }}
        >
          § COSA OTTIENI
        </span>
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 48,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "#fafafa",
          }}
        >
          Un report che decide al tuo posto.
        </h2>
      </div>
      <p
        style={{
          color: "#a3a3a3",
          fontSize: 16,
          maxWidth: 720,
          marginBottom: 48,
          lineHeight: 1.55,
        }}
      >
        Niente liste. Niente "winning products". Un verdetto, scomposto in 5
        dimensioni, con il livello di affidabilità di ogni dato — perché
        un'analisi onesta è meglio di una sicura ma sbagliata.
      </p>

      <div
        style={{
          border: "1px solid #1f1f1f",
          background: "#0c0c0c",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid #1f1f1f",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "#525252",
            letterSpacing: "0.2em",
          }}
        >
          <span style={{ width: 8, height: 8, background: "#eab308", borderRadius: 999 }} />
          REPORT · MASSAGGIATORE CERVICALE · TIKTOK SHOP IT · 07/05/2026
          <span style={{ marginLeft: "auto" }}>JOB #A8M3KQ7</span>
        </div>
        <div
          style={{
            padding: "40px 48px",
            display: "grid",
            gridTemplateColumns: "auto 1fr 1fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <ScoreGauge score={57} color="giallo" size={240} animated={false} />
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.28em",
                color: "#eab308",
                marginBottom: 12,
              }}
            >
              VERDETTO
            </div>
            <p
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 19,
                lineHeight: 1.5,
                color: "#e5e5e5",
                margin: 0,
              }}
            >
              Economicamente solido (75% margine, breakeven ROAS 2.34) ma con
              domanda invisibile e capacità creative inadeguate al canale.{" "}
              <span style={{ color: "#eab308" }}>
                Risolvi il gap UGC prima del test.
              </span>
            </p>
          </div>
          <RadarChart5D
            scores={{
              demand: { score: 49, dataConfidence: "low" },
              saturation: { score: 25, dataConfidence: "medium" },
              economics: { score: 67, dataConfidence: "high" },
              fit: { score: 58, dataConfidence: "high" },
              risk: { score: 90, dataConfidence: "medium" },
            }}
            color="giallo"
            size={260}
          />
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <Link
          href="/esempio"
          style={{
            background: "transparent",
            border: "1px solid #22e36a55",
            color: "#22e36a",
            padding: "16px 32px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            letterSpacing: "0.2em",
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          ESPLORA IL REPORT COMPLETO →
        </Link>
      </div>
    </div>
  )
}

interface ComparisonRow {
  f: string
  a: boolean | "partial"
  m: boolean | "partial"
  e: boolean | "partial"
  p: boolean | "partial"
}

function Comparison() {
  const rows: ComparisonRow[] = [
    { f: "Mostra prodotti che vendono", a: true, m: true, e: true, p: true },
    { f: "Valuta se va bene per il TUO setup", a: true, m: false, e: false, p: false },
    { f: "Verdetto narrativo, non solo metrica", a: true, m: false, e: false, p: false },
    { f: "Confidenza dei dati esposta", a: true, m: false, e: false, p: false },
    { f: "Veto su rischi legali / policy", a: true, m: false, e: false, p: false },
    { f: "Unit economics calibrate sul budget", a: true, m: false, e: false, p: "partial" },
    { f: "Calibrato su mercato italiano", a: true, m: "partial", e: false, p: "partial" },
    { f: "Una tantum, no abbonamento", a: true, m: false, e: false, p: false },
    { f: "Nessuna lista di 'winning products'", a: true, m: false, e: false, p: false },
  ]
  const cell = (v: boolean | "partial") =>
    v === true ? (
      <span style={{ color: "#22e36a" }}>●</span>
    ) : v === "partial" ? (
      <span style={{ color: "#eab308" }}>◐</span>
    ) : (
      <span style={{ color: "#404040" }}>○</span>
    )

  return (
    <div
      id="confronto"
      style={{
        padding: "120px 48px",
        maxWidth: 1280,
        margin: "0 auto",
        borderTop: "1px solid #1f1f1f",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 48 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "#525252",
          }}
        >
          § CONFRONTO
        </span>
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 48,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "#fafafa",
          }}
        >
          Cosa fanno i competitor.{" "}
          <span style={{ fontStyle: "italic", color: "#737373" }}>
            Cosa facciamo noi.
          </span>
        </h2>
      </div>

      <div style={{ border: "1px solid #1f1f1f", background: "#0c0c0c" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            padding: "20px 24px",
            borderBottom: "1px solid #1f1f1f",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "#737373",
          }}
        >
          <div>FUNZIONALITÀ</div>
          <div style={{ textAlign: "center", color: "#22e36a" }}>AI.UDIT</div>
          <div style={{ textAlign: "center" }}>MINEA</div>
          <div style={{ textAlign: "center" }}>ECOMHUNT</div>
          <div style={{ textAlign: "center" }}>PIPIADS</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              padding: "16px 24px",
              borderBottom: i === rows.length - 1 ? "none" : "1px solid #1f1f1f",
              fontSize: 14,
              alignItems: "center",
            }}
          >
            <div style={{ color: "#d4d4d4" }}>{r.f}</div>
            <div style={{ textAlign: "center", fontSize: 16 }}>{cell(r.a)}</div>
            <div style={{ textAlign: "center", fontSize: 16 }}>{cell(r.m)}</div>
            <div style={{ textAlign: "center", fontSize: 16 }}>{cell(r.e)}</div>
            <div style={{ textAlign: "center", fontSize: 16 }}>{cell(r.p)}</div>
          </div>
        ))}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #1f1f1f",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "#525252",
            letterSpacing: "0.18em",
            display: "flex",
            gap: 24,
          }}
        >
          <span>
            <span style={{ color: "#22e36a" }}>●</span> COMPLETO
          </span>
          <span>
            <span style={{ color: "#eab308" }}>◐</span> PARZIALE
          </span>
          <span>
            <span style={{ color: "#404040" }}>○</span> ASSENTE
          </span>
          <span style={{ marginLeft: "auto" }}>
            FONTE: ANALISI INDIPENDENTE 04/2026
          </span>
        </div>
      </div>
    </div>
  )
}

function Pricing() {
  return (
    <div
      id="prezzi"
      style={{
        padding: "120px 48px",
        maxWidth: 1280,
        margin: "0 auto",
        borderTop: "1px solid #1f1f1f",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 56 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "#525252",
          }}
        >
          § PREZZI
        </span>
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 48,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "#fafafa",
          }}
        >
          Due piani. Niente sorprese.
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ border: "1px solid #1f1f1f", background: "#0c0c0c", padding: 40 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.28em",
              color: "#737373",
              marginBottom: 16,
            }}
          >
            UNA TANTUM
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
            <span
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 88,
                fontWeight: 400,
                letterSpacing: "-0.04em",
                color: "#fafafa",
              }}
            >
              €9,90
            </span>
            <span
              style={{
                color: "#737373",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
              }}
            >
              / analisi
            </span>
          </div>
          <p
            style={{
              color: "#a3a3a3",
              fontSize: 14,
              lineHeight: 1.55,
              marginBottom: 28,
            }}
          >
            Per chi vuole testare un singolo prodotto senza impegno. Stesso
            report, stessa profondità.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 32 }}>
            {[
              "1 analisi completa",
              "5 dimensioni · radar 5D",
              "Deep-dive economico",
              "Veto rules attive",
              "Export PDF",
              "Nessuna registrazione richiesta",
            ].map((f) => (
              <li
                key={f}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px dashed #1f1f1f",
                  fontSize: 14,
                  color: "#d4d4d4",
                }}
              >
                <span style={{ color: "#22e36a" }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/analyze"
            style={{
              display: "block",
              textAlign: "center",
              width: "100%",
              background: "transparent",
              border: "1px solid #fafafa",
              color: "#fafafa",
              padding: "18px 24px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.2em",
              fontWeight: 500,
              cursor: "pointer",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            ANALIZZA UN PRODOTTO →
          </Link>
        </div>

        <div
          style={{
            border: "1px solid #22e36a55",
            background:
              "linear-gradient(135deg, #22e36a08 0%, #0c0c0c 60%)",
            padding: 40,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.24em",
              color: "#22e36a",
              border: "1px solid #22e36a55",
              padding: "4px 10px",
            }}
          >
            CONSIGLIATO
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.28em",
              color: "#22e36a",
              marginBottom: 16,
            }}
          >
            PRO · ABBONAMENTO
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
            <span
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 88,
                fontWeight: 400,
                letterSpacing: "-0.04em",
                color: "#fafafa",
              }}
            >
              €49
            </span>
            <span
              style={{
                color: "#737373",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
              }}
            >
              / mese
            </span>
          </div>
          <p
            style={{
              color: "#a3a3a3",
              fontSize: 14,
              lineHeight: 1.55,
              marginBottom: 28,
            }}
          >
            Per chi valida 5+ prodotti al mese. Cancellabile in qualsiasi
            momento, no vincoli annuali.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 32 }}>
            {[
              "30 analisi al mese",
              "Storico analisi salvato",
              "Confronto tra analisi",
              "Webhook · API export",
              "Supporto prioritario in IT",
              "Tutto incluso del piano una tantum",
            ].map((f) => (
              <li
                key={f}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px dashed #1f1f1f",
                  fontSize: 14,
                  color: "#d4d4d4",
                }}
              >
                <span style={{ color: "#22e36a" }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/analyze"
            style={{
              display: "block",
              textAlign: "center",
              width: "100%",
              background: "#22e36a",
              border: "none",
              color: "#0a0a0a",
              padding: "18px 24px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.2em",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            INIZIA CON PRO →
          </Link>
        </div>
      </div>
    </div>
  )
}

function FAQ() {
  const items = [
    {
      q: "Quanto è accurata l'analisi?",
      a: "Dipende dalla qualità dei dati disponibili. Per questo esponiamo la confidenza di ogni dimensione (alta/media/bassa/sconosciuta). Una dimensione 'bassa' è esplicitamente segnata: non te la vendiamo come verità. La maggior parte delle analisi raggiunge confidenza media-alta su almeno 4 delle 5 dimensioni.",
    },
    {
      q: "Che fonti usate?",
      a: "Google Trends, TikTok (scraping pubblico), Meta Ad Library, Amazon BSR & marketplace, fonti normative ufficiali (Ministero Salute IT, ECHA EU), e database interni di benchmark CPM/CPA per canale e mercato. Nessun dato proprietario di terzi a pagamento — usiamo solo fonti pubbliche aggiornate.",
    },
    {
      q: "Posso chiedere un rimborso?",
      a: "Sì, se l'analisi fallisce per problemi nostri (worker crashati, dati incompleti < 60% di integrità) ti rimborsiamo automaticamente. Per analisi completate il rimborso è discrezionale: scrivici e valutiamo.",
    },
    {
      q: "I dati sono privati?",
      a: "Le analisi non vengono condivise né usate per training. Manteniamo log anonimizzati per 30 giorni a fini di debug, poi vengono cancellati. Nessun dato viene venduto a terzi. Vedi la Privacy Policy per i dettagli.",
    },
    {
      q: "Funziona solo per dropshipping?",
      a: "No. Il modello è ottimizzato per dropshipper e brand ecommerce su TikTok Shop, Shopify+Meta/TikTok, Amazon FBA. Per casi più complessi (B2B, marketplace nicchia, white-label industriale) i dati di fit potrebbero essere meno calibrati — è segnalato in confidence.",
    },
    {
      q: "Perché non c'è un free trial?",
      a: "Ogni analisi ci costa circa €0,15 di compute + fonti. Non possiamo permettercelo gratis senza degradare la qualità per i paganti. €9,90 una tantum è il modo più onesto per provare il prodotto.",
    },
  ]
  const [open, setOpen] = useState<number>(0)
  return (
    <div
      id="faq"
      style={{
        padding: "120px 48px",
        maxWidth: 1280,
        margin: "0 auto",
        borderTop: "1px solid #1f1f1f",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 64,
          alignItems: "flex-start",
        }}
      >
        <div style={{ position: "sticky", top: 100 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.28em",
              color: "#525252",
            }}
          >
            § FAQ
          </span>
          <h2
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 48,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              margin: "16px 0 0",
              color: "#fafafa",
            }}
          >
            Domande<br />ricorrenti.
          </h2>
        </div>
        <div>
          {items.map((it, i) => (
            <div
              key={i}
              style={{ borderTop: "1px solid #1f1f1f", padding: "20px 0" }}
            >
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontFamily: "'Fraunces', serif",
                  fontSize: 22,
                  color: "#fafafa",
                  textAlign: "left",
                  letterSpacing: "-0.005em",
                }}
              >
                <span>{it.q}</span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    color: "#737373",
                    marginLeft: 16,
                    transition: "transform 0.2s",
                    transform: open === i ? "rotate(45deg)" : "none",
                  }}
                >
                  +
                </span>
              </button>
              {open === i && (
                <p
                  style={{
                    marginTop: 16,
                    color: "#a3a3a3",
                    fontSize: 15,
                    lineHeight: 1.6,
                    maxWidth: 640,
                  }}
                >
                  {it.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <div
      style={{
        borderTop: "1px solid #1f1f1f",
        padding: "48px 48px 32px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 32,
          marginBottom: 48,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              color: "#fafafa",
              fontWeight: 500,
              letterSpacing: "0.08em",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ai.udit<span style={{ color: "#22e36a" }}>_</span>
          </div>
          <p
            style={{
              color: "#737373",
              fontSize: 13,
              marginTop: 12,
              maxWidth: 320,
              lineHeight: 1.55,
            }}
          >
            Validazione algoritmica di prodotti per dropshipper e brand
            ecommerce. Made in Italy con cura.
          </p>
        </div>
        {[
          { t: "Prodotto", l: ["Come funziona", "Esempio report", "Prezzi", "API"] },
          { t: "Risorse", l: ["Blog", "Casi studio", "Glossario", "Changelog"] },
          { t: "Legali", l: ["Termini di servizio", "Privacy", "Cookie", "Contatti"] },
        ].map((c) => (
          <div key={c.t}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.24em",
                color: "#525252",
                marginBottom: 14,
              }}
            >
              {c.t.toUpperCase()}
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {c.l.map((i) => (
                <li key={i}>
                  <a
                    href="#"
                    style={{
                      color: "#a3a3a3",
                      textDecoration: "none",
                      fontSize: 13,
                    }}
                  >
                    {i}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        style={{
          paddingTop: 24,
          borderTop: "1px solid #1f1f1f",
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "#525252",
          letterSpacing: "0.18em",
        }}
      >
        <span>© 2026 AI.UDIT · TUTTI I DIRITTI RISERVATI</span>
        <span>BUILT IN ITALY · POWERED BY ANTHROPIC API</span>
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div style={{ background: "#0a0a0a", color: "#fafafa", minHeight: "100vh" }}>
      <Nav />
      <Hero />
      <Ticker />
      <Problem />
      <HowItWorks />
      <SampleReport />
      <Comparison />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  )
}
