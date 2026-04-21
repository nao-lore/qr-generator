import QrGenerator from "./components/QrGenerator";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* AdSense slot - top banner */}
      <div className="w-full bg-gray-50 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-2 text-center text-xs text-gray-400">
          {/* AdSense slot */}
        </div>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            QR Code Generator
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Create QR codes for URLs, text, email, phone numbers, WiFi, and
            contacts. Customize colors, adjust size, and download as PNG or SVG.
          </p>
        </div>

        {/* QR Generator Tool */}
        <QrGenerator />

        {/* SEO Content Section */}
        <section className="mt-16 mb-12 max-w-3xl mx-auto prose prose-gray">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            What Is a QR Code?
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            A QR code (Quick Response code) is a two-dimensional barcode that
            stores information in a grid of black and white squares. QR codes can
            be scanned by smartphone cameras and QR reader apps to quickly access
            URLs, contact information, WiFi credentials, and more. They were
            invented in 1994 by Denso Wave and have become ubiquitous in
            marketing, payments, and everyday communication.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            How QR Codes Work
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            QR codes encode data using a matrix of dark and light modules. The
            code includes finder patterns (the three large squares in the
            corners) that help scanners detect and orient the code. Data is
            encoded in binary format with error correction, allowing the code to
            be read even if partially damaged. This generator uses Reed-Solomon
            error correction to ensure reliable scanning.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            How to Use This QR Code Generator
          </h2>
          <ol className="text-gray-700 leading-relaxed space-y-2 mb-4 list-decimal list-inside">
            <li>
              <strong>Select the input type</strong> — choose from URL, Text,
              Email, Phone, WiFi, or vCard to get the right format template.
            </li>
            <li>
              <strong>Enter your content</strong> — type or paste the text, URL,
              or information you want to encode.
            </li>
            <li>
              <strong>Customize appearance</strong> — adjust the size with the
              slider, and pick custom foreground and background colors.
            </li>
            <li>
              <strong>Download your QR code</strong> — save as PNG for images or
              SVG for scalable vector graphics.
            </li>
          </ol>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            QR Code Use Cases
          </h2>
          <ul className="text-gray-700 leading-relaxed space-y-2 mb-4 list-disc list-inside">
            <li>
              <strong>Marketing</strong> — link to websites, landing pages, or
              promotional content from print materials.
            </li>
            <li>
              <strong>Business cards</strong> — encode vCard contact information
              for easy sharing at events.
            </li>
            <li>
              <strong>WiFi sharing</strong> — let guests connect to your network
              by scanning a QR code instead of typing passwords.
            </li>
            <li>
              <strong>Payments</strong> — many payment platforms use QR codes for
              quick mobile transactions.
            </li>
            <li>
              <strong>Event tickets</strong> — encode ticket data for fast
              check-in at venues.
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Tips for Better QR Codes
          </h2>
          <ul className="text-gray-700 leading-relaxed space-y-2 mb-4 list-disc list-inside">
            <li>
              Keep the encoded data short. Shorter data produces simpler QR codes
              that scan faster and more reliably.
            </li>
            <li>
              Use high contrast between foreground and background colors. Dark on
              light works best for scanner compatibility.
            </li>
            <li>
              Test your QR code with multiple devices before printing or
              distributing.
            </li>
            <li>
              Use SVG format for print materials to ensure crisp edges at any
              size.
            </li>
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-sm text-gray-500 mb-4">QR Code Generator — Free online tool. No signup required.</p>
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Related Tools</p>
            <div className="flex flex-wrap justify-center gap-2">
              <a href="https://uuid-generator-eight-psi.vercel.app" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">UUID Generator</a>
              <a href="https://password-generator-sepia-beta.vercel.app" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Password Generator</a>
              <a href="https://favicon-generator-psi.vercel.app" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Favicon Generator</a>
              <a href="https://placeholder-image-fmq8sxvq6-naos-projects-52ff71e9.vercel.app" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Placeholder Image</a>
              <a href="https://base64-tools-three.vercel.app" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded">Base64 Tools</a>
            </div>
          </div>
          <div className="flex justify-center gap-3 text-xs text-gray-400">
            <a href="https://cc-tools.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">53+ Free Tools →</a>
          </div>
        </div>
      </footer>

      {/* AdSense slot - bottom banner */}
      <div className="w-full bg-gray-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-2 text-center text-xs text-gray-400">
          {/* AdSense slot */}
        </div>
      </div>
    </div>
  );
}
