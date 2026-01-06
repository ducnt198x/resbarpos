import { Order } from '../types';

// Helper: Format tiền tệ VNĐ chuẩn
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Helper: Format ngày giờ
const formatDate = (dateString?: string) => {
  const date = dateString ? new Date(dateString) : new Date();
  return date.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

// Helper: Encode UTF-8 string to Base64 (Safe for Vietnamese)
const utf8ToBase64 = (str: string) => {
  return window.btoa(unescape(encodeURIComponent(str)));
};

/**
 * Tạo nội dung HTML sạch cho hóa đơn (Dùng chung cho cả 2 phương thức)
 */
const generateReceiptHTML = (order: any) => {
  const total = order.total || 0;
  
  // Thông tin cấu hình cơ bản (Có thể lấy từ Settings trong tương lai)
  const config = {
      storeName: "RESBAR POS SYSTEM",
      address: "27 tổ 4 Đông Anh, Hà Nội",
      wifiName: "ResBar_Guest",
      wifiPass: "67896789",
      footerMessage: "Cảm ơn & Hẹn gặp lại!"
  };

  // Đọc cấu hình ngân hàng từ localStorage
  const bankConfigStr = localStorage.getItem('bank_config');
  const bankConfig = bankConfigStr ? JSON.parse(bankConfigStr) : null;

  let qrHtml = '';
  if (bankConfig) {
    const qrUrl = `https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-compact2.png?amount=${total}&addInfo=${encodeURIComponent(order.id)}&accountName=${encodeURIComponent(bankConfig.accountName)}`;
    
    qrHtml = `
      <div class="divider"></div>
      <div class="text-center" style="margin-top: 10px;">
        <div class="font-bold uppercase" style="font-size: 10px; margin-bottom: 5px;">Quét mã để thanh toán</div>
        <img src="${qrUrl}" style="width: 40mm; height: 40mm; filter: grayscale(100%); -webkit-filter: grayscale(100%);" />
        <div style="font-size: 10px; margin-top: 5px;">
          <div><strong>${bankConfig.bankId}</strong></div>
          <div>STK: <strong>${bankConfig.accountNo}</strong></div>
          <div class="uppercase">${bankConfig.accountName}</div>
        </div>
      </div>
    `;
  }

  const itemsHtml = order.items.map((item: any) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <div style="width: 55%; font-weight: 600;">${item.name}</div>
        <div style="width: 15%; text-align: center;">x${item.quantity || item.qty}</div>
        <div style="width: 30%; text-align: right;">${formatMoney(item.price * (item.quantity || item.qty))}</div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: 72mm auto; margin: 0; }
          body { 
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            width: 72mm; margin: 0 auto; padding: 5px; background: white; color: black; font-size: 12px; line-height: 1.4;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .uppercase { text-transform: uppercase; }
          .store-name { font-size: 18px; font-weight: 900; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .flex-row { display: flex; justify-content: space-between; }
          .grand-total { font-size: 18px; font-weight: 900; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="text-center">
            <div class="store-name">${config.storeName}</div>
            <div style="font-size: 10px;">${config.address}</div>
        </div>
        <div class="divider"></div>
        <div style="font-size: 11px;">
            <div class="flex-row"><span>Số: #${order.id.toString().slice(-6)}</span><span>${formatDate(order.created_at)}</span></div>
            <div class="flex-row"><span>Bàn: <strong>${order.table}</strong></span><span>NV: ${order.staff}</span></div>
        </div>
        <div class="divider"></div>
        <div style="display: flex; font-weight: bold; font-size: 11px; margin-bottom: 5px;">
            <div style="width: 55%;">Món</div>
            <div style="width: 15%; text-align: center;">SL</div>
            <div style="width: 30%; text-align: right;">T.Tiền</div>
        </div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="flex-row"><span>Tổng cộng:</span><span class="font-bold">${formatMoney(total)}</span></div>
        <div class="flex-row"><span>Thanh toán:</span><span class="grand-total">${formatMoney(total)}</span></div>
        ${qrHtml}
        <div class="divider"></div>
        <div class="text-center" style="font-size: 10px;">
            <div>Wifi: ${config.wifiName} / Pass: ${config.wifiPass}</div>
            <div style="margin-top: 5px; font-weight: bold;">${config.footerMessage}</div>
        </div>
      </body>
    </html>
  `;
};

/**
 * In qua cơ chế Iframe của trình duyệt (PC/Laptop)
 */
const printViaIframe = (html: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '100%';
  iframe.style.bottom = '100%';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 800);
    };
  }
};

/**
 * In qua ứng dụng RawBT (Android)
 */
const printViaRawBT = (html: string) => {
  const base64Html = utf8ToBase64(html);
  window.location.href = `rawbt:data:text/html;base64,${base64Html}`;
};

// --- EXPORTS ---

export const printOrderReceipt = (order: any) => {
  if (!order) return;

  // Đọc cấu hình in ấn
  const printConfigStr = localStorage.getItem('print_config');
  const printConfig = printConfigStr ? JSON.parse(printConfigStr) : { method: 'browser' };

  const html = generateReceiptHTML(order);

  if (printConfig.method === 'rawbt') {
    printViaRawBT(html);
  } else {
    printViaIframe(html);
  }
};

export const printTestTicket = () => {
  const testOrder = {
    id: "TEST-PRINTER",
    table: "TEST",
    staff: "System",
    total: 0,
    items: [{ name: "Máy in hoạt động tốt", quantity: 1, price: 0 }],
    created_at: new Date().toISOString()
  };
  printOrderReceipt(testOrder);
};
