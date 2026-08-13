import type { Plugin } from "vite";
import { createEps } from "./eps";
import { createModule } from "./module";

export function virtual(): Plugin {
	const virtualModuleIds = ["virtual:eps", "virtual:module"];

	// 首次启动加载 Eps
	createEps();

	return {
		name: "vite-cool-virtual",
		enforce: "pre",
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				// 页面刷新时触发
				if (req.url == "/@vite/client") {
					// 重新加载虚拟模块
					virtualModuleIds.forEach((vm) => {
						const mod = server.moduleGraph.getModuleById(`\0${vm}`);

						if (mod) {
							server.moduleGraph.invalidateModule(mod);
						}
					});
				}

				next();
			});
		},
		async handleHotUpdate({ file, server }) {
			// 代码保存时触发
			if (!file.includes("build/cool/dist")) {
				// 重新生成 eps.d.ts 类型文件
				await createEps();

				// 通知客户端重新从后端拉取 EPS
				server.ws.send({
					type: "custom",
					event: "eps-update",
					data: {}
				});
			}
		},
		resolveId(id) {
			if (virtualModuleIds.includes(id)) {
				return "\0" + id;
			}
		},
		async load(id) {
			if (id === "\0virtual:eps") {
				// 仍然调用 createEps() 生成 eps.d.ts 类型文件（开发体验）
				await createEps();

				// 不再把 eps 数据烘焙进 bundle，运行时从后端动态获取
				return `
					export const eps = { service: {} }
				`;
			}

			if (id === "\0virtual:module") {
				const { dirs } = createModule();

				return `
					export const dirs = ${JSON.stringify(dirs)}
				`;
			}
		}
	};
}
