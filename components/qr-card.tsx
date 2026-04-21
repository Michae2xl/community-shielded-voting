"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCard({
  uri,
  title = "Scan to vote"
}: {
  uri: string;
  title?: string;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(uri)
      .then((dataUrl: string) => {
        if (active) {
          setSrc(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setSrc("");
        }
      });

    return () => {
      active = false;
    };
  }, [uri]);

  return (
    <section className="hero-card form-panel">
      <div className="form-section-intro">
        <p className="eyebrow">QR request</p>
        <h2 className="form-section-title">{title}</h2>
        <p className="form-section-copy">
          Scan from a Zcash wallet to open the shielded transfer request with the
          answer code already embedded in the memo.
        </p>
      </div>
      {src ? (
        <Image src={src} alt={title} width={240} height={240} unoptimized />
      ) : (
        <p className="muted-text">Rendering QR code...</p>
      )}
      <code className="inline-code">{uri}</code>
    </section>
  );
}
