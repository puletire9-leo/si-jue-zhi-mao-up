<template>
	<div class="task-list" :class="{ 'is-mini': browser.isMini }">
		<div class="list">
			<div
				v-for="(item, index) in list"
				:key="index"
				class="item"
				@click="edit(item)"
				@contextmenu="
					(e) => {
						onContextMenu(e, item);
					}
				"
			>
				<p class="name">{{ item.name }}</p>
				<p class="row">
					<span>执行服务</span>
					<span>{{ item.service }}</span>
				</p>
				<p class="row">
					<span>定时规则</span>
					<span>{{ item.taskType == 1 ? `间隔${item._every}秒执行` : item.cron }}</span>
				</p>

				<div class="status">
					<template v-if="item.status">
						<el-tag disable-transitions effect="dark" type="success">进行中</el-tag>

						<el-icon
							class="pause"
							@click.stop="stop(item)"
							v-permission="service.task.info.permission.stop"
						>
							<video-pause />
						</el-icon>
					</template>

					<template v-else>
						<el-tag disable-transitions effect="dark" type="danger">已停止</el-tag>

						<el-icon
							class="play"
							@click.stop="start(item)"
							v-permission="service.task.info.permission.start"
						>
							<video-play />
						</el-icon>
					</template>

					<cl-flex1 />

					<el-icon
						class="log"
						@click.stop="log(item)"
						v-permission="service.task.info.permission.log"
					>
						<tickets />
					</el-icon>

					<el-icon
						class="delete"
						@click.stop="remove(item)"
						v-permission="service.task.info.permission.delete"
					>
						<delete />
					</el-icon>
				</div>
			</div>

			<div
				class="item is-add"
				@click="edit()"
				v-permission="service.task.info.permission.add"
			>
				<el-icon>
					<plus />
				</el-icon>
				<p>添加计划任务</p>
			</div>
		</div>

		<!-- 分页 -->
		<div class="pagination">
			<el-pagination
				v-model:current-page="pagination.page"
				v-model:page-size="pagination.size"
				:total="pagination.total"
				:page-sizes="[10, 20, 50, 100]"
				layout="total, sizes, prev, pager, next, jumper"
				@current-change="onCurrentChange"
				@size-change="onSizeChange"
			/>
		</div>

		<!-- 表单 -->
		<cl-form ref="Form">
			<template #slot-cron-helper="{ scope }">
				<div class="cron-helper" v-if="scope.taskType == 0">
					<el-radio-group v-model="cronUi.mode" size="small">
						<el-radio-button label="everySecond">每N秒</el-radio-button>
						<el-radio-button label="everyMinute">每N分钟</el-radio-button>
						<el-radio-button label="dailyAt">每天固定时间</el-radio-button>
						<el-radio-button label="weeklyAt">每周固定时间</el-radio-button>
						<el-radio-button label="custom">自定义</el-radio-button>
					</el-radio-group>

					<div class="cron-helper__row" v-if="cronUi.mode == 'everySecond'">
						<el-input-number v-model="cronUi.step" :min="1" :max="3600" />
						<span class="cron-helper__text">秒执行一次</span>
					</div>

					<div class="cron-helper__row" v-else-if="cronUi.mode == 'everyMinute'">
						<el-input-number v-model="cronUi.step" :min="1" :max="1440" />
						<span class="cron-helper__text">分钟执行一次</span>
					</div>

					<div class="cron-helper__row" v-else-if="cronUi.mode == 'dailyAt'">
						<el-time-picker
							v-model="cronUi.time"
							value-format="HH:mm:ss"
							format="HH:mm:ss"
							placeholder="选择时间"
						/>
					</div>

					<div class="cron-helper__row" v-else-if="cronUi.mode == 'weeklyAt'">
						<el-select v-model="cronUi.weekDay" style="width: 120px">
							<el-option
								v-for="w in weekOptions"
								:key="w.value"
								:label="w.label"
								:value="w.value"
							/>
						</el-select>
						<el-time-picker
							v-model="cronUi.time"
							value-format="HH:mm:ss"
							format="HH:mm:ss"
							placeholder="选择时间"
						/>
					</div>

					<div class="cron-helper__row" v-else>
						<span class="cron-helper__text">手动编辑上面的 cron</span>
					</div>
				</div>
			</template>

			<template #slot-next-preview="{ scope }">
				<div class="next-preview">
					<div class="next-preview__title">未来 5 次执行时间</div>
					<div class="next-preview__error" v-if="nextRunPreview.error">
						{{ nextRunPreview.error }}
					</div>
					<div class="next-preview__list" v-else>
						<div class="next-preview__item" v-for="t in nextRunPreview.list" :key="t">
							{{ t }}
						</div>
						<div class="next-preview__empty" v-if="!nextRunPreview.list.length">
							暂无预览
						</div>
					</div>

					<el-button
						size="small"
						@click="
							() => {
								updateNextRunPreview(scope);
							}
						"
						>刷新预览</el-button
					>
				</div>
			</template>
		</cl-form>

		<!-- 日志 -->
		<task-logs :ref="setRefs('log')" />
	</div>
