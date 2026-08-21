export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequest = (code, message) => new HttpError(400, code, message);
export const unauthorized = (message = "请先登录。") => new HttpError(401, "UNAUTHORIZED", message);
export const notFound = (message = "内容不存在。") => new HttpError(404, "NOT_FOUND", message);
