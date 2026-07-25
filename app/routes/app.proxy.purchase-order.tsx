import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

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

    return data({
      ok: true,
      method: "POST",
      message: "Orden recibida correctamente en la app",
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
      { status: 401 }
    );
  }
}