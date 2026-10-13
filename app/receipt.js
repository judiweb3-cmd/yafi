/*
 * YAFI receipt as an image, so it can be shared to WhatsApp, Telegram or email the way
 * payment apps share their vouchers. Drawn on a canvas in the browser: no server, no upload.
 */
(function () {
  "use strict";

  const C = { bg: "#0D0A1A", card: "#17122B", border: "#2E2652", text: "#F4F1FF", muted: "#A79FC9",
    purple: "#7C4DFF", lime: "#C6F432", green: "#4ADE80" };
  const FONT = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // the receipt still works without the logo
      img.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(ctx, s, x, y, size, color, weight, align) {
    ctx.font = `${weight || 400} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || "center";
    ctx.fillText(s, x, y);
  }

  // d = { title, amount, payeeLabel, payee, payeeSub, rows: [[label, value]], tagline, demo }
  async function toBlob(d) {
    const W = 1080, H = 1500, X = 60, Y = 60, CW = W - 2 * X, CH = H - 2 * Y, HEAD = 250;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Ticket body, with the brand gradient across the top
    ctx.save();
    roundRect(ctx, X, Y, CW, CH, 48);
    ctx.clip();
    ctx.fillStyle = C.card;
    ctx.fillRect(X, Y, CW, CH);
    const g = ctx.createLinearGradient(X, Y + HEAD, X + CW, Y);
    g.addColorStop(0, C.purple);
    g.addColorStop(1, C.lime);
    ctx.fillStyle = g;
    ctx.fillRect(X, Y, CW, HEAD);
    ctx.restore();

    const logo = await loadImage("logo-icon.png");
    if (logo) {
      ctx.save();
      roundRect(ctx, X + 56, Y + 50, 100, 100, 24);
      ctx.clip();
      ctx.drawImage(logo, X + 56, Y + 50, 100, 100);
      ctx.restore();
    }
    text(ctx, "YAFI", X + 180, Y + 128, 64, C.bg, 800, "left");

    // Check mark sitting on the edge of the header
    const cx = W / 2, cy = Y + HEAD;
    ctx.beginPath(); ctx.arc(cx, cy, 78, 0, Math.PI * 2); ctx.fillStyle = C.card; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 64, 0, Math.PI * 2); ctx.fillStyle = C.green; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 28, cy + 2); ctx.lineTo(cx - 8, cy + 24); ctx.lineTo(cx + 30, cy - 20);
    ctx.lineWidth = 14; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = C.bg; ctx.stroke();

    text(ctx, d.title, cx, Y + 430, 54, C.text, 700);
    text(ctx, d.amount, cx, Y + 590, 132, C.text, 800);
    text(ctx, d.payeeLabel, cx, Y + 690, 38, C.muted);
    text(ctx, d.payee, cx, Y + 755, 52, C.text, 700);
    text(ctx, d.payeeSub, cx, Y + 810, 34, C.muted);

    // Perforation, as on a printed voucher
    const cutY = Y + 890;
    ctx.fillStyle = C.bg;
    ctx.beginPath(); ctx.arc(X, cutY, 30, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(X + CW, cutY, 30, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([18, 14]); ctx.lineWidth = 3; ctx.strokeStyle = C.border;
    ctx.beginPath(); ctx.moveTo(X + 50, cutY); ctx.lineTo(X + CW - 50, cutY); ctx.stroke();
    ctx.setLineDash([]);

    d.rows.forEach(([label, value], i) => {
      const ry = cutY + 100 + i * 82;
      text(ctx, label, X + 70, ry, 38, C.muted, 400, "left");
      text(ctx, value, X + CW - 70, ry, 40, C.text, 700, "right");
    });

    text(ctx, d.tagline, cx, Y + CH - 110, 46, C.lime, 800);
    text(ctx, d.demo, cx, Y + CH - 50, 30, C.muted);

    return new Promise((resolve) => cv.toBlob(resolve, "image/png"));
  }

  window.YafiReceipt = { toBlob };
})();
