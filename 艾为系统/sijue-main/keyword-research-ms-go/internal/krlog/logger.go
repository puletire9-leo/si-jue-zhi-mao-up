package krlog

import "log"

var errorLogger = log.New(log.Writer(), "[keyword-research][error] ", log.LstdFlags)

// Errorf logs a single error line to stderr (visible in docker logs).
func Errorf(format string, args ...any) {
	errorLogger.Printf(format, args...)
}
