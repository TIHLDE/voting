.PHONY: fresh
fresh:
	@echo "Stopping and removing containers..."
	docker compose down
	docker compose up

.PHONY: down
down:
	@echo "Stopping containers..."
	docker compose down

.PHONY: up
up:
	@echo "Starting containers..."
	docker compose up

.PHONY: clean
clean:
	@echo "Stopping containers..."
	docker compose down
	docker system prune -a

.PHONY: dev
dev:
	@echo "Starting containers..."
	docker compose --profile dev up

