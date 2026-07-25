import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index/route.tsx"),

  route("auth/*", "routes/auth.$.tsx"),
  route("webhooks/app/scopes_update", "routes/webhooks.app.scopes_update.tsx"),
  route("webhooks/app/uninstalled", "routes/webhooks.app.uninstalled.tsx"),

  route("app/proxy/purchase-order", "routes/app.proxy.purchase-order.tsx"),
] satisfies RouteConfig;