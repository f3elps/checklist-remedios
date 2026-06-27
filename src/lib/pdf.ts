import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
  const img = canvas.toDataURL('image/png')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 24
  const usableWidth = pageWidth - margin * 2
  const ratio = canvas.height / canvas.width
  const imgHeight = usableWidth * ratio
  doc.addImage(img, 'PNG', margin, margin, usableWidth, imgHeight)
  doc.save(filename)
}
