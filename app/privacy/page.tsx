import type { Metadata } from "next";

/** Empty for now (approved for the nonpublic preview); the policy copy is a client follow-up before public launch. */
export const metadata: Metadata = {
  title: "Privacy Policy — Vila Leku",
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <main className="vc">
      <div className="vc-wrap" style={{ paddingBlock: "clamp(104px, 15vh, 190px)", maxWidth: "34em" }}>
        <h1 className="vc-title" style={{ fontSize: "clamp(34px, 4vw, 56px)" }}>
          Privacy Policy
        </h1>
        <p className="vc-body" style={{ marginTop: 24 }}>
          Vila Leku · Leceia, Oeiras · Portugal
        </p>
        <p className="vc-body" style={{ marginTop: 16, opacity: 0.7 }}>
          The full policy will be published here. <a className="vl-link" href="/">Back to Vila Leku</a>
        </p>
      </div>
    </main>
  );
}
