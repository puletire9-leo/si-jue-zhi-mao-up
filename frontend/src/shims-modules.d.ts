declare module '@/stores/*' {
  import { DefineStoreOptions } from 'pinia'
  export function defineStore<T>(name: string, options: DefineStoreOptions<T>): T
}

declare module '@/api/*' {
  const content: any
  export default content
}

declare module '@/utils/*' {
  const content: any
  export default content
}

declare module '@/types/*' {
  const content: any
  export default content
}