</template>

<script lang="ts" name="task-list" setup>
import { computed, onActivated, reactive, ref, watch } from "vue";
import { useBrowser, useCool } from "/@/cool";
import { VideoPlay, VideoPause, Plus, Tickets, Delete } from "@element-plus/icons-vue";
import { ContextMenu, useForm } from "@cool-vue/crud";
import { ElMessage, ElMessageBox } from "element-plus";
import TaskLogs from "../components/logs.vue";
import dayjs from "dayjs";

const { service, refs, setRefs } = useCool();
const { browser } = useBrowser();
const Form = useForm();

const list = ref<Eps.TaskInfoEntity[]>([]);

const pagination = reactive({
	page: 1,
	size: 20,
	total: 0
});

const serviceOptions = computed(() => {
	const set = new Set<string>();

	list.value.forEach((e) => {
		if (e.service) set.add(e.service);
	});
	return Array.from(set).map((e) => ({ label: e, value: e }));
});

const weekOptions = [
	{ label: "周日", value: 0 },
	{ label: "周一", value: 1 },
	{ label: "周二", value: 2 },
	{ label: "周三", value: 3 },
	{ label: "周四", value: 4 },
	{ label: "周五", value: 5 },
	{ label: "周六", value: 6 }
];

const cronUi = reactive<{
	mode: "everySecond" | "everyMinute" | "dailyAt" | "weeklyAt" | "custom";
	step: number;
	time: string;
	weekDay: number;
}>({
	mode: "everySecond",
	step: 10,
	time: "09:00:00",
	weekDay: 1
});

const nextRunPreview = reactive<{ list: string[]; error: string }>({
	list: [],
	error: ""
});

const currentForm = ref<any>(null);
let previewTimer: number | null = null;
let syncingCronFromUi = false;

// 刷新
function refresh() {
	service.task.info
		.page({
			size: pagination.size,
			page: pagination.page
		})
		.then((res) => {
			list.value = res.list.map((e) => {
				if (e.every) {
					e._every = parseInt(String(e.every / 1000));
				}

				return e;
			});

			pagination.total = res.pagination.total;
		});
}

function onCurrentChange(val: number) {
	refresh();
}

function onSizeChange(val: number) {
	pagination.page = 1;
	refresh();
}

// 2026-01-13
// function refreshAllServices() {
// 	service.task.info
// 		.serviceList()
// 		.then((res) => {
// 			allServices.value = Array.isArray(res) ? res : [];
// 		})
// 		.catch(() => {
// 			allServices.value = [];
// 		});
// }

function buildCronFromUi() {
	const step = Math.max(1, Number(cronUi.step) || 1);
	const [hh, mm, ss] = String(cronUi.time || "00:00:00")
		.split(":")
		.map((e) => Number(e));
	const safeH = Number.isFinite(hh) ? hh : 0;
	const safeM = Number.isFinite(mm) ? mm : 0;
	const safeS = Number.isFinite(ss) ? ss : 0;

	switch (cronUi.mode) {
		case "everySecond":
			return `*/${step} * * * * *`;
		case "everyMinute":
			return `0 */${step} * * * *`;
		case "dailyAt":
			return `${safeS} ${safeM} ${safeH} * * *`;
		case "weeklyAt":
			return `${safeS} ${safeM} ${safeH} * * ${cronUi.weekDay}`;
		default:
			return "";
	}
}

