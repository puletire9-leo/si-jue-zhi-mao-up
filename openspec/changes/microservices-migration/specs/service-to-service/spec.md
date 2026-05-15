## ADDED Requirements

### Requirement: Feign Client Invocation
Services SHALL use Spring Cloud OpenFeign with Nacos service discovery for synchronous inter-service calls.

#### Scenario: Customization service queries product info
- **WHEN** `sjzm-customization` needs product details for a final draft
- **THEN** it calls `ProductClient.getProduct(id)` which resolves to a `sjzm-product` instance via Nacos

#### Scenario: Feign client handles timeout
- **WHEN** a Feign call to `sjzm-product` exceeds the configured timeout
- **THEN** the calling service receives a fallback response instead of hanging

### Requirement: Asynchronous Event Notification
Services SHALL use RocketMQ for asynchronous notifications when response is not required immediately.

#### Scenario: Image processing completion notification
- **WHEN** `sjzm-image` finishes processing an uploaded image
- **THEN** it publishes a message to `sjzm-image-topic` which `sjzm-customization` consumes to update its reference

#### Scenario: MQ consumer handles duplicate messages
- **WHEN** a RocketMQ message is redelivered due to network issue
- **THEN** the consumer detects the duplicate via message key and skips processing
