import { DefineComponent } from 'vue'

declare module '*.vue' {
  const component: DefineComponent<Record<string, never>, Record<string, never>, Record<string, unknown>>
  export default component
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: unknown
    }
  }
}

declare module '@vue/runtime-core' {
  export interface ComponentCustomProperties {
    [key: string]: unknown
  }
}

export {}
