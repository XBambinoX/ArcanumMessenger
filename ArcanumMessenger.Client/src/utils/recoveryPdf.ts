import jsPDF from "jspdf";

interface RecoveryPdfOptions {
    username: string;
    phrase1: string;
    phrase2: string;
}

export function downloadRecoveryPdf({ username, phrase1, phrase2 }: RecoveryPdfOptions) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 56;
    let y = 72;

    // ── Header ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor("#7c3aed");
    doc.text("Arcanum", margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor("#666666");
    y += 20;
    doc.text("Recovery Kit", margin, y);

    y += 30;
    doc.setDrawColor("#dddddd");
    doc.line(margin, y, pageWidth - margin, y);
    y += 30;

    // ── Account info ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor("#111111");
    doc.text("Account", margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Username: ${username}`, margin, y);
    y += 14;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 34;

    const drawPhraseBlock = (label: string, phrase: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor("#7c3aed");
        doc.text(label, margin, y);
        y += 16;

        doc.setDrawColor("#e5e0f7");
        doc.setFillColor("#f7f5fc");
        const boxHeight = 44;
        doc.roundedRect(margin, y - 12, pageWidth - margin * 2, boxHeight, 6, 6, "FD");

        doc.setFont("courier", "normal");
        doc.setFontSize(12);
        doc.setTextColor("#222222");
        doc.text(phrase, margin + 12, y + 12, { maxWidth: pageWidth - margin * 2 - 24 });

        y += boxHeight + 20;
    };

    drawPhraseBlock("Recovery phrase 1", phrase1);
    drawPhraseBlock("Recovery phrase 2", phrase2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor("#c0392b");
    const warning =
        "Anyone with access to either phrase can recover your account. Store this document " +
        "somewhere safe and offline. Arcanum cannot show these phrases to you again.";
    const warningLines = doc.splitTextToSize(warning, pageWidth - margin * 2);
    doc.text(warningLines, margin, y);

    doc.save(`arcanum-recovery.pdf`);
}