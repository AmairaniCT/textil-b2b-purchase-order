import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { sendBuyerConfirmationEmail, sendSellerEmail } from "../services/email.server";

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
  productId?: string;
  variantId?: string;
  shopifyVariantGid?: string;
  sku?: string;
  variant?: string;
  quantity?: number;
};

type PurchaseOrderPayload = {
  buyer?: BuyerData;
  items?: PurchaseOrderItem[];
  source?: string;
  shopDomain?: string;
  submittedAt?: string;
};

async function generateConsecutiveFolio() {
  const year = new Date().getFullYear();

  const sequence = await db.purchaseOrderSequence.upsert({
    where: { year },
    update: {
      currentNumber: { increment: 1 },
    },
    create: {
      year,
      currentNumber: 1,
    },
  });

  const paddedNumber = String(sequence.currentNumber).padStart(6, "0");
  return `OC-TEXTIL-${year}-${paddedNumber}`;
}

function normalizeQuantity(quantity: unknown) {
  const parsed = Number(quantity);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

function buildDraftOrderNote(folio: string, buyer: BuyerData, payload: PurchaseOrderPayload) {
  return [
    `Folio: ${folio}`,
    "",
    "DATOS DEL COMPRADOR",
    `Nombre: ${buyer.name || "No proporcionado"}`,
    `Empresa: ${buyer.company || "No proporcionada"}`,
    `Correo: ${buyer.email || "No proporcionado"}`,
    `Teléfono: ${buyer.phone || "No proporcionado"}`,
    `RFC / ID fiscal: ${buyer.rfc || "No proporcionado"}`,
    `Ciudad: ${buyer.city || "No proporcionada"}`,
    `Estado: ${buyer.state || "No proporcionado"}`,
    `Tipo de cliente: ${buyer.clientType || "No proporcionado"}`,
    "",
    "COMENTARIOS",
    buyer.comments || "Sin comentarios",
    "",
    "ORIGEN",
    `Fuente: ${payload.source || "shopify_cart_b2b"}`,
    `Tienda: ${payload.shopDomain || "No proporcionada"}`,
    `Fecha de solicitud: ${new Date().toISOString()}`,
  ].join("\n");
}

function buildLineItems(items: PurchaseOrderItem[]) {
  return items.map((item) => {
    const variantId =
      item.shopifyVariantGid ||
      (item.variantId ? `gid://shopify/ProductVariant/${item.variantId}` : "");

    if (!variantId) {
      throw new Error(`El producto "${item.title || "sin título"}" no tiene variantId.`);
    }

    return {
      variantId,
      quantity: normalizeQuantity(item.quantity),
      customAttributes: [
        {
          key: "SKU",
          value: item.sku || "Sin SKU",
        },
        {
          key: "Variante",
          value: item.variant || "Sin variante",
        },
      ],
    };
  });
}

async function shopifyGraphQL(query: string, variables: Record<string, unknown>) {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-10";

  if (!shopDomain) {
    throw new Error("Falta configurar SHOPIFY_SHOP_DOMAIN en Render.");
  }

  if (!accessToken) {
    throw new Error("Falta configurar SHOPIFY_ADMIN_ACCESS_TOKEN en Render.");
  }

  const response = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    }
  );

  const responseText = await response.text();

  let result: any;

  try {
    result = JSON.parse(responseText);
  } catch {
    console.error("Respuesta no JSON de Shopify Admin API:", responseText);
    throw new Error("Shopify Admin API devolvió una respuesta inválida.");
  }

  if (!response.ok) {
    console.error("Error HTTP Shopify Admin API:", result);
    throw new Error(`Shopify Admin API respondió con status ${response.status}.`);
  }

  return result;
}

async function createDraftOrder(payload: PurchaseOrderPayload, folio: string) {
  const buyer = payload.buyer || {};
  const items = payload.items || [];

  const lineItems = buildLineItems(items);
  const note = buildDraftOrderNote(folio, buyer, payload);

  const mutation = `
    mutation CreateB2BDraftOrder($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          name
          invoiceUrl
          createdAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const result = await shopifyGraphQL(mutation, {
    input: {
      email: buyer.email,
      note,
      tags: ["B2B", "Orden de compra", "Solicitud web", folio],
      customAttributes: [
        {
          key: "Folio",
          value: folio,
        },
        {
          key: "Empresa",
          value: buyer.company || "No proporcionada",
        },
        {
          key: "Teléfono",
          value: buyer.phone || "No proporcionado",
        },
        {
          key: "RFC / ID fiscal",
          value: buyer.rfc || "No proporcionado",
        },
        {
          key: "Tipo de cliente",
          value: buyer.clientType || "No proporcionado",
        },
      ],
      lineItems,
    },
  });

  if (result.errors?.length) {
    const graphQLErrorMessage = result.errors
      .map((error: { message: string }) => error.message)
      .join(" | ");

    throw new Error(graphQLErrorMessage);
  }

  const createResult = result.data?.draftOrderCreate;

  if (createResult?.userErrors?.length) {
    const errorMessage = createResult.userErrors
      .map((error: { field?: string[]; message: string }) => {
        const field = error.field?.join(".") || "draftOrder";
        return `${field}: ${error.message}`;
      })
      .join(" | ");

    throw new Error(errorMessage);
  }

  if (!createResult?.draftOrder?.id) {
    throw new Error("Shopify no devolvió una draft order válida.");
  }

  return createResult.draftOrder;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);

    return data({
      ok: true,
      method: "GET",
      message: "Endpoint App Proxy funcionando correctamente",
      url: request.url,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error validando App Proxy:", error);

    return data(
      {
        ok: false,
        message: "No se pudo validar el App Proxy",
        url: request.url,
      },
      { status: 401 }
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);

    const payload = (await request.json().catch(() => ({}))) as PurchaseOrderPayload;
    const buyer = payload.buyer || {};
    const items = payload.items || [];

    if (!buyer.email) {
      return data(
        {
          ok: false,
          message: "El correo del comprador es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (!items.length) {
      return data(
        {
          ok: false,
          message: "La orden no contiene productos.",
        },
        { status: 400 }
      );
    }

    const folio = await generateConsecutiveFolio();
    const draftOrder = await createDraftOrder(payload, folio);

    await sendSellerEmail({
      folio,
      draftOrderName: draftOrder.name,
      buyer,
      items,
    });

    await sendBuyerConfirmationEmail({
      folio,
      draftOrderName: draftOrder.name,
      buyer,
      items,
    });

    console.log("Draft order creada correctamente:", {
      folio,
      draftOrderId: draftOrder.id,
      draftOrderName: draftOrder.name,
      buyerEmail: buyer.email,
    });

    return data({
      ok: true,
      method: "POST",
      message: "Orden de compra creada correctamente en Shopify",
      folio,
      draftOrderId: draftOrder.id,
      draftOrderName: draftOrder.name,
      invoiceUrl: draftOrder.invoiceUrl,
      url: request.url,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error procesando orden de compra:", error);

    return data(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear la orden de compra en Shopify.",
        url: request.url,
      },
      { status: 500 }
    );
  }
}