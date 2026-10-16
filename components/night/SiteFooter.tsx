import { BRAND } from "@/lib/content";
import { UI } from "@/lib/ui-copy";
import { PhidiasMark } from "../ui/Brand";

/** Partners, the developer's mark with its signature, the disclaimer. */
export function SiteFooter() {
  return (
    <footer className="vl-footer">
      <div className="vl-footer__dev">
        <PhidiasMark className="vl-footer__phidias" />
        <span className="vl-footer__sig">
          {UI.footer.signature}
        </span>
      </div>
      <ul className="vl-footer__partners" aria-label="Partners">
        {BRAND.partners.map((p) => (
          <li key={p.name}>
            <span className="vl-footer__role">{p.role}</span>
            <span className="vl-footer__name">{p.name}</span>
          </li>
        ))}
      </ul>
      <p className="vl-footer__legal">
        <a href="/classic" className="vl-link">
          {UI.nav.classic}
        </a>
        <span>{BRAND.disclaimer}</span>
        <span>{UI.footer.copyright}</span>
      </p>
    </footer>
  );
}
