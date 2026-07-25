import { json, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    ok: true,
    message: "Ruta test funcionando",
    url: request.url,
    timestamp: new Date().toISOString(),
  });
}