// 2026-01-13
// function applyCronFromUi(scope: any) {
// 	if (!scope || scope.taskType != 0) return;
// 	if (cronUi.mode == "custom") return;
// 	scope.cron = buildCronFromUi();
// 	updateNextRunPreview(scope);
// }

watch(
	() => [cronUi.mode, cronUi.step, cronUi.time, cronUi.weekDay],
	() => {
		if (!currentForm.value) return;
		if (currentForm.value.taskType != 0) return;
		if (cronUi.mode == "custom") return;

		syncingCronFromUi = true;
		currentForm.value.cron = buildCronFromUi();
		syncingCronFromUi = false;
	}
);

watch(
	() => currentForm.value?.cron,
	(val) => {
		if (!currentForm.value) return;
		if (currentForm.value.taskType != 0) return;
		if (syncingCronFromUi) return;
		if (cronUi.mode == "custom") return;

		const built = normalizeCron(buildCronFromUi());
		const input = normalizeCron(val);

		if (built && input && built != input) {
			cronUi.mode = "custom";
		}
	}
);

function normalizeCron(cron?: string) {
	const s = String(cron || "")
		.trim()
		.replace(/\s+/g, " ");
	if (!s) return "";
	const parts = s.split(" ");
	if (parts.length == 5) {
		return `0 ${s}`;
	}
	return s;
}

function parseCronField(field: string, min: number, max: number) {
	if (!field || field == "*") return { any: true, set: new Set<number>() };

	const set = new Set<number>();

	function addRange(from: number, to: number, step = 1) {
		const f = Math.max(min, from);
		const t = Math.min(max, to);
		for (let v = f; v <= t; v += step) {
			set.add(v);
		}
	}

	const groups = field.split(",");
	for (const g0 of groups) {
		const g = g0.trim();
		if (!g) continue;

		if (g == "*") {
			addRange(min, max, 1);
			continue;
		}

		if (g.startsWith("*/")) {
			const step = Number(g.slice(2));
			if (!Number.isFinite(step) || step <= 0) return null;
			addRange(min, max, step);
			continue;
		}

		const [rangePart, stepPart] = g.split("/");
		const step = stepPart ? Number(stepPart) : 1;
		if (!Number.isFinite(step) || step <= 0) return null;

		if (rangePart.includes("-")) {
			const [a, b] = rangePart.split("-").map((e) => Number(e));
			if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
			addRange(a, b, step);
			continue;
		}

		const n = Number(rangePart);
		if (!Number.isFinite(n)) return null;
		addRange(n, n, 1);
	}

	return { any: false, set };
}

function getNextRunsByInterval({
	everySeconds,
	startDate
}: {
	everySeconds: number;
	startDate?: any;
}) {
	const everyMs = Math.max(1, Math.floor((Number(everySeconds) || 0) * 1000));
	const base = dayjs();
	const start = startDate ? dayjs(startDate) : null;

	let first: dayjs.Dayjs;

	if (start && start.isValid()) {
		if (start.isAfter(base)) {
			first = start;
		} else {
			const diff = base.valueOf() - start.valueOf();
			const k = Math.ceil(diff / everyMs);
			first = start.add(k * everyMs, "millisecond");
		}
	} else {
		first = base.add(everyMs, "millisecond");
	}

	return new Array(5).fill(0).map((_, i) => first.add(i * everyMs, "millisecond"));
}

