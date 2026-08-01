#!/usr/bin/env bash
set -Eeuo pipefail

readonly PROJECT_NAME="myhappywallet-backend"
readonly COMPOSE_FILE="/opt/myhappywallet-backend/compose.production.yml"
readonly ENV_FILE="/etc/myhappywallet-backend/backend.env"
readonly IMAGE_REPOSITORY_FILE="/etc/myhappywallet-backend/image-repository"
readonly STATE_DIR="/var/lib/myhappywallet-backend"
readonly CURRENT_IMAGE_FILE="${STATE_DIR}/current-image"

if [[ "${EUID}" -ne 0 ]]; then
  echo "This deployment command must run as root." >&2
  exit 1
fi

if [[ "$#" -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: deploy-mhw-backend <40-character Git commit SHA>" >&2
  exit 2
fi

for required_file in "${COMPOSE_FILE}" "${ENV_FILE}" "${IMAGE_REPOSITORY_FILE}"; do
  if [[ ! -f "${required_file}" ]]; then
    echo "Missing required file: ${required_file}" >&2
    exit 3
  fi
done

readonly DEPLOY_SHA="$1"
IMAGE_REPOSITORY="$(<"${IMAGE_REPOSITORY_FILE}")"
readonly IMAGE_REPOSITORY
if [[ ! "${IMAGE_REPOSITORY}" =~ ^registry\.gitlab\.com/[a-zA-Z0-9._/-]+$ ]]; then
  echo "Invalid GitLab image repository." >&2
  exit 4
fi

readonly NEXT_IMAGE="${IMAGE_REPOSITORY}:${DEPLOY_SHA}"
PREVIOUS_IMAGE=""
if [[ -f "${CURRENT_IMAGE_FILE}" ]]; then
  PREVIOUS_IMAGE="$(<"${CURRENT_IMAGE_FILE}")"
fi

compose() {
  BACKEND_ENV_FILE="${ENV_FILE}" BACKEND_IMAGE="$1" \
    docker compose --project-name "${PROJECT_NAME}" --file "${COMPOSE_FILE}" "${@:2}"
}

rollback() {
  if [[ -n "${PREVIOUS_IMAGE}" ]]; then
    echo "Deployment failed; restoring ${PREVIOUS_IMAGE}." >&2
    compose "${PREVIOUS_IMAGE}" up --detach --no-deps --wait --wait-timeout 90 backend
  else
    echo "Deployment failed and no previous container image is recorded." >&2
  fi
}

install -d -m 700 "${STATE_DIR}"

compose "${NEXT_IMAGE}" pull backend
compose "${NEXT_IMAGE}" run --rm --no-deps backend \
  node -e "require('./dist/config/config')"
echo "Production configuration validation passed."
compose "${NEXT_IMAGE}" run --rm --no-deps backend npm run db:deploy

if ! compose "${NEXT_IMAGE}" up --detach --no-deps --wait --wait-timeout 90 backend; then
  rollback
  exit 5
fi

printf '%s\n' "${NEXT_IMAGE}" > "${CURRENT_IMAGE_FILE}.tmp"
chmod 600 "${CURRENT_IMAGE_FILE}.tmp"
mv "${CURRENT_IMAGE_FILE}.tmp" "${CURRENT_IMAGE_FILE}"

echo "Backend deployment completed: ${NEXT_IMAGE}"
