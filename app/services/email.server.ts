import nodemailer from "nodemailer";

type BuyerData = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  rfc?: string;
  city?: string;
  state?: string;
  clientType?: string;
  comments?: string;
};

type PurchaseOrderItem = {
  title?: string;
  sku?: string;
  variant?: string;
  quantity?: number;
};

type EmailOrderData = {
  folio: string;
  draftOrderName?: string;
  buyer: BuyerData;
  items: PurchaseOrderItem[];
};

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    throw new Error("Faltan variables SMTP en Render.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

function buildItemsHtml(items: PurchaseOrderItem[]) {
  return items
    .map((item, index) => {
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.title || ""}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.variant || "Sin variante"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.sku || "Sin SKU"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.quantity || 1}</td>
        </tr>
      `;
    })
    .join("");
}

function buildOrderHtml(order: EmailOrderData, recipientType: "seller" | "buyer") {
  const buyer = order.buyer;
  const title =
    recipientType === "seller"
      ? "Nueva orden de compra B2B"
      : "Confirmación de orden de compra";

  return `
    <div style="font-family: Arial, sans-serif; color: #0f2440; line-height: 1.5;">
      <h2>${title}</h2>

      <p><strong>Folio:</strong> ${order.folio}</p>
      ${
        order.draftOrderName
          ? `<p><strong>Borrador de Shopify:</strong> ${order.draftOrderName}</p>`
          : ""
      }

      <h3>Datos del comprador</h3>
      <p>
        <strong>Nombre:</strong> ${buyer.name || "No proporcionado"}<br>
        <strong>Empresa:</strong> ${buyer.company || "No proporcionada"}<br>
        <strong>Correo:</strong> ${buyer.email || "No proporcionado"}<br>
        <strong>Teléfono:</strong> ${buyer.phone || "No proporcionado"}<br>
        <strong>RFC / ID fiscal:</strong> ${buyer.rfc || "No proporcionado"}<br>
        <strong>Ciudad:</strong> ${buyer.city || "No proporcionada"}<br>
        <strong>Estado:</strong> ${buyer.state || "No proporcionado"}<br>
        <strong>Tipo de cliente:</strong> ${buyer.clientType || "No proporcionado"}
      </p>

      <h3>Productos solicitados</h3>

      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 10px; text-align: left;">#</th>
            <th style="padding: 10px; text-align: left;">Producto</th>
            <th style="padding: 10px; text-align: left;">Variante</th>
            <th style="padding: 10px; text-align: left;">SKU</th>
            <th style="padding: 10px; text-align: left;">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          ${buildItemsHtml(order.items)}
        </tbody>
      </table>

      <h3>Comentarios</h3>
      <p>${buyer.comments || "Sin comentarios"}</p>

      ${
        recipientType === "buyer"
          ? `<p>Hemos recibido tu solicitud. Nuestro equipo comercial revisará tu orden de compra y se pondrá en contacto contigo para continuar el proceso.</p>`
          : `<p>Esta solicitud fue generada desde el catálogo B2B de Shopify.</p>`
      }
    </div>
  `;
}

export async function sendSellerEmail(order: EmailOrderData) {
  const transporter = getTransporter();

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = process.env.SALES_EMAIL;

  if (!to) {
    throw new Error("Falta configurar SALES_EMAIL en Render.");
  }

  await transporter.sendMail({
    from,
    to,
    subject: `Nueva orden de compra B2B - ${order.folio}`,
    html: buildOrderHtml(order, "seller"),
  });
}

export async function sendBuyerConfirmationEmail(order: EmailOrderData) {
  const transporter = getTransporter();

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = order.buyer.email;

  if (!to) {
    throw new Error("No se encontró correo del comprador.");
  }

  await transporter.sendMail({
    from,
    to,
    subject: `Confirmación de orden de compra ${order.folio}`,
    html: buildOrderHtml(order, "buyer"),
  });
}