import { Check, ArrowUpRight } from "lucide-react";
import product from "../../data/public-product.json";
export default function PricingSection() {
  return (
    <section className="site-section pricing-section" id="pricing">
      <div className="site-container">
        <div className="section-intro section-intro-center">
          <span className="site-kicker">PACKAGES</span>
          <h2>
            A workspace for
            <br />
            <em>your rental operation.</em>
          </h2>
          <p>
            One installation per branch. Discuss setup and package requirements
            with your provider.
          </p>
        </div>
        <div className="pricing-grid">
          {product.plans.map((plan) => (
            <article
              className={`pricing-card ${plan.recommended ? "pricing-recommended" : ""}`}
              key={plan.name}
            >
              <div className="plan-title">
                <h3>{plan.name}</h3>
                {plan.recommended && <span>Recommended</span>}
              </div>
              <p>{plan.audience}</p>
              <div className="plan-price">
                <strong style={{ fontSize: 24 }}>Contact sales</strong>
              </div>
              <ul>
                {plan.features.map((point) => (
                  <li key={point}>
                    <Check size={15} />
                    {point}
                  </li>
                ))}
              </ul>
              <a
                href={product.contact}
                className={
                  plan.recommended ? "site-button" : "site-outline-button"
                }
              >
                {plan.action}
                <ArrowUpRight size={15} />
              </a>
            </article>
          ))}
        </div>
        <p className="pricing-demo-note pt-4">
          Compare packages, then contact our team to confirm pricing, setup and included services. The public website assistant is available to every visitor.
        </p>
      </div>
    </section>
  );
}
