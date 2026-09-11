import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const BRAND = '#0A6ED1'
const DARK = '#071B33'

export function newReportDoc(title: string, subtitle?: string, brandName = 'System_2F') {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFillColor(DARK)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F')
  doc.setTextColor('#FFFFFF')
  doc.setFontSize(14)
  doc.text(brandName, 10, 14)

  doc.setTextColor('#111111')
  doc.setFontSize(16)
  doc.text(title, 10, 32)
  if (subtitle) {
    doc.setFontSize(10)
    doc.setTextColor('#555555')
    doc.text(subtitle, 10, 39)
  }
  return doc
}

// Adiciona uma nova página ao doc já existente, com o mesmo cabeçalho de
// marca — usado para relatórios com uma página por projeto (ex: status
// report semanal), tudo num único PDF.
export function addReportPage(doc: jsPDF, title: string, subtitle?: string, brandName = 'System_2F') {
  doc.addPage()
  doc.setFillColor(DARK)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F')
  doc.setTextColor('#FFFFFF')
  doc.setFontSize(14)
  doc.text(brandName, 10, 14)

  doc.setTextColor('#111111')
  doc.setFontSize(16)
  doc.text(title, 10, 32)
  if (subtitle) {
    doc.setFontSize(10)
    doc.setTextColor('#555555')
    doc.text(subtitle, 10, 39)
  }
}

export function addReportTable(
  doc: jsPDF,
  head: string[],
  body: (string | number)[][],
  startY = 45,
) {
  autoTable(doc, {
    head: [head],
    body,
    startY,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: BRAND, textColor: '#FFFFFF' },
    alternateRowStyles: { fillColor: '#F5F7FA' },
  })
}

export function footerAndSave(doc: jsPDF, filename: string) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor('#94A3B8')
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')} · página ${i}/${pageCount}`,
      10,
      doc.internal.pageSize.getHeight() - 8,
    )
  }
  doc.save(filename)
}
