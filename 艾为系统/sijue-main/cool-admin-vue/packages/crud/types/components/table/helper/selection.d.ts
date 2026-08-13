/// <reference types="../index" />
export declare function useSelection({ emit, Data, config }: {
    emit: Vue.Emit;
    Data?: any;
    config?: any;
}): {
    selection: obj[];
    onSelectionChange: (selection: any[]) => void;
};
