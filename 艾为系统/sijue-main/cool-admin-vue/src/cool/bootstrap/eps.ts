import { cloneDeep, isEmpty, merge } from "lodash-es";
import { BaseService, service } from "../service";
import { Module } from "../types";
import { path2Obj, toCamel } from "../utils";
import { config, isDev } from "/@/config";
import { hmr } from "../hook";
import { module } from "../module";
import axios from "axios";

const EPS_CACHE_KEY = "eps:list";

// 将 service 树的叶子节点转换为 BaseService 实例
function set(d: any) {
	if (d.namespace) {
		const a = new BaseService(d.namespace);

		// 把原型方法提升为 own property，确保 for...in 能拷贝到目标对象
		a.request = a.request;

		for (const i in d) {
			const { path, method = "get" } = d[i];

			if (path) {
				a[i] = function (data?: any) {
					return this.request({
						url: path,
						method,
						[method.toLocaleLowerCase() == "post" ? "data" : "params"]: data
					});
				};
			}
		}

		for (const i in a) {
			d[i] = a[i];
		}
	} else {
		for (const i in d) {
			set(d[i]);
		}
	}
}

// 从 EPS entity 列表构建 service 嵌套树
function buildService(list: any[]) {
	const svc: any = {};

	list.forEach((e: any) => {
		if (!e.prefix) return;

		const arr = e.prefix
			.replace(/\//, "")
			.replace("admin", "")
			.split("/")
			.filter(Boolean)
			.map(toCamel);

		function deep(d: any, i: number) {
			const k = arr[i];

			if (k) {
				if (arr[i + 1]) {
					if (!d[k]) {
						d[k] = {};
					}

					deep(d[k], i + 1);
				} else {
					if (!d[k]) {
						d[k] = {
							namespace: e.prefix.substring(1),
							permission: {}
						};
					}

					(e.api || []).forEach((a: any) => {
						let n = a.path?.replace("/", "");

						if (n) {
							if (n.includes("/:")) {
								a.path = a.path.split("/:")[0];
								n = n.split("/:")[0];
							}

							d[k][n] = a;
						}
					});

					const names = Object.keys(d[k]).filter(
						(key) => !["namespace", "permission"].includes(key)
					);

					names.forEach((key) => {
						d[k].permission[key] =
							`${d[k].namespace.replace("admin/", "")}/${key}`.replace(/\//g, ":");
					});
				}
			}
		}

		deep(svc, 0);
	});

	return svc;
}

// 从后端动态获取 EPS 数据，失败则降级到 localStorage 缓存
async function fetchEps(): Promise<any[]> {
	try {
		const baseUrl = config.baseUrl;
		const res = await axios.get(`${baseUrl}/admin/base/open/eps`, {
			timeout: 10000
		});

		const { code, data } = res.data;

		if (code === 1000 && !isEmpty(data)) {
			const list = Object.values(data).flat() as any[];
			try {
				localStorage.setItem(EPS_CACHE_KEY, JSON.stringify(list));
			} catch {}
			return list;
		}
	} catch (err) {
		console.warn("[eps] 获取 eps 数据失败，尝试使用本地缓存");
	}

	// 降级：使用 localStorage 缓存
	try {
		const cached = localStorage.getItem(EPS_CACHE_KEY);
		if (cached) {
			return JSON.parse(cached);
		}
	} catch {}

	return [];
}

// 更新 service
function onUpdate(epsSvc?: any) {
	if (epsSvc) {
		set(epsSvc);
		merge(service, epsSvc);
	}

	// 合并本地 module 的 service
	merge(
		service,
		cloneDeep(
			path2Obj(
				module.list.reduce((a: any, b: any) => {
					return a.concat(...((b.services as any[]) || []));
				}, [])
			)
		)
	);

	hmr.setData("service", service);

	if (isDev) {
		console.log("[eps] update");
	}
}

export async function createEps(modules: Module[]) {
	// 运行时从后端动态获取 EPS
	const list = await fetchEps();
	const epsSvc = list.length > 0 ? buildService(list) : undefined;

	onUpdate(epsSvc);

	// 开发环境下，生成本地 service 的类型描述文件
	if (isDev && config.test.eps) {
		const localList: any[] = [];

		modules.forEach((m) => {
			m.services?.forEach((s) => {
				const api = Array.from(
					new Set([
						...Object.getOwnPropertyNames(s.value.constructor.prototype),
						"page",
						"list",
						"info",
						"delete",
						"update",
						"add"
					])
				)
					.filter((e) => !["constructor", "namespace"].includes(e))
					.map((e) => {
						return {
							path: `/${e}`
						};
					});

				localList.push({
					api,
					module: m.name,
					name: s.value.constructor.name + "Entity",
					prefix: `/admin/${s.path}`,
					isLocal: true
				});
			});
		});

		service.request({
			url: "/__cool_eps",
			method: "POST",
			proxy: false,
			data: {
				list: localList
			}
		});
	}
}

// 监听 vite HMR — 重新从后端拉取最新 EPS
if (import.meta.hot) {
	import.meta.hot.on("eps-update", () => {
		fetchEps().then((list) => {
			const epsSvc = list.length > 0 ? buildService(list) : undefined;
			onUpdate(epsSvc);
		});
	});
}
