import { createHash, randomBytes } from "node:crypto";

export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
export const createToken = () => randomBytes(32).toString("base64url");

export function registerAuth(app, { repository, config }) {
  app.decorateRequest("adminUser", null);
  app.decorateRequest("user", null);
  app.decorateRequest("visitorToken", null);

  app.addHook("onRequest", async (request, reply) => {
    const visitorToken = request.cookies.sinoherb_visitor;
    if (visitorToken) request.visitorToken = visitorToken;
    const sessionToken = request.cookies.sinoherb_admin_session;
    if (sessionToken && repository.getAdminSession) {
      request.adminUser = await repository.getAdminSession(hashToken(sessionToken));
    }
    const customerSessionToken = request.cookies.sinoherb_user_session;
    if (customerSessionToken && repository.getCustomerSession) {
      request.user = await repository.getCustomerSession(hashToken(customerSessionToken));
    }
    if (request.url.startsWith("/api/v1/admin/") && !request.url.includes("/auth/login") && !request.adminUser) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录。" } });
    }
  });

  return {
    ensureVisitorToken(reply, request) {
      if (request.visitorToken) return request.visitorToken;
      const token = createToken();
      request.visitorToken = token;
      reply.setCookie("sinoherb_visitor", token, {
        httpOnly: true,
        sameSite: config.nodeEnv === "production" ? "lax" : "lax",
        secure: config.nodeEnv === "production",
        path: "/",
        maxAge: config.cartRetentionDays * 86400,
      });
      return token;
    },
  };
}
