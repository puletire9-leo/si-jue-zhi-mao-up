import { DefineComponent } from 'vue'

declare module '*.vue' {
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
}

export {}
