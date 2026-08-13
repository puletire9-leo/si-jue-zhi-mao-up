package cache

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type memEntry struct {
	payload []byte
	expires time.Time
}

// Store wraps Redis (or in-memory fallback) JSON cache with hit/miss stats.
type Store struct {
	r     *redis.Client
	mu    sync.Mutex
	mem   map[string]memEntry
	Stats map[string]int
}

func New(r *redis.Client) *Store {
	return &Store{
		r:     r,
		mem:   make(map[string]memEntry),
		Stats: map[string]int{"hit": 0, "miss": 0},
	}
}

func (s *Store) bump(stat string) {
	s.mu.Lock()
	s.Stats[stat]++
	s.mu.Unlock()
}

func (s *Store) GetJSON(ctx context.Context, key string, dest any) bool {
	raw, ok := s.getBytes(ctx, key)
	if !ok {
		s.bump("miss")
		return false
	}
	if err := json.Unmarshal(raw, dest); err != nil {
		s.bump("miss")
		return false
	}
	s.bump("hit")
	return true
}

func (s *Store) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) {
	payload, err := json.Marshal(value)
	if err != nil {
		return
	}
	s.setBytes(ctx, key, payload, ttl)
}

func (s *Store) getBytes(ctx context.Context, key string) ([]byte, bool) {
	if s.r != nil {
		raw, err := s.r.Get(ctx, key).Bytes()
		if err == redis.Nil || err != nil {
			return nil, false
		}
		return raw, true
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.mem[key]
	if !ok || time.Now().After(entry.expires) {
		if ok {
			delete(s.mem, key)
		}
		return nil, false
	}
	return entry.payload, true
}

func (s *Store) setBytes(ctx context.Context, key string, payload []byte, ttl time.Duration) {
	if ttl <= 0 {
		ttl = time.Hour
	}
	if s.r != nil {
		_ = s.r.Set(ctx, key, payload, ttl).Err()
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.mem[key] = memEntry{payload: payload, expires: time.Now().Add(ttl)}
}
