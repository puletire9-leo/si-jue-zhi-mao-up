type EventHandler = (...args: any[]) => void

interface Events {
  [key: string]: EventHandler[]
}

class EventEmitter {
  private events: Events = {}

  on(event: string, handler: EventHandler) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(handler)
  }

  off(event: string, handler?: EventHandler) {
    if (!this.events[event]) return
    
    if (handler) {
      this.events[event] = this.events[event].filter(h => h !== handler)
    } else {
      this.events[event] = []
    }
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return
    
    this.events[event].forEach(handler => {
      try {
        handler(...args)
      } catch (e) {
        console.error('Event handler error:', e)
      }
    })
  }

  once(event: string, handler: EventHandler) {
    const onceHandler = (...args: any[]) => {
      handler(...args)
      this.off(event, onceHandler)
    }
    this.on(event, onceHandler)
  }
}

export const emitter = new EventEmitter()
