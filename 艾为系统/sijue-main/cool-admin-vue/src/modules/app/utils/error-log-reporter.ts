import axios from "axios";
import { config } from "/@/config";
import { storage } from "/@/cool/utils";

type ErrorLogSource = "frontend" | "backend" | "task" | "third_party" | string;
type ErrorLogLevel = "error" | "warn" | "info" | string;

export interface ErrorLogReportPayload {
	source?: ErrorLogSource;
	level?: ErrorLogLevel;
	module?: string;
	message?: string;
	stack?: string;
	url?: string;
	method?: string;
	statusCode?: number | string;
	traceId?: string;
	userId?: number | string;
	userName?: string;
	userAgent?: string;
	requestParams?: unknown;
	responseBody?: unknown;
	extra?: unknown;
}

const REPORT_PATH = "/open/app/error_log/report";
const SENSITIVE_KEYS = [
	"password",
	"passwd",
	"pwd",
	"token",
	"access_token",
	"refresh_token",
	"authorization",
	"cookie",
	"set-cookie",
	"secret",
	"app_secret",
	"appsecret",
	"private_key",
	"credential",
	"session",
	"signature",
	"sign"
];
const recentReports = new Map<string, number>();
const REPORT_DEDUPE_MS = 10 * 1000;
const MAX_TEXT_LENGTH = 4000;

function isSensitiveKey(key: string) {
	const lower = key.toLowerCase();
	return SENSITIVE_KEYS.some((item) => lower.includes(item));
}

function limitText(value: string, maxLength = MAX_TEXT_LENGTH) {
	if (value.length <= maxLength) {
		return value;
	}

	const suffix = "...[truncated]";

	if (maxLength <= suffix.length) {
		return value.slice(0, maxLength);
	}

	return `${value.slice(0, maxLength - suffix.length)}${suffix}`;
}

function toPlainError(error: any) {
	if (!error) {
		return error;
	}

	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack
		};
	}

	return error;
}

function sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
	if (value === null || value === undefined) {
		return value;
	}

	if (typeof value === "string") {
		return limitText(value);
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return value;
	}

	if (typeof value === "bigint") {
		return value.toString();
	}

	if (typeof value === "function" || typeof value === "symbol") {
		return `[${typeof value}]`;
	}

	if (depth >= 6) {
		return "[max-depth]";
	}

	const plainValue = toPlainError(value);

	if (typeof plainValue !== "object" || plainValue === null) {
		return sanitize(plainValue, depth + 1, seen);
	}

	if (seen.has(plainValue as object)) {
		return "[circular]";
	}

	seen.add(plainValue as object);

	if (Array.isArray(plainValue)) {
		return plainValue.slice(0, 80).map((item) => sanitize(item, depth + 1, seen));
	}

	const output: Record<string, unknown> = {};

	Object.entries(plainValue as Record<string, unknown>)
		.slice(0, 120)
		.forEach(([key, item]) => {
			output[key] = isSensitiveKey(key) ? "[redacted]" : sanitize(item, depth + 1, seen);
		});

	return output;
}

function getUserInfo() {
	const userInfo = storage.get("userInfo") || {};

	return {
		userId: userInfo.id,
		userName: userInfo.username || userInfo.name || userInfo.nickName
	};
}

function getReportUrl() {
	return `${config.baseUrl}${REPORT_PATH}`;
}

function isReportUrl(url?: string) {
	return Boolean(url && url.includes(REPORT_PATH));
}

function normalizeMessage(payload: ErrorLogReportPayload) {
	if (payload.message) {
		return payload.message;
	}

	if (payload.responseBody) {
		const body = payload.responseBody as any;
		return body?.message || body?.msg || body?.error || "Frontend error";
	}

	return "Frontend error";
}

function getDedupeKey(payload: ErrorLogReportPayload) {
	return [
		payload.source || "frontend",
		payload.module || "",
		payload.url || "",
		payload.statusCode || "",
		normalizeMessage(payload)
	].join("|");
}

export function reportFrontendError(payload: ErrorLogReportPayload) {
	const url = payload.url || window.location.href;

	if (isReportUrl(url)) {
		return;
	}

	const now = Date.now();
	const key = getDedupeKey({ ...payload, url });
	const lastTime = recentReports.get(key);

	if (lastTime && now - lastTime < REPORT_DEDUPE_MS) {
		return;
	}

	recentReports.set(key, now);

	const user = getUserInfo();
	const data = sanitize({
		source: payload.source || "frontend",
		level: payload.level || "error",
		module: payload.module || "frontend",
		message: normalizeMessage(payload),
		stack: payload.stack,
		url,
		method: payload.method,
		statusCode: payload.statusCode,
		traceId: payload.traceId,
		userId: payload.userId ?? user.userId,
		userName: payload.userName ?? user.userName,
		userAgent: payload.userAgent || navigator.userAgent,
		requestParams: payload.requestParams,
		responseBody: payload.responseBody,
		extra: payload.extra
	});

	axios.post(getReportUrl(), data, { timeout: 8000 }).catch(() => null);
}

export function installFrontendErrorLogging() {
	const windowWithFlag = window as any;

	if (windowWithFlag.__APP_ERROR_LOG_INSTALLED__) {
		return;
	}

	windowWithFlag.__APP_ERROR_LOG_INSTALLED__ = true;

	window.addEventListener("error", (event) => {
		reportFrontendError({
			module: "window.error",
			message: event.message,
			stack: event.error?.stack,
			url: event.filename || window.location.href,
			extra: {
				lineno: event.lineno,
				colno: event.colno
			}
		});
	});

	window.addEventListener("unhandledrejection", (event) => {
		const reason = toPlainError(event.reason) as any;

		reportFrontendError({
			module: "window.unhandledrejection",
			message: reason?.message || String(event.reason || "Unhandled promise rejection"),
			stack: reason?.stack,
			extra: {
				reason
			}
		});
	});
}