function getNextRunsByCron({ cron, startDate }: { cron: string; startDate?: any }) {
	const s = normalizeCron(cron);
	const parts = s.split(" ");
	if (parts.length != 6) {
		return { list: [], error: "cron 格式不正确（需要 6 段：秒 分 时 日 月 周）" };
	}

	const sec = parseCronField(parts[0], 0, 59);
	const min = parseCronField(parts[1], 0, 59);
	const hour = parseCronField(parts[2], 0, 23);
	const dom = parseCronField(parts[3], 1, 31);
	const mon = parseCronField(parts[4], 1, 12);
	const dow = parseCronField(parts[5], 0, 7);

	if (!sec || !min || !hour || !dom || !mon || !dow) {
		return { list: [], error: "cron 包含不支持的规则（仅支持 *, */n, a-b, a,b）" };
	}

	const now = dayjs();
	const start = startDate ? dayjs(startDate) : null;
	const base = start && start.isValid() && start.isAfter(now) ? start : now;

	function inSet(parsed: { any: boolean; set: Set<number> }, v: number) {
		return parsed.any || parsed.set.has(v);
	}

	const results: dayjs.Dayjs[] = [];
	let cursor = base.add(1, "second");
	const maxScanSeconds = 2_000_000;

	function dowValue(d: dayjs.Dayjs) {
		const w = d.day();
		return w;
	}

	for (let i = 0; i < maxScanSeconds && results.length < 5; i++) {
		const s = cursor.second();
		const m = cursor.minute();
		const h = cursor.hour();
		const day = cursor.date();
		const month = cursor.month() + 1;
		const week = dowValue(cursor);

		const okBase = inSet(sec, s) && inSet(min, m) && inSet(hour, h) && inSet(mon, month);

		if (okBase) {
			const domOk = inSet(dom, day);
			const dowOk = inSet(dow, week) || (dow.any ? true : dow.set.has(7) && week == 0);

			let dayOk = true;
			if (!dom.any && !dow.any) {
				dayOk = domOk || dowOk;
			} else if (!dom.any && dow.any) {
				dayOk = domOk;
			} else if (dom.any && !dow.any) {
				dayOk = dowOk;
			}

			if (dayOk) {
				results.push(cursor);
			}
		}

		cursor = cursor.add(1, "second");
	}

	if (!results.length) {
		return { list: [], error: "在可预览范围内未找到执行时间（可能 cron 太稀疏）" };
	}

	return { list: results, error: "" };
}

function updateNextRunPreview(scope: any) {
	try {
		nextRunPreview.error = "";
		nextRunPreview.list = [];

		if (!scope) return;

		if (scope.taskType == 1) {
			const res = getNextRunsByInterval({
				everySeconds: scope.every,
				startDate: scope.startDate
			});
			nextRunPreview.list = res.map((e) => e.format("YYYY-MM-DD HH:mm:ss"));
			return;
		}

		const { list, error } = getNextRunsByCron({
			cron: scope.cron,
			startDate: scope.startDate
		});

		nextRunPreview.error = error;
		nextRunPreview.list = list.map((e) => e.format("YYYY-MM-DD HH:mm:ss"));
	} catch (err: any) {
		nextRunPreview.list = [];
		nextRunPreview.error = err?.message || "预览失败";
	}
}

watch(
	() => [
		currentForm.value?.taskType,
		currentForm.value?.cron,
		currentForm.value?.every,
		currentForm.value?.startDate
	],
	() => {
		if (previewTimer) {
			window.clearTimeout(previewTimer);
		}
		previewTimer = window.setTimeout(() => {
			if (currentForm.value) {
				updateNextRunPreview(currentForm.value);
			}
		}, 300);
	},
	{ deep: false }
);

// 启用任务
function start(item: Eps.TaskInfoEntity) {
	ElMessageBox.confirm(`此操作将启用任务（${item.name}），是否继续？`, "提示", {
		type: "warning"
	})
		.then(() => {
			service.task.info
				.start({ id: item.id, type: item.type })
				.then(() => {
					refresh();
				})
				.catch((err) => {
					ElMessage.error(err.message);
				});
		})
		.catch(() => null);
}

// 停用任务
function stop(item: Eps.TaskInfoEntity) {
	ElMessageBox.confirm(`此操作将停用任务（${item.name}），是否继续？`, "提示", {
		type: "warning"
	})
		.then(() => {
			service.task.info
				.stop({ id: item.id })
				.then(() => {
					refresh();
				})
				.catch((err) => {
					ElMessage.error(err.message);
				});
		})
		.catch(() => null);
}

// 删除任务
function remove(item: Eps.TaskInfoEntity) {
	ElMessageBox.confirm(`此操作将删除任务（${item.name}），是否继续？`, "提示", {
		type: "warning"
	})
		.then(() => {
			service.task.info
				.delete({ ids: [item.id] })
				.then(() => {
					refresh();
				})
				.catch((err) => {
					ElMessage.error(err.message);
				});
		})
		.catch(() => null);
}

// 任务日志
function log(item: Eps.TaskInfoEntity) {
	refs.log.open(item);
}

