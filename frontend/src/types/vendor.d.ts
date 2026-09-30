/**
 * Vendor type declarations for packages that ship without bundled TypeScript types.
 * These prevent TS2307 "Cannot find module" build errors on Vercel.
 *
 * jsPDF exposes a large API — we use a permissive class declaration so every
 * method call in pdfGenerator.ts passes the TypeScript compiler without
 * enumerating the entire jsPDF surface area.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module 'jspdf' {
  export class jsPDF {
    constructor(options?: Record<string, unknown>)
    // Allow any property / method access — jsPDF's API is very large and the
    // package ships with its own declarations in newer builds; this stub covers
    // the cases where the declaration file is absent in the build environment.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
}

declare module 'jspdf-autotable' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function autoTable(doc: any, options: Record<string, unknown>): void
  export default autoTable
}

declare module 'html2canvas' {
  interface Options {
    scale?: number
    useCORS?: boolean
    allowTaint?: boolean
    backgroundColor?: string | null
    canvas?: HTMLCanvasElement | null
    foreignObjectRendering?: boolean
    imageTimeout?: number
    ignoreElements?: (element: Element) => boolean
    logging?: boolean
    onclone?: (document: Document, element: HTMLElement) => void
    proxy?: string | null
    removeContainer?: boolean
    scrollX?: number
    scrollY?: number
    windowHeight?: number
    windowWidth?: number
    x?: number
    y?: number
    width?: number
    height?: number
  }
  function html2canvas(element: HTMLElement, options?: Options): Promise<HTMLCanvasElement>
  export default html2canvas
}
