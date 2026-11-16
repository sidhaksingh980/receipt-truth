import React, { useEffect, useRef, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const API_URL = "http://localhost:8000/analyze";

const CATEGORY_COLORS = {
  groceries: "#c5e8a4",
  dining: "#ffac89",
  subscriptions: "#c3aeff",
  fees: "#ff8290",
  transport: "#86cafa",
  shopping: "#f4cf77",
  health: "#7dd9c0",
  other: "#aaa99f",
  uncategorized: "#706f68",
};

const SAMPLE_RECEIPT = {
  items: [
    { name: "ORGANIC AVOCADOS", quantity: 2, price: 5.98, category: "groceries" },
    { name: "WHOLE MILK", quantity: 1, price: 4.29, category: "groceries" },
    { name: "SOURDOUGH LOAF", quantity: 1, price: 6.5, category: "groceries" },
    { name: "OAT LATTE", quantity: 1, price: 6.75, category: "dining" },
    { name: "WEEKLY FLORALS", quantity: 1, price: 12.99, category: "shopping" },
    { name: "CLOUD STORAGE", quantity: 1, price: 11.99, category: "subscriptions" },
    { name: "SVC FEE", quantity: 1, price: 4.5, category: "fees" },
    { name: "CITY PARKING", quantity: 1, price: 3.25, category: "transport" },
    { name: "VITAMIN D3", quantity: 1, price: 9.49, category: "health" },
    { name: "EGG CARTON", quantity: 1, price: 7.98, category: "groceries" },
  ],
  flags: [
    {
      item_index: 6,
      type: "junk_fee",
      reason: "A service fee is listed; check what it covers before deciding.",
    },
    {
      item_index: 9,
      type: "outlier",
      reason: "This item was highlighted for review; check the printed details.",
    },
    {
      item_index: 5,
      type: "duplicate",
      reason: "This subscription may already be included in another plan.",
    },
  ],
  total: 73.72,
};

const DEMO_RECEIPT_LINES = [
  { id: "abbreviated-item", name: "MKT / PRD 04", price: 3.4, category: "groceries" },
  { id: "produce", name: "SEASONAL PRODUCE", price: 8, category: "groceries" },
  { id: "pantry", name: "PANTRY ITEMS", price: 6.2, category: "groceries" },
  { id: "service-fee", name: "SERVICE FEE", price: 2.8, category: "fees" },
  { id: "bag-fee", name: "BAG FEE", price: 0.4, category: "fees" },
  { id: "sparkling-water", name: "SPARKLING WATER", price: 3.5, category: "dining" },
  {
    id: "possible-duplicate",
    name: "SPARKLING WATER",
    price: 3.5,
    category: "dining",
  },
];

const DEMO_ANNOTATIONS = [
  {
    id: "abbreviation",
    number: "01",
    receiptLineId: "abbreviated-item",
    title: "Abbreviated item",
    summary: "MKT / PRD 04",
    explanation:
      "A shortened label can be hard to identify. Check the original receipt or ask for an itemized copy if you need more detail.",
  },
  {
    id: "fee",
    number: "02",
    receiptLineId: "service-fee",
    title: "Explicit service fee",
    summary: "$2.80 listed as a fee",
    explanation:
      "The charge is clearly listed as a service fee. Whether it is expected depends on the purchase, so review the receipt details before deciding.",
  },
  {
    id: "duplicate",
    number: "03",
    receiptLineId: "possible-duplicate",
    title: "Possible duplicate",
    summary: "Two similar water charges",
    explanation:
      "Two matching-looking lines appear. Compare them with what you received; both could be correct if you ordered two items.",
  },
];

const SPENDING_ANNOTATION = {
  id: "spending",
  title: "Category labels",
  summary: "Groceries · fees · dining",
  explanation:
    "Categories group the sample lines into a clearer spending mix. The receipt total stays the same.",
};

const RECEIPT_STEP_ANNOTATIONS = {
  decode: "abbreviation",
  charges: "fee",
  spending: "spending",
};

const DEMO_RECEIPT_TOTAL_CENTS = DEMO_RECEIPT_LINES.reduce(
  (total, item) => total + Math.round(item.price * 100),
  0,
);

const DEMO_SPENDING_CATEGORIES = Object.values(
  DEMO_RECEIPT_LINES.reduce((categories, item) => {
    const category = categories[item.category] || {
      name: item.category,
      value: 0,
      purchases: [],
    };
    category.value += item.price;
    category.purchases.push(item);
    categories[item.category] = category;
    return categories;
  }, {}),
).map((category) => ({
  ...category,
  color: CATEGORY_COLORS[category.name] || CATEGORY_COLORS.other,
}));

const DEMO_SAVINGS_CHARGES = [
  {
    id: "service-fee",
    label: "Service fee",
    note: "Check what the fee is for before counting it.",
    price: DEMO_RECEIPT_LINES.find((item) => item.id === "service-fee").price,
  },
  {
    id: "bag-fee",
    label: "Bag fee",
    note: "Decide whether this charge is relevant to your next visit.",
    price: DEMO_RECEIPT_LINES.find((item) => item.id === "bag-fee").price,
  },
  {
    id: "possible-duplicate",
    label: "One possible duplicate",
    note: "Treat one matching line as a candidate; verify it first.",
    price: DEMO_RECEIPT_LINES.find((item) => item.id === "possible-duplicate").price,
  },
];

const FAQ_ITEMS = [
  {
    question: "What receipts can I upload?",
    answer:
      "Choose a photo of a printed receipt in a common image format. Clear, well-lit photos are easier to read; the file picker accepts image files.",
  },
  {
    question: "Can the app misread a receipt?",
    answer:
      "Yes. Faint ink, folds, glare, and unusual layouts can affect a reading. Check names and amounts against the original before acting on them.",
  },
  {
    question: "Does a highlighted charge mean it is incorrect?",
    answer:
      "No. A highlight is a prompt to review a fee, a similar-looking entry, or unclear receipt text. It is not a finding of fraud or proof of an error.",
  },
  {
    question: "Are potential savings guaranteed?",
    answer:
      "No. They are planning estimates based only on the charges you select, not a promise of a refund or a change to the original receipt total.",
  },
  {
    question: "Is my receipt stored?",
    answer:
      "This page does not save receipt images to browser storage. It sends the image to the configured analyzer; that backend or any AI provider it uses may have separate data-handling and retention policies. Review those policies before uploading sensitive information.",
  },
];

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function ReceiptMark() {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      viewBox="0 0 42 42"
      fill="none"
    >
      <rect x="3" y="3" width="36" height="36" rx="13" fill="currentColor" />
      <path
        d="M13 14h16M13 21h16M13 28h10"
        stroke="#10120f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="29" cy="29" r="3" fill="#10120f" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="upload-icon"
      viewBox="0 0 30 30"
      fill="none"
    >
      <path
        d="M15 20.5V6.75m0 0-5.25 5.5M15 6.75l5.25 5.5M6.5 18.5v4A2.5 2.5 0 0 0 9 25h12a2.5 2.5 0 0 0 2.5-2.5v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatCurrency(value) {
  return CURRENCY.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function categoryName(category) {
  const label = category || "uncategorized";
  return label[0].toUpperCase() + label.slice(1);
}

function sumSelectedPrices(items, isSelected) {
  return items.reduce(
    (totalCents, item, index) =>
      isSelected(item, index)
        ? totalCents + Math.round(Number(item.price || 0) * 100)
        : totalCents,
    0,
  );
}

function SpendingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <span className="tooltip-dot" style={{ backgroundColor: payload[0].payload.fill }} />
      <span>{categoryName(payload[0].name)}</span>
      <strong>{formatCurrency(payload[0].value)}</strong>
    </div>
  );
}

