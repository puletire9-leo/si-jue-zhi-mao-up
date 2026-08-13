# syntax=docker/dockerfile:1

FROM golang:1.22-alpine AS builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o /out/api ./cmd/api && CGO_ENABLED=1 go build -o /out/worker ./cmd/worker

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Shanghai
COPY --from=builder /out/api /app/bin/api
COPY --from=builder /out/worker /app/bin/worker
COPY .env.example /app/.env.example
EXPOSE 8099
CMD ["/app/bin/api"]

