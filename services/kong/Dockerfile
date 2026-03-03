# Kong API Gateway - Dockerfile
# Student ID: G21266967
# HTTPS enabled via Let's Encrypt certificate

FROM kong:3.4

COPY kong.yaml /usr/local/kong/declarative/kong.yaml

ENV KONG_DATABASE=off
ENV KONG_DECLARATIVE_CONFIG=/usr/local/kong/declarative/kong.yaml
ENV KONG_PROXY_ACCESS_LOG=/dev/stdout
ENV KONG_ADMIN_ACCESS_LOG=/dev/stdout
ENV KONG_PROXY_ERROR_LOG=/dev/stderr
ENV KONG_ADMIN_ERROR_LOG=/dev/stderr
ENV KONG_PROXY_LISTEN="0.0.0.0:8000, 0.0.0.0:8443 ssl"

EXPOSE 8000 8443 8001

CMD ["kong", "docker-start"]
