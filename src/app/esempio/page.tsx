// Pagina /esempio — report statico hardcoded (fixture verdeAcceso del prototipo).
// Banner in cima invita a lanciare un'analisi reale. Niente fetch, niente API.

import Link from "next/link"
import { ReportPage, type ReportPageData } from "@/components/report"

const EXAMPLE_DATA: ReportPageData = {
  jobId: "esempio-verde-acceso",
  submittedAt: "2026-05-07T11:02:11.000Z",
  durationSec: 98,
  input: {
    productName: "Lampada da scrivania portatile ricaricabile a luce calda",
    productUrl: "aliexpress.com/item/100500995112.html",
    productCogs: 6.8,
    userBudget: 1200,
    userChannel: "shopify_meta",
    userMarket: "EU",
    userImageExperience: "proven",
    userVideoExperience: "intermediate",
  },
  report: {
    score: 87,
    color: "verde-acceso",
    verdict:
      "Lampada portatile ricaricabile da €6.80 COGS su Shopify+Meta EU: opportunità rara con margine lordo 86%, domanda in crescita +210% YoY su keyword 'desk lamp portable' e capacità creative UGC video adeguata al formato. Mercato non ancora saturo, finestra di test ottimale prima dell'estate.",
    strengths: [
      "Margine lordo 86% e breakeven ROAS 1.62 lasciano amplissimo spazio creativo: con budget €1200/mese puoi testare 5-7 angle prima di spegnere, scenario raro nel dropshipping attuale",
      "Domanda confermata: Google Trends EU mostra +210% YoY su 'portable desk lamp', TikTok 18M views su #portablelamp, 4 keyword correlate con volume >5k/mese",
      "Mercato concorrenziale ma frammentato: 30+ store Shopify attivi ma nessun brand dominante, finestra per posizionamento aesthetic/lifestyle ancora aperta",
    ],
    risks: [
      "Stagionalità marcata: la domanda cala 35% giugno-agosto, conviene partire ora per cavalcare il picco autunnale",
      "Margine apparente vs reale: shipping EU multi-paese può erodere 4-6 punti percentuali, attenzione alla scelta 3PL",
      "Categoria 'lampade' richiede certificazione CE-RoHS verificabile dal cliente: fornitore deve fornire documentazione",
    ],
    recommendation:
      "Lancia test scaling progressivo: 200€/giorno per 7 giorni con 3 angle UGC differenti (studio/cucina/comodino), audience EU broad 25-45. Se ROAS giorno 7 ≥ 1.8 raddoppia budget a 400€/giorno e attiva LAL 1% sui purchaser. Acquista 50 unità sample dal fornitore per verificare qualità reale prima del lancio. Setup ottimale: store Shopify minimal-aesthetic, prezzo €34.90, free shipping EU oltre €30.",
    breakdown: {
      demand: {
        score: 91,
        summary:
          "Trends +210% YoY EU, TikTok 18M views #portablelamp, 4 keyword cluster con volume >5k/mese, signal molto chiaro.",
        dataConfidence: "high",
      },
      saturation: {
        score: 78,
        summary:
          "30+ store attivi ma nessun brand dominante, Meta Ad Library mostra 12 advertiser, frammentazione favorevole.",
        dataConfidence: "high",
      },
      economics: {
        score: 92,
        summary:
          "COGS €6.80, retail €34.90, margine 86%, CPA stimato €9.10, breakeven ROAS 1.62 – molto sostenibile.",
        dataConfidence: "high",
        data: {
          estimatedCogs: 6.8,
          suggestedRetailPrice: 34.9,
          grossMarginPct: 0.86,
          estimatedCpm: 6.2,
          estimatedCpa: 9.1,
          breakevenRoas: 1.62,
          profitableAtUserBudget: true,
          expectedReturnRate: 0.025,
          categoryClassification: "Home / Lighting",
        },
      },
      fit: {
        score: 88,
        summary:
          "Capacity UGC video allineata al canale Shopify+Meta EU; formato prodotto fotogenico, story-driven.",
        dataConfidence: "high",
      },
      risk: {
        score: 85,
        summary:
          "Tasso reso atteso 5% (categoria home/lighting), nessun problema sicurezza segnalato, qualità in linea con benchmark.",
        dataConfidence: "high",
      },
    },
    totalCostEur: 0.142,
    complianceAlert: {
      severity: "warning",
      restrictedCategory: false,
      restrictedPlatforms: [],
      trademarkRisk: "low",
      trademarkDetails: null,
      ceComplianceRequired: true,
      reasons: [
        "Marcatura CE-RoHS richiesta per importazione/vendita EU. Verifica documentazione fornitore prima del lancio.",
      ],
    },
    dataIntegrity: 1.0,
    dataConfidenceByDimension: {
      demand: "high",
      saturation: "high",
      economics: "high",
      fit: "high",
      risk: "high",
    },
  },
}

export default function EsempioPage() {
  return (
    <>
      <div
        style={{
          background: "#0a0a0a",
          borderBottom: "1px solid #1f1f1f",
          padding: "14px 48px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#a3a3a3",
          letterSpacing: "0.18em",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: "#22e36a",
            borderRadius: 999,
            boxShadow: "0 0 8px #22e36a",
          }}
        />
        <span style={{ color: "#22e36a" }}>QUESTO È UN ESEMPIO REALE</span>
        <span style={{ color: "#404040" }}>·</span>
        <span style={{ color: "#737373" }}>
          fixture verdeAcceso · lampada da scrivania portatile su Shopify+Meta EU
        </span>
        <Link
          href="/analyze"
          style={{
            marginLeft: "auto",
            color: "#0a0a0a",
            background: "#22e36a",
            padding: "8px 16px",
            fontSize: 11,
            letterSpacing: "0.18em",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ANALIZZA IL TUO PRODOTTO →
        </Link>
      </div>
      <ReportPage data={EXAMPLE_DATA} pdfDownloadDisabled />
    </>
  )
}
