import { ref } from "vue";
import { storageConfigure, storageConfigureChange } from "@/utils/storage";

export function useDataThemeChange() {
  const themeColors = ref([
    { color: "#ffffff", themeColor: "light" },
    { color: "#1b2a47", themeColor: "default" },
    { color: "#722ed1", themeColor: "saucePurple" },
    { color: "#eb2f96", themeColor: "pink" },
    { color: "#f5222d", themeColor: "dusk" },
    { color: "#fa541c", themeColor: "volcano" },
    { color: "#13c2c2", themeColor: "mingQing" },
    { color: "#52c41a", themeColor: "auroraGreen" }
  ]);

  const dataTheme = ref(!!storageConfigure.grey);
  const themeMode = ref(storageConfigure.themeMode);

  function toggleClass(flag: boolean, clsName: string, target?: HTMLElement) {
    const targetEl = target || document.body;
    let { className } = targetEl;
    className = className.replace(clsName, "").trim();
    targetEl.className = flag ? `${className} ${clsName}` : className;
  }

  const setEpThemeColor = (color: string) => {
    document.documentElement.style.setProperty("--el-color-primary", color);
  };

  function setLayoutThemeColor(theme: string) {
    document.documentElement.setAttribute("data-theme", theme);
    
    if (theme === "default" || theme === "light") {
      setEpThemeColor("#7C61D4");
    } else {
      const colors = themeColors.value.find(v => v.themeColor === theme);
      if (colors) {
        setEpThemeColor(colors.color);
      }
    }

    storageConfigureChange("themeColor", theme);
  }

  function dataThemeChange(mode: 'dark' | 'light' | 'system') {
    themeMode.value = mode;
    storageConfigureChange("themeMode", mode);

    const html = document.documentElement;
    
    if (mode === "dark") {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
    } else if (mode === "light") {
      html.classList.remove("dark");
      html.setAttribute("data-theme", "light");
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        html.classList.add("dark");
        html.setAttribute("data-theme", "dark");
      } else {
        html.classList.remove("dark");
        html.setAttribute("data-theme", "light");
      }
    }
  }

  function setMenuLayout(layout: 'horizontal' | 'vertical' | 'mix') {
    document.body.setAttribute("layout", layout);
    storageConfigureChange("menuLayout", layout);
  }

  function onReset() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  }

  return {
    dataTheme,
    themeMode,
    themeColors,
    toggleClass,
    dataThemeChange,
    setLayoutThemeColor,
    setMenuLayout,
    onReset
  };
}
