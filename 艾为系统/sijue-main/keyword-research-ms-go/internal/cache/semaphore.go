package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Semaphore limits concurrent holders via Redis SETNX slot keys (nil = disabled).
type Semaphore struct {
	r       *redis.Client
	prefix  string
	limit   int
	slotTTL time.Duration
}

func NewSemaphore(r *redis.Client, prefix string, limit int, slotTTL time.Duration) *Semaphore {
	if r == nil || limit <= 0 {
		return nil
	}
	if prefix == "" {
		prefix = "krgo:oxylabs:serp:slot"
	}
	if slotTTL <= 0 {
		slotTTL = 3 * time.Minute
	}
	return &Semaphore{
		r:       r,
		prefix:  prefix,
		limit:   limit,
		slotTTL: slotTTL,
	}
}

// Acquire blocks until a slot is available or ctx is canceled.
func (s *Semaphore) Acquire(ctx context.Context) (release func(), err error) {
	if s == nil {
		return func() {}, nil
	}
	token := fmt.Sprintf("%d", time.Now().UnixNano())
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()
	for {
		for i := 0; i < s.limit; i++ {
			key := fmt.Sprintf("%s:%d", s.prefix, i)
			ok, err := s.r.SetNX(ctx, key, token, s.slotTTL).Result()
			if err != nil {
				return nil, err
			}
			if !ok {
				continue
			}
			slotKey := key
			slotToken := token
			return func() {
				ctx2, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				val, err := s.r.Get(ctx2, slotKey).Result()
				if err == nil && val == slotToken {
					_ = s.r.Del(ctx2, slotKey).Err()
				}
			}, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
		}
	}
}
