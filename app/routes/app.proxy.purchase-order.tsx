import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

async function generateConsecutiveFolio() {
  const year = new Date().getFullYear();

  const sequence = await db.purchaseOrderSequence.upsert({
    where: {
      year,
    },
    update: {
      currentNumber: {
        increment: 1,
      },
    },
    create: {
      year,
      currentNumber: 1,
    },
  });

  const paddedNumber = String(sequence.currentNumber).padStart(6, "0");

  return `OC-TEXTIL-${year}-${paddedNumber}`;
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

    const payload = await request.json().catch(() => ({}));

    if (!payload?.buyer?.email) {
      return data(
        {
          ok: false,
          message: "El correo del comprador es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (!payload?.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return data(
        {
          ok: false,
          message: "La orden no contiene productos.",
        },
        { status: 400 }
      );
    }

    const folio = await generateConsecutiveFolio();

    console.log("Nueva orden de compra recibida:", {
      folio,
      buyer: payload.buyer,
      items: payload.items,
    });

    return data({
      ok: true,
      method: "POST",
      message: "Orden recibida correctamente en la app",
      folio,
      received: payload,
      url: request.url,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error procesando App Proxy:", error);

    return data(
      {
        ok: false,
        message: "No se pudo validar o procesar la solicitud",
        url: request.url,
      },
      { status: 500 }
    );
  }
}