import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await authenticate.public.appProxy(request);

    return json({
      ok: true,
      method: "GET",
      message: "Endpoint App Proxy funcionando correctamente",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en loader app proxy:", error);

    return json(
      {
        ok: false,
        message: "No se pudo validar el App Proxy",
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en action app proxy:", error);

    return json(
      {
        ok: false,
        message: "No se pudo validar o procesar la solicitud",
      },
      { status: 401 }
    );
  }
}