// 新增、编辑
async function edit(item?: Eps.TaskInfoEntity) {
	if (item && !service.task.info._permission.update) {
		return false;
	}

	Form.value?.open({
		title: "编辑计划任务",
		width: "600px",
		props: {
			labelWidth: "80px"
		},
		items: [
			{
				label: "名称",
				prop: "name",
				component: {
					name: "el-input",
					props: {
						placeholder: "请输入名称"
					}
				},
				required: true
			},
			{
				label: "类型",
				prop: "taskType",
				value: 0,
				component: {
					name: "el-radio-group",
					options: [
						{
							label: "cron",
							value: 0
						},
						{
							label: "时间间隔",
							value: 1
						}
					]
				},
				required: true
			},
			{
				label: "cron",
				prop: "cron",
				hidden: ({ scope }) => scope.taskType == 1,
				component: {
					name: "el-input",
					props: {
						placeholder: "* * * * * *"
					}
				},
				required: true
			},
			{
				label: "cron生成",
				prop: "_cronHelper",
				hidden: ({ scope }) => scope.taskType == 1,
				component: {
					name: "slot-cron-helper"
				}
			},
			{
				label: "间隔(秒)",
				prop: "every",
				hidden: ({ scope }) => scope.taskType == 0,
				hook: {
					bind(value) {
						return value / 1000;
					},
					submit(value) {
						return value * 1000;
					}
				},
				component: {
					name: "el-input-number",
					props: {
						min: 1,
						max: 100000000
					}
				},
				required: true
			},
			{
				label: "service",
				prop: "service",
				component: {
					name: "el-input",
					props: {
						placeholder: "taskDemoService.test([1, 2])",
						clearable: true
					}
				}
			},
			{
				label: "开始时间",
				prop: "startDate",
				hidden: ({ scope }) => scope.taskType == 1,
				component: {
					name: "el-date-picker",
					props: {
						type: "datetime",
						"value-format": "YYYY-MM-DD HH:mm:ss"
					}
				}
			},
			{
				label: "执行预览",
				prop: "_nextPreview",
				component: {
					name: "slot-next-preview"
				}
			},
			{
				label: "备注",
				prop: "remark",
				component: {
					name: "el-input",
					props: {
						type: "textarea",
						rows: 3
					}
				}
			}
		],
		form: {
			...item
		},
		on: {
			open: (form) => {
				currentForm.value = form;
				updateNextRunPreview(form);

				const cron = normalizeCron(form?.cron);

				const mEverySec = cron.match(/^(\*\/\d+)\s+\*\s+\*\s+\*\s+\*\s+\*$/);
				const mEveryMin = cron.match(/^0\s+(\*\/\d+)\s+\*\s+\*\s+\*\s+\*$/);
				const mDaily = cron.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
				const mWeekly = cron.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\d)$/);

				if (mEverySec) {
					cronUi.mode = "everySecond";
					cronUi.step = Number(mEverySec[1].slice(2)) || cronUi.step;
				} else if (mEveryMin) {
					cronUi.mode = "everyMinute";
					cronUi.step = Number(mEveryMin[1].slice(2)) || cronUi.step;
				} else if (mWeekly) {
					cronUi.mode = "weeklyAt";
					cronUi.time = `${String(mWeekly[3]).padStart(2, "0")}:${String(
						mWeekly[2]
					).padStart(2, "0")}:${String(mWeekly[1]).padStart(2, "0")}`;
					cronUi.weekDay = Number(mWeekly[4]) || cronUi.weekDay;
				} else if (mDaily) {
					cronUi.mode = "dailyAt";
					cronUi.time = `${String(mDaily[3]).padStart(2, "0")}:${String(
						mDaily[2]
					).padStart(2, "0")}:${String(mDaily[1]).padStart(2, "0")}`;
				} else {
					cronUi.mode = "custom";
				}
			},
			submit: (data, { close, done }) => {
				delete (data as any)._cronHelper;
				delete (data as any)._nextPreview;

				if (!data.limit) {
					data.limit = null;
				}

				service.task.info[item?.id ? "update" : "add"](data)
					.then(() => {
						refresh();
						ElMessage.success("保存成功");
						close();
					})
					.catch((err) => {
						ElMessage.error(err.message);
						done();
					});
			}
		}
	});
}

// 执行一次
function once(item: Eps.TaskInfoEntity) {
	service.task.info
		.once({ id: item.id })
		.then(() => {
			refresh();
		})
		.catch((err) => {
			ElMessage.error(err.message);
		});
}

