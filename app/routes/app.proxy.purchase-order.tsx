import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);

    return json({
      ok: true,
      method: "GET",
      message: "Endpoint App Proxy funcionando correctamente",
      url: request.url,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error validando App Proxy:", error);

    return json(
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

    return json({
      ok: true,
      method: "POST",
      message: "Orden recibida correctamente en Remix",
      received: payload,
      url: request.url,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error procesando App Proxy:", error);

    return json(
      {
        ok: false,
        message: "No se pudo validar o procesar la solicitud",
        url: request.url,
      },
      { status: 401 }
    );
  }
}