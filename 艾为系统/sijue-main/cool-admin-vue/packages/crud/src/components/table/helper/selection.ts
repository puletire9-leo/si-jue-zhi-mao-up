import { useCore } from "../../../hooks";

export function useSelection({ emit, Data, config }: { emit: Vue.Emit; Data?: any; config?: any }) {
	const { crud } = useCore();

	// 选择项发生变化
	function onSelectionChange(selection: any[]) {
		if (Data?.data?.value && config?.rowKey) {
			const rowKey = config.rowKey;
			const currentPageKeys = new Set(Data.data.value.map((a: any) => a[rowKey]));

			// 保留其他页的选中项，仅替换当前页的选中项
			const otherPageItems = crud.selection.filter(
				(s: any) => !currentPageKeys.has(s[rowKey])
			);

			crud.selection.splice(0, crud.selection.length, ...otherPageItems, ...selection);
		} else {
			crud.selection.splice(0, crud.selection.length, ...selection);
		}
		emit("selection-change", crud.selection);
	}

	return {
		selection: crud.selection,
		onSelectionChange
	};
}
