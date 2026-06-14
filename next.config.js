/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit è server-only e legge font da disco via fs.
  // Externalize evita che webpack tenti di bundlare il pacchetto e i suoi
  // asset interni (incluso il font Helvetica AFM di default che pdfkit cerca).
  serverExternalPackages: ["pdfkit"],
}

module.exports = nextConfig