function CategoryLegend({ categories }) {
  return (
    <div className="category-legend" aria-label="Spending by category">
      {categories.map((category) => (
        <div className="legend-item" key={category.name}>
          <span
            className="legend-dot"
            style={{ backgroundColor: category.color }}
          />
          <span className="legend-name">{categoryName(category.name)}</span>
          <span className="legend-amount">{formatCurrency(category.value)}</span>
        </div>
      ))}
    </div>
  );
}

function EditorialHeading({ index, label, title, description, id }) {
  return (
    <div className={`editorial-heading${index ? "" : " editorial-heading-no-index"}`}>
      {index && <span className="editorial-index">{index}</span>}
      <div className="editorial-heading-copy">
        <span className="section-kicker">{label}</span>
        <h2 id={id}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function ProblemSection() {
  const details = [
    {
      number: "01",
      title: "Short names leave questions.",
      description: "Abbreviations can make it hard to tell exactly what an item was.",
    },
    {
      number: "02",
      title: "Small lines are easy to miss.",
      description: "Fees and other extra lines can blend into a long printed list.",
    },
    {
      number: "03",
      title: "Similar entries need context.",
      description: "Two matching-looking items may be a mistake—or exactly what you ordered.",
    },
  ];

  return (
    <section
      className="story-section problem-section marketing-reveal"
      id="the-problem"
      aria-labelledby="problem-heading"
    >
      <EditorialHeading
        label="THE PROBLEM"
        title="A total is clear. The details can be less so."
        description="A receipt records what was charged, but abbreviations, fees, and similar-looking lines can take a closer read. A prompt to review is not proof that anything is wrong."
        id="problem-heading"
      />
      <div className="problem-ledger">
        {details.map((detail) => (
          <article className="problem-note" key={detail.number}>
            <span className="problem-note-number">{detail.number}</span>
            <h3>{detail.title}</h3>
            <p>{detail.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function InteractiveReceiptSection({ activeAnnotation, onSelectAnnotation }) {
  const sectionRef = useRef(null);
  const [activeStep, setActiveStep] = useState("decode");
  const active =
    activeAnnotation === SPENDING_ANNOTATION.id
      ? SPENDING_ANNOTATION
      : DEMO_ANNOTATIONS.find(
          (annotation) => annotation.id === activeAnnotation,
        ) || DEMO_ANNOTATIONS[0];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const steps =
      sectionRef.current?.querySelectorAll("[data-receipt-step]");
    if (!steps?.length) return;

    let observer;
    const observeSteps = () => {
      observer?.disconnect();
      const topMargin = Math.round(window.innerHeight * 0.35);
      const bottomMargin = Math.round(window.innerHeight * 0.45);
      observer = new IntersectionObserver(
        () => {
          const bandTop = window.innerHeight * 0.35;
          const bandBottom = window.innerHeight * 0.55;
          const candidates = Array.from(steps)
            .map((element) => {
              const bounds = element.getBoundingClientRect();
              return {
                element,
                center: (bounds.top + bounds.bottom) / 2,
                intersectsBand:
                  bounds.bottom > bandTop && bounds.top < bandBottom,
              };
            })
            .filter((candidate) => candidate.intersectsBand);
          if (!candidates.length) return;

          const activeCandidate = candidates.reduce((closest, candidate) =>
            Math.abs(candidate.center - window.innerHeight * 0.45) <
            Math.abs(closest.center - window.innerHeight * 0.45)
              ? candidate
              : closest,
          );
          const step = activeCandidate.element.dataset.receiptStep;
          const annotation = RECEIPT_STEP_ANNOTATIONS[step];
          if (!annotation) return;
          setActiveStep(step);
          onSelectAnnotation(annotation);
        },
        {
          rootMargin: `-${topMargin}px 0px -${bottomMargin}px`,
          threshold: 0.1,
        },
      );

      steps.forEach((step) => observer.observe(step));
    };

    observeSteps();
    window.addEventListener("resize", observeSteps);
    return () => {
      window.removeEventListener("resize", observeSteps);
      observer?.disconnect();
    };
  }, [onSelectAnnotation]);

  function selectAnnotation(annotationId, stepId) {
    setActiveStep(stepId);
    onSelectAnnotation(annotationId);
  }

  function renderAnnotationButton(annotation, stepId) {
    return (
      <button
        aria-pressed={active.id === annotation.id}
        className={`annotation-button${active.id === annotation.id ? " is-active" : ""}`}
        key={annotation.id}
        onClick={() => selectAnnotation(annotation.id, stepId)}
        onFocus={() => selectAnnotation(annotation.id, stepId)}
        type="button"
      >
        {annotation.number && (
          <span className="annotation-number">{annotation.number}</span>
        )}
        <span className="annotation-copy">
          <strong>{annotation.title}</strong>
          <small>{annotation.summary}</small>
        </span>
        <span className="annotation-arrow" aria-hidden="true">↗</span>
      </button>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="story-section breakdown-section marketing-reveal"
      id="interactive-breakdown"
      aria-labelledby="breakdown-story-heading"
    >
      <EditorialHeading
        index="02"
        label="ILLUSTRATIVE DEMO RECEIPT"
        title="The total doesn’t tell the whole story."
        description="Scroll through each step or select an annotation to inspect the sample receipt."
        id="breakdown-story-heading"
      />

      <div className="breakdown-demo">
        <div className="paper-stage">
          <div className="receipt-paper">
            <div className="receipt-paper-heading">
              <span>ILLUSTRATIVE DEMO RECEIPT</span>
              <span className="receipt-paper-rule" />
              <strong>NEIGHBORHOOD MARKET</strong>
              <small>THANK YOU FOR SHOPPING LOCAL</small>
            </div>
            <div className="paper-column-head">
              <span>{active.id === "spending" ? "ITEM / CATEGORY" : "ITEM"}</span>
              <span>AMOUNT</span>
            </div>
            {DEMO_RECEIPT_LINES.map((item) => {
              const annotation = DEMO_ANNOTATIONS.find(
                (entry) => entry.receiptLineId === item.id,
              );

              return (
                <div
                  className={`receipt-line${annotation ? " has-annotation" : ""}${active.receiptLineId === item.id ? " is-highlighted" : ""}${active.id === "fee" || active.id === "duplicate" ? " is-review-highlight" : ""}${active.id === "spending" ? " is-category-view" : ""}`}
                  key={item.id}
                >
                  <span className="receipt-annotation-number">
                    {annotation?.number || ""}
                  </span>
                  <span className="receipt-item-name">
                    {item.name}
                    {active.id === "spending" && (
                      <small
                        className="receipt-category-label"
                        style={{
                          "--category-color":
                            CATEGORY_COLORS[item.category] ||
                            CATEGORY_COLORS.other,
                        }}
                      >
                        {categoryName(item.category)}
                      </small>
                    )}
                  </span>
                  <span>{formatCurrency(item.price)}</span>
                </div>
              );
            })}
            <div className="receipt-paper-total">
              <span>TOTAL</span>
              <strong>{formatCurrency(DEMO_RECEIPT_TOTAL_CENTS / 100)}</strong>
            </div>
          </div>
          <p className="paper-caption">
            <span className="caption-dot" />
            Example amounts only · not a live analysis
          </p>
          <div className="annotation-explanation" aria-live="polite" aria-atomic="true">
            <span className="panel-kicker">{active.title}</span>
            <p>{active.explanation}</p>
          </div>
        </div>

        <div className="annotation-panel receipt-story-steps">
          <article
            className={`receipt-story-step${activeStep === "decode" ? " is-active" : ""}`}
            data-receipt-step="decode"
          >
            <div className="receipt-step-label"><span>01</span> DECODE THE PURCHASE</div>
            <h3>Give the short name more context.</h3>
            <p>
              An abbreviation can be hard to identify. Compare it with the
              printed receipt before deciding what it means.
            </p>
            {renderAnnotationButton(DEMO_ANNOTATIONS[0], "decode")}
          </article>

          <article
            className={`receipt-story-step${activeStep === "charges" ? " is-active" : ""}`}
            data-receipt-step="charges"
          >
            <div className="receipt-step-label"><span>02</span> REVIEW THE CHARGES</div>
            <h3>Check a fee or a repeated-looking line.</h3>
            <p>
              These are reasons to compare details—not a verdict that a charge
              is wrong.
            </p>
            <div className="receipt-step-options">
              {renderAnnotationButton(DEMO_ANNOTATIONS[1], "charges")}
              {renderAnnotationButton(DEMO_ANNOTATIONS[2], "charges")}
            </div>
          </article>

          <article
            className={`receipt-story-step${activeStep === "spending" ? " is-active" : ""}`}
            data-receipt-step="spending"
          >
            <div className="receipt-step-label"><span>03</span> UNDERSTAND THE SPENDING</div>
            <h3>See each line in a category.</h3>
            <p>
              Category labels connect these example purchases to the spending
              breakdown without changing the receipt total.
            </p>
            {renderAnnotationButton(SPENDING_ANNOTATION, "spending")}
            <a className="receipt-breakdown-link" href="#demo-spending">
              Explore the spending breakdown <span aria-hidden="true">↓</span>
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

function HowStepsSection() {
  return (
    <section className="story-section process-section marketing-reveal" id="how-the-analysis-works">
      <EditorialHeading
        index="01"
        label="A CLEARER WAY THROUGH"
        title="From crumpled paper to a clearer picture."
        description="A receipt becomes easier to act on when every step stays visible."
      />
      <ol className="ledger-steps">
        <li className="ledger-step">
          <span className="ledger-step-number">01</span>
          <div className="ledger-step-body">
            <span className="panel-kicker">FIRST, THE PAPER</span>
            <h3>Upload your receipt.</h3>
            <p>Choose an image and let the analyzer read the printed details.</p>
          </div>
          <span className="ledger-step-mark" aria-hidden="true">↑</span>
        </li>
        <li className="ledger-step">
          <span className="ledger-step-number">02</span>
          <div className="ledger-step-body">
            <span className="panel-kicker">THEN, THE BREAKDOWN</span>
            <h3>Explore purchases and charges worth reviewing.</h3>
            <p>See categories, line items, and why something was highlighted.</p>
          </div>
          <span className="ledger-step-mark" aria-hidden="true">≋</span>
        </li>
        <li className="ledger-step">
          <span className="ledger-step-number">03</span>
          <div className="ledger-step-body">
            <span className="panel-kicker">FINALLY, YOUR CALL</span>
            <h3>Select eligible charges to estimate potential savings.</h3>
            <p>Change your selections without changing the original receipt total.</p>
          </div>
          <span className="ledger-step-mark" aria-hidden="true">✓</span>
        </li>
      </ol>
    </section>
  );
}

function DemoSpendingSection({ selectedCategory, onSelectCategory }) {
  const selected = DEMO_SPENDING_CATEGORIES.find(
    (category) => category.name === selectedCategory,
  );
  const visiblePurchases = DEMO_RECEIPT_LINES;

  return (
    <section className="story-section spending-section marketing-reveal" id="demo-spending">
      <EditorialHeading
        index="03"
        label="ILLUSTRATIVE DEMO RECEIPT · SPENDING"
        title="Every purchase, put in its place."
        description={`This example adds up to ${formatCurrency(DEMO_RECEIPT_TOTAL_CENTS / 100)}. Choose a category to see its matching receipt lines.`}
      />

      <div className="spending-demo">
        <div className="demo-chart-panel">
          <div className="demo-chart-heading">
            <span className="panel-kicker">SAMPLE RECEIPT</span>
            <strong>{formatCurrency(DEMO_RECEIPT_TOTAL_CENTS / 100)}</strong>
          </div>
          <div className="demo-donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  aria-label="Illustrative spending by category"
                  cx="50%"
                  cy="50%"
                  data={DEMO_SPENDING_CATEGORIES}
                  dataKey="value"
                  innerRadius="67%"
                  outerRadius="92%"
                  paddingAngle={4}
                  stroke="none"
                  onClick={(entry) => {
                    if (entry?.name) onSelectCategory(entry.name);
                  }}
                >
                  {DEMO_SPENDING_CATEGORIES.map((category) => (
                    <Cell
                      fill={category.color}
                      key={category.name}
                      opacity={
                        !selectedCategory || selectedCategory === category.name
                          ? 1
                          : 0.34
                      }
                    />
                  ))}
                </Pie>
                <Tooltip content={<SpendingTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="demo-donut-center">
              <span>DEMO TOTAL</span>
              <strong>{formatCurrency(DEMO_RECEIPT_TOTAL_CENTS / 100)}</strong>
            </div>
          </div>
          <div className="demo-category-buttons" aria-label="Filter demo purchases by category">
            <button
              aria-pressed={!selectedCategory}
              className={!selectedCategory ? "category-filter selected" : "category-filter"}
              onClick={() => onSelectCategory(null)}
              type="button"
            >
              <span className="category-filter-dot all-categories-dot" />
              All lines
            </button>
            {DEMO_SPENDING_CATEGORIES.map((category) => (
              <button
                aria-pressed={selectedCategory === category.name}
                className={`category-filter${selectedCategory === category.name ? " selected" : ""}`}
                key={category.name}
                onClick={() =>
                  onSelectCategory(
                    selectedCategory === category.name ? null : category.name,
                  )
                }
                style={{ "--category-color": category.color }}
                type="button"
              >
                <span className="category-filter-dot" />
                {categoryName(category.name)}
                <span className="category-filter-total">
                  {formatCurrency(category.value)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="demo-purchase-panel">
          <div className="demo-purchase-heading">
            <div>
              <span className="panel-kicker">ITEMIZED LINES</span>
              <h3>{selected ? categoryName(selected.name) : "All purchases"}</h3>
            </div>
            <span className="demo-line-count">
              {selected
                ? `${selected.purchases.length.toString().padStart(2, "0")} OF ${visiblePurchases.length.toString().padStart(2, "0")} LINES`
                : `${visiblePurchases.length.toString().padStart(2, "0")} LINES`}
            </span>
          </div>
          <div className="demo-purchase-list" aria-live="polite">
            {visiblePurchases.map((item) => (
              <div
                className={`demo-purchase${selected && item.category === selected.name ? " is-highlighted" : ""}${selected && item.category !== selected.name ? " is-muted" : ""}`}
                key={item.id}
              >
                <span
                  className="demo-purchase-marker"
                  style={{
                    "--category-color":
                      CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other,
                  }}
                />
                <span className="demo-purchase-name">{item.name}</span>
                <span className="ledger-amount">{formatCurrency(item.price)}</span>
              </div>
            ))}
          </div>
          <div className="demo-receipt-total">
            <span>DEMO RECEIPT TOTAL</span>
            <strong>{formatCurrency(DEMO_RECEIPT_TOTAL_CENTS / 100)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewTypesSection() {
  return (
    <section className="story-section review-types-section marketing-reveal">
      <EditorialHeading
        index="04"
        label="ILLUSTRATIVE DEMO RECEIPT · REVIEW TYPES"
        title="Small lines. Worth a closer look."
        description="A prompt to check the details—not a verdict about the charge."
      />
      <div className="review-snippet-grid">
        <article className="review-snippet fee-snippet">
          <span className="panel-kicker">01 / EXPLICIT FEE</span>
          <div className="snippet-paper">
            <span>MEAL TOTAL</span>
            <strong>Service fee <b>$2.80</b></strong>
            <i aria-hidden="true" />
          </div>
          <p>
            It is listed by name. Check what service it relates to and whether
            it matches your order.
          </p>
        </article>
        <article className="review-snippet duplicate-snippet">
          <span className="panel-kicker">02 / POSSIBLE DUPLICATE</span>
          <div className="snippet-paper repeated-snippet">
            <strong>Sparkling water <b>$3.50</b></strong>
            <strong>Sparkling water <b>$3.50</b></strong>
            <i aria-hidden="true">↳</i>
          </div>
          <p>
            Similar lines can be correct if you ordered both. Compare them with
            the items you received.
          </p>
        </article>
        <article className="review-snippet unclear-snippet">
          <span className="panel-kicker">03 / UNCLEAR DETAILS</span>
          <div className="snippet-paper unclear-paper">
            <strong>MKT / PRD 04 <b>$3.40</b></strong>
            <span className="unclear-underline" aria-hidden="true" />
          </div>
          <p>
            Abbreviations and faint print can be ambiguous. Check the original
            or ask for an itemized copy.
          </p>
        </article>
      </div>
    </section>
  );
}

function DemoSavingsSection({
  selectedCharges,
  onToggleCharge,
  savingsCents,
}) {
  return (
    <section className="story-section what-if-section marketing-reveal" id="demo-savings">
      <EditorialHeading
        index="05"
        label="ILLUSTRATIVE DEMO RECEIPT · WHAT-IF"
        title="What could you leave off next time?"
        description="Choose a few example charges to see how your own estimate changes."
      />

      <div className="what-if-panel">
        <div className="what-if-list">
          <span className="panel-kicker">SELECT CANDIDATES TO REVIEW</span>
          {DEMO_SAVINGS_CHARGES.map((charge) => (
            <label className="what-if-row" key={charge.id}>
              <input
                checked={Boolean(selectedCharges[charge.id])}
                onChange={() => onToggleCharge(charge.id)}
                type="checkbox"
              />
              <span className="what-if-label">
                <strong>{charge.label}</strong>
                <small>{charge.note}</small>
              </span>
              <span className="ledger-amount">{formatCurrency(charge.price)}</span>
            </label>
          ))}
          <div className="what-if-receipt-total">
            <span>Original demo receipt total</span>
            <strong>{formatCurrency(DEMO_RECEIPT_TOTAL_CENTS / 100)}</strong>
          </div>
        </div>

        <div className="what-if-result" aria-live="polite">
          <span className="panel-kicker">YOUR SELECTED ESTIMATE</span>
          <strong className="what-if-amount" key={savingsCents}>
            {formatCurrency(savingsCents / 100)}
          </strong>
          <span className="what-if-count">
            {Object.values(selectedCharges).filter(Boolean).length} charges selected
          </span>
          <p>This planning estimate is not a guaranteed refund.</p>
        </div>
      </div>
    </section>
  );
}

function UnderTheReceiptSection() {
  const layers = [
    {
      number: "01",
      title: "A vision model reads the print.",
      description: "It extracts the item text and amounts from your receipt image.",
      mark: "VISUAL",
    },
    {
      number: "02",
      title: "A categorizer puts purchases in context.",
      description: "Each line is assigned a spending category such as groceries, dining, or fees.",
      mark: "SORT",
    },
    {
      number: "03",
      title: "Explainable rules flag details to check.",
      description: "A fee, a similar-looking entry, or unclear text gets a review note so you can verify it.",
      mark: "REVIEW",
    },
  ];

  return (
    <section
      className="story-section under-receipt-section marketing-reveal"
      id="inside-receipt-truth"
      aria-labelledby="inside-receipt-heading"
    >
      <EditorialHeading
        index="06"
        label="HOW THE BREAKDOWN COMES TOGETHER"
        title="Inside Receipt Truth"
        description="The analysis is there to help you read the receipt—not ask you to take its word for it."
        id="inside-receipt-heading"
      />
      <div className="analysis-layers">
        {layers.map((layer) => (
          <article className="analysis-layer" key={layer.number}>
            <span className="analysis-layer-number">{layer.number}</span>
            <div className="analysis-layer-copy">
              <h3>{layer.title}</h3>
              <p>{layer.description}</p>
            </div>
            <span className="analysis-layer-mark">{layer.mark}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function WhoItsForSection() {
  const audiences = [
    {
      number: "01",
      title: "Everyday shoppers",
      description: "Get a clearer view of where a grocery run or meal out added up.",
      mark: "READ",
    },
    {
      number: "02",
      title: "Careful double-checkers",
      description: "Take another look at a fee, repeated-looking item, or unclear label.",
      mark: "REVIEW",
    },
    {
      number: "03",
      title: "People planning ahead",
      description: "Use selected charges to sketch a what-if estimate for next time.",
      mark: "PLAN",
    },
  ];

  return (
    <section
      className="story-section who-for-section marketing-reveal"
      id="who-its-for"
      aria-labelledby="who-for-heading"
    >
      <div className="who-for-layout">
        <EditorialHeading
          index="07"
          label="A PRACTICAL SECOND LOOK"
          title="Who it’s for."
          description="Receipt Truth is for people who want more context before deciding what a receipt means."
          id="who-for-heading"
        />
        <div className="who-for-ledger">
          {audiences.map((audience) => (
            <article className="who-for-entry" key={audience.number}>
              <span className="who-for-number">{audience.number}</span>
              <div>
                <h3>{audience.title}</h3>
                <p>{audience.description}</p>
              </div>
              <span className="who-for-mark">{audience.mark}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section className="story-section faq-section marketing-reveal" id="receipt-faq">
      <EditorialHeading
        index="08"
        label="QUESTIONS"
        title="Questions before you upload."
        description="The receipt stays the source of truth. Here is what the analysis can—and cannot—tell you."
      />
      <div className="faq-list">
        {FAQ_ITEMS.map((item, index) => (
          <details className="faq-item" key={item.question}>
            <summary>
              <span className="faq-number">
                {(index + 1).toString().padStart(2, "0")}
              </span>
              <span>{item.question}</span>
              <span className="faq-toggle" aria-hidden="true">+</span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalUploadSection() {
  return (
    <section className="final-upload-section marketing-reveal">
      <span className="final-upload-kicker">THE NEXT RECEIPT IS THE NEXT CLUE</span>
      <h2>Your next receipt deserves a second look.</h2>
      <p>Bring the details into focus before they fade into the week.</p>
      <div className="final-upload-actions">
        <a className="final-scan-button" href="/analyze.html">
          Analyze a receipt <span aria-hidden="true">↗</span>
        </a>
        <a
          className="final-demo-button"
          href="/analyze.html?demo=1"
        >
          Try a demo
        </a>
      </div>
    </section>
  );
}

function HowItWorksPage() {
  return (
    <>
      <section className="how-hero">
        <div className="eyebrow"><span /> A LITTLE CONTEXT, A LOT MORE CLARITY</div>
        <h1>
          Know what&apos;s on
          <br />
          <span>your receipt.</span>
        </h1>
        <p className="how-description">
          Get a clearer picture of where your money went—and what might deserve
          a second look.
        </p>
        <a className="how-cta" href="/analyze.html">
          Analyze a receipt <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="how-section" aria-labelledby="how-steps-heading">
        <div className="section-heading">
          <span className="section-step">01</span>
          <div>
            <h2 id="how-steps-heading">Three steps to seeing the whole picture</h2>
            <p>From a quick photo to a clear breakdown.</p>
          </div>
        </div>

        <div className="how-card-grid">
          <article className="how-card">
            <span className="how-card-number">01</span>
            <h3>Share a photo</h3>
            <p>Choose an image of your receipt. No account or setup required.</p>
          </article>
          <article className="how-card">
            <span className="how-card-number">02</span>
            <h3>See where it went</h3>
            <p>
              Every line item is sorted into a category, with prices and a
              spending chart.
            </p>
          </article>
          <article className="how-card">
            <span className="how-card-number">03</span>
            <h3>Take a closer look</h3>
            <p>
              Review flagged charges and choose which ones count toward
              potential savings.
            </p>
          </article>
        </div>
      </section>

      <section className="how-section review-section" aria-labelledby="review-heading">
        <div className="section-heading">
          <span className="section-step">02</span>
          <div>
            <h2 id="review-heading">What gets a second look?</h2>
            <p>Helpful hints, so you can make the call.</p>
          </div>
        </div>
        <div className="review-grid">
          <article className="review-card">
            <span className="review-icon fee-icon" aria-hidden="true">!</span>
            <h3>Possible fees</h3>
            <p>Check what a listed service charge covers before deciding.</p>
          </article>
          <article className="review-card">
            <span className="review-icon duplicate-icon" aria-hidden="true">=</span>
            <h3>Possible duplicates</h3>
            <p>Charges that may already appear elsewhere.</p>
          </article>
          <article className="review-card">
            <span className="review-icon outlier-icon" aria-hidden="true">↗</span>
            <h3>Unclear receipt details</h3>
            <p>Abbreviations or faint print that may need a closer look.</p>
          </article>
        </div>
      </section>

      <section className="privacy-card">
        <span className="privacy-mark" aria-hidden="true">⌑</span>
        <div>
          <span className="panel-kicker">A NOTE ON RECEIPT DATA</span>
          <h2>This page does not save receipt images in browser storage.</h2>
          <p>
            Images are sent to the configured analyzer, which may have its own
            data-handling policies.
          </p>
        </div>
      </section>
    </>
  );
}

export default function App() {
  const fileInputRef = useRef(null);
  const readingProgressRef = useRef(null);
  const isHowItWorksPage = window.location.pathname === "/how-it-works.html";
  const isAnalyzePage = window.location.pathname === "/analyze.html";
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [showSampleResults, setShowSampleResults] = useState(false);
  const [includedFlags, setIncludedFlags] = useState({});
  const [sampleIncludedFlags, setSampleIncludedFlags] = useState({});
  const [activeAnnotation, setActiveAnnotation] = useState("abbreviation");
  const [selectedDemoCategory, setSelectedDemoCategory] = useState(null);
  const [selectedDemoCharges, setSelectedDemoCharges] = useState({});

  const displayedAnalysis =
    analysis || (showSampleResults ? SAMPLE_RECEIPT : null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    const progressBar = readingProgressRef.current;
    if (!progressBar) return;

    let frameId = 0;
    const updateProgress = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        const scrollableHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const progress =
          scrollableHeight > 0
            ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight))
            : 0;
        progressBar.style.transform = `scaleX(${progress})`;
      });
    };

    const resizeObserver =
      "ResizeObserver" in window
        ? new ResizeObserver(updateProgress)
        : null;
    resizeObserver?.observe(document.documentElement);
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      resizeObserver?.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const revealElements = document.querySelectorAll(".marketing-reveal");
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    if (motionPreference.matches) return;

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries, currentObserver) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  entry.target.setAttribute("data-visible", "true");
                  currentObserver.unobserve(entry.target);
                }
              });
            },
            { rootMargin: "0px", threshold: 0.01 },
          )
        : null;

    const revealVisibleElements = () => {
      revealElements.forEach((element) => {
        if (element.hasAttribute("data-visible")) return;
        const bounds = element.getBoundingClientRect();
        if (bounds.top < window.innerHeight * 0.9 && bounds.bottom > 0) {
          element.setAttribute("data-visible", "true");
          observer?.unobserve(element);
        }
      });
    };

    revealElements.forEach((element) => {
      element.classList.add("reveal-ready");
      observer?.observe(element);
    });

    let heroObserver = null;
    const heroVisual =
      !isAnalyzePage && !isHowItWorksPage
        ? document.querySelector(".hero:not([hidden]) .hero-art")
        : null;
    if (heroVisual && "IntersectionObserver" in window) {
      heroObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle(
              "is-exiting",
              entry.boundingClientRect.top < 0 && entry.intersectionRatio < 0.6,
            );
          });
        },
        { threshold: [0, 0.2, 0.6, 1] },
      );
      heroObserver.observe(heroVisual);
    }

    if (!observer) {
      window.addEventListener("scroll", revealVisibleElements, { passive: true });
      window.addEventListener("resize", revealVisibleElements);
    }
    revealVisibleElements();

    return () => {
      if (!observer) {
        window.removeEventListener("scroll", revealVisibleElements);
        window.removeEventListener("resize", revealVisibleElements);
      }
      observer?.disconnect();
      heroObserver?.disconnect();
    };
  }, [isHowItWorksPage, isAnalyzePage]);

  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const textTargets = document.querySelectorAll(
      [
        ".editorial-heading-copy",
        ".ledger-step-body",
        ".receipt-story-step > h3",
        ".receipt-story-step > p",
        ".review-snippet",
        ".analysis-layer-copy",
        ".who-for-entry > div",
        ".faq-item",
        ".final-upload-section > h2",
        ".final-upload-section > p",
        ".analyzer-intro",
        ".analyzer-workspace .section-heading > div",
        ".results-heading",
        ".panel-heading",
        ".demo-purchase-heading",
      ].join(","),
    );
    if (!textTargets.length) return;

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries, currentObserver) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.setAttribute("data-text-visible", "true");
                currentObserver.unobserve(entry.target);
              });
            },
            { threshold: 0.08 },
          )
        : null;

    textTargets.forEach((target) => {
      if (target.dataset.textVisible !== "true") observer?.observe(target);
      target.classList.add("scroll-text-ready");
    });

    const revealTextInView = () => {
      const visibleTargets = [];
      textTargets.forEach((target) => {
        if (target.dataset.textVisible === "true") return;
        const bounds = target.getBoundingClientRect();
        if (bounds.top < window.innerHeight * 0.92 && bounds.bottom > 0) {
          visibleTargets.push(target);
        }
      });
      visibleTargets.forEach((target) => {
        target.setAttribute("data-text-visible", "true");
        observer?.unobserve(target);
      });
    };

    document.addEventListener("scroll", revealTextInView, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", revealTextInView);
    revealTextInView();

    return () => {
      document.removeEventListener("scroll", revealTextInView, true);
      window.removeEventListener("resize", revealTextInView);
      observer?.disconnect();
    };
  }, [displayedAnalysis]);

  const flagsByIndex = {};
  const checkedFlags = {};
  const activeFlagSelections = analysis ? includedFlags : sampleIncludedFlags;
  (displayedAnalysis?.flags || []).forEach((flag) => {
    flagsByIndex[flag.item_index] ??= [];
    flagsByIndex[flag.item_index].push(flag);
    checkedFlags[flag.item_index] =
      activeFlagSelections[flag.item_index] ?? true;
  });

  const spendingByCategory = {};
  (displayedAnalysis?.items || []).forEach((item) => {
    const category = item.category || "uncategorized";
    spendingByCategory[category] =
      (spendingByCategory[category] || 0) + Number(item.price || 0);
  });

  const categories = Object.entries(spendingByCategory)
    .map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS.other,
    }))
    .sort((first, second) => second.value - first.value);

  const total =
    displayedAnalysis && Number.isFinite(Number(displayedAnalysis.total))
      ? Number(displayedAnalysis.total)
      : (displayedAnalysis?.items || []).reduce(
          (sum, item) => sum + Number(item.price || 0),
          0,
        );

  const potentialSavingsCents = sumSelectedPrices(
    displayedAnalysis?.items || [],
    (_item, index) =>
      Boolean(flagsByIndex[index]?.length && checkedFlags[index]),
  );
  const demoSavingsCents = sumSelectedPrices(
    DEMO_SAVINGS_CHARGES,
    (charge) => Boolean(selectedDemoCharges[charge.id]),
  );

  function chooseFile(nextFile) {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("image/")) {
      setError("Please choose an image file, such as a JPG, PNG, or HEIC.");
      return;
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setAnalysis(null);
    setShowSampleResults(false);
    setIncludedFlags({});
    setSampleIncludedFlags({});
    setError("");
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function analyzeReceipt() {
    if (!file) {
      setError("Choose a receipt photo first, or try the sample receipt below.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch(API_URL, { method: "POST", body });
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "The analysis service isn't available yet. Check that the backend is running."
            : "We couldn't analyze that receipt just now. Please try again.",
        );
      }

      const result = await response.json();
      if (!Array.isArray(result.items) || !Array.isArray(result.flags)) {
        throw new Error("The analysis returned an unexpected response. Please try again.");
      }

      setAnalysis(result);
      setShowSampleResults(false);
      setIncludedFlags(
        Object.fromEntries(result.flags.map((flag) => [flag.item_index, true])),
      );
    } catch (requestError) {
      console.error("Receipt analysis failed:", requestError);
      setError(
        requestError instanceof TypeError
          ? "We couldn't reach the receipt analyzer. Make sure the backend is running, then try again."
          : requestError instanceof SyntaxError
            ? "The analysis returned an unexpected response. Please try again."
            : requestError.message ||
                "We couldn't analyze that receipt just now. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function showSample() {
    setShowSampleResults(true);
    setSampleIncludedFlags(
      Object.fromEntries(
        SAMPLE_RECEIPT.flags.map((flag) => [flag.item_index, true]),
      ),
    );
    setError("");
  }

  function toggleFlag(index) {
    const setSelections = analysis ? setIncludedFlags : setSampleIncludedFlags;
    setSelections((current) => ({
      ...current,
      [index]: !(current[index] ?? true),
    }));
  }

  function toggleDemoCharge(id) {
    setSelectedDemoCharges((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  useEffect(() => {
    if (isAnalyzePage && new URLSearchParams(window.location.search).get("demo") === "1") {
      showSample();
    }
  }, [isAnalyzePage]);

  return (
    <div
      className={`app-shell${isAnalyzePage ? " analyzer-page" : isHowItWorksPage ? " how-page" : " home-page"}`}
    >
      <div className="reading-progress" aria-hidden="true">
        <span ref={readingProgressRef} />
      </div>
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="site-header">
        <a aria-label="Receipt Truth home" className="brand" href="/">
          <span>Receipt <span className="brand-light">Truth</span></span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <a className="nav-link" href="/#how-the-analysis-works">How it works</a>
          <a className="nav-link" href="/#interactive-breakdown">Sample receipt</a>
          <a className="nav-link" href="/#who-its-for">Who it&apos;s for</a>
        </nav>
        <a
          aria-current={isAnalyzePage ? "page" : undefined}
          className="nav-cta"
          href="/analyze.html"
        >
          Analyze a receipt
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="page-content">
        {!isHowItWorksPage && <div>
        <section className="hero" hidden={isAnalyzePage}>
          <div className="hero-copy">
            <div className="eyebrow"><span /> THE DETAILS ADD UP</div>
            <h1>
              Every receipt
              <br />
              has a <span>story.</span>
            </h1>
            <p className="hero-description">
              Upload a receipt and see where your money really goes.
            </p>
            <div className="hero-actions">
              <a className="hero-cta" href="/analyze.html">
                Analyze a receipt <span aria-hidden="true">↗</span>
              </a>
              <a className="hero-secondary-cta" href="#interactive-breakdown">
                View a sample <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="dashboard-glow" />
            <div className="hero-preview-card hero-spend-card">
              <span className="hero-preview-label">SAMPLE RECEIPT · TOTAL</span>
              <strong>$27.80</strong>
              <span className="hero-preview-note">7 line items · 3 categories</span>
              <div className="hero-category-bars">
                <span className="hero-category-groceries" />
                <span className="hero-category-dining" />
                <span className="hero-category-fees" />
              </div>
              <div className="hero-category-legend">
                <span><i className="hero-category-groceries" /> Groceries</span>
                <span><i className="hero-category-dining" /> Dining</span>
                <span><i className="hero-category-fees" /> Fees</span>
              </div>
            </div>
            <div className="receipt-dashboard">
              <div className="dashboard-topbar">
                <span className="dashboard-brand-mark">
                  <ReceiptMark />
                </span>
                <span className="dashboard-heading">ILLUSTRATIVE DEMO RECEIPT</span>
                <span className="dashboard-period">OVERVIEW</span>
              </div>

              <div className="dashboard-total-label">A little more clarity</div>
              <div className="dashboard-total">
                $27.80 <span>7 items</span>
              </div>

              <div className="dashboard-chart" aria-hidden="true">
                <span style={{ height: "43%" }} />
                <span style={{ height: "65%" }} />
                <span style={{ height: "51%" }} />
                <span style={{ height: "82%" }} />
                <span style={{ height: "57%" }} />
                <span style={{ height: "94%" }} />
                <span style={{ height: "69%" }} />
                <span style={{ height: "78%" }} />
                <span style={{ height: "48%" }} />
                <span style={{ height: "88%" }} />
                <span style={{ height: "61%" }} />
                <span style={{ height: "73%" }} />
              </div>

              <div className="dashboard-line-items">
                <div className="dashboard-line-item">
                  <span className="dashboard-category-dot groceries-dot" />
                  <span className="dashboard-item-copy">
                    Seasonal produce<small>Groceries</small>
                  </span>
                  <strong>$8.00</strong>
                </div>
                <div className="dashboard-line-item">
                  <span className="dashboard-category-dot dining-dot" />
                  <span className="dashboard-item-copy">
                    Sparkling water<small>Dining</small>
                  </span>
                  <strong>$3.50</strong>
                </div>
                <div className="dashboard-line-item flagged-preview">
                  <span className="dashboard-category-dot fees-dot" />
                  <span className="dashboard-item-copy">
                    Service fee<small>Review the details</small>
                  </span>
                  <strong>$2.80</strong>
                </div>
              </div>

              <div className="dashboard-savings">
                <span>CHARGE TO REVIEW</span>
                <strong>$2.80</strong>
                <span className="savings-check" aria-hidden="true">✓</span>
              </div>
            </div>
            <div className="hero-preview-card hero-review-card">
              <span className="hero-preview-label">WORTH A SECOND LOOK</span>
              <strong>$2.80</strong>
              <span className="hero-preview-note">A service fee, clearly listed</span>
              <div className="hero-review-line">
                <span>SVC FEE</span>
                <span>Review the details</span>
              </div>
              <span className="hero-preview-disclaimer">Illustrative demo receipt</span>
            </div>
          </div>
        </section>

        {!isAnalyzePage && <div>
          <HowStepsSection />
        </div>}

        {isAnalyzePage && <div className="analyzer-workspace">
          <section className="analyzer-intro" aria-labelledby="analyzer-heading">
            <div className="eyebrow"><span /> THE RECEIPT, LINE BY LINE</div>
            <h1 id="analyzer-heading">Analyze a receipt.</h1>
            <p>
              Upload a clear photo to see categorized purchases, charges worth
              reviewing, and the total behind every line.
            </p>
          </section>
        <section className="upload-section" aria-labelledby="upload-heading">
          <div className="section-heading">
            <span className="section-step">01</span>
            <div>
              <h2 id="upload-heading">Start with a receipt</h2>
              <p>A quick snapshot is all it takes.</p>
            </div>
          </div>

          <div className="upload-layout">
            <div
              className={`upload-card${isDragging ? " is-dragging" : ""}${previewUrl ? " has-preview" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
            >
              {previewUrl ? (
                <img
                  className="receipt-preview"
                  src={previewUrl}
                  alt="Preview of the selected receipt"
                />
              ) : (
                <div className="upload-illustration">
                  <UploadIcon />
                </div>
              )}
              <div className="upload-copy">
                <p className="upload-title">
                  {file ? file.name : "Drop your receipt here"}
                </p>
                <p className="upload-hint">
                  {file
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · Ready to analyze`
                    : "JPG, PNG or HEIC · Image files only"}
                </p>
              </div>
              <button
                className="browse-button"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {file ? "Change photo" : "Choose a photo"}
              </button>
              <input
                accept="image/*"
                className="visually-hidden"
                onChange={(event) => {
                  chooseFile(event.target.files[0]);
                  event.target.value = "";
                }}
                ref={fileInputRef}
                type="file"
              />
            </div>

            <button
              className="analyze-button"
              disabled={isLoading || !file}
              onClick={analyzeReceipt}
              type="button"
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Reading the fine print…
                </>
              ) : (
                <>
                  Find the truth
                  <span aria-hidden="true">↗</span>
                </>
              )}
            </button>
          </div>

          {error && <p className="error-message" role="alert">{error}</p>}

          <div className="sample-row">
            <span>Just looking around?</span>
            <button className="sample-button" onClick={showSample} type="button">
              Try a sample receipt <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {showSampleResults && !analysis && (
          <p className="sample-results-note" role="status">
            Illustrative demo receipt · your selections here stay separate from
            the demo controls farther down the page.
          </p>
        )}

        {displayedAnalysis && (
          <section className="results-section" aria-labelledby="results-heading">
            <div className="results-heading">
              <div className="section-heading">
                <span className="section-step">02</span>
                <div>
                  <h2 id="results-heading">Here&apos;s the breakdown</h2>
                  <p>Your receipt, minus the guesswork.</p>
                </div>
              </div>
              <span className="item-count">
                {displayedAnalysis.items.length} LINE ITEMS
              </span>
            </div>

            <div className="results-grid">
              <section className="panel items-panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-kicker">THE LINE BY LINE</span>
                    <h3>What you spent</h3>
                  </div>
                  <span className="panel-count">{displayedAnalysis.items.length} items</span>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">ITEM</th>
                        <th scope="col">CATEGORY</th>
                        <th className="numeric" scope="col">QTY</th>
                        <th className="numeric" scope="col">PRICE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedAnalysis.items.map((item, index) => {
                        const itemFlags = flagsByIndex[index] || [];
                        const flagged = itemFlags.length > 0;
                        const category = item.category || "uncategorized";

                        return (
                          <tr
                            className={flagged ? "flagged-row" : ""}
                            key={`${item.name}-${index}`}
                          >
                            <td className="item-name-cell">
                              <span className="item-name">
                                {flagged && <span className="flag-dot" />}
                                {item.name}
                              </span>
                              {flagged && (
                                <span className="flag-details">
                                  <span className="flag-reason">
                                    {itemFlags.map((flag) => flag.reason).join(" ")}
                                  </span>
                                  <label className="savings-checkbox">
                                    <input
                                      checked={Boolean(checkedFlags[index])}
                                      onChange={() => toggleFlag(index)}
                                      type="checkbox"
                                    />
                                    <span>Include in savings</span>
                                  </label>
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`category-tag category-${category.replace(/[^a-z0-9-]/gi, "")}`}
                                style={{
                                  "--category-color":
                                    CATEGORY_COLORS[category] ||
                                    CATEGORY_COLORS.other,
                                }}
                              >
                                {categoryName(category)}
                              </span>
                            </td>
                            <td className="numeric quantity-cell">
                              {item.quantity ?? 1}
                            </td>
                            <td className="numeric price-cell">
                              {formatCurrency(item.price)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3">Receipt total</td>
                        <td className="numeric total-cell">{formatCurrency(total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <div className="insights-column">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-kicker">THE BIG PICTURE</span>
                      <h3>Your spending mix</h3>
                    </div>
                  </div>
                  {categories.length ? (
                    <>
                      <div className="chart-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              cx="50%"
                              cy="50%"
                              data={categories}
                              dataKey="value"
                              innerRadius="68%"
                              outerRadius="92%"
                              paddingAngle={3}
                              stroke="none"
                            >
                              {categories.map((category) => (
                                <Cell
                                  fill={category.color}
                                  key={category.name}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<SpendingTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="chart-center">
                          <span>RECEIPT TOTAL</span>
                          <strong>{formatCurrency(total)}</strong>
                        </div>
                      </div>
                      <CategoryLegend categories={categories} />
                    </>
                  ) : (
                    <p className="chart-empty">No item totals to chart yet.</p>
                  )}
                </section>

                <section
                  className={`savings-card${potentialSavingsCents === 0 ? " no-savings" : ""}`}
                  aria-live="polite"
                >
                  <div className="savings-card-top">
                    <span className="savings-icon" aria-hidden="true">↗</span>
                    <span className="savings-caption">WORTH A SECOND LOOK</span>
                  </div>
                  <h3>Potential savings</h3>
                  <p className="savings-amount" key={potentialSavingsCents}>
                    {formatCurrency(potentialSavingsCents / 100)}
                  </p>
                  {displayedAnalysis.flags.length === 0 ? (
                    <p className="all-clear">No suspicious charges found.</p>
                  ) : (
                    <p className="savings-footnote">
                      {displayedAnalysis.flags.length} flagged charge
                      {displayedAnalysis.flags.length === 1 ? "" : "s"} · toggle any item above
                    </p>
                  )}
                </section>
              </div>
            </div>
          </section>
        )}
        </div>}

        {!isAnalyzePage && <div className="marketing-content">
        <ProblemSection />
        <InteractiveReceiptSection
          activeAnnotation={activeAnnotation}
          onSelectAnnotation={setActiveAnnotation}
        />
        <DemoSpendingSection
          onSelectCategory={setSelectedDemoCategory}
          selectedCategory={selectedDemoCategory}
        />
        <ReviewTypesSection />
        <DemoSavingsSection
          onToggleCharge={toggleDemoCharge}
          savingsCents={demoSavingsCents}
          selectedCharges={selectedDemoCharges}
        />
        <UnderTheReceiptSection />
        <WhoItsForSection />
        <FAQSection />
        <FinalUploadSection />
        </div>}
        </div>}
        {isHowItWorksPage && <HowItWorksPage />}
      </main>

      <footer className="site-footer">
        <span className="footer-lock" aria-hidden="true">⌑</span>
        <span>
          This page doesn’t save a browser copy; receipt images are sent to the
          configured analyzer.
        </span>
        <span className="footer-divider" />
        <span>Made for people who read the fine print.</span>
      </footer>
    </div>
  );
}
