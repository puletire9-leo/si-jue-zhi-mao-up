package clients

import (
	"errors"
	"fmt"
)

var (
	ErrUnauthorized   = errors.New("external unauthorized")
	ErrRateLimited    = errors.New("external rate limited")
	ErrTimeout        = errors.New("external timeout")
	ErrBadResponse    = errors.New("external bad response")
	ErrNoSearchResult = errors.New("external no search result")
)

func wrapExternal(errType error, provider, msg string, cause error) error {
	base := fmt.Errorf("%s: %s", provider, msg)
	if cause == nil {
		return fmt.Errorf("%w: %v", errType, base)
	}
	return fmt.Errorf("%w: %v: %w", errType, base, cause)
}
