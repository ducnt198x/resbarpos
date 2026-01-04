/**
 * Core Print Service
 * Uses a hidden iframe to print raw HTML strings.
 * This ensures styles are isolated from the main React app and fits 80mm thermal paper.
 */

export const printHTML = (htmlContent: string) => {
  // 1. Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  // 2. Write content
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // 3. Print after delay (to ensure render)
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Print failed", e);
    } finally {
      // 4. Cleanup
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }
  }, 500);
};

export const printTestTicket = () => {
  const now = new Date();
  
  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Print</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm; /* Standard printable area for 80mm paper */
            margin: 0 auto;
            padding: 5px 0;
            font-size: 12px;
            line-height: 1.2;
            color: black;
            background: white;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .text-lg { font-size: 16px; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          .my-2 { margin-top: 8px; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="font-bold text-lg">SYSTEM TEST</div>
          <div class="text-center my-2">Respo POS System</div>
          
          <div class="divider"></div>
          
          <div class="font-bold">PRINTER IS READY</div>
          <div>Connection Verified</div>
          
          <div class="divider"></div>
          
          <div>Date: ${now.toLocaleDateString()}</div>
          <div>Time: ${now.toLocaleTimeString()}</div>
          
          <div class="divider"></div>
          <div class="text-center" style="font-size: 10px;">End of Test</div>
        </div>
      </body>
    </html>
  `;

  printHTML(content);
};
