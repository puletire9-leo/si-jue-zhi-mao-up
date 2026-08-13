package metrics

import (
	"sync"
	"time"
)

type Collector struct {
	mu       sync.Mutex
	Timings  map[string]float64
	Counters map[string]int
}

func New() *Collector {
	return &Collector{
		Timings:  map[string]float64{},
		Counters: map[string]int{},
	}
}

func (c *Collector) Time(name string, fn func()) {
	start := time.Now()
	fn()
	elapsed := float64(time.Since(start).Milliseconds())
	c.mu.Lock()
	c.Timings[name] += elapsed
	c.mu.Unlock()
}

func (c *Collector) Incr(name string, val int) {
	c.mu.Lock()
	c.Counters[name] += val
	c.mu.Unlock()
}

