import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@/api/competitor", () => ({
  competitorApi: {
    getDengZongShopSellers: vi.fn().mockResolvedValue({
      data: [],
    }),
  },
}));

import SelectionQueryForm from "./index.vue";

describe("SelectionQueryForm", () => {
  it("preserves externally controlled seller selection when country changes", async () => {
    const wrapper = mount(SelectionQueryForm, {
      props: {
        pageType: "all",
        modelValue: {
          country: "UK",
          sellerSelect: "seller-uk",
          storeName: "seller-uk",
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).readQueryParams()).toMatchObject({
      country: "UK",
      sellerSelect: "seller-uk",
      storeName: "seller-uk",
    });
    expect((wrapper.vm as any).getQueryParams()).toMatchObject({
      country: "UK",
      sellerSelect: "seller-uk",
      storeName: "seller-uk",
    });

    await wrapper.setProps({
      modelValue: {
        country: "DE",
        sellerSelect: "seller-de",
        storeName: "seller-de",
      },
    });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).readQueryParams()).toMatchObject({
      country: "DE",
      sellerSelect: "seller-de",
      storeName: "seller-de",
    });
    expect((wrapper.vm as any).getQueryParams()).toMatchObject({
      country: "DE",
      sellerSelect: "seller-de",
      storeName: "seller-de",
    });
  });
});
