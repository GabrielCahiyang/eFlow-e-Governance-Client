import React, { useState } from "react";
import { Analytics, DocumentExport, Download, Search, View } from "@carbon/icons-react";
import { Btn, PageHeader, StatCard } from "./primitives";
import { adoptedOrdinances } from "./data";

const sampleResults = [
  {
    ordinance: "ORD-2025-038",
    title: "An Ordinance Imposing Fines for Illegal Dumping within the Eco-Park Zone",
    relevance: 97,
    excerpt: "SECTION 5. Penalties. — Any person caught illegally dumping waste within the designated Eco-Park Zone shall be fined not less than **₱5,000.00** and not more than **₱25,000.00** for the first offense, and not less than ₱25,000.00 and not more than ₱50,000.00 for subsequent offenses.",
    highlight: "₱5,000.00 and not more than ₱25,000.00",
    section: "Section 5, Paragraph 1",
  },
  {
    ordinance: "ORD-2025-035",
    title: "An Ordinance Establishing the Anti-Littering Program (#SHInEOrmoc)",
    relevance: 82,
    excerpt: "SECTION 8. Prohibited Acts within Eco-Zones. — The following acts are strictly prohibited: (a) Dumping of solid waste; (b) Discharge of liquid waste into waterways; (c) Open burning of waste materials.",
    highlight: "Dumping of solid waste",
    section: "Section 8, Paragraph 1",
  },
  {
    ordinance: "ORD-2024-041",
    title: "An Ordinance Declaring Ormoc City as a Plastic-Free Zone (Original)",
    relevance: 45,
    excerpt: "SECTION 3. Coverage. — This ordinance applies to all commercial establishments within the city, including areas adjacent to the Eco-Park development zone.",
    highlight: "Eco-Park development zone",
    section: "Section 3",
  },
];

export function SemanticSearch() {
  const [query, setQuery] = useState("What is the fine for illegal dumping in the Eco-Park?");
  const [hasSearched, setHasSearched] = useState(true);

  return (
    <div>
      <PageHeader
        title="AI Legal Research"
        subtitle="Adopted Ordinances Archive · NLP Semantic Search"
        actions={<>
          <Btn icon={<Download size={14} />} label="Export Results" />
        </>}
      />

      <div className="flex gap-3 mb-5 flex-wrap">
        <StatCard label="Ordinances Indexed" value={`${adoptedOrdinances.length}`} sub="In NLP corpus" />
        <StatCard label="Sections Parsed" value="156" sub="Full-text indexed" />
        <StatCard label="Avg. Response" value="0.4s" sub="NLP query time" trend="up" />
        <StatCard label="Accuracy" value="94%" sub="Relevance score" trend="up" />
      </div>

      {/* Google-style search interface */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Analytics size={20} className="text-blue-600" />
            <span className="text-[14px] font-semibold text-neutral-900">Ask the Legal Assistant</span>
          </div>
          <p className="text-[11px] font-normal text-neutral-500 mb-4">
            Ask questions in plain language. The NLP engine understands context, synonyms, and legal cross-references.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus-within:border-ring focus-within:bg-white focus-within:ring-2 focus-within:ring-ring/20 transition-colors">
              <Search size={18} className="text-neutral-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question about city ordinances…"
                className="flex-1 bg-transparent outline-none text-[13px] font-normal text-neutral-800 placeholder:text-neutral-400"
              />
            </div>
            <button
              onClick={() => setHasSearched(true)}
              className="rounded-xl bg-primary px-5 py-3 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-normal text-neutral-500">{sampleResults.length} results found in 0.4 seconds</span>
          </div>

          {sampleResults.map(r => (
            <div key={r.ordinance} className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-blue-200 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[11px] text-blue-600">{r.ordinance}</span>
                  <span className="text-[10px] font-normal text-neutral-400">·</span>
                  <span className="text-[10px] font-normal text-neutral-500">{r.section}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${r.relevance}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-blue-600">{r.relevance}% match</span>
                </div>
              </div>
              <h4 className="text-[13px] font-semibold text-neutral-900 mb-2">{r.title}</h4>
              <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                <p className="text-[11px] font-normal text-neutral-700 leading-relaxed">
                  "…{r.excerpt.split(r.highlight).map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && <mark className="bg-yellow-200 px-0.5 rounded">{r.highlight}</mark>}
                    </React.Fragment>
                  ))}…"
                </p>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Btn icon={<View size={14} />} label="View Full PDF" />
                <Btn icon={<DocumentExport size={14} />} label="Cite This Section" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== 6.2B FULL INDEX ====================