// 右键菜单
function onContextMenu(e: any, item: Eps.TaskInfoEntity) {
	ContextMenu.open(e, {
		list: [
			item.status
				? {
						label: "暂停",
						hidden: !service.task.info._permission.stop,
						callback(done) {
							stop(item);
							done();
						}
					}
				: {
						label: "开始",
						hidden: !service.task.info._permission.start,
						callback(done) {
							start(item);
							done();
						}
					},
			{
				label: "立即执行",
				hidden: !service.task.info._permission.once,
				callback(done) {
					once(item);
					done();
				}
			},
			{
				label: "编辑",
				hidden: !(
					service.task.info._permission.update && service.task.info._permission.info
				),
				callback(done) {
					edit(item);
					done();
				}
			},
			{
				label: "删除",
				hidden: !service.task.info._permission.delete,
				callback(done) {
					remove(item);
					done();
				}
			},
			{
				label: "查看日志",
				hidden: !service.task.info._permission.log,
				callback(done) {
					log(item);
					done();
				}
			}
		]
	});
}

onActivated(() => {
	refresh();
});
</script>

<style lang="scss" scoped>
.task-list {
	height: 100%;
	background-color: var(--el-bg-color-page);

	.pagination {
		display: flex;
		justify-content: center;
		padding: 10px 0;
		background-color: var(--el-bg-color);
	}

	.cron-helper {
		display: flex;
		flex-direction: column;
		gap: 10px;

		&__row {
			display: flex;
			align-items: center;
			gap: 10px;
			flex-wrap: wrap;
		}

		&__text {
			color: var(--el-text-color-regular);
			font-size: 12px;
		}
	}

	.next-preview {
		border: 1px solid var(--el-border-color-lighter);
		border-radius: 8px;
		padding: 10px;
		background: var(--el-fill-color-lighter);

		&__title {
			font-size: 13px;
			font-weight: 600;
			margin-bottom: 8px;
		}

		&__error {
			color: var(--el-color-danger);
			font-size: 12px;
			margin-bottom: 8px;
		}

		&__list {
			margin-bottom: 10px;
		}

		&__item {
			font-size: 12px;
			line-height: 20px;
		}

		&__empty {
			font-size: 12px;
			color: var(--el-text-color-secondary);
		}
	}

	.list {
		display: flex;
		flex-wrap: wrap;
		padding: 10px 10px 0 10px;
		box-sizing: border-box;
		background-color: inherit;

		.item {
			background-color: var(--el-bg-color);
			padding: 15px 20px 0 20px;
			border-radius: 10px;
			margin: 0 15px 15px 0;
			height: 200px;
			width: 350px;
			cursor: pointer;
			box-sizing: border-box;

			.name {
				font-size: 17px;
				font-weight: bold;
				margin-bottom: 10px;
				overflow: hidden;
				white-space: nowrap;
				text-overflow: ellipsis;
			}

			.row {
				margin-bottom: 10px;
				height: 40px;

				span {
					display: block;

					&:nth-child(1) {
						font-size: 12px;
						margin-bottom: 5px;
						color: var(--el-color-info);
					}

					&:nth-child(2) {
						font-size: 14px;
					}
				}
			}

			.status {
				display: flex;
				align-items: center;
				justify-content: space-between;
				border-top: 1px solid var(--el-border-color-lighter);
				height: 50px;

				.el-icon {
					font-size: 22px;
					cursor: pointer;
					margin-left: 10px;
					padding: 5px;
					border-radius: 4px;

					&:hover {
						background-color: var(--el-border-color-lighter);
					}

					&.play {
						color: var(--el-color-primary);
					}

					&.pause {
						color: var(--el-color-danger);
					}

					&.log {
						color: var(--el-color-info);
					}

					&.delete {
						color: var(--el-color-danger);
					}
				}
			}

			&:hover {
				background-color: var(--el-fill-color-lighter);
			}

			&.is-add {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				color: var(--el-color-info);

				.el-icon {
					font-size: 30px;
				}

				p {
					font-size: 13px;
					margin: 20px 0;
				}
			}
		}
	}

	&.is-mini {
		.item {
			width: 100%;
			margin: 0 0 15px 0;
		}
	}
}
</style>
