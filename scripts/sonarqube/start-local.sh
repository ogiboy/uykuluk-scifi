#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${SONARQUBE_COMPOSE_FILE:-${REPO_ROOT}/scripts/sonarqube/docker-compose.sonarqube.yml}"
SONAR_HOST_URL="${SONAR_HOST_URL:-http://localhost:9000}"
START_TIMEOUT_SECONDS="${SONARQUBE_START_TIMEOUT_SECONDS:-90}"
SONAR_CONTAINER_NAME="${SONARQUBE_CONTAINER_NAME:-sonarqube}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to start local SonarQube." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_COMMAND=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_COMMAND=(docker-compose)
else
  echo "Docker Compose is required. Install Docker Compose v2 or docker-compose." >&2
  exit 1
fi

"${COMPOSE_COMMAND[@]}" -f "${COMPOSE_FILE}" up -d
echo "Local SonarQube is starting at ${SONAR_HOST_URL}"

deadline=$((SECONDS + START_TIMEOUT_SECONDS))
while ((SECONDS < deadline)); do
  if response="$(curl -fsS "${SONAR_HOST_URL}/api/system/status" 2>/dev/null)"; then
    if grep -q '"status":"UP"' <<<"${response}"; then
      echo "Local SonarQube is ready at ${SONAR_HOST_URL}"
      exit 0
    fi
  fi

  container_state="$(docker inspect -f '{{.State.Status}}' "${SONAR_CONTAINER_NAME}" 2>/dev/null || true)"
  if [[ "${container_state}" == "exited" || "${container_state}" == "dead" ]]; then
    echo "SonarQube container stopped before becoming ready. Recent logs:" >&2
    docker logs "${SONAR_CONTAINER_NAME}" --tail 80 >&2 || true
    exit 1
  fi

  sleep 3
done

echo "Timed out waiting for local SonarQube to become ready at ${SONAR_HOST_URL}." >&2
docker ps --filter "name=^${SONAR_CONTAINER_NAME}$" \
  --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" >&2 || true
docker logs "${SONAR_CONTAINER_NAME}" --tail 80 >&2 || true
exit 